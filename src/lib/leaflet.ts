import type * as L from "leaflet";

/** The Leaflet module's default export (the `L` namespace value). */
export type Leaflet = typeof import("leaflet");

const CARTO_DARK_TILES = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
const CARTO_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';

/** Client-side dynamic import of Leaflet. Keeps it out of the server bundle. */
export async function loadLeaflet(): Promise<Leaflet> {
  return (await import("leaflet")).default;
}

/**
 * Create a Glo dark-themed map on `el`: sensible defaults (no scroll hijack,
 * page-scroll-friendly) plus the CARTO dark basemap. Pass `opts` to override
 * defaults (e.g. `dragging`).
 */
export function createDarkMap(leaflet: Leaflet, el: HTMLElement, opts?: L.MapOptions): L.Map {
  const map = leaflet.map(el, {
    zoomControl: true,
    scrollWheelZoom: false,
    dragging: true,
    attributionControl: true,
    ...opts,
  });
  leaflet
    .tileLayer(CARTO_DARK_TILES, {
      attribution: CARTO_ATTRIBUTION,
      subdomains: "abcd",
      maxZoom: 19,
    })
    .addTo(map);
  return map;
}

/** Fit the map to a set of [lat, lng] points. No-op when there are none. */
export function fitToPoints(
  leaflet: Leaflet,
  map: L.Map,
  points: [number, number][],
  opts?: L.FitBoundsOptions
): void {
  if (!points.length) return;
  map.fitBounds(leaflet.latLngBounds(points), opts);
}

/** Escape a string for safe interpolation into Leaflet tooltip/popup HTML. */
export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
