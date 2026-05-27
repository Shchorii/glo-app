import Link from "next/link";
import { Upload, Link2, Sparkles, Wand2 } from "lucide-react";

export default function StudioPage() {
  return (
    <div className="max-w-6xl mx-auto px-8 py-10">
      <div className="flex items-baseline justify-between mb-8">
        <div>
          <p className="chip mb-3">Studio · M1</p>
          <h1 className="text-3xl font-semibold text-ink-50 tracking-tight">Creative Studio</h1>
          <p className="text-ink-400 mt-2">Bring a creative in. We&apos;ll remix it for every surface.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <SourceCard href="/studio/ingest/upload" icon={Upload} title="Upload a file" desc="MP4, MOV, or image. Up to 500MB." accent="cy" />
        <SourceCard href="/studio/ingest/embed" icon={Link2} title="Paste a TikTok / IG URL" desc="We'll fetch the embed + metadata." accent="cy" />
        <SourceCard href="/studio/generate" icon={Sparkles} title="Generate from scratch" desc="Seedance · Kling · Veo · Nano Banana." accent="lime" badge="AI" />
      </div>

      <div className="mt-12">
        <div className="flex items-center gap-3 mb-4">
          <Wand2 size={18} className="text-lime-400" />
          <h2 className="text-lg font-medium text-ink-100">Recent jobs</h2>
        </div>
        <div className="card p-10 text-center">
          <p className="text-ink-400 text-sm">No creatives yet. Pick a source above to get started.</p>
        </div>
      </div>
    </div>
  );
}

function SourceCard({ href, icon: Icon, title, desc, accent, badge }: {
  href: string;
  icon: React.ComponentType<{ size?: number; className?: string; strokeWidth?: number }>;
  title: string; desc: string; accent: "cy" | "lime"; badge?: string;
}) {
  const accentClasses = accent === "cy"
    ? "group-hover:shadow-glow-cy group-hover:border-cy-400/40"
    : "group-hover:shadow-glow-lime group-hover:border-lime-400/40";
  return (
    <Link href={href} className="group">
      <div className={`card p-6 h-full transition-all ${accentClasses} border-line-800`}>
        <div className="flex items-center justify-between mb-5">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
            accent === "cy" ? "bg-cy-400/10 text-cy-300" : "bg-lime-400/10 text-lime-300"
          }`}>
            <Icon size={20} strokeWidth={1.8} />
          </div>
          {badge && <span className="chip-lime chip text-[10px]">{badge}</span>}
        </div>
        <h3 className="text-base font-medium text-ink-100">{title}</h3>
        <p className="text-sm text-ink-400 mt-1.5">{desc}</p>
      </div>
    </Link>
  );
}
