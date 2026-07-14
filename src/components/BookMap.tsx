"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import type { Screen } from "@/lib/db";

/**
 * Screen-picking map: every available screen is a marker; tapping toggles selection.
 * Selected markers glow cyan, unselected lime. Leaflet loads client-side only.
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
           <div class="glo-tip-meta">${esc(s.city)} &middot; ${esc(s.venue_type)} &middot; $${s.daily_price_usd}/day &middot; tap to select</div></div>`,
          { direction: "top", offset: [0, -16], opacity: 1 }
        );
        marker.on("click", () => onToggleRef.current(s.id));
        markersRef.current.set(s.id, marker);
      });

      if (screens.length) {
        const bounds = L.latLngBounds(screens.map((s) => [s.lat, s.lng] as [number, number]));
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 13 });
      }
    })();
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      markersRef.current.clear();
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
