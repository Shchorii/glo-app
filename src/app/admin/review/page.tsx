"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  adminReviewQueue, approveCampaign, rejectCreative, signedCreativeUrl, myRole,
  daysBetween, fmtUsd, type ReviewItem,
} from "@/lib/db";
import { daypartSummary } from "@/lib/dayparts";
import { useSession } from "@/lib/auth-client";
import { isSupabaseConfigured } from "@/lib/supabase";
import { ShieldCheck, CheckCircle2, XCircle, Loader2, ImageIcon, Calendar, Monitor, Clock } from "lucide-react";

export default function AdminReviewPage() {
  const { user, loading } = useSession();
  const [role, setRole] = useState<string | null>(null);
  const [queue, setQueue] = useState<ReviewItem[] | null>(null);
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const items = await adminReviewQueue();
    setQueue(items);
    const entries = await Promise.all(
      items
        .filter((c) => c.creative?.storage_path)
        .map(async (c) => [c.id, await signedCreativeUrl(c.creative!.storage_path)] as const)
    );
    setPreviews(Object.fromEntries(entries.filter(([, u]) => u) as [string, string][]));
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured || loading) return;
    if (!user) { setRole("none"); return; }
    myRole().then((r) => {
      setRole(r);
      if (r === "admin") refresh().catch((e) => setErr(String(e?.message ?? e)));
    });
  }, [user, loading, refresh]);

  async function act(id: string, fn: () => Promise<void>) {
    setBusyId(id); setErr(null);
    try {
      await fn();
      await refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  }

  if (!isSupabaseConfigured) return <Shell><p className="text-ink-400 text-sm">Not configured in this build.</p></Shell>;
  if (loading || role === null) return <Shell><Spinner label="Checking access…" /></Shell>;
  if (role !== "admin") {
    return (
      <Shell>
        <div className="card p-8 text-center max-w-md mx-auto">
          <p className="text-ink-300 text-sm mb-4">This area is for the Glo review team.</p>
          <Link href="/campaigns" className="btn btn-ghost">Back to campaigns</Link>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      {err && <p className="text-sm text-red-400 mb-4">{err}</p>}
      {!queue && <Spinner label="Loading queue…" />}
      {queue && queue.length === 0 && (
        <div className="card p-8 text-center">
          <CheckCircle2 size={32} className="mx-auto text-lime-300 mb-3" />
          <p className="text-ink-300 text-sm">Queue is clear. Nothing waiting for review.</p>
        </div>
      )}
      <div className="space-y-4">
        {queue?.map((c) => {
          const days = daysBetween(c.start_date, c.end_date);
          const url = previews[c.id];
          const isVideo = c.creative?.storage_path.endsWith(".mp4");
          const busy = busyId === c.id;
          return (
            <div key={c.id} className="card p-5 flex flex-col sm:flex-row gap-5">
              <div className="w-24 h-40 rounded-md overflow-hidden border border-line-800 bg-bg-900 flex items-center justify-center shrink-0">
                {url ? (
                  isVideo
                    ? <video src={url} className="w-full h-full object-cover" muted playsInline controls />
                    : /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={url} alt="Creative" className="w-full h-full object-cover" />
                ) : (
                  <ImageIcon size={18} className="text-ink-600" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[15px] font-semibold text-ink-50">{c.name}</span>
                  <span className="text-[13px] text-lime-300 tabular-nums">{fmtUsd(c.total_usd)} paid</span>
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-[12px] text-ink-400">
                  <span className="inline-flex items-center gap-1"><Calendar size={12} />{c.start_date} → {c.end_date} · {days}d</span>
                  <span className="inline-flex items-center gap-1"><Monitor size={12} />{c.screens.length} screens</span>
                  <span className="inline-flex items-center gap-1"><Clock size={12} />{daypartSummary(c.dayparts ?? [])}</span>
                </div>
                <div className="text-[12px] text-ink-500 mt-1 truncate">
                  {c.screens.map((s) => s.name).join(" · ") || "No screens attached"}
                </div>
                {!c.creative && <p className="text-[12px] text-amber-300 mt-1.5">No creative attached; ask the customer before approving.</p>}
                <div className="flex gap-2 mt-4">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => act(c.id, () => approveCampaign(c.id))}
                    className="btn btn-lime disabled:opacity-40"
                  >
                    {busy ? <Loader2 size={15} className="animate-spin" /> : <><CheckCircle2 size={15} /> Approve</>}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      const reason = window.prompt("Rejection reason (shown to the customer):");
                      if (reason === null) return;
                      act(c.id, () => rejectCreative(c.id, reason));
                    }}
                    className="btn btn-ghost text-red-300 hover:text-red-200 disabled:opacity-40"
                  >
                    <XCircle size={15} /> Reject
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 md:px-8 py-6 md:py-10">
      <div className="mb-6">
        <p className="chip mb-3 inline-flex items-center gap-1.5"><ShieldCheck size={12} /> Admin</p>
        <h1 className="text-2xl md:text-3xl font-semibold text-ink-50 tracking-tight">Review queue</h1>
        <p className="text-ink-400 mt-1.5 text-sm">Paid campaigns waiting for creative approval. Approve schedules delivery; reject sends it back with a reason.</p>
      </div>
      {children}
    </div>
  );
}

function Spinner({ label }: { label: string }) {
  return <div className="flex items-center gap-2 text-ink-400 text-sm py-10 justify-center"><Loader2 size={15} className="animate-spin" /> {label}</div>;
}
