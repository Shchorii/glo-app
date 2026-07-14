"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "@/lib/auth-client";
import { isSupabaseConfigured } from "@/lib/supabase";
import { listMyCampaigns, daysBetween, fmtUsd, CAMPAIGN_STATUS_META, type Campaign } from "@/lib/db";
import DemoCampaignShowcase from "@/components/DemoCampaignShowcase";
import { Loader2, Monitor, Calendar, ArrowRight, Plus } from "lucide-react";
import { PageContainer } from "@/components/PageContainer";

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
    <PageContainer>
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
                const meta = CAMPAIGN_STATUS_META[c.status];
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
    </PageContainer>
  );
}
