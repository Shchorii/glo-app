"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  listScreens, createCampaign, uploadCreative, daysBetween, fmtUsd,
  type Screen, type Creative,
} from "@/lib/db";
import { useSession } from "@/lib/auth-client";
import { isSupabaseConfigured } from "@/lib/supabase";
import BookMap from "@/components/BookMap";
import { TemplateBuilder, renderTemplatePng, CANVAS_W, CANVAS_H, type TemplateSpec } from "@/components/TemplateBuilder";
import {
  MapPin, List, Map as MapIcon, Monitor, Calendar, ImagePlus, Wand2,
  ChevronLeft, ChevronRight, Loader2, CheckCircle2, Upload,
} from "lucide-react";

const STEPS = ["Screens", "Dates", "Creative", "Review"] as const;
const MAX_UPLOAD_MB = 50;

type CreativeChoice =
  | { kind: "none" }
  | { kind: "upload"; file: File }
  | { kind: "template"; spec: TemplateSpec };

export default function BookPage() {
  const router = useRouter();
  const { user, loading } = useSession();

  const [step, setStep] = useState(0);
  const [screens, setScreens] = useState<Screen[] | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [view, setView] = useState<"list" | "map">("map");
  const [city, setCity] = useState<string>("all");
  const [venue, setVenue] = useState<string>("all");

  const today = new Date().toISOString().slice(0, 10);
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);

  const [name, setName] = useState("");
  const [creative, setCreative] = useState<CreativeChoice>({ kind: "none" });
  const [tplSpec, setTplSpec] = useState<TemplateSpec>({
    preset: "glow", headline: "", subline: "", accent: "#22D3EE",
  });

  const [saving, setSaving] = useState<"idle" | "draft" | "book">("idle");
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const [doneId, setDoneId] = useState<string | null>(null);

  // Auth gate
  useEffect(() => {
    if (!loading && isSupabaseConfigured && !user) {
      router.replace("/sign-in?next=/book");
    }
  }, [loading, user, router]);

  // Load screens
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    listScreens().then(setScreens).catch((e) => setLoadErr(String(e?.message ?? e)));
  }, []);

  const cities = useMemo(() => Array.from(new Set((screens ?? []).map((s) => s.city))), [screens]);
  const venues = useMemo(() => Array.from(new Set((screens ?? []).map((s) => s.venue_type))), [screens]);
  const filtered = useMemo(
    () => (screens ?? []).filter((s) => (city === "all" || s.city === city) && (venue === "all" || s.venue_type === venue)),
    [screens, city, venue]
  );
  const selectedScreens = useMemo(() => (screens ?? []).filter((s) => selected.has(s.id)), [screens, selected]);
  const perDay = selectedScreens.reduce((sum, s) => sum + s.daily_price_usd, 0);
  const days = daysBetween(startDate, endDate);
  const total = perDay * days;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const canNext =
    step === 0 ? selected.size > 0 :
    step === 1 ? days > 0 :
    step === 2 ? (creative.kind !== "template" || tplSpec.headline.trim().length > 0) :
    false;

  async function resolveCreative(): Promise<Creative | null> {
    if (creative.kind === "upload") {
      const file = creative.file;
      const ext = (file.name.split(".").pop() || "bin").toLowerCase();
      return await uploadCreative(file, { source: "upload", ext });
    }
    if (creative.kind === "template") {
      const blob = await renderTemplatePng(tplSpec);
      return await uploadCreative(blob, { source: "template", ext: "png", width: CANVAS_W, height: CANVAS_H });
    }
    return null;
  }

  async function save(status: "draft" | "pending_payment") {
    setSaving(status === "draft" ? "draft" : "book");
    setSaveErr(null);
    try {
      const cr = await resolveCreative();
      const id = await createCampaign({
        name: name.trim() || `${selectedScreens[0]?.city ?? "Glo"} campaign`,
        start_date: startDate,
        end_date: endDate,
        screen_ids: [...selected],
        creative_id: cr?.id ?? null,
        total_usd: total,
        status,
      });
      setDoneId(id);
    } catch (e) {
      setSaveErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving("idle");
    }
  }

  if (!isSupabaseConfigured) {
    return <Shell><p className="text-ink-400 text-sm">Booking is not configured in this build.</p></Shell>;
  }
  if (loading || (!user && isSupabaseConfigured)) {
    return <Shell><div className="flex items-center gap-2 text-ink-400 text-sm"><Loader2 size={15} className="animate-spin" /> Loading…</div></Shell>;
  }

  if (doneId) {
    return (
      <Shell>
        <div className="card p-8 text-center max-w-lg mx-auto">
          <CheckCircle2 size={40} className="mx-auto text-lime-300 mb-4" />
          <h2 className="text-xl font-semibold text-ink-50 mb-2">Campaign saved</h2>
          <p className="text-sm text-ink-400 mb-1">
            {selected.size} screen{selected.size === 1 ? "" : "s"} · {days} day{days === 1 ? "" : "s"} · {fmtUsd(total)}
          </p>
          <p className="text-sm text-ink-400 mb-6">
            Payments go live in the next release. Your campaign is locked in and first in line; we will notify you the moment checkout opens.
          </p>
          <div className="flex justify-center gap-3">
            <Link href={`/campaigns/view?id=${doneId}`} className="btn btn-primary">View campaign</Link>
            <Link href="/campaigns" className="btn btn-ghost">All campaigns</Link>
          </div>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      {/* Stepper */}
      <div className="flex items-center gap-1.5 sm:gap-3 mb-6 overflow-x-auto pb-1">
        {STEPS.map((label, i) => (
          <button
            key={label}
            type="button"
            onClick={() => i < step && setStep(i)}
            className={`flex items-center gap-1.5 shrink-0 px-2.5 py-1.5 rounded-full text-[12px] font-medium border ${
              i === step
                ? "bg-cy-400/15 text-cy-300 border-cy-400/40"
                : i < step
                ? "text-lime-300 border-lime-400/30 hover:bg-bg-800"
                : "text-ink-500 border-line-900"
            }`}
          >
            <span className={`w-4.5 h-4.5 w-5 h-5 rounded-full text-[10px] flex items-center justify-center ${
              i <= step ? "bg-bg-900" : "bg-bg-900/50"
            }`}>{i + 1}</span>
            {label}
          </button>
        ))}
      </div>

      {/* STEP 1: SCREENS */}
      {step === 0 && (
        <div>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="flex flex-wrap gap-2">
              <select value={city} onChange={(e) => setCity(e.target.value)} className="px-3 py-2 rounded-lg bg-bg-900 border border-line-800 text-[13px] text-ink-100">
                <option value="all">All cities</option>
                {cities.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <select value={venue} onChange={(e) => setVenue(e.target.value)} className="px-3 py-2 rounded-lg bg-bg-900 border border-line-800 text-[13px] text-ink-100 capitalize">
                <option value="all">All venues</option>
                {venues.map((v) => <option key={v} value={v} className="capitalize">{v}</option>)}
              </select>
            </div>
            <div className="flex rounded-lg border border-line-800 overflow-hidden">
              <ToggleBtn active={view === "map"} onClick={() => setView("map")} icon={MapIcon} label="Map" />
              <ToggleBtn active={view === "list"} onClick={() => setView("list")} icon={List} label="List" />
            </div>
          </div>

          {loadErr && <p className="text-sm text-red-400 mb-3">{loadErr}</p>}
          {!screens && !loadErr && (
            <div className="flex items-center gap-2 text-ink-400 text-sm py-10 justify-center"><Loader2 size={15} className="animate-spin" /> Loading screens…</div>
          )}

          {screens && view === "map" && (
            <div>
              <BookMap screens={filtered} selected={selected} onToggle={toggle} />
              <p className="text-[11px] text-ink-500 mt-2">Tap a dot to select a screen. Selected screens glow cyan.</p>
              <div className="flex flex-wrap gap-2 mt-3">
                {filtered.map((s) => {
                  const isSel = selected.has(s.id);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => toggle(s.id)}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[12px] border transition-colors ${
                        isSel
                          ? "bg-cy-400/15 text-cy-300 border-cy-400/40"
                          : "bg-bg-900/60 text-ink-300 border-line-800 hover:border-line-700 hover:text-ink-100"
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${isSel ? "bg-cy-300 shadow-[0_0_6px_rgba(34,211,238,0.9)]" : "bg-lime-400 shadow-[0_0_6px_rgba(163,230,53,0.8)]"}`} />
                      {s.name}
                      <span className="text-ink-500 tabular-nums">${s.daily_price_usd}/d</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {screens && view === "list" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {filtered.map((s) => {
                const isSel = selected.has(s.id);
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => toggle(s.id)}
                    className={`text-left card-tight p-4 border transition-colors ${
                      isSel ? "border-cy-400/60 bg-cy-400/5" : "border-line-800 hover:border-line-700"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <Monitor size={14} className={isSel ? "text-cy-300" : "text-ink-400"} />
                          <span className="text-[14px] font-medium text-ink-50 truncate">{s.name}</span>
                        </div>
                        <div className="text-[12px] text-ink-400 mt-1 flex items-center gap-1.5 capitalize">
                          <MapPin size={11} /> {s.city} · {s.venue_type} · max {s.max_duration_s}s
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-[15px] font-semibold text-ink-50 tabular-nums">${s.daily_price_usd}</div>
                        <div className="text-[10px] uppercase tracking-wider text-ink-500">/day</div>
                      </div>
                    </div>
                    {isSel && <div className="mt-2 text-[11px] text-cy-300 flex items-center gap-1"><CheckCircle2 size={12} /> Selected</div>}
                  </button>
                );
              })}
              {filtered.length === 0 && <p className="text-sm text-ink-500 col-span-full py-8 text-center">No screens match those filters.</p>}
            </div>
          )}
        </div>
      )}

      {/* STEP 2: DATES */}
      {step === 1 && (
        <div className="max-w-md">
          <div className="grid grid-cols-2 gap-4 mb-5">
            <div>
              <label className="block text-xs uppercase tracking-wider text-ink-400 mb-1.5">Start</label>
              <input type="date" min={today} value={startDate}
                onChange={(e) => { setStartDate(e.target.value); if (e.target.value > endDate) setEndDate(e.target.value); }}
                className="w-full px-3 py-2.5 rounded-lg bg-bg-900 border border-line-800 text-ink-50 focus:border-cy-400 focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wider text-ink-400 mb-1.5">End</label>
              <input type="date" min={startDate} value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg bg-bg-900 border border-line-800 text-ink-50 focus:border-cy-400 focus:outline-none" />
            </div>
          </div>
          <div className="card-tight p-4 flex items-center justify-between">
            <span className="text-[13px] text-ink-400 flex items-center gap-1.5"><Calendar size={13} /> {days || "—"} day{days === 1 ? "" : "s"} × {fmtUsd(perDay)}/day</span>
            <span className="text-lg font-semibold text-ink-50 tabular-nums">{fmtUsd(total)}</span>
          </div>
        </div>
      )}

      {/* STEP 3: CREATIVE */}
      {step === 2 && (
        <div>
          <div className="flex flex-wrap gap-2 mb-5">
            <ChoiceBtn active={creative.kind === "upload"} onClick={() => setCreative(creative.kind === "upload" ? creative : { kind: "none" })} icon={ImagePlus} label="Upload" asLabel htmlFor="creative-file" />
            <ChoiceBtn active={creative.kind === "template"} onClick={() => setCreative({ kind: "template", spec: tplSpec })} icon={Wand2} label="Use a template" />
            <ChoiceBtn active={creative.kind === "none"} onClick={() => setCreative({ kind: "none" })} icon={ChevronRight} label="Skip for now" />
          </div>
          <input
            id="creative-file"
            type="file"
            accept="video/mp4,image/png,image/jpeg"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              if (f.size > MAX_UPLOAD_MB * 1024 * 1024) { setSaveErr(`File is too big. Keep it under ${MAX_UPLOAD_MB}MB.`); return; }
              setSaveErr(null);
              setCreative({ kind: "upload", file: f });
            }}
          />
          {creative.kind === "upload" && (
            <div className="card-tight p-4 flex items-center gap-3 max-w-md">
              <Upload size={16} className="text-cy-300 shrink-0" />
              <div className="min-w-0">
                <div className="text-[14px] text-ink-50 truncate">{creative.file.name}</div>
                <div className="text-[11px] text-ink-500">{(creative.file.size / (1024 * 1024)).toFixed(1)} MB · uploads when you book</div>
              </div>
            </div>
          )}
          {creative.kind === "template" && (
            <TemplateBuilder spec={tplSpec} onChange={(s) => { setTplSpec(s); setCreative({ kind: "template", spec: s }); }} />
          )}
          {creative.kind === "none" && (
            <p className="text-[13px] text-ink-500 max-w-md">No creative yet is fine. You can attach one from the campaign page any time before go-live.</p>
          )}
        </div>
      )}

      {/* STEP 4: REVIEW */}
      {step === 3 && (
        <div className="max-w-lg space-y-4">
          <div>
            <label className="block text-xs uppercase tracking-wider text-ink-400 mb-1.5">Campaign name</label>
            <input type="text" maxLength={80} value={name} onChange={(e) => setName(e.target.value)}
              placeholder={`${selectedScreens[0]?.city ?? "Glo"} campaign`}
              className="w-full px-3 py-2.5 rounded-lg bg-bg-900 border border-line-800 text-ink-50 focus:border-cy-400 focus:outline-none placeholder-ink-500" />
          </div>
          <div className="card-tight divide-y divide-line-900">
            <Row label="Screens" value={`${selected.size} selected · ${fmtUsd(perDay)}/day`} />
            <Row label="Flight" value={`${startDate} → ${endDate} · ${days} day${days === 1 ? "" : "s"}`} />
            <Row label="Creative" value={creative.kind === "none" ? "Attach later" : creative.kind === "upload" ? creative.file.name : `Template · ${tplSpec.preset}`} />
            <Row label="Total" value={fmtUsd(total)} strong />
          </div>
          <p className="text-[12px] text-ink-500">
            Booking saves your campaign as reserved. Checkout opens in the next release; nothing is charged today.
          </p>
          {saveErr && <p className="text-sm text-red-400">{saveErr}</p>}
        </div>
      )}

      {/* Footer nav */}
      <div className="flex items-center justify-between mt-8 pt-5 border-t border-line-900">
        <button type="button" disabled={step === 0} onClick={() => setStep(step - 1)}
          className="btn btn-ghost disabled:opacity-40">
          <ChevronLeft size={15} /> Back
        </button>
        <div className="flex items-center gap-3">
          {selected.size > 0 && (
            <span className="hidden sm:block text-[13px] text-ink-400 tabular-nums">
              {selected.size} screen{selected.size === 1 ? "" : "s"}{days > 0 ? ` · ${fmtUsd(total)}` : ` · ${fmtUsd(perDay)}/day`}
            </span>
          )}
          {step >= 1 && step < 3 && (
            <button type="button" disabled={saving !== "idle"} onClick={() => save("draft")} className="btn btn-ghost disabled:opacity-40">
              {saving === "draft" ? <Loader2 size={15} className="animate-spin" /> : "Save draft"}
            </button>
          )}
          {step < 3 ? (
            <button type="button" disabled={!canNext} onClick={() => setStep(step + 1)} className="btn btn-primary disabled:opacity-40">
              Next <ChevronRight size={15} />
            </button>
          ) : (
            <button type="button" disabled={saving !== "idle"} onClick={() => save("pending_payment")} className="btn btn-lime disabled:opacity-40">
              {saving === "book" ? <Loader2 size={15} className="animate-spin" /> : `Book · ${fmtUsd(total)}`}
            </button>
          )}
        </div>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 md:px-8 py-6 md:py-10">
      <div className="mb-6">
        <p className="chip mb-3">Book · live inventory</p>
        <h1 className="text-2xl md:text-3xl font-semibold text-ink-50 tracking-tight">Book screens</h1>
        <p className="text-ink-400 mt-1.5 text-sm">Pick screens, pick dates, attach a creative. Sixty seconds to the street.</p>
      </div>
      {children}
    </div>
  );
}

