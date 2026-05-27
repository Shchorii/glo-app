import Link from "next/link";
import { GloMark } from "@/components/Logo";

export default function Home() {
  return (
    <div className="min-h-screen flex items-center justify-center px-5 py-10">
      <div className="max-w-xl w-full text-center space-y-7">
        <div className="flex justify-center"><GloMark size={42} withTagline /></div>
        <div>
          <p className="chip mb-4">Campaign Manager · Closed Beta</p>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-semibold tracking-tight text-ink-50 leading-[1.1]">
            Make ads. Pick blocks. Watch them <span className="text-lime-400">glow.</span>
          </h1>
          <p className="mt-4 text-ink-300 text-[15px] md:text-base">
            Upload a Reel or TikTok. Glo remixes it for every screen — Connected TV, in-venue, sidewalk DOOH, premium pubs, mobile — and lights up the neighborhoods you pick.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3">
          <Link href="/sign-up" className="btn btn-primary justify-center">Get started →</Link>
          <Link href="/sign-in" className="btn btn-ghost justify-center">Sign in</Link>
        </div>
        <p className="text-xs text-ink-500">
          Closed beta · <a href="https://we-are-glo.com" className="text-ink-300 hover:text-cy-300">About Glo</a>
        </p>
      </div>
    </div>
  );
}
