"use client";

import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import type { Screen } from "@/lib/db";
import { fromPrice } from "@/lib/dayparts";
import {
  fetchMap, selectPolygon, selectRadius,
  type AreaResult, type Bbox, type Filters, type MapItem, type MapResult,
} from "@/lib/book-api";

type DrawMode = null | "circle" | "poly";
type L = typeof import("leaflet");

export type MapFocus =
  | { key: number; center: [number, number]; zoom: number }
  | { key: number; bounds: Bbox };

export type Viewport = { bbox: Bbox; zoom: number; center: [number, number]; total: number; live: boolean };

type DrawState = {
  mode: DrawMode;
  center: [number, number] | null;
  points: [number, number][];
  temp: import("leaflet").Layer[];
  final: import("leaflet").Layer[];
};

const DEBOUNCE_MS = 300;

/**
 * Screen-picking map. The database decides what is drawn for each viewport
 * (clusters or individual screens), and Radius / Area selection runs
 * server-side, so the browser never holds the national inventory.
 */
export default function BookMap({
  filters,
  selected,
  onToggle,
  onSelectMany,
  onViewport,
  focus = null,
  initial,
}: {
  filters: Filters;
  /** id -> all-day price */
  selected: ReadonlyMap<string, number>;
  onToggle: (s: Screen) => void;
  onSelectMany: (r: AreaResult) => void;
  onViewport?: (v: Viewport) => void;
  focus?: MapFocus | null;
  initial: { center: [number, number]; zoom: number };
}) {
  const elRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const LRef = useRef<L | null>(null);
  const markersRef = useRef<Map<string, import("leaflet").Marker>>(new Map());
  const clustersRef = useRef<import("leaflet").Marker[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const roRef = useRef<ResizeObserver | null>(null);

  const filtersRef = useRef(filters);
  filtersRef.current = filters;
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  const onToggleRef = useRef(onToggle);
  onToggleRef.current = onToggle;
  const onSelectManyRef = useRef(onSelectMany);
  onSelectManyRef.current = onSelectMany;
  const onViewportRef = useRef(onViewport);
  onViewportRef.current = onViewport;

  const [result, setResult] = useState<MapResult | null>(null);
  const [loadingMap, setLoadingMap] = useState(true);
  const [mapErr, setMapErr] = useState<string | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [selectNote, setSelectNote] = useState<string | null>(null);

  /** Last screen the customer clicked: stays on screen so they can see exactly where it is. */
  const [pinned, setPinned] = useState<Screen | null>(null);
  const pinnedRef = useRef<string | null>(null);
  pinnedRef.current = pinned?.id ?? null;
  const [addr, setAddr] = useState<Record<string, string | null>>({});

  const draw = useRef<DrawState>({ mode: null, center: null, points: [], temp: [], final: [] });
  const [mode, setMode] = useState<DrawMode>(null);
  const [vertices, setVertices] = useState(0);
  const [hasShapes, setHasShapes] = useState(false);
  const [circleCenterSet, setCircleCenterSet] = useState(false);

  // ---------- data loading ----------
  function scheduleLoad(delay = DEBOUNCE_MS) {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(load, delay);
  }

  async function load() {
    const map = mapRef.current;
    const Lf = LRef.current;
    if (!map || !Lf) return;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    const b = map.getBounds();
    const bbox: Bbox = { minLat: b.getSouth(), minLng: b.getWest(), maxLat: b.getNorth(), maxLng: b.getEast() };
    const zoom = map.getZoom();
    setLoadingMap(true);
    try {
      const r = await fetchMap(bbox, zoom, filtersRef.current, ctrl.signal);
      if (ctrl.signal.aborted) return;
      setMapErr(null);
      setResult(r);
      paint(Lf, map, r);
      const c = map.getCenter();
      onViewportRef.current?.({ bbox, zoom, center: [c.lat, c.lng], total: r.total, live: r.live });
    } catch (e) {
      if (ctrl.signal.aborted || (e as { name?: string })?.name === "AbortError") return;
      setMapErr("Couldn't load screens for this area. Move the map to retry.");
    } finally {
      if (!ctrl.signal.aborted) setLoadingMap(false);
    }
  }

  function paint(Lf: L, map: import("leaflet").Map, r: MapResult) {
    clustersRef.current.forEach((c) => map.removeLayer(c));
    clustersRef.current = [];

    const screens: Screen[] = [];
    (map.getZoom() >= 17 ? r.items : mergeNearby(map, r.items)).forEach((it) => {
      if (it.kind === "screen") { screens.push(it.screen); return; }
      const c = it;
      const bubble = Lf.marker([c.lat, c.lng], { icon: clusterIcon(Lf, c.n), keyboard: false }).addTo(map);
      bubble.bindTooltip(
        `<div class="glo-tip"><div class="glo-tip-corner">${c.n.toLocaleString()} screens</div>
         <div class="glo-tip-meta">from $${fromPrice(c.min_price)}/day &middot; tap to zoom in</div></div>`,
        { direction: "top", offset: [0, -20], opacity: 1 },
      );
      bubble.on("click", () => {
        if (draw.current.mode) return;
        const spanTiny = Math.abs(c.max_lat - c.min_lat) < 1e-4 && Math.abs(c.max_lng - c.min_lng) < 1e-4;
        if (spanTiny) {
          map.setView([c.lat, c.lng], Math.min(map.getZoom() + 3, 18));
        } else {
          map.fitBounds([[c.min_lat, c.min_lng], [c.max_lat, c.max_lng]], {
            padding: [40, 40], maxZoom: Math.min(map.getZoom() + 4, 18),
          });
        }
      });
      clustersRef.current.push(bubble);
    });

    const keep = new Set(screens.map((s) => s.id));
    markersRef.current.forEach((m, id) => {
      if (!keep.has(id)) { map.removeLayer(m); markersRef.current.delete(id); }
    });
    screens.forEach((s) => {
      if (markersRef.current.has(s.id)) return;
      const isPinned = pinnedRef.current === s.id;
      const marker = Lf.marker([s.lat, s.lng], {
        icon: iconFor(Lf, selectedRef.current.has(s.id), isPinned),
        zIndexOffset: isPinned ? 1000 : 0,
      }).addTo(map);
      marker.bindTooltip(
        `<div class="glo-tip"><div class="glo-tip-corner">${esc(s.name)}</div>
         <div class="glo-tip-meta">${esc(s.city)} &middot; ${esc(s.venue_type)} &middot; from $${fromPrice(s.daily_price_usd)}/day &middot; tap to select</div></div>`,
        { direction: "top", offset: [0, -16], opacity: 1 },
      );
      marker.on("click", () => {
        if (draw.current.mode) return;
        onToggleRef.current(s);
        marker.closeTooltip();
        setPinned(s);
      });
      markersRef.current.set(s.id, marker);
    });
  }

  // ---------- drawing ----------
  function clearTemp(map: import("leaflet").Map) {
    draw.current.temp.forEach((l) => map.removeLayer(l));
    draw.current.temp = [];
  }

  function exitMode(map: import("leaflet").Map) {
    clearTemp(map);
    draw.current.mode = null;
    draw.current.center = null;
    draw.current.points = [];
    setMode(null);
    setVertices(0);
    setCircleCenterSet(false);
    map.doubleClickZoom.enable();
    if (elRef.current) elRef.current.style.cursor = "";
  }

  function enterMode(next: Exclude<DrawMode, null>) {
    const map = mapRef.current;
    if (!map) return;
    if (draw.current.mode === next) { exitMode(map); return; }
    exitMode(map);
    draw.current.mode = next;
    setMode(next);
    setSelectNote(null);
    map.doubleClickZoom.disable();
    if (elRef.current) elRef.current.style.cursor = "crosshair";
  }

  async function runSelection(req: () => Promise<AreaResult>) {
    setSelecting(true);
    setSelectNote(null);
    try {
      const r = await req();
      onSelectManyRef.current(r);
      if (r.n === 0) setSelectNote("No screens inside that shape.");
      else if (r.truncated) setSelectNote(`That zone holds ${r.n.toLocaleString()} screens. Added the ${r.ids.length.toLocaleString()} cheapest; draw a smaller zone for the rest.`);
      else setSelectNote(`Added ${r.n.toLocaleString()} screen${r.n === 1 ? "" : "s"} from that zone.`);
    } catch {
      setSelectNote("Selection failed. Try drawing the zone again.");
    } finally {
      setSelecting(false);
    }
  }

  async function finishPolygon() {
    const map = mapRef.current;
    const Lf = LRef.current;
    if (!map || !Lf || draw.current.points.length < 3) return;
    const pts = [...draw.current.points];
    clearTemp(map);
    const poly = Lf.polygon(pts, { color: "#22d3ee", weight: 2, fillColor: "#22d3ee", fillOpacity: 0.08 }).addTo(map);
    draw.current.final.push(poly);
    setHasShapes(true);
    exitMode(map);
    await runSelection(() => selectPolygon(pts, filtersRef.current));
  }

  function clearShapes() {
    const map = mapRef.current;
    if (!map) return;
    draw.current.final.forEach((l) => map.removeLayer(l));
    draw.current.final = [];
    setHasShapes(false);
    setSelectNote(null);
    exitMode(map);
  }

  // ---------- init once ----------
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const Lf = (await import("leaflet")).default;
      if (cancelled || !elRef.current || mapRef.current) return;
      LRef.current = Lf;

      const map = Lf.map(elRef.current, {
        zoomControl: true, scrollWheelZoom: false, dragging: true, attributionControl: true,
        worldCopyJump: true, minZoom: 3,
      });
      mapRef.current = map;

      Lf.tileLayer(
        `https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png?key=${process.env.NEXT_PUBLIC_CARTO_API_KEY}`,
        {
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
          subdomains: "abcd",
          maxZoom: 19,
        },
      ).addTo(map);

      map.setView(initial.center, initial.zoom);
      map.on("moveend", () => scheduleLoad());
      load();

      map.on("click", (e: import("leaflet").LeafletMouseEvent) => {
        const d = draw.current;
        if (d.mode === "circle") {
          if (!d.center) {
            d.center = [e.latlng.lat, e.latlng.lng];
            setCircleCenterSet(true);
            const dot = Lf.circleMarker(e.latlng, {
              radius: 5, color: "#22d3ee", fillColor: "#22d3ee", fillOpacity: 1, weight: 1,
            }).addTo(map);
            d.temp.push(dot);
          } else {
            const center = Lf.latLng(d.center[0], d.center[1]);
            const radius = center.distanceTo(e.latlng);
            clearTemp(map);
            const circle = Lf.circle(center, {
              radius, color: "#22d3ee", weight: 2, fillColor: "#22d3ee", fillOpacity: 0.08,
            }).addTo(map);
            d.final.push(circle);
            setHasShapes(true);
            exitMode(map);
            runSelection(() => selectRadius(center.lat, center.lng, radius, filtersRef.current));
          }
        } else if (d.mode === "poly") {
          d.points.push([e.latlng.lat, e.latlng.lng]);
          setVertices(d.points.length);
          const dot = Lf.circleMarker(e.latlng, {
            radius: 4, color: "#22d3ee", fillColor: "#22d3ee", fillOpacity: 1, weight: 1,
          }).addTo(map);
          d.temp.push(dot);
          if (d.points.length >= 2) {
            const line = Lf.polyline(d.points, { color: "#22d3ee", weight: 2, dashArray: "6 6" }).addTo(map);
            d.temp.push(line);
          }
        }
      });

      map.on("mousemove", (e: import("leaflet").LeafletMouseEvent) => {
        const d = draw.current;
        if (d.mode === "circle" && d.center) {
          const keep = d.temp[0];
          d.temp.slice(1).forEach((l) => map.removeLayer(l));
          d.temp = keep ? [keep] : [];
          const center = Lf.latLng(d.center[0], d.center[1]);
          const preview = Lf.circle(center, {
            radius: center.distanceTo(e.latlng),
            color: "#22d3ee", weight: 2, dashArray: "6 6", fillColor: "#22d3ee", fillOpacity: 0.05,
          }).addTo(map);
          d.temp.push(preview);
        }
      });

      map.on("dblclick", () => {
        if (draw.current.mode === "poly") finishPolygon();
      });

      if (typeof ResizeObserver !== "undefined" && elRef.current) {
        const ro = new ResizeObserver(() => map.invalidateSize());
        ro.observe(elRef.current);
        roRef.current = ro;
      }
    })();
    return () => {
      cancelled = true;
      if (timerRef.current) clearTimeout(timerRef.current);
      abortRef.current?.abort();
      roRef.current?.disconnect();
      roRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
      markersRef.current.clear();
      clustersRef.current = [];
      draw.current = { mode: null, center: null, points: [], temp: [], final: [] };
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Filters changed: redraw the viewport with them.
  const firstFilters = useRef(true);
  useEffect(() => {
    if (firstFilters.current) { firstFilters.current = false; return; }
    const map = mapRef.current;
    if (!map) return;
    markersRef.current.forEach((m) => map.removeLayer(m));
    markersRef.current.clear();
    scheduleLoad(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.city, filters.venue]);

  // Fly to a search hit or a chosen city.
  useEffect(() => {
    const map = mapRef.current;
    if (!focus || !map) return;
    if ("bounds" in focus) {
      const b = focus.bounds;
      map.fitBounds([[b.minLat, b.minLng], [b.maxLat, b.maxLng]], { padding: [30, 30], maxZoom: 15 });
    } else {
      map.setView(focus.center, focus.zoom);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus?.key]);

  // Reflect selection and the pinned screen on markers.
  useEffect(() => {
    const Lf = LRef.current;
    if (!Lf) return;
    markersRef.current.forEach((marker, id) => {
      const isPinned = pinned?.id === id;
      marker.setIcon(iconFor(Lf, selected.has(id), isPinned));
      marker.setZIndexOffset(isPinned ? 1000 : 0);
    });
  }, [selected, pinned]);

  // Resolve the street address for the pinned screen (cached per screen).
  useEffect(() => {
    if (!pinned || pinned.id in addr) return;
    const ctrl = new AbortController();
    reverseGeocode(pinned.lat, pinned.lng, ctrl.signal)
      .then((a) => setAddr((m) => ({ ...m, [pinned.id]: a })))
      .catch((e) => { if (e?.name !== "AbortError") setAddr((m) => ({ ...m, [pinned.id]: null })); });
    return () => ctrl.abort();
  }, [pinned, addr]);

  const total = result?.total ?? 0;
  const filtered = Boolean(filters.city || filters.venue);
  const empty = !loadingMap && !mapErr && result !== null && total === 0;

  return (
    <div className="relative">
      <div
        ref={elRef}
        className="h-[360px] sm:h-[440px] w-full rounded-lg overflow-hidden border border-line-800 bg-bg-900"
        aria-label="Map of screens available to book"
      />

      {(loadingMap || selecting) && (
        <div className="absolute top-2 left-12 z-[1000] text-[11px] px-2 py-1 rounded bg-bg-950/90 border border-line-800 text-ink-300" role="status">
          {selecting ? "Selecting screens…" : "Loading screens…"}
        </div>
      )}

      {empty && (
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 z-[999] flex justify-center pointer-events-none px-4">
          <div className="max-w-sm text-center rounded-lg border border-line-800 bg-bg-950/90 px-4 py-3" data-testid="map-empty">
            <p className="text-[13px] text-ink-100 font-medium">No Glo screens in this area{filtered ? " with these filters" : ""} yet</p>
            <p className="text-[12px] text-ink-400 mt-1">
              {filtered ? "Clear a filter, zoom out, or search a ZIP or city." : "Zoom out, or search a ZIP, neighborhood or city."}
            </p>
          </div>
        </div>
      )}

      {pinned && (
        <PinnedCard
          screen={pinned}
          address={addr[pinned.id]}
          isSelected={selected.has(pinned.id)}
          onToggle={() => onToggle(pinned)}
          onClose={() => setPinned(null)}
        />
      )}

      <div className="absolute top-2 right-2 z-[1000] flex flex-col gap-1.5 items-end">
        <div className="flex gap-1.5">
          <ToolBtn active={mode === "circle"} onClick={() => enterMode("circle")} label="Radius" />
          <ToolBtn active={mode === "poly"} onClick={() => enterMode("poly")} label="Area" />
          {hasShapes && <ToolBtn active={false} onClick={clearShapes} label="Clear" />}
        </div>
        {mode === "circle" && (
          <span className="text-[11px] px-2 py-1 rounded bg-bg-950/90 border border-line-800 text-ink-300">
            {circleCenterSet ? "Click to set the radius" : "Click the center of your zone"}
          </span>
        )}
        {mode === "poly" && (
          <span className="text-[11px] px-2 py-1 rounded bg-bg-950/90 border border-line-800 text-ink-300 flex items-center gap-2">
            Click to add corners
            {vertices >= 3 && (
              <button
                type="button"
                onClick={finishPolygon}
                className="px-1.5 py-0.5 rounded bg-cy-400/20 text-cy-300 border border-cy-400/40 font-medium"
              >
                Done
              </button>
            )}
          </span>
        )}
      </div>

      <p className="text-[11px] text-ink-500 mt-1.5" data-testid="map-caption">
        {mapErr
          ? <span className="text-amber-400/90">{mapErr}</span>
          : result === null
            ? "Loading screens…"
            : total === 0
              ? "No screens in view."
              : result.truncated
              ? `Showing the ${result.items.length.toLocaleString()} cheapest of ${total.toLocaleString()} screens in view · zoom in for the rest.`
              : `${total.toLocaleString()} screen${total === 1 ? "" : "s"} in view · tap a dot to select, a bubble to zoom in, or use Radius / Area for a whole zone.`}
        {selected.size > 0 && <span className="text-cy-300"> · {selected.size.toLocaleString()} selected</span>}
      </p>
      {selectNote && <p className="text-[11px] text-cy-300 mt-1" role="status">{selectNote}</p>}

      <style jsx global>{`
        .glo-book-marker { background: transparent; border: none; }
        .glo-cluster { background: transparent; border: none; }
        .glo-cluster .bubble {
          display: flex; align-items: center; justify-content: center;
          border-radius: 9999px; cursor: pointer;
          background: rgba(163, 230, 53, 0.18);
          border: 1.5px solid rgba(163, 230, 53, 0.75);
          color: #d9f99d; font-size: 12px; font-weight: 600;
          box-shadow: 0 0 14px rgba(163, 230, 53, 0.35);
        }
        .glo-cluster .bubble:hover {
          background: rgba(163, 230, 53, 0.3);
          box-shadow: 0 0 20px rgba(163, 230, 53, 0.55);
        }
        .glo-book-marker .dot {
          position: absolute; inset: 0; margin: auto;
          width: 14px; height: 14px; border-radius: 9999px;
          border: 2px solid rgba(9, 12, 16, 0.9);
        }
        .glo-book-marker.sel .dot {
          background: #22d3ee;
          box-shadow: 0 0 10px rgba(34, 211, 238, 1), 0 0 26px rgba(34, 211, 238, 0.6);
        }
        .glo-book-marker.unsel .dot {
          background: #a3e635;
          box-shadow: 0 0 8px rgba(163, 230, 53, 0.8);
        }
        .glo-book-marker.pin .dot { width: 18px; height: 18px; border: 3px solid #f4f6f8; }
        .glo-book-marker.pin .ring { width: 38px; height: 38px; border: 2px solid #f4f6f8; }
        .glo-book-marker .ring {
          position: absolute; inset: 0; margin: auto;
          width: 30px; height: 30px; border-radius: 9999px;
          border: 1.5px solid rgba(34, 211, 238, 0.8);
        }
        .leaflet-tooltip.leaflet-tooltip-top {
          background: #0d1117; border: 1px solid rgba(163, 230, 53, 0.35);
          border-radius: 8px; box-shadow: 0 6px 24px rgba(0, 0, 0, 0.5); padding: 8px 10px;
        }
        .leaflet-tooltip-top:before { border-top-color: rgba(163, 230, 53, 0.35); }
        .glo-tip-corner { color: #f4f6f8; font-weight: 600; font-size: 13px; }
        .glo-tip-meta { color: #94a3b8; font-size: 11px; margin-top: 2px; }
        .leaflet-container { background: #0a0e13; font: inherit; }
        .leaflet-control-zoom a {
          background: #0d1117 !important; color: #cbd5e1 !important;
          border-color: rgba(148, 163, 184, 0.2) !important;
        }
        .leaflet-control-attribution {
          background: rgba(10, 14, 19, 0.75) !important; color: #64748b !important; font-size: 9px !important;
        }
        .leaflet-control-attribution a { color: #94a3b8 !important; }
      `}</style>
    </div>
  );
}

function ToolBtn({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-2.5 py-1.5 rounded-md text-[12px] font-medium border transition-colors ${
        active
          ? "bg-cy-400/20 text-cy-300 border-cy-400/50"
          : "bg-bg-950/90 text-ink-300 border-line-800 hover:text-ink-50 hover:border-line-600"
      }`}
    >
      {label}
    </button>
  );
}

/** Minimum on-screen distance between two drawn items. */
const MIN_GAP_PX = 36;

/**
 * The server groups screens on a ~48px grid, but two screens either side of a
 * cell edge can still land on top of each other. Greedily fold anything closer
 * than MIN_GAP_PX into the bigger neighbour (no chaining), repeating until stable.
 */
function mergeNearby(map: import("leaflet").Map, items: MapItem[]): MapItem[] {
  type G = { n: number; lat: number; lng: number; min_price: number; min_lat: number; min_lng: number; max_lat: number; max_lng: number; screen: Screen | null };
  let groups: G[] = items.map((it) =>
    it.kind === "screen"
      ? { n: 1, lat: it.screen.lat, lng: it.screen.lng, min_price: it.screen.daily_price_usd,
          min_lat: it.screen.lat, min_lng: it.screen.lng, max_lat: it.screen.lat, max_lng: it.screen.lng, screen: it.screen }
      : { n: it.n, lat: it.lat, lng: it.lng, min_price: it.min_price,
          min_lat: it.min_lat, min_lng: it.min_lng, max_lat: it.max_lat, max_lng: it.max_lng, screen: null },
  );
  for (let pass = 0; pass < 4; pass++) {
    const pts = groups.map((g) => map.latLngToContainerPoint([g.lat, g.lng]));
    const order = groups.map((_, i) => i).sort((a, b) => groups[b].n - groups[a].n);
    const taken = new Array(groups.length).fill(false);
    const next: G[] = [];
    let merged = false;
    for (const i of order) {
      if (taken[i]) continue;
      taken[i] = true;
      const g = { ...groups[i] };
      let sumLat = g.lat * g.n, sumLng = g.lng * g.n;
      for (const j of order) {
        if (taken[j]) continue;
        if (Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y) >= MIN_GAP_PX) continue;
        taken[j] = true;
        merged = true;
        const h = groups[j];
        g.n += h.n;
        sumLat += h.lat * h.n; sumLng += h.lng * h.n;
        g.min_price = Math.min(g.min_price, h.min_price);
        g.min_lat = Math.min(g.min_lat, h.min_lat); g.min_lng = Math.min(g.min_lng, h.min_lng);
        g.max_lat = Math.max(g.max_lat, h.max_lat); g.max_lng = Math.max(g.max_lng, h.max_lng);
        g.screen = null;
      }
      g.lat = sumLat / g.n; g.lng = sumLng / g.n;
      next.push(g);
    }
    groups = next;
    if (!merged) break;
  }
  return groups.map((g) =>
    g.n === 1 && g.screen
      ? { kind: "screen" as const, screen: g.screen }
      : { kind: "cluster" as const, n: g.n, lat: g.lat, lng: g.lng, min_price: g.min_price,
          min_lat: g.min_lat, min_lng: g.min_lng, max_lat: g.max_lat, max_lng: g.max_lng },
  );
}

/** Aggregated bubble: size scales with count, number rendered inside. */
function clusterIcon(Lf: L, n: number) {
  const size = n >= 1000 ? 56 : n >= 500 ? 50 : n >= 100 ? 44 : n >= 25 ? 38 : 32;
  const label = n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
  return Lf.divIcon({
    className: "glo-cluster",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    html: `<span class="bubble" style="width:${size}px;height:${size}px">${label}</span>`,
  });
}

function iconFor(Lf: L, isSelected: boolean, isPinned = false) {
  return Lf.divIcon({
    className: `glo-book-marker ${isSelected ? "sel" : "unsel"}${isPinned ? " pin" : ""}`,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    html: `${isSelected || isPinned ? '<span class="ring"></span>' : ""}<span class="dot"></span>`,
  });
}

/** Details for the clicked screen, docked in the map corner so it never hides neighbouring dots. */
function PinnedCard({
  screen: s, address, isSelected, onToggle, onClose,
}: {
  screen: Screen;
  /** undefined = still loading, null = lookup failed */
  address: string | null | undefined;
  isSelected: boolean;
  onToggle: () => void;
  onClose: () => void;
}) {
  const coords = `${s.lat.toFixed(5)}, ${s.lng.toFixed(5)}`;
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${s.lat},${s.lng}`;
  return (
    <div
      role="dialog"
      aria-label={`Screen details: ${s.name}`}
      data-testid="pinned-card"
      className="absolute left-2 bottom-8 z-[1000] w-[min(320px,calc(100%-1rem))] rounded-lg border border-lime-400/40 bg-bg-950/95 p-3 shadow-[0_6px_24px_rgba(0,0,0,0.5)] backdrop-blur"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-ink-50 truncate">{s.name}</p>
          <p className="text-[11px] text-ink-400 capitalize">{s.venue_type} · {s.city}</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Close screen details" className="text-ink-500 hover:text-ink-50 text-[16px] leading-none px-1">×</button>
      </div>
      <p className="mt-2 text-[12px] text-ink-200" data-testid="pinned-address">
        {address === undefined ? "Finding address…" : address ?? coords}
      </p>
      <p className="text-[11px] text-ink-500">
        {address ? `${coords} · ` : ""}
        <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="text-cy-300 hover:underline">Open in Google Maps</a>
      </p>
      <div className="mt-2.5 flex items-center justify-between gap-2">
        <span className="text-[12px] text-ink-300">from ${fromPrice(s.daily_price_usd)}/day</span>
        <button
          type="button"
          onClick={onToggle}
          className={`px-2.5 py-1 rounded-md text-[12px] font-medium border ${
            isSelected
              ? "bg-cy-400/20 text-cy-300 border-cy-400/50"
              : "bg-lime-400/15 text-lime-300 border-lime-400/50"
          }`}
        >
          {isSelected ? "Selected · remove" : "Select screen"}
        </button>
      </div>
    </div>
  );
}

/** OSM Nominatim reverse lookup: "123 Main St, Neighborhood, City 90026". */
async function reverseGeocode(lat: number, lng: number, signal: AbortSignal): Promise<string | null> {
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=18&addressdetails=1&lat=${lat}&lon=${lng}`;
  const res = await fetch(url, { signal, headers: { Accept: "application/json" } });
  if (!res.ok) return null;
  const j = await res.json();
  const a = j?.address ?? {};
  const street = [a.house_number, a.road].filter(Boolean).join(" ");
  const place = a.neighbourhood || a.suburb || a.quarter;
  const town = a.city || a.town || a.village || a.hamlet;
  const tail = [town, a.state_code || a.state].filter(Boolean).join(", ");
  const parts = [street || (a.road ? `Near ${a.road}` : null), place, [tail, a.postcode].filter(Boolean).join(" ")].filter(Boolean);
  return parts.length ? parts.join(", ") : j?.display_name ?? null;
}

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
