import React from "react";
import { EASE, map, prog } from "../anim";
import { C, F, GUYS, RING, type GuyKey } from "../theme";

// ---------------------------------------------------------------------------
// Avatar: emoji on a soft per-guy gradient, inside a stories-style ring
// (same recipe as src/ui/Avatar.tsx).

export type Ring = "idle" | "working" | "unread" | "needs" | "none";

export function Avatar({ guy, size, ring = "none", f = 0, bg = "#fff" }: { guy: GuyKey; size: number; ring?: Ring; f?: number; bg?: string }) {
  const g = GUYS[guy];
  const rw = ring === "none" ? 0 : Math.max(2, Math.round(size / 20));
  const gap = ring === "none" ? 0 : Math.max(2, Math.round(size / 24));
  const inner = size - (rw + gap) * 2;
  const breathe = ring === "working" ? 1 + 0.04 * Math.sin((f / 72) * Math.PI * 2) : 1;
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      {ring !== "none" && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "50%",
            background: RING[ring],
            transform: ring === "working" ? `rotate(${(f / 156) * 360}deg)` : undefined,
          }}
        />
      )}
      <div style={{ position: "absolute", inset: rw, borderRadius: "50%", background: bg }} />
      <div
        style={{
          position: "absolute",
          inset: rw + gap,
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transform: `scale(${breathe})`,
          background: `linear-gradient(160deg, hsl(${g.hue} 90% 88%), hsl(${(g.hue + 30) % 360} 85% 76%))`,
        }}
      >
        <span style={{ fontSize: inner * 0.52, lineHeight: 1 }}>{g.emoji}</span>
      </div>
      {ring === "needs" && (
        <span
          style={{
            position: "absolute",
            right: -2,
            top: -2,
            width: size * 0.34,
            height: size * 0.34,
            borderRadius: "50%",
            background: C.bad,
            color: "#fff",
            fontSize: size * 0.22,
            fontWeight: 800,
            fontFamily: F.ui,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: `0 0 0 3px ${bg}`,
          }}
        >
          !
        </span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Text that rises out of a mask, word by word or letter by letter.

export function Rise({
  text,
  f,
  at,
  out,
  stagger = 4,
  dur = 32,
  by = "word",
  style,
  wordStyle,
  tilt = 4,
}: {
  text: string;
  f: number;
  at: number;
  out?: number;
  stagger?: number;
  dur?: number;
  by?: "word" | "char";
  style?: React.CSSProperties;
  /** Applied to each word (gradient text has to live on the moving span). */
  wordStyle?: React.CSSProperties;
  tilt?: number;
}) {
  const parts = by === "word" ? text.split(/(\s+)/) : Array.from(text);
  let n = 0;
  return (
    <span style={{ display: "inline-block", whiteSpace: "pre", ...style }}>
      {parts.map((part, i) => {
        if (/^\s+$/.test(part)) return <span key={i}>{part}</span>;
        const k = n++;
        const p = prog(f, at + k * stagger, dur, EASE.out);
        const q = out === undefined ? 0 : prog(f, out + k * Math.max(1, stagger / 2), 18, EASE.in);
        const y = (1 - p) * 115 - q * 115;
        return (
          <span
            key={i}
            style={{ display: "inline-block", overflow: "hidden", verticalAlign: "top", padding: "0.1em 0.06em 0.16em", margin: "-0.1em -0.06em -0.16em" }}
          >
            <span
              style={{
                display: "inline-block",
                transform: `translateY(${y}%) rotate(${(1 - p) * tilt - q * tilt}deg)`,
                transformOrigin: "0% 100%",
                ...wordStyle,
              }}
            >
              {part}
            </span>
          </span>
        );
      })}
    </span>
  );
}

/** A big two-line caption on the left side of the frame. */
export function Caption({
  lines,
  f,
  at,
  out,
  x = 120,
  y = 380,
  size = 96,
  color = C.ink,
  accentLine = -1,
}: {
  lines: string[];
  f: number;
  at: number;
  out?: number;
  x?: number;
  y?: number;
  size?: number;
  color?: string;
  accentLine?: number;
}) {
  return (
    <div style={{ position: "absolute", left: x, top: y, fontFamily: F.display, fontWeight: 760, fontSize: size, lineHeight: 1.04, letterSpacing: "-0.035em", color }}>
      {lines.map((line, i) => (
        <div key={i}>
          <Rise
            text={line}
            f={f}
            at={at + i * 7}
            out={out === undefined ? undefined : out + i * 3}
            wordStyle={i === accentLine ? gradientText() : undefined}
          />
        </div>
      ))}
    </div>
  );
}

export function gradientText(bg = "linear-gradient(100deg, #FF9A4E 0%, #FF6A45 50%, #FF4F7B 100%)"): React.CSSProperties {
  return { backgroundImage: bg, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent", WebkitTextFillColor: "transparent" };
}

// ---------------------------------------------------------------------------
// The macOS pointer, following keyframes, with a press on each click.

export type CursorKey = { f: number; x: number; y: number };

export function Cursor({ f, path, clicks = [], show = [path[0].f, Infinity] }: { f: number; path: CursorKey[]; clicks?: number[]; show?: [number, number] }) {
  if (f < show[0] - 8 || f > show[1] + 12) return null;
  let x = path[0].x;
  let y = path[0].y;
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i];
    const b = path[i + 1];
    if (f >= a.f && f <= b.f) {
      const t = EASE.inOut((f - a.f) / Math.max(1, b.f - a.f));
      // a gentle arc, like a real hand
      const arc = Math.sin(t * Math.PI) * Math.min(60, Math.hypot(b.x - a.x, b.y - a.y) * 0.12);
      x = a.x + (b.x - a.x) * t + arc * 0.4;
      y = a.y + (b.y - a.y) * t - arc;
      break;
    }
    if (f > b.f) {
      x = b.x;
      y = b.y;
    }
  }
  let press = 1;
  const ripples: React.ReactNode[] = [];
  for (const c of clicks) {
    press *= 1 - 0.18 * map(f, [c - 4, c, c + 8], [0, 1, 0]);
    if (f >= c && f < c + 24) {
      const p = (f - c) / 24;
      ripples.push(
        <div
          key={c}
          style={{
            position: "absolute",
            left: x - 30 * EASE.out(p) - 6,
            top: y - 30 * EASE.out(p) - 6,
            width: 60 * EASE.out(p) + 12,
            height: 60 * EASE.out(p) + 12,
            borderRadius: "50%",
            border: `3px solid ${C.accent}`,
            opacity: 1 - p,
          }}
        />,
      );
    }
  }
  const fade = map(f, [show[0] - 8, show[0], show[1], show[1] + 12], [0, 1, 1, 0]);
  return (
    <>
      {ripples}
      <svg
        width={34}
        height={50}
        viewBox="0 0 17 25"
        style={{ position: "absolute", left: x - 2, top: y - 2, opacity: fade, transform: `scale(${press})`, transformOrigin: "2px 2px", filter: "drop-shadow(0 3px 5px rgba(0,0,0,0.3))", zIndex: 100 }}
      >
        <path d="M1 1 L1 19.5 L5.6 15.3 L8.6 22.6 L11.7 21.3 L8.7 14.2 L14.8 14.2 Z" fill="#111" stroke="#fff" strokeWidth={1.3} strokeLinejoin="round" />
      </svg>
    </>
  );
}

// ---------------------------------------------------------------------------

export function TrafficLights({ size = 14, gap = 9 }: { size?: number; gap?: number }) {
  return (
    <div style={{ display: "flex", gap }}>
      {["#FF5F57", "#FEBC2E", "#28C840"].map((c) => (
        <div key={c} style={{ width: size, height: size, borderRadius: "50%", background: c, boxShadow: "inset 0 0 0 0.5px rgba(0,0,0,0.15)" }} />
      ))}
    </div>
  );
}

export function Spinner({ size = 18, f, color = C.ink3 }: { size?: number; f: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" style={{ transform: `rotate(${f * 9}deg)`, flexShrink: 0 }}>
      <circle cx={10} cy={10} r={7.5} stroke={color} strokeOpacity={0.25} strokeWidth={2.4} fill="none" />
      <path d="M 10 2.5 A 7.5 7.5 0 0 1 17.5 10" stroke={color} strokeWidth={2.4} fill="none" strokeLinecap="round" />
    </svg>
  );
}

export function Check({ size = 18, color = C.ok }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" style={{ flexShrink: 0 }}>
      <circle cx={10} cy={10} r={9} fill={color} />
      <path d="M 5.8 10.3 L 8.6 13 L 14.2 7.3" stroke="#fff" strokeWidth={2.2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
