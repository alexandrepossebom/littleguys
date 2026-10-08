import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { EASE, lerp, map, prog, sp } from "../anim";
import { C, F } from "../theme";
import { K, S } from "../timeline";
import { Guy, PAL, type Palette } from "../ui/Guy";
import { Rise } from "../ui/kit";
import { Sprite } from "../ui/Sprite";
import { Grain, WarmStage } from "../ui/stage";

// Any runtime gets a guy. Then they pack up into the machines they live on,
// all wired back to the one menu bar.

const k = K.anyGuy;

const RUNTIMES: Array<{ name: string; pal: Palette; home: number }> = [
  { name: "OpenClaw", pal: PAL.coral, home: 0 },
  { name: "Hermes", pal: PAL.lilac, home: 1 },
  { name: "Claude Code", pal: PAL.peach, home: 0 },
  { name: "Codex", pal: PAL.white, home: 0 },
  { name: "Gemini CLI", pal: PAL.sky, home: 2 },
  { name: "Goose", pal: PAL.butter, home: 1 },
  { name: "OpenCode", pal: PAL.mint, home: 2 },
];

const MACHINES = [
  { x: 400, icon: "🖥️", name: "studio", sub: "Mac mini · over Tailscale" },
  { x: 960, icon: "🐧", name: "homelab", sub: "Linux box · on your LAN" },
  { x: 1520, icon: "💻", name: "this Mac", sub: "local gateway" },
];
const CARD = { top: 440, w: 480, h: 320 };
const HUB = { x: 960, y: 296, w: 320, h: 76 };

function slotFor(i: number) {
  const home = RUNTIMES[i].home;
  const mates = RUNTIMES.map((r, j) => ({ r, j })).filter(({ r }) => r.home === home);
  const idx = mates.findIndex(({ j }) => j === i);
  const spread = mates.length === 3 ? 124 : 76;
  return { x: MACHINES[home].x + (idx - (mates.length - 1) / 2) * spread, floor: CARD.top + 196 };
}

