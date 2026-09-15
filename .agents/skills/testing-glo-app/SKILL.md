---
name: testing-glo-app
description: Test the Glo Campaign Manager (Next.js) UI end-to-end in local demo mode. Use when verifying frontend/UI changes (maps, auth forms, dashboard, campaign pages) without a real Supabase backend.
---

# Testing Glo Campaign Manager

Next.js 16 App Router app (React 19, Tailwind, Leaflet, Supabase). Most pages run on dummy/seed data and render **without** Supabase configured ("demo mode").

## Run locally
```bash
npm install        # (unsupported-engine warning on eslint-visitor-keys is harmless)
npm run dev        # http://localhost:3000
npm run typecheck  # passes
npm run build      # passes
```
`npm run lint` is BROKEN independent of any change: Next 16 removed `next lint` and there's no `eslint.config.js`. Verify with typecheck + build instead.

## Demo-mode behavior (no `NEXT_PUBLIC_SUPABASE_URL`/`_ANON_KEY`)
`isSupabaseConfigured` (`src/lib/supabase.ts`) is false, so:
- `/campaigns` (signed-out) shows `DemoCampaignShowcase` → **`CampaignMap`** renders on real dummy data. Best no-config way to test the shared Leaflet util (`src/lib/leaflet.ts` + `LeafletBaseStyles`).
- `/dashboard`, `/campaigns/<id>/preview`, `/sign-in`, `/sign-up`, `/settings`, `/studio/*` all render on seed data.
- `/book` shows **"Booking is not configured in this build"** and never renders `BookMap` (it gates on `isSupabaseConfigured` and needs `listScreens()` from Supabase).
- Signed-in-only surfaces (e.g. the campaigns list badges using `CAMPAIGN_STATUS_META`) are unreachable without auth — cover via typecheck/build, note as untested-by-UI.

### Exercising BookMap without Supabase (temporary test-only edit, revert after)
In `src/app/book/page.tsx`: (1) in the "Load screens" effect, when `!isSupabaseConfigured`, `setScreens([...])` with dummy `Screen` objects (need `lat`/`lng`/`name`/`venue_type`/`city`/`daily_price_usd`/`is_available`); (2) neutralize the `if (!isSupabaseConfigured) return <Shell>Booking is not configured…` gate (e.g. `if (false && …)`). `BookMap.tsx` stays untouched so the render still validates the refactor. `git checkout src/app/book/page.tsx` when done.

## Both Leaflet maps share `src/lib/leaflet.ts`
`CampaignMap` and `BookMap` both use `loadLeaflet`/`createDarkMap`/`fitToPoints`/`escapeHtml`. Verifying either one exercises the shared util. Check: dark CARTO tiles load (`basemaps.cartocdn.com/dark_all`), glowing markers plotted, hover shows a styled dark tooltip, zoom + "Leaflet | © OpenStreetMap © CARTO" attribution present. The stripped DOM from the computer tool shows tile `img src` and tooltip text — good for asserting without pixel-peeping.

## Devin Secrets Needed
None for demo-mode UI testing. Full booking/auth flows would need `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` (plus a seeded `screens` table) — not required for frontend render verification.
