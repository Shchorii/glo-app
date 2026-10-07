/**
 * IDA-24 proof for mergeNearby.
 *
 * Synthetic cases always run. Live book_map replay runs when
 * NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set
 * (read-only RPC, same call the map makes). No key is printed.
 *
 *   node --experimental-strip-types scripts/check-map-merge.mts
 */
import assert from "node:assert/strict";
import {
  clusterDiameter, itemRadius, mergeNearby, minSeparation, SCREEN_DOT_PX,
  type MapProjector, type MergeItem,
} from "../src/lib/map-merge.ts";

const R = 6378137;
const WORLD0 = 256;

function project(lat: number, lng: number, zoom: number) {
  const d = Math.PI / 180;
  const latC = Math.max(Math.min(85.0511287798, lat), -85.0511287798);
  const sin = Math.sin(latC * d);
  const projX = R * lng * d;
  const projY = (R * Math.log((1 + sin) / (1 - sin))) / 2;
  const scale0 = 0.5 / (Math.PI * R);
  const world = WORLD0 * 2 ** zoom;
  return { x: world * (scale0 * projX + 0.5), y: world * (-scale0 * projY + 0.5) };
}

function unproject(x: number, y: number, zoom: number) {
  const world = WORLD0 * 2 ** zoom;
  const scale0 = 0.5 / (Math.PI * R);
  const projX = (x / world - 0.5) / scale0;
  const projY = (y / world - 0.5) / -scale0;
  const lng = (projX / R) * (180 / Math.PI);
  const lat = (2 * Math.atan(Math.exp(projY / R)) - Math.PI / 2) * (180 / Math.PI);
  return { lat, lng };
}

function projector(zoom: number): MapProjector {
  return {
    latLngToContainerPoint([lat, lng]) {
      return project(lat, lng, zoom);
    },
  };
}

function cluster(n: number, lat: number, lng: number, price = 20): MergeItem {
  return {
    kind: "cluster", n, lat, lng, min_price: price,
    min_lat: lat - 0.01, min_lng: lng - 0.01, max_lat: lat + 0.02, max_lng: lng + 0.02,
  };
}

function screenAt(lat: number, lng: number, price = 15): MergeItem {
  return { kind: "screen", screen: { lat, lng, daily_price_usd: price } };
}

function atPixel(zoom: number, x: number, y: number) {
  return unproject(x, y, zoom);
}

type Gap = { close: number; overlap: number; minDist: number; minEdge: number; n: number };

function audit(zoom: number, items: MergeItem[]): Gap {
  const pts = items.map((it) => {
    const lat = it.kind === "screen" ? it.screen.lat : it.lat;
    const lng = it.kind === "screen" ? it.screen.lng : it.lng;
    return { ...project(lat, lng, zoom), r: itemRadius(it) };
  });
  let close = 0;
  let overlap = 0;
  let minDist = Infinity;
  let minEdge = Infinity;
  for (let i = 0; i < pts.length; i++) {
    for (let j = i + 1; j < pts.length; j++) {
      const d = Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y);
      minDist = Math.min(minDist, d);
      minEdge = Math.min(minEdge, d - pts[i].r - pts[j].r);
      if (d < 20) close++;
      if (d < pts[i].r + pts[j].r) overlap++;
    }
  }
  return { close, overlap, minDist, minEdge, n: items.length };
}

function assertSeparated(zoom: number, items: MergeItem[], label: string) {
  const g = audit(zoom, items);
  assert.equal(g.close, 0, `${label}: ${g.close} pairs closer than 20px (min ${g.minDist.toFixed(2)})`);
  assert.equal(g.overlap, 0, `${label}: ${g.overlap} overlapping pairs (min edge ${g.minEdge.toFixed(2)})`);
  if (g.n >= 2) {
    assert.ok(g.minDist + 1e-6 >= 20, `${label}: min centre ${g.minDist}`);
    assert.ok(g.minEdge + 1e-6 >= 0, `${label}: edge gap ${g.minEdge}`);
  }
  return g;
}

function pxPair(zoom: number, n1: number, n2: number, dist: number): MergeItem[] {
  const a = atPixel(zoom, 0, 0);
  const b = atPixel(zoom, dist, 0);
  return [cluster(n1, a.lat, a.lng, 30), cluster(n2, b.lat, b.lng, 11)];
}

