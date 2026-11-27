/**
 * Client-side fold for book-map markers.
 *
 * The server bins screens onto a ~48px grid and returns each bin at the
 * members' centroid, so neighbouring bins can sit on top of each other.
 * Bubble diameter also grows with the count (32–56px), which a fixed
 * centre-to-centre gap does not cover. Fold until every pair clears both
 * the drawn radii and the 20px centre minimum.
 */

export type MergeScreen = {
  lat: number;
  lng: number;
  daily_price_usd: number;
};

export type MergeCluster = {
  kind: "cluster";
  n: number;
  lat: number;
  lng: number;
  min_price: number;
  min_lat: number;
  min_lng: number;
  max_lat: number;
  max_lng: number;
};

export type MergeItem<T extends MergeScreen = MergeScreen> =
  | { kind: "screen"; screen: T }
  | MergeCluster;

export type MapProjector = {
  latLngToContainerPoint(latlng: [number, number]): { x: number; y: number };
};

/** IDA-15: no two drawn centres closer than this. */
export const MIN_CENTER_PX = 20;

/** Clear space between drawn edges so bubbles and dots do not touch. */
export const EDGE_GAP_PX = 4;

/**
 * Unselected screen dot diameter. Must match `.glo-book-marker .dot` in
 * BookMap. The 40px icon box is transparent; a pinned dot grows to 18px
 * inside that same box and is not re-merged.
 */
export const SCREEN_DOT_PX = 14;

/** Greedy passes before the pairwise backstop. Each pass is O(n²); n ≤ ~500. */
const MAX_PASSES = 24;

export function clusterDiameter(n: number): number {
  if (n >= 1000) return 56;
  if (n >= 500) return 50;
  if (n >= 100) return 44;
  if (n >= 25) return 38;
  return 32;
}

export function itemRadius(it: { kind: "screen" } | { kind: "cluster"; n: number }): number {
  return it.kind === "screen" ? SCREEN_DOT_PX / 2 : clusterDiameter(it.n) / 2;
}

/** Minimum centre distance at which i and j may both be drawn. */
export function minSeparation(radiusA: number, radiusB: number): number {
  return Math.max(MIN_CENTER_PX, radiusA + radiusB + EDGE_GAP_PX);
}

type Group<T extends MergeScreen> = {
  n: number;
  lat: number;
  lng: number;
  min_price: number;
  min_lat: number;
  min_lng: number;
  max_lat: number;
  max_lng: number;
  screen: T | null;
};

function radiusOf(g: Group<MergeScreen>): number {
  return g.n === 1 && g.screen ? SCREEN_DOT_PX / 2 : clusterDiameter(g.n) / 2;
}

function toGroup<T extends MergeScreen>(it: MergeItem<T>): Group<T> {
  if (it.kind === "screen") {
    const s = it.screen;
    return {
      n: 1, lat: s.lat, lng: s.lng, min_price: s.daily_price_usd,
      min_lat: s.lat, min_lng: s.lng, max_lat: s.lat, max_lng: s.lng,
      screen: s,
    };
  }
  return {
    n: it.n, lat: it.lat, lng: it.lng, min_price: it.min_price,
    min_lat: it.min_lat, min_lng: it.min_lng, max_lat: it.max_lat, max_lng: it.max_lng,
    screen: null,
  };
}

function toItem<T extends MergeScreen>(g: Group<T>): MergeItem<T> {
  if (g.n === 1 && g.screen) return { kind: "screen", screen: g.screen };
  return {
    kind: "cluster", n: g.n, lat: g.lat, lng: g.lng, min_price: g.min_price,
    min_lat: g.min_lat, min_lng: g.min_lng, max_lat: g.max_lat, max_lng: g.max_lng,
  };
}

function combine<T extends MergeScreen>(g: Group<T>, h: Group<T>): Group<T> {
  const n = g.n + h.n;
  return {
    n,
    lat: (g.lat * g.n + h.lat * h.n) / n,
    lng: (g.lng * g.n + h.lng * h.n) / n,
    min_price: Math.min(g.min_price, h.min_price),
    min_lat: Math.min(g.min_lat, h.min_lat),
    min_lng: Math.min(g.min_lng, h.min_lng),
    max_lat: Math.max(g.max_lat, h.max_lat),
    max_lng: Math.max(g.max_lng, h.max_lng),
    screen: n === 1 ? (g.screen ?? h.screen) : null,
  };
}

function pointOf<T extends MergeScreen>(map: MapProjector, g: Group<T>) {
  return map.latLngToContainerPoint([g.lat, g.lng]);
}

/**
 * Biggest-first greedy fold. Distance is rechecked against the merged
 * group's new centroid and new radius, because both change as it grows.
 * Returns the same array reference when nothing merged.
 */
function fold<T extends MergeScreen>(map: MapProjector, groups: Group<T>[]): Group<T>[] {
  const order = groups
    .map((_, i) => i)
    .sort((a, b) => groups[b].n - groups[a].n || a - b);
  const taken = new Array<boolean>(groups.length).fill(false);
  const next: Group<T>[] = [];
  let merged = false;

  for (const i of order) {
    if (taken[i]) continue;
    taken[i] = true;
    let g = groups[i];
    let spins = 0;
    let grew = true;
    while (grew && spins++ < groups.length) {
      grew = false;
      const anchor = pointOf(map, g);
      const r = radiusOf(g);
      for (const j of order) {
        if (taken[j]) continue;
        const p = pointOf(map, groups[j]);
        const d = Math.hypot(anchor.x - p.x, anchor.y - p.y);
        if (d >= minSeparation(r, radiusOf(groups[j]))) continue;
        taken[j] = true;
        merged = true;
        grew = true;
        g = combine(g, groups[j]);
        break;
      }
    }
    next.push(g);
  }

  return merged ? next : groups;
}

/**
 * Pairwise backstop. A fold pass can park a merged centroid on top of a
 * group it already emitted; later passes usually catch that, and this
 * finishes anything still overlapping. Each step removes one group.
 */
function resolveRemaining<T extends MergeScreen>(map: MapProjector, groups: Group<T>[]): Group<T>[] {
  let guard = groups.length;
  while (guard-- > 0) {
    const pts = groups.map((g) => pointOf(map, g));
    const radii = groups.map((g) => radiusOf(g));
    let bestI = -1;
    let bestJ = -1;
    let bestN = -1;
    let bestD = Infinity;
    for (let i = 0; i < groups.length; i++) {
      for (let j = i + 1; j < groups.length; j++) {
        const d = Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y);
        if (d >= minSeparation(radii[i], radii[j])) continue;
        const n = Math.max(groups[i].n, groups[j].n);
        if (n > bestN || (n === bestN && d < bestD)) {
          bestN = n;
          bestD = d;
          if (groups[i].n >= groups[j].n) { bestI = i; bestJ = j; }
          else { bestI = j; bestJ = i; }
        }
      }
    }
    if (bestI < 0) return groups;
    const merged = combine(groups[bestI], groups[bestJ]);
    const next = groups.filter((_, idx) => idx !== bestJ);
    next[bestJ < bestI ? bestI - 1 : bestI] = merged;
    groups = next;
  }
  return groups;
}

export function mergeNearby<T extends MergeScreen>(map: MapProjector, items: MergeItem<T>[]): MergeItem<T>[] {
  let groups = items.map(toGroup);
  const cap = Math.min(MAX_PASSES, Math.max(groups.length, 1));
  for (let pass = 0; pass < cap; pass++) {
    const next = fold(map, groups);
    if (next === groups) break;
    groups = next;
  }
  return resolveRemaining(map, groups).map(toItem);
}
