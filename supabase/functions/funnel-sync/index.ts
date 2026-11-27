// Supabase Edge Function: funnel-sync.
// Reports server-side funnel stages (paid, running, completed, repeat) to we-are-glo.com/api/intent,
// straight from the campaigns table, so they are counted even if the customer never reopens the app.
// Called hourly by a Vercel cron on we-are-glo.com. Idempotent: /api/intent drops events it already has
// (same event + campaign id), so re-running is harmless.
import { createClient } from "npm:@supabase/supabase-js@2";

const INTENT = "https://we-are-glo.com/api/intent";
const PAID = ["pending_review", "scheduled", "live", "completed"];

Deno.serve(async () => {
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const since = new Date(Date.now() - 365 * 864e5).toISOString();
  const { data: rows, error } = await admin
    .from("campaigns")
    .select("id,user_id,status,total_usd,paid_at")
    .not("paid_at", "is", null)
    .gte("paid_at", since)
    .order("paid_at", { ascending: true })
    .limit(500);
  if (error) return new Response(JSON.stringify({ ok: false, error: error.message }), { status: 500 });

  const emails = new Map<string, string>();
  const firstPaid = new Map<string, string>();
  for (const c of rows ?? []) if (!firstPaid.has(c.user_id)) firstPaid.set(c.user_id, c.id);

  let sent = 0;
  const post = async (event: string, c: { id: string; user_id: string; total_usd: number }) => {
    if (!emails.has(c.user_id)) {
      const { data } = await admin.auth.admin.getUserById(c.user_id);
      emails.set(c.user_id, data?.user?.email ?? "");
    }
    const body = JSON.stringify({
      event,
      detail: `${c.id} · ${Number(c.total_usd)}`,
      vid: "",
      uid: c.user_id,
      email: emails.get(c.user_id),
      campaign_id: "server",
      url: "server:funnel-sync",
    });
    const r = await fetch(INTENT, { method: "POST", headers: { "Content-Type": "text/plain", "User-Agent": "glo-funnel-sync" }, body });
    if (r.ok) sent++;
  };

  for (const c of rows ?? []) {
    if (!PAID.includes(c.status)) continue; // refunded / cancelled after payment: skip
    await post("paid", c);
    if (["scheduled", "live", "completed"].includes(c.status)) await post("campaign_live", c);
    if (c.status === "completed") await post("campaign_completed", c);
    if (firstPaid.get(c.user_id) !== c.id) await post("repeat_booking", c);
  }
  return new Response(JSON.stringify({ ok: true, campaigns: rows?.length ?? 0, sent }), { headers: { "Content-Type": "application/json" } });
});
