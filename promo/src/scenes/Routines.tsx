import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { EASE, map, prog, sp } from "../anim";
import { C, F, GUYS, type GuyKey } from "../theme";
import { K, S } from "../timeline";
import { AppIcon } from "../ui/AppIcon";
import { Avatar, Caption, Cursor, Spinner } from "../ui/kit";
import { Grain, WarmStage } from "../ui/stage";

// Routines: friendly schedules, run history, run-now. Results come back as
// a notification and land in the guy's thread.

const k = K.routines;
const CX = 860;
const CW = 930;
const CH = 172;
const CY0 = 250;
const GAP = 30;

const CARDS: Array<{ emoji: string; hue: number; title: string; when: string; guy: GuyKey; history: string }> = [
  { emoji: "☀️", hue: 38, title: "Morning brief", when: "Weekdays at 8:30 AM", guy: "juno", history: "gggggggggg" },
  { emoji: "📬", hue: 330, title: "Inbox sweep", when: "Every 2 hours", guy: "mochi", history: "gggggagggg" },
  { emoji: "📈", hue: 150, title: "Weekly numbers", when: "Fridays at 5:00 PM", guy: "atlas", history: "gggggggggg" },
];

function Card({ j, r }: { j: number; r: number }) {
  const c = CARDS[j];
  const at = k.cards + j * 8;
  const s = sp(r, at, { damping: 16, stiffness: 110 });
  const out = prog(r, k.exit + j * 4, 26, EASE.in);
  const running = j === 0 && r >= k.runClick && r < k.ran;
  const ran = j === 0 && r >= k.ran;
  const shift = ran ? prog(r, k.ran, 14) : 0;
  const hist = ran ? c.history + "g" : c.history;
  const pressed = j === 0 ? map(r, [k.runClick - 3, k.runClick, k.runClick + 6], [0, 1, 0]) : 0;
  return (
    <div
      style={{
        position: "absolute",
        left: CX,
        top: CY0 + j * (CH + GAP),
        width: CW,
        height: CH,
        borderRadius: 28,
        background: "#FFFFFF",
        boxShadow: "0 30px 70px rgba(120,45,10,0.16), 0 0 0 1px rgba(0,0,0,0.06)",
        transform: `perspective(1600px) translate(${(1 - s) * 520}px, ${-out * 120}px) rotateY(${(1 - s) * -26}deg)`,
        opacity: map(s, [0, 0.3], [0, 1]) * (1 - out),
        fontFamily: F.ui,
        color: C.ink,
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 28,
          top: 28,
          width: 78,
          height: 78,
          borderRadius: 22,
          background: `linear-gradient(160deg, hsl(${c.hue} 95% 88%), hsl(${(c.hue + 25) % 360} 90% 74%))`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 42,
        }}
      >
        {c.emoji}
      </div>
      <div style={{ position: "absolute", left: 128, top: 30 }}>
        <div style={{ fontSize: 27, fontWeight: 700, letterSpacing: "-0.01em" }}>{c.title}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 9, marginTop: 8, fontSize: 18, color: C.ink3 }}>
          <Avatar guy={c.guy} size={28} />
          <span>
            <span style={{ color: C.ink2, fontWeight: 600 }}>{GUYS[c.guy].name}</span> · {c.when}
          </span>
        </div>
      </div>
      {/* run now + toggle */}
      <div
        style={{
          position: "absolute",
          right: 120,
          top: 30,
          height: 46,
          width: 140,
          borderRadius: 14,
          background: running ? C.accentSoft : C.chip,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 9,
          fontSize: 16.5,
          fontWeight: 600,
          color: running ? C.accentStrong : C.ink2,
          transform: `scale(${1 - 0.07 * pressed})`,
        }}
      >
        {running ? (
          <>
            <Spinner f={r} size={18} color={C.accentStrong} /> Running
          </>
        ) : (
          <>
            <svg width="14" height="16" viewBox="0 0 14 16">
              <path d="M2 1.5 L12.5 8 L2 14.5 Z" fill="currentColor" strokeLinejoin="round" />
            </svg>
            Run now
          </>
        )}
      </div>
      <div style={{ position: "absolute", right: 30, top: 35, width: 66, height: 38, borderRadius: 19, background: C.accent }}>
        <div style={{ position: "absolute", right: 3, top: 3, width: 32, height: 32, borderRadius: "50%", background: "#fff", boxShadow: "0 2px 4px rgba(0,0,0,0.2)" }} />
      </div>
      {/* run history */}
      <div style={{ position: "absolute", left: 128, bottom: 26, display: "flex", alignItems: "center", gap: 14 }}>
        <span style={{ fontSize: 14, fontWeight: 650, color: C.ink3, letterSpacing: "0.04em" }}>LAST RUNS</span>
        <div style={{ width: 10 * 22 - 8, overflow: "hidden" }}>
          <div style={{ display: "flex", gap: 8, transform: `translateX(${-shift * 22}px)` }}>
            {Array.from(hist).map((h, d) => {
              const pop = d < 10 ? sp(r, at + 18 + d * 2.5, { damping: 10, stiffness: 300 }) : sp(r, k.ran, { damping: 8, stiffness: 300 });
              return <div key={d} style={{ width: 14, height: 14, borderRadius: "50%", flexShrink: 0, background: h === "g" ? C.ok : C.warn, transform: `scale(${pop})` }} />;
            })}
          </div>
        </div>
        <span style={{ fontSize: 15, color: C.ink3 }}>{ran ? "just now" : j === 0 ? "today, 8:30" : j === 1 ? "38 min ago" : "last Friday"}</span>
      </div>
    </div>
  );
}

