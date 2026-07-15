"use client";

import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";

export type FontId = "modern" | "editorial" | "typewriter";

export type TemplateSpec = {
  preset: "glow" | "bold" | "minimal" | "photo";
  headline: string;
  subline: string;
  accent: string; // hex
  font?: FontId;
  offer?: string;           // starburst badge, e.g. "20% OFF"
  cta?: string;             // footer bar text
  qrUrl?: string;           // renders a scannable QR in the footer
  bgImage?: string | null;  // dataURL background photo (photo preset)
  logoImage?: string | null; // dataURL logo drawn at the top
};

const PRESETS: { id: TemplateSpec["preset"]; label: string; hint: string }[] = [
  { id: "glow", label: "Glow", hint: "Dark, neon, night-street energy" },
  { id: "bold", label: "Bold", hint: "Full accent background, giant type" },
  { id: "minimal", label: "Minimal", hint: "Quiet, premium, lots of air" },
  { id: "photo", label: "Photo", hint: "Your photo as the backdrop" },
];

const FONTS: { id: FontId; label: string; stack: string; upper: boolean }[] = [
  { id: "modern", label: "Modern", stack: "system-ui, -apple-system, 'Segoe UI', sans-serif", upper: true },
  { id: "editorial", label: "Editorial", stack: "Georgia, 'Times New Roman', serif", upper: false },
  { id: "typewriter", label: "Typewriter", stack: "'Courier New', Courier, monospace", upper: true },
];

const SWATCHES = ["#22D3EE", "#A3E635", "#F472B6", "#FBBF24", "#A78BFA", "#F87171"];

export const CANVAS_W = 1080;
export const CANVAS_H = 1920;
const MAX_IMG_MB = 4;

