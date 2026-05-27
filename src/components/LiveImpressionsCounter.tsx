"use client";
import { useEffect, useRef, useState } from "react";
import { Radio } from "lucide-react";

type Props = {
  /** Starting impression total. */
  start: number;
  /** Target average rate per minute. ~14/min ≈ a typical peak-hour Friday rate. */
  ratePerMinute?: number;
  className?: string;
};

/**
 * Live impressions ticker.
 * - Updates every 750ms with a Poisson-ish draw around the target rate.
 * - Displays "+N in last 60s" sub-line.
 * - Renders a 60-sample sparkline of the most recent activity.
 */
export function LiveImpressionsCounter({ start, ratePerMinute = 14, className = "" }: Props) {
  const [count, setCount] = useState(start);
  const [recentMinute, setRecentMinute] = useState(0);
  const [spark, setSpark] = useState<number[]>(() => Array(40).fill(0));
  const recentRef = useRef<{ ts: number; n: number }[]>([]);

  useEffect(() => {
    const intervalMs = 750;
    const expectedPerTick = (ratePerMinute / 60) * (intervalMs / 1000);

    function tick() {
      // Poisson draw via the Knuth method (small lambda)
      const L = Math.exp(-expectedPerTick);
      let k = 0;
      let p = 1;
      do { k++; p *= Math.random(); } while (p > L);
      const n = k - 1;

      const now = Date.now();
      if (n > 0) {
        setCount((c) => c + n);
        recentRef.current.push({ ts: now, n });
      }
      // Trim to last 60s
      const cutoff = now - 60_000;
      recentRef.current = recentRef.current.filter((r) => r.ts > cutoff);
      setRecentMinute(recentRef.current.reduce((s, r) => s + r.n, 0));
      // Sparkline: shift-left, push latest tick
      setSpark((arr) => {
        const next = arr.slice(1);
        next.push(n);
        return next;
      });
    }

    const timer = setInterval(tick, intervalMs);
    return () => clearInterval(timer);
  }, [ratePerMinute]);

  const max = Math.max(2, ...spark);

  return (
    <div className={`card p-5 md:p-6 ${className}`}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-lime-400/10 text-lime-300 border border-lime-400/30">
            <Radio size={14} strokeWidth={1.8} />
          </span>
          <div>
            <div className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-lime-300 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-lime-400 animate-pulse" />
              Live · ads seen
            </div>
            <div className="text-[11px] text-ink-500 mt-0.5">Streaming from DOOH + CTV partners</div>
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-[10px] uppercase tracking-wider text-ink-400">Last 60s</div>
          <div className="text-sm font-medium text-ink-100 tabular-nums">+{recentMinute}</div>
        </div>
      </div>

      <div className="flex items-end justify-between gap-4">
        <div className="text-3xl md:text-5xl font-semibold text-ink-50 tabular-nums leading-none tracking-tight">
          {count.toLocaleString()}
        </div>
        {/* Sparkline */}
        <div className="hidden sm:flex items-end gap-[2px] h-10 md:h-12 shrink-0">
          {spark.map((v, i) => (
            <div
              key={i}
              className={`w-[3px] rounded-full ${v > 0 ? "bg-lime-400" : "bg-line-800"}`}
              style={{ height: `${v > 0 ? (v / max) * 100 : 8}%`, minHeight: 2 }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
