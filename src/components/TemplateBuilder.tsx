"use client";

import { useEffect, useRef, useState } from "react";

export type TemplateSpec = {
  preset: "glow" | "bold" | "minimal";
  headline: string;
  subline: string;
  accent: string; // hex
};

const PRESETS: { id: TemplateSpec["preset"]; label: string; hint: string }[] = [
  { id: "glow", label: "Glow", hint: "Dark, neon, night-street energy" },
  { id: "bold", label: "Bold", hint: "Full accent background, giant type" },
  { id: "minimal", label: "Minimal", hint: "Quiet, premium, lots of air" },
];

export const CANVAS_W = 1080;
export const CANVAS_H = 1920;

/** Draw the template onto any 2D context at 1080x1920. Shared by preview and export. */
export function drawTemplate(ctx: CanvasRenderingContext2D, spec: TemplateSpec) {
  const { preset, accent } = spec;
  const headline = spec.headline.trim() || "Your headline";
  const subline = spec.subline.trim();

  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

  // Background
  if (preset === "bold") {
    ctx.fillStyle = accent;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  } else {
    const g = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
    if (preset === "glow") {
      g.addColorStop(0, "#070b14");
      g.addColorStop(1, "#0d1524");
    } else {
      g.addColorStop(0, "#f7f6f2");
      g.addColorStop(1, "#eceae3");
    }
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  }

  // Accent flourishes
  if (preset === "glow") {
    const r = ctx.createRadialGradient(CANVAS_W / 2, CANVAS_H * 0.78, 50, CANVAS_W / 2, CANVAS_H * 0.78, 700);
    r.addColorStop(0, hexA(accent, 0.5));
    r.addColorStop(1, hexA(accent, 0));
    ctx.fillStyle = r;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.strokeStyle = hexA(accent, 0.9);
    ctx.lineWidth = 10;
    ctx.strokeRect(45, 45, CANVAS_W - 90, CANVAS_H - 90);
  } else if (preset === "minimal") {
    ctx.fillStyle = accent;
    ctx.fillRect(0, CANVAS_H * 0.62, CANVAS_W, 14);
  }

  // Text colors
  const fg = preset === "minimal" ? "#12151c" : "#ffffff";
  const sub = preset === "minimal" ? "#4b5563" : "rgba(255,255,255,0.82)";

  // Headline with wrapping
  ctx.fillStyle = fg;
  ctx.textAlign = "center";
  let size = preset === "bold" ? 150 : 128;
  ctx.font = `800 ${size}px system-ui, -apple-system, 'Segoe UI', sans-serif`;
  let lines = wrap(ctx, headline.toUpperCase(), CANVAS_W - 200);
  while (lines.length > 4 && size > 72) {
    size -= 12;
    ctx.font = `800 ${size}px system-ui, -apple-system, 'Segoe UI', sans-serif`;
    lines = wrap(ctx, headline.toUpperCase(), CANVAS_W - 200);
  }
  const lineH = size * 1.08;
  const blockH = lines.length * lineH;
  let y = CANVAS_H * 0.45 - blockH / 2 + lineH * 0.8;
  if (preset === "glow") {
    ctx.shadowColor = hexA(accent, 0.85);
    ctx.shadowBlur = 40;
  }
  lines.forEach((ln) => {
    ctx.fillText(ln, CANVAS_W / 2, y);
    y += lineH;
  });
  ctx.shadowBlur = 0;

  // Subline
  if (subline) {
    ctx.fillStyle = sub;
    ctx.font = `500 52px system-ui, -apple-system, 'Segoe UI', sans-serif`;
    const subLines = wrap(ctx, subline, CANVAS_W - 240);
    let sy = y + 30;
    subLines.slice(0, 3).forEach((ln) => {
      ctx.fillText(ln, CANVAS_W / 2, sy);
      sy += 66;
    });
  }

  // Glo watermark
  ctx.fillStyle = preset === "minimal" ? "#9ca3af" : "rgba(255,255,255,0.55)";
  ctx.font = `600 34px system-ui, -apple-system, 'Segoe UI', sans-serif`;
  ctx.fillText("glo · we-are-glo.com", CANVAS_W / 2, CANVAS_H - 80);
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

function hexA(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(full, 16);
  if (Number.isNaN(n)) return `rgba(34,211,238,${alpha})`;
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

export async function renderTemplatePng(spec: TemplateSpec): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = CANVAS_W;
  canvas.height = CANVAS_H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  drawTemplate(ctx, spec);
  return await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("PNG export failed"))), "image/png")
  );
}

