import React from "react";
import { EASE, map, prog, sp } from "../anim";
import { GuyBody, GuyDefs, PAL, useSvgId } from "./Guy";

// The app icon (src/ui/guy.svg), rebuilt so each piece can make an entrance:
// the plate lands, the guy pops up, his mint friend peeks in, and the chat
// bubble starts typing.

const PLATE =
  "M 629.074 100.000 c 103.234 0 154.851 0 194.281 20.091 a 184.329 184.329 0 0 1 80.555 80.555 c 20.091 39.430 20.091 91.047 20.091 194.281 L 924.000 629.074 c 0 103.234 0 154.851 -20.091 194.281 a 184.329 184.329 0 0 1 -80.555 80.555 c -39.430 20.091 -91.047 20.091 -194.281 20.091 L 394.926 924.000 c -103.234 0 -154.851 0 -194.281 -20.091 a 184.329 184.329 0 0 1 -80.555 -80.555 c -20.091 -39.430 -20.091 -91.047 -20.091 -194.281 L 100.000 394.926 c 0 -103.234 0 -154.851 20.091 -194.281 a 184.329 184.329 0 0 1 80.555 -80.555 c 39.430 -20.091 91.047 -20.091 194.281 -20.091 Z";

export function AppIcon({ f, size, bubbleAt = 24 }: { f: number; size: number; bubbleAt?: number }) {
  const id = useSvgId();
  const plate = sp(f, 0, { damping: 11, stiffness: 120 });
  const guy = sp(f, 8, { damping: 10, stiffness: 140 });
  const pal = sp(f, 16, { damping: 12, stiffness: 130 });
  const bubble = sp(f, bubbleAt, { damping: 10, stiffness: 170 });
  const blinkT = (f - 90) % 150;
  const blink = blinkT >= 0 && blinkT < 8 ? Math.sin((blinkT / 8) * Math.PI) : 0;
  const palBlinkT = (f - 120) % 150;
  const palBlink = palBlinkT >= 0 && palBlinkT < 8 ? Math.sin((palBlinkT / 8) * Math.PI) : 0;
  const stretch = 1 + 0.12 * Math.sin(Math.min(1, prog(f, 8, 26, EASE.soft)) * Math.PI) * (1 - guy * 0.3);
  return (
    <svg width={size} height={size} viewBox="0 0 1024 1024" style={{ overflow: "visible" }}>
      <defs>
        <linearGradient id={`${id}-bg`} x1="0.15" y1="0" x2="0.85" y2="1">
          <stop offset="0" stopColor="#FFC56E" />
          <stop offset="0.55" stopColor="#FF8F4E" />
          <stop offset="1" stopColor="#FF5F45" />
        </linearGradient>
        <radialGradient id={`${id}-sheen`} cx="0.3" cy="0.12" r="0.75">
          <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.55" />
          <stop offset="0.6" stopColor="#FFFFFF" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${id}-vig`} cx="0.5" cy="1.05" r="0.7">
          <stop offset="0" stopColor="#C2321A" stopOpacity="0.35" />
          <stop offset="1" stopColor="#C2321A" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${id}-bubble`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="1" stopColor="#FFF1E8" />
        </linearGradient>
        <GuyDefs id={`${id}-guy`} palette={PAL.white} />
        <GuyDefs id={`${id}-pal`} palette={PAL.mint} />
        <clipPath id={`${id}-clip`}>
          <path d={PLATE} />
        </clipPath>
        <filter id={`${id}-shadow`} x="-20%" y="-20%" width="140%" height="150%">
          <feDropShadow dx="0" dy="30" stdDeviation="36" floodColor="#8A2A10" floodOpacity="0.35" />
        </filter>
        <filter id={`${id}-lift`} x="-30%" y="-30%" width="160%" height="170%">
          <feDropShadow dx="0" dy="16" stdDeviation="20" floodColor="#8A2A10" floodOpacity="0.3" />
        </filter>
      </defs>

      <g transform={`translate(512 512) scale(${plate}) rotate(${(1 - plate) * -14}) translate(-512 -512)`}>
        <path d={PLATE} fill={`url(#${id}-bg)`} filter={`url(#${id}-shadow)`} />
        <g clipPath={`url(#${id}-clip)`}>
          <rect width="1024" height="1024" fill={`url(#${id}-vig)`} />
          <rect width="1024" height="1024" fill={`url(#${id}-sheen)`} />
          {/* friend peeks in from the left, guy pops up from below */}
          <g transform={`translate(${282 - (1 - pal) * 260} 584) scale(1.24)`} filter={`url(#${id}-lift)`}>
            <GuyBody id={`${id}-pal`} palette={PAL.mint} look={1.4} blink={palBlink} highlight={0} />
          </g>
          <g transform={`translate(560 ${574 + (1 - guy) * 520}) translate(0 204) scale(${1 / Math.sqrt(stretch)} ${stretch}) translate(0 -204) scale(2.04)`} filter={`url(#${id}-lift)`}>
            <GuyBody id={`${id}-guy`} palette={PAL.white} look={-0.4} blink={blink} />
          </g>
        </g>
        <g transform={`translate(712 256) translate(-90 60) scale(${bubble}) translate(90 -60)`} filter={`url(#${id}-lift)`} opacity={map(bubble, [0, 0.2], [0, 1])}>
          <path d="M -116 -64 h 232 a 64 64 0 0 1 64 64 v 0 a 64 64 0 0 1 -64 64 h -150 l -58 44 l 6 -46 a 64 64 0 0 1 -94 -62 v 0 a 64 64 0 0 1 64 -64 z" fill={`url(#${id}-bubble)`} />
          {[0, 1, 2].map((i) => {
            const ph = ((f - bubbleAt) / 40) * Math.PI * 2 - i * 0.9;
            const lift = Math.max(0, Math.sin(ph));
            return <circle key={i} cx={-62 + i * 62} cy={-lift * 14} r={22} fill="#FF8F4E" opacity={0.45 + 0.55 * lift} />;
          })}
        </g>
      </g>
    </svg>
  );
}
