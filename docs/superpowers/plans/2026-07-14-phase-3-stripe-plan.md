# Phase 3: Money — Stripe Checkout (2026-07-14)

Spec: docs/superpowers/specs/2026-07-14-glo-app-v1-design.md (sections 4.4, 11-phase-3)
Scope: Stripe Checkout, webhook, order lifecycle, receipts (Stripe-native email receipts).

## Architecture
Static export means no Next API routes; all server work lives in Supabase Edge Functions.
- `checkout` (verify_jwt ON): input { campaign_id }. Validates the caller owns the campaign and it is draft/pending_payment, RECOMPUTES the total server-side from screens x days (never trusts the client number, updates the row if drifted), creates a Stripe Checkout Session (usd, single line item named after the campaign), inserts a `payments` row (status created), returns the session url.
- `stripe-webhook` (verify_jwt OFF): verifies the Stripe signature on the raw body. On `checkout.session.completed`: payment → succeeded, campaign → pending_review + paid_at. On `checkout.session.expired`: payment → expired.
- Key resolution mirrors chat fn: env `STRIPE_SECRET_KEY` first, Vault fallback; `STRIPE_WEBHOOK_SECRET` same. Webhook endpoint is created programmatically via Stripe API once the secret key exists, so the signing secret never needs manual copying.

## DB migration `glo_v2_payments`
- `payments` (id uuid pk, campaign_id fk, user_id fk, stripe_session_id text unique, stripe_payment_intent text, amount_usd numeric, currency text default 'usd', status enum created|succeeded|expired|refunded, created_at, updated_at).
- RLS: owner SELECT only; writes via service role (edge functions).
- `campaigns.paid_at timestamptz` nullable.

## Frontend
- lib/endpoints.ts: add CHECKOUT_ENDPOINT.
- lib/db.ts: `startCheckout(campaignId)` → POST with the user's access token → returns url → window.location.
- /campaigns/view: status pending_payment shows a "Complete payment" button in the reserved banner; `?paid=1` return shows "Payment received — moving to review" while the webhook flips status.
- /book success card: keep copy but link straight to the campaign where payment is available.

## Verification gates
- Migration applied; RLS: anon cannot read payments.
- Functions deployed ACTIVE; checkout returns 401 without auth; with auth but no Stripe key returns clear "Stripe key not configured" error (503) — flips to working the moment the key lands.
- Build green; deploy verified via bundle grep ("Complete payment").
- End-to-end test with Stripe test key + card 4242 4242 4242 4242 once key is provided (the one external dependency).