export function TemplateBuilder({
  spec,
  onChange,
}: {
  spec: TemplateSpec;
  onChange: (s: TemplateSpec) => void;
}) {
  const previewRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const canvas = previewRef.current;
    if (!canvas) return;
    canvas.width = CANVAS_W;
    canvas.height = CANVAS_H;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    drawTemplate(ctx, spec);
    setReady(true);
  }, [spec]);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
      <div className="space-y-4">
        <div>
          <label className="block text-xs uppercase tracking-wider text-ink-400 mb-1.5">Style</label>
          <div className="flex gap-2">
            {PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => onChange({ ...spec, preset: p.id })}
                title={p.hint}
                className={`px-3 py-2 rounded-lg text-[13px] font-medium border transition-colors ${
                  spec.preset === p.id
                    ? "bg-cy-400/15 text-cy-300 border-cy-400/40"
                    : "border-line-800 text-ink-300 hover:text-ink-50 hover:border-line-700"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-xs uppercase tracking-wider text-ink-400 mb-1.5">Headline</label>
          <input
            type="text"
            maxLength={60}
            value={spec.headline}
            onChange={(e) => onChange({ ...spec, headline: e.target.value })}
            placeholder="Friday Night Special"
            className="w-full px-3 py-2.5 rounded-lg bg-bg-900 border border-line-800 text-ink-50 focus:border-cy-400 focus:outline-none focus:ring-2 focus:ring-cy-400/20 placeholder-ink-500"
          />
        </div>
        <div>
          <label className="block text-xs uppercase tracking-wider text-ink-400 mb-1.5">Subline (optional)</label>
          <input
            type="text"
            maxLength={90}
            value={spec.subline}
            onChange={(e) => onChange({ ...spec, subline: e.target.value })}
            placeholder="Every Friday from 6pm · 142 Bedford Ave"
            className="w-full px-3 py-2.5 rounded-lg bg-bg-900 border border-line-800 text-ink-50 focus:border-cy-400 focus:outline-none focus:ring-2 focus:ring-cy-400/20 placeholder-ink-500"
          />
        </div>
        <div>
          <label className="block text-xs uppercase tracking-wider text-ink-400 mb-1.5">Accent color</label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={spec.accent}
              onChange={(e) => onChange({ ...spec, accent: e.target.value })}
              className="h-10 w-14 rounded-md border border-line-800 bg-bg-900 p-1 cursor-pointer"
              aria-label="Accent color"
            />
            <span className="text-[13px] text-ink-400 font-mono">{spec.accent}</span>
          </div>
        </div>
        <p className="text-[11px] text-ink-500">
          Exports a 1080×1920 portrait image. Glo auto-fits it to each screen at delivery.
        </p>
      </div>

      <div>
        <div className="text-xs uppercase tracking-wider text-ink-400 mb-1.5">Live preview</div>
        <div className="rounded-lg border border-line-800 bg-bg-900 p-3 flex justify-center">
          <canvas
            ref={previewRef}
            className="w-full max-w-[220px] h-auto rounded-md"
            style={{ aspectRatio: "9/16" }}
            aria-label="Template preview"
          />
        </div>
        {!ready && <p className="text-[11px] text-ink-500 mt-2">Rendering…</p>}
      </div>
    </div>
  );
}