// Round-trip a NYC coordinate through the same projection Leaflet uses.
{
  const p = project(40.7128, -74.006, 11);
  const back = unproject(p.x, p.y, 11);
  assert.ok(Math.abs(back.lat - 40.7128) < 1e-9, `lat roundtrip ${back.lat}`);
  assert.ok(Math.abs(back.lng - -74.006) < 1e-9, `lng roundtrip ${back.lng}`);
  const origin = project(0, 0, 0);
  assert.ok(Math.abs(origin.x - 128) < 1e-6 && Math.abs(origin.y - 128) < 1e-6, "zoom 0 origin");
}

// Size classes used by the bubble.
assert.equal(clusterDiameter(1), 32);
assert.equal(clusterDiameter(59), 38);
assert.equal(clusterDiameter(115), 44);
assert.equal(clusterDiameter(660), 50);
assert.equal(clusterDiameter(1400), 56);
assert.equal(itemRadius({ kind: "screen" }), SCREEN_DOT_PX / 2);

// QA's overlapping survivors of the old 36px rule. Each pair must collapse.
const mustMerge: Array<[string, number, number, number, number]> = [
  ["z10 137 & 660 @ 39px", 10, 137, 660, 39],
  ["z10 140 & 273 @ 39px", 10, 140, 273, 39],
  ["z11 116 & 60 @ 37px", 11, 116, 60, 37],
  ["z11 142 & 43 @ 40px", 11, 142, 43, 40],
];
for (const [label, zoom, n1, n2, dist] of mustMerge) {
  const items = pxPair(zoom, n1, n2, dist);
  const before = audit(zoom, items);
  assert.ok(before.overlap > 0, `${label} should overlap before merge`);
  const out = mergeNearby(projector(zoom), items);
  assert.equal(out.length, 1, `${label} should merge into one bubble`);
  assert.equal(out[0].kind, "cluster");
  if (out[0].kind === "cluster") assert.equal(out[0].min_price, 11);
  assertSeparated(zoom, out, label);
}

// Far enough for both radii and the 20px floor: leave them alone.
{
  const zoom = 11;
  const dots = [0, 24].map((x) => {
    const p = atPixel(zoom, x, 0);
    return screenAt(p.lat, p.lng);
  });
  const out = mergeNearby(projector(zoom), dots);
  assert.equal(out.length, 2, "screens 24px apart stay tappable");
  assertSeparated(zoom, out, "two dots");

  const bubbles = pxPair(zoom, 10, 10, 40);
  const kept = mergeNearby(projector(zoom), bubbles);
  assert.equal(kept.length, 2, "32px bubbles 40px apart stay (need 36)");
  assertSeparated(zoom, kept, "small bubbles");
}

// Centroid shift: merging the right-hand pair grows the bubble onto a group
// that was already emitted. A single pass that does not revisit would overlap.
{
  const zoom = 12;
  const specs = [
    { n: 24, x: 0 },
    { n: 24, x: 36 },
    { n: 24, x: 40 },
  ];
  const prices = [40, 12, 9];
  const items = specs.map(({ n, x }, i) => {
    const p = atPixel(zoom, x, 80);
    return cluster(n, p.lat, p.lng, prices[i]);
  });
  const before = audit(zoom, items);
  assert.ok(before.overlap > 0 || before.close > 0, "centroid fixture starts crowded");
  const out = mergeNearby(projector(zoom), items);
  assert.ok(out.length < items.length, "centroid fixture merges");
  const g = assertSeparated(zoom, out, "centroid shift");
  assert.ok(out.some((it) => it.kind === "cluster" && it.min_price === 9), "keeps the cheapest price");
  assert.ok(g.minEdge + 1e-6 >= 4, `centroid edge gap ${g.minEdge} should include the 4px gap`);
}

// Adversarial server grid: one bubble per ~48px cell, centroid shoved into
// the shared corner so neighbours start a few pixels apart.
function adversarialGrid(zoom: number, width: number, height: number) {
  const cell = 48;
  const items: MergeItem[] = [];
  const sizes = [1, 2, 10, 30, 59, 100, 115, 321, 500, 660, 1000, 1400];
  let i = 0;
  for (let y = 0; y < height; y += cell) {
    for (let x = 0; x < width; x += cell) {
      const p = atPixel(zoom, x + cell * 0.92, y + cell * 0.92);
      const n = sizes[i % sizes.length];
      items.push(n === 1 ? screenAt(p.lat, p.lng, 8) : cluster(n, p.lat, p.lng, 8));
      i++;
    }
  }
  return items;
}

