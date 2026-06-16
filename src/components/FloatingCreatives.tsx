import type { ReactElement } from "react";

/* ─────────────────────────────────────────────────────────────────────────
 * Floating creatives — tiny ad-format glyphs drifting across the viewport.
 * Ported verbatim from the Glo marketing site (we-are-glo.com) so the app
 * shares the same ambient background motif: TVs, phones, billboards, tablets,
 * play buttons, and aperture marks. Deterministic layout (seeded PRNG) →
 * rendered on the server, animated purely in CSS.
 * ───────────────────────────────────────────────────────────────────────── */

type ShapeKey = "tv" | "phone" | "billboard" | "tablet" | "aperture" | "play";

const Shapes: Record<ShapeKey, (props: { size: number; color: string }) => ReactElement> = {
  // CTV / TV
  tv: ({ size, color }) => (
    <svg width={size * 1.3} height={size} viewBox="0 0 26 20" fill="none">
      <rect x="1.2" y="1.2" width="23.6" height="14" rx="1.6" stroke={color} strokeWidth="1.4" />
      <line x1="9" y1="17.5" x2="17" y2="17.5" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="13" cy="8.2" r="1.3" fill={color} opacity="0.55" />
    </svg>
  ),
  // Mobile / Native
  phone: ({ size, color }) => (
    <svg width={size * 0.55} height={size} viewBox="0 0 12 22" fill="none">
      <rect x="1.2" y="1.2" width="9.6" height="19.6" rx="2" stroke={color} strokeWidth="1.4" />
      <line x1="4.6" y1="3.4" x2="7.4" y2="3.4" stroke={color} strokeWidth="0.9" strokeLinecap="round" />
      <circle cx="6" cy="18.6" r="0.8" fill={color} />
    </svg>
  ),
  // DOOH billboard with post
  billboard: ({ size, color }) => (
    <svg width={size * 1.05} height={size * 1.2} viewBox="0 0 22 25" fill="none">
      <rect x="1.2" y="1.2" width="19.6" height="13" rx="0.6" stroke={color} strokeWidth="1.4" />
      <line x1="11" y1="14.4" x2="11" y2="23" stroke={color} strokeWidth="1.4" />
      <line x1="6.5" y1="23" x2="15.5" y2="23" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="6" cy="7.5" r="1.5" fill={color} opacity="0.5" />
    </svg>
  ),
  // Tablet
  tablet: ({ size, color }) => (
    <svg width={size * 0.78} height={size} viewBox="0 0 17 22" fill="none">
      <rect x="1.2" y="1.2" width="14.6" height="19.6" rx="1.6" stroke={color} strokeWidth="1.4" />
      <circle cx="8.5" cy="18.7" r="0.7" fill={color} />
    </svg>
  ),
  // Aperture — the brand mark
  aperture: ({ size, color }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10.2" stroke={color} strokeWidth="1.4" />
      <circle cx="12" cy="12" r="6.6" stroke={color} strokeWidth="1.2" />
      <circle cx="12" cy="12" r="2.6" fill="#F5BD7C" />
    </svg>
  ),
  // Video play
  play: ({ size, color }) => (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="9" stroke={color} strokeWidth="1.4" />
      <polygon points="8.4,6 8.4,14 14,10" fill={color} />
    </svg>
  ),
};

const COLORS = ["#F5EFE3", "#F5BD7C", "#22D3EE", "#BEF264"] as const; // cream, amber, cy, lime
const SHAPE_KEYS: ShapeKey[] = ["tv", "phone", "billboard", "tablet", "aperture", "play"];

type Floater = {
  shape: ShapeKey;
  color: string;
  size: number; // px
  top: number; // % of viewport
  left: number; // %
  opacity: number; // 0..1 — final faded-in opacity
  duration: number; // seconds for the bob
  delay: number; // seconds until first bob start
  flickerSpeed: number; // seconds between flickers
};

/**
 * Deterministic-but-spread distribution: build a base grid of ~32 cells across
 * the viewport, jitter each cell, then deterministically pick shape/color so
 * the layout is the same on every render but feels organic.
 */
function buildFloaters(count = 32): Floater[] {
  // Mulberry32 PRNG seeded with a fixed value for stable layout
  let s = 0x9e3779b1;
  const rand = () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const cols = 8;
  const rows = 4;
  const cellW = 100 / cols;
  const cellH = 100 / rows;

  const out: Floater[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (out.length >= count) break;
      const jitterX = (rand() - 0.5) * cellW * 0.85;
      const jitterY = (rand() - 0.5) * cellH * 0.85;
      const top = Math.max(2, Math.min(96, r * cellH + cellH / 2 + jitterY));
      const left = Math.max(2, Math.min(96, c * cellW + cellW / 2 + jitterX));
      out.push({
        shape: SHAPE_KEYS[Math.floor(rand() * SHAPE_KEYS.length)],
        color: COLORS[Math.floor(rand() * COLORS.length)],
        size: 16 + Math.floor(rand() * 18), // 16–34 px
        top,
        left,
        opacity: 0.1 + rand() * 0.1, // 0.10–0.20
        duration: 4 + rand() * 3.5, // 4–7.5 s
        delay: rand() * 3, // 0–3 s
        flickerSpeed: 3.5 + rand() * 3, // 3.5–6.5 s
      });
    }
  }
  return out;
}

// Computed once at module load — deterministic, so it can render on the server.
const FLOATERS = buildFloaters(32);

export function FloatingCreatives() {
  return (
    <div className="floaters" aria-hidden="true">
      {FLOATERS.map((f, i) => {
        const Shape = Shapes[f.shape];
        return (
          <span
            key={i}
            className="floater"
            style={{
              top: `${f.top}%`,
              left: `${f.left}%`,
              ["--op" as string]: f.opacity,
              animationDuration: `1s, ${f.duration}s, ${f.flickerSpeed}s`,
              animationDelay: `0s, ${f.delay}s, ${f.delay + 0.6}s`,
              color: f.color,
              filter: `drop-shadow(0 0 4px ${f.color}88)`,
            }}
          >
            <Shape size={f.size} color={f.color} />
          </span>
        );
      })}
    </div>
  );
}
