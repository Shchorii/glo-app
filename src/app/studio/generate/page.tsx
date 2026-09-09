"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { listMyCreatives, signedCreativeUrl, uploadCreative, type Creative } from "@/lib/db";
import { useSession } from "@/lib/auth-client";
import { isSupabaseConfigured } from "@/lib/supabase";
import { StudioApi, StudioMedia, StudioModels, type StudioModelId, type StudioProviders } from "@/lib/studio";
import { StudioChrome } from "@/components/studio/StudioChrome";
import { Loader2, CheckCircle2, ArrowRight, Sparkles } from "lucide-react";

export default function StudioGeneratePage() {
  return (
    <Suspense fallback={<StudioChrome kicker="Studio · generate" title="Generate with AI" subtitle="Street-ready 9:16 from a prompt, or remix a still you already have."><Loader2 size={15} className="animate-spin text-ink-400" /></StudioChrome>}>
      <GenerateForm />
    </Suspense>
  );
}

function GenerateForm() {
  const router = useRouter();
  const params = useSearchParams();
  const fromId = params.get("from");
  const { user, loading } = useSession();
  const [model, setModel] = useState<StudioModelId>("seedance");
  const [prompt, setPrompt] = useState("");
  const [name, setName] = useState("");
  const [library, setLibrary] = useState<Creative[]>([]);
  const [remixId, setRemixId] = useState<string>("");
  const [providers, setProviders] = useState<StudioProviders | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [saved, setSaved] = useState<Creative | null>(null);

  const def = StudioModels.get(model);
  const remixable = useMemo(
    () => library.filter((c) => StudioMedia.isImagePath(c.storage_path)),
    [library],
  );

  useEffect(() => {
    if (!isSupabaseConfigured || loading) return;
    if (!user) { router.replace("/sign-in?next=/studio/generate"); return; }
    listMyCreatives().then((all) => {
      setLibrary(all);
      if (fromId && all.some((c) => c.id === fromId && StudioMedia.isImagePath(c.storage_path))) {
        setRemixId(fromId);
      }
    }).catch(() => setLibrary([]));
    StudioApi.providers().then(setProviders).catch(() => setProviders({ fal: false, higgsfield: false }));
  }, [user, loading, router, fromId]);

  if (!isSupabaseConfigured) {
    return <StudioChrome kicker="Studio · generate" title="Generate with AI" subtitle="Street-ready 9:16 from a prompt, or remix a still you already have."><p className="text-ink-400 text-sm">Studio is not configured in this build.</p></StudioChrome>;
  }

  async function onGenerate() {
    setBusy(true); setErr(null); setSaved(null); setStatus("Submitting…");
    try {
      let image_url: string | undefined;
      if (remixId) {
        const chosen = library.find((c) => c.id === remixId);
        if (!chosen) throw new Error("That creative is gone.");
        if (!StudioMedia.isImagePath(chosen.storage_path)) {
          throw new Error("Remix needs a still (PNG/JPG). Generate a Nano Banana poster first, or upload an image.");
        }
        const signed = await signedCreativeUrl(chosen.storage_path);
        if (!signed) throw new Error("Could not read that creative.");
        image_url = signed;
      }

      const job = await StudioApi.submitGenerate({
        model,
        prompt: prompt.trim(),
        image_url,
        name: name.trim() || undefined,
      });
      setStatus("Queued on fal.ai…");

      const started = Date.now();
      let mediaUrl: string | null = null;
      let kind: "video" | "image" = job.kind;
      while (Date.now() - started < 180_000) {
        const poll = await StudioApi.pollGenerate(job);
        if (poll.status === "IN_QUEUE") setStatus("In queue…");
        else if (poll.status === "IN_PROGRESS") setStatus("Generating… this can take a minute.");
        else if (poll.status === "FAILED") throw new Error(poll.error || "Generation failed.");
        else if (poll.status === "COMPLETED") {
          if (!poll.media_url) throw new Error("Generation finished with no file.");
          mediaUrl = poll.media_url;
          kind = poll.kind ?? kind;
          break;
        }
        await new Promise((r) => setTimeout(r, 2500));
      }
      if (!mediaUrl) throw new Error("Timed out waiting for fal.ai. Try again in a moment.");

      setStatus("Saving to your library…");
      const { blob, ext } = await StudioMedia.download(mediaUrl);
      const label = name.trim() || prompt.trim().slice(0, 60);
      const c = await uploadCreative(blob, {
        source: "ai",
        ext,
        name: label,
        duration: kind === "video" ? (model === "veo" ? 8 : 5) : undefined,
        width: 1080,
        height: 1920,
        provider: "fal",
        model,
      });
      setSaved(c);
      setStatus(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setStatus(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <StudioChrome kicker="Studio · generate" title="Generate with AI" subtitle="Portrait 9:16 for sidewalk screens. Results land in your library. Higgsfield MCP stays an agent connector — Studio talks to fal.ai.">
      {saved ? (
        <div className="card p-8 text-center max-w-lg mx-auto">
          <CheckCircle2 size={40} className="mx-auto text-lime-300 mb-4" />
          <h2 className="text-xl font-semibold text-ink-50 mb-2">Saved to your library</h2>
          <p className="text-sm text-ink-400 mb-6">{saved.name ?? "Your AI creative"} is ready to book or remix again.</p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link href="/library" className="btn btn-ghost">View library</Link>
            <Link href="/book" className="btn btn-lime">Book it <ArrowRight size={14} /></Link>
            <button type="button" className="btn btn-ghost" onClick={() => { setSaved(null); }}>Make another</button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">
          <div className="card p-6 md:p-8 space-y-5">
            <div>
              <label className="block text-xs uppercase tracking-wider text-ink-400 mb-2">Model</label>
              <div className="grid grid-cols-2 gap-2">
                {StudioModels.list().map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setModel(m.id)}
                    className={`text-left rounded-lg border px-3 py-2.5 transition-colors ${
                      model === m.id
                        ? "border-lime-400/50 bg-lime-400/10 text-ink-50"
                        : "border-line-800 text-ink-300 hover:border-line-700"
                    }`}
                  >
                    <div className="text-[13px] font-medium">{m.label}</div>
                    <div className="text-[11px] text-ink-500 mt-0.5 leading-snug">{m.hint}</div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs uppercase tracking-wider text-ink-400 mb-1.5">Prompt</label>
              <textarea
                required
                rows={5}
                maxLength={2000}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={def.kind === "image"
                  ? "Neon pizza slice, 1080×1920 poster, bold type LATE NIGHT, dark street glow"
                  : "A steaming pizza box opens on a rainy Brooklyn sidewalk at night, portrait, cinematic, 9:16"}
                className="w-full px-3 py-2.5 rounded-lg bg-bg-900 border border-line-800 text-ink-50 focus:border-cy-400 focus:outline-none placeholder-ink-500 resize-y min-h-[120px]"
              />
            </div>

            <div>
              <label className="block text-xs uppercase tracking-wider text-ink-400 mb-1.5">Remix a still <span className="normal-case tracking-normal text-ink-500">(optional)</span></label>
              <select
                value={remixId}
                onChange={(e) => setRemixId(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg bg-bg-900 border border-line-800 text-ink-50 focus:border-cy-400 focus:outline-none"
              >
                <option value="">Text only — no source still</option>
                {remixable.map((c) => (
                  <option key={c.id} value={c.id}>{c.name ?? "Untitled"} · {c.source}</option>
                ))}
              </select>
              {library.length > 0 && remixable.length === 0 && (
                <p className="text-[12px] text-ink-500 mt-1.5">Remix needs a PNG/JPG. Upload one or generate a Nano Banana still first.</p>
              )}
            </div>

            <div>
              <label className="block text-xs uppercase tracking-wider text-ink-400 mb-1.5">Name <span className="normal-case tracking-normal text-ink-500">(optional)</span></label>
              <input
                type="text"
                maxLength={80}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={prompt.trim().slice(0, 40) || "Friday night special"}
                className="w-full max-w-sm px-3 py-2.5 rounded-lg bg-bg-900 border border-line-800 text-ink-50 focus:border-cy-400 focus:outline-none placeholder-ink-500"
              />
            </div>

            {providers && !providers.fal && (
              <p className="text-sm text-amber-200">
                fal.ai is not configured in this environment. The form works; generation needs <span className="font-mono">FAL_KEY</span> on the studio-generate function.
              </p>
            )}
            {err && <p className="text-sm text-red-400">{err}</p>}
            {status && <p className="text-sm text-cy-300 inline-flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> {status}</p>}

            <div className="flex justify-end pt-1">
              <button
                type="button"
                disabled={busy || prompt.trim().length < 3}
                onClick={onGenerate}
                className="btn btn-lime disabled:opacity-40"
              >
                {busy ? <Loader2 size={15} className="animate-spin" /> : <><Sparkles size={15} /> {remixId ? "Remix" : "Generate"}</>}
              </button>
            </div>
          </div>

          <aside className="card p-5 h-fit space-y-3">
            <p className="text-xs uppercase tracking-wider text-ink-400">Providers</p>
            <p className="text-sm text-ink-300">
              <span className="text-lime-300">fal.ai</span> — Seedance, Kling, Veo, Nano Banana. {providers?.fal ? "Key present." : "Key missing."}
            </p>
            <p className="text-sm text-ink-400">
              Higgsfield MCP is for Cursor/Claude agents at mcp.higgsfield.ai — not a second Studio form. Optional <span className="font-mono text-[11px]">HIGGSFIELD_API_KEY</span> is reserved; {providers?.higgsfield ? "detected." : "not set."}
            </p>
          </aside>
        </div>
      )}
    </StudioChrome>
  );
}