export function AnyGuy() {
  const a = useCurrentFrame();
  const out = prog(a, k.exit, 30, EASE.in);
  const fadeIn = map(a, [0, 22], [0, 1]);

  return (
    <AbsoluteFill style={{ overflow: "hidden", opacity: fadeIn }}>
      <WarmStage f={S.anyGuy.from + a} />

      <AbsoluteFill style={{ alignItems: "center", top: 96, opacity: 1 - out }}>
        <div style={{ position: "absolute" }}>
          <Rise text="Bring any guy." f={a} at={6} out={k.group - 12} stagger={4} style={{ fontFamily: F.display, fontWeight: 800, fontSize: 116, letterSpacing: "-0.045em", color: C.ink }} />
        </div>
        <div style={{ position: "absolute", top: -40 }}>
          <Rise text="From any machine." f={a} at={k.group + 2} stagger={4} style={{ fontFamily: F.display, fontWeight: 800, fontSize: 96, letterSpacing: "-0.045em", color: C.ink }} />
        </div>
      </AbsoluteFill>

      <AbsoluteFill style={{ alignItems: "center", top: 800, opacity: 1 - prog(a, k.group - 16, 14, EASE.in) }}>
        <Rise text="OpenClaw, Hermes, and any ACP agent. Same friendly face." f={a} at={86} stagger={2} style={{ fontFamily: F.display, fontWeight: 620, fontSize: 38, letterSpacing: "-0.02em", color: C.ink2 }} />
      </AbsoluteFill>

      <AbsoluteFill style={{ transform: `scale(${1 - 0.06 * out})`, opacity: 1 - out }}>
        {/* machine cards and wires to the menu bar */}
        <svg width="1920" height="1080" style={{ position: "absolute", inset: 0 }}>
          {MACHINES.map((m, j) => {
            const draw = prog(a, k.group + 26 + j * 4, 34, EASE.inOut);
            const d = `M ${m.x} ${CARD.top} C ${m.x} ${CARD.top - 70}, ${HUB.x} ${HUB.y + 120}, ${HUB.x} ${HUB.y + HUB.h / 2}`;
            if (draw < 0.002) return null;
            return (
              <g key={j}>
                <path d={d} stroke="rgba(240,96,42,0.18)" strokeWidth={10} fill="none" pathLength={1} strokeDasharray={`${draw} 1`} strokeLinecap="round" />
                <path
                  d={d}
                  stroke={C.accent}
                  strokeWidth={3.5}
                  fill="none"
                  strokeDasharray="2 14"
                  strokeDashoffset={-a * 0.9}
                  strokeLinecap="round"
                  opacity={draw}
                />
              </g>
            );
          })}
        </svg>
        {MACHINES.map((m, j) => {
          const s = sp(a, k.group + 8 + j * 5, { damping: 14, stiffness: 150 });
          return (
            <div
              key={j}
              style={{
                position: "absolute",
                left: m.x - CARD.w / 2,
                top: CARD.top,
                width: CARD.w,
                height: CARD.h,
                borderRadius: 34,
                background: "rgba(255,255,255,0.62)",
                boxShadow: "0 30px 70px rgba(120,45,10,0.14), inset 0 0 0 1.5px rgba(255,255,255,0.9), 0 0 0 1px rgba(0,0,0,0.05)",
                transform: `scale(${0.7 + 0.3 * s})`,
                opacity: map(s, [0, 0.3], [0, 1]),
                fontFamily: F.ui,
              }}
            >
              <div style={{ position: "absolute", left: 0, right: 0, bottom: 30, textAlign: "center" }}>
                <div style={{ fontSize: 27, fontWeight: 700, color: C.ink }}>
                  {m.icon} {m.name}
                </div>
                <div style={{ fontSize: 17, color: C.ink3, marginTop: 4 }}>{m.sub}</div>
              </div>
            </div>
          );
        })}
        {/* the hub: your menu bar */}
        {(() => {
          const s = sp(a, k.group + 20, { damping: 12, stiffness: 180 });
          return (
            <div
              style={{
                position: "absolute",
                left: HUB.x - HUB.w / 2,
                top: HUB.y - HUB.h / 2,
                width: HUB.w,
                height: HUB.h,
                borderRadius: HUB.h / 2,
                background: "rgba(255,250,246,0.92)",
                boxShadow: "0 18px 40px rgba(120,45,10,0.18), 0 0 0 1px rgba(0,0,0,0.06)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 16,
                transform: `scale(${s})`,
                fontFamily: F.display,
                fontWeight: 760,
                fontSize: 28,
                letterSpacing: "-0.02em",
                color: C.ink,
              }}
            >
              <Sprite mood="working" t={a} height={40} fill={C.ink} />
              littleguys
            </div>
          );
        })()}

        {/* the guys */}
        {RUNTIMES.map((rt, i) => {
          const at = k.popFrom + i * k.popEvery;
          const grow = sp(a, at, { damping: 9, stiffness: 170 });
          if (a < at) return null;
          const stretch = map(a, [at, at + 6, at + 14, at + 24, at + 34], [0.6, 1.3, 0.88, 1.05, 1]);
          const hopT = (a - k.wave - i * 5) / 18;
          const hop = hopT > 0 && hopT < 1 ? Math.sin(hopT * Math.PI) : 0;
          const land = map(hopT, [0.92, 1.05, 1.25], [1, 0.86, 1]);
          const move = sp(a, k.group + i * 3, { damping: 15, stiffness: 120 });
          const slot = slotFor(i);
          const rowX = 960 + (i - 3) * 236;
          const x = lerp(rowX, slot.x, move);
          const floor = lerp(640, slot.floor, move) - hop * 46 - Math.sin(Math.min(1, move) * Math.PI) * 70;
          const r = lerp(70, 46, move) * grow;
          const blinkT = (a + i * 37) % 140;
          const blink = blinkT < 8 ? Math.sin((blinkT / 8) * Math.PI) : 0;
          const breathe = 1 + 0.018 * Math.sin(((a + i * 13) / 70) * Math.PI * 2);
          const chip = sp(a, at + 6, { damping: 13, stiffness: 200 }) * (1 - prog(a, k.group - 4, 12, EASE.in));
          return (
            <React.Fragment key={rt.name}>
              <Guy
                x={x}
                y={floor}
                r={Math.max(1, r)}
                palette={rt.pal}
                squash={(a < at + 34 ? stretch : land) * breathe}
                blink={blink}
                look={(960 - x) / 900}
                eyes={hop > 0.2 ? "happy" : "open"}
                shadow={1 - hop * 0.6}
              />
              {chip > 0.01 && (
                <div
                  style={{
                    position: "absolute",
                    left: rowX,
                    top: 676,
                    transform: `translateX(-50%) scale(${chip})`,
                    padding: "9px 18px",
                    borderRadius: 20,
                    background: "#fff",
                    boxShadow: "0 8px 20px rgba(120,45,10,0.12), 0 0 0 1px rgba(0,0,0,0.05)",
                    fontFamily: F.ui,
                    fontSize: 19,
                    fontWeight: 650,
                    color: C.ink,
                    whiteSpace: "nowrap",
                  }}
                >
                  {rt.name}
                </div>
              )}
            </React.Fragment>
          );
        })}
      </AbsoluteFill>
      <Grain f={a} />
    </AbsoluteFill>
  );
}
