// Supabase Edge Function: create a Stripe Checkout Session for a campaign.
// Auth: verify_jwt ON. Key resolution: env STRIPE_SECRET_KEY first, Vault fallback.
import Stripe from "npm:stripe@17.7.0";
import { createClient } from "npm:@supabase/supabase-js@2";
import postgres from "npm:postgres@3.4.5";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const APP_BASE = "https://app.we-are-glo.com";
let cachedStripeKey: string | null = null;

async function getSecret(name: string): Promise<string | null> {
  const envVal = Deno.env.get(name);
  if (envVal) return envVal;
  const dbUrl = Deno.env.get("SUPABASE_DB_URL");
  if (!dbUrl) return null;
  const sql = postgres(dbUrl, { max: 1, prepare: false });
  try {
    const rows = await sql`select decrypted_secret from vault.decrypted_secrets where name = ${name} limit 1`;
    return (rows[0]?.decrypted_secret as string | undefined) ?? null;
  } catch {
    return null;
  } finally {
    await sql.end({ timeout: 2 });
  }
}

// KEEP IN SYNC with src/lib/dayparts.ts
const DAYPART_SHARES: Record<string, number> = {
  morning_rush: 0.35, daytime: 0.4, evening_rush: 0.35, evening: 0.25, late_night: 0.15,
};
function daypartMultiplier(ids: string[] | null | undefined): number {
  if (!ids || !ids.length || ids.includes("all_day")) return 1;
  const sum = ids.reduce((a, id) => a + (DAYPART_SHARES[id] ?? 0), 0);
  return Math.min(sum || 1, 1);
}
function daypartLabel(ids: string[] | null | undefined): string {
  if (!ids || !ids.length || ids.includes("all_day")) return "all day";
  return ids.filter((id) => DAYPART_SHARES[id]).join(", ").replaceAll("_", " ");
}

function daysBetween(start: string, end: string): number {
  const s = new Date(`${start}T00:00:00Z`).getTime();
  const e = new Date(`${end}T00:00:00Z`).getTime();
  if (Number.isNaN(s) || Number.isNaN(e) || e < s) return 0;
  return Math.round((e - s) / 86400000) + 1;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

  try {
    const { campaign_id } = await req.json();
    if (!campaign_id) return json({ error: "campaign_id required" }, 400);

    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Identify the caller from their JWT
    const authed = createClient(url, anon, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });
    const { data: userData, error: userErr } = await authed.auth.getUser();
    if (userErr || !userData.user) return json({ error: "Sign in to pay." }, 401);
    const user = userData.user;

    // Server-side truth: recompute total from screens x days
    const admin = createClient(url, service);
    const { data: c, error: cErr } = await admin
      .from("campaigns")
      .select("id, user_id, name, start_date, end_date, status, dayparts, campaign_screens(screens(daily_price_usd))")
      .eq("id", campaign_id)
      .maybeSingle();
    if (cErr) throw cErr;
    if (!c || c.user_id !== user.id) return json({ error: "Campaign not found." }, 404);
    if (c.status !== "pending_payment" && c.status !== "draft") {
      return json({ error: `Campaign is ${c.status}; nothing to pay.` }, 409);
    }

    const prices = ((c.campaign_screens as { screens: { daily_price_usd: string | number } }[]) ?? [])
      .map((cs) => Number(cs.screens?.daily_price_usd ?? 0))
      .filter((n) => n > 0);
    const days = daysBetween(c.start_date, c.end_date);
    const dpMult = daypartMultiplier(c.dayparts as string[] | null);
    const total = Math.round(prices.reduce((a, b) => a + b, 0) * dpMult * days * 100) / 100;
    if (!prices.length || days < 1 || total < 1) return json({ error: "Campaign has no billable screens or days." }, 422);

    const stripeKey = cachedStripeKey ?? (cachedStripeKey = await getSecret("STRIPE_SECRET_KEY"));
    if (!stripeKey) return json({ error: "Stripe key not configured yet. Checkout opens shortly." }, 503);

    const stripe = new Stripe(stripeKey, { httpClient: Stripe.createFetchHttpClient() });

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `Glo campaign: ${c.name}`,
              description: `${prices.length} screen${prices.length === 1 ? "" : "s"} x ${days} day${days === 1 ? "" : "s"} (${c.start_date} to ${c.end_date}), ${daypartLabel(c.dayparts as string[] | null)}`,
            },
            unit_amount: Math.round(total * 100),
          },
          quantity: 1,
        },
      ],
      success_url: `${APP_BASE}/campaigns/view/?id=${c.id}&paid=1`,
      cancel_url: `${APP_BASE}/campaigns/view/?id=${c.id}`,
      customer_email: user.email ?? undefined,
      metadata: { campaign_id: c.id, user_id: user.id },
    });

    // Keep the stored total honest and record the payment attempt
    await admin.from("campaigns").update({ total_usd: total, status: "pending_payment" }).eq("id", c.id);
    const { error: pErr } = await admin.from("payments").insert({
      campaign_id: c.id,
      user_id: user.id,
      stripe_session_id: session.id,
      amount_usd: total,
      currency: "usd",
      status: "created",
    });
    if (pErr) throw pErr;

    return json({ url: session.url });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
