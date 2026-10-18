---
name: testing-glo-error-paths
description: Test Glo App browser-visible chat and scan error handling with controlled local endpoints. Use when live Supabase or preview access is unavailable.
---

# Testing Glo Error Paths

## When to use

Use this procedure to verify browser-visible failure handling without sending data to production. It is especially useful when a Vercel preview is deployment-protected or Supabase credentials are unavailable.

## Devin Secrets Needed

No secrets are needed for the controlled chat and scan tests.

Real integration testing additionally needs the appropriately scoped values for:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `OPENAI_API_KEY`

## Setup

1. Install dependencies with `npm install`.
2. Run a temporary HTTP server outside the repository on `127.0.0.1:54321` that:
   - returns HTTP 200 `text/plain` from `/functions/v1/chat`;
   - returns HTTP 500 JSON from `/functions/v1/scan`;
   - increments a scan counter;
   - renders the counter at `/counts`;
   - answers CORS preflight requests.
3. Start the app:

   ```bash
   NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 \
   NEXT_PUBLIC_SUPABASE_ANON_KEY=test-anon-key \
   npm run dev
   ```

4. Maximize Chrome before recording.
5. Reset the stub process immediately before execution so the scan counter starts at zero.

## Browser assertions

### Invalid chat response

1. Open `http://localhost:3000`.
2. Open `Glo support`.
3. Click `How do I upload a Reel?`.
4. Verify the conversation displays exactly `Support chat returned an invalid response.` and no longer displays `Thinking…`.

### Failed scan retry

1. Open `http://localhost:3000/c/JP-FRIDAY10`.
2. Verify the coupon remains visible with `10% OFF`, `Show this code at the counter`, and a redemption code.
3. Open `http://127.0.0.1:54321/counts` and verify `Scan requests: 1`.
4. Revisit the coupon, then revisit `/counts`.
5. Verify `Scan requests: 2`. A count that stays at 1 may mean the failed request was incorrectly stored as complete.

## Evidence and cleanup

- Record one continuous browser flow and annotate setup, test starts, and assertions.
- Capture full-screen screenshots of the chat error, usable coupon, and scan counts 1 and 2.
- Report authenticated Supabase, storage, checkout, and Stripe webhook paths as untested unless the necessary credentials were actually available.
- `next dev` may rewrite the route-types import in `next-env.d.ts`. Inspect `git diff -- next-env.d.ts` after testing and manually restore the committed content if needed.
- Confirm `git status --short --branch` is clean before finishing.
