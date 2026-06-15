type GloBotProps = {
  /** "launcher" = full character (chat button); "avatar" = head only (panel header / messages) */
  variant?: "launcher" | "avatar";
  size?: number;
  className?: string;
  title?: string;
};

/**
 * GloBot — Glo's support mascot.
 * His head is the Glo aperture mark: concentric rings with the amber core as a
 * glowing camera-eye, a cyan ring that orbits like he's listening, an antenna,
 * expressive brows, and a little body with a chest aperture echo + status light.
 */
export function GloBot({ variant = "launcher", size, className = "", title }: GloBotProps) {
  if (variant === "avatar") {
    const w = size ?? 30;
    return (
      <svg
        className={`gb ${className}`}
        width={w}
        height={w}
        viewBox="0 0 100 100"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label={title ?? "GloBot"}
      >
        <defs>
          <radialGradient id="gbEyeAv" cx="42%" cy="38%" r="70%">
            <stop offset="0%" stopColor="#FFE6B8" />
            <stop offset="45%" stopColor="#F9C36B" />
            <stop offset="100%" stopColor="#E0921F" />
          </radialGradient>
        </defs>
        <circle cx="50" cy="52" r="42" fill="#0B121F" />
        <circle cx="50" cy="52" r="42" fill="none" stroke="#56585A" strokeWidth="6" />
        <circle cx="50" cy="52" r="33" fill="none" stroke="#9B9B97" strokeWidth="7" />
        <circle
          className="gb-orbit-av"
          cx="50"
          cy="52"
          r="38"
          fill="none"
          stroke="#22D3EE"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray="30 200"
        />
        <circle cx="50" cy="52" r="20" fill="#F9C36B" opacity="0.16" />
        <circle cx="50" cy="52" r="18" fill="url(#gbEyeAv)" />
        <circle cx="43" cy="45" r="4" fill="#fff" opacity="0.9" />
      </svg>
    );
  }

  const w = size ?? 92;
  return (
    <svg
      className={`gb ${className}`}
      width={w}
      viewBox="0 0 140 170"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={title ?? "GloBot"}
      style={{ filter: "drop-shadow(0 8px 18px rgba(0,0,0,0.5))" }}
    >
      <defs>
        <radialGradient id="gbEye" cx="42%" cy="38%" r="70%">
          <stop offset="0%" stopColor="#FFE6B8" />
          <stop offset="45%" stopColor="#F9C36B" />
          <stop offset="100%" stopColor="#E0921F" />
        </radialGradient>
        <linearGradient id="gbTorso" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0E1726" />
          <stop offset="100%" stopColor="#080D17" />
        </linearGradient>
      </defs>

      {/* antenna */}
      <g>
        <line x1="70" y1="30" x2="70" y2="15" stroke="#9B9B97" strokeWidth="3" strokeLinecap="round" />
        <circle className="gb-tipglow" cx="70" cy="11" r="8" fill="#BEF264" opacity="0.25" />
        <circle className="gb-tip" cx="70" cy="11" r="4.5" fill="#BEF264" />
      </g>

      {/* neck */}
      <rect x="66" y="92" width="8" height="12" rx="3" fill="#56585A" />

      {/* body */}
      <g>
        <rect
          x="40"
          y="100"
          width="60"
          height="54"
          rx="17"
          fill="url(#gbTorso)"
          stroke="rgba(77,226,240,0.30)"
          strokeWidth="1.5"
        />
        <path d="M42 116 q-10 2 -12 14" fill="none" stroke="#9B9B97" strokeWidth="5" strokeLinecap="round" />
        <path
          className="gb-arm-r"
          d="M98 116 q10 2 12 14"
          fill="none"
          stroke="#9B9B97"
          strokeWidth="5"
          strokeLinecap="round"
        />
        <circle cx="70" cy="126" r="8" fill="none" stroke="#56585A" strokeWidth="2" />
        <circle cx="70" cy="126" r="3" fill="#F9C36B" />
        <circle className="gb-led" cx="52" cy="110" r="2.6" fill="#BEF264" />
      </g>

      {/* head */}
      <g>
        <circle cx="70" cy="60" r="34" fill="#0B121F" />
        <circle cx="70" cy="60" r="34" fill="none" stroke="#56585A" strokeWidth="5" />
        <circle cx="70" cy="60" r="27" fill="none" stroke="#9B9B97" strokeWidth="6" />
        <circle
          className="gb-orbit"
          cx="70"
          cy="60"
          r="31"
          fill="none"
          stroke="#22D3EE"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray="26 175"
        />
        <circle cx="36" cy="60" r="3.4" fill="#9B9B97" />
        <circle cx="104" cy="60" r="3.4" fill="#9B9B97" />
        <circle cx="70" cy="60" r="21" fill="#F9C36B" opacity="0.12" />
        <circle cx="70" cy="60" r="17" fill="#F9C36B" opacity="0.18" />
        <g className="gb-eye">
          <circle cx="70" cy="60" r="15" fill="url(#gbEye)" />
          <circle cx="70" cy="60" r="15" fill="none" stroke="#C9832B" strokeWidth="1.2" opacity="0.5" />
          <circle cx="64" cy="54" r="3.4" fill="#fff" opacity="0.92" />
          <circle cx="76" cy="64" r="1.6" fill="#fff" opacity="0.6" />
        </g>
        <g className="gb-brows">
          <path d="M52 42 q8 -5.5 16 -3" fill="none" stroke="#86ECF7" strokeWidth="3.2" strokeLinecap="round" />
          <path d="M88 42 q-8 -5.5 -16 -3" fill="none" stroke="#86ECF7" strokeWidth="3.2" strokeLinecap="round" />
        </g>
      </g>
    </svg>
  );
}
