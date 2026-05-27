"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Monitor, Tv } from "lucide-react";
import { dummyCampaign, dummyCreatives } from "@/lib/dummy-data";

type Surface = "dooh" | "ctv";

export default function PreviewPage() {
  const [surface, setSurface] = useState<Surface>("dooh");
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const time = now ? now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "—:—";

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top bar */}
      <header className="flex items-center justify-between gap-3 px-4 sm:px-6 py-3 sm:py-4 border-b border-line-900">
        <Link href="/campaigns" className="flex items-center gap-2 text-sm text-ink-300 hover:text-ink-50 shrink-0">
          <ArrowLeft size={16} />
          <span className="hidden sm:inline">Back</span>
        </Link>
        <div className="text-center min-w-0">
          <div className="text-[10px] uppercase tracking-wider text-ink-400">Street preview</div>
          <div className="text-sm text-ink-100 truncate font-medium">{dummyCampaign.name}</div>
        </div>
        <div className="w-12 shrink-0" />
      </header>

      {/* Surface tabs */}
      <div className="flex justify-center gap-2 px-4 py-3 border-b border-line-900">
        <TabButton active={surface === "dooh"} onClick={() => setSurface("dooh")} icon={Monitor} label="Sidewalk DOOH" />
        <TabButton active={surface === "ctv"}  onClick={() => setSurface("ctv")}  icon={Tv}      label="Connected TV" />
      </div>

      {/* Scene */}
      <div className="flex-1 flex items-center justify-center p-4 sm:p-6">
        {surface === "dooh" ? <DOOHScene time={time} /> : <CTVScene time={time} />}
      </div>

      {/* Caption */}
      <div className="px-4 sm:px-6 pb-6 sm:pb-8 text-center">
        <p className="text-xs text-ink-500 max-w-md mx-auto">
          {surface === "dooh"
            ? "Your ad on a Glo sidewalk screen near Bedford & N 7th — playing every evening 6pm–11pm."
            : "Your ad on a connected TV in Bushwick — running during prime-time streaming."}
        </p>
      </div>
    </div>
  );
}

