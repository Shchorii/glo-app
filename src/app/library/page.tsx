"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { listMyCreatives, deleteCreative, signedCreativeUrl, type Creative } from "@/lib/db";
import { useSession } from "@/lib/auth-client";
import { isSupabaseConfigured } from "@/lib/supabase";
import { Sparkles, Upload, Loader2, Trash2, Wand2 } from "lucide-react";

const STATUS_CHIP: Record<Creative["review_status"], { label: string; cls: string }> = {
  pending:  { label: "Pending review", cls: "bg-bg-950/70 text-ink-200" },
  approved: { label: "Approved",       cls: "bg-lime-400/20 text-lime-200" },
  rejected: { label: "Rejected",       cls: "bg-red-400/20 text-red-200" },
};

export default function LibraryPage() {
  const router = useRouter();
  const { user, loading } = useSession();
  const [items, setItems] = useState<Creative[] | null>(null);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const all = await listMyCreatives();
    setItems(all);
    const entries = await Promise.all(all.map(async (c) => [c.id, await signedCreativeUrl(c.storage_path)] as const));
    setUrls(Object.fromEntries(entries.filter(([, u]) => u) as [string, string][]));
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured || loading) return;
    if (!user) { router.replace("/sign-in?next=/library"); return; }
    refresh().catch((e) => { setErr(String(e?.message ?? e)); setItems([]); });
  }, [user, loading, router, refresh]);

  async function onDelete(c: Creative) {
    if (!window.confirm(`Delete "${c.name ?? "this creative"}"? This cannot be undone.`)) return;
    setBusyId(c.id); setErr(null);
    try {
      await deleteCreative(c);
      await refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  }

  if (!isSupabaseConfigured) {
    return <Shell count={0}><p className="text-ink-400 text-sm">The library is not configured in this build.</p></Shell>;
  }

  return (
    <Shell count={items?.length ?? 0}>
      {err && <p className="text-sm text-red-400 mb-4">{err}</p>}
      {!items && <div className="flex items-center gap-2 text-ink-400 text-sm py-12 justify-center"><Loader2 size={15} className="animate-spin" /> Loading creatives…</div>}
      {items && items.length === 0 && (
        <div className="card p-8 md:p-12 text-center">
          <Wand2 size={28} className="mx-auto text-ink-500 mb-3" />
          <p className="text-ink-300 text-sm mb-4">Nothing here yet. Your first creative is sixty seconds away.</p>
          <Link href="/studio" className="btn btn-primary">Open the Studio</Link>
        </div>
      )}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
        {items?.map((c) => {
          const url = urls[c.id];
          const isVideo = c.storage_path.endsWith(".mp4");
          const chip = STATUS_CHIP[c.review_status];
          const busy = busyId === c.id;
          return (
            <div key={c.id} className="card p-3 group">
              <div className="relative aspect-[9/16] rounded-lg overflow-hidden bg-bg-900 mb-3 flex items-center justify-center">
                {url ? (
                  isVideo
                    ? <video src={url} className="w-full h-full object-cover" muted playsInline preload="metadata" controls />
                    : /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={url} alt={c.name ?? "Creative"} className="w-full h-full object-cover" />
                ) : (
                  <Loader2 size={14} className="animate-spin text-ink-600" />
                )}
                <div className="absolute top-2 left-2 flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wider bg-bg-950/70 backdrop-blur text-ink-200">
                  {c.source === "template" ? <><Sparkles size={9} className="text-lime-300" /><span>Template</span></> : <><Upload size={9} /><span>Upload</span></>}
                </div>
                <div className={`absolute top-2 right-2 px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wider backdrop-blur ${chip.cls}`}>
                  {chip.label}
                </div>
                {(c.width_px || c.duration_s) && (
                  <div className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded text-[9px] font-mono bg-bg-950/70 backdrop-blur text-ink-200">
                    {c.width_px && c.height_px ? `${c.width_px}×${c.height_px}` : ""}{c.width_px && c.duration_s ? " · " : ""}{c.duration_s ? `${c.duration_s}s` : ""}
                  </div>
                )}
              </div>
              <div className="px-1 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[13px] text-ink-100 font-medium leading-snug line-clamp-2">{c.name ?? "Untitled"}</div>
                  <div className="text-[11px] text-ink-500 mt-1">
                    {new Date(c.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </div>
                  {c.rejection_reason && <div className="text-[11px] text-red-400 mt-1 line-clamp-2">{c.rejection_reason}</div>}
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onDelete(c)}
                  className="shrink-0 p-1.5 rounded text-ink-500 hover:text-red-300 hover:bg-bg-800 disabled:opacity-40"
                  aria-label="Delete creative"
                >
                  {busy ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </Shell>
  );
}

function Shell({ children, count }: { children: React.ReactNode; count: number }) {
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 md:px-8 py-6 md:py-10">
      <div className="flex flex-wrap items-baseline justify-between gap-3 mb-6 md:mb-8">
        <div>
          <p className="chip mb-3">Library</p>
          <h1 className="text-2xl md:text-3xl font-semibold text-ink-50 tracking-tight">Your creatives</h1>
          <p className="text-ink-400 mt-1.5 text-sm">{count} creative{count === 1 ? "" : "s"} · attach any of them when you book</p>
        </div>
        <Link href="/studio" className="btn btn-primary">+ New creative</Link>
      </div>
      {children}
    </div>
  );
}
