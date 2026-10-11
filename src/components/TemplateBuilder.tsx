"use client";

import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";

export type FontId = "modern" | "editorial" | "typewriter";

export type TemplateId =
  | "glow" | "bold" | "minimal" | "photo"
  | "midnight" | "sunset" | "poster" | "ticket" | "paper" | "mesh";

export type TemplateSpec = {
  preset: TemplateId;
  headline: string;
  subline: string;
  accent: string; // hex
  font?: FontId;
  kicker?: string;          // small-caps label above the headline
  offer?: string;           // starburst badge, e.g. "20% OFF"
  cta?: string;             // footer bar text
  qrUrl?: string;           // renders a scannable QR in the footer
  bgImage?: string | null;  // dataURL background photo (photo template)
  logoImage?: string | null; // dataURL logo drawn at the top
};

type Layout = "center" | "lower" | "left";

export type CanvasSize = { w: number; h: number };

export type RatioId = "16:9" | "9:16" | "1:1" | "4:3";

export const RATIOS: Record<RatioId, CanvasSize> = {
  "16:9": { w: 1920, h: 1080 },
  "9:16": { w: 1080, h: 1920 },
  "1:1":  { w: 1080, h: 1080 },
  "4:3":  { w: 1440, h: 1080 },
};

export const RATIO_IDS: RatioId[] = ["16:9", "9:16", "1:1", "4:3"];

type TemplateDef = {
  id: TemplateId;
  label: string;
  hint: string;
  layout: Layout;
  fontDefault: FontId;
  accentDefault: string;
  darkText: boolean;   // headline/sub in near-black instead of white
  grain: number;       // 0..1 film grain strength
  paint: (ctx: CanvasRenderingContext2D, spec: TemplateSpec, size: CanvasSize, u: number) => void;
};

const FONTS: { id: FontId; label: string; stack: string; upper: boolean }[] = [
  { id: "modern", label: "Modern", stack: "system-ui, -apple-system, 'Segoe UI', sans-serif", upper: true },
  { id: "editorial", label: "Editorial", stack: "Georgia, 'Times New Roman', serif", upper: false },
  { id: "typewriter", label: "Typewriter", stack: "'Courier New', Courier, monospace", upper: true },
];

const SWATCHES = ["#22D3EE", "#A3E635", "#F472B6", "#FBBF24", "#A78BFA", "#F87171"];

/**
 * Legacy portrait constants. Kept exported so existing importers (the /book and
 * /studio flows, which still upload a single 9:16 rendition) keep compiling.
 */
export const CANVAS_W = RATIOS["9:16"].w;
export const CANVAS_H = RATIOS["9:16"].h;

const MAX_IMG_MB = 4;

/**
 * The scaling unit every former hardcoded pixel value is multiplied by.
 *
 * The whole design was hand-tuned against 1080x1920, so each absolute value in
 * here is really "n units at a 1080 short edge". Keying the unit to the SHORT
 * edge (rather than width, height or the diagonal) is what keeps type weight
 * and margins feeling the same in portrait and landscape: a 128u headline reads
 * the same on 1080x1920 as on 1920x1080.
 *
 * Note min(1080, 1920) / 1080 === 1, so u is exactly 1 for 9:16 and therefore
 * every 9:16 render must stay byte-identical to the pre-refactor output. All
 * four shipped RATIOS have a 1080 short edge, so u only departs from 1 when
 * callers ask for a smaller or larger canvas (thumbnails, hi-dpi exports).
 */
function unitOf(size: CanvasSize): number {
  return Math.min(size.w, size.h) / 1080;
}

/**
 * Horizontal inset for a value tuned at 1080 wide.
 *
 * Pure u scaling leaves wide canvases looking cramped: 90u of side margin is
 * 8.3% of a portrait width but only 4.7% of a 1920 landscape width, so the type
 * runs almost to the bezel. The floor below expresses the margin as a share of
 * the actual width instead, and max() picks whichever is roomier. The share is
 * calibrated so insetX(90) === max(90u, w * 0.055).
 *
 * At 9:16 the floor evaluates to 0.66 * base while base * u is base, so max()
 * always returns base. That is why 9:16 geometry is untouched by this rule.
 */
function insetX(base: number, size: CanvasSize): number {
  return Math.max(base * unitOf(size), size.w * 0.055 * (base / 90));
}

/**
 * Top edge of the footer bar.
 *
 * Was the literal 1560 on a 1920-tall canvas: a 210 tall bar leaving 150 of
 * clearance for the watermark below it. Anchoring to the BOTTOM edge rather
 * than scaling 1560 by u is what keeps the bar on-canvas in landscape, where
 * 1560u would fall past a 1080 bottom edge entirely.
 */
function footerTopOf(size: CanvasSize, u: number): number {
  return size.h - 360 * u;
}

const FOOTER_H_BASE = 210;

/* ---------------- color helpers ---------------- */

