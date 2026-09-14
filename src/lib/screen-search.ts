import { ZIP_CENTROIDS } from "@/lib/zip-centroids";
import type { Screen } from "@/lib/db";

export type SearchHit = {
  /** What we matched: a ZIP centroid, or a named place in the inventory. */
  kind: "zip" | "city" | "neighborhood";
  label: string;
  /** Screens the query resolves to. */
  screens: Screen[];
  /** Where to point the map. */
  center: [number, number];
};

/** Rough km between two lat/lng points. Good enough for radius matching. */
function km(aLat: number, aLng: number, bLat: number, bLng: number) {
  const dLat = (aLat - bLat) * 111;
  const dLng = (aLng - bLng) * 111 * Math.cos((aLat * Math.PI) / 180);
  return Math.hypot(dLat, dLng);
}

/** ZIP areas vary hugely; 2.5km around the centroid is a fair urban approximation. */
const ZIP_RADIUS_KM = 2.5;

/**
 * Resolve a free-text query against the loaded inventory.
 * Accepts a 5-digit ZIP, a city name, or a neighborhood name.
 */
export function searchScreens(query: string, screens: Screen[]): SearchHit | null {
  const q = query.trim().toLowerCase();
  if (!q) return null;

  // ZIP: exact 5-digit match against the centroid table.
  if (/^\d{5}$/.test(q)) {
    const c = ZIP_CENTROIDS[q];
    if (!c) return null;
    const [lat, lng] = c;
    const near = screens.filter((s) => km(lat, lng, s.lat, s.lng) <= ZIP_RADIUS_KM);
    return { kind: "zip", label: q, screens: near, center: [lat, lng] };
  }

  // Neighborhood, then city. Prefix match first so "will" finds Williamsburg.
  const byHood = screens.filter((s) =>
    (s.neighborhood ?? "").toLowerCase().startsWith(q)
  );
  if (byHood.length) {
    return {
      kind: "neighborhood",
      label: byHood[0].neighborhood ?? q,
      screens: byHood,
      center: centroidOf(byHood),
    };
  }

  const byCity = screens.filter((s) => s.city.toLowerCase().startsWith(q));
  if (byCity.length) {
    return { kind: "city", label: byCity[0].city, screens: byCity, center: centroidOf(byCity) };
  }

  // Loose contains as a last resort.
  const loose = screens.filter(
    (s) =>
      s.city.toLowerCase().includes(q) ||
      (s.neighborhood ?? "").toLowerCase().includes(q) ||
      s.name.toLowerCase().includes(q)
  );
  if (loose.length) {
    return { kind: "neighborhood", label: query.trim(), screens: loose, center: centroidOf(loose) };
  }

  return null;
}

function centroidOf(list: Screen[]): [number, number] {
  const lat = list.reduce((a, s) => a + s.lat, 0) / list.length;
  const lng = list.reduce((a, s) => a + s.lng, 0) / list.length;
  return [lat, lng];
}
