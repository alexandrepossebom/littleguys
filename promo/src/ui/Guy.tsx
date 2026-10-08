import React, { useId } from "react";

// The littleguys mascot in color, built from the same geometry as the app
// icon (scripts/gen-icons.mjs: guyShape + face), in units where the head
// radius is 100. The origin sits where the dome meets the straight sides;
// feet touch the floor at y ≈ 100.

export type Eyes = "open" | "happy" | "sleep";
export type Palette = { hi: string; mid: string; lo: string; blush?: string };

export const PAL: Record<string, Palette> = {
  white: { hi: "#FFFFFF", mid: "#FFF6F0", lo: "#F5D9CB", blush: "#FF7F86" },
  mint: { hi: "#C9F7E2", mid: "#8FE3BF", lo: "#5BC79F", blush: "#FF5C8A" },
  peach: { hi: "#FFE1C7", mid: "#FFB98A", lo: "#FF8F5A", blush: "#FF5C6A" },
  lilac: { hi: "#EDE2FF", mid: "#C9B2FF", lo: "#A386F2", blush: "#FF6FA8" },
  sky: { hi: "#DDF1FF", mid: "#A6D8FF", lo: "#6FB6F2", blush: "#FF7F9E" },
  butter: { hi: "#FFF6CC", mid: "#FFE27A", lo: "#F7C640", blush: "#FF7F6E" },
  rose: { hi: "#FFE0EA", mid: "#FFB1C8", lo: "#F784A6", blush: "#FF5C7A" },
  coral: { hi: "#FFD7CC", mid: "#FF9E85", lo: "#FF6F5A", blush: "#FF4F6A" },
};

export interface FaceOpts {
  eyes?: Eyes;
  /** 0 = open, 1 = shut. */
  blink?: number;
  /** -1…1, eyes slide sideways. */
  look?: number;
  /** Waving arm angle in degrees (0 = straight out), or null for no arm. */
  arm?: number | null;
  mouth?: "smile" | "open";
  highlight?: number;
}

/** The guy drawn in r=100 units. Needs <GuyDefs> with the same id in scope. */
export function GuyBody({ id, eyes = "open", blink = 0, look = 0, arm = null, mouth = "smile", highlight = 0.9, palette = PAL.white }: FaceOpts & { id: string; palette?: Palette }) {
  const fill = `url(#${id}-body)`;
  const dx = look * 6;
  const ex = 36;
  const ey = -12;
  const blushColor = palette.blush ?? "#FF7F86";
  const eyeRy = 21 * (1 - 0.92 * blink);
  return (
    <g>
      {arm !== null && (
        <g transform={`translate(84 22) rotate(${-arm})`}>
          <rect x={-6} y={-13} width={56} height={26} rx={13} fill={fill} />
        </g>
      )}
      <path d="M -100 0 A 100 100 0 0 1 100 0 L 100 56 Q 100 82 74 82 L -74 82 Q -100 82 -100 56 Z" fill={fill} />
      <rect x={-54} y={66.7} width={46} height={34} rx={16.3} fill={fill} />
      <rect x={8} y={66.7} width={46} height={34} rx={16.3} fill={fill} />
      {highlight > 0 && <ellipse cx={-43} cy={-60} rx={32} ry={18} transform="rotate(-24 -43 -60)" fill="#FFFFFF" opacity={highlight} />}
      {[-ex, ex].map((x, i) => {
        const cx = x + dx;
        if (eyes === "happy") {
          return <path key={i} d={`M ${cx - 15} ${ey + 7} Q ${cx} ${ey - 16} ${cx + 15} ${ey + 7}`} stroke={`url(#${id}-eye)`} strokeWidth={8} fill="none" strokeLinecap="round" />;
        }
        if (eyes === "sleep") {
          return <path key={i} d={`M ${cx - 15} ${ey - 2} Q ${cx} ${ey + 13} ${cx + 15} ${ey - 2}`} stroke={`url(#${id}-eye)`} strokeWidth={8} fill="none" strokeLinecap="round" />;
        }
        return (
          <g key={i}>
            <ellipse cx={cx} cy={ey} rx={15} ry={eyeRy} fill={`url(#${id}-eye)`} />
            {blink < 0.5 && (
              <>
                <circle cx={cx + 5.25} cy={ey - 8} r={5.4} fill="#fff" />
                <circle cx={cx - 4.5} cy={ey + 8.8} r={2.1} fill="#fff" opacity={0.8} />
              </>
            )}
          </g>
        );
      })}
      <ellipse cx={-66} cy={20} rx={15} ry={9} fill={blushColor} opacity={0.45} />
      <ellipse cx={66} cy={20} rx={15} ry={9} fill={blushColor} opacity={0.45} />
      {mouth === "open" ? (
        <path d={`M ${-13 + dx} 19 Q ${dx} 40 ${13 + dx} 19 Z`} fill="#3A2318" stroke="#3A2318" strokeWidth={5} strokeLinejoin="round" />
      ) : (
        <path d={`M ${-15 + dx} 20 Q ${dx} 34 ${15 + dx} 20`} stroke="#3A2318" strokeWidth={7} fill="none" strokeLinecap="round" />
      )}
    </g>
  );
}

export function GuyDefs({ id, palette = PAL.white }: { id: string; palette?: Palette }) {
  return (
    <>
      <radialGradient id={`${id}-body`} cx="0.36" cy="0.25" r="0.95">
        <stop offset="0" stopColor={palette.hi} />
        <stop offset="0.6" stopColor={palette.mid} />
        <stop offset="1" stopColor={palette.lo} />
      </radialGradient>
      <linearGradient id={`${id}-eye`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#4A2E22" />
        <stop offset="1" stopColor="#21130D" />
      </linearGradient>
    </>
  );
}

export function useSvgId() {
  return "g" + useId().replace(/[^a-zA-Z0-9]/g, "");
}

/**
 * A standalone guy, positioned by the point between his feet on the floor.
 * `squash` > 1 stretches him tall, < 1 squashes him, anchored to the floor.
 */
export function Guy({
  x,
  y,
  r,
  palette = PAL.white,
  squash = 1,
  rotate = 0,
  shadow = true,
  opacity = 1,
  ...face
}: FaceOpts & { x: number; y: number; r: number; palette?: Palette; squash?: number; rotate?: number; shadow?: boolean | number; opacity?: number }) {
  const id = useSvgId();
  const k = r / 100;
  const sx = 1 / Math.sqrt(squash);
  const shadowAmt = typeof shadow === "number" ? shadow : shadow ? 1 : 0;
  return (
    <svg
      width={240 * k}
      height={250 * k}
      viewBox="-120 -140 240 250"
      style={{ position: "absolute", left: x - 120 * k, top: y - 240 * k, overflow: "visible", opacity }}
    >
      <defs>
        <GuyDefs id={id} palette={palette} />
        <filter id={`${id}-soft`} x="-50%" y="-200%" width="200%" height="500%">
          <feGaussianBlur stdDeviation={7} />
        </filter>
      </defs>
      {shadowAmt > 0 && <ellipse cx={0} cy={102} rx={78 * sx} ry={11} fill="#9C2F12" opacity={0.22 * shadowAmt} filter={`url(#${id}-soft)`} />}
      <g transform={`translate(0 100) rotate(${rotate}) scale(${sx} ${squash}) translate(0 -100)`}>
        <GuyBody id={id} palette={palette} {...face} />
      </g>
    </svg>
  );
}
