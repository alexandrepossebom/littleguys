import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { EASE, lerp, map, prog, sp } from "../anim";
import { C, F, GRAD } from "../theme";
import { K, S } from "../timeline";
import { Guy } from "../ui/Guy";
import { Rise } from "../ui/kit";
import { Grain, WarmStage } from "../ui/stage";

// The dot hops, lands, and a warm world blooms out of the impact. The dot
// grows into the little guy, who says hi. Then the wordmark.

const k = K.hello;
export const HELLO_GUY = { x: 960, floor: 560, r: 110 };

function wipe(r: number): React.CSSProperties {
  const c = `circle(${r}px at ${HELLO_GUY.x}px ${HELLO_GUY.floor}px)`;
  return { clipPath: c, WebkitClipPath: c };
}

export function Hello() {
  const g = useCurrentFrame();
  const { x, floor, r } = HELLO_GUY;

  // the dot: squash, hop, fall
  const up = prog(g, k.hop, 10, EASE.out);
  const down = prog(g, k.hop + 10, k.impact - k.hop - 10, (t) => t * t);
  const dotY = g < k.hop + 10 ? lerp(540, 380, up) : lerp(380, floor - 14, down);
  const dotSx = g < k.hop ? map(g, [0, k.hop], [1, 1.2]) : g < k.impact ? map(g, [k.hop, k.hop + 4, k.impact - 4, k.impact], [0.85, 1, 1, 0.8]) : map(g, [k.impact, k.impact + 3], [1.7, 1.2]);
  const dotSy = g < k.hop ? map(g, [0, k.hop], [1, 0.8]) : g < k.impact ? map(g, [k.hop, k.hop + 4, k.impact - 4, k.impact], [1.25, 1, 1, 1.25]) : map(g, [k.impact, k.impact + 3], [0.5, 0.8]);
  const dotOpacity = map(g, [k.impact + 2, k.impact + 6], [1, 0]);

  // the guy grows out of the dot
  const grow = sp(g, k.impact + 2, { damping: 9, stiffness: 150 });
  const stretch = g < k.impact + 2 ? 0.6 : map(g, [k.impact + 2, k.impact + 8, k.impact + 16, k.impact + 26, k.impact + 36], [0.6, 1.28, 0.88, 1.05, 1]);
  const breathe = 1 + 0.015 * Math.sin(((g - 60) / 90) * Math.PI * 2);
  const blinkAt = [74, 160];
  const blink = blinkAt.reduce((b, at) => Math.max(b, g >= at && g < at + 8 ? Math.sin(((g - at) / 8) * Math.PI) : 0), 0);
  const waving = g >= k.hi - 6 && g < k.hi + 64;
  const arm = waving ? 45 + 28 * Math.sin(((g - k.hi + 6) / 22) * Math.PI * 2) * map(g, [k.hi - 6, k.hi + 4, k.hi + 50, k.hi + 64], [0, 1, 1, 0]) - map(g, [k.hi - 6, k.hi + 2, k.hi + 56, k.hi + 64], [60, 0, 0, 60]) : null;

  // the world blooms out of the landing
  const r1 = map(g, [k.impact, k.impact + 34], [0, 2300], EASE.inOut);
  const r2 = map(g, [k.impact + 7, k.impact + 42], [0, 2300], EASE.inOut);

  // speech bubble
  const bub = sp(g, k.bubble, { damping: 11, stiffness: 200 }) * (1 - prog(g, k.handoff - 34, 14, EASE.in));
  const hi = prog(g, k.hi, 10);

  // exit
  const exit = prog(g, k.handoff - 6, 26, EASE.in);

  return (
    <AbsoluteFill style={{ background: C.dark, overflow: "hidden" }}>
      <AbsoluteFill style={{ background: GRAD, ...wipe(r1) }} />
      <AbsoluteFill style={wipe(r2)}>
        <WarmStage f={S.hello.from + g} />
        <Grain f={g} />
      </AbsoluteFill>

      {g < k.impact + 8 && (
        <div
          style={{
            position: "absolute",
            left: x - 14,
            top: dotY - 14,
            width: 28,
            height: 28,
            borderRadius: "50%",
            background: "#FFF7F0",
            transform: `scale(${dotSx}, ${dotSy})`,
            transformOrigin: "50% 100%",
            opacity: dotOpacity,
            boxShadow: "0 0 40px rgba(255,190,140,0.6)",
          }}
        />
      )}

      {g >= k.impact + 2 && g < k.handoff && (
        <Guy x={x} y={floor} r={r * lerp(0.13, 1, grow)} squash={stretch * breathe} blink={blink} arm={arm} mouth={g >= k.hi && g < k.hi + 40 ? "open" : "smile"} />
      )}

      {/* speech bubble: typing, then hi */}
      {g >= k.bubble && (
        <div
          style={{
            position: "absolute",
            left: x + 92,
            top: floor - 2 * r - 120,
            transform: `scale(${bub})`,
            transformOrigin: "0% 100%",
            height: 92,
            minWidth: 156,
            padding: "0 30px",
            borderRadius: 46,
            borderBottomLeftRadius: 14,
            background: "linear-gradient(#FFFFFF, #FFF1E8)",
            boxShadow: "0 18px 40px rgba(138,42,16,0.18)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: F.display,
            fontWeight: 760,
            fontSize: 48,
            color: C.ink,
          }}
        >
          {g < k.hi ? (
            <div style={{ display: "flex", gap: 14 }}>
              {[0, 1, 2].map((i) => {
                const lift = Math.max(0, Math.sin(((g - k.bubble) / 26) * Math.PI * 2 - i * 0.9));
                return <div key={i} style={{ width: 20, height: 20, borderRadius: "50%", background: "#FF8F4E", opacity: 0.45 + 0.55 * lift, transform: `translateY(${-lift * 8}px)` }} />;
              })}
            </div>
          ) : (
            <span style={{ display: "inline-block", transform: `scale(${0.6 + 0.4 * hi})`, opacity: hi }}>hi! 👋</span>
          )}
        </div>
      )}

      {/* wordmark */}
      <AbsoluteFill style={{ alignItems: "center", top: 600, opacity: 1 - exit, transform: `translateY(${exit * 40}px)` }}>
        <div style={{ fontFamily: F.display, fontWeight: 820, fontSize: 184, letterSpacing: "-0.05em", color: C.ink, display: "flex" }}>
          {Array.from("littleguys").map((ch, i) => {
            const s = sp(g, k.word + i * 3, { damping: 9, stiffness: 210 });
            return (
              <span key={i} style={{ display: "inline-block", transform: `translateY(${(1 - s) * 90}px) scale(${0.5 + 0.5 * s})`, opacity: map(s, [0, 0.4], [0, 1]), transformOrigin: "50% 100%" }}>
                {ch}
              </span>
            );
          })}
        </div>
        <div style={{ marginTop: 6 }}>
          <Rise text="A little guy for every AI agent." f={g} at={k.sub} stagger={3} style={{ fontFamily: F.display, fontWeight: 620, fontSize: 52, letterSpacing: "-0.02em", color: C.ink2 }} />
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

