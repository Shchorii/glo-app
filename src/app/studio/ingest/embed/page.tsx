"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type Creative } from "@/lib/db";
import { useSession } from "@/lib/auth-client";
import { isSupabaseConfigured } from "@/lib/supabase";
import { StudioApi, type StudioEmbedConfig } from "@/lib/studio";
import { StudioChrome } from "@/components/studio/StudioChrome";
import { Loader2, CheckCircle2, ArrowRight, Link2 } from "lucide-react";

const EMBED_SUBTITLE = "TikTok, YouTube, and public Instagram posts save a preview. Direct MP4 also works.";

export default function StudioEmbedPage() {
  const router = useRouter();
  const { user, loading } = useSession();
  const [url, setUrl] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [saved, setSaved] = useState<Creative | null>(null);
  const [config, setConfig] = useState<StudioEmbedConfig | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured || loading || !user) return;
    StudioApi.embedConfig().then(setConfig).catch(() => setConfig({ instagram_token: false }));
  }, [user, loading]);

  if (!isSupabaseConfigured) {
    return <StudioChrome kicker="Studio · embed" title="Embed a URL" subtitle={EMBED_SUBTITLE}><p className="text-ink-400 text-sm">Studio is not configured in this build.</p></StudioChrome>;
  }
  if (!loading && !user) {
    router.replace("/sign-in?next=/studio/ingest/embed");
    return <StudioChrome kicker="Studio · embed" title="Embed a URL" subtitle={EMBED_SUBTITLE}><Loader2 size={15} className="animate-spin text-ink-400" /></StudioChrome>;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null); setNote(null); setSaved(null);
    try {
      const result = await StudioApi.embed(url, name.trim() || undefined);
      setSaved(result.creative);
      setNote(result.note ?? null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <StudioChrome kicker="Studio · embed" title="Embed a URL" subtitle={EMBED_SUBTITLE}>
      {saved ? (
        <div className="card p-8 text-center max-w-lg mx-auto">
          <CheckCircle2 size={40} className="mx-auto text-lime-300 mb-4" />
          <h2 className="text-xl font-semibold text-ink-50 mb-2">Saved to your library</h2>
          <p className="text-sm text-ink-400 mb-6">{note ?? "Your creative is ready to remix or attach to a campaign."}</p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link href={`/studio/generate?from=${saved.id}`} className="btn btn-lime">Remix with AI</Link>
            <Link href="/library" className="btn btn-ghost">View library</Link>
            <Link href="/book" className="btn btn-ghost">Book it <ArrowRight size={14} /></Link>
          </div>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="card p-6 md:p-8 max-w-xl space-y-5">
          <div>
            <label className="block text-xs uppercase tracking-wider text-ink-400 mb-1.5">Video URL</label>
            <div className="relative">
              <Link2 size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-500" />
              <input
                type="url"
                required
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://www.instagram.com/p/… or TikTok / YouTube / MP4"
                className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-bg-900 border border-line-800 text-ink-50 focus:border-cy-400 focus:outline-none placeholder-ink-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wider text-ink-400 mb-1.5">Name <span className="normal-case tracking-normal text-ink-500">(optional)</span></label>
            <input
              type="text"
              maxLength={80}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Friday night special"
              className="w-full px-3 py-2.5 rounded-lg bg-bg-900 border border-line-800 text-ink-50 focus:border-cy-400 focus:outline-none placeholder-ink-500"
            />
          </div>
          {err && <p className="text-sm text-red-400">{err}</p>}
          <p className="text-[12px] text-ink-500">
            Instagram uses Meta oEmbed (tokenless). Optional <span className="font-mono text-[11px]">META_OEMBED_TOKEN</span> on studio-embed raises rate limits; {config?.instagram_token ? "detected." : "not set."}
          </p>
          <div className="flex justify-end">
            <button type="submit" disabled={busy || !url.trim()} className="btn btn-lime disabled:opacity-40">
              {busy ? <Loader2 size={15} className="animate-spin" /> : "Add to library"}
            </button>
          </div>
        </form>
      )}
    </StudioChrome>
  );
}
