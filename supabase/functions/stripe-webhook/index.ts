// Supabase Edge Function: Stripe webhook. Flips campaigns to pending_review on paid sessions.
// verify_jwt OFF; authenticity comes from the Stripe signature.
// Payment always wins: a reservation auto-expired by the 5-minute cron is revived if the card went through.
import Stripe from "npm:stripe@17.7.0";
import { createClient } from "npm:@supabase/supabase-js@2";
import postgres from "npm:postgres@3.4.5";

let cachedKey: string | null = null;
let cachedWhSecret: string | null = null;

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

const cryptoProvider = Stripe.createSubtleCryptoProvider();

Deno.serve(async (req) => {
  try {
    const sig = req.headers.get("stripe-signature");
    if (!sig) return new Response("missing signature", { status: 400 });

    cachedKey = cachedKey ?? (await getSecret("STRIPE_SECRET_KEY"));
    cachedWhSecret = cachedWhSecret ?? (await getSecret("STRIPE_WEBHOOK_SECRET"));
    if (!cachedKey || !cachedWhSecret) return new Response("stripe not configured", { status: 503 });

    const stripe = new Stripe(cachedKey, { httpClient: Stripe.createFetchHttpClient() });
    const body = await req.text();
    const event = await stripe.webhooks.constructEventAsync(body, sig, cachedWhSecret, undefined, cryptoProvider);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const campaignId = session.metadata?.campaign_id;
      await admin
        .from("payments")
        .update({
          status: "succeeded",
          stripe_payment_intent: typeof session.payment_intent === "string" ? session.payment_intent : null,
          updated_at: new Date().toISOString(),
        })
        .eq("stripe_session_id", session.id);
      if (campaignId) {
        await admin
          .from("campaigns")
          .update({ status: "pending_review", paid_at: new Date().toISOString() })
          .eq("id", campaignId)
          .in("status", ["pending_payment", "cancelled"]);
      }
    } else if (event.type === "checkout.session.expired") {
      const session = event.data.object as Stripe.Checkout.Session;
      await admin
        .from("payments")
        .update({ status: "expired", updated_at: new Date().toISOString() })
        .eq("stripe_session_id", session.id);
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(`webhook error: ${e instanceof Error ? e.message : String(e)}`, { status: 400 });
  }
});