for (const [zoom, w, h] of [[10, 1000, 440], [11, 1000, 440], [12, 375, 360], [3, 1000, 440], [4, 375, 360]] as const) {
  const raw = adversarialGrid(zoom, w, h);
  const t0 = performance.now();
  const out = mergeNearby(projector(zoom), raw);
  const ms = performance.now() - t0;
  const g = assertSeparated(zoom, out, `grid z${zoom} ${w}x${h}`);
  assert.ok(ms < 200, `grid z${zoom} took ${ms.toFixed(1)}ms`);
  console.log(
    `grid z${zoom} ${w}x${h}: ${raw.length} -> ${out.length} in ${ms.toFixed(1)}ms, min centre ${g.minDist.toFixed(1)}px, min edge ${g.minEdge.toFixed(1)}px`,
  );
}

// 500 random points, the map's item cap.
{
  let seed = 24;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
  const zoom = 11;
  const items: MergeItem[] = [];
  const sizes = [1, 8, 40, 120, 600, 2000];
  for (let i = 0; i < 500; i++) {
    const p = atPixel(zoom, rand() * 1000, rand() * 440);
    const n = sizes[i % sizes.length];
    items.push(n === 1 ? screenAt(p.lat, p.lng) : cluster(n, p.lat, p.lng));
  }
  const t0 = performance.now();
  const out = mergeNearby(projector(zoom), items);
  const ms = performance.now() - t0;
  const g = assertSeparated(zoom, out, "500 random");
  assert.ok(ms < 250, `500 random took ${ms.toFixed(1)}ms`);
  console.log(`random z11 n=500: -> ${out.length} in ${ms.toFixed(1)}ms, min centre ${g.minDist.toFixed(1)}px, min edge ${g.minEdge.toFixed(1)}px`);
}

// Two screens inside the 20px floor become one bubble and keep both prices' min.
{
  const zoom = 13;
  const a = atPixel(zoom, 0, 0);
  const b = atPixel(zoom, 12, 0);
  const out = mergeNearby(projector(zoom), [screenAt(a.lat, a.lng, 40), screenAt(b.lat, b.lng, 18)]);
  assert.equal(out.length, 1);
  assert.equal(out[0].kind, "cluster");
  if (out[0].kind === "cluster") {
    assert.equal(out[0].n, 2);
    assert.equal(out[0].min_price, 18);
    assert.ok(out[0].min_lat <= Math.min(a.lat, b.lat) + 1e-9);
    assert.ok(out[0].max_lng >= Math.max(a.lng, b.lng) - 1e-9);
  }
}

function viewportBbox(lat: number, lng: number, zoom: number, width: number, height: number) {
  const c = project(lat, lng, zoom);
  const sw = unproject(c.x - width / 2, c.y + height / 2, zoom);
  const ne = unproject(c.x + width / 2, c.y - height / 2, zoom);
  return { minLat: sw.lat, minLng: sw.lng, maxLat: ne.lat, maxLng: ne.lng };
}

function fitZoom(width: number, height: number) {
  for (let z = 18; z >= 0; z--) {
    const sw = project(24, -125, z);
    const ne = project(50, -66, z);
    if (Math.abs(ne.x - sw.x) <= width && Math.abs(ne.y - sw.y) <= height) return z;
  }
  return 0;
}

console.log(`CONUS fit zoom desktop 1000x440 = z${fitZoom(1000, 440)}; mobile 375x360 = z${fitZoom(375, 360)}`);

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !key) {
  console.log("live book_map replay skipped (set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY)");
  process.exit(0);
}

type Bbox = { minLat: number; minLng: number; maxLat: number; maxLng: number };

async function bookMap(bbox: Bbox, zoom: number): Promise<MergeItem[]> {
  const res = await fetch(`${url}/rest/v1/rpc/book_map`, {
    method: "POST",
    headers: {
      apikey: key!,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      min_lat: bbox.minLat, min_lng: bbox.minLng, max_lat: bbox.maxLat, max_lng: bbox.maxLng,
      zoom, p_city: null, p_venue: null,
    }),
  });
  if (!res.ok) throw new Error(`book_map z${zoom} HTTP ${res.status}`);
  const data = await res.json() as { total?: number; items?: MergeItem[] };
  return data.items ?? [];
}

