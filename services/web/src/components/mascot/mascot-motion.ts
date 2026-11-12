"use client";

import { useEffect, useRef, type RefObject } from "react";

/** One full turn about every 1.1 seconds while thinking. */
const SPIN_DEG_PER_S = 330;
/** One bounce every 0.9 seconds. */
const BOUNCE_PERIOD_S = 0.9;
/** How high each bounce lifts the element, in CSS pixels. */
const BOUNCE_PX = 5;
/** Time constant, in seconds, of the fade in and out. Starting and stopping never jump. */
const EASE_S = 0.3;

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

/**
 * Spins and bounces the element in `ref` while `thinking` is true. Each frame writes the element's transform
 * from an eased `level` (0 at rest, 1 while thinking), so the motion fades in and out. When the spin winds down,
 * the element settles on the nearest upright turn. Reduced motion keeps it still.
 *
 * The loop runs once per mounted element; `thinking` is read each frame, so a change never restarts the motion.
 */
export function useThinkingMotion(ref: RefObject<HTMLElement | null>, thinking: boolean) {
  const wanted = useRef(thinking);

  useEffect(() => {
    wanted.current = thinking;
  }, [thinking]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const reduced = window.matchMedia(REDUCED_MOTION);
    let level = 0;
    let angle = 0;
    let phase = 0;
    let last = performance.now();
    let frame = 0;

    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;

      const target = wanted.current && !reduced.matches ? 1 : 0;
      level += (target - level) * (1 - Math.exp(-dt / EASE_S));

      phase += (2 * Math.PI * dt) / BOUNCE_PERIOD_S;
      angle += SPIN_DEG_PER_S * level * dt;
      // As the spin fades, ease the angle onto the nearest upright turn, so it rests upright.
      const upright = Math.round(angle / 360) * 360;
      angle += (upright - angle) * (1 - level) * Math.min(1, dt * 4);
      angle = ((angle % 360) + 360) % 360;

      const lift = -BOUNCE_PX * level * Math.abs(Math.sin(phase));
      el.style.transform = `translateY(${lift.toFixed(2)}px) rotate(${angle.toFixed(2)}deg)`;
    };

    const loop = (now: number) => {
      tick(now);
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(frame);
      el.style.transform = "";
    };
  }, [ref]);
}
