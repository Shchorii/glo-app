# Glo App v1: Phase 1 Implementation Plan (Foundation)

Spec: docs/superpowers/specs/2026-07-14-glo-app-v1-design.md
Phase goal: glo-app runs as a static Next.js client backed by Supabase, with working email auth, the v1 schema with RLS in place, demo content behind a flag, and the old better-auth/Drizzle/SQLite stack removed. Deployed to Vercel and verified.

Prerequisite (Idan): a Supabase project. Create at supabase.com (org: Glo, region: eu-central or us-east), then provide SUPABASE_URL and SUPABASE_ANON_KEY (safe to share; RLS protects data) plus the access token or service_role key for running migrations. Google and Apple OAuth are configured in later tasks and can lag behind email auth.

## Task 1: Branch and dependency swap

1. Create branch `feature/v1-foundation` from main.
2. Remove better-auth, better-sqlite3, drizzle-orm, drizzle-kit from package.json; delete drizzle/ and drizzle.config.ts; remove auth code that imports them.
3. Add @supabase/supabase-js and @supabase/ssr.
4. Verify: `npm install && npm run typecheck` passes (expect and fix compile errors from removed imports by stubbing the auth surface, completed in Task 4).

## Task 2: Static export refactor

1. Set `output: "export"` in next.config.ts.
2. Audit src/ for server-only features (API routes, server actions, dynamic route handlers). Move any API routes into supabase/functions/ stubs or delete if demo-only.
3. Replace next/image with export-compatible config (`images.unoptimized: true`).
4. Verify: `npm run build` completes and produces out/ with all routes.

## Task 3: Supabase schema and RLS

1. Create supabase/migrations/0001_init.sql with tables per spec section 3: profiles, publishers, screens, creatives, campaigns, campaign_screens, orders, delivery_jobs, with enums for delivery_method, review_status, campaign_status, order_status.
2. RLS: enable on all tables. Customers select/insert/update own rows (profiles, creatives, campaigns, campaign_screens, orders read-only). Screens and publishers publicly readable. Admin role full access via profiles.role check. delivery_jobs admin-only.
3. Trigger: on auth.users insert, create profiles row.
4. Apply migration to the Supabase project and verify tables exist via the dashboard or `supabase db diff` returning clean.
5. Seed: supabase/seed.sql with 2 publishers (Atmosphere: vast, Manual Test Pub: manual) and 10 screens with real-looking lat/lng and prices.

## Task 4: Auth

1. Supabase client factory in src/lib/supabase.ts (browser client, anon key from env).
2. Auth screens: sign up, sign in, password reset, all email-based. Session handling via supabase.auth.onAuthStateChange, protected routes redirect unauthenticated users to sign in.
3. Google provider: configure in Supabase dashboard (needs Google Cloud OAuth client). Apple provider: configure later, before Capacitor submission (needs Apple dev account). Both behind the same signInWithOAuth call, buttons hidden until providers are enabled via env flags.
4. Verify: manual flow on local dev, sign up with a test email, confirm profiles row auto-created, sign out and back in.

## Task 5: Demo flag

1. Add NEXT_PUBLIC_DEMO_MODE env flag. Existing demo content (Johnny's Pizza campaign manager data, mock dashboards) renders only when the flag is on or under a /demo route so investor deck links keep working.
2. Default production build: flag off, authenticated app is the entry experience.
3. Verify: build with flag off shows the real app shell; /demo still renders the old demo.

## Task 6: Deploy and verify

1. Add SUPABASE env vars to the Vercel project (append ?teamId=team_lpuZ9Gn9aiui3LbCd5hTwRv8 on all Vercel API calls).
2. Merge feature/v1-foundation to main after review, let Vercel deploy.
3. Verification per standing rule: fetch the deployed HTML, extract the bundle hash, grep the lazy chunk for a Phase 1 marker string. Never trust HTTP 200 alone.
4. Smoke test on app.we-are-glo.com: sign up, sign in, sign out.

## Exit criteria

- Old auth/DB stack fully removed, npm run build clean.
- Schema + RLS live in Supabase with seed data.
- Email auth works end to end in production.
- Demo content preserved behind flag/route.
- Deployment verified via bundle hash grep.
