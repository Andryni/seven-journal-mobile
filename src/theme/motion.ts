import { Easing, withTiming, withSpring, type WithTimingConfig } from 'react-native-reanimated';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * MOTION SYSTEM
 *
 * The old code animated ad hoc: springs with damping 16 in one file, 420ms
 * fades in another, `Easing.back(1.2)` overshoot on bars, 1100ms chart reveals.
 * DESIGN.md forbade bounce easing, then the charts used it anyway.
 *
 * One grammar, applied everywhere:
 *   - Data settles, it never bounces. Financial values overshooting their own
 *     value reads as noise and is briefly *wrong*.
 *   - Entrances are fast (<260ms). The user came for the numbers.
 *   - Only continuous, meaningful states loop (live pulse). Nothing decorative.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/** Durations, ms. */
export const duration = {
  /** Micro feedback: press, toggle, colour change. */
  instant: 120,
  /** Standard entrance / exit. */
  fast: 200,
  /** Panel content, list stagger target. */
  base: 260,
  /** Chart draw-in, value count-up. */
  slow: 420,
  /** Full equity reveal on a large dataset. */
  deliberate: 620,
} as const;

/** Easing curves. No `back`, no `elastic`, no `bounce`. */
export const easing = {
  /** Default: decelerate into place. */
  out: Easing.bezier(0.22, 1, 0.36, 1),
  /** Both ends eased — for things that move and stop off-screen. */
  inOut: Easing.bezier(0.65, 0, 0.35, 1),
  /** Linear, for continuous loops (marquee, sweep). */
  linear: Easing.linear,
} as const;

/** The one spring allowed: critically damped, so it never overshoots. */
export const spring = {
  damping: 22,
  stiffness: 180,
  mass: 0.9,
} as const;

export const timing = (d: number = duration.base): WithTimingConfig => ({
  duration: d,
  easing: easing.out,
});

/** Standard transition for a numeric/geometric value. */
export const settle = <T extends number>(value: T, d: number = duration.base) =>
  withTiming(value, timing(d));

/** Standard transition for a value that should feel physical (sheets, rails). */
export const glide = <T extends number>(value: T) => withSpring(value, spring);

/**
 * Stagger delay for list items, capped so a 200-row blotter does not take
 * 12 seconds to appear.
 */
export const stagger = (index: number, step = 28, max = 8): number =>
  Math.min(index, max) * step;

/** Shared config for count-up number animations. */
export const countUp = {
  duration: duration.slow,
  easing: easing.out,
} as const;