function Notification({ r }: { r: number }) {
  const s = sp(r, k.notif, { damping: 15, stiffness: 170 });
  const out = prog(r, k.notif + 120, 20, EASE.in);
  if (r < k.notif) return null;
  return (
    <div
      style={{
        position: "absolute",
        right: 30,
        top: 26,
        width: 500,
        borderRadius: 24,
        padding: "18px 20px",
        background: "rgba(252,249,247,0.9)",
        backdropFilter: "blur(30px)",
        WebkitBackdropFilter: "blur(30px)",
        boxShadow: "0 24px 60px rgba(120,45,10,0.22), 0 0 0 1px rgba(0,0,0,0.07)",
        display: "flex",
        gap: 16,
        transform: `translateX(${(1 - s) * 560 + out * 560}px)`,
        fontFamily: F.ui,
        color: C.ink,
      }}
    >
      <div style={{ marginTop: -2, flexShrink: 0 }}>
        <AppIcon f={200} size={56} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ fontSize: 17, fontWeight: 700 }}>Juno</span>
          <span style={{ fontSize: 14, color: C.ink3 }}>now</span>
        </div>
        <div style={{ fontSize: 17, marginTop: 2 }}>Your morning brief is ready ☀️</div>
        <div style={{ fontSize: 15.5, color: C.ink3, marginTop: 2 }}>3 meetings · 2 PRs to review · rain after 4</div>
      </div>
    </div>
  );
}

export function Routines() {
  const r = useCurrentFrame();
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <WarmStage f={S.routines.from + r} />
      <Caption lines={["Put them on", "a schedule."]} f={r} at={18} out={170} y={390} />
      <Caption lines={["Results land", "in your chats."]} f={r} at={186} out={k.exit} y={390} accentLine={1} />
      {CARDS.map((_, j) => (
        <Card key={j} j={j} r={r} />
      ))}
      <Notification r={r} />
      <Cursor
        f={r}
        show={[92, 160]}
        clicks={[k.runClick]}
        path={[
          { f: 92, x: 1420, y: 1000 },
          { f: k.runClick - 4, x: CX + CW - 120 - 84, y: CY0 + 56 },
        ]}
      />
      <Grain f={r} />
    </AbsoluteFill>
  );
}