function report(label: string, zoom: number, raw: MergeItem[], out: MergeItem[]) {
  const before = audit(zoom, raw);
  const after = assertSeparated(zoom, out, label);
  const dist = (g: Gap) => (g.n < 2 ? "n/a" : g.minDist.toFixed(1));
  const edge = (g: Gap) => (g.n < 2 ? "n/a" : g.minEdge.toFixed(1));
  console.log(
    `| ${label} | ${raw.length} | ${out.length} | ${before.close} | ${before.overlap} | ${after.close} | ${after.overlap} | ${dist(after)} | ${edge(after)} |`,
  );
}

const NYC = { lat: 40.7128, lng: -74.006 };

/** Viewport book_map sees when the map is centred on the CONUS box at `zoom`. */
function framedConusBbox(zoom: number, width: number, height: number): Bbox {
  const sw = project(24, -125, zoom);
  const ne = project(50, -66, zoom);
  const c = unproject((sw.x + ne.x) / 2, (sw.y + ne.y) / 2, zoom);
  return viewportBbox(c.lat, c.lng, zoom, width, height);
}

const sizes = [
  { name: "desktop", w: 1000, h: 440 },
  { name: "mobile", w: 375, h: 360 },
];

console.log("\n| view | raw | merged | before <20 | before overlap | after <20 | after overlap | min centre | min edge |");
console.log("|---|---:|---:|---:|---:|---:|---:|---:|---:|");

for (const size of sizes) {
  for (const zoom of [10, 11, 12]) {
    const bbox = viewportBbox(NYC.lat, NYC.lng, zoom, size.w, size.h);
    const raw = await bookMap(bbox, zoom);
    const out = mergeNearby(projector(zoom), raw);
    report(`NYC z${zoom} ${size.name} ${size.w}x${size.h}`, zoom, raw, out);
  }
  for (const zoom of [3, 4]) {
    const bbox = framedConusBbox(zoom, size.w, size.h);
    const raw = await bookMap(bbox, zoom);
    const out = mergeNearby(projector(zoom), raw);
    report(`national z${zoom} ${size.name} ${size.w}x${size.h}`, zoom, raw, out);
  }
}

{
  const bbox = viewportBbox(NYC.lat, NYC.lng, 17, 1000, 440);
  const raw = await bookMap(bbox, 17);
  const seen = new Map<string, number>();
  for (const it of raw) {
    if (it.kind !== "screen") continue;
    const k = `${it.screen.lat.toFixed(5)},${it.screen.lng.toFixed(5)}`;
    seen.set(k, (seen.get(k) ?? 0) + 1);
  }
  const stacked = [...seen.values()].filter((n) => n > 1);
  console.log(`z17 raw screens in NYC 1000x440: ${raw.length}, coordinates shared by 2+ screens: ${stacked.length}`);
}

const conus = { minLat: 24, minLng: -125, maxLat: 50, maxLng: -66 };
for (const zoom of [3, 4]) {
  const raw = await bookMap(conus, zoom);
  console.log(`CONUS bbox z${zoom}: ${raw.length} items (spec: ${zoom === 3 ? 18 : 30})`);
  assert.equal(raw.length, zoom === 3 ? 18 : 30, `CONUS z${zoom} item count drifted`);
}

// Every drawn pair also clears the size-aware threshold, not only the overlap line.
{
  const zoom = 11;
  const bbox = viewportBbox(NYC.lat, NYC.lng, zoom, 1000, 440);
  const out = mergeNearby(projector(zoom), await bookMap(bbox, zoom));
  const pts = out.map((it) => {
    const lat = it.kind === "screen" ? it.screen.lat : it.lat;
    const lng = it.kind === "screen" ? it.screen.lng : it.lng;
    return { ...project(lat, lng, zoom), r: itemRadius(it) };
  });
  for (let i = 0; i < pts.length; i++) {
    for (let j = i + 1; j < pts.length; j++) {
      const d = Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y);
      assert.ok(d + 1e-4 >= minSeparation(pts[i].r, pts[j].r), `threshold miss ${d} < ${minSeparation(pts[i].r, pts[j].r)}`);
    }
  }
}

console.log("\nall merge checks passed");
