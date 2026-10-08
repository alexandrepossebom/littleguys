import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { EASE, lerp, lerpScale, map, prog, sp } from "../anim";
import { C, F } from "../theme";
import { K, MOODS, S, type Mood } from "../timeline";
import { Guy } from "../ui/Guy";
import { Rise, gradientText } from "../ui/kit";
import { Sprite } from "../ui/Sprite";
import { Grain, MenuBar, SPRITE_C, SPRITE_H, SPRITE_W, Wallpaper, WarmStage } from "../ui/stage";
import { HELLO_GUY } from "./Hello";

// The guy flies up into the menu bar and becomes the sprite. We push into
// it and run through every mood, then pull back out to the desktop.

const k = K.moods;
const STAGE = { x: 960, y: 410 };
const ZOOM = 340 / SPRITE_H;

const WORDS: Record<Mood, { word: string; style: React.CSSProperties; glow: string }> = {
  idle: { word: "Idle.", style: { color: C.ink }, glow: "rgba(255,206,160,0.55)" },
  working: { word: "Working.", style: gradientText("linear-gradient(100deg, #FFB347, #FF7A45 60%, #FF5FA2)"), glow: "rgba(255,150,80,0.5)" },
  news: { word: "Has news.", style: gradientText("linear-gradient(100deg, #FF7A45, #FF5FA2)"), glow: "rgba(255,110,170,0.42)" },
  needs: { word: "Needs you.", style: gradientText("linear-gradient(100deg, #FF453A, #FF9F0A)"), glow: "rgba(255,80,60,0.42)" },
  offline: { word: "Offline.", style: { color: C.ink3 }, glow: "rgba(170,160,220,0.4)" },
};

function moodAt(t: number): { mood: Mood; i: number; tm: number } {
  if (t >= k.zoomOut) return { mood: "news", i: MOODS.length, tm: t - k.zoomOut };
  const i = Math.max(0, Math.min(MOODS.length - 1, Math.floor((t - k.stage) / k.each)));
  return { mood: MOODS[i], i, tm: t - k.stage - i * k.each };
}

