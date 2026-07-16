"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "@/lib/auth-client";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import { listMyCampaigns, fmtUsd, type Campaign, type CampaignStatus } from "@/lib/db";
import { Loader2, Monitor, Rocket, ShieldCheck, DollarSign, ArrowRight, Plus, Radio } from "lucide-react";

const STATUS_META: Record<CampaignStatus, { label: string; cls: string }> = {
  draft:           { label: "Draft",     cls: "bg-bg-700/60 text-ink-200 border-line-700" },
  pending_payment: { label: "Reserved",  cls: "bg-cy-400/15 text-cy-300 border-cy-400/30" },
  pending_review:  { label: "In review", cls: "bg-amber-400/15 text-amber-300 border-amber-400/30" },
  scheduled:       { label: "Scheduled", cls: "bg-cy-400/15 text-cy-300 border-cy-400/30" },
  live:            { label: "Live",      cls: "bg-lime-400/15 text-lime-300 border-lime-400/30" },
  completed:       { label: "Completed", cls: "bg-bg-700/60 text-ink-200 border-line-700" },
  cancelled:       { label: "Cancelled", cls: "bg-bg-700/60 text-ink-500 border-line-800" },
  refunded:        { label: "Refunded",  cls: "bg-bg-700/60 text-ink-500 border-line-800" },
};

type JobRow = { campaign_id: string; state: string };

