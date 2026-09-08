"use client";

import type { ComponentType, ReactNode } from "react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { listMyCreatives, signedCreativeUrl, type Creative } from "@/lib/db";
import { useSession } from "@/lib/auth-client";
import { isSupabaseConfigured } from "@/lib/supabase";
import { StudioMedia } from "@/lib/studio";
import { Upload, Link2, Sparkles, Wand2, Loader2 } from "lucide-react";

export default function StudioPage() {
  const router = useRouter();
  const { user, loading } = useSession();
  const [recent, setRecent] = useState<Creative[] | null>(null);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!isSupabaseConfigured || loading) return;
    if (!user) { router.replace("/sign-in?next=/studio"); return; }
    listMyCreatives()
      .then(async (all) => {
        const four = all.slice(0, 4);
        setRecent(four);
        const entries = await Promise.all(four.map(async (c) => [c.id, await signedCreativeUrl(c.storage_path)] as const));
        setThumbs(Object.fromEntries(entries.filter(([, u]) => u) as [string, string][]));
      })
      .catch(() => setRecent([]));
  }, [user, loading, router]);

  if (!isSupabaseConfigured) {
    return <Shell><p className="text-ink-400 text-sm">Studio is not configured in this build.</p></Shell>;
  }

  return (
    <Shell>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
        <Link href="/studio/ingest/upload" className="group">
          <SourceCard icon={Upload} title="Upload a file" desc="MP4, PNG, or JPG. Up to 50MB. Lands in your library, ready to book." accent="cy" />
        </Link>
        <Link href="/studio/ingest/embed" className="group">
          <SourceCard icon={Link2} title="Embed a URL" desc="Paste a TikTok, YouTube, or direct MP4 link. We pull a public preview you can remix." accent="cy" />
        </Link>
        <Link href="/studio/create" className="group">
          <SourceCard icon={Wand2} title="Design with a template" desc="Glow, Bold, or Minimal. Type a headline, pick a color, done." accent="lime" />
        </Link>
        <Link href="/studio/generate" className="group">
          <SourceCard icon={Sparkles} title="Generate with AI" desc="Seedance, Kling, Veo, or Nano Banana. Text-to-street or remix a still." accent="lime" />
        </Link>
      </div>

      <div className="mt-12">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Wand2 size={18} className="text-lime-400" />
            <h2 className="text-lg font-medium text-ink-100">Recent creatives</h2>
          </div>
          {recent && recent.length > 0 && <Link href="/library" className="text-[13px] text-cy-300 hover:text-cy-200">All creatives →</Link>}
        </div>
        {!recent && <div className="flex items-center gap-2 text-ink-400 text-sm py-8 justify-center"><Loader2 size={15} className="animate-spin" /> Loading…</div>}
        {recent && recent.length === 0 && (
          <div className="card p-6 md:p-10 text-center">
            <p className="text-ink-400 text-sm">No creatives yet. Upload, embed, or generate one above.</p>
          </div>
        )}
        {recent && recent.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
            {recent.map((c) => {
              const url = thumbs[c.id];
              const isVideo = StudioMedia.isVideoPath(c.storage_path);
              return (
                <Link key={c.id} href={`/studio/generate?from=${c.id}`} className="card p-3 group block">
                  <div className="relative aspect-[9/16] rounded-lg overflow-hidden bg-bg-900 mb-2 flex items-center justify-center">
                    {url ? (
                      isVideo
                        ? <video src={url} className="w-full h-full object-cover" muted playsInline preload="metadata" />
                        : /* eslint-disable-next-line @next/next/no-img-element */
                          <img src={url} alt={c.name ?? "Creative"} className="w-full h-full object-cover" />
                    ) : <Loader2 size={14} className="animate-spin text-ink-600" />}
                  </div>
                  <div className="text-[12px] text-ink-100 truncate px-0.5">{c.name ?? "Untitled"}</div>
                  <div className="text-[11px] text-ink-500 px-0.5 mt-0.5">Remix with AI →</div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 md:px-8 py-6 md:py-10">
      <div className="mb-8">
        <p className="chip mb-3">Studio</p>
        <h1 className="text-2xl md:text-3xl font-semibold text-ink-50 tracking-tight">Creative Studio</h1>
        <p className="text-ink-400 mt-2">Make something for the street. Everything you create lands in your library, ready to book.</p>
      </div>
      {children}
    </div>
  );
}

function SourceCard({ icon: Icon, title, desc, accent }: {
  icon: ComponentType<{ size?: number; className?: string; strokeWidth?: number }>;
  title: string; desc: string; accent: "cy" | "lime";
}) {
  const accentClasses = accent === "cy"
    ? "group-hover:shadow-glow-cy group-hover:border-cy-400/40"
    : "group-hover:shadow-glow-lime group-hover:border-lime-400/40";
  return (
    <div className={`card p-5 md:p-6 h-full transition-all ${accentClasses} border-line-800`}>
      <div className="flex items-center justify-between mb-5">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
          accent === "cy" ? "bg-cy-400/10 text-cy-300" : "bg-lime-400/10 text-lime-300"
        }`}>
          <Icon size={20} strokeWidth={1.8} />
        </div>
      </div>
      <h3 className="text-base font-medium text-ink-100">{title}</h3>
      <p className="text-sm text-ink-400 mt-1.5">{desc}</p>
    </div>
  );
}
