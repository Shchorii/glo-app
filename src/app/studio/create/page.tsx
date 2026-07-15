"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { TemplateBuilder, renderTemplatePng, CANVAS_W, CANVAS_H, type TemplateSpec } from "@/components/TemplateBuilder";
import { uploadCreative } from "@/lib/db";
import { useSession } from "@/lib/auth-client";
import { isSupabaseConfigured } from "@/lib/supabase";
import { ArrowLeft, Loader2, CheckCircle2, ArrowRight, Save } from "lucide-react";

export default function StudioCreatePage() {
  const router = useRouter();
  const { user, loading } = useSession();
  const [spec, setSpec] = useState<TemplateSpec>({ preset: "glow", headline: "", subline: "", accent: "#22D3EE" });
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  if (!isSupabaseConfigured) {
    return <Shell><p className="text-ink-400 text-sm">Studio is not configured in this build.</p></Shell>;
  }
  if (!loading && !user) {
    router.replace("/sign-in?next=/studio/create");
    return <Shell><Loader2 size={15} className="animate-spin text-ink-400" /></Shell>;
  }

  async function onSave() {
    setSaving(true); setErr(null);
    try {
      const blob = await renderTemplatePng(spec);
      const c = await uploadCreative(blob, {
        source: "template",
        ext: "png",
        name: name.trim() || spec.headline.trim() || "Template creative",
        width: CANVAS_W,
        height: CANVAS_H,
      });
      setSavedId(c.id);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Shell>
      {savedId ? (
        <div className="card p-8 text-center max-w-lg mx-auto">
          <CheckCircle2 size={40} className="mx-auto text-lime-300 mb-4" />
          <h2 className="text-xl font-semibold text-ink-50 mb-2">Saved to your library</h2>
          <p className="text-sm text-ink-400 mb-6">Your creative is ready to attach to any campaign.</p>
          <div className="flex justify-center gap-3">
            <Link href="/book" className="btn btn-lime">Book it <ArrowRight size={14} /></Link>
            <Link href="/library" className="btn btn-ghost">View library</Link>
            <button type="button" className="btn btn-ghost" onClick={() => { setSavedId(null); }}>Make another</button>
          </div>
        </div>
      ) : (
        <div className="space-y-5 max-w-3xl">
          <div>
            <label className="block text-xs uppercase tracking-wider text-ink-400 mb-1.5">Creative name</label>
            <input
              type="text" maxLength={80} value={name} onChange={(e) => setName(e.target.value)}
              placeholder={spec.headline.trim() || "Late night special"}
              className="w-full max-w-sm px-3 py-2.5 rounded-lg bg-bg-900 border border-line-800 text-ink-50 focus:border-cy-400 focus:outline-none placeholder-ink-500"
            />
          </div>
          <TemplateBuilder spec={spec} onChange={setSpec} />
          {err && <p className="text-sm text-red-400">{err}</p>}
          <div className="flex justify-end pt-2">
            <button
              type="button"
              disabled={saving || !spec.headline.trim()}
              onClick={onSave}
              className="btn btn-lime disabled:opacity-40"
            >
              {saving ? <Loader2 size={15} className="animate-spin" /> : <><Save size={15} /> Save to library</>}
            </button>
          </div>
        </div>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 md:px-8 py-6 md:py-10">
      <Link href="/studio" className="inline-flex items-center gap-1.5 text-sm text-ink-300 hover:text-ink-50 mb-5">
        <ArrowLeft size={15} /> Studio
      </Link>
      <div className="mb-6">
        <p className="chip mb-3">Studio · template</p>
        <h1 className="text-2xl md:text-3xl font-semibold text-ink-50 tracking-tight">Design a creative</h1>
        <p className="text-ink-400 mt-1.5 text-sm">1080×1920 portrait, built for street screens. Saved creatives land in your library.</p>
      </div>
      {children}
    </div>
  );
}
