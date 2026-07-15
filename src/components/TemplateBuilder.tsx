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

type TemplateDef = {
  id: TemplateId;
  label: string;
  hint: string;
  layout: Layout;
  fontDefault: FontId;
  accentDefault: string;
  darkText: boolean;   // headline/sub in near-black instead of white
  grain: number;       // 0..1 film grain strength
  paint: (ctx: CanvasRenderingContext2D, spec: TemplateSpec) => void;
};

const FONTS: { id: FontId; label: string; stack: string; upper: boolean }[] = [
  { id: "modern", label: "Modern", stack: "system-ui, -apple-system, 'Segoe UI', sans-serif", upper: true },
  { id: "editorial", label: "Editorial", stack: "Georgia, 'Times New Roman', serif", upper: false },
  { id: "typewriter", label: "Typewriter", stack: "'Courier New', Courier, monospace", upper: true },
];

const SWATCHES = ["#22D3EE", "#A3E635", "#F472B6", "#FBBF24", "#A78BFA", "#F87171"];

export const CANVAS_W = 1080;
export const CANVAS_H = 1920;
const MAX_IMG_MB = 4;

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

function grainOverlay(ctx: CanvasRenderingContext2D, strength: number) {
  if (strength <= 0) return;
  const gw = 180, gh = 320;
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
  ctx.drawImage(off, 0, 0, CANVAS_W, CANVAS_H);
  ctx.restore();
}

function orb(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, alpha: number) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, hexA(color, alpha));
  g.addColorStop(1, hexA(color, 0));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
}

