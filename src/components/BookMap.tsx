"use client";

import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import type { Screen } from "@/lib/db";
import { fromPrice } from "@/lib/dayparts";

type DrawMode = null | "circle" | "poly";

type DrawState = {
  mode: DrawMode;
  center: [number, number] | null;      // circle center
  points: [number, number][];           // polygon vertices
  temp: import("leaflet").Layer[];      // preview layers
  final: import("leaflet").Layer[];     // committed shapes
};

/**
 * Screen-picking map: tap markers to toggle, or draw a radius / area
 * to select every screen inside it. Leaflet loads client-side only.
 */
export default function BookMap({
  screens,
  selected,
  onToggle,
}: {
  screens: Screen[];
  selected: Set<string>;
  onToggle: (id: string) => void;
}) {
  const elRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const markersRef = useRef<Map<string, import("leaflet").Marker>>(new Map());
  const onToggleRef = useRef(onToggle);
  onToggleRef.current = onToggle;
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  const screensRef = useRef(screens);
  screensRef.current = screens;

  /** Union-select: functional setState in the parent composes, so batched toggles are safe. */
  function addToSelection(ids: string[]) {
    ids.filter((id) => !selectedRef.current.has(id)).forEach((id) => onToggleRef.current(id));
  }

  const draw = useRef<DrawState>({ mode: null, center: null, points: [], temp: [], final: [] });
  const [mode, setMode] = useState<DrawMode>(null);
  const [vertices, setVertices] = useState(0);
  const [hasShapes, setHasShapes] = useState(false);

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
    map.doubleClickZoom.enable();
    if (elRef.current) elRef.current.style.cursor = "";
  }

  function enterMode(next: Exclude<DrawMode, null>) {
    const map = mapRef.current;
    if (!map) return;
    if (draw.current.mode === next) { exitMode(map); return; } // toggle off = cancel
    exitMode(map);
    draw.current.mode = next;
    setMode(next);
    map.doubleClickZoom.disable();
    if (elRef.current) elRef.current.style.cursor = "crosshair";
  }

  async function finishPolygon() {
    const map = mapRef.current;
    if (!map || draw.current.points.length < 3) return;
    const L = (await import("leaflet")).default;
    const pts = [...draw.current.points];
    clearTemp(map);
    const poly = L.polygon(pts, {
      color: "#22d3ee", weight: 2, fillColor: "#22d3ee", fillOpacity: 0.08,
    }).addTo(map);
    draw.current.final.push(poly);
    setHasShapes(true);
    const ids = screensRef.current
      .filter((s) => pointInPolygon([s.lat, s.lng], pts))
      .map((s) => s.id);
    addToSelection(ids);
    exitMode(map);
  }

  function clearShapes() {
    const map = mapRef.current;
    if (!map) return;
    draw.current.final.forEach((l) => map.removeLayer(l));
    draw.current.final = [];
    setHasShapes(false);
    exitMode(map);
  }

  // Init once
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !elRef.current || mapRef.current) return;

      const map = L.map(elRef.current, {
        zoomControl: true,
        scrollWheelZoom: false,
        dragging: true,
        attributionControl: true,
      });
      mapRef.current = map;

      L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: "abcd",
        maxZoom: 19,
      }).addTo(map);

      screens.forEach((s) => {
        const marker = L.marker([s.lat, s.lng], { icon: iconFor(L, false) }).addTo(map);
        marker.bindTooltip(
          `<div class="glo-tip"><div class="glo-tip-corner">${esc(s.name)}</div>
           <div class="glo-tip-meta">${esc(s.city)} &middot; ${esc(s.venue_type)} &middot; from $${fromPrice(s.daily_price_usd)}/day &middot; tap to select</div></div>`,
          { direction: "top", offset: [0, -16], opacity: 1 }
        );
        marker.on("click", () => {
          if (draw.current.mode) return; // ignore marker taps while drawing
          onToggleRef.current(s.id);
        });
        markersRef.current.set(s.id, marker);
      });

      if (screens.length) {
        const bounds = L.latLngBounds(screens.map((s) => [s.lat, s.lng] as [number, number]));
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 13 });
      }

      // ---- drawing handlers
      map.on("click", (e: import("leaflet").LeafletMouseEvent) => {
        const d = draw.current;
        if (d.mode === "circle") {
          if (!d.center) {
            d.center = [e.latlng.lat, e.latlng.lng];
            const dot = L.circleMarker(e.latlng, {
              radius: 5, color: "#22d3ee", fillColor: "#22d3ee", fillOpacity: 1, weight: 1,
            }).addTo(map);
            d.temp.push(dot);
          } else {
            // finalize circle
            const center = L.latLng(d.center[0], d.center[1]);
            const radius = center.distanceTo(e.latlng);
            clearTemp(map);
            const circle = L.circle(center, {
              radius, color: "#22d3ee", weight: 2, fillColor: "#22d3ee", fillOpacity: 0.08,
            }).addTo(map);
            d.final.push(circle);
            setHasShapes(true);
            const ids = screensRef.current
              .filter((s) => center.distanceTo(L.latLng(s.lat, s.lng)) <= radius)
              .map((s) => s.id);
            addToSelection(ids);
            exitMode(map);
          }
        } else if (d.mode === "poly") {
          d.points.push([e.latlng.lat, e.latlng.lng]);
          setVertices(d.points.length);
          const dot = L.circleMarker(e.latlng, {
            radius: 4, color: "#22d3ee", fillColor: "#22d3ee", fillOpacity: 1, weight: 1,
          }).addTo(map);
          d.temp.push(dot);
          if (d.points.length >= 2) {
            const line = L.polyline(d.points, { color: "#22d3ee", weight: 2, dashArray: "6 6" }).addTo(map);
            d.temp.push(line);
          }
        }
      });

      map.on("mousemove", (e: import("leaflet").LeafletMouseEvent) => {
        const d = draw.current;
        if (d.mode === "circle" && d.center) {
          // live radius preview: keep the center dot, replace the preview circle
          const keep = d.temp[0];
          d.temp.slice(1).forEach((l) => map.removeLayer(l));
          d.temp = keep ? [keep] : [];
          const center = L.latLng(d.center[0], d.center[1]);
          const preview = L.circle(center, {
            radius: center.distanceTo(e.latlng),
            color: "#22d3ee", weight: 2, dashArray: "6 6", fillColor: "#22d3ee", fillOpacity: 0.05,
          }).addTo(map);
          d.temp.push(preview);
        }
      });

      map.on("dblclick", () => {
        if (draw.current.mode === "poly") finishPolygon();
      });
    })();
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      markersRef.current.clear();
      draw.current = { mode: null, center: null, points: [], temp: [], final: [] };
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screens]);

  // Reflect selection changes on markers
  useEffect(() => {
    (async () => {
      if (!mapRef.current) return;
      const L = (await import("leaflet")).default;
      markersRef.current.forEach((marker, id) => {
        marker.setIcon(iconFor(L, selected.has(id)));
      });
    })();
  }, [selected]);

  return (
    <div className="relative">
      <div
        ref={elRef}
        className="h-[320px] sm:h-[400px] w-full rounded-lg overflow-hidden border border-line-800 bg-bg-900"
        aria-label="Map of screens available to book"
      />
      {/* draw toolbar */}
      <div className="absolute top-2 right-2 z-[1000] flex flex-col gap-1.5 items-end">
        <div className="flex gap-1.5">
          <ToolBtn active={mode === "circle"} onClick={() => enterMode("circle")} label="Radius" />
          <ToolBtn active={mode === "poly"} onClick={() => enterMode("poly")} label="Area" />
          {hasShapes && <ToolBtn active={false} onClick={clearShapes} label="Clear" />}
        </div>
        {mode === "circle" && (
          <span className="text-[11px] px-2 py-1 rounded bg-bg-950/90 border border-line-800 text-ink-300">
            {draw.current.center ? "Click to set the radius" : "Click the center of your zone"}
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
      <p className="text-[11px] text-ink-500 mt-1.5">
        Tap screens one by one, or use Radius / Area to grab every screen in a zone at once.
      </p>
      <style jsx global>{`
        .glo-book-marker { background: transparent; border: none; }
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

/** Ray-casting point-in-polygon on [lat, lng] pairs. */
function pointInPolygon(p: [number, number], poly: [number, number][]): boolean {
  const [y, x] = p; // lat=y, lng=x
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const yi = poly[i][0], xi = poly[i][1];
    const yj = poly[j][0], xj = poly[j][1];
    const intersect = (yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function iconFor(L: typeof import("leaflet"), isSelected: boolean) {
  return L.divIcon({
    className: `glo-book-marker ${isSelected ? "sel" : "unsel"}`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    html: `${isSelected ? '<span class="ring"></span>' : ""}<span class="dot"></span>`,
  });
}

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
