import Link from "next/link";
import Image from "next/image";
import { dummyCreatives } from "@/lib/dummy-data";
import { Play, Sparkles, Upload } from "lucide-react";

export default function LibraryPage() {
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 md:px-8 py-6 md:py-10">
      <div className="flex flex-wrap items-baseline justify-between gap-3 mb-6 md:mb-8">
        <div>
          <p className="chip mb-3">Library</p>
          <h1 className="text-2xl md:text-3xl font-semibold text-ink-50 tracking-tight">Your creatives</h1>
          <p className="text-ink-400 mt-1.5 text-sm">{dummyCreatives.length} ready · running in 1 campaign</p>
        </div>
        <Link href="/studio" className="btn btn-primary">+ New creative</Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
        {dummyCreatives.map((c) => (
          <div key={c.id} className="card p-3 group">
            <div className="relative aspect-[9/16] rounded-lg overflow-hidden bg-bg-900 mb-3">
              <Image
                src={c.thumbnailUrl}
                alt={c.name}
                fill
                sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
                className="object-cover"
              />
              <div className="absolute inset-0 flex items-center justify-center bg-bg-950/30 opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="w-11 h-11 rounded-full bg-bg-950/70 backdrop-blur flex items-center justify-center text-ink-50">
                  <Play size={18} fill="currentColor" />
                </div>
              </div>
              <div className="absolute top-2 left-2 flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wider bg-bg-950/70 backdrop-blur text-ink-200">
                {c.source === "ai_gen" ? <><Sparkles size={9} className="text-lime-300" /><span>AI</span></> : <><Upload size={9} /><span>Upload</span></>}
              </div>
              <div className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded text-[9px] font-mono bg-bg-950/70 backdrop-blur text-ink-200">
                {c.aspectRatio} · {c.durationSeconds}s
              </div>
            </div>
            <div className="px-1">
              <div className="text-[13px] text-ink-100 font-medium leading-snug line-clamp-2">{c.name}</div>
              <div className="text-[11px] text-ink-500 mt-1">
                {new Date(c.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