function darkGradient(ctx: CanvasRenderingContext2D, top: string, bottom: string) {
  const g = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
  g.addColorStop(0, top);
  g.addColorStop(1, bottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
}

/* ---------------- template catalog ---------------- */

const TEMPLATES: TemplateDef[] = [
  {
    id: "glow", label: "Neon", hint: "Dark, neon, night-street energy",
    layout: "center", fontDefault: "modern", accentDefault: "#22D3EE", darkText: false, grain: 0.06,
    paint: (ctx, spec) => {
      darkGradient(ctx, "#070b14", "#0d1524");
      orb(ctx, CANVAS_W / 2, CANVAS_H * 0.78, 700, spec.accent, 0.5);
      ctx.strokeStyle = hexA(spec.accent, 0.9);
      ctx.lineWidth = 10;
      ctx.strokeRect(45, 45, CANVAS_W - 90, CANVAS_H - 90);
    },
  },
  {
    id: "midnight", label: "Midnight", hint: "Deep black, soft glow orbs, grain",
    layout: "center", fontDefault: "modern", accentDefault: "#A78BFA", darkText: false, grain: 0.09,
    paint: (ctx, spec) => {
      darkGradient(ctx, "#04060b", "#090d16");
      orb(ctx, CANVAS_W * 0.85, CANVAS_H * 0.16, 560, spec.accent, 0.45);
      orb(ctx, CANVAS_W * 0.1, CANVAS_H * 0.9, 640, shiftHue(spec.accent, 40), 0.28);
      ctx.strokeStyle = hexA("#ffffff", 0.14);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(CANVAS_W * 0.85, CANVAS_H * 0.16, 250, 0, Math.PI * 2);
      ctx.stroke();
    },
  },
  {
    id: "mesh", label: "Mesh", hint: "Blurry gradient blobs, very now",
    layout: "center", fontDefault: "modern", accentDefault: "#F472B6", darkText: false, grain: 0.07,
    paint: (ctx, spec) => {
      darkGradient(ctx, "#0a0a12", "#12101c");
      orb(ctx, CANVAS_W * 0.2, CANVAS_H * 0.22, 620, spec.accent, 0.6);
      orb(ctx, CANVAS_W * 0.9, CANVAS_H * 0.45, 560, shiftHue(spec.accent, 60), 0.5);
      orb(ctx, CANVAS_W * 0.4, CANVAS_H * 0.9, 700, shiftHue(spec.accent, -50), 0.45);
      orb(ctx, CANVAS_W * 0.75, CANVAS_H * 0.8, 380, "#ffffff", 0.1);
    },
  },
  {
    id: "sunset", label: "Sunset", hint: "Warm gradient, sun disc, horizon",
    layout: "center", fontDefault: "editorial", accentDefault: "#FBBF24", darkText: false, grain: 0.08,
    paint: (ctx, spec) => {
      const g = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
      g.addColorStop(0, shiftHue(spec.accent, -18));
      g.addColorStop(0.55, shiftHue(spec.accent, 12));
      g.addColorStop(1, "#100a14");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      // sun disc
      ctx.fillStyle = hexA("#ffffff", 0.85);
      ctx.beginPath();
      ctx.arc(CANVAS_W / 2, CANVAS_H * 0.3, 200, 0, Math.PI * 2);
      ctx.fill();
      orb(ctx, CANVAS_W / 2, CANVAS_H * 0.3, 480, "#ffffff", 0.35);
      // horizon lines
      ctx.strokeStyle = hexA("#100a14", 0.35);
      ctx.lineWidth = 4;
      for (let i = 0; i < 5; i++) {
        const y = CANVAS_H * 0.30 + 60 + i * 26;
        ctx.beginPath(); ctx.moveTo(CANVAS_W / 2 - 210, y); ctx.lineTo(CANVAS_W / 2 + 210, y); ctx.stroke();
      }
    },
  },
  {
    id: "poster", label: "Poster", hint: "Swiss grid, giant type, diagonal band",
    layout: "left", fontDefault: "modern", accentDefault: "#F87171", darkText: true, grain: 0.05,
    paint: (ctx, spec) => {
      ctx.fillStyle = "#f2efe8";
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      // diagonal accent band
      ctx.save();
      ctx.translate(CANVAS_W * 0.72, CANVAS_H * 0.2);
      ctx.rotate(0.5);
      ctx.fillStyle = spec.accent;
      ctx.fillRect(-140, -900, 240, 2400);
      ctx.restore();
      // grid ticks
      ctx.strokeStyle = "rgba(18,21,28,0.25)";
      ctx.lineWidth = 3;
      for (let x = 90; x < CANVAS_W; x += 150) {
        ctx.beginPath(); ctx.moveTo(x, 70); ctx.lineTo(x, 100); ctx.stroke();
      }
      // index number
      ctx.fillStyle = "#12151c";
      ctx.font = "800 64px system-ui, -apple-system, 'Segoe UI', sans-serif";
      ctx.textAlign = "right";
      ctx.fillText("N\u00ba 01", CANVAS_W - 80, 140);
      ctx.textAlign = "center";
    },
  },
  {
    id: "ticket", label: "Ticket", hint: "Perforated coupon, redeem energy",
    layout: "center", fontDefault: "typewriter", accentDefault: "#A3E635", darkText: false, grain: 0.07,
    paint: (ctx, spec) => {
      darkGradient(ctx, "#0b0e14", "#11151d");
      // outer accent frame
      ctx.strokeStyle = spec.accent;
      ctx.lineWidth = 14;
      ctx.strokeRect(60, 60, CANVAS_W - 120, CANVAS_H - 120);
      ctx.strokeStyle = hexA(spec.accent, 0.5);
      ctx.lineWidth = 3;
      ctx.strokeRect(92, 92, CANVAS_W - 184, CANVAS_H - 184);
      // perforation dots down both sides
      ctx.fillStyle = "#04070d";
      for (let y = 140; y < CANVAS_H - 120; y += 88) {
        ctx.beginPath(); ctx.arc(60, y, 20, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(CANVAS_W - 60, y, 20, 0, Math.PI * 2); ctx.fill();
      }
      // rotated side label
      ctx.save();
      ctx.translate(150, CANVAS_H / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.fillStyle = hexA(spec.accent, 0.85);
      ctx.font = "700 40px 'Courier New', Courier, monospace";
      ctx.textAlign = "center";
      ctx.fillText("\u2022 ADMIT ONE \u2022 GLO STREET PASS \u2022", 0, 0);
      ctx.restore();
      ctx.textAlign = "center";
      // dashed divider above footer zone
      ctx.strokeStyle = hexA("#ffffff", 0.35);
      ctx.lineWidth = 4;
      ctx.setLineDash([18, 16]);
      ctx.beginPath(); ctx.moveTo(140, 1500); ctx.lineTo(CANVAS_W - 140, 1500); ctx.stroke();
      ctx.setLineDash([]);
    },
  },
  {
    id: "paper", label: "Paper", hint: "Warm editorial, serif, quiet luxury",
    layout: "center", fontDefault: "editorial", accentDefault: "#F87171", darkText: true, grain: 0.05,
    paint: (ctx, spec) => {
      const g = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
      g.addColorStop(0, "#faf7f0");
      g.addColorStop(1, "#efe9dc");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      // double rules
      ctx.strokeStyle = "#12151c";
      ctx.lineWidth = 6;
      ctx.beginPath(); ctx.moveTo(120, 170); ctx.lineTo(CANVAS_W - 120, 170); ctx.stroke();
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(120, 190); ctx.lineTo(CANVAS_W - 120, 190); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(120, CANVAS_H - 190); ctx.lineTo(CANVAS_W - 120, CANVAS_H - 190); ctx.stroke();
      ctx.lineWidth = 6;
      ctx.beginPath(); ctx.moveTo(120, CANVAS_H - 170); ctx.lineTo(CANVAS_W - 120, CANVAS_H - 170); ctx.stroke();
      // wax seal dot
      ctx.fillStyle = spec.accent;
      ctx.beginPath(); ctx.arc(CANVAS_W / 2, 285, 26, 0, Math.PI * 2); ctx.fill();
    },
  },
  {
    id: "bold", label: "Bold", hint: "Full accent background, giant type",
    layout: "center", fontDefault: "modern", accentDefault: "#A3E635", darkText: true, grain: 0.05,
    paint: (ctx, spec) => {
      ctx.fillStyle = spec.accent;
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      // halftone dot corner
      ctx.fillStyle = hexA("#0b0e14", 0.35);
      for (let row = 0; row < 9; row++) {
        for (let col = 0; col < 9 - row; col++) {
          const r = 6 + row * 1.2;
          ctx.beginPath();
          ctx.arc(70 + col * 46, CANVAS_H - 70 - row * 46, r, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    },
  },
  {
    id: "minimal", label: "Minimal", hint: "Quiet, premium, lots of air",
    layout: "center", fontDefault: "modern", accentDefault: "#22D3EE", darkText: true, grain: 0,
    paint: (ctx, spec) => {
      const g = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
      g.addColorStop(0, "#f7f6f2");
      g.addColorStop(1, "#eceae3");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      ctx.fillStyle = spec.accent;
      ctx.fillRect(0, CANVAS_H * 0.62, CANVAS_W, 14);
    },
  },
  {
    id: "photo", label: "Photo", hint: "Your photo, cinematic scrim",
    layout: "lower", fontDefault: "modern", accentDefault: "#22D3EE", darkText: false, grain: 0.06,
    paint: (ctx) => {
      // photo painted separately (async); fallback:
      darkGradient(ctx, "#070b14", "#0d1524");
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

function drawContain(ctx: CanvasRenderingContext2D, img: HTMLImageElement, cx: number, cy: number, maxW: number, maxH: number) {
  const scale = Math.min(maxW / img.width, maxH / img.height, 1.5);
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

/** Draw the template onto any 2D context at 1080x1920. Shared by preview and export. */
export async function drawTemplate(ctx: CanvasRenderingContext2D, spec: TemplateSpec) {
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

  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

  // ---- Background
  const bgImg = onPhoto && spec.bgImage ? await loadImage(spec.bgImage) : null;
  if (onPhoto && bgImg) {
    drawCover(ctx, bgImg, 0, 0, CANVAS_W, CANVAS_H);
    const scrim = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
    scrim.addColorStop(0, "rgba(4,7,13,0.35)");
    scrim.addColorStop(0.45, "rgba(4,7,13,0.15)");
    scrim.addColorStop(1, "rgba(4,7,13,0.88)");
    ctx.fillStyle = scrim;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  } else {
    tpl.paint(ctx, spec);
  }

  // ---- Foreground colors
  const darkText = tpl.darkText && !(onPhoto && bgImg);
  const fg = darkText ? "#12151c" : "#ffffff";
  const sub = darkText ? "#4b5563" : "rgba(255,255,255,0.85)";
  const leftAlign = tpl.layout === "left";
  const anchorX = leftAlign ? 90 : CANVAS_W / 2;
  ctx.textAlign = leftAlign ? "left" : "center";

  // ---- Logo (top center / top left)
  if (spec.logoImage) {
    const logo = await loadImage(spec.logoImage);
    if (logo) {
      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,0.45)";
      ctx.shadowBlur = darkText ? 0 : 24;
      drawContain(ctx, logo, leftAlign ? 90 + 160 : CANVAS_W / 2, 250, 380, 200);
      ctx.restore();
    }
  }

  // ---- Text block position
  let centerFrac = 0.45;
  if (hasFooter) centerFrac = 0.42;
  if (tpl.layout === "lower") centerFrac = hasFooter ? 0.56 : 0.62;
  if (tpl.layout === "left") centerFrac = 0.44;

  // ---- Headline (auto-fit, wraps)
  ctx.fillStyle = fg;
  let size = tpl.id === "bold" || tpl.id === "poster" ? 150 : 128;
  const maxTextW = leftAlign ? CANVAS_W - 180 : CANVAS_W - 200;
  ctx.font = `800 ${size}px ${font.stack}`;
  let lines = wrap(ctx, headline, maxTextW);
  while (lines.length > 4 && size > 72) {
    size -= 12;
    ctx.font = `800 ${size}px ${font.stack}`;
    lines = wrap(ctx, headline, maxTextW);
  }
  const lineH = size * 1.08;
  const blockH = lines.length * lineH;
  let y = CANVAS_H * centerFrac - blockH / 2 + lineH * 0.8;

  // ---- Kicker above the headline
  if (kicker) {
    ctx.save();
    ctx.fillStyle = darkText ? tpl.accentDefault && spec.accent ? spec.accent : "#12151c" : hexA("#ffffff", 0.9);
    if (!darkText) ctx.fillStyle = spec.accent;
    ctx.font = `700 40px ${font.stack}`;
    const tracked = kicker.split("").join("\u200a\u200a");
    ctx.fillText(tracked, anchorX, y - lineH * 0.9 - 26);
    ctx.restore();
  }

  ctx.save();
  if (tpl.id === "glow" || tpl.id === "midnight" || tpl.id === "mesh") {
    ctx.shadowColor = hexA(spec.accent, 0.85);
    ctx.shadowBlur = 40;
  } else if (onPhoto && bgImg) {
    ctx.shadowColor = "rgba(0,0,0,0.65)";
    ctx.shadowBlur = 28;
  }
  ctx.fillStyle = fg;
  ctx.font = `800 ${size}px ${font.stack}`;
  lines.forEach((ln) => {
    ctx.fillText(ln, anchorX, y);
    y += lineH;
  });
  ctx.restore();

  // ---- Subline
  if (subline) {
    ctx.fillStyle = sub;
    ctx.font = `500 52px ${font.stack}`;
    ctx.save();
    if (onPhoto && bgImg) { ctx.shadowColor = "rgba(0,0,0,0.6)"; ctx.shadowBlur = 18; }
    const subLines = wrap(ctx, subline, maxTextW - 40);
    let sy = y + 30;
    subLines.slice(0, 3).forEach((ln) => {
      ctx.fillText(ln, anchorX, sy);
      sy += 66;
    });
    ctx.restore();
  }

  // ---- Offer starburst (top-right)
  if (offer) {
    const cx = 860;
    const cy = spec.logoImage ? 590 : 480;
    const R = 168;
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
    ctx.shadowBlur = 22;
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
    let bs = 64;
    ctx.font = `800 ${bs}px ${font.stack}`;
    while ((ctx.measureText(l1).width > R * 1.5 || ctx.measureText(l2).width > R * 1.5) && bs > 30) {
      bs -= 4;
      ctx.font = `800 ${bs}px ${font.stack}`;
    }
    if (l2) {
      ctx.fillText(l1, 0, -8);
      ctx.fillText(l2, 0, bs * 1.02);
    } else {
      ctx.fillText(l1, 0, bs * 0.35);
    }
    ctx.restore();
    ctx.textAlign = leftAlign ? "left" : "center";
  }

  // ---- Footer bar: CTA + QR
  const footerTop = 1560;
  const footerH = 210;
  if (hasFooter) {
    const footBg = tpl.id === "bold" ? "#0b0e14" : spec.accent;
    const footFg = tpl.id === "bold" ? "#ffffff" : "#0b0e14";
    ctx.fillStyle = footBg;
    ctx.fillRect(0, footerTop, CANVAS_W, footerH);

    let qrCard = 0;
    if (qrUrl) {
      qrCard = 170;
      try {
        const qrData = await QRCode.toDataURL(qrUrl, {
          width: 320, margin: 1, errorCorrectionLevel: "M",
          color: { dark: "#0b0e14", light: "#ffffff" },
        });
        const qrImg = await loadImage(qrData);
        if (qrImg) {
          const pad = 12;
          const cardX = CANVAS_W - 70 - qrCard;
          const cardY = footerTop + (footerH - qrCard) / 2;
          ctx.fillStyle = "#ffffff";
          roundRect(ctx, cardX - pad, cardY - pad, qrCard + pad * 2, qrCard + pad * 2, 16);
          ctx.fill();
          ctx.drawImage(qrImg, cardX, cardY, qrCard, qrCard);
        }
      } catch {
        qrCard = 0;
      }
    }

    const textMaxW = CANVAS_W - 140 - (qrCard ? qrCard + 90 : 0);
    const ctaText = cta || "Scan for the offer";
    ctx.fillStyle = footFg;
    ctx.textAlign = "left";
    let cs = 56;
    ctx.font = `800 ${cs}px ${font.stack}`;
    let ctaLines = wrap(ctx, font.upper ? ctaText.toUpperCase() : ctaText, textMaxW);
    while (ctaLines.length > 2 && cs > 34) {
      cs -= 4;
      ctx.font = `800 ${cs}px ${font.stack}`;
      ctaLines = wrap(ctx, font.upper ? ctaText.toUpperCase() : ctaText, textMaxW);
    }
    ctaLines = ctaLines.slice(0, 2);
    const ctaBlockH = ctaLines.length * cs * 1.15;
    let cy2 = footerTop + footerH / 2 - ctaBlockH / 2 + cs * 0.85;
    ctaLines.forEach((ln) => {
      ctx.fillText(ln, 70, cy2);
      cy2 += cs * 1.15;
    });
  }

  // ---- Film grain
  grainOverlay(ctx, tpl.grain);

  // ---- Glo watermark
  ctx.fillStyle = darkText ? "#9ca3af" : "rgba(255,255,255,0.55)";
  ctx.font = `600 34px system-ui, -apple-system, 'Segoe UI', sans-serif`;
  ctx.textAlign = "center";
  ctx.fillText("glo \u00b7 we-are-glo.com", CANVAS_W / 2, CANVAS_H - 60);
}

export async function renderTemplatePng(spec: TemplateSpec): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = CANVAS_W;
  canvas.height = CANVAS_H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  await drawTemplate(ctx, spec);
  return await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("PNG export failed"))), "image/png")
  );
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

function TemplateThumb({ tpl, active, accent, onClick }: {
  tpl: TemplateDef; active: boolean; accent: string; onClick: () => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    canvas.width = CANVAS_W / 4;
    canvas.height = CANVAS_H / 4;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(0.25, 0.25);
    const sample: TemplateSpec = {
      preset: tpl.id,
      headline: "Friday Night",
      subline: "",
      accent: active ? accent : tpl.accentDefault,
      font: tpl.fontDefault,
    };
    drawTemplate(ctx, sample);
  }, [tpl, active, accent]);
  return (
    <button
      type="button"
      onClick={onClick}
      title={tpl.hint}
      className={`text-left rounded-lg overflow-hidden border transition-all ${
        active ? "border-cy-400/70 shadow-glow-cy scale-[1.02]" : "border-line-800 hover:border-line-600"
      }`}
    >
      <canvas ref={ref} className="w-full h-auto block" style={{ aspectRatio: "9/16" }} />
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
  const seq = useRef(0);
  const font = fontOf(spec);
  const tpl = templateOf(spec);

  useEffect(() => {
    const canvas = previewRef.current;
    if (!canvas) return;
    canvas.width = CANVAS_W;
    canvas.height = CANVAS_H;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const mySeq = ++seq.current;
    drawTemplate(ctx, spec).then(() => {
      if (mySeq === seq.current) setReady(true);
    });
  }, [spec]);

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
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-6">
      <div className="space-y-5">
        <div>
          <label className="block text-xs uppercase tracking-wider text-ink-400 mb-2">Template</label>
          <div className="grid grid-cols-5 gap-2">
            {TEMPLATES.map((t) => (
              <TemplateThumb key={t.id} tpl={t} active={spec.preset === t.id} accent={spec.accent} onClick={() => pickTemplate(t)} />
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
        </p>
      </div>

      <div>
        <div className="text-xs uppercase tracking-wider text-ink-400 mb-1.5">Live preview</div>
        <div className="rounded-lg border border-line-800 bg-bg-900 p-3 flex justify-center lg:sticky lg:top-4">
          <canvas
            ref={previewRef}
            className="w-full max-w-[240px] h-auto rounded-md"
            style={{ aspectRatio: "9/16" }}
            aria-label="Template preview"
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
