import { NextRequest, NextResponse } from "next/server";

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY ?? "";
const AIRTABLE_BASE_ID = process.env.AIRTABLE_WAITLIST_BASE_ID ?? "appMd5dIIbmvUkaKJ";
const AIRTABLE_TABLE = process.env.AIRTABLE_WAITLIST_TABLE ?? "Signups";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

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

interface GeoResult {
  city: string;
  region: string;
  country: string;
  postal: string;
  latitude: number | null;
  longitude: number | null;
}

async function geoFromIp(ip: string): Promise<GeoResult> {
  const fallback: GeoResult = { city: "", region: "", country: "", postal: "", latitude: null, longitude: null };
  if (!ip || ip === "127.0.0.1" || ip === "::1") return fallback;
  try {
    const res = await fetch(`https://ipapi.co/${ip}/json/`, {
      headers: { "User-Agent": "glo-waitlist/1.0" },
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return fallback;
    const data = (await res.json()) as {
      city?: string;
      region?: string;
      country_name?: string;
      postal?: string;
      latitude?: number;
      longitude?: number;
    };
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

export async function POST(req: NextRequest) {
  const body = await req.json();
  const {
    email,
    phone,
    advertiser_type,
    business_size,
    use_case,
    campaign_id,
  } = body as {
    email?: string;
    phone?: string;
    advertiser_type?: string;
    business_size?: string;
    use_case?: string;
    campaign_id?: string;
  };

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Valid email is required" }, { status: 400 });
  }

  if (!AIRTABLE_API_KEY) {
    console.error("AIRTABLE_API_KEY not configured");
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  // Auto-capture: timestamps
  const now = new Date();
  const submissionDate = now.toISOString();
  const scanHour = now.getUTCHours();
  const scanDay = DAYS[now.getUTCDay()];

  // Auto-capture: device
  const ua = req.headers.get("user-agent") ?? "";
  const deviceOS = detectDeviceOS(ua);
  const deviceType = detectDeviceType(ua);

  // Auto-capture: geolocation from IP
  const forwarded = req.headers.get("x-forwarded-for");
  const ip = forwarded ? forwarded.split(",")[0].trim() : req.headers.get("x-real-ip") ?? "";
  const geo = await geoFromIp(ip);

  // Build Airtable fields — matches schema in base appMd5dIIbmvUkaKJ table "Signups"
  const fields: Record<string, string | number | null> = {
    Email: email,
    Phone: phone ?? "",
    "Advertiser Type": advertiser_type ?? "",
    "Business Size": business_size ?? "",
    "Use Case": use_case ?? "",
    City: geo.city,
    "State/Province": geo.region,
    Country: geo.country,
    "ZIP Code": geo.postal,
    "Device OS": deviceOS,
    "Device Type": deviceType,
    "IP Address": ip,
    Latitude: geo.latitude,
    Longitude: geo.longitude,
    "Submission Date": submissionDate,
    "QR Scan Time": submissionDate,
    "Scan Hour (UTC)": scanHour,
    "Scan Day of Week": scanDay,
    "Campaign ID": campaign_id ?? "organic",
  };

  try {
    const res = await fetch(
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(AIRTABLE_TABLE)}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${AIRTABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ typecast: true, fields }),
      }
    );

    if (!res.ok) {
      const err = await res.text();
      console.error("Airtable error:", res.status, err);
      return NextResponse.json({ error: "Failed to save" }, { status: 502 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Waitlist submission error:", err);
    return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  }
}
