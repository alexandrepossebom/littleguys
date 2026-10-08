import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { EASE, lerp, map, prog, sp } from "../anim";
import { C, F } from "../theme";
import { K } from "../timeline";
import { Grain } from "../ui/stage";
import { Rise } from "../ui/kit";

// Cold open: agents scattered across terminals, tabs and machines. Windows
// pile up until the question lands, then everything implodes into one dot.

const k = K.chaos;

type Win = { x: number; y: number; w: number; h: number; title: string; rot: number; browser?: boolean; alert?: string };

const WINDOWS: Win[] = [
  { x: 70, y: 70, w: 500, h: 290, title: "claude — ~/shop-api", rot: -1.5 },
  { x: 1370, y: 80, w: 480, h: 270, title: "codex — web", rot: 1.2, alert: "3" },
  { x: 650, y: 46, w: 430, h: 220, title: "hermes serve", rot: 0.6 },
  { x: 90, y: 700, w: 520, h: 300, title: "openclaw gateway — studio", rot: 1.4 },
  { x: 1320, y: 690, w: 520, h: 300, title: "gemini — docs", rot: -1.2, alert: "!" },
  { x: 1090, y: 210, w: 380, h: 240, title: "goose session", rot: 2 },
  { x: 30, y: 380, w: 400, h: 270, title: "localhost:3000/agents", rot: -2.2, browser: true },
  { x: 1490, y: 390, w: 400, h: 270, title: "ssh homelab", rot: 1.6 },
  { x: 640, y: 800, w: 470, h: 240, title: "opencode", rot: -0.8, alert: "2" },
  { x: 1000, y: 770, w: 430, h: 260, title: "tail -f agent.log", rot: 1 },
  { x: 330, y: 190, w: 420, h: 250, title: "Agents dashboard", rot: 1.8, browser: true },
  { x: 1180, y: 520, w: 420, h: 250, title: "claude — ~/infra", rot: -1.6 },
  { x: 250, y: 560, w: 430, h: 250, title: "zsh — cron", rot: 2.4 },
  { x: 560, y: 600, w: 400, h: 220, title: "codex — mobile", rot: -2, alert: "!" },
  { x: 880, y: 300, w: 380, h: 210, title: "hermes — research", rot: -1 },
  { x: 480, y: 380, w: 360, h: 210, title: "Inbox — 48 unread", rot: 1.2, browser: true },
];

const LOG = [
  ["▸", "thinking…", "#9C938D"],
  ["✓", "wrote src/cart.ts", "#7BD88F"],
  ["⠋", "running tests (12/40)", "#CFC6C0"],
  ["?", "Allow `rm -rf build`? [y/N]", "#FFD166"],
  ["✗", "ECONNREFUSED 127.0.0.1:18789", "#FF7A6E"],
  ["▸", "fetching https://api.stripe.com/v1…", "#CFC6C0"],
  ["…", "compacting context", "#9C938D"],
  ["!", "rate limited, retry in 30s", "#FFB86B"],
  ["✓", "PR #179 opened", "#7BD88F"],
  ["?", "waiting for approval", "#FFD166"],
  ["▸", "summarizing 48 emails", "#CFC6C0"],
  ["✓", "deployed preview", "#7BD88F"],
  ["▸", "reading docs/api.md", "#CFC6C0"],
  ["⠋", "npm install (214 packages)", "#CFC6C0"],
] as const;

