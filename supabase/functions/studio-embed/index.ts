// Supabase Edge Function: ingest a public video/image URL into the caller's library.
// Auth: verify_jwt ON. Direct MP4/image or TikTok/YouTube/Instagram preview.
// Instagram: Meta Graph oEmbed (tokenless since 2026-06-15). Optional META_OEMBED_TOKEN
// (env or Vault) for higher rate limits — same secret wiring as FAL_KEY on studio-generate.
import { createClient } from "npm:@supabase/supabase-js@2";
import postgres from "npm:postgres@3.4.5";
import { notifyModerationIngest } from "../_shared/moderation.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_BYTES = 50 * 1024 * 1024;
const META_OEMBED_TOKEN = "META_OEMBED_TOKEN";
const IG_TOKEN_MISSING =
  "Instagram embed is not configured yet. Set META_OEMBED_TOKEN on the studio-embed Edge Function (or in Vault).";
const IG_CRAWLER_UA = "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)";

class StudioSecrets {
  static cache = new Map<string, string | null>();

  static async get(name: string): Promise<string | null> {
    if (StudioSecrets.cache.has(name)) return StudioSecrets.cache.get(name) ?? null;
    const envVal = Deno.env.get(name);
    if (envVal) {
      StudioSecrets.cache.set(name, envVal);
      return envVal;
    }
    const dbUrl = Deno.env.get("SUPABASE_DB_URL");
    if (!dbUrl) {
      StudioSecrets.cache.set(name, null);
      return null;
    }
    const sql = postgres(dbUrl, { max: 1, prepare: false });
    try {
      const rows = await sql`select decrypted_secret from vault.decrypted_secrets where name = ${name} limit 1`;
      const val = (rows[0]?.decrypted_secret as string | undefined) ?? null;
      StudioSecrets.cache.set(name, val);
      return val;
    } catch {
      StudioSecrets.cache.set(name, null);
      return null;
    } finally {
      await sql.end({ timeout: 2 });
    }
  }
}

