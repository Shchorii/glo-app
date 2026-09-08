"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { uploadCreative, type Creative } from "@/lib/db";
import { useSession } from "@/lib/auth-client";
import { isSupabaseConfigured } from "@/lib/supabase";
import { FileProbe, MAX_UPLOAD_MB } from "@/lib/studio";
import { StudioChrome } from "@/components/studio/StudioChrome";
import { Loader2, CheckCircle2, ArrowRight, AlertTriangle, Upload } from "lucide-react";

export default function StudioUploadPage() {
  const router = useRouter();
  const { user, loading } = useSession();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [uploaded, setUploaded] = useState<Creative | null>(null);
  const [err, setErr] = useState<string | null>(null);

  if (!isSupabaseConfigured) {
    return <StudioChrome kicker="Studio · upload" title="Upload a creative" subtitle="MP4, PNG, or JPG for street screens."><p className="text-ink-400 text-sm">Studio is not configured in this build.</p></StudioChrome>;
  }
  if (!loading && !user) {
    router.replace("/sign-in?next=/studio/ingest/upload");
    return <StudioChrome kicker="Studio · upload" title="Upload a creative" subtitle="MP4, PNG, or JPG for street screens."><Loader2 size={15} className="animate-spin text-ink-400" /></StudioChrome>;
  }

  async function onFile(f: File | undefined) {
    if (!f) return;
    if (f.size > MAX_UPLOAD_MB * 1024 * 1024) { setErr(`File is too big. Keep it under ${MAX_UPLOAD_MB}MB.`); return; }
    setErr(null); setUploading(true); setUploaded(null); setWarnings([]);
    try {
      const meta = await FileProbe.probe(f);
      setWarnings(FileProbe.specWarnings(meta));
      const ext = (f.name.split(".").pop() || "bin").toLowerCase();
      const name = f.name.replace(/\.[^.]+$/, "");
      const c = await uploadCreative(f, { source: "upload", ext, name, ...meta });
      setUploaded(c);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <StudioChrome kicker="Studio · upload" title="Upload a creative" subtitle="MP4, PNG, or JPG. Up to 50MB. Lands in your library, ready to book or remix.">
      <input
        ref={fileRef}
        type="file"
        accept="video/mp4,image/png,image/jpeg"
        className="hidden"
        onChange={(e) => onFile(e.target.files?.[0])}
      />

      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={uploading}
        className="card p-8 md:p-12 w-full text-center border-dashed border-line-800 hover:border-cy-400/40 transition-all disabled:opacity-60"
      >
        <div className="w-12 h-12 rounded-lg bg-cy-400/10 text-cy-300 flex items-center justify-center mx-auto mb-4">
          {uploading ? <Loader2 size={22} className="animate-spin" /> : <Upload size={22} strokeWidth={1.8} />}
        </div>
        <p className="text-ink-100 font-medium">{uploading ? "Uploading…" : "Drop a file or click to browse"}</p>
        <p className="text-sm text-ink-400 mt-1.5">Portrait 1080×1920 looks best on Glo screens.</p>
      </button>

      {err && <p className="text-sm text-red-400 mt-5">{err}</p>}
      {uploaded && (
        <div className="mt-5 rounded-lg border border-lime-400/30 bg-lime-400/5 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <span className="text-[13px] text-lime-200 inline-flex items-center gap-2">
            <CheckCircle2 size={15} /> {uploaded.name ?? "Creative"} is in your library.
          </span>
          <div className="flex gap-2">
            <Link href={`/studio/generate?from=${uploaded.id}`} className="btn btn-ghost">Remix with AI</Link>
            <Link href="/library" className="btn btn-ghost">View library</Link>
            <Link href="/book" className="btn btn-lime">Book it <ArrowRight size={14} /></Link>
          </div>
        </div>
      )}
      {uploaded && warnings.length > 0 && (
        <div className="mt-2.5 rounded-lg border border-amber-400/30 bg-amber-400/5 px-4 py-3 space-y-1.5">
          {warnings.map((w, i) => (
            <p key={i} className="text-[12px] text-amber-200 flex items-start gap-2">
              <AlertTriangle size={13} className="shrink-0 mt-0.5" /> <span>{w}</span>
            </p>
          ))}
        </div>
      )}
    </StudioChrome>
  );
}
