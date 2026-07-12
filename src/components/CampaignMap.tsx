"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";

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
      const L = (await import("leaflet")).default;
      if (cancelled || !elRef.current || mapRef.current) return;

      const map = L.map(elRef.current, {
        zoomControl: true,
        scrollWheelZoom: false, // don't hijack page scroll
        attributionControl: true,
      });
      mapRef.current = map;

      L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
        {
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
          subdomains: "abcd",
          maxZoom: 19,
        }
      ).addTo(map);

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

        L.marker([s.lat, s.lng], { icon })
          .addTo(map)
          .bindTooltip(
            `<div class="glo-tip">
               <div class="glo-tip-corner">${s.corner}</div>
               <div class="glo-tip-meta">${s.neighborhood} &middot; ${s.impressions.toLocaleString()} impressions</div>
             </div>`,
            { direction: "top", offset: [0, -size / 2 - 2], opacity: 1 }
          );
      });

      // Zoom in tight on the footprint
      const bounds = L.latLngBounds(screens.map((s) => [s.lat, s.lng] as [number, number]));
      map.fitBounds(bounds, { padding: [44, 44], maxZoom: 15 });
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
        .leaflet-tooltip.leaflet-tooltip-top {
          background: #0d1117; border: 1px solid rgba(163, 230, 53, 0.35);
          border-radius: 8px; box-shadow: 0 6px 24px rgba(0,0,0,0.5); padding: 8px 10px;
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