function TabButton({
  active, onClick, icon: Icon, label,
}: { active: boolean; onClick: () => void; icon: React.ComponentType<{ size?: number }>; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[13px] font-medium transition-colors ${
        active
          ? "bg-cy-400/15 text-cy-300 shadow-[inset_0_0_0_1px_rgba(34,211,238,0.3)]"
          : "text-ink-400 hover:text-ink-100 hover:bg-bg-700/40"
      }`}
    >
      <Icon size={14} /> {label}
    </button>
  );
}

/* The actual creative shown inside the screen — pizza thumbnail + Johnny's branded overlay */
function CreativeOnScreen({ aspect }: { aspect: "9:16" | "16:9" }) {
  const creative = aspect === "9:16" ? dummyCreatives[0] : dummyCreatives[1];
  return (
    <div className="relative w-full h-full overflow-hidden bg-black">
      <Image
        src={creative.thumbnailUrl}
        alt=""
        fill
        className="object-cover"
        sizes="(max-width: 640px) 70vw, 40vw"
      />
      {/* gradient for legibility */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/15 to-black/40" />
      {/* Branded overlay */}
      <div className="absolute inset-0 flex flex-col justify-between p-1.5 sm:p-3">
        <div className="flex items-center justify-between text-[7px] sm:text-[9px] tracking-wider">
          <span className="px-1 py-0.5 bg-red-600 text-white font-bold uppercase rounded-sm">AD</span>
          <span className="text-white/80 font-mono">0:08 / 0:15</span>
        </div>
        <div className="text-center leading-none">
          <div className="font-black text-white drop-shadow-lg" style={{ fontSize: aspect === "9:16" ? "11cqw" : "7cqw", containerType: "inline-size", lineHeight: 0.9 }}>
            $12<span className="text-lime-300">.</span>
          </div>
          <div className="font-bold text-white/95 mt-0.5 text-[8px] sm:text-[11px] uppercase tracking-[0.15em]">
            Friday Night Special
          </div>
        </div>
        <div className="text-center text-white text-[7px] sm:text-[10px] font-semibold tracking-widest uppercase">
          Johnny's · Bedford Ave
        </div>
      </div>
      {/* Playback bar */}
      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/20">
        <div className="h-full bg-white" style={{ width: "53%" }} />
      </div>
    </div>
  );
}

function DOOHScene({ time }: { time: string }) {
  return (
    <div className="relative w-full max-w-2xl mx-auto aspect-[4/5] sm:aspect-[3/2] rounded-xl overflow-hidden border border-line-900 bg-bg-950">
      {/* Sky gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#0c0f1c] via-[#1a2236] to-[#0d1320]" />

      {/* Stars (deterministic for SSR) */}
      <div className="absolute inset-0 pointer-events-none">
        {Array.from({ length: 25 }).map((_, i) => {
          const cx = (i * 137) % 100;
          const cy = (i * 47) % 35;
          const size = i % 3 === 0 ? 1.5 : 1;
          const opacity = 0.3 + ((i * 7) % 70) / 100;
          return <div key={i} className="absolute rounded-full bg-white" style={{ left: `${cx}%`, top: `${cy}%`, width: size, height: size, opacity }} />;
        })}
      </div>

      {/* Skyline */}
      <svg className="absolute left-0 right-0 w-full pointer-events-none" style={{ bottom: "32%", height: "32%" }} viewBox="0 0 800 200" preserveAspectRatio="none">
        <path fill="#0a0d18" d="M0 200 L0 105 L40 105 L40 70 L80 70 L80 95 L120 95 L120 50 L170 50 L170 80 L210 80 L210 30 L260 30 L260 65 L300 65 L300 50 L340 50 L340 90 L390 90 L390 60 L440 60 L440 80 L480 80 L480 40 L520 40 L520 70 L570 70 L570 55 L610 55 L610 90 L660 90 L660 70 L710 70 L710 50 L760 50 L760 80 L800 80 L800 200 Z" />
        {/* lit windows */}
        {[
          [60,75],[85,90],[130,60],[180,70],[220,50],[275,75],[315,60],[400,75],[470,55],[535,65],[580,70],[625,80],[720,65],[140,70],[265,45]
        ].map(([x, y], i) => (
          <rect key={i} x={x as number} y={y as number} width={4} height={5} fill={i % 4 === 0 ? "#fde047" : "#cbd5e1"} opacity={0.5} />
        ))}
        {/* water tower */}
        <g fill="#0a0d18">
          <rect x="350" y="20" width="22" height="30" />
          <polygon points="350,20 372,20 367,12 355,12" />
          <rect x="358" y="50" width="6" height="12" />
        </g>
      </svg>

      {/* Distant glow */}
      <div className="absolute left-1/4 right-1/4 pointer-events-none" style={{ bottom: "30%", height: "5%", background: "radial-gradient(ellipse at center, rgba(253,224,71,0.08) 0%, transparent 70%)" }} />

      {/* Street / sidewalk */}
      <div className="absolute bottom-0 left-0 right-0 h-[32%] bg-gradient-to-b from-[#0d1320] via-[#0a0e18] to-[#050810]" />
      {/* Curb line */}
      <div className="absolute left-0 right-0" style={{ bottom: "32%", height: "1px", background: "#1a2236" }} />
      {/* Crosswalk lines */}
      <div className="absolute left-0 right-0 flex justify-center gap-2 pointer-events-none" style={{ bottom: "5%" }}>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="w-4 h-1 sm:w-6 sm:h-1.5 bg-[#1a2236] opacity-60" />
        ))}
      </div>

      {/* Street lamps */}
      <div className="absolute left-[10%]" style={{ bottom: "25%" }}>
        <div className="w-0.5 h-16 sm:h-24 bg-[#1a1f2e]" />
        <div className="absolute -top-2 -left-1.5 w-3 h-3 rounded-full bg-amber-200/80 shadow-[0_0_20px_8px_rgba(254,243,199,0.4)]" />
      </div>
      <div className="absolute right-[8%]" style={{ bottom: "25%" }}>
        <div className="w-0.5 h-16 sm:h-24 bg-[#1a1f2e]" />
        <div className="absolute -top-2 -left-1.5 w-3 h-3 rounded-full bg-amber-200/80 shadow-[0_0_20px_8px_rgba(254,243,199,0.4)]" />
      </div>

      {/* THE KIOSK with the ad */}
      <div className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center" style={{ bottom: "8%", width: "32%" }}>
        {/* Screen halo glow behind */}
        <div className="absolute -inset-6 bg-cy-400/30 blur-3xl rounded-full pointer-events-none" />
        {/* Screen frame */}
        <div className="relative w-full aspect-[9/16] rounded-sm overflow-hidden ring-2 ring-[#2a3046] shadow-[0_0_60px_15px_rgba(34,211,238,0.45)]">
          <CreativeOnScreen aspect="9:16" />
        </div>
        {/* Kiosk pole + base */}
        <div className="w-1.5 h-3 bg-[#1a1f2e]" />
        <div className="w-3/4 h-1.5 bg-[#0a0e14] rounded-sm shadow-[0_2px_8px_rgba(34,211,238,0.2)]" />
      </div>

      {/* Pedestrian silhouettes */}
      <Pedestrian className="absolute left-[14%]" style={{ bottom: "7%" }} />
      <Pedestrian className="absolute right-[16%]" style={{ bottom: "8%" }} flipped />

      {/* HUD bottom */}
      <div className="absolute bottom-1 left-2 right-2 sm:bottom-2 sm:left-3 sm:right-3 flex items-center justify-between text-[8px] sm:text-[10px] uppercase tracking-wider text-ink-400 pointer-events-none">
        <span>📍 Williamsburg · Bedford & N 7th</span>
        <span className="tabular-nums text-ink-300">{time}</span>
      </div>
    </div>
  );
}

function Pedestrian({ className = "", style, flipped = false }: { className?: string; style?: React.CSSProperties; flipped?: boolean }) {
  return (
    <svg className={className} style={{ ...style, transform: flipped ? "scaleX(-1)" : undefined }} viewBox="0 0 30 60" width="16" height="32" fill="#070a14">
      <circle cx="15" cy="9" r="5" />
      <path d="M10 14 L20 14 L21 38 L17 38 L17 22 L13 22 L13 38 L9 38 Z" />
      <rect x="9" y="38" width="3" height="18" />
      <rect x="18" y="38" width="3" height="18" />
    </svg>
  );
}

function CTVScene({ time }: { time: string }) {
  return (
    <div className="relative w-full max-w-2xl mx-auto aspect-[4/5] sm:aspect-[3/2] rounded-xl overflow-hidden border border-line-900 bg-bg-950">
      {/* Wall gradient — warm dim */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#1a1410] via-[#0e0a08] to-[#080605]" />
      {/* Soft lamp glow tint */}
      <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: "radial-gradient(circle at 15% 60%, rgba(254,215,170,0.18) 0%, transparent 35%)" }} />

      {/* Wall art frame (right of TV) */}
      <div className="absolute top-[10%] right-[8%] w-10 h-14 sm:w-14 sm:h-20 border-2 border-[#2a221a] bg-gradient-to-br from-[#1a1410] to-[#0a0806]" />

      {/* Shelf with vase silhouette */}
      <div className="absolute top-[20%] left-[8%] w-12 h-0.5 sm:w-16 bg-[#1a1410]" />
      <div className="absolute top-[15%] left-[10%] w-2.5 h-5 sm:w-3 sm:h-6 bg-[#0a0806] rounded-t-sm" />

      {/* THE TV */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[60%]" style={{ width: "72%" }}>
        <div className="relative aspect-video">
          {/* Screen glow halo */}
          <div className="absolute -inset-8 bg-lime-400/25 blur-3xl rounded-full pointer-events-none" />
          {/* TV frame */}
          <div className="relative w-full h-full rounded-md overflow-hidden border-[5px] sm:border-[7px] border-[#050403] shadow-[0_0_80px_20px_rgba(190,242,100,0.35)]">
            <CreativeOnScreen aspect="16:9" />
          </div>
          {/* Wall mount bracket */}
          <div className="absolute left-1/2 -translate-x-1/2 -bottom-1.5 w-3 h-1.5 sm:h-2 bg-[#050403]" />
        </div>
      </div>

      {/* Lamp with warm glow */}
      <div className="absolute pointer-events-none" style={{ bottom: "16%", left: "6%" }}>
        <div className="w-14 h-14 sm:w-20 sm:h-20 bg-amber-300/30 rounded-full blur-2xl" />
      </div>
      <div className="absolute" style={{ bottom: "13%", left: "9%" }}>
        <div className="w-1.5 h-8 sm:h-12 bg-amber-100/60 rounded-sm shadow-[0_0_15px_3px_rgba(254,243,199,0.4)]" />
      </div>

      {/* Plant silhouette (right) */}
      <svg className="absolute right-[5%]" viewBox="0 0 40 60" width="32" height="48" style={{ bottom: "16%" }} fill="#050403">
        <path d="M20 60 L20 30 M20 35 Q 12 30 8 22 M20 30 Q 28 25 32 18 M20 25 Q 14 18 12 10 M20 20 Q 26 15 28 8" stroke="#050403" strokeWidth="3" fill="none" />
        <ellipse cx="8" cy="22" rx="6" ry="4" />
        <ellipse cx="32" cy="18" rx="6" ry="4" />
        <ellipse cx="12" cy="10" rx="5" ry="3" />
        <ellipse cx="28" cy="8" rx="5" ry="3" />
        <rect x="16" y="50" width="8" height="10" />
      </svg>

      {/* Sofa silhouette (foreground) */}
      <svg className="absolute bottom-0 left-0 right-0 w-full pointer-events-none" viewBox="0 0 800 100" preserveAspectRatio="none" style={{ height: "16%" }}>
        <path fill="#050403" d="M0 100 L0 50 Q 100 28 200 28 L600 28 Q 700 28 800 50 L800 100 Z" />
        <path d="M0 50 Q 100 28 200 28 L600 28 Q 700 28 800 50" stroke="#1a1410" strokeWidth="1.5" fill="none" />
      </svg>

      {/* HUD bottom */}
      <div className="absolute bottom-1 left-2 right-2 sm:bottom-2 sm:left-3 sm:right-3 flex items-center justify-between text-[8px] sm:text-[10px] uppercase tracking-wider text-ink-400 pointer-events-none">
        <span>📺 CTV · Bushwick household · prime-time</span>
        <span className="tabular-nums text-ink-300">{time}</span>
      </div>
    </div>
  );
}
