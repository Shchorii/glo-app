// Supabase Edge Function: waitlist signup -> Airtable (base appMd5dIIbmvUkaKJ, table "Signups").
// API key resolution: Supabase Vault ('AIRTABLE_API_KEY') first, env secret as fallback.
import postgres from "npm:postgres@3.4.5";

const AIRTABLE_BASE_ID = Deno.env.get("AIRTABLE_WAITLIST_BASE_ID") ?? "appMd5dIIbmvUkaKJ";
const AIRTABLE_TABLE = Deno.env.get("AIRTABLE_WAITLIST_TABLE") ?? "Signups";
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

let cachedKey: string | null = null;

async function getAirtableKey(): Promise<string> {
  if (cachedKey) return cachedKey;
  const dbUrl = Deno.env.get("SUPABASE_DB_URL");
  if (dbUrl) {
    const sql = postgres(dbUrl, { max: 1, prepare: false });
    try {
      const rows = await sql`select decrypted_secret from vault.decrypted_secrets where name = 'AIRTABLE_API_KEY' limit 1`;
      const key = rows[0]?.decrypted_secret as string | undefined;
      if (key) { cachedKey = key; return key; }
    } catch { /* fall through to env */ } finally {
      await sql.end({ timeout: 2 });
    }
  }
  const envKey = Deno.env.get("AIRTABLE_API_KEY");
  if (envKey) { cachedKey = envKey; return envKey; }
  throw new Error("no key source");
}

function detectDeviceOS(ua: string): string {
  const lower = ua.toLowerCase();
  if (/iphone|ipad|ipod/.test(lower)) return "iOS";
  if (/android/.test(lower)) return "Android";
  return "Web";
}

function detectDeviceType(ua: string): string {
  const lower = ua.toLowerCase();
  if (/mobile|iphone|ipod|android(?!.*tablet)/i.test(lower)) return "Mobile";
  if (/ipad|tablet|kindle/i.test(lower)) return "Tablet";
  return "Desktop";
}

async function geoFromIp(ip: string) {
  const fallback = { city: "", region: "", country: "", postal: "", latitude: null as number | null, longitude: null as number | null };
  if (!ip || ip === "127.0.0.1" || ip === "::1") return fallback;
  try {
    const res = await fetch(`https://ipapi.co/${ip}/json/`, {
      headers: { "User-Agent": "glo-waitlist/1.0" },
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return fallback;
    const data = await res.json();
    return {
      city: data.city ?? "",
      region: data.region ?? "",
      country: data.country_name ?? "",
      postal: data.postal ?? "",
      latitude: data.latitude ?? null,
      longitude: data.longitude ?? null,
    };
  } catch {
    return fallback;
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

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }

  const email = body.email as string | undefined;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ error: "Valid email is required" }, 400);
  }

  let apiKey: string;
  try { apiKey = await getAirtableKey(); } catch {
    console.error("AIRTABLE_API_KEY not configured");
    return json({ error: "Service unavailable" }, 503);
  }

  const now = new Date();
  const submissionDate = now.toISOString();
  const ua = req.headers.get("user-agent") ?? "";
  const forwarded = req.headers.get("x-forwarded-for");
  const ip = forwarded ? forwarded.split(",")[0].trim() : req.headers.get("x-real-ip") ?? "";
  const geo = await geoFromIp(ip);

  const fields: Record<string, string | number | null> = {
    Email: email,
    Phone: (body.phone as string) ?? "",
    "Advertiser Type": (body.advertiser_type as string) ?? "",
    "Business Size": (body.business_size as string) ?? "",
    "Use Case": (body.use_case as string) ?? "",
    City: geo.city,
    "State/Province": geo.region,
    Country: geo.country,
    "ZIP Code": geo.postal,
    "Device OS": detectDeviceOS(ua),
    "Device Type": detectDeviceType(ua),
    "IP Address": ip,
    Latitude: geo.latitude,
    Longitude: geo.longitude,
    "Submission Date": submissionDate,
    "QR Scan Time": submissionDate,
    "Scan Hour (UTC)": now.getUTCHours(),
    "Scan Day of Week": DAYS[now.getUTCDay()],
    "Campaign ID": (body.campaign_id as string) ?? "organic",
  };

  try {
    const res = await fetch(
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(AIRTABLE_TABLE)}`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ typecast: true, fields }),
      },
    );
    if (!res.ok) {
      console.error("Airtable error:", res.status, await res.text());
      return json({ error: "Failed to save" }, 502);
    }
    return json({ ok: true });
  } catch (err) {
    console.error("Waitlist submission error:", err);
    return json({ error: "Failed to save" }, 500);
  }
});
