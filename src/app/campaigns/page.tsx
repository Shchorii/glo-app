"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "@/lib/auth-client";
import { isSupabaseConfigured } from "@/lib/supabase";
import { listMyCampaigns, daysBetween, fmtUsd, type Campaign, type CampaignStatus } from "@/lib/db";
import DemoCampaignShowcase from "@/components/DemoCampaignShowcase";
import { Loader2, Monitor, Calendar, ArrowRight, Plus } from "lucide-react";

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

export default function CampaignsPage() {
  const { user, loading } = useSession();
  const [campaigns, setCampaigns] = useState<Campaign[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!user) { setCampaigns(null); return; }
    listMyCampaigns().then(setCampaigns).catch((e) => setErr(String(e?.message ?? e)));
  }, [user]);

  const signedIn = Boolean(user) && isSupabaseConfigured;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 md:px-8 py-6 md:py-10">
      <div className="flex flex-wrap items-baseline justify-between gap-4 mb-6 md:mb-8">
        <div>
          <p className="chip mb-3">Campaigns</p>
          <h1 className="text-2xl md:text-3xl font-semibold text-ink-50 tracking-tight">Campaigns</h1>
          <p className="text-ink-400 mt-1.5 text-sm">All your neighborhoods, all your screens.</p>
        </div>
        <Link href="/book" className="btn btn-primary"><Plus size={15} /> Book screens</Link>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-ink-400 text-sm py-10 justify-center">
          <Loader2 size={15} className="animate-spin" /> Loading…
        </div>
      )}

      {!loading && signedIn && (
        <>
          {err && <p className="text-sm text-red-400 mb-4">{err}</p>}
          {campaigns && campaigns.length === 0 && (
            <div className="card p-8 text-center">
              <h2 className="text-lg font-medium text-ink-50 mb-1.5">No campaigns yet</h2>
              <p className="text-sm text-ink-400 mb-5">Pick your first screens and light up a neighborhood.</p>
              <Link href="/book" className="btn btn-primary">Book your first screens</Link>
            </div>
          )}
          {campaigns && campaigns.length > 0 && (
            <div className="space-y-3">
              {campaigns.map((c) => {
                const meta = STATUS_META[c.status];
                const days = daysBetween(c.start_date, c.end_date);
                return (
                  <Link
                    key={c.id}
                    href={`/campaigns/view?id=${c.id}`}
                    className="card p-4 md:p-5 flex items-center justify-between gap-3 hover:border-cy-400/40 transition-colors group"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider font-medium border ${meta.cls}`}>
                          {meta.label}
                        </span>
                      </div>
                      <div className="text-[15px] md:text-base font-medium text-ink-50 truncate">{c.name}</div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-[12px] text-ink-400">
                        <span className="inline-flex items-center gap-1"><Calendar size={11} />{c.start_date} → {c.end_date} · {days}d</span>
                        <span className="inline-flex items-center gap-1"><Monitor size={11} />{c.screen_count} screen{c.screen_count === 1 ? "" : "s"}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-[15px] font-semibold text-ink-50 tabular-nums">{fmtUsd(c.total_usd)}</span>
                      <ArrowRight size={16} className="text-ink-500 group-hover:text-cy-300 group-hover:translate-x-0.5 transition-all" />
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
          {!campaigns && !err && (
            <div className="flex items-center gap-2 text-ink-400 text-sm py-10 justify-center">
              <Loader2 size={15} className="animate-spin" /> Loading campaigns…
            </div>
          )}
        </>
      )}

      {!loading && !signedIn && <DemoCampaignShowcase />}
    </div>
  );
}
