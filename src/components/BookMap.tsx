"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import type { Screen } from "@/lib/db";
import { loadLeaflet, createDarkMap, fitToPoints, escapeHtml, type Leaflet } from "@/lib/leaflet";
import { LeafletBaseStyles } from "@/components/LeafletBaseStyles";

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
      const L = await loadLeaflet();
      if (cancelled || !elRef.current || mapRef.current) return;

      const map = createDarkMap(L, elRef.current);
      mapRef.current = map;

      screens.forEach((s) => {
        const marker = L.marker([s.lat, s.lng], { icon: iconFor(L, false) }).addTo(map);
        marker.bindTooltip(
          `<div class="glo-tip"><div class="glo-tip-corner">${escapeHtml(s.name)}</div>
           <div class="glo-tip-meta">${escapeHtml(s.city)} &middot; ${escapeHtml(s.venue_type)} &middot; $${s.daily_price_usd}/day &middot; tap to select</div></div>`,
          { direction: "top", offset: [0, -16], opacity: 1 }
        );
        marker.on("click", () => onToggleRef.current(s.id));
        markersRef.current.set(s.id, marker);
      });

      fitToPoints(L, map, screens.map((s) => [s.lat, s.lng]), { padding: [40, 40], maxZoom: 13 });
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
      const L = await loadLeaflet();
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
      `}</style>
      <LeafletBaseStyles />
    </div>
  );
}

function iconFor(L: Leaflet, isSelected: boolean) {
  return L.divIcon({
    className: `glo-book-marker ${isSelected ? "sel" : "unsel"}`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    html: `${isSelected ? '<span class="ring"></span>' : ""}<span class="dot"></span>`,
  });
}
