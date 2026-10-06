/**
 * Tiny dependency-free spring, tuned the way Apple tunes motion:
 * two designer-facing knobs instead of mass/stiffness/damping.
 *
 *  - dampingRatio: 1 = critically damped (no overshoot, the default for UI).
 *                  ~0.8 = a little bounce, only after a gesture carried momentum.
 *  - response:     seconds to (roughly) reach the target. Lower = snappier.
 *
 * Springs are interruptible: start a new one from the element's *current*
 * value and *current* velocity and the motion stays continuous.
 */

export type SpringOptions = {
  from: number;
  to: number;
  /** Initial velocity in units per second (e.g. px/s from a drag release). */
  velocity?: number;
  dampingRatio?: number;
  response?: number;
  onUpdate: (value: number, velocity: number) => void;
  onComplete?: () => void;
};

export type SpringHandle = {
  stop: () => void;
  /** Live value and velocity, for handing off to the next animation. */
  sample: () => { value: number; velocity: number };
};

function solve(d0: number, v0: number, zeta: number, w0: number, t: number): number {
  if (zeta >= 1) {
    // Critically damped (treat over-damped as critical, it reads the same in UI).
    return (d0 + (v0 + w0 * d0) * t) * Math.exp(-w0 * t);
  }
  const wd = w0 * Math.sqrt(1 - zeta * zeta);
  const env = Math.exp(-zeta * w0 * t);
  return env * (d0 * Math.cos(wd * t) + ((v0 + zeta * w0 * d0) / wd) * Math.sin(wd * t));
}

export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function spring(opts: SpringOptions): SpringHandle {
  const { from, to, onUpdate, onComplete } = opts;
  const zeta = opts.dampingRatio ?? 1;
  const response = opts.response ?? 0.35;
  const w0 = (2 * Math.PI) / response;
  const d0 = from - to;
  const v0 = opts.velocity ?? 0;

  let raf = 0;
  let stopped = false;
  const start = performance.now();
  let last = { value: from, velocity: v0 };

  const at = (t: number) => {
    const d = solve(d0, v0, zeta, w0, t);
    const dt = 1 / 240;
    const vel = (solve(d0, v0, zeta, w0, t + dt) - d) / dt;
    return { value: to + d, velocity: vel };
  };

  // Reduced motion: no travel, just land.
  if (prefersReducedMotion()) {
    onUpdate(to, 0);
    onComplete?.();
    return { stop: () => {}, sample: () => ({ value: to, velocity: 0 }) };
  }

  const tick = (now: number) => {
    if (stopped) return;
    const t = (now - start) / 1000;
    last = at(t);
    const settled = Math.abs(last.value - to) < 0.3 && Math.abs(last.velocity) < 5;
    if (settled) {
      onUpdate(to, 0);
      last = { value: to, velocity: 0 };
      onComplete?.();
      return;
    }
    onUpdate(last.value, last.velocity);
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);

  return {
    stop: () => {
      stopped = true;
      cancelAnimationFrame(raf);
    },
    sample: () => last,
  };
}

/** Apple's momentum projection (Designing Fluid Interfaces): where a flick would come to rest. */
export function project(velocity: number, decelerationRate = 0.998): number {
  return ((velocity / 1000) * decelerationRate) / (1 - decelerationRate);
}

/** Progressive resistance past a boundary, instead of a hard stop. */
export function rubberband(overshoot: number, dimension: number, constant = 0.55): number {
  return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot));
}

/** Rolling pointer history → release velocity (units/s), robust to a final stationary frame. */
export class VelocityTracker {
  private samples: { x: number; t: number }[] = [];
  reset() {
    this.samples = [];
  }
  add(x: number, t: number) {
    this.samples.push({ x, t });
    const cutoff = t - 100;
    while (this.samples.length > 2 && this.samples[0].t < cutoff) this.samples.shift();
  }
  velocity(): number {
    const s = this.samples;
    if (s.length < 2) return 0;
    const a = s[0];
    const b = s[s.length - 1];
    const dt = b.t - a.t;
    if (dt <= 0) return 0;
    return ((b.x - a.x) / dt) * 1000;
  }
}