class EmbedIngest {
  static normalize(raw: string): URL {
    const trimmed = raw.trim();
    const withProto = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    let url: URL;
    try {
      url = new URL(withProto);
    } catch {
      throw new Error("That does not look like a URL.");
    }
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new Error("Only http(s) URLs can be embedded.");
    }
    return url;
  }

  static host(url: URL): string {
    return url.hostname.replace(/^www\./, "").toLowerCase();
  }

  static isTikTok(url: URL): boolean {
    const h = EmbedIngest.host(url);
    return h === "tiktok.com" || h.endsWith(".tiktok.com");
  }

  static isInstagram(url: URL): boolean {
    const h = EmbedIngest.host(url);
    return h === "instagram.com" || h === "instagr.am" || h.endsWith(".instagram.com");
  }

  static isYouTube(url: URL): boolean {
    const h = EmbedIngest.host(url);
    return h === "youtube.com" || h === "youtu.be" || h.endsWith(".youtube.com");
  }

  static decodeEntities(s: string): string {
    return s
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"')
      .replace(/&#39;|&apos;/g, "'")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
      .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)));
  }

  static metaContent(html: string, property: string): string | undefined {
    const escaped = property.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const a = html.match(new RegExp(`property="${escaped}" content="([^"]+)"`, "i"));
    if (a?.[1]) return EmbedIngest.decodeEntities(a[1]);
    const b = html.match(new RegExp(`content="([^"]+)" property="${escaped}"`, "i"));
    return b?.[1] ? EmbedIngest.decodeEntities(b[1]) : undefined;
  }

  static isDefaultIgLogo(image: string): boolean {
    return /rsrc\.php|static\.cdninstagram\.com\/rsrc/i.test(image);
  }

  /** Meta no longer returns thumbnail_url from oEmbed; pull og:image from the post HTML. */
  static async instagramHtmlMeta(url: URL): Promise<{ title?: string; image?: string }> {
    const res = await fetch(url.toString(), {
      redirect: "follow",
      signal: AbortSignal.timeout(10000),
      headers: { "User-Agent": IG_CRAWLER_UA, Accept: "text/html" },
    });
    if (!res.ok) return {};
    const html = await res.text();
    const image = EmbedIngest.metaContent(html, "og:image");
    const title = EmbedIngest.metaContent(html, "og:title");
    if (image && EmbedIngest.isDefaultIgLogo(image)) return { title };
    return { title, image };
  }

  static async instagramMediaFallback(url: URL): Promise<string | undefined> {
    const media = new URL(url.toString());
    media.search = "";
    media.hash = "";
    media.pathname = `${media.pathname.replace(/\/$/, "")}/media/`;
    media.searchParams.set("size", "l");
    const res = await fetch(media.toString(), {
      redirect: "follow",
      signal: AbortSignal.timeout(10000),
      headers: {
        "User-Agent": "GloStudio/1.0 (https://app.we-are-glo.com)",
        Accept: "image/*,*/*",
        Referer: "https://www.instagram.com/",
      },
    });
    const ct = res.headers.get("content-type") || "";
    if (!res.ok || !/^image\//i.test(ct)) return undefined;
    return res.url;
  }

  static tokenRequired(data: { error?: { message?: string; type?: string; code?: number } }): boolean {
    const code = data.error?.code;
    const msg = data.error?.message ?? "";
    return code === 104 || code === 190 || /access token/i.test(msg);
  }

  static async instagramOEmbed(url: URL, token: string | null): Promise<{ title: string; thumbnail?: string }> {
    const endpoint = new URL("https://graph.facebook.com/v25.0/instagram_oembed");
    endpoint.searchParams.set("url", url.toString());
    endpoint.searchParams.set("omitscript", "true");
    if (token) endpoint.searchParams.set("access_token", token);

    const res = await fetch(endpoint.toString(), { signal: AbortSignal.timeout(8000) });
    const data = await res.json().catch(() => ({})) as {
      error?: { message?: string; type?: string; code?: number };
    };

    if (!res.ok) {
      if (EmbedIngest.tokenRequired(data) && !token) throw new Error(IG_TOKEN_MISSING);
      if (EmbedIngest.tokenRequired(data) && token) {
        throw new Error("Instagram Meta token was rejected. Check META_OEMBED_TOKEN on the studio-embed Edge Function (or in Vault).");
      }
      throw new Error("Could not read that Instagram post. Check the URL is public.");
    }

    const meta = await EmbedIngest.instagramHtmlMeta(url);
    const thumbnail = meta.image ?? await EmbedIngest.instagramMediaFallback(url);
    if (!thumbnail) throw new Error("Could not fetch a public preview for that Instagram post.");
    const title = (meta.title || "Instagram post").slice(0, 80);
    return { title, thumbnail };
  }

  static async oEmbed(url: URL, token: string | null): Promise<{ title: string; thumbnail?: string } | null> {
    const target = url.toString();
    if (EmbedIngest.isInstagram(url)) return EmbedIngest.instagramOEmbed(url, token);

    let endpoint: string | null = null;
    if (EmbedIngest.isTikTok(url)) endpoint = `https://www.tiktok.com/oembed?url=${encodeURIComponent(target)}`;
    else if (EmbedIngest.isYouTube(url)) endpoint = `https://www.youtube.com/oembed?url=${encodeURIComponent(target)}&format=json`;
    if (!endpoint) return null;
    const res = await fetch(endpoint, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error("Could not read that post. Check the URL is public.");
    const data = await res.json() as { title?: string; author_name?: string; thumbnail_url?: string };
    const title = (data.title || data.author_name || "Embedded creative").slice(0, 80);
    return { title, thumbnail: data.thumbnail_url };
  }

  static extFromContentType(contentType: string, fallback: string): string {
    const ct = contentType.split(";")[0].trim().toLowerCase();
    if (ct === "video/mp4") return "mp4";
    if (ct === "video/webm") return "webm";
    if (ct === "video/quicktime") return "mov";
    if (ct === "image/png") return "png";
    if (ct === "image/jpeg") return "jpg";
    if (ct === "image/webp") return "webp";
    if (ct === "image/gif") return "gif";
    return fallback;
  }

  static async download(url: string): Promise<{ bytes: Uint8Array; contentType: string; ext: string }> {
    const igCdn = /instagram|fbcdn|cdninstagram/i.test(url);
    const res = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(25000),
      headers: {
        "User-Agent": igCdn ? IG_CRAWLER_UA : "GloStudio/1.0 (https://app.we-are-glo.com)",
        Accept: "image/*,video/*,*/*",
        ...(igCdn ? { Referer: "https://www.instagram.com/" } : {}),
      },
    });
    if (!res.ok) throw new Error(`Could not fetch media (${res.status}).`);
    const len = Number(res.headers.get("content-length") ?? "0");
    if (len > MAX_BYTES) throw new Error("File is too big. Keep it under 50MB.");
    const contentType = res.headers.get("content-type") || "application/octet-stream";
    if (!/^(video|image)\//i.test(contentType)) {
      throw new Error("That URL did not return a video or image.");
    }
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.byteLength > MAX_BYTES) throw new Error("File is too big. Keep it under 50MB.");
    return {
      bytes: buf,
      contentType,
      ext: EmbedIngest.extFromContentType(contentType, contentType.startsWith("video/") ? "mp4" : "jpg"),
    };
  }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const igToken = await StudioSecrets.get(META_OEMBED_TOKEN);

    if (req.method === "GET") {
      return json({ instagram_token: Boolean(igToken) });
    }
    if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

    const url = Deno.env.get("SUPABASE_URL");
    const anon = Deno.env.get("SUPABASE_ANON_KEY");
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !anon || !service) return json({ error: "Studio embed is not configured." }, 503);

    const authed = createClient(url, anon, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });
    const { data: userData, error: userErr } = await authed.auth.getUser();
    if (userErr || !userData.user) return json({ error: "Sign in to embed creatives." }, 401);
    const uid = userData.user.id;

    const payload = await req.json().catch(() => ({})) as { url?: string; name?: string };
    if (!payload.url || typeof payload.url !== "string") return json({ error: "url required" }, 400);

    const source = EmbedIngest.normalize(payload.url);
    const oembed = await EmbedIngest.oEmbed(source, igToken).catch((e) => {
      if (e instanceof Error && (e.message === IG_TOKEN_MISSING || e.message.includes("Instagram"))) throw e;
      return null;
    });

    const mediaUrl = oembed?.thumbnail ?? source.toString();
    const previewOnly = Boolean(oembed?.thumbnail);
    const file = await EmbedIngest.download(mediaUrl);

    const path = `${uid}/${crypto.randomUUID()}.${file.ext}`;
    const admin = createClient(url, service);
    const { error: upErr } = await admin.storage.from("creatives").upload(path, file.bytes, {
      contentType: file.contentType,
      upsert: false,
    });
    if (upErr) throw upErr;

    const title = (payload.name?.trim() || oembed?.title || source.hostname).slice(0, 80);
    const { data, error } = await admin
      .from("creatives")
      .insert({
        user_id: uid,
        storage_path: path,
        source: "embed",
        name: title,
        source_url: source.toString(),
        provider: EmbedIngest.host(source),
      })
      .select("*")
      .single();
    if (error) throw error;

    await notifyModerationIngest(admin, data, file.contentType);

    return json({
      creative: data,
      note: previewOnly
        ? "Saved the public preview. Remix it in Generate to make a street-ready clip."
        : undefined,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const status = /sign in/i.test(msg) ? 401 : /not configured yet/i.test(msg) ? 503 : 400;
    return json({ error: msg }, status);
  }
});
