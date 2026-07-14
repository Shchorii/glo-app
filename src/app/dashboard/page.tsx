import { dummyMetrics, dummyCampaign, dummyOffer, SURFACE_META, fmtCents, fmtInt, fmtPct } from "@/lib/dummy-data";
import { getStats } from "@/lib/scans";
import { LiveImpressionsCounter } from "@/components/LiveImpressionsCounter";
import { TrendingUp, MousePointerClick, Eye, DollarSign, Monitor, Tv, QrCode, BadgePercent, Store } from "lucide-react";



export default async function DashboardPage() {
  const m = dummyMetrics;
  const qr = await getStats(dummyOffer.code);
  const redeemRate = qr.scans ? qr.redemptions / qr.scans : 0;
  const completionRate = m.totals.completions / m.totals.impressions;
  const ctr = m.totals.clicks / m.bySurface.ctv.impressions; // clicks only on CTV
  const maxTimeline = Math.max(...m.timeline.map((d) => d.impressions));
  const maxNeighborhood = Math.max(...m.byNeighborhood.map((n) => n.impressions));
  const surfaceImpsTotal = m.bySurface.dooh.impressions + m.bySurface.ctv.impressions;
  const doohShare = m.bySurface.dooh.impressions / surfaceImpsTotal;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 md:px-8 py-6 md:py-10 space-y-6 md:space-y-8">
      <div>
        <p className="chip mb-3">Dashboard · M3</p>
        <h1 className="text-2xl md:text-3xl font-semibold text-ink-50 tracking-tight">Performance</h1>
        <p className="text-ink-400 mt-1.5 text-sm flex flex-wrap items-center gap-x-2 gap-y-1">
          <span>Last 14 days · <span className="text-ink-200">{dummyCampaign.name}</span></span>
          <a href={`/campaigns/${dummyCampaign.id}/preview`} className="inline-flex items-center gap-1 text-cy-300 hover:text-cy-200 text-[13px]">
            See it on the streets →
          </a>
        </p>
      </div>

      {/* Live ticker */}
      <LiveImpressionsCounter start={m.totals.impressions} ratePerMinute={9} />

      {/* KPI tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <KpiTile icon={Eye}                label="Impressions" value={fmtInt(m.totals.impressions)} sub="+8% vs week 1" tone="cy" />
        <KpiTile icon={TrendingUp}         label="Completion"  value={fmtPct(completionRate, 1)}    sub={`${fmtInt(m.totals.completions)} VCRs`} tone="lime" />
        <KpiTile icon={MousePointerClick}  label="CTR (CTV)"   value={fmtPct(ctr, 2)}               sub={`${m.totals.clicks} clicks`} tone="cy" />
        <KpiTile icon={DollarSign}         label="Spent"       value={fmtCents(m.totals.spentCents)} sub={`${fmtCents(m.totals.ecpmCents)} eCPM`} tone="lime" />
      </div>

      {/* By surface + 8-day timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-5">
        {/* Surface split */}
        <section className="card p-5 md:p-6">
          <h2 className="text-sm font-medium text-ink-100 mb-4 flex items-center gap-2">
            <span className="text-ink-400">By surface</span>
          </h2>
          <div className="space-y-4">
            <SurfaceRow
              icon={Monitor}
              tone="cy"
              label={SURFACE_META.dooh.label}
              imps={m.bySurface.dooh.impressions}
              completions={m.bySurface.dooh.completions}
              spent={m.bySurface.dooh.spentCents}
              share={doohShare}
              total={surfaceImpsTotal}
            />
            <SurfaceRow
              icon={Tv}
              tone="lime"
              label={SURFACE_META.ctv.label}
              imps={m.bySurface.ctv.impressions}
              completions={m.bySurface.ctv.completions}
              spent={m.bySurface.ctv.spentCents}
              share={1 - doohShare}
              total={surfaceImpsTotal}
            />
          </div>
        </section>

        {/* 8-day timeline */}
        <section className="card p-5 md:p-6">
          <h2 className="text-sm font-medium text-ink-100 mb-4">
            <span className="text-ink-400">Last 14 days · daily impressions</span>
          </h2>
          <div className="flex items-end justify-between gap-1 md:gap-1.5 h-32">
            {m.timeline.map((d) => {
              const h = (d.impressions / maxTimeline) * 100;
              const isFri = d.label === "Fri";
              return (
                <div key={d.date} className="flex-1 flex flex-col items-center gap-1.5">
                  <div className="text-[9px] text-ink-500 tabular-nums hidden sm:block">{(d.impressions / 1000).toFixed(1)}k</div>
                  <div
                    className={`w-full rounded-t ${isFri ? "bg-gradient-to-t from-lime-500 to-lime-300" : "bg-gradient-to-t from-cy-600 to-cy-400"}`}
                    style={{ height: `${h}%`, minHeight: 8 }}
                    title={`${d.date}: ${fmtInt(d.impressions)} impressions`}
                  />
                  <div className="text-[9px] sm:text-[10px] text-ink-400"><span className="sm:hidden">{d.label[0]}</span><span className="hidden sm:inline">{d.label}</span></div>
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-[11px] text-ink-500">Friday Special drove the peak. <span className="text-lime-300">+93% vs daily avg.</span></p>
        </section>
      </div>

      {/* Neighborhoods */}
      <section className="card p-5 md:p-6">
        <h2 className="text-sm font-medium text-ink-100 mb-4">
          <span className="text-ink-400">By neighborhood</span>
        </h2>
        <div className="space-y-3.5">
          {m.byNeighborhood.map((n) => {
            const share = n.impressions / m.totals.impressions;
            return (
              <div key={n.name}>
                <div className="flex items-baseline justify-between mb-1">
                  <span className="text-[14px] text-ink-100 font-medium">{n.name}</span>
                  <span className="text-[12px] text-ink-400 tabular-nums">
                    {fmtInt(n.impressions)} <span className="text-ink-500">· {fmtPct(n.completionRate, 0)} VCR · {fmtCents(n.spentCents)}</span>
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-bg-900 overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-cy-500 to-cy-300" style={{ width: `${(n.impressions / maxNeighborhood) * 100}%` }} />
                </div>
                <div className="text-[10px] text-ink-500 mt-1">{fmtPct(share, 0)} of total</div>
              </div>
            );
          })}
        </div>
      </section>

      {/* QR coupon funnel */}
      <section className="card p-5 md:p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-medium text-ink-100 flex items-center gap-2">
            <QrCode size={15} className="text-cy-300" />
            <span className="text-ink-400">DOOH coupon funnel</span>
          </h2>
          <a href={`/c/${dummyOffer.code}`} className="text-[12px] text-cy-300 hover:text-cy-200">Open coupon →</a>
        </div>
        <div className="grid grid-cols-3 gap-3 md:gap-4">
          <FunnelStep icon={QrCode}        tone="cy"   label="Scans"        value={fmtInt(qr.scans)} sub={`${fmtPct(qr.scans / m.bySurface.dooh.impressions, 1)} of DOOH`} />
          <FunnelStep icon={BadgePercent}  tone="lime" label="Redemptions"  value={fmtInt(qr.redemptions)} sub={`${dummyOffer.discountPct}% off claimed`} />
          <FunnelStep icon={Store}         tone="cy"   label="Redeem rate"  value={fmtPct(redeemRate, 0)} sub="scan → counter" />
        </div>
        <p className="mt-3 text-[11px] text-ink-500">
          The sidewalk QR gives DOOH a real conversion signal — <span className="text-ink-400">impression → scan → in-store redemption</span>, captured live.
        </p>
      </section>

      {/* Top blocks */}
      <section className="card p-5 md:p-6">
        <h2 className="text-sm font-medium text-ink-100 mb-4">
          <span className="text-ink-400">Top performing blocks · DOOH</span>
        </h2>
        <div className="divide-y divide-line-900">
          {m.topBlocks.map((b, i) => (
            <div key={i} className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0">
              <div className="min-w-0">
                <div className="text-[14px] text-ink-100 truncate">{b.corner}</div>
                <div className="text-[11px] text-ink-500">{b.neighborhood} · {SURFACE_META[b.surface].label}</div>
              </div>
              <div className="text-[13px] tabular-nums text-ink-200 shrink-0 ml-3">{fmtInt(b.impressions)}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function KpiTile({
  icon: Icon, label, value, sub, tone,
}: {
  icon: React.ComponentType<{ size?: number; className?: string; strokeWidth?: number }>;
  label: string; value: string; sub: string; tone: "cy" | "lime";
}) {
  const toneClass = tone === "cy"
    ? "bg-cy-400/10 text-cy-300 border-cy-400/30"
    : "bg-lime-400/10 text-lime-300 border-lime-400/30";
  return (
    <div className="card p-4 md:p-5">
      <div className={`w-8 h-8 mb-3 rounded-lg flex items-center justify-center border ${toneClass}`}>
        <Icon size={15} strokeWidth={1.8} />
      </div>
      <div className="text-[10px] uppercase tracking-wider text-ink-400 mb-1">{label}</div>
      <div className="text-xl md:text-2xl font-semibold text-ink-50 tabular-nums leading-tight">{value}</div>
      <div className="text-[11px] text-ink-500 mt-1.5">{sub}</div>
    </div>
  );
}

function SurfaceRow({
  icon: Icon, tone, label, imps, completions, spent, share, total: _total,
}: {
  icon: React.ComponentType<{ size?: number; className?: string; strokeWidth?: number }>;
  tone: "cy" | "lime"; label: string; imps: number; completions: number; spent: number; share: number; total: number;
}) {
  const bar = tone === "cy" ? "from-cy-500 to-cy-300" : "from-lime-500 to-lime-300";
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          <Icon size={14} className={tone === "cy" ? "text-cy-300" : "text-lime-300"} strokeWidth={1.8} />
          <span className="text-[14px] text-ink-100 font-medium">{label}</span>
        </div>
        <span className="text-[12px] text-ink-400 tabular-nums">{fmtPct(share, 0)}</span>
      </div>
      <div className="h-2 rounded-full bg-bg-900 overflow-hidden">
        <div className={`h-full bg-gradient-to-r ${bar}`} style={{ width: `${share * 100}%` }} />
      </div>
      <div className="flex justify-between mt-2 text-[11px] text-ink-500 tabular-nums">
        <span>{fmtInt(imps)} imps · {fmtPct(completions / imps, 0)} VCR</span>
        <span>{fmtCents(spent)}</span>
      </div>
    </div>
  );
}

function FunnelStep({
  icon: Icon, tone, label, value, sub,
}: {
  icon: React.ComponentType<{ size?: number; className?: string; strokeWidth?: number }>;
  tone: "cy" | "lime"; label: string; value: string; sub: string;
}) {
  const toneClass = tone === "cy" ? "text-cy-300" : "text-lime-300";
  return (
    <div className="card-tight px-3 py-3 text-center">
      <Icon size={16} className={`mx-auto mb-1.5 ${toneClass}`} strokeWidth={1.8} />
      <div className="text-lg md:text-xl font-semibold text-ink-50 tabular-nums leading-tight">{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-ink-400 mt-0.5">{label}</div>
      <div className="text-[10px] text-ink-500 mt-0.5">{sub}</div>
    </div>
  );
}
