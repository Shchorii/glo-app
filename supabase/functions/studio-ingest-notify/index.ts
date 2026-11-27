// Supabase Edge Function: fire-and-forget Glo Moderation ingest after a client-side creative insert.
// Auth: verify_jwt ON. Key resolution: env MODERATION_WEBHOOK_* first, Vault fallback.
import { createClient } from "npm:@supabase/supabase-js@2";
import { notifyModerationIngest } from "../_shared/moderation.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
    if (!url || !anon || !service) return json({ ok: true });

    const authed = createClient(url, anon, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });
    const { data: userData, error: userErr } = await authed.auth.getUser();
    if (userErr || !userData.user) return json({ error: "Sign in to notify moderation." }, 401);

    const payload = await req.json().catch(() => ({})) as { creative_id?: string; content_type?: string };
    if (!payload.creative_id || typeof payload.creative_id !== "string") {
      return json({ error: "creative_id required" }, 400);
    }

    const admin = createClient(url, service);
    const { data, error } = await admin
      .from("creatives")
      .select("id, user_id, source, storage_path, width_px, height_px, duration_s, source_url, created_at")
      .eq("id", payload.creative_id)
      .maybeSingle();
    if (error || !data) return json({ ok: true });
    if (data.user_id !== userData.user.id) return json({ error: "Not your creative." }, 403);

    const contentType = typeof payload.content_type === "string" ? payload.content_type : null;
    await notifyModerationIngest(admin, data, contentType);
    return json({ ok: true });
  } catch (e) {
    console.error("studio-ingest-notify:", e instanceof Error ? e.message : String(e));
    return json({ ok: true });
  }
});