function fontOf(spec: TemplateSpec) {
  return FONTS.find((f) => f.id === (spec.font ?? "modern")) ?? FONTS[0];
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/** Cover-fit an image into a rect. */
function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const scale = Math.max(w / img.width, h / img.height);
  const dw = img.width * scale;
  const dh = img.height * scale;
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

/** Contain-fit an image into a rect, centered. */
function drawContain(ctx: CanvasRenderingContext2D, img: HTMLImageElement, cx: number, cy: number, maxW: number, maxH: number) {
  const scale = Math.min(maxW / img.width, maxH / img.height, 1.5);
  const dw = img.width * scale;
  const dh = img.height * scale;
  ctx.drawImage(img, cx - dw / 2, cy - dh / 2, dw, dh);
}

/** Draw the template onto any 2D context at 1080x1920. Shared by preview and export. */
export async function drawTemplate(ctx: CanvasRenderingContext2D, spec: TemplateSpec) {
  const { preset, accent } = spec;
  const font = fontOf(spec);
  const headlineRaw = spec.headline.trim() || "Your headline";
  const headline = font.upper ? headlineRaw.toUpperCase() : headlineRaw;
  const subline = spec.subline.trim();
  const offer = (spec.offer ?? "").trim();
  const cta = (spec.cta ?? "").trim();
  const qrUrl = (spec.qrUrl ?? "").trim();
  const hasFooter = Boolean(cta || qrUrl);
  const onPhoto = preset === "photo";

  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

  // ---- Background
  const bgImg = onPhoto && spec.bgImage ? await loadImage(spec.bgImage) : null;
  if (onPhoto && bgImg) {
    drawCover(ctx, bgImg, 0, 0, CANVAS_W, CANVAS_H);
    const scrim = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
    scrim.addColorStop(0, "rgba(4,7,13,0.35)");
    scrim.addColorStop(0.45, "rgba(4,7,13,0.15)");
    scrim.addColorStop(1, "rgba(4,7,13,0.85)");
    ctx.fillStyle = scrim;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  } else if (preset === "bold") {
    ctx.fillStyle = accent;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  } else {
    const g = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
    if (preset === "minimal") {
      g.addColorStop(0, "#f7f6f2");
      g.addColorStop(1, "#eceae3");
    } else {
      // glow, and photo without an image
      g.addColorStop(0, "#070b14");
      g.addColorStop(1, "#0d1524");
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

  // ---- Foreground colors
  const dark = preset === "minimal" && !onPhoto;
  const fg = dark ? "#12151c" : "#ffffff";
  const sub = dark ? "#4b5563" : "rgba(255,255,255,0.85)";

  // ---- Logo (top center)
  if (spec.logoImage) {
    const logo = await loadImage(spec.logoImage);
    if (logo) {
      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,0.45)";
      ctx.shadowBlur = onPhoto ? 24 : 0;
      drawContain(ctx, logo, CANVAS_W / 2, 230, 420, 220);
      ctx.restore();
    }
  }

  // ---- Headline (auto-fit, wraps)
  ctx.fillStyle = fg;
  ctx.textAlign = "center";
  let size = preset === "bold" ? 150 : 128;
  ctx.font = `800 ${size}px ${font.stack}`;
  let lines = wrap(ctx, headline, CANVAS_W - 200);
  while (lines.length > 4 && size > 72) {
    size -= 12;
    ctx.font = `800 ${size}px ${font.stack}`;
    lines = wrap(ctx, headline, CANVAS_W - 200);
  }
  const lineH = size * 1.08;
  const blockH = lines.length * lineH;
  const centerY = hasFooter ? 0.42 : 0.45;
  let y = CANVAS_H * centerY - blockH / 2 + lineH * 0.8;
  ctx.save();
  if (preset === "glow") {
    ctx.shadowColor = hexA(accent, 0.85);
    ctx.shadowBlur = 40;
  } else if (onPhoto) {
    ctx.shadowColor = "rgba(0,0,0,0.65)";
    ctx.shadowBlur = 28;
  }
  lines.forEach((ln) => {
    ctx.fillText(ln, CANVAS_W / 2, y);
    y += lineH;
  });
  ctx.restore();

  // ---- Subline
  if (subline) {
    ctx.fillStyle = sub;
    ctx.font = `500 52px ${font.stack}`;
    ctx.save();
    if (onPhoto) { ctx.shadowColor = "rgba(0,0,0,0.6)"; ctx.shadowBlur = 18; }
    const subLines = wrap(ctx, subline, CANVAS_W - 240);
    let sy = y + 30;
    subLines.slice(0, 3).forEach((ln) => {
      ctx.fillText(ln, CANVAS_W / 2, sy);
      sy += 66;
    });
    ctx.restore();
  }

  // ---- Offer starburst (top-right)
  if (offer) {
    const cx = 860;
    const cy = spec.logoImage ? 560 : 460;
    const R = 168;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-0.21);
    // 16-point star
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
    ctx.fillStyle = preset === "bold" ? "#0b0e14" : accent;
    ctx.shadowColor = "rgba(0,0,0,0.4)";
    ctx.shadowBlur = 22;
    ctx.fill();
    ctx.shadowBlur = 0;
    // badge text: split into up to 2 lines
    const badgeFg = preset === "bold" ? accent : "#0b0e14";
    ctx.fillStyle = badgeFg;
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
  }

  // ---- Footer bar: CTA + QR
  const footerTop = 1560;
  const footerH = 210;
  if (hasFooter) {
    ctx.fillStyle = preset === "bold" ? "#0b0e14" : accent;
    ctx.fillRect(0, footerTop, CANVAS_W, footerH);

    const footFg = preset === "bold" ? "#ffffff" : "#0b0e14";
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
        qrCard = 0; // invalid QR content: draw text only
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
    ctx.textAlign = "center";
  }

  // ---- Glo watermark
  ctx.fillStyle = dark ? "#9ca3af" : "rgba(255,255,255,0.55)";
  ctx.font = `600 34px system-ui, -apple-system, 'Segoe UI', sans-serif`;
  ctx.textAlign = "center";
  ctx.fillText("glo \u00b7 we-are-glo.com", CANVAS_W / 2, CANVAS_H - 60);
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

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
      <div className="space-y-4">
        <div>
          <label className="block text-xs uppercase tracking-wider text-ink-400 mb-1.5">Style</label>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <Chip key={p.id} active={spec.preset === p.id} title={p.hint} onClick={() => onChange({ ...spec, preset: p.id })}>
                {p.label}
              </Chip>
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
            placeholder="Every Friday from 6pm \u00b7 142 Bedford Ave"
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

        {imgErr && <p className="text-sm text-red-400">{imgErr}</p>}
        <p className="text-[11px] text-ink-500">
          Exports a 1080\u00d71920 portrait image. Glo auto-fits it to each screen at delivery.
        </p>
      </div>

      <div>
        <div className="text-xs uppercase tracking-wider text-ink-400 mb-1.5">Live preview</div>
        <div className="rounded-lg border border-line-800 bg-bg-900 p-3 flex justify-center sm:sticky sm:top-4">
          <canvas
            ref={previewRef}
            className="w-full max-w-[240px] h-auto rounded-md"
            style={{ aspectRatio: "9/16" }}
            aria-label="Template preview"
          />
        </div>
        {!ready && <p className="text-[11px] text-ink-500 mt-2">Rendering\u2026</p>}
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
