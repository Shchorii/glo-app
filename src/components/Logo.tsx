type Motion = "none" | "assemble" | "spin";

type LogoProps = {
  className?: string;
  size?: number;          // pixel font-size of the wordmark
  withTagline?: boolean;
  motion?: Motion;
};

export function GloMark({ className = "", size = 28, withTagline = false, motion = "none" }: LogoProps) {
  const mark = (
    <span className={`glo-logo glo-m-${motion}`} style={{ fontSize: size }} role="img" aria-label="Glo">
      <span className="glo-ltr glo-g">g</span>
      <span className="glo-ltr glo-l">l</span>
      <span className="glo-ltr glo-o" aria-hidden="true">
        <svg viewBox="0 0 100 100">
          <circle className="glo-ring-outer" cx="50" cy="50" r="47" />
          <circle className="glo-ring-mid" cx="50" cy="50" r="37" />
          <circle className="glo-ring-dash" cx="50" cy="50" r="42" />
          <circle className="glo-core" cx="50" cy="50" r="22" />
        </svg>
      </span>
    </span>
  );

  if (!withTagline) {
    return <span className={className}>{mark}</span>;
  }

  return (
    <span className={`glo-lockup ${className}`} style={{ fontSize: size }}>
      {mark}
      <span className="glo-tagline" style={{ fontSize: Math.max(7, Math.round(size * 0.135)) }}>
        Premium Media · Autopiloted
      </span>
    </span>
  );
}
