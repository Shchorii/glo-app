/**
 * Inventory invariants. Fast, no auth, no browser.
 * Run: node scripts/check-inventory.mjs
 * Exits non-zero on any violation so CI or an agent can gate on it.
 */
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!URL || !KEY) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY");
  process.exit(2);
}

const fails = [];
const check = (name, ok, detail) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? " — " + detail : ""}`);
  if (!ok) fails.push(name);
};

async function rpc(fn, body) {
  const t0 = Date.now();
  const r = await fetch(`${URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: KEY, Authorization: `Bearer ${KEY}` },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`${fn} ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return { data: await r.json(), ms: Date.now() - t0 };
}

// Williamsburg: a dense local block we expect to stay dense.
const WBURG = { lat: 40.7045, lng: -73.966 };

// First hit after idle is a Supabase cold start (~1.7s TTFB vs ~0.35s warm).
// Measure warm latency so the check reports steady-state, and report cold
// separately instead of pretending the threshold is looser than it is.
const cold = await rpc("screens_near", { p_lat: WBURG.lat, p_lng: WBURG.lng, p_radius_m: 5000, p_limit: 3000 });
const near = await rpc("screens_near", { p_lat: WBURG.lat, p_lng: WBURG.lng, p_radius_m: 5000, p_limit: 3000 });
const count = await rpc("screens_near_count", { p_lat: WBURG.lat, p_lng: WBURG.lng, p_radius_m: 5000 });
const rows = near.data;

check("screens_near responds", rows.length > 0, `${rows.length} rows`);
check("warm latency under 900ms", near.ms < 900, `${near.ms}ms warm, ${cold.ms}ms cold`);
check("cold start under 3s", cold.ms < 3000, `${cold.ms}ms — first visitor after idle waits this long`);
check("true count >= fetched rows", Number(count.data) >= rows.length, `${count.data} total`);

// Local density is the product. If this drops, the local pitch is dead.
const within500 = rows.filter(
  (s) => Math.hypot((s.lat - WBURG.lat) * 111, (s.lng - WBURG.lng) * 84) * 1000 <= 500
).length;
check("at least 10 screens within 500m", within500 >= 10, `${within500} found`);

// Pricing floor is a business rule enforced by a CHECK constraint.
const under = rows.filter((s) => Number(s.daily_price_usd) < 29);
check("no screen priced below $29/day", under.length === 0, `${under.length} violations`);

// Names are user-visible. No generator artefacts.
const hashed = rows.filter((s) => /\s+[0-9a-f]{4}$/.test(s.name));
check("no hash suffixes in names", hashed.length === 0, hashed[0]?.name ?? "");

// Demo stock must stay flagged, or the UI will claim it is live.
const unflagged = rows.filter((s) => s.source !== "demo" && s.source !== "live");
check("every screen has a valid source", unflagged.length === 0, `${unflagged.length} bad`);

// Clustering must actually aggregate at national zoom.
const clusters = await rpc("screens_in_bbox", {
  min_lat: 24, min_lng: -125, max_lat: 50, max_lng: -66, zoom: 4,
});
check("national zoom aggregates", clusters.data.length < 300, `${clusters.data.length} clusters`);
check("clusters carry counts", clusters.data.every((c) => c.screen_count > 0));

// A location with no inventory must return empty, not error.
// The "showing New York instead" fallback depends on this being clean.
const empty = await rpc("screens_near", { p_lat: 32.0853, p_lng: 34.7818, p_radius_m: 5000, p_limit: 100 });
check("uncovered location returns empty cleanly",
  Array.isArray(empty.data) && empty.data.length === 0,
  `${empty.data.length} rows near Tel Aviv`);

console.log(fails.length ? `\n${fails.length} FAILED: ${fails.join(", ")}` : "\nAll inventory invariants passed.");
process.exit(fails.length ? 1 : 0);
