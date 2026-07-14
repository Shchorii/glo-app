# Glo App v1: Real Product Design

Date: 2026-07-14
Status: Approved by Idan (chat session, 2026-07-14)
Scope: Convert glo-app from investor demo into the real self-serve product, shipped as web, PWA, and App Store / Play Store apps from one codebase.

## 1. Product scope (v1)

- Auth, pay, book, serve: a customer can sign up, build a campaign on real screen inventory, pay, pass creative review, and have the campaign delivered to publisher screens.
- Pricing: pay per campaign, priced per day per screen, floor of $29/day. No subscriptions, no wallet.
- Creative: template-based generation plus direct upload. AI creative generation is explicitly deferred.
- Serving: per-publisher delivery adapters (VAST pull, manual ops, SSP stub).
- App Store presence is a v1 requirement, delivered via Capacitor.

Out of scope for v1: AI creative gen, subscriptions, SSP implementation (interface only), publisher self-serve portal, multi-user teams.

## 2. Architecture

- One codebase: glo-app (Next.js). Frontend built as a static client; the identical bundle deploys to Vercel (web + PWA) and is packaged by Capacitor for iOS and Android.
- Supabase is the backend: Auth (email, Google, Apple; Apple sign-in required for App Store), Postgres with row-level security, Storage for creatives.
- Stripe Checkout for per-campaign payments. Campaigns on physical screens are a real-world service under Apple rules, so Stripe in-app is compliant (no IAP).
- Server-side logic (Stripe webhooks, VAST endpoint, delivery adapter jobs, checkout session creation) runs in Supabase Edge Functions so the client stays fully static.
- Existing demo scaffolding (better-auth, Drizzle, better-sqlite3) is removed and replaced by Supabase. Demo content (Johnny's Pizza, mock dashboards) moves behind a demo flag rather than being deleted, since investor deck links depend on it.

## 3. Data model

All tables in Supabase Postgres with RLS so users only see their own data.

- profiles: extends auth.users with business name, role (customer, admin).
- publishers: name, contact, delivery_method enum (vast, ssp, manual). Routes the delivery layer.
- screens: physical inventory. lat/lng (Leaflet map), venue type, publisher FK, daily price, availability. Seeded from publisher feeds or CSV.
- creatives: Storage path, format specs (resolution, duration), source (upload, template), review_status enum (pending, approved, rejected) plus rejection reason.
- campaigns: user FK, selected screens (join table campaign_screens), date range, creative FK, computed total, status machine: draft -> pending_payment -> pending_review -> scheduled -> live -> completed. Cancelled/refunded as terminal branches.
- orders: one per campaign, Stripe payment intent id, status (pending, paid, refunded, partially_refunded).
- delivery_jobs: one per campaign-publisher pair. Adapter type, handoff state, play/impression counts written back for the dashboard.

The campaign status machine is the backbone: Stripe webhook confirms payment, creative review gates go-live, delivery jobs fire on scheduled.

## 4. Booking flow

Mobile-first, four steps:

1. Pick screens: map (Leaflet) or list, filtered by city and venue type, price per day visible.
2. Pick dates: live total updates; $29/day floor enforced.
3. Attach creative: upload (validated client-side against the screen format specs) or template filled with text, logo, colors.
4. Pay: Stripe Checkout. On success, campaign flips to pending_review.

Customer follows status from the dashboard and receives a push notification on each transition, especially go-live.

## 5. Creative review

Protected admin route in the same app. Admin approves or rejects creatives with a reason. Rejection notifies the customer to fix and resubmit without paying again. Publishers requiring their own approval are handled through the manual adapter's ops flow.

## 6. Delivery adapters

One interface, selected by publishers.delivery_method:

- vast: creatives served through the VAST endpoint (moved from the marketing site into an Edge Function). Publisher players pull the tag. VAST tracking events write play counts to delivery_jobs.
- manual: creates an ops task (email to Idan/ops with creative and flight details). Impressions entered manually or estimated from screen traffic. This is the expected v1 workhorse.
- ssp: interface stub only. Implemented when the first programmatic publisher lands.

## 7. Billing

- Edge Function creates the Stripe Checkout session; price computed server-side from screens x days. Client totals are never trusted.
- Webhook: checkout.session.completed marks order paid, campaign pending_review. Refund events recorded on the order.
- Refund path: creative rejected and not resubmitted within the flight window, or screen unavailability, triggers full or prorated refund from the admin view.
- Receipts and invoices via Stripe native features.
- Capacitor: checkout opens in an in-app browser sheet and returns via deep link.

## 8. Mobile packaging

- Capacitor wraps the static build for iOS and Android.
- Native features (also the App Store guideline 4.2 approval strategy): push notifications (campaign status transitions) and camera / camera-roll creative upload.
- Expect one Apple rejection-resubmit cycle; plan roughly a week for store setup and review. Apple developer account required.
- PWA manifest and installability maintained for web users.

## 9. Error handling

- Payment failures: campaign stays pending_payment with retry; abandoned drafts expire after 14 days.
- Creative validation failures: client-side pre-checks plus server-side verification on upload; clear per-spec error messages.
- Delivery failures: delivery_jobs carry an error state surfaced in the admin view; customer-facing status remains scheduled until resolved or refunded.
- Webhook idempotency: all Stripe webhook handlers idempotent on event id.

## 10. Testing

- Unit tests on the status machine and price computation (the two money paths).
- Integration tests on Edge Functions (checkout session, webhook, VAST) against a Supabase branch database.
- E2E happy path (book -> pay test mode -> review -> live) via Playwright before each release.
- Capacitor builds smoke-tested on iOS simulator and one physical device before store submission.

## 11. Build phases

1. Foundation: Supabase project, schema and RLS, auth (email, Google, Apple), static-export refactor, demo content behind a flag, better-auth/Drizzle/SQLite removal.
2. Booking core: screens map/list, campaign builder, creative upload and templates, draft campaigns.
3. Money: Stripe Checkout, webhooks, order lifecycle, receipts.
4. Delivery: status machine, admin review view, VAST and manual adapters, dashboard with real play data.
5. Mobile: Capacitor shell, push, camera upload, App Store and Play Store submission.

Each phase ends deployed and testable.
