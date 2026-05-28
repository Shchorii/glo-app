import Link from "next/link";
import {
  dummyCampaign, dummyMetrics, dummyCreatives, dummyOffer, SURFACE_META, fmtCents, fmtInt, fmtPct,
} from "@/lib/dummy-data";
import { getStats } from "@/lib/scans";
import Image from "next/image";
import { Monitor, Tv, MapPin, Calendar, Eye, ArrowRight, QrCode, BadgePercent } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function CampaignsPage() {
  const c = dummyCampaign;
  const stats = await getStats(dummyOffer.code);
  const redemptionRate = stats.scans ? stats.redemptions / stats.scans : 0;
  const scanRate = stats.scans / dummyMetrics.bySurface.dooh.impressions;
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

      <div className="card p-5 md:p-7">
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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-5">
          <Stat label="Impressions" value={fmtInt(m.totals.impressions)} />
          <Stat label="Completions" value={`${fmtInt(m.totals.completions)} · ${fmtPct(m.totals.completions / m.totals.impressions, 0)}`} />
          <Stat label="Clicks (CTV)" value={fmtInt(m.totals.clicks)} />
          <Stat label="eCPM" value={fmtCents(m.totals.ecpmCents)} />
        </div>

        {/* THE BUTTON */}
        <Link
          href={`/campaigns/${c.id}/preview`}
          className="group flex items-center justify-between gap-3 p-4 md:p-5 rounded-lg bg-gradient-to-r from-cy-400/10 via-lime-400/10 to-cy-400/10 border border-cy-400/30 hover:border-cy-400/60 transition-colors"
        >
          <div className="flex items-center gap-3 min-w-0">
            <span className="w-9 h-9 sm:w-10 sm:h-10 shrink-0 rounded-lg bg-cy-400/20 border border-cy-400/40 flex items-center justify-center text-cy-300">
              <Eye size={18} strokeWidth={1.8} />
            </span>
            <div className="min-w-0">
              <div className="text-[15px] sm:text-base font-medium text-ink-50">See your ads on the streets</div>
              <div className="text-[12px] sm:text-[13px] text-ink-400">Williamsburg sidewalk · Bushwick living room · live preview</div>
            </div>
          </div>
          <ArrowRight size={18} className="text-cy-300 group-hover:translate-x-1 transition-transform shrink-0" />
        </Link>
      </div>

      {/* DOOH QR coupon */}
      <div className="card p-5 md:p-7 mt-4 md:mt-5">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider font-medium bg-cy-400/15 text-cy-300 border border-cy-400/30">
            <QrCode size={11} /> DOOH coupon
          </span>
          <span className="text-xs text-ink-500">turns sidewalk impressions into foot traffic</span>
        </div>
        <h2 className="text-lg md:text-xl font-medium text-ink-50 mb-4 flex items-center gap-2">
          <BadgePercent size={18} className="text-lime-300" />
          {dummyOffer.discountPct}% off — scan-to-claim
        </h2>

        <div className="flex flex-col sm:flex-row gap-5 sm:items-center">
          {/* QR */}
          <div className="shrink-0 mx-auto sm:mx-0">
            <div className="bg-[#F2EFE6] rounded-xl p-2.5 w-36 h-36">
              <Image src="/qr-jp-friday10.png" alt="Scan for 10% off" width={144} height={144} className="w-full h-full" />
            </div>
            <p className="text-center text-[10px] text-ink-500 mt-2">app.we-are-glo.com/c/{dummyOffer.code}</p>
          </div>

          {/* Funnel */}
          <div className="flex-1 grid grid-cols-3 gap-3">
            <Stat label="Scans" value={fmtInt(stats.scans)} />
            <Stat label="Redemptions" value={fmtInt(stats.redemptions)} />
            <Stat label="Redeem rate" value={fmtPct(redemptionRate, 0)} />
            <div className="col-span-3 mt-1">
              <div className="flex items-baseline justify-between mb-1.5">
                <span className="text-[11px] uppercase tracking-wider text-ink-400">Scan rate vs DOOH impressions</span>
                <span className="text-[12px] text-cy-300 tabular-nums">{fmtPct(scanRate, 1)}</span>
              </div>
              <div className="h-1.5 rounded-full bg-bg-900 overflow-hidden">
                <div className="h-full bg-gradient-to-r from-cy-500 to-lime-300" style={{ width: `${Math.min(100, scanRate * 100 * 12)}%` }} />
              </div>
              <p className="text-[11px] text-ink-500 mt-2">
                Live count — every scan of the sidewalk QR is captured here. <span className="text-ink-400">DOOH finally has a click.</span>
              </p>
            </div>
          </div>
        </div>
      </div>
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
