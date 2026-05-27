import Link from "next/link";
import {
  dummyCampaign, dummyMetrics, dummyCreatives, SURFACE_META, fmtCents, fmtInt, fmtPct,
} from "@/lib/dummy-data";
import { Monitor, Tv, Pause, MapPin, Calendar } from "lucide-react";

export default function CampaignsPage() {
  const c = dummyCampaign;
  const m = dummyMetrics;
  const budgetPct = c.spentCents / c.budgetCents;
  const daysLive = Math.max(1, Math.round((Date.now() - c.startsAt) / (1000 * 60 * 60 * 24)));
  const surfaceIcon = (s: string) => (s === "dooh" ? Monitor : Tv);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 md:px-8 py-6 md:py-10">
      <div className="flex flex-wrap items-baseline justify-between gap-4 mb-6 md:mb-8">
        <div>
          <p className="chip mb-3">Campaigns · M2</p>
          <h1 className="text-2xl md:text-3xl font-semibold text-ink-50 tracking-tight">Campaigns</h1>
          <p className="text-ink-400 mt-1.5 text-sm">All your neighborhoods, all your screens.</p>
        </div>
        <button className="btn btn-primary" disabled>+ New campaign</button>
      </div>

      {/* Campaign card */}
      <Link href={`/campaigns/${c.id}`} className="block group">
        <div className="card p-5 md:p-7 transition-all group-hover:border-cy-400/40 group-hover:shadow-glow-cy">
          {/* Header row */}
          <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider font-medium bg-lime-400/15 text-lime-300 border border-lime-400/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-lime-400 animate-pulse" />
                  Live · day {daysLive}
                </span>
                <span className="text-xs text-ink-500">{dummyCreatives.length} creatives</span>
              </div>
              <h2 className="text-lg md:text-xl font-medium text-ink-50">{c.name}</h2>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-[13px] text-ink-400">
                <span className="inline-flex items-center gap-1.5"><MapPin size={13} />{c.targeting.neighborhoods.join(" · ")}</span>
                <span className="inline-flex items-center gap-1.5"><Calendar size={13} />
                  {new Date(c.startsAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })} – {new Date(c.endsAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </span>
              </div>
            </div>
            {/* Surface badges */}
            <div className="flex gap-2 shrink-0">
              {c.surfaces.map((s) => {
                const Icon = surfaceIcon(s);
                return (
                  <span key={s} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium bg-bg-700/60 border border-line-800 text-ink-200">
                    <Icon size={13} />
                    {SURFACE_META[s].label}
                  </span>
                );
              })}
            </div>
          </div>

          {/* Budget progress */}
          <div className="mb-5">
            <div className="flex items-baseline justify-between mb-1.5">
              <span className="text-xs uppercase tracking-wider text-ink-400">Budget</span>
              <span className="text-sm text-ink-200">
                <span className="font-medium text-ink-50">{fmtCents(c.spentCents)}</span>
                <span className="text-ink-500"> / {fmtCents(c.budgetCents)}</span>
                <span className="ml-2 text-cy-300">{fmtPct(budgetPct, 0)}</span>
              </span>
            </div>
            <div className="h-2 rounded-full bg-bg-900 overflow-hidden">
              <div className="h-full bg-gradient-to-r from-cy-500 to-cy-300" style={{ width: `${budgetPct * 100}%` }} />
            </div>
          </div>

          {/* Quick stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
            <Stat label="Impressions" value={fmtInt(m.totals.impressions)} />
            <Stat label="Completions" value={`${fmtInt(m.totals.completions)} · ${fmtPct(m.totals.completions / m.totals.impressions, 0)}`} />
            <Stat label="Clicks (CTV)" value={fmtInt(m.totals.clicks)} />
            <Stat label="eCPM" value={fmtCents(m.totals.ecpmCents)} />
          </div>
        </div>
      </Link>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card-tight px-3 py-2.5 md:py-3">
      <div className="text-[10px] uppercase tracking-wider text-ink-400 mb-0.5">{label}</div>
      <div className="text-[15px] md:text-base font-medium text-ink-50 tabular-nums">{value}</div>
    </div>
  );
}
