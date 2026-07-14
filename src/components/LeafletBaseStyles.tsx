/**
 * Shared Glo dark theme for Leaflet chrome — tooltip, container, zoom and
 * attribution controls, plus the `.glo-tip` content used by both maps.
 * Marker- and popup-specific styles stay with each map component.
 */
export function LeafletBaseStyles() {
  return (
    <style jsx global>{`
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
  );
}
