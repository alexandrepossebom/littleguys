import React from "react";
import type { Mood } from "../timeline";
import { useSvgId } from "./Guy";

// The menu-bar sprite (scripts/gen-icons.mjs), drawn live on a 22×18 canvas
// so it can move smoothly between the app's frame-by-frame poses.

type Pose = {
  dy: number;
  feet: [number, number];
  squash: number;
  eyes: "open" | "happy" | "sleep";
  blink: number;
  look: number;
  arm: number | null;
  bang: number | null;
  zees: Array<{ x: number; y: number; s: number; o: number }>;
};

const TAU = Math.PI * 2;

/** Where the sprite is `t` frames into a mood. */
export function pose(mood: Mood, t: number): Pose {
  const base: Pose = { dy: 0, feet: [0, 0], squash: 0, eyes: "open", blink: 0, look: 0, arm: null, bang: null, zees: [] };
  switch (mood) {
    case "idle": {
      const u = t % 120;
      const blink = u >= 26 && u < 34 ? Math.sin(((u - 26) / 8) * Math.PI) : 0;
      const look = u < 46 ? 0 : u < 56 ? ((u - 46) / 10) * 0.7 : u < 92 ? 0.7 : u < 102 ? 0.7 - ((u - 92) / 10) * 1.2 : -0.5 + ((u - 102) / 18) * 0.5;
      return { ...base, blink, look, dy: -0.15 * Math.sin((t / 60) * TAU) };
    }
    case "working": {
      const ph = (t / 30) * TAU;
      return { ...base, look: 0.6, dy: -0.7 * Math.abs(Math.cos(ph / 2)), feet: [1.1 * Math.max(0, Math.sin(ph / 2)), 1.1 * Math.max(0, -Math.sin(ph / 2))] };
    }
    case "news":
      return { ...base, eyes: "happy", arm: 40 + 24 * Math.sin((t / 24) * TAU) };
    case "needs": {
      const u = (t % 30) / 30;
      const hop = u < 0.5 ? Math.sin(u * 2 * Math.PI) : 0;
      return { ...base, dy: -1.1 * hop, squash: 0.3 * hop, bang: -0.6 * hop };
    }
    case "offline": {
      const zees = [0, 1, 2].map((k) => {
        const p = ((t + k * 26) % 78) / 78;
        return { x: 15.6 + p * 4, y: 4.4 - p * 4.6, s: 1.5 + p * 1.5, o: Math.sin(p * Math.PI) };
      });
      return { ...base, eyes: "sleep", dy: 0.2 * Math.sin((t / 90) * TAU), zees };
    }
  }
}

function bodyPath(dy: number, squash: number) {
  const cx = 10;
  const top = 2.6 + dy + squash;
  const bottom = 14.4 + dy;
  const r = 6.2;
  const l = cx - r;
  const rt = cx + r;
  const sh = top + r;
  return `M ${l} ${sh} A ${r} ${r - squash * 0.5} 0 0 1 ${rt} ${sh} L ${rt} ${bottom - 1.6} Q ${rt} ${bottom} ${rt - 1.6} ${bottom} L ${l + 1.6} ${bottom} Q ${l} ${bottom} ${l} ${bottom - 1.6} Z`;
}

export function Sprite({ mood, t, height, fill = "#000", style }: { mood: Mood; t: number; height: number; fill?: string; style?: React.CSSProperties }) {
  const id = useSvgId();
  const p = pose(mood, t);
  const bottom = 14.4 + p.dy;
  const eyeY = 8.6 + p.dy;
  const eyeXs = [10 + p.look - 2.1, 10 + p.look + 2.1];
  return (
    <svg width={(height * 22) / 18} height={height} viewBox="0 0 22 18" style={{ overflow: "visible", ...style }}>
      <defs>
        <mask id={id} maskUnits="userSpaceOnUse" x="-2" y="-2" width="26" height="22">
          <rect x="-2" y="-2" width="26" height="22" fill="black" />
          <path d={bodyPath(p.dy, p.squash)} fill="white" />
          <rect x={10 - 4.4} y={bottom - 0.6 - p.feet[0]} width={3} height={2.6} rx={1.2} fill="white" />
          <rect x={10 + 1.4} y={bottom - 0.6 - p.feet[1]} width={3} height={2.6} rx={1.2} fill="white" />
          {eyeXs.map((x, i) =>
            p.eyes === "happy" ? (
              <path key={i} d={`M ${x - 1.2} ${eyeY + 0.6} Q ${x} ${eyeY - 1} ${x + 1.2} ${eyeY + 0.6}`} stroke="black" strokeWidth={0.85} fill="none" strokeLinecap="round" />
            ) : p.eyes === "sleep" ? (
              <path key={i} d={`M ${x - 1.2} ${eyeY - 0.2} Q ${x} ${eyeY + 1.1} ${x + 1.2} ${eyeY - 0.2}`} stroke="black" strokeWidth={0.8} fill="none" strokeLinecap="round" />
            ) : (
              <ellipse key={i} cx={x} cy={eyeY} rx={1.05} ry={Math.max(0.3, 1.45 * (1 - p.blink))} fill="black" />
            ),
          )}
        </mask>
      </defs>
      <rect x="-2" y="-2" width="26" height="22" fill={fill} mask={`url(#${id})`} />
      {p.arm !== null && (() => {
        const rad = (p.arm * Math.PI) / 180;
        const ex = 15.6 + Math.cos(rad) * 4.6;
        const ey = 9.4 + p.dy - Math.sin(rad) * 4.6;
        return (
          <>
            <path d={`M 15.6 ${9.4 + p.dy} L ${ex} ${ey}`} stroke={fill} strokeWidth={1.7} strokeLinecap="round" />
            <circle cx={ex} cy={ey} r={1.25} fill={fill} />
          </>
        );
      })()}
      {p.bang !== null && (
        <>
          <rect x={19.1} y={2 + p.bang} width={1.8} height={7} rx={0.9} fill={fill} />
          <circle cx={20} cy={11.6 + p.bang} r={1.05} fill={fill} />
        </>
      )}
      {p.zees.map((z, i) => (
        <path
          key={i}
          d={`M ${z.x} ${z.y} h ${z.s} l ${-z.s} ${z.s} h ${z.s}`}
          stroke={fill}
          strokeWidth={0.55 + z.s * 0.12}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={z.o}
        />
      ))}
    </svg>
  );
}