export function Moods() {
  const t = useCurrentFrame();
  const { mood, i, tm } = moodAt(t);

  // camera: in during [zoomIn, stage], out during [zoomOut, end]
  const zin = prog(t, k.zoomIn, k.stage - k.zoomIn, EASE.inOut);
  const zout = prog(t, k.zoomOut, S.moods.dur - k.zoomOut, EASE.inOut);
  const e = t < k.zoomOut ? zin : 1 - zout;
  const z = lerpScale(1, ZOOM, e);
  const px = lerp(SPRITE_C.x, STAGE.x, e);
  const py = lerp(SPRITE_C.y, STAGE.y, e);
  const onStage = t >= k.stage && t < k.zoomOut;

  const desktopIn = map(t, [6, 26], [0, 1]);
  const chrome = t < k.zoomOut ? map(t, [k.zoomIn + 2, k.zoomIn + 20], [1, 0]) : map(t, [k.zoomOut + 10, k.zoomOut + 28], [0, 1]);
  const wall = t < k.zoomOut ? map(t, [k.zoomIn + 6, k.stage - 2], [1, 0]) : map(t, [k.zoomOut + 2, k.zoomOut + 24], [0, 1]);

  // the flight from the hello stage up into the menu bar
  const fl = prog(t, 0, k.zoomIn, EASE.inOut);
  const footX = SPRITE_C.x - SPRITE_W / 2 + (10 / 22) * SPRITE_W;
  const footY = SPRITE_C.y - SPRITE_H / 2 + (16.4 / 18) * SPRITE_H;
  const arc = Math.sin(fl * Math.PI) * 160;
  const gx = lerp(HELLO_GUY.x, footX, fl) - arc * 0.35;
  const gy = lerp(HELLO_GUY.floor, footY, fl) - arc;
  const gr = lerpScale(HELLO_GUY.r, 11.2, fl);
  const flightStretch = 1 + 0.35 * Math.sin(fl * Math.PI);
  const morph = map(t, [k.zoomIn - 10, k.zoomIn - 2], [0, 1]);

  const pop = i > 0 ? 0.9 + 0.1 * sp(t, k.stage + i * k.each, { damping: 8, stiffness: 320 }) : 1;
  const stageIn = sp(t, k.stage - 4, { damping: 12, stiffness: 160 });
  const spriteT = t < k.stage ? t : tm;
  const cameraMood: Mood = t < k.zoomOut ? "idle" : "news";

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <AbsoluteFill style={{ opacity: desktopIn }}>
        <WarmStage f={S.moods.from + t} />
      </AbsoluteFill>

      {/* mood glows behind the big sprite */}
      {MOODS.map((m, j) => {
        const a = k.stage + j * k.each;
        const o = map(t, [a - 8, a + 12, a + k.each - 4, a + k.each + 12], [0, 1, 1, 0]);
        return (
          <AbsoluteFill key={m} style={{ opacity: o * (onStage ? 1 : 0), background: `radial-gradient(520px 420px at ${STAGE.x}px ${STAGE.y}px, ${WORDS[m].glow}, transparent 70%)` }} />
        );
      })}

      {/* the desktop, under a camera */}
      {!onStage && (
        <AbsoluteFill style={{ opacity: desktopIn, transformOrigin: "0 0", transform: `translate(${px - z * SPRITE_C.x}px, ${py - z * SPRITE_C.y}px) scale(${z})` }}>
          <AbsoluteFill style={{ opacity: wall }}>
            <Wallpaper />
          </AbsoluteFill>
          <MenuBar chrome={chrome} mood={cameraMood} t={spriteT} showSprite={false} />
          <div style={{ position: "absolute", left: SPRITE_C.x - SPRITE_W / 2, top: SPRITE_C.y - SPRITE_H / 2, opacity: t < k.zoomIn ? morph : 1 }}>
            <Sprite mood={cameraMood} t={t < k.zoomOut ? t : tm} height={SPRITE_H} fill={C.ink} />
          </div>
        </AbsoluteFill>
      )}

      {/* the flying guy */}
      {t < k.zoomIn && (
        <Guy x={gx} y={gy} r={gr} squash={flightStretch} rotate={Math.sin(fl * Math.PI) * 12} opacity={1 - morph} shadow={1 - fl} />
      )}

      {/* the stage: one big sprite going through the moods */}
      {onStage && (
        <div
          style={{
            position: "absolute",
            left: STAGE.x - (SPRITE_W * ZOOM) / 2,
            top: STAGE.y - (SPRITE_H * ZOOM) / 2,
            transform: `scale(${pop})`,
            filter: "drop-shadow(0 30px 40px rgba(120,40,10,0.18))",
          }}
        >
          <Sprite mood={mood} t={tm} height={SPRITE_H * ZOOM} fill={C.ink} />
        </div>
      )}

      {onStage && (
        <>
          <AbsoluteFill style={{ alignItems: "center", top: 70 }}>
            <Rise
              text="A little guy in your menu bar."
              f={t}
              at={k.stage + 2}
              out={k.zoomOut - 26}
              stagger={3}
              style={{ fontFamily: F.display, fontWeight: 720, fontSize: 64, letterSpacing: "-0.03em", color: C.ink, opacity: stageIn }}
            />
          </AbsoluteFill>
          <div style={{ position: "absolute", left: 0, right: 0, top: 700, height: 200, overflow: "hidden" }}>
            {MOODS.map((m, j) => {
              const a = k.stage + j * k.each;
              const enter = prog(t, a - 2, 20, EASE.out);
              const leave = prog(t, a + k.each - 6, 16, EASE.in);
              if (t < a - 2 || t > a + k.each + 12) return null;
              return (
                <div
                  key={m}
                  style={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    justifyContent: "center",
                    transform: `translateY(${(1 - enter) * 100 - leave * 100}%)`,
                    fontFamily: F.display,
                    fontWeight: 820,
                    fontSize: 156,
                    letterSpacing: "-0.05em",
                    lineHeight: "190px",
                  }}
                >
                  <span style={{ ...WORDS[m].style, padding: "0 0.1em" }}>{WORDS[m].word}</span>
                </div>
              );
            })}
          </div>
        </>
      )}
      <Grain f={t} opacity={onStage ? 0.18 : 0.12} />
    </AbsoluteFill>
  );
}
