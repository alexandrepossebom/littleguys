import { Easing, interpolate, spring } from "remotion";
import { FPS } from "./timeline";

export const EASE = {
  out: Easing.bezier(0.16, 1, 0.3, 1),
  inOut: Easing.bezier(0.65, 0, 0.35, 1),
  in: Easing.bezier(0.7, 0, 0.84, 0),
  soft: Easing.bezier(0.33, 1, 0.68, 1),
};

const CLAMP = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** 0→1 over [start, start+dur], eased. */
export function prog(f: number, start: number, dur: number, ease: (t: number) => number = EASE.out) {
  return interpolate(f, [start, start + dur], [0, 1], { ...CLAMP, easing: ease });
}

/** Clamped interpolate. */
export function map(f: number, input: number[], output: number[], ease?: (t: number) => number) {
  return interpolate(f, input, output, { ...CLAMP, ...(ease ? { easing: ease } : {}) });
}

export type SpringCfg = { damping?: number; stiffness?: number; mass?: number };

/** A spring that starts at `start`. Bouncy by default. */
export function sp(f: number, start: number, cfg: SpringCfg = {}) {
  return spring({ frame: f - start, fps: FPS, config: { damping: 13, stiffness: 150, mass: 1, ...cfg } });
}

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Exponential interpolation, for zooms that feel constant-speed. */
export const lerpScale = (a: number, b: number, t: number) => Math.exp(lerp(Math.log(a), Math.log(b), t));

/** How much of `text` a typewriter has shown by frame f. */
export function typed(text: string, f: number, from: number, to: number) {
  const chars = Array.from(text);
  const n = Math.round(map(f, [from, to], [0, chars.length]));
  return chars.slice(0, n).join("");
}