function Terminal({ win, i, f }: { win: Win; i: number; f: number }) {
  const at = k.winFrom + i * k.winEvery;
  const s = sp(f, at, { damping: 14, stiffness: 190 });
  if (f < at) return null;

  // implosion: everything rushes into the center
  const imp = EASE.in(prog(f, k.implode + (i % 5) * 1.5, 38, (t) => t));
  const cx = win.x + win.w / 2;
  const cy = win.y + win.h / 2;
  const nx = lerp(cx, 960, imp);
  const ny = lerp(cy, 540, imp);
  const scale = lerp(0.82 + 0.18 * s, 0, imp);
  const rot = win.rot + (1 - s) * 6 + imp * (i % 2 ? 40 : -40);

  const jitter = map(f, [k.l3, k.l3 + 20, k.implode], [0, 1, 1]) * (1 - imp);
  const jx = Math.sin(f * 0.9 + i * 1.7) * 2.2 * jitter;
  const jy = Math.cos(f * 1.13 + i * 2.3) * 2.2 * jitter;

  const lineH = 24;
  const rows = Math.floor((win.h - 54) / lineH);
  const shown = Math.floor((f - at) / 7) + 2;
  const start = Math.max(0, shown - rows);

  const alertOn = win.alert && f > k.l3 - 6;
  const alertPop = sp(f, k.l3 - 6 + (i % 4) * 5, { damping: 9, stiffness: 220 });

  return (
    <div
      style={{
        position: "absolute",
        left: nx - win.w / 2 + jx,
        top: ny - win.h / 2 + jy,
        width: win.w,
        height: win.h,
        transform: `scale(${scale}) rotate(${rot}deg)`,
        opacity: map(s, [0, 0.3], [0, 1]) * map(imp, [0.75, 1], [1, 0]),
        borderRadius: 14,
        background: win.browser ? "#F6F2EF" : "#1A1513",
        boxShadow: "0 30px 70px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.07)",
        overflow: "visible",
      }}
    >
      <div
        style={{
          height: 36,
          borderRadius: "14px 14px 0 0",
          background: win.browser ? "#E9E3DF" : "#272120",
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "0 14px",
        }}
      >
        {["#FF5F57", "#FEBC2E", "#28C840"].map((c) => (
          <div key={c} style={{ width: 11, height: 11, borderRadius: "50%", background: c, opacity: 0.85 }} />
        ))}
        <div
          style={{
            flex: 1,
            textAlign: "center",
            fontFamily: F.ui,
            fontSize: 14,
            fontWeight: 600,
            color: win.browser ? "#6B625D" : "#9C938D",
            marginRight: 50,
            whiteSpace: "nowrap",
            overflow: "hidden",
          }}
        >
          {win.title}
        </div>
      </div>
      {win.browser ? (
        <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
          {Array.from({ length: Math.min(6, shown) }).map((_, r) => (
            <div key={r} style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <div style={{ width: 26, height: 26, borderRadius: 7, background: `hsl(${(i * 47 + r * 61) % 360} 70% 80%)` }} />
              <div style={{ height: 10, borderRadius: 5, background: "#D9D1CB", width: `${40 + ((r * 37 + i * 13) % 50)}%` }} />
            </div>
          ))}
        </div>
      ) : (
        <div style={{ padding: "10px 16px", fontFamily: F.mono, fontSize: 15, lineHeight: `${lineH}px`, whiteSpace: "nowrap", overflow: "hidden", height: win.h - 46 }}>
          {Array.from({ length: Math.min(rows, shown) }).map((_, r) => {
            const [glyph, text, color] = LOG[(start + r + i * 5) % LOG.length];
            return (
              <div key={r} style={{ color }}>
                <span style={{ opacity: 0.8 }}>{glyph}</span> {text}
              </div>
            );
          })}
          <div style={{ width: 9, height: 18, background: "#CFC6C0", opacity: Math.floor(f / 15) % 2 ? 1 : 0, marginTop: 2 }} />
        </div>
      )}
      {alertOn && (
        <div
          style={{
            position: "absolute",
            right: -12,
            top: -12,
            minWidth: 34,
            height: 34,
            padding: "0 8px",
            borderRadius: 17,
            background: C.bad,
            color: "#fff",
            fontFamily: F.ui,
            fontWeight: 800,
            fontSize: 18,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transform: `scale(${alertPop})`,
            boxShadow: "0 4px 14px rgba(255,69,58,0.5)",
          }}
        >
          {win.alert}
        </div>
      )}
    </div>
  );
}

export function Chaos() {
  const f = useCurrentFrame();
  const push = map(f, [k.winFrom, k.implode], [1, 1.07], EASE.inOut);
  const dot = sp(f, k.dot, { damping: 10, stiffness: 260 });
  const flash = map(f, [k.dot - 4, k.dot, k.dot + 24], [0, 1, 0]);
  const textStyle: React.CSSProperties = {
    fontFamily: F.display,
    fontWeight: 780,
    fontSize: 128,
    letterSpacing: "-0.04em",
    color: "#FFF7F0",
    filter: "drop-shadow(0 0 30px rgba(0,0,0,0.85))",
  };
  return (
    <AbsoluteFill style={{ background: C.dark }}>
      <AbsoluteFill style={{ background: "radial-gradient(1200px 800px at 50% 55%, rgba(255,110,60,0.14), transparent 70%)" }} />
      <AbsoluteFill style={{ transform: `scale(${push})` }}>
        {WINDOWS.map((w, i) => (
          <Terminal key={i} win={w} i={i} f={f} />
        ))}
      </AbsoluteFill>
      {/* a dark scrim so the words stay readable over the pile */}
      <AbsoluteFill
        style={{
          background: "radial-gradient(760px 300px at 50% 50%, rgba(16,11,9,0.92), rgba(16,11,9,0.6) 60%, transparent 100%)",
          opacity: map(f, [k.l2 - 10, k.l2 + 10, k.implode, k.implode + 20], [0, 1, 1, 0]),
        }}
      />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", textAlign: "center" }}>
        <div style={{ position: "absolute" }}>
          <Rise text="You've got agents." f={f} at={k.l1} out={k.l1Out} style={textStyle} />
        </div>
        <div style={{ position: "absolute" }}>
          <Rise text="Everywhere." f={f} at={k.l2} out={k.l2Out} by="char" stagger={2} style={{ ...textStyle, fontSize: 168 }} />
        </div>
        <div style={{ position: "absolute" }}>
          <Rise text="Who's doing what?" f={f} at={k.l3} out={k.l3Out} stagger={5} style={textStyle} />
        </div>
      </AbsoluteFill>
      {/* the dot everything collapses into */}
      <AbsoluteFill style={{ background: `radial-gradient(400px 400px at 50% 50%, rgba(255,200,160,${0.5 * flash}), transparent 70%)` }} />
      {f >= k.dot - 2 && (
        <div
          style={{
            position: "absolute",
            left: 960 - 14,
            top: 540 - 14,
            width: 28,
            height: 28,
            borderRadius: "50%",
            background: "#FFF7F0",
            transform: `scale(${dot})`,
            boxShadow: "0 0 40px rgba(255,190,140,0.8)",
          }}
        />
      )}
      <Grain f={f} opacity={0.12} />
    </AbsoluteFill>
  );
}