export default function DashboardPage() {
  const { user, loading } = useSession();
  const [campaigns, setCampaigns] = useState<Campaign[] | null>(null);
  const [jobs, setJobs] = useState<JobRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!user) { setCampaigns(null); setJobs(null); return; }
    listMyCampaigns().then(setCampaigns).catch((e) => setErr(String(e?.message ?? e)));
    const sb = getSupabase();
    if (sb) {
      sb.from("delivery_jobs")
        .select("campaign_id, state")
        .then(({ data, error }) => {
          if (!error) setJobs((data ?? []) as JobRow[]);
        });
    }
  }, [user]);

  if (!isSupabaseConfigured) {
    return <Shell><p className="text-ink-400 text-sm">Supabase is not configured.</p></Shell>;
  }
  if (loading || (user && campaigns === null && !err)) {
    return (
      <Shell>
        <div className="flex items-center gap-2 text-ink-400 text-sm">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading your campaigns
        </div>
      </Shell>
    );
  }
  if (!user) {
    return (
      <Shell>
        <p className="text-ink-400 text-sm">
          <Link href="/sign-in" className="text-cy-300 hover:text-cy-200">Sign in</Link> to see your dashboard.
        </p>
      </Shell>
    );
  }
  if (err) {
    return <Shell><p className="text-red-400 text-sm">{err}</p></Shell>;
  }

  const all = campaigns ?? [];
  const paidStatuses: CampaignStatus[] = ["pending_review", "scheduled", "live", "completed"];
  const active = all.filter((c) => c.status === "live" || c.status === "scheduled");
  const inReview = all.filter((c) => c.status === "pending_review");
  const spent = all.filter((c) => paidStatuses.includes(c.status)).reduce((s, c) => s + c.total_usd, 0);
  const screensBooked = all
    .filter((c) => c.status === "live" || c.status === "scheduled")
    .reduce((s, c) => s + (c.screen_count ?? 0), 0);

  const jobList = jobs ?? [];
  const jobsDone = jobList.filter((j) => j.state === "done").length;
  const jobsRunning = jobList.filter((j) => j.state === "running").length;
  const jobsQueued = jobList.length - jobsDone - jobsRunning;

  const recent = all.slice(0, 6);

  return (
    <Shell>
      {all.length === 0 ? (
        <div className="card p-8 text-center space-y-4">
          <p className="text-ink-100 font-medium">No campaigns yet.</p>
          <p className="text-ink-400 text-sm">Pick screens on the map, set your dates, and go live on the street.</p>
          <Link href="/book" className="btn btn-primary inline-flex items-center gap-1.5">
            <Plus className="w-4 h-4" /> Book your first campaign
          </Link>
        </div>
      ) : (
        <>
          {/* KPI tiles: real numbers only */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
            <KpiTile icon={Rocket}      label="Active"         value={String(active.length)}        sub={`${all.length} total`} tone="lime" />
            <KpiTile icon={ShieldCheck} label="In review"      value={String(inReview.length)}      sub="Usually under 2 hours" tone="cy" />
            <KpiTile icon={Monitor}     label="Screens booked" value={String(screensBooked)}        sub="Across active campaigns" tone="cy" />
            <KpiTile icon={DollarSign}  label="Invested"       value={fmtUsd(spent)}                sub="Paid campaigns" tone="lime" />
          </div>

          {/* Delivery pipeline: real delivery_jobs states */}
          {jobList.length > 0 && (
            <section className="card p-5 md:p-6">
              <h2 className="text-sm font-medium text-ink-100 mb-4 flex items-center gap-2">
                <Radio className="w-4 h-4 text-cy-300" />
                <span>Delivery pipeline</span>
              </h2>
              <div className="grid grid-cols-3 gap-3 text-center">
                <PipeStat label="Queued"  value={jobsQueued}  cls="text-ink-200" />
                <PipeStat label="Running" value={jobsRunning} cls="text-cy-300" />
                <PipeStat label="Done"    value={jobsDone}    cls="text-lime-300" />
              </div>
              <p className="text-[11px] text-ink-500 mt-3">
                One job per publisher network per campaign. Play-level metrics arrive as screens report.
              </p>
            </section>
          )}

          {/* Recent campaigns */}
          <section className="card p-5 md:p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-medium text-ink-100">Recent campaigns</h2>
              <Link href="/campaigns" className="text-[13px] text-cy-300 hover:text-cy-200 inline-flex items-center gap-1">
                All campaigns <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            <ul className="divide-y divide-line-800">
              {recent.map((c) => {
                const meta = STATUS_META[c.status];
                return (
                  <li key={c.id}>
                    <Link href={`/campaigns/view?id=${c.id}`} className="flex items-center justify-between gap-3 py-3 group">
                      <div className="min-w-0">
                        <p className="text-sm text-ink-50 truncate group-hover:text-cy-200">{c.name}</p>
                        <p className="text-[12px] text-ink-500 mt-0.5">
                          {c.start_date} to {c.end_date} · {c.screen_count ?? 0} screen{(c.screen_count ?? 0) === 1 ? "" : "s"} · {fmtUsd(c.total_usd)}
                        </p>
                      </div>
                      <span className={`shrink-0 text-[11px] px-2 py-0.5 rounded-full border ${meta.cls}`}>{meta.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>

          <div className="flex justify-center">
            <Link href="/book" className="btn btn-primary inline-flex items-center gap-1.5">
              <Plus className="w-4 h-4" /> Book another campaign
            </Link>
          </div>
        </>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 md:px-8 py-6 md:py-10 space-y-6 md:space-y-8">
      <div>
        <p className="chip mb-3">Dashboard</p>
        <h1 className="text-2xl md:text-3xl font-semibold text-ink-50 tracking-tight">Your street presence</h1>
      </div>
      {children}
    </div>
  );
}

function KpiTile({ icon: Icon, label, value, sub, tone }: {
  icon: React.ComponentType<{ className?: string }>; label: string; value: string; sub: string; tone: "cy" | "lime";
}) {
  return (
    <div className="card p-4 md:p-5">
      <div className="flex items-center gap-2 text-ink-400 text-[12px] mb-2">
        <Icon className={`w-4 h-4 ${tone === "cy" ? "text-cy-300" : "text-lime-300"}`} />
        {label}
      </div>
      <p className="text-xl md:text-2xl font-semibold text-ink-50">{value}</p>
      <p className="text-[11px] text-ink-500 mt-1">{sub}</p>
    </div>
  );
}

function PipeStat({ label, value, cls }: { label: string; value: number; cls: string }) {
  return (
    <div className="rounded-lg border border-line-800 bg-bg-900 py-3">
      <p className={`text-lg font-semibold ${cls}`}>{value}</p>
      <p className="text-[11px] text-ink-500">{label}</p>
    </div>
  );
}
