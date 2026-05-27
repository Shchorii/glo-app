import Link from "next/link";
import { GloMark } from "@/components/Logo";

export default function Home() {
  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="max-w-xl w-full text-center space-y-8">
        <div className="flex justify-center"><GloMark size={48} withTagline /></div>
        <div>
          <p className="chip mb-4">Campaign Manager · Closed Beta</p>
          <h1 className="text-4xl md:text-5xl font-semibold tracking-tight text-ink-50">
            Make ads. Pick blocks. Watch them <span className="text-lime-400">glow.</span>
          </h1>
          <p className="mt-4 text-ink-300">
            Upload a Reel or TikTok. Glo remixes it for every screen — Connected TV, in-venue, sidewalk DOOH, premium pubs, mobile — and lights up the neighborhoods you pick.
          </p>
        </div>
        <div className="flex items-center justify-center gap-3">
          <Link href="/studio" className="btn btn-primary">Enter Studio →</Link>
          <a href="https://we-are-glo.com" className="btn btn-ghost">About Glo</a>
        </div>
        <p className="text-xs text-ink-500">Auth wiring up next sprint — open access for now.</p>
      </div>
    </div>
  );
}
