"use client";

/**
 * Glo Creative Studio — preview-first redesign (design system v1).
 * 62% live 9:16 preview / 38% collapsible form. Edits reflect instantly.
 * Palette strictly on Glo tokens (bg/ink/line ramps, cyan primary, lime charge).
 *
 * TODO(wire-up):
 *  - QrBadge -> existing DOOH QR generator
 *  - "Save to Library" -> creatives API / Supabase
 *  - Logo dropzone -> asset upload
 *  - Video mode -> ingest flow (/studio/ingest/*) for real Reels
 */

import Link from "next/link";
import React, { useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronUp,
  Image as ImageIcon,
  Info,
  Link2,
  Play,
  Sparkles,
  Upload,
  Video,
} from "lucide-react";

const TYPEFACES: Record<string, string> = {
  Modern: "Inter, system-ui, sans-serif",
  Editorial: "Georgia, 'Times New Roman', serif",
  Typewriter: "'JetBrains Mono', ui-monospace, monospace",
};
const TYPEFACE_HINT: Record<string, string> = {
  Modern: "clean sans",
  Editorial: "serif display",
  Typewriter: "mono",
};

/* Glo palette only — lime charge, cyan accent + tints, white. */
const SWATCHES = [
  { name: "Lime", hex: "#BEF264" },
  { name: "Cyan", hex: "#22D3EE" },
  { name: "Sky", hex: "#4DE2F0" },
  { name: "Ice", hex: "#C2F6FB" },
  { name: "White", hex: "#FFFFFF" },
];

const IMG_TEMPLATES = ["Neon", "Midnight", "Mesh", "Sunset", "Charge", "Poster", "Ember", "Ocean", "Bold"];
const VID_TEMPLATES = ["Video + Neon", "Video + Minimal", "Video + Bold", "Text Overlay"];

/* Creative template backgrounds. UI chrome stays on Glo tokens; templates are
   ad-content and may use richer hues (per design-kit v1). */
const TPL_BG: Record<string, string> = {
  Neon: "radial-gradient(circle at 50% 30%, #1b2a4a, #04070D 70%)",
  Midnight: "linear-gradient(180deg, #0b1430, #05060f)",
  Mesh: "radial-gradient(circle at 20% 20%, #2a1b4a, transparent 55%), radial-gradient(circle at 80% 70%, #0e3a44, #04070D)",
  Sunset: "linear-gradient(200deg, #f97316, #b91c6b 60%, #1a0b1e)",
  Charge: "radial-gradient(circle at 50% 85%, rgba(190,242,100,0.25), #04070D 65%)",
  Poster: "linear-gradient(180deg, #141D30, #04070D)",
  Ember: "radial-gradient(circle at 50% 80%, #7c2d12, #1a0b0b 70%)",
  Ocean: "linear-gradient(190deg, #0e7490, #0f1726 60%, #04070D)",
  Bold: "#04070D",
};

type CreativeState = {
  name: string;
  mode: "image" | "video";
  template: string;
  typeface: keyof typeof TYPEFACES;
  headline: string;
  subline: string;
  offer: string;
  footer: string;
  qr: string;
  accent: string;
};

const INITIAL: CreativeState = {
  name: "Brooklyn summer drop",
  mode: "image",
  template: "Neon",
  typeface: "Modern",
  headline: "Half off, all weekend",
  subline: "Show this screen at the counter.",
  offer: "20% OFF",
  footer: "Scan to save →",
  qr: "https://glo.link/jp-friday",
  accent: "#BEF264",
};

const LBL = "block text-[12px] uppercase tracking-[0.06em] text-ink-400 mb-2";

function Field({
  title,
  value,
  onChange,
  type = "text",
}: {
  title: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <label className="block">
      <span className={LBL}>{title}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-[10px] border border-line-800 bg-bg-700 px-3.5 py-2.5 text-sm text-ink-100 outline-none transition-all placeholder:text-ink-500 focus:border-cy-400 focus:shadow-[0_0_0_2px_rgba(34,211,238,0.20)]"
      />
    </label>
  );
}

