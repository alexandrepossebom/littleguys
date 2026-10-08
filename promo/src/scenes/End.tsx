import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { map, sp } from "../anim";
import { C, F } from "../theme";
import { K, S } from "../timeline";
import { AppIcon } from "../ui/AppIcon";
import { Rise } from "../ui/kit";
import { Grain, WarmStage } from "../ui/stage";

const k = K.end;

export function End() {
  const e = useCurrentFrame();
  const fadeIn = map(e, [0, 14], [0, 1]);
  const glow = sp(e, 0, { damping: 20, stiffness: 60 });
  const settle = map(e, [0, S.end.dur], [1.04, 1]);
  return (
    <AbsoluteFill style={{ overflow: "hidden", opacity: fadeIn }}>
      <WarmStage f={S.end.from + e} intensity={1.25} />
      <AbsoluteFill style={{ background: `radial-gradient(620px 520px at 50% 40%, rgba(255,170,110,${0.45 * glow}), transparent 70%)` }} />
      <AbsoluteFill style={{ transform: `scale(${settle})` }}>
        <div style={{ position: "absolute", left: 960 - 190, top: 120 }}>
          <AppIcon f={e - k.plate} size={380} bubbleAt={k.bubble} />
        </div>
        <AbsoluteFill style={{ alignItems: "center", top: 540 }}>
          <div style={{ fontFamily: F.display, fontWeight: 820, fontSize: 164, letterSpacing: "-0.05em", color: C.ink, display: "flex" }}>
            {Array.from("littleguys").map((ch, i) => {
              const s = sp(e, k.word + i * 2.5, { damping: 10, stiffness: 200 });
              return (
                <span key={i} style={{ display: "inline-block", transform: `translateY(${(1 - s) * 70}px)`, opacity: map(s, [0, 0.4], [0, 1]) }}>
                  {ch}
                </span>
              );
            })}
          </div>
          <div style={{ marginTop: 2 }}>
            <Rise text="A friendlier home for your AI agents." f={e} at={k.tag} stagger={3} style={{ fontFamily: F.display, fontWeight: 640, fontSize: 50, letterSpacing: "-0.025em", color: C.ink2 }} />
          </div>
          <div style={{ marginTop: 34, opacity: map(e, [k.fine, k.fine + 20], [0, 1]), transform: `translateY(${map(e, [k.fine, k.fine + 20], [10, 0])}px)` }}>
            <span style={{ fontFamily: F.ui, fontSize: 22, fontWeight: 600, letterSpacing: "0.14em", color: C.ink3 }}>
              FOR MACOS · OPENCLAW · HERMES · CLAUDE CODE · CODEX · GEMINI · AND MORE
            </span>
          </div>
        </AbsoluteFill>
      </AbsoluteFill>
      <Grain f={e} />
    </AbsoluteFill>
  );
}
