import { dummyOffer } from "@/lib/dummy-data";
import { GloMark } from "@/components/Logo";
import { ScanBeacon } from "./ScanBeacon";
import { Pizza, MapPin, Clock, BadgePercent } from "lucide-react";

export const dynamic = "force-dynamic";

// Deterministic per-visit redemption code
function genCode(seed: string): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let h = 0;
  const s = seed + Date.now().toString();
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  let out = "";
  for (let i = 0; i < 4; i++) { out += chars[h % chars.length]; h = Math.floor(h / chars.length) + 7; }
  return out;
}

export default async function CouponPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const offer = dummyOffer; // single demo offer
  const redemption = `${offer.discountPct}OFF-${genCode(code)}`;

  return (
    <div className="min-h-screen flex items-center justify-center px-5 py-8">
      <ScanBeacon code={code} />
      <div className="w-full max-w-sm">
        {/* Coupon card */}
        <div className="card overflow-hidden">
          {/* Brand header */}
          <div className="relative px-6 pt-7 pb-6 text-center bg-gradient-to-b from-red-600/20 to-transparent border-b border-line-800">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-red-600/90 text-white mb-3 shadow-glow-cy">
              <Pizza size={28} strokeWidth={1.8} />
            </div>
            <h1 className="text-xl font-bold text-ink-50">{offer.brand}</h1>
            <p className="text-[13px] text-ink-400 mt-0.5">Williamsburg · Bedford Ave</p>
          </div>

          {/* Offer */}
          <div className="px-6 py-7 text-center">
            <div className="inline-flex items-center gap-1.5 chip mb-4">
              <BadgePercent size={12} /> Exclusive sidewalk offer
            </div>
            <div className="text-5xl font-black text-lime-400 leading-none tracking-tight">
              {offer.discountPct}%<span className="text-2xl align-top"> OFF</span>
            </div>
            <p className="text-ink-200 mt-2 font-medium">your next order</p>

            {/* Redemption code */}
            <div className="mt-6">
              <p className="text-[10px] uppercase tracking-wider text-ink-500 mb-1.5">Show this code at the counter</p>
              <div className="font-mono text-lg font-bold text-ink-50 tracking-[0.15em] bg-bg-900 border border-dashed border-cy-400/40 rounded-lg py-3">
                {redemption}
              </div>
            </div>

            <div className="mt-5 space-y-1.5 text-[12px] text-ink-400">
              <p className="inline-flex items-center gap-1.5"><MapPin size={12} /> 142 Bedford Ave, Brooklyn</p><br/>
              <p className="inline-flex items-center gap-1.5"><Clock size={12} /> Valid through Jun 4 · one per customer</p>
            </div>
          </div>

          {/* Glo footer */}
          <div className="px-6 py-4 border-t border-line-800 flex items-center justify-center gap-2 bg-bg-900/40">
            <span className="text-[11px] text-ink-500">delivered to your block by</span>
            <GloMark size={16} motion="spin" />
          </div>
        </div>

        <p className="text-center text-[11px] text-ink-600 mt-4">
          You scanned a Glo sidewalk screen near Bedford &amp; N 7th. This visit was counted toward {offer.brand}&apos;s campaign.
        </p>
      </div>
    </div>
  );
}
