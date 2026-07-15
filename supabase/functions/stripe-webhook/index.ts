// Supabase Edge Function: Stripe webhook. Flips campaigns to pending_review on paid sessions.
// verify_jwt OFF; authenticity comes from the Stripe signature.
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
  } catch (error) {
    throw new Error(`Could not read ${name} from Vault.`, { cause: error });
  } finally {
    await sql.end({ timeout: 2 });
  }
}

const cryptoProvider = Stripe.createSubtleCryptoProvider();

Deno.serve(async (req) => {
  const sig = req.headers.get("stripe-signature");
  if (!sig) return new Response("missing signature", { status: 400 });

  try {
    cachedKey = cachedKey ?? (await getSecret("STRIPE_SECRET_KEY"));
    cachedWhSecret = cachedWhSecret ?? (await getSecret("STRIPE_WEBHOOK_SECRET"));
    if (!cachedKey || !cachedWhSecret) return new Response("stripe not configured", { status: 503 });
  } catch (error) {
    console.error("Stripe secret resolution failed.", error);
    return new Response("stripe configuration unavailable", { status: 500 });
  }

  if (!cachedKey || !cachedWhSecret) return new Response("stripe not configured", { status: 503 });
  const stripe = new Stripe(cachedKey, { httpClient: Stripe.createFetchHttpClient() });
  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, sig, cachedWhSecret, undefined, cryptoProvider);
  } catch (error) {
    console.warn("Stripe webhook signature validation failed.", error);
    return new Response("invalid signature", { status: 400 });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      return new Response("webhook service not configured", { status: 503 });
    }
    const admin = createClient(supabaseUrl, serviceRoleKey);

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const campaignId = session.metadata?.campaign_id;
      if (!campaignId) throw new Error("Checkout session is missing campaign_id metadata.");
      const { data: payment, error: paymentError } = await admin
        .from("payments")
        .update({
          status: "succeeded",
          stripe_payment_intent: typeof session.payment_intent === "string" ? session.payment_intent : null,
          updated_at: new Date().toISOString(),
        })
        .eq("stripe_session_id", session.id)
        .select("id")
        .maybeSingle();
      if (paymentError) throw paymentError;
      if (!payment) throw new Error(`Payment record not found for Checkout session ${session.id}.`);

      const { data: updatedCampaign, error: campaignError } = await admin
        .from("campaigns")
        .update({ status: "pending_review", paid_at: new Date().toISOString() })
        .eq("id", campaignId)
        .eq("status", "pending_payment")
        .select("id")
        .maybeSingle();
      if (campaignError) throw campaignError;
      if (!updatedCampaign) {
        const { data: campaign, error: lookupError } = await admin
          .from("campaigns")
          .select("status")
          .eq("id", campaignId)
          .maybeSingle();
        if (lookupError) throw lookupError;
        const alreadyProcessed =
          campaign &&
          ["pending_review", "scheduled", "live", "completed"].includes(campaign.status);
        if (!alreadyProcessed) {
          throw new Error(`Campaign ${campaignId} could not transition to pending_review.`);
        }
      }
    } else if (event.type === "checkout.session.expired") {
      const session = event.data.object as Stripe.Checkout.Session;
      const { data: payment, error: paymentError } = await admin
        .from("payments")
        .update({ status: "expired", updated_at: new Date().toISOString() })
        .eq("stripe_session_id", session.id)
        .select("id")
        .maybeSingle();
      if (paymentError) throw paymentError;
      if (!payment) throw new Error(`Payment record not found for Checkout session ${session.id}.`);
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Stripe webhook processing failed.", e);
    return new Response("webhook processing failed", { status: 500 });
  }
});
