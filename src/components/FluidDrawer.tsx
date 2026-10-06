"use client";
import { useCallback, useEffect, useLayoutEffect, useRef, type ReactNode } from "react";
import { project, rubberband, spring, VelocityTracker, type SpringHandle } from "@/lib/spring";

/**
 * Left-edge navigation drawer that behaves like a physical sheet:
 *  - tracks the finger 1:1 (respecting where it was grabbed),
 *  - can be grabbed and reversed mid-animation (springs start from the live value),
 *  - projects a flick's momentum to decide open vs. closed,
 *  - hands release velocity to the spring so there is no seam,
 *  - rubber-bands when pulled past fully open,
 *  - scrim opacity follows the drawer's position, not a separate timer.
 */
export function FluidDrawer({
  open,
  onOpenChange,
  className = "",
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  className?: string;
  children: ReactNode;
}) {
  const panelRef = useRef<HTMLElement>(null);
  const scrimRef = useRef<HTMLDivElement>(null);
  const x = useRef<number | null>(null);
  const width = useRef(288);
  const anim = useRef<SpringHandle | null>(null);
  const animTarget = useRef<number | null>(null);
  const drag = useRef<{
    id: number;
    startX: number;
    startY: number;
    origin: number;
    engaged: boolean;
    cancelled: boolean;
  } | null>(null);
  const tracker = useRef(new VelocityTracker());

  const paint = useCallback((value: number) => {
    x.current = value;
    const panel = panelRef.current;
    const scrim = scrimRef.current;
    const w = width.current;
    const progress = Math.max(0, Math.min(1, 1 + value / w));
    if (panel) {
      panel.style.transform = `translate3d(${value}px,0,0)`;
      panel.style.visibility = progress <= 0 ? "hidden" : "visible";
    }
    if (scrim) {
      scrim.style.opacity = String(progress);
      scrim.style.visibility = progress <= 0 ? "hidden" : "visible";
    }
  }, []);

  const animateTo = useCallback(
    (target: number, velocity = 0, dampingRatio = 1) => {
      const live = anim.current?.sample();
      anim.current?.stop();
      animTarget.current = target;
      const from = x.current ?? target;
      anim.current = spring({
        from,
        to: target,
        // Carry velocity through a re-target instead of hard-cutting it.
        velocity: velocity || live?.velocity || 0,
        dampingRatio,
        response: 0.32,
        onUpdate: paint,
        onComplete: () => {
          anim.current = null;
        },
      });
    },
    [paint],
  );

  // Initial placement, before first paint, so the drawer never flashes.
  useLayoutEffect(() => {
    if (panelRef.current) width.current = panelRef.current.offsetWidth || 288;
    paint(open ? 0 : -width.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Programmatic open/close (menu button, route change, Escape).
  useEffect(() => {
    if (panelRef.current) width.current = panelRef.current.offsetWidth || width.current;
    const target = open ? 0 : -width.current;
    if (drag.current?.engaged) return;
    if (animTarget.current === target || (anim.current === null && x.current === target)) return;
    animateTo(target);
  }, [open, animateTo]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  function onPointerDown(e: React.PointerEvent) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    // Interruptible: grab it mid-flight from wherever it is on screen right now.
    anim.current?.stop();
    anim.current = null;
    animTarget.current = null;
    drag.current = {
      id: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      origin: x.current ?? 0,
      engaged: false,
      cancelled: false,
    };
    tracker.current.reset();
    tracker.current.add(e.clientX, e.timeStamp);
  }

  function onPointerMove(e: React.PointerEvent) {
    const d = drag.current;
    if (!d || d.id !== e.pointerId || d.cancelled) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (!d.engaged) {
      // ~10px hysteresis, and let vertical scrolling of the nav win if that's the intent.
      if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) {
        d.cancelled = true;
        settle(0);
        return;
      }
      if (Math.abs(dx) < 10) return;
      d.engaged = true;
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
    }
    tracker.current.add(e.clientX, e.timeStamp);
    let next = d.origin + dx;
    if (next > 0) next = rubberband(next, width.current);
    paint(next);
  }

  function settle(velocity: number) {
    const w = width.current;
    const current = x.current ?? 0;
    const projected = current + project(velocity);
    let target = projected < -w / 2 ? -w : 0;
    // A decisive flick wins on direction, regardless of position.
    if (Math.abs(velocity) > 400) target = velocity < 0 ? -w : 0;
    const flicked = Math.abs(velocity) > 300;
    animateTo(target, velocity, flicked ? 0.85 : 1);
    const nowOpen = target === 0;
    if (nowOpen !== open) onOpenChange(nowOpen);
  }

  function onPointerUp(e: React.PointerEvent) {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    if (d.cancelled) return;
    if (!d.engaged) {
      // A plain tap: if we interrupted a moving drawer, let it finish where it was going.
      if (x.current !== 0 && x.current !== -width.current) settle(0);
      return;
    }
    // Swallow the click that follows a drag so links don't fire.
    const swallow = (ev: Event) => {
      ev.preventDefault();
      ev.stopPropagation();
    };
    window.addEventListener("click", swallow, { capture: true, once: true });
    window.setTimeout(() => window.removeEventListener("click", swallow, { capture: true }), 0);
    settle(tracker.current.velocity());
  }

  return (
    <>
      <div
        ref={scrimRef}
        aria-hidden
        onClick={() => onOpenChange(false)}
        className="md:hidden fixed inset-0 z-40 bg-bg-950/60 backdrop-blur-[2px] glass-scrim"
        style={{ opacity: 0, visibility: "hidden", pointerEvents: open ? "auto" : "none" }}
      />
      <aside
        ref={panelRef}
        aria-hidden={!open}
        inert={!open}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className={`fluid-drawer md:hidden fixed top-0 left-0 z-50 h-full will-change-transform ${className}`}
        style={{ transform: "translate3d(-100%,0,0)", visibility: "hidden", touchAction: "pan-y" }}
      >
        {children}
      </aside>
    </>
  );
}
