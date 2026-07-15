// Supabase Edge Function: QR scan beacon (replaces Next /api/scan).
// v1 stub: acknowledges the scan. Wired to delivery_jobs counters in Phase 4.
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...CORS, "Content-Type": "application/json" },
    });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Request body must be valid JSON." }, 400);
  }
  const code =
    typeof body === "object" && body !== null && "code" in body
      ? (body as { code?: unknown }).code
      : null;
  if (typeof code !== "string" || !code.trim()) {
    return json({ error: "code must be a non-empty string." }, 400);
  }
  return json({ ok: true, code });
});
