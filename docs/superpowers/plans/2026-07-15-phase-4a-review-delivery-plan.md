# Phase 4a: Review queue + status machine + delivery jobs (2026-07-15)

Spec: docs/superpowers/specs/2026-07-14-glo-app-v1-design.md (sections 5, 6, 11-phase-4)
This slice: admin review view, automated status machine, delivery_jobs scaffolding, real dashboard stats. VAST/manual adapters land in 4b.

## DB migration `glo_v5_review_and_status_machine`
- delivery_jobs existed from Phase 1 (state enum uses 'running'); added owner SELECT policy via campaign join.
- RPC `approve_campaign(cid uuid)` (security definer, admin-gated): creative → approved, campaign pending_review → scheduled, insert one delivery_jobs row per distinct publisher across the campaign's screens.
- RPC `reject_creative(cid uuid, reason text)` (admin-gated): creative → rejected + reason; campaign stays pending_review so the customer can fix and resubmit without paying again.
- pg_cron hourly (glo-status-machine, 17 * * * *): scheduled → live when start_date reached; live → completed when end_date passed; delivery jobs follow (running/done). Approve is the only door into scheduled, so scheduled implies an approved creative.
- Seed: idan@we-are-glo.com profile role = admin.

## Frontend
- /admin/review (wrapped in AppShell): role-gated client page. Queue of pending_review campaigns with creative preview (signed URL), flight, timing, total. Approve button and Reject with a reason prompt, both via RPC. Not in the nav; direct URL for now.
- Customer campaign page already shows rejection reason (shipped in Phase 2); "replace creative" flow deferred to 4b.
- Dashboard real play data deferred to 4b alongside VAST (current dashboard is a server component on demo data; the refactor belongs with real delivery).

## Verification gates (all passed 2026-07-15)
- Anon RPC call → "admin only". Owner delivery_jobs visible; admin approve as Idan → 204.
- Approve path e2e: pending_review → scheduled + delivery_jobs row (vast adapter, pending).
- Status machine SQL manual run: backdated scheduled campaign → live, job → running. Cron registered and active.
- Build green with /admin/review route; deploy bundle-verified.
