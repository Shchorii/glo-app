// Supabase Edge Function: QR scan beacon (replaces Next /api/scan).
// v1 stub: acknowledges the scan. Wired to delivery_jobs counters in Phase 4.
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  let code = "JP-FRIDAY10";
  try {
    const body = await req.json();
    if (typeof body?.code === "string") code = body.code;
  } catch { /* default */ }
  return new Response(JSON.stringify({ ok: true, code }), {
    headers: { ...CORS, "Content-Type": "application/json" },
  });
});
