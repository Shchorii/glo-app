# Phase 2: Booking Core — Implementation Plan (2026-07-14)

Spec: docs/superpowers/specs/2026-07-14-glo-app-v1-design.md (sections 3, 4, 11-phase-2)
Scope: screens map/list, campaign builder, creative upload + templates, draft campaigns.
Out of scope (Phase 3+): Stripe payment, webhooks, admin review, delivery.

## Constraints
- Static export (no server components with data, no dynamic params beyond demo ids). All Supabase reads/writes client-side via anon key + RLS.
- Private storage bucket `creatives`; upload path must be `${auth.uid()}/...` per RLS policy; previews via signed URLs.
- User campaign detail cannot use `/campaigns/[uuid]` (static export). Use `/campaigns/view?id=` client route with useSearchParams.
- Booking requires session; unauthenticated users are redirected to `/sign-in?next=/book`.
- Prices come from `screens.daily_price_usd` (floor $29 enforced at DB). Total = sum(price) x days, computed client-side and stored on the campaign.

## Tasks
1. **lib/db.ts** — typed helpers: `listScreens()`, `createCampaign(input)` (campaign + campaign_screens + optional creative link), `listMyCampaigns()`, `getCampaign(id)`, `uploadCreative(blob, meta)` (storage upload + creatives row), `signedCreativeUrl(path)`.
2. **/book** — 4-step client wizard:
   - Step 1 Screens: list + Leaflet map toggle, filters (city, venue type), multi-select with per-day price and running per-day subtotal.
   - Step 2 Dates: start/end date inputs (min today), day count, live total.
   - Step 3 Creative: EITHER file upload (mp4/png/jpg, ≤50MB, client-validated) OR template builder (canvas-rendered PNG: headline, subline, 3 style presets, brand color) uploaded to storage.
   - Step 4 Review & save: creates campaign `status=pending_payment` with screens + creative, shows "Payment goes live in the next release; your campaign is saved" notice, links to /campaigns.
   - Draft persistence: "Save draft" available from step 2 onward (`status=draft`).
3. **/campaigns** — session users see their real campaigns (status chip, dates, total, screens count) + "Book screens" CTA + empty state; signed-out users keep the demo card. Demo detail routes untouched.
4. **/campaigns/view?id=** — client detail: status, screens list, dates, total, creative preview (signed URL), cancel-draft action (status update to cancelled while draft).
5. **AppShell** — add "Book" nav item.
6. **Verify** — `tsc --noEmit`, `next build` (static export, all routes), deploy via PR merge, bundle-hash verification on app.we-are-glo.com, live smoke: screens load from Supabase on /book.

## Verification gates
- Build exports with zero errors, /book present in output.
- RLS smoke: anonymous listScreens returns 10 rows; campaign insert without session fails.
- Deployed bundle contains "/book" route and Supabase queries; all routes 200.