function hexA(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(full, 16);
  if (Number.isNaN(n)) return `rgba(34,211,238,${alpha})`;
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

function shiftHue(hex: string, deg: number): string {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(full, 16);
  if (Number.isNaN(n)) return hex;
  let r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let hh = 0; const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  if (d !== 0) {
    if (max === r) hh = ((g - b) / d) % 6;
    else if (max === g) hh = (b - r) / d + 2;
    else hh = (r - g) / d + 4;
    hh *= 60;
  }
  hh = (hh + deg + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((hh / 60) % 2) - 1));
  const m = l - c / 2;
  let rr = 0, gg = 0, bb = 0;
  if (hh < 60) { rr = c; gg = x; }
  else if (hh < 120) { rr = x; gg = c; }
  else if (hh < 180) { gg = c; bb = x; }
  else if (hh < 240) { gg = x; bb = c; }
  else if (hh < 300) { rr = x; bb = c; }
  else { rr = c; bb = x; }
  const to255 = (v: number) => Math.round((v + m) * 255);
  return `#${[to255(rr), to255(gg), to255(bb)].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

/* ---------------- texture helpers ---------------- */

function grainOverlay(ctx: CanvasRenderingContext2D, strength: number, size: CanvasSize, u: number) {
  if (strength <= 0) return;
  // The noise tile is stretched over the whole canvas, so scaling the tile with
  // u is what keeps the visible speckle the same physical size at any output.
  const gw = Math.max(1, Math.round(180 * u));
  const gh = Math.max(1, Math.round(320 * u));
  const off = document.createElement("canvas");
  off.width = gw; off.height = gh;
  const octx = off.getContext("2d");
  if (!octx) return;
  const img = octx.createImageData(gw, gh);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.floor(Math.random() * 255);
    img.data[i] = v; img.data[i + 1] = v; img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  octx.putImageData(img, 0, 0);
  ctx.save();
  ctx.globalAlpha = strength;
  ctx.globalCompositeOperation = "overlay";
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(off, 0, 0, size.w, size.h);
  ctx.restore();
}

function orb(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, alpha: number, size: CanvasSize) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, hexA(color, alpha));
  g.addColorStop(1, hexA(color, 0));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size.w, size.h);
}

function darkGradient(ctx: CanvasRenderingContext2D, top: string, bottom: string, size: CanvasSize) {
  const g = ctx.createLinearGradient(0, 0, 0, size.h);
  g.addColorStop(0, top);
  g.addColorStop(1, bottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size.w, size.h);
}

/* ---------------- template catalog ---------------- */

const TEMPLATES: TemplateDef[] = [
  {
    id: "glow", label: "Neon", hint: "Dark, neon, night-street energy",
    layout: "center", fontDefault: "modern", accentDefault: "#22D3EE", darkText: false, grain: 0.06,
    paint: (ctx, spec, size, u) => {
      darkGradient(ctx, "#070b14", "#0d1524", size);
      orb(ctx, size.w / 2, size.h * 0.78, 700 * u, spec.accent, 0.5, size);
      ctx.strokeStyle = hexA(spec.accent, 0.9);
      ctx.lineWidth = 10 * u;
      ctx.strokeRect(45 * u, 45 * u, size.w - 90 * u, size.h - 90 * u);
    },
  },
  {
    id: "midnight", label: "Midnight", hint: "Deep black, soft glow orbs, grain",
    layout: "center", fontDefault: "modern", accentDefault: "#A78BFA", darkText: false, grain: 0.09,
    paint: (ctx, spec, size, u) => {
      darkGradient(ctx, "#04060b", "#090d16", size);
      orb(ctx, size.w * 0.85, size.h * 0.16, 560 * u, spec.accent, 0.45, size);
      orb(ctx, size.w * 0.1, size.h * 0.9, 640 * u, shiftHue(spec.accent, 40), 0.28, size);
      ctx.strokeStyle = hexA("#ffffff", 0.14);
      ctx.lineWidth = 2 * u;
      ctx.beginPath();
      ctx.arc(size.w * 0.85, size.h * 0.16, 250 * u, 0, Math.PI * 2);
      ctx.stroke();
    },
  },
  {
    id: "mesh", label: "Mesh", hint: "Blurry gradient blobs, very now",
    layout: "center", fontDefault: "modern", accentDefault: "#F472B6", darkText: false, grain: 0.07,
    paint: (ctx, spec, size, u) => {
      darkGradient(ctx, "#0a0a12", "#12101c", size);
      orb(ctx, size.w * 0.2, size.h * 0.22, 620 * u, spec.accent, 0.6, size);
      orb(ctx, size.w * 0.9, size.h * 0.45, 560 * u, shiftHue(spec.accent, 60), 0.5, size);
      orb(ctx, size.w * 0.4, size.h * 0.9, 700 * u, shiftHue(spec.accent, -50), 0.45, size);
      orb(ctx, size.w * 0.75, size.h * 0.8, 380 * u, "#ffffff", 0.1, size);
    },
  },
  {
    id: "sunset", label: "Sunset", hint: "Warm gradient, sun disc, horizon",
    layout: "center", fontDefault: "editorial", accentDefault: "#FBBF24", darkText: false, grain: 0.08,
    paint: (ctx, spec, size, u) => {
      const g = ctx.createLinearGradient(0, 0, 0, size.h);
      g.addColorStop(0, shiftHue(spec.accent, -18));
      g.addColorStop(0.55, shiftHue(spec.accent, 12));
      g.addColorStop(1, "#100a14");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, size.w, size.h);
      // sun disc
      ctx.fillStyle = hexA("#ffffff", 0.85);
      ctx.beginPath();
      ctx.arc(size.w / 2, size.h * 0.3, 200 * u, 0, Math.PI * 2);
      ctx.fill();
      orb(ctx, size.w / 2, size.h * 0.3, 480 * u, "#ffffff", 0.35, size);
      // horizon lines
      ctx.strokeStyle = hexA("#100a14", 0.35);
      ctx.lineWidth = 4 * u;
      for (let i = 0; i < 5; i++) {
        const y = size.h * 0.30 + 60 * u + i * 26 * u;
        ctx.beginPath(); ctx.moveTo(size.w / 2 - 210 * u, y); ctx.lineTo(size.w / 2 + 210 * u, y); ctx.stroke();
      }
    },
  },
  {
    id: "poster", label: "Poster", hint: "Swiss grid, giant type, diagonal band",
    layout: "left", fontDefault: "modern", accentDefault: "#F87171", darkText: true, grain: 0.05,
    paint: (ctx, spec, size, u) => {
      ctx.fillStyle = "#f2efe8";
      ctx.fillRect(0, 0, size.w, size.h);
      // diagonal accent band. 2400u of length still overshoots the diagonal of
      // every shipped ratio, so the band runs off both edges as designed.
      ctx.save();
      ctx.translate(size.w * 0.72, size.h * 0.2);
      ctx.rotate(0.5);
      ctx.fillStyle = spec.accent;
      ctx.fillRect(-140 * u, -900 * u, 240 * u, 2400 * u);
      ctx.restore();
      // grid ticks, started at the same inset as the headline so they stay tied to it
      ctx.strokeStyle = "rgba(18,21,28,0.25)";
      ctx.lineWidth = 3 * u;
      for (let x = insetX(90, size); x < size.w; x += 150 * u) {
        ctx.beginPath(); ctx.moveTo(x, 70 * u); ctx.lineTo(x, 100 * u); ctx.stroke();
      }
      // index number
      ctx.fillStyle = "#12151c";
      ctx.font = `800 ${64 * u}px system-ui, -apple-system, 'Segoe UI', sans-serif`;
      ctx.textAlign = "right";
      ctx.fillText("N\u00ba 01", size.w - insetX(80, size), 140 * u);
      ctx.textAlign = "center";
    },
  },
  {
    id: "ticket", label: "Ticket", hint: "Perforated coupon, redeem energy",
    layout: "center", fontDefault: "typewriter", accentDefault: "#A3E635", darkText: false, grain: 0.07,
    paint: (ctx, spec, size, u) => {
      darkGradient(ctx, "#0b0e14", "#11151d", size);
      // outer accent frame
      ctx.strokeStyle = spec.accent;
      ctx.lineWidth = 14 * u;
      ctx.strokeRect(60 * u, 60 * u, size.w - 120 * u, size.h - 120 * u);
      ctx.strokeStyle = hexA(spec.accent, 0.5);
      ctx.lineWidth = 3 * u;
      ctx.strokeRect(92 * u, 92 * u, size.w - 184 * u, size.h - 184 * u);
      // perforation dots down both sides
      ctx.fillStyle = "#04070d";
      for (let y = 140 * u; y < size.h - 120 * u; y += 88 * u) {
        ctx.beginPath(); ctx.arc(60 * u, y, 20 * u, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(size.w - 60 * u, y, 20 * u, 0, Math.PI * 2); ctx.fill();
      }
      // rotated side label
      ctx.save();
      ctx.translate(150 * u, size.h / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.fillStyle = hexA(spec.accent, 0.85);
      ctx.font = `700 ${40 * u}px 'Courier New', Courier, monospace`;
      ctx.textAlign = "center";
      ctx.fillText("\u2022 ADMIT ONE \u2022 GLO STREET PASS \u2022", 0, 0);
      ctx.restore();
      ctx.textAlign = "center";
      // dashed divider, held 60u above the footer bar wherever that lands
      ctx.strokeStyle = hexA("#ffffff", 0.35);
      ctx.lineWidth = 4 * u;
      ctx.setLineDash([18 * u, 16 * u]);
      const divY = footerTopOf(size, u) - 60 * u;
      ctx.beginPath(); ctx.moveTo(insetX(140, size), divY); ctx.lineTo(size.w - insetX(140, size), divY); ctx.stroke();
      ctx.setLineDash([]);
    },
  },
  {
    id: "paper", label: "Paper", hint: "Warm editorial, serif, quiet luxury",
    layout: "center", fontDefault: "editorial", accentDefault: "#F87171", darkText: true, grain: 0.05,
    paint: (ctx, spec, size, u) => {
      const g = ctx.createLinearGradient(0, 0, 0, size.h);
      g.addColorStop(0, "#faf7f0");
      g.addColorStop(1, "#efe9dc");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, size.w, size.h);
      // double rules
      const rx = insetX(120, size);
      ctx.strokeStyle = "#12151c";
      ctx.lineWidth = 6 * u;
      ctx.beginPath(); ctx.moveTo(rx, 170 * u); ctx.lineTo(size.w - rx, 170 * u); ctx.stroke();
      ctx.lineWidth = 2 * u;
      ctx.beginPath(); ctx.moveTo(rx, 190 * u); ctx.lineTo(size.w - rx, 190 * u); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(rx, size.h - 190 * u); ctx.lineTo(size.w - rx, size.h - 190 * u); ctx.stroke();
      ctx.lineWidth = 6 * u;
      ctx.beginPath(); ctx.moveTo(rx, size.h - 170 * u); ctx.lineTo(size.w - rx, size.h - 170 * u); ctx.stroke();
      // wax seal dot
      ctx.fillStyle = spec.accent;
      ctx.beginPath(); ctx.arc(size.w / 2, 285 * u, 26 * u, 0, Math.PI * 2); ctx.fill();
    },
  },
  {
    id: "bold", label: "Bold", hint: "Full accent background, giant type",
    layout: "center", fontDefault: "modern", accentDefault: "#A3E635", darkText: true, grain: 0.05,
    paint: (ctx, spec, size, u) => {
      ctx.fillStyle = spec.accent;
      ctx.fillRect(0, 0, size.w, size.h);
      // halftone dot corner
      ctx.fillStyle = hexA("#0b0e14", 0.35);
      for (let row = 0; row < 9; row++) {
        for (let col = 0; col < 9 - row; col++) {
          const r = (6 + row * 1.2) * u;
          ctx.beginPath();
          ctx.arc(70 * u + col * 46 * u, size.h - 70 * u - row * 46 * u, r, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    },
  },
  {
    id: "minimal", label: "Minimal", hint: "Quiet, premium, lots of air",
    layout: "center", fontDefault: "modern", accentDefault: "#22D3EE", darkText: true, grain: 0,
    paint: (ctx, spec, size, u) => {
      const g = ctx.createLinearGradient(0, 0, 0, size.h);
      g.addColorStop(0, "#f7f6f2");
      g.addColorStop(1, "#eceae3");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, size.w, size.h);
      ctx.fillStyle = spec.accent;
      ctx.fillRect(0, size.h * 0.62, size.w, 14 * u);
    },
  },
  {
    id: "photo", label: "Photo", hint: "Your photo, cinematic scrim",
    layout: "lower", fontDefault: "modern", accentDefault: "#22D3EE", darkText: false, grain: 0.06,
    paint: (ctx, _spec, size) => {
      // photo painted separately (async); fallback:
      darkGradient(ctx, "#070b14", "#0d1524", size);
    },
  },
];

export function templateOf(spec: TemplateSpec): TemplateDef {
  return TEMPLATES.find((t) => t.id === spec.preset) ?? TEMPLATES[0];
}

function fontOf(spec: TemplateSpec) {
  const t = templateOf(spec);
  return FONTS.find((f) => f.id === (spec.font ?? t.fontDefault)) ?? FONTS[0];
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const scale = Math.max(w / img.width, h / img.height);
  const dw = img.width * scale;
  const dh = img.height * scale;
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

/**
 * maxScale caps how far a small source image may be blown up. It is a scale
 * factor, not a pixel value, so callers pass 1.5 * u: without that a 120px logo
 * would still be drawn at 180px on a quarter-size canvas and swamp it.
 */
function drawContain(ctx: CanvasRenderingContext2D, img: HTMLImageElement, cx: number, cy: number, maxW: number, maxH: number, maxScale = 1.5) {
  const scale = Math.min(maxW / img.width, maxH / img.height, maxScale);
  const dw = img.width * scale;
  const dh = img.height * scale;
  ctx.drawImage(img, cx - dw / 2, cy - dh / 2, dw, dh);
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const test = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(test).width > maxW && cur) {
      lines.push(cur);
      cur = w;
    } else {
      cur = test;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

/* ---------------- main renderer ---------------- */

/**
 * Draw the template onto any 2D context at any aspect ratio. Shared by preview
 * and export.
 *
 * Every length in here is either a fraction of size.w / size.h or a multiple of
 * u (see unitOf). Nothing may be a bare pixel number: the layout was tuned at
 * 1080x1920 and a bare number would silently mean "1080-short-edge pixels" on a
 * canvas that is not that size.
 */
export async function drawTemplate(ctx: CanvasRenderingContext2D, spec: TemplateSpec, size: CanvasSize = RATIOS["9:16"]) {
  const u = unitOf(size);
  const mx = insetX(90, size);
  const tpl = templateOf(spec);
  const font = fontOf(spec);
  const headlineRaw = spec.headline.trim() || "Your headline";
  const headline = font.upper ? headlineRaw.toUpperCase() : headlineRaw;
  const kicker = (spec.kicker ?? "").trim().toUpperCase();
  const subline = spec.subline.trim();
  const offer = (spec.offer ?? "").trim();
  const cta = (spec.cta ?? "").trim();
  const qrUrl = (spec.qrUrl ?? "").trim();
  const hasFooter = Boolean(cta || qrUrl);
  const onPhoto = tpl.id === "photo";

  ctx.clearRect(0, 0, size.w, size.h);

  // ---- Background
  const bgImg = onPhoto && spec.bgImage ? await loadImage(spec.bgImage) : null;
  if (onPhoto && bgImg) {
    drawCover(ctx, bgImg, 0, 0, size.w, size.h);
    const scrim = ctx.createLinearGradient(0, 0, 0, size.h);
    scrim.addColorStop(0, "rgba(4,7,13,0.35)");
    scrim.addColorStop(0.45, "rgba(4,7,13,0.15)");
    scrim.addColorStop(1, "rgba(4,7,13,0.88)");
    ctx.fillStyle = scrim;
    ctx.fillRect(0, 0, size.w, size.h);
  } else {
    tpl.paint(ctx, spec, size, u);
  }

  // ---- Foreground colors
  const darkText = tpl.darkText && !(onPhoto && bgImg);
  const fg = darkText ? "#12151c" : "#ffffff";
  const sub = darkText ? "#4b5563" : "rgba(255,255,255,0.85)";
  const leftAlign = tpl.layout === "left";
  const anchorX = leftAlign ? mx : size.w / 2;
  ctx.textAlign = leftAlign ? "left" : "center";

  // ---- Logo (top center / top left)
  if (spec.logoImage) {
    const logo = await loadImage(spec.logoImage);
    if (logo) {
      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,0.45)";
      ctx.shadowBlur = darkText ? 0 : 24 * u;
      drawContain(ctx, logo, leftAlign ? mx + 160 * u : size.w / 2, 250 * u, 380 * u, 200 * u, 1.5 * u);
      ctx.restore();
    }
  }

  // ---- Text block position
  let centerFrac = 0.45;
  if (hasFooter) centerFrac = 0.42;
  if (tpl.layout === "lower") centerFrac = hasFooter ? 0.56 : 0.62;
  if (tpl.layout === "left") centerFrac = 0.44;

  // ---- Headline (auto-fit, wraps)
  // hSize, not "size": the canvas dimensions own that name now.
  ctx.fillStyle = fg;
  let hSize = (tpl.id === "bold" || tpl.id === "poster" ? 150 : 128) * u;
  // Both former literals (180, 200) were twice the side inset, give or take the
  // extra 10 of air the centred layouts carried, so derive them from mx.
  const maxTextW = leftAlign ? size.w - mx * 2 : size.w - (mx * 2 + 20 * u);
  ctx.font = `800 ${hSize}px ${font.stack}`;
  let lines = wrap(ctx, headline, maxTextW);
  while (lines.length > 4 && hSize > 72 * u) {
    hSize -= 12 * u;
    ctx.font = `800 ${hSize}px ${font.stack}`;
    lines = wrap(ctx, headline, maxTextW);
  }
  const lineH = hSize * 1.08;
  const blockH = lines.length * lineH;
  let y = size.h * centerFrac - blockH / 2 + lineH * 0.8;

  // ---- Kicker above the headline
  if (kicker) {
    ctx.save();
    ctx.fillStyle = darkText ? tpl.accentDefault && spec.accent ? spec.accent : "#12151c" : hexA("#ffffff", 0.9);
    if (!darkText) ctx.fillStyle = spec.accent;
    ctx.font = `700 ${40 * u}px ${font.stack}`;
    const tracked = kicker.split("").join("\u200a\u200a");
    ctx.fillText(tracked, anchorX, y - lineH * 0.9 - 26 * u);
    ctx.restore();
  }

  ctx.save();
  if (tpl.id === "glow" || tpl.id === "midnight" || tpl.id === "mesh") {
    ctx.shadowColor = hexA(spec.accent, 0.85);
    ctx.shadowBlur = 40 * u;
  } else if (onPhoto && bgImg) {
    ctx.shadowColor = "rgba(0,0,0,0.65)";
    ctx.shadowBlur = 28 * u;
  }
  ctx.fillStyle = fg;
  ctx.font = `800 ${hSize}px ${font.stack}`;
  lines.forEach((ln) => {
    ctx.fillText(ln, anchorX, y);
    y += lineH;
  });
  ctx.restore();

  // ---- Subline
  if (subline) {
    ctx.fillStyle = sub;
    ctx.font = `500 ${52 * u}px ${font.stack}`;
    ctx.save();
    if (onPhoto && bgImg) { ctx.shadowColor = "rgba(0,0,0,0.6)"; ctx.shadowBlur = 18 * u; }
    const subLines = wrap(ctx, subline, maxTextW - 40 * u);
    let sy = y + 30 * u;
    subLines.slice(0, 3).forEach((ln) => {
      ctx.fillText(ln, anchorX, sy);
      sy += 66 * u;
    });
    ctx.restore();
  }

  // ---- Offer starburst (top-right)
  if (offer) {
    // Mirrored off the right edge (1080 - 860 = 220) so the badge keeps hugging
    // the top-right corner instead of drifting inward on a wide canvas.
    const cx = size.w - 220 * u;
    const cy = (spec.logoImage ? 590 : 480) * u;
    const R = 168 * u;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-0.21);
    ctx.beginPath();
    const points = 16;
    for (let i = 0; i < points * 2; i++) {
      const rad = i % 2 === 0 ? R : R * 0.82;
      const a = (Math.PI * i) / points;
      const px = Math.cos(a) * rad;
      const py = Math.sin(a) * rad;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    const burstBg = tpl.id === "bold" ? "#0b0e14" : spec.accent;
    const burstFg = tpl.id === "bold" ? spec.accent : "#0b0e14";
    ctx.fillStyle = burstBg;
    ctx.shadowColor = "rgba(0,0,0,0.4)";
    ctx.shadowBlur = 22 * u;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = burstFg;
    ctx.textAlign = "center";
    const badgeText = font.upper ? offer.toUpperCase() : offer;
    const words = badgeText.split(/\s+/);
    let l1 = badgeText; let l2 = "";
    if (words.length > 1) {
      const mid = Math.ceil(words.length / 2);
      l1 = words.slice(0, mid).join(" ");
      l2 = words.slice(mid).join(" ");
    }
    let bs = 64 * u;
    ctx.font = `800 ${bs}px ${font.stack}`;
    while ((ctx.measureText(l1).width > R * 1.5 || ctx.measureText(l2).width > R * 1.5) && bs > 30 * u) {
      bs -= 4 * u;
      ctx.font = `800 ${bs}px ${font.stack}`;
    }
    if (l2) {
      ctx.fillText(l1, 0, -8 * u);
      ctx.fillText(l2, 0, bs * 1.02);
    } else {
      ctx.fillText(l1, 0, bs * 0.35);
    }
    ctx.restore();
    ctx.textAlign = leftAlign ? "left" : "center";
  }

  // ---- Footer bar: CTA + QR
  const footerTop = footerTopOf(size, u);
  const footerH = FOOTER_H_BASE * u;
  const fx = insetX(70, size);
  if (hasFooter) {
    const footBg = tpl.id === "bold" ? "#0b0e14" : spec.accent;
    const footFg = tpl.id === "bold" ? "#ffffff" : "#0b0e14";
    ctx.fillStyle = footBg;
    ctx.fillRect(0, footerTop, size.w, footerH);

    let qrCard = 0;
    if (qrUrl) {
      qrCard = 170 * u;
      try {
        const qrData = await QRCode.toDataURL(qrUrl, {
          // Source raster, so it tracks the drawn card size and stays crisp
          // without generating a 320px bitmap for a thumbnail.
          width: Math.max(64, Math.round(320 * u)), margin: 1, errorCorrectionLevel: "M",
          color: { dark: "#0b0e14", light: "#ffffff" },
        });
        const qrImg = await loadImage(qrData);
        if (qrImg) {
          const pad = 12 * u;
          const cardX = size.w - fx - qrCard;
          const cardY = footerTop + (footerH - qrCard) / 2;
          ctx.fillStyle = "#ffffff";
          roundRect(ctx, cardX - pad, cardY - pad, qrCard + pad * 2, qrCard + pad * 2, 16 * u);
          ctx.fill();
          ctx.drawImage(qrImg, cardX, cardY, qrCard, qrCard);
        }
      } catch {
        qrCard = 0;
      }
    }

    const textMaxW = size.w - fx * 2 - (qrCard ? qrCard + 90 * u : 0);
    const ctaText = cta || "Scan for the offer";
    ctx.fillStyle = footFg;
    ctx.textAlign = "left";
    let cs = 56 * u;
    ctx.font = `800 ${cs}px ${font.stack}`;
    let ctaLines = wrap(ctx, font.upper ? ctaText.toUpperCase() : ctaText, textMaxW);
    while (ctaLines.length > 2 && cs > 34 * u) {
      cs -= 4 * u;
      ctx.font = `800 ${cs}px ${font.stack}`;
      ctaLines = wrap(ctx, font.upper ? ctaText.toUpperCase() : ctaText, textMaxW);
    }
    ctaLines = ctaLines.slice(0, 2);
    const ctaBlockH = ctaLines.length * cs * 1.15;
    let cy2 = footerTop + footerH / 2 - ctaBlockH / 2 + cs * 0.85;
    ctaLines.forEach((ln) => {
      ctx.fillText(ln, fx, cy2);
      cy2 += cs * 1.15;
    });
  }

  // ---- Film grain
  grainOverlay(ctx, tpl.grain, size, u);

  // ---- Glo watermark
  ctx.fillStyle = darkText ? "#9ca3af" : "rgba(255,255,255,0.55)";
  ctx.font = `600 ${34 * u}px system-ui, -apple-system, 'Segoe UI', sans-serif`;
  ctx.textAlign = "center";
  ctx.fillText("glo \u00b7 we-are-glo.com", size.w / 2, size.h - 60 * u);
}

export async function renderTemplatePng(spec: TemplateSpec, size: CanvasSize = RATIOS["9:16"]): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = size.w;
  canvas.height = size.h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  await drawTemplate(ctx, spec, size);
  return await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("PNG export failed"))), "image/png")
  );
}

/**
 * Render one spec into every shipped ratio. Sequential on purpose: each pass
 * allocates a full-size canvas and awaits image decodes, so running four at
 * once just multiplies peak memory on a phone.
 */
export async function renderAllRatios(spec: TemplateSpec): Promise<Record<RatioId, Blob>> {
  const out = {} as Record<RatioId, Blob>;
  for (const id of RATIO_IDS) {
    out[id] = await renderTemplatePng(spec, RATIOS[id]);
  }
  return out;
}

function readAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("Could not read the file"));
    r.readAsDataURL(file);
  });
}

/* ---------------- gallery thumbnails ---------------- */

function TemplateThumb({ tpl, active, accent, ratio, onClick }: {
  tpl: TemplateDef; active: boolean; accent: string; ratio: RatioId; onClick: () => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const size = RATIOS[ratio];
    canvas.width = size.w / 4;
    canvas.height = size.h / 4;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    // Draw at full size through a 0.25 transform rather than passing a quarter
    // size, so the thumbnail is a faithful shrink of the real rendition.
    ctx.scale(0.25, 0.25);
    const sample: TemplateSpec = {
      preset: tpl.id,
      headline: "Friday Night",
      subline: "",
      accent: active ? accent : tpl.accentDefault,
      font: tpl.fontDefault,
    };
    drawTemplate(ctx, sample, size);
  }, [tpl, active, accent, ratio]);
  return (
    <button
      type="button"
      onClick={onClick}
      title={tpl.hint}
      className={`text-left rounded-lg overflow-hidden border press transition-[border-color,box-shadow,transform] ${
        active ? "border-cy-400/70 shadow-glow-cy scale-[1.02]" : "border-line-800 hover:border-line-600"
      }`}
    >
      <canvas ref={ref} className="w-full h-auto block" style={{ aspectRatio: `${RATIOS[ratio].w}/${RATIOS[ratio].h}` }} />
      <div className={`px-1.5 py-1 text-[10px] font-medium truncate ${active ? "text-cy-300 bg-cy-400/10" : "text-ink-300 bg-bg-950/60"}`}>
        {tpl.label}
      </div>
    </button>
  );
}

/* ---------------- builder UI ---------------- */

export function TemplateBuilder({
  spec,
  onChange,
}: {
  spec: TemplateSpec;
  onChange: (s: TemplateSpec) => void;
}) {
  const previewRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);
  const [imgErr, setImgErr] = useState<string | null>(null);
  // Preview-only. The export path still ships 9:16 until multi-rendition
  // upload lands, so this never touches the spec.
  const [ratio, setRatio] = useState<RatioId>("9:16");
  const seq = useRef(0);
  const font = fontOf(spec);
  const tpl = templateOf(spec);
  const previewSize = RATIOS[ratio];

  useEffect(() => {
    const canvas = previewRef.current;
    if (!canvas) return;
    const size = RATIOS[ratio];
    canvas.width = size.w;
    canvas.height = size.h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const mySeq = ++seq.current;
    setReady(false);
    drawTemplate(ctx, spec, size).then(() => {
      if (mySeq === seq.current) setReady(true);
    });
  }, [spec, ratio]);

  async function onImage(file: File | undefined, key: "bgImage" | "logoImage") {
    if (!file) return;
    if (file.size > MAX_IMG_MB * 1024 * 1024) { setImgErr(`Keep images under ${MAX_IMG_MB}MB.`); return; }
    setImgErr(null);
    try {
      const data = await readAsDataURL(file);
      onChange({ ...spec, [key]: data, ...(key === "bgImage" ? { preset: "photo" as const } : {}) });
    } catch (e) {
      setImgErr(e instanceof Error ? e.message : String(e));
    }
  }

  function pickTemplate(t: TemplateDef) {
    onChange({ ...spec, preset: t.id, font: spec.font ?? undefined, accent: spec.accent || t.accentDefault });
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-[1fr_200px] lg:grid-cols-[1fr_260px] gap-6">
      <div className="space-y-5">
        <div>
          <label className="block text-xs uppercase tracking-wider text-ink-400 mb-2">Template</label>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
            {TEMPLATES.map((t) => (
              <TemplateThumb key={t.id} tpl={t} active={spec.preset === t.id} accent={spec.accent} ratio={ratio} onClick={() => pickTemplate(t)} />
            ))}
          </div>
        </div>

        {spec.preset === "photo" && (
          <div>
            <label className="block text-xs uppercase tracking-wider text-ink-400 mb-1.5">Background photo</label>
            <div className="flex items-center gap-2">
              <FileBtn id="tpl-bg" onFile={(f) => onImage(f, "bgImage")} label={spec.bgImage ? "Replace photo" : "Choose photo"} />
              {spec.bgImage && (
                <button type="button" onClick={() => onChange({ ...spec, bgImage: null })} className="text-[12px] text-ink-500 hover:text-red-300">
                  Remove
                </button>
              )}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs uppercase tracking-wider text-ink-400 mb-1.5">Kicker (optional)</label>
            <input
              type="text" maxLength={30} value={spec.kicker ?? ""}
              onChange={(e) => onChange({ ...spec, kicker: e.target.value })}
              placeholder="GRAND OPENING"
              className="w-full px-3 py-2.5 rounded-lg bg-bg-900 border border-line-800 text-ink-50 focus:border-cy-400 focus:outline-none placeholder-ink-500"
            />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wider text-ink-400 mb-1.5">Typeface</label>
            <div className="flex flex-wrap gap-2">
              {FONTS.map((f) => (
                <Chip key={f.id} active={font.id === f.id} onClick={() => onChange({ ...spec, font: f.id })}>
                  <span style={{ fontFamily: f.stack }}>{f.label}</span>
                </Chip>
              ))}
            </div>
          </div>
        </div>

        <div>
          <label className="block text-xs uppercase tracking-wider text-ink-400 mb-1.5">Headline</label>
          <input
            type="text" maxLength={60} value={spec.headline}
            onChange={(e) => onChange({ ...spec, headline: e.target.value })}
            placeholder="Friday Night Special"
            className="w-full px-3 py-2.5 rounded-lg bg-bg-900 border border-line-800 text-ink-50 focus:border-cy-400 focus:outline-none focus:ring-2 focus:ring-cy-400/20 placeholder-ink-500"
          />
        </div>
        <div>
          <label className="block text-xs uppercase tracking-wider text-ink-400 mb-1.5">Subline (optional)</label>
          <input
            type="text" maxLength={90} value={spec.subline}
            onChange={(e) => onChange({ ...spec, subline: e.target.value })}
            placeholder="Every Friday from 6pm at 142 Bedford Ave"
            className="w-full px-3 py-2.5 rounded-lg bg-bg-900 border border-line-800 text-ink-50 focus:border-cy-400 focus:outline-none focus:ring-2 focus:ring-cy-400/20 placeholder-ink-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs uppercase tracking-wider text-ink-400 mb-1.5">Offer badge</label>
            <input
              type="text" maxLength={18} value={spec.offer ?? ""}
              onChange={(e) => onChange({ ...spec, offer: e.target.value })}
              placeholder="20% OFF"
              className="w-full px-3 py-2.5 rounded-lg bg-bg-900 border border-line-800 text-ink-50 focus:border-cy-400 focus:outline-none placeholder-ink-500"
            />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wider text-ink-400 mb-1.5">Footer CTA</label>
            <input
              type="text" maxLength={48} value={spec.cta ?? ""}
              onChange={(e) => onChange({ ...spec, cta: e.target.value })}
              placeholder="Tonight only"
              className="w-full px-3 py-2.5 rounded-lg bg-bg-900 border border-line-800 text-ink-50 focus:border-cy-400 focus:outline-none placeholder-ink-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs uppercase tracking-wider text-ink-400 mb-1.5">QR link (optional)</label>
          <input
            type="url" maxLength={200} value={spec.qrUrl ?? ""}
            onChange={(e) => onChange({ ...spec, qrUrl: e.target.value })}
            placeholder="https://your-site.com/offer"
            className="w-full px-3 py-2.5 rounded-lg bg-bg-900 border border-line-800 text-ink-50 focus:border-cy-400 focus:outline-none placeholder-ink-500"
          />
          <p className="text-[11px] text-ink-500 mt-1">Adds a scannable code to the footer. Passers-by scan; you track.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
          <div>
            <label className="block text-xs uppercase tracking-wider text-ink-400 mb-1.5">Logo (optional)</label>
            <div className="flex items-center gap-2">
              <FileBtn id="tpl-logo" onFile={(f) => onImage(f, "logoImage")} label={spec.logoImage ? "Replace logo" : "Upload logo"} />
              {spec.logoImage && (
                <button type="button" onClick={() => onChange({ ...spec, logoImage: null })} className="text-[12px] text-ink-500 hover:text-red-300">
                  Remove
                </button>
              )}
            </div>
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wider text-ink-400 mb-1.5">Accent color</label>
            <div className="flex items-center gap-2 flex-wrap">
              {SWATCHES.map((c) => (
                <button
                  key={c} type="button" aria-label={`Accent ${c}`}
                  onClick={() => onChange({ ...spec, accent: c })}
                  className={`w-8 h-8 rounded-full border-2 transition-transform ${spec.accent.toLowerCase() === c.toLowerCase() ? "border-ink-50 scale-110" : "border-transparent hover:scale-105"}`}
                  style={{ backgroundColor: c }}
                />
              ))}
              <input
                type="color" value={spec.accent}
                onChange={(e) => onChange({ ...spec, accent: e.target.value })}
                className="h-8 w-10 rounded-md border border-line-800 bg-bg-900 p-0.5 cursor-pointer"
                aria-label="Custom accent color"
              />
            </div>
          </div>
        </div>

        {imgErr && <p className="text-sm text-red-400">{imgErr}</p>}
        <p className="text-[11px] text-ink-500">
          Exports a 1080{"\u00d7"}1920 portrait image. Glo auto-fits it to each screen at delivery.
          The shape buttons above the preview only change what you see here.
        </p>
      </div>

      <div className="order-first md:order-none">
        <div className="text-xs uppercase tracking-wider text-ink-400 mb-1.5">Live preview</div>
        <div className="flex flex-wrap gap-1.5 mb-2" role="group" aria-label="Preview shape">
          {RATIO_IDS.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRatio(r)}
              aria-pressed={ratio === r}
              className={`px-2 py-1 rounded-md text-[11px] font-medium border transition-colors ${
                ratio === r ? "bg-cy-400/15 text-cy-300 border-cy-400/40" : "border-line-800 text-ink-400 hover:text-ink-50 hover:border-line-700"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
        <div className="rounded-lg border border-line-800 bg-bg-900 p-3 flex justify-center md:sticky md:top-4">
          <canvas
            ref={previewRef}
            className="w-full max-w-[170px] sm:max-w-[240px] h-auto rounded-md"
            style={{ aspectRatio: `${previewSize.w}/${previewSize.h}` }}
            aria-label={`Template preview at ${ratio}`}
          />
        </div>
        {!ready && <p className="text-[11px] text-ink-500 mt-2">Rendering{"\u2026"}</p>}
        <p className="text-[11px] text-ink-500 mt-2">{tpl.label}: {tpl.hint}</p>
      </div>
    </div>
  );
}

function Chip({ active, onClick, title, children }: {
  active: boolean; onClick: () => void; title?: string; children: React.ReactNode;
}) {
  return (
    <button
      type="button" onClick={onClick} title={title}
      className={`px-3 py-2 rounded-lg text-[13px] font-medium border transition-colors ${
        active ? "bg-cy-400/15 text-cy-300 border-cy-400/40" : "border-line-800 text-ink-300 hover:text-ink-50 hover:border-line-700"
      }`}
    >
      {children}
    </button>
  );
}

function FileBtn({ id, onFile, label }: { id: string; onFile: (f: File | undefined) => void; label: string }) {
  return (
    <>
      <input id={id} type="file" accept="image/png,image/jpeg,image/webp" className="hidden"
        onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ""; }} />
      <label htmlFor={id} className="btn btn-ghost cursor-pointer text-[13px]">{label}</label>
    </>
  );
}
