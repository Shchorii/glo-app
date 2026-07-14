"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  getCampaign, cancelDraft, signedCreativeUrl, daysBetween, fmtUsd,
  type CampaignDetail, type CampaignStatus,
} from "@/lib/db";
import { ArrowLeft, MapPin, Calendar, Monitor, Loader2, ImageIcon, XCircle } from "lucide-react";

const STATUS_META: Record<CampaignStatus, { label: string; cls: string }> = {
  draft:           { label: "Draft",            cls: "bg-bg-700/60 text-ink-200 border-line-700" },
  pending_payment: { label: "Reserved",         cls: "bg-cy-400/15 text-cy-300 border-cy-400/30" },
  pending_review:  { label: "In review",        cls: "bg-amber-400/15 text-amber-300 border-amber-400/30" },
  scheduled:       { label: "Scheduled",        cls: "bg-cy-400/15 text-cy-300 border-cy-400/30" },
  live:            { label: "Live",             cls: "bg-lime-400/15 text-lime-300 border-lime-400/30" },
  completed:       { label: "Completed",        cls: "bg-bg-700/60 text-ink-200 border-line-700" },
  cancelled:       { label: "Cancelled",        cls: "bg-bg-700/60 text-ink-500 border-line-800" },
  refunded:        { label: "Refunded",         cls: "bg-bg-700/60 text-ink-500 border-line-800" },
};

function CampaignView() {
  const params = useSearchParams();
  const router = useRouter();
  const id = params.get("id");
  const [c, setC] = useState<CampaignDetail | null | "loading">("loading");
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!id) { setC(null); return; }
    getCampaign(id)
      .then((res) => {
        setC(res);
        if (res?.creative?.storage_path) {
          signedCreativeUrl(res.creative.storage_path).then(setImgUrl);
        }
      })
      .catch((e) => { setErr(String(e?.message ?? e)); setC(null); });
  }, [id]);

  if (c === "loading") {
    return <div className="flex items-center gap-2 text-ink-400 text-sm py-12 justify-center"><Loader2 size={15} className="animate-spin" /> Loading campaign…</div>;
  }
  if (!c) {
    return (
      <div className="py-12 text-center">
        <p className="text-ink-400 text-sm mb-4">{err ?? "Campaign not found (or you are signed out)."}</p>
        <Link href="/campaigns" className="btn btn-ghost">Back to campaigns</Link>
      </div>
    );
  }

  const days = daysBetween(c.start_date, c.end_date);
  const meta = STATUS_META[c.status];
  const isVideo = c.creative?.storage_path.endsWith(".mp4");

  async function onCancel() {
    if (!c || c === "loading" || c.status !== "draft") return;
    setBusy(true); setErr(null);
    try {
      await cancelDraft(c.id);
      router.push("/campaigns");
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  return (
    <div>
      <Link href="/campaigns" className="inline-flex items-center gap-1.5 text-sm text-ink-300 hover:text-ink-50 mb-5">
        <ArrowLeft size={15} /> Campaigns
      </Link>

      <div className="card p-5 md:p-7">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
          <div className="min-w-0">
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider font-medium border ${meta.cls}`}>
              {meta.label}
            </span>
            <h1 className="text-xl md:text-2xl font-semibold text-ink-50 mt-2">{c.name}</h1>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-[13px] text-ink-400">
              <span className="inline-flex items-center gap-1.5"><Calendar size={13} />{c.start_date} → {c.end_date} · {days} day{days === 1 ? "" : "s"}</span>
              <span className="inline-flex items-center gap-1.5"><Monitor size={13} />{c.screens.length} screen{c.screens.length === 1 ? "" : "s"}</span>
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-2xl font-semibold text-ink-50 tabular-nums">{fmtUsd(c.total_usd)}</div>
            <div className="text-[11px] text-ink-500">{c.status === "pending_payment" ? "due at checkout" : "total"}</div>
          </div>
        </div>

        {c.status === "pending_payment" && (
          <div className="rounded-lg border border-cy-400/30 bg-cy-400/5 px-4 py-3 text-[13px] text-cy-200 mb-5">
            Reserved. Checkout opens in the next release; your screens and dates are held.
          </div>
        )}

        {/* Creative */}
        <div className="mb-5">
          <div className="text-xs uppercase tracking-wider text-ink-400 mb-2">Creative</div>
          {c.creative ? (
            <div className="flex items-center gap-4">
              <div className="w-24 h-40 rounded-md overflow-hidden border border-line-800 bg-bg-900 flex items-center justify-center shrink-0">
                {imgUrl ? (
                  isVideo
                    ? <video src={imgUrl} className="w-full h-full object-cover" muted playsInline />
                    : /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={imgUrl} alt="Creative preview" className="w-full h-full object-cover" />
                ) : (
                  <ImageIcon size={18} className="text-ink-600" />
                )}
              </div>
              <div className="text-[13px] text-ink-400">
                <div className="text-ink-100 capitalize">{c.creative.source}</div>
                <div className="mt-0.5 capitalize">Review: {c.creative.review_status}</div>
                {c.creative.rejection_reason && <div className="mt-0.5 text-red-400">{c.creative.rejection_reason}</div>}
              </div>
            </div>
          ) : (
            <p className="text-[13px] text-ink-500">No creative attached yet.</p>
          )}
        </div>

        {/* Screens */}
        <div>
          <div className="text-xs uppercase tracking-wider text-ink-400 mb-2">Screens</div>
          <div className="divide-y divide-line-900">
            {c.screens.map((s) => (
              <div key={s.id} className="flex items-center justify-between py-2.5">
                <div className="min-w-0">
                  <div className="text-[14px] text-ink-100 truncate">{s.name}</div>
                  <div className="text-[11px] text-ink-500 capitalize flex items-center gap-1"><MapPin size={11} /> {s.city} · {s.venue_type}</div>
                </div>
                <div className="text-[13px] tabular-nums text-ink-200 shrink-0 ml-3">${s.daily_price_usd}/day</div>
              </div>
            ))}
          </div>
        </div>

        {err && <p className="text-sm text-red-400 mt-4">{err}</p>}

        {c.status === "draft" && (
          <div className="mt-6 pt-4 border-t border-line-900 flex justify-end">
            <button type="button" disabled={busy} onClick={onCancel} className="btn btn-ghost text-red-300 hover:text-red-200 disabled:opacity-40">
              {busy ? <Loader2 size={15} className="animate-spin" /> : <><XCircle size={15} /> Cancel draft</>}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function CampaignViewPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 md:px-8 py-6 md:py-10">
      <Suspense fallback={<div className="flex items-center gap-2 text-ink-400 text-sm py-12 justify-center"><Loader2 size={15} className="animate-spin" /> Loading…</div>}>
        <CampaignView />
      </Suspense>
    </div>
  );
}
