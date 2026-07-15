"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import { loadLeaflet, createDarkMap, fitToPoints, escapeHtml } from "@/lib/leaflet";
import { LeafletBaseStyles } from "@/components/LeafletBaseStyles";

export type MapScreen = {
  neighborhood: string;
  corner: string;
  impressions: number;
  lat: number;
  lng: number;
};

/**
 * Dark, zoomed-in live map of where the campaign's ads are running.
 * Leaflet is imported inside useEffect so it never touches the server.
 */
export default function CampaignMap({ screens }: { screens: MapScreen[] }) {
  const elRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const L = await loadLeaflet();
      if (cancelled || !elRef.current || mapRef.current) return;

      // mobile: two-finger pinch zoom only, page scroll stays free
      const map = createDarkMap(L, elRef.current, { dragging: !L.Browser.mobile });
      mapRef.current = map;

      const maxImp = Math.max(...screens.map((s) => s.impressions));

      screens.forEach((s) => {
        // Marker size scales with impressions: 26–44px halo
        const size = 26 + Math.round((s.impressions / maxImp) * 18);
        const icon = L.divIcon({
          className: "glo-screen-marker",
          iconSize: [size, size],
          iconAnchor: [size / 2, size / 2],
          html: `
            <span class="glo-halo" style="width:${size}px;height:${size}px"></span>
            <span class="glo-dot"></span>
          `,
        });

        const infoHtml = `<div class="glo-tip">
               <div class="glo-tip-corner">${escapeHtml(s.corner)}</div>
               <div class="glo-tip-meta">${escapeHtml(s.neighborhood)} &middot; ${s.impressions.toLocaleString()} impressions</div>
             </div>`;

        const marker = L.marker([s.lat, s.lng], { icon }).addTo(map);
        if (L.Browser.mobile) {
          // Touch: tooltips get closed by the synthesized map click; popups are the native tap pattern
          marker.bindPopup(infoHtml, {
            closeButton: false,
            offset: [0, -size / 2],
            className: "glo-pop",
            autoPan: false,
          });
        } else {
          marker.bindTooltip(infoHtml, { direction: "top", offset: [0, -size / 2 - 2], opacity: 1 });
        }
      });

      // Zoom in tight on the footprint
      fitToPoints(L, map, screens.map((s) => [s.lat, s.lng]), { padding: [44, 44], maxZoom: 15 });
    })();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // screens is static dummy data for now; re-init on change is fine
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="relative">
      <div
        ref={elRef}
        className="h-[300px] sm:h-[380px] md:h-[440px] w-full rounded-lg overflow-hidden border border-line-800 bg-bg-900"
        aria-label="Map of screens running your ads"
      />
      <style jsx global>{`
        .glo-screen-marker { background: transparent; border: none; }
        .glo-screen-marker .glo-halo,
        .glo-screen-marker .glo-dot { pointer-events: none; }
        .glo-screen-marker .glo-halo {
          position: absolute; inset: 0; margin: auto;
          border-radius: 9999px;
          background: radial-gradient(circle, rgba(163, 230, 53, 0.35) 0%, rgba(163, 230, 53, 0.08) 55%, transparent 72%);
          animation: glo-pulse 2.4s ease-out infinite;
        }
        .glo-screen-marker .glo-dot {
          position: absolute; inset: 0; margin: auto;
          width: 11px; height: 11px; border-radius: 9999px;
          background: #a3e635;
          border: 2px solid rgba(9, 12, 16, 0.9);
          box-shadow: 0 0 10px rgba(163, 230, 53, 0.9), 0 0 22px rgba(163, 230, 53, 0.45);
        }
        @keyframes glo-pulse {
          0%   { transform: scale(0.55); opacity: 0.9; }
          70%  { transform: scale(1.25); opacity: 0.15; }
          100% { transform: scale(1.35); opacity: 0; }
        }
        .glo-pop .leaflet-popup-content-wrapper {
          background: #0d1117; border: 1px solid rgba(163, 230, 53, 0.35);
          border-radius: 8px; box-shadow: 0 6px 24px rgba(0,0,0,0.5);
        }
        .glo-pop .leaflet-popup-content { margin: 8px 10px; }
        .glo-pop .leaflet-popup-tip { background: #0d1117; border: 1px solid rgba(163, 230, 53, 0.35); }
      `}</style>
      <LeafletBaseStyles />
    </div>
  );
}