function Section({
  id,
  title,
  open,
  onToggle,
  children,
}: {
  id: string;
  title: string;
  open: boolean;
  onToggle: (id: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-line-800">
      <button
        onClick={() => onToggle(id)}
        className="flex w-full cursor-pointer items-center justify-between bg-transparent px-1 py-3.5"
      >
        <span className="text-[13px] font-semibold tracking-[0.01em] text-ink-100">{title}</span>
        {open ? (
          <ChevronUp size={16} className="text-ink-400" strokeWidth={1.8} />
        ) : (
          <ChevronDown size={16} className="text-ink-400" strokeWidth={1.8} />
        )}
      </button>
      {open && <div className="flex flex-col gap-3.5 px-1 pb-[18px] pt-0.5">{children}</div>}
    </div>
  );
}

/** TODO(wire-up): swap for the real DOOH QR generator. */
function QrBadge({ accent }: { accent: string }) {
  return (
    <div className="rounded-md p-[3px] leading-none" style={{ background: accent }}>
      <div className="grid h-[34px] w-[34px] grid-cols-4 grid-rows-4 gap-[2px] rounded-[3px] bg-white p-[3px]">
        {Array.from({ length: 16 }).map((_, i) => (
          <div key={i} className={i % 3 === 0 || i === 5 || i === 10 ? "bg-black" : "bg-white"} />
        ))}
      </div>
    </div>
  );
}

function Preview({ s }: { s: CreativeState }) {
  const isVid = s.mode === "video";
  return (
    <div className="flex min-w-0 flex-1 items-center justify-center rounded-2xl border border-line-800 bg-bg-950 p-7">
      <div
        className="relative h-full max-h-[520px] overflow-hidden rounded-[14px] shadow-[0_20px_60px_-20px_rgba(0,0,0,0.8)]"
        style={{
          aspectRatio: "9/16",
          background: isVid ? "#04070D" : TPL_BG[s.template] || "#04070D",
          fontFamily: TYPEFACES[s.typeface],
        }}
      >
        {isVid && (
          <div className="absolute inset-0 flex items-center justify-center bg-[linear-gradient(135deg,rgba(34,211,238,0.14),#0F1726_60%,#04070D)]">
            <Play size={44} className="text-white/25" strokeWidth={1.8} />
          </div>
        )}
        <div
          className="absolute inset-0"
          style={{
            background: isVid
              ? "linear-gradient(180deg, transparent 40%, rgba(0,0,0,0.65))"
              : "linear-gradient(180deg, transparent 55%, rgba(0,0,0,0.4))",
          }}
        />
        {s.offer && (
          <div
            className="absolute left-4 top-4 rounded-full px-[11px] py-[5px] font-sans text-[13px] font-bold text-bg-950"
            style={{ background: s.accent }}
          >
            {s.offer}
          </div>
        )}
        <div className="absolute bottom-[78px] left-5 right-5">
          <div className="text-[30px] font-bold leading-[1.05] tracking-[-0.01em] text-[#FAFAFA]">
            {s.headline || "Your headline"}
          </div>
          {s.subline && (
            <div className="mt-2 text-sm leading-[1.35] text-[#FAFAFA]/75">{s.subline}</div>
          )}
        </div>
        <div className="absolute bottom-[18px] left-5 right-5 flex items-center justify-between gap-3">
          <div className="font-mono text-xs font-medium" style={{ color: s.accent }}>
            {s.footer || "Scan to save →"}
          </div>
          <QrBadge accent={s.accent} />
        </div>
      </div>
    </div>
  );
}

export default function StudioPage() {
  const [open, setOpen] = useState<string>("identity");
  const [s, setS] = useState<CreativeState>(INITIAL);

  const set = <K extends keyof CreativeState>(k: K, v: CreativeState[K]) =>
    setS((p) => ({ ...p, [k]: v }));
  const toggle = (id: string) => setOpen((o) => (o === id ? "" : id));
  const templates = s.mode === "video" ? VID_TEMPLATES : IMG_TEMPLATES;

  return (
    <div className="flex h-full min-h-[calc(100vh-0px)] flex-col">
      <div className="flex items-center justify-between border-b border-line-900 px-7 py-[18px]">
        <div className="flex items-center gap-3">
          <span className="chip">Studio</span>
          <h1 className="m-0 text-lg font-semibold tracking-tight text-ink-50">Creative Studio</h1>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/studio/ingest/embed"
            className="inline-flex items-center gap-1.5 rounded-[10px] border border-line-800 px-3 py-2 text-[13px] text-ink-300 transition-all hover:border-line-700 hover:text-ink-50"
          >
            <Link2 size={14} strokeWidth={1.8} /> Paste a Reel
          </Link>
          <Link
            href="/studio/generate"
            className="inline-flex items-center gap-1.5 rounded-[10px] border border-line-800 px-3 py-2 text-[13px] text-ink-300 transition-all hover:border-line-700 hover:text-ink-50"
          >
            <Sparkles size={14} strokeWidth={1.8} /> Generate
          </Link>
          <button
            onClick={() => {
              /* TODO(wire-up): persist creative to library */
            }}
            className="inline-flex items-center gap-1.5 rounded-[10px] bg-lime-400 px-3.5 py-2 text-[13px] font-medium text-bg-950 transition-all hover:bg-lime-300 hover:shadow-glow-lime"
          >
            <Check size={15} strokeWidth={2} /> Save to Library
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-5 p-5 lg:flex-row">
        <div className="flex min-h-[420px] lg:flex-[0_0_62%]">
          <Preview s={s} />
        </div>
        <div className="flex-1 overflow-y-auto pr-1.5">
          <Section id="identity" title="Creative Identity" open={open === "identity"} onToggle={toggle}>
            <Field title="Creative name" value={s.name} onChange={(v) => set("name", v)} />
            <div>
              <span className={LBL}>Video or image?</span>
              <div className="flex gap-2">
                {(["image", "video"] as const).map((m) => {
                  const on = s.mode === m;
                  return (
                    <button
                      key={m}
                      onClick={() => {
                        set("mode", m);
                        set("template", (m === "video" ? VID_TEMPLATES : IMG_TEMPLATES)[0]);
                      }}
                      className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 py-[9px] text-[13px] font-medium transition-all ${
                        on
                          ? "border-lime-400/50 bg-lime-400/10 text-lime-300"
                          : "border-line-800 bg-bg-900 text-ink-300 hover:border-line-700"
                      }`}
                    >
                      {m === "image" ? (
                        <ImageIcon size={14} strokeWidth={1.8} />
                      ) : (
                        <Video size={14} strokeWidth={1.8} />
                      )}
                      {m[0].toUpperCase() + m.slice(1)}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <span className={LBL}>Template</span>
              <div className="grid grid-cols-3 gap-2">
                {templates.map((t) => {
                  const on = s.template === t;
                  return (
                    <button
                      key={t}
                      onClick={() => set("template", t)}
                      className={`cursor-pointer overflow-hidden rounded-lg border-2 p-0 ${
                        on ? "border-lime-400" : "border-line-800 hover:border-line-700"
                      }`}
                    >
                      <div
                        className="aspect-square"
                        style={{ background: TPL_BG[t] || "linear-gradient(160deg,#141D30,#04070D)" }}
                      />
                      <div className={`bg-bg-900 px-0.5 py-1 text-[10px] ${on ? "text-lime-300" : "text-ink-400"}`}>
                        {t}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </Section>

          <Section id="type" title="Typography" open={open === "type"} onToggle={toggle}>
            <div className="flex flex-col gap-2">
              {(Object.keys(TYPEFACES) as (keyof typeof TYPEFACES)[]).map((t) => {
                const on = s.typeface === t;
                return (
                  <button
                    key={t}
                    onClick={() => set("typeface", t)}
                    className={`flex cursor-pointer items-center justify-between rounded-[10px] border px-3.5 py-3 transition-all ${
                      on
                        ? "border-lime-400/50 bg-lime-400/[0.06]"
                        : "border-line-800 bg-bg-900 hover:border-line-700"
                    }`}
                  >
                    <span className="text-lg font-semibold text-ink-50" style={{ fontFamily: TYPEFACES[t] }}>
                      {t}
                    </span>
                    <span className="text-[11px] text-ink-500">{TYPEFACE_HINT[t]}</span>
                  </button>
                );
              })}
            </div>
          </Section>

          <Section id="content" title="Content" open={open === "content"} onToggle={toggle}>
            <Field title="Headline" value={s.headline} onChange={(v) => set("headline", v)} />
            <Field title="Subline" value={s.subline} onChange={(v) => set("subline", v)} />
            <Field title="Offer badge" value={s.offer} onChange={(v) => set("offer", v)} />
            <Field title="Footer CTA" value={s.footer} onChange={(v) => set("footer", v)} />
          </Section>

          <Section id="engage" title="Engagement" open={open === "engage"} onToggle={toggle}>
            <Field title="QR link" type="url" value={s.qr} onChange={(v) => set("qr", v)} />
            <p className="m-0 flex items-start gap-1.5 text-[11px] text-ink-500">
              <Info size={13} strokeWidth={1.8} className="mt-[1px] shrink-0" />
              A QR code is auto-generated on the creative. Passersby scan it to reach your link.
            </p>
          </Section>

          <Section id="brand" title="Brand Assets" open={open === "brand"} onToggle={toggle}>
            <div>
              <span className={LBL}>Logo</span>
              <button className="flex w-full cursor-pointer flex-col items-center gap-1.5 rounded-[10px] border border-dashed border-line-700 p-[18px] text-center text-xs text-ink-500 transition-colors hover:border-cy-400">
                <Upload size={18} strokeWidth={1.8} className="text-ink-400" />
                Drop logo or click to browse
              </button>
            </div>
            <div>
              <span className={LBL}>Accent color</span>
              <div className="flex gap-2.5">
                {SWATCHES.map((sw) => {
                  const on = s.accent === sw.hex;
                  return (
                    <button
                      key={sw.hex}
                      title={sw.name}
                      onClick={() => set("accent", sw.hex)}
                      className="h-[30px] w-[30px] cursor-pointer rounded-full"
                      style={{
                        background: sw.hex,
                        border: on ? "2px solid #F1F5FB" : "2px solid transparent",
                        boxShadow: on ? `0 0 0 2px #04070D, 0 0 0 3px ${sw.hex}` : "none",
                      }}
                    />
                  );
                })}
              </div>
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}
