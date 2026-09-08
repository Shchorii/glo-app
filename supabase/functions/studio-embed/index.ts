// Supabase Edge Function: ingest a public video/image URL into the caller's library.
// Auth: verify_jwt ON. Direct MP4/image or TikTok/YouTube oEmbed preview.
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_BYTES = 50 * 1024 * 1024;

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

  static async oEmbed(url: URL): Promise<{ title: string; thumbnail?: string } | null> {
    const target = url.toString();
    let endpoint: string | null = null;
    if (EmbedIngest.isTikTok(url)) endpoint = `https://www.tiktok.com/oembed?url=${encodeURIComponent(target)}`;
    else if (EmbedIngest.isYouTube(url)) endpoint = `https://www.youtube.com/oembed?url=${encodeURIComponent(target)}&format=json`;
    else if (EmbedIngest.isInstagram(url)) {
      throw new Error("Instagram needs a Meta oEmbed token we do not have in this build. Paste a direct MP4, or a TikTok URL.");
    }
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
    const res = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(25000) });
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
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
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
    const oembed = await EmbedIngest.oEmbed(source).catch((e) => {
      if (e instanceof Error && e.message.includes("Instagram")) throw e;
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

    return json({
      creative: data,
      note: previewOnly
        ? "Saved the public preview. Remix it in Generate to make a street-ready clip."
        : undefined,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const status = /sign in/i.test(msg) ? 401 : 400;
    return json({ error: msg }, status);
  }
});
