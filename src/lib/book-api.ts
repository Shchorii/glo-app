"use client";

/**
 * Database-backed screen picking for /book. Every call is bounded server-side:
 * the browser never holds more than ~500 map items or 120 list rows at a time.
 * SQL lives in supabase/migrations/0010_book_at_scale.sql.
 */
import { getSupabase } from "@/lib/supabase";
import type { Screen } from "@/lib/db";

export type Bbox = { minLat: number; minLng: number; maxLat: number; maxLng: number };

export type MapCluster = {
  n: number; lat: number; lng: number; min_price: number;
  min_lat: number; min_lng: number; max_lat: number; max_lng: number;
};

/** A lone screen renders as a dot; screens closer than ~48px on screen merge into a bubble. */
export type MapItem = { kind: "screen"; screen: Screen } | ({ kind: "cluster" } & MapCluster);

export type MapResult = { mode: "mixed"; total: number; live: boolean; truncated: boolean; items: MapItem[] };

export type AreaResult = { n: number; truncated: boolean; total_daily: number; ids: string[]; prices: number[] };

export type CityOption = {
  city: string; dma: string | null; state: string; n: number;
  min_lat: number; min_lng: number; max_lat: number; max_lng: number;
};
export type VenueOption = { venue_type: string; n: number };

export type PlaceHit = {
  kind: "neighborhood" | "city"; label: string; city: string; n: number;
  min_lat: number; min_lng: number; max_lat: number; max_lng: number;
};

export type Filters = { city: string | null; venue: string | null };

function sb() {
  const c = getSupabase();
  if (!c) throw new Error("Supabase is not configured in this build.");
  return c;
}

async function call<T>(fn: string, args: Record<string, unknown>, signal?: AbortSignal): Promise<T> {
  let q = sb().rpc(fn, args);
  if (signal) q = q.abortSignal(signal);
  const { data, error } = await q;
  if (error) throw error;
  return data as T;
}

const boxArgs = (b: Bbox) => ({ min_lat: b.minLat, min_lng: b.minLng, max_lat: b.maxLat, max_lng: b.maxLng });

export function fetchMap(b: Bbox, zoom: number, f: Filters, signal?: AbortSignal) {
  return call<MapResult>("book_map", { ...boxArgs(b), zoom: Math.round(zoom), p_city: f.city, p_venue: f.venue }, signal);
}

export function fetchList(b: Bbox, f: Filters, offset: number, limit: number, signal?: AbortSignal) {
  return call<{ total: number; rows: Screen[] }>(
    "book_list", { ...boxArgs(b), p_city: f.city, p_venue: f.venue, p_offset: offset, p_limit: limit }, signal,
  );
}

export function selectRadius(lat: number, lng: number, radiusM: number, f: Filters) {
  return call<AreaResult>("book_select_area", { p_lat: lat, p_lng: lng, p_radius_m: radiusM, p_city: f.city, p_venue: f.venue });
}

export function selectPolygon(points: [number, number][], f: Filters) {
  return call<AreaResult>("book_select_area", { p_polygon: points, p_city: f.city, p_venue: f.venue });
}

export function fetchFilters(city: string | null) {
  return call<{ cities: CityOption[]; venues: VenueOption[] }>("book_filters", { p_city: city });
}

export function searchPlace(q: string) {
  return call<PlaceHit | null>("book_place_search", { q });
}

export function screensByIds(ids: string[]) {
  return call<Screen[]>("book_screens_by_ids", { p_ids: ids.slice(0, 200) });
}

/** Rough bbox around a point, for loading lists before the map has reported a viewport. */
export function bboxAround(lat: number, lng: number, radiusM: number): Bbox {
  const dLat = radiusM / 111_000;
  const dLng = radiusM / (111_000 * Math.max(Math.cos((lat * Math.PI) / 180), 0.2));
  return { minLat: lat - dLat, minLng: lng - dLng, maxLat: lat + dLat, maxLng: lng + dLng };
}