function ToggleBtn({ active, onClick, icon: Icon, label }: {
  active: boolean; onClick: () => void; icon: React.ComponentType<{ size?: number }>; label: string;
}) {
  return (
    <button type="button" onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-3 py-2 text-[13px] font-medium ${
        active ? "bg-cy-400/15 text-cy-300" : "text-ink-400 hover:text-ink-100"
      }`}>
      <Icon size={14} /> {label}
    </button>
  );
}

function ChoiceBtn({ active, onClick, icon: Icon, label, asLabel, htmlFor }: {
  active: boolean; onClick: () => void; icon: React.ComponentType<{ size?: number }>; label: string;
  asLabel?: boolean; htmlFor?: string;
}) {
  const cls = `inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[13px] font-medium border cursor-pointer transition-colors ${
    active ? "bg-cy-400/15 text-cy-300 border-cy-400/40" : "border-line-800 text-ink-300 hover:text-ink-50 hover:border-line-700"
  }`;
  if (asLabel && htmlFor) {
    return <label htmlFor={htmlFor} className={cls} onClick={onClick}><Icon size={14} /> {label}</label>;
  }
  return <button type="button" onClick={onClick} className={cls}><Icon size={14} /> {label}</button>;
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <span className="text-[12px] uppercase tracking-wider text-ink-400">{label}</span>
      <span className={`text-[14px] tabular-nums ${strong ? "font-semibold text-lime-300" : "text-ink-100"}`}>{value}</span>
    </div>
  );
}
