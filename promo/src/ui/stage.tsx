import React from "react";
import { AbsoluteFill } from "remotion";
import { C, F } from "../theme";
import type { Mood } from "../timeline";
import { Sprite } from "./Sprite";

// ---------------------------------------------------------------------------
// Backdrops

const GRAIN = `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='256' height='256'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.35  0 0 0 0 0.2  0 0 0 0 0.1  0 0 0 0.6 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>")`;

/** Film-ish grain that shifts every couple of frames. */
export function Grain({ f, opacity = 0.18 }: { f: number; opacity?: number }) {
  const k = Math.floor(f / 2);
  return (
    <AbsoluteFill
      style={{
        backgroundImage: GRAIN,
        backgroundPosition: `${(k * 73) % 256}px ${(k * 151) % 256}px`,
        opacity,
        mixBlendMode: "multiply",
        pointerEvents: "none",
      }}
    />
  );
}

/** The warm cream stage with slow drifting color blobs. */
export function WarmStage({ f, intensity = 1 }: { f: number; intensity?: number }) {
  const t = f / 60;
  const a = 0.5 * intensity;
  return (
    <AbsoluteFill
      style={{
        background: [
          `radial-gradient(900px 760px at ${280 + Math.sin(t * 0.5) * 80}px ${180 + Math.cos(t * 0.4) * 60}px, rgba(255,186,120,${a}), transparent 70%)`,
          `radial-gradient(820px 820px at ${1680 + Math.cos(t * 0.45) * 90}px ${880 + Math.sin(t * 0.35) * 70}px, rgba(255,120,150,${a * 0.5}), transparent 70%)`,
          `radial-gradient(1100px 700px at ${1500 + Math.sin(t * 0.3) * 70}px ${120 + Math.cos(t * 0.5) * 50}px, rgba(255,222,150,${a * 0.75}), transparent 70%)`,
          `radial-gradient(900px 600px at ${400 + Math.cos(t * 0.38) * 60}px ${980 + Math.sin(t * 0.42) * 40}px, rgba(255,150,100,${a * 0.45}), transparent 70%)`,
          C.cream,
        ].join(", "),
      }}
    />
  );
}

/** A warm abstract macOS-style wallpaper, lighter on the left for captions. */
export function Wallpaper() {
  return (
    <AbsoluteFill>
      <svg width="1920" height="1080" viewBox="0 0 1920 1080">
        <defs>
          <linearGradient id="wp-sky" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#FFF4EA" />
            <stop offset="0.5" stopColor="#FFE0C8" />
            <stop offset="1" stopColor="#FFB592" />
          </linearGradient>
          <linearGradient id="wp-a" x1="0" y1="0" x2="1" y2="0.4">
            <stop offset="0" stopColor="#FFD3B0" />
            <stop offset="1" stopColor="#FF9C6E" />
          </linearGradient>
          <linearGradient id="wp-b" x1="0" y1="0" x2="1" y2="0.3">
            <stop offset="0" stopColor="#FFB28C" />
            <stop offset="1" stopColor="#FF6F5A" />
          </linearGradient>
          <linearGradient id="wp-c" x1="0" y1="0" x2="1" y2="0.2">
            <stop offset="0" stopColor="#FF9A86" />
            <stop offset="1" stopColor="#F2507A" />
          </linearGradient>
          <radialGradient id="wp-sun" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="#FFF1C4" stopOpacity="0.95" />
            <stop offset="1" stopColor="#FFF1C4" stopOpacity="0" />
          </radialGradient>
          <filter id="wp-blur" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="18" />
          </filter>
        </defs>
        <rect width="1920" height="1080" fill="url(#wp-sky)" />
        <circle cx="1380" cy="330" r="420" fill="url(#wp-sun)" />
        <path d="M0 720 C 380 600 640 760 980 690 S 1640 520 1920 600 L1920 1080 L0 1080 Z" fill="url(#wp-a)" opacity="0.9" filter="url(#wp-blur)" />
        <path d="M0 860 C 420 760 760 900 1120 820 S 1700 700 1920 760 L1920 1080 L0 1080 Z" fill="url(#wp-b)" opacity="0.92" />
        <path d="M0 990 C 360 930 820 1010 1200 950 S 1760 880 1920 920 L1920 1080 L0 1080 Z" fill="url(#wp-c)" opacity="0.95" />
      </svg>
    </AbsoluteFill>
  );
}

// ---------------------------------------------------------------------------
// A big-type macOS desktop. The UI is drawn ~1.8× so it reads on video.

export const MENUBAR_H = 46;
export const SPRITE_H = 32;
export const SPRITE_W = (SPRITE_H * 22) / 18;
export const SPRITE_C = { x: 1490, y: MENUBAR_H / 2 + 1 };

export function MenuBar({ chrome = 1, mood, t, showSprite = true }: { chrome?: number; mood: Mood; t: number; showSprite?: boolean }) {
  const text: React.CSSProperties = { fontFamily: F.ui, fontSize: 18, color: C.ink, letterSpacing: "-0.005em" };
  const ico = { position: "absolute" as const, top: MENUBAR_H / 2, transform: "translate(-50%, -50%)", opacity: chrome };
  return (
    <div style={{ position: "absolute", left: 0, top: 0, width: 1920, height: MENUBAR_H }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(255,248,242,0.5)",
          backdropFilter: "blur(24px) saturate(1.6)",
          WebkitBackdropFilter: "blur(24px) saturate(1.6)",
          borderBottom: "1px solid rgba(0,0,0,0.06)",
          opacity: chrome,
        }}
      />
      <div style={{ position: "absolute", left: 30, top: 0, height: MENUBAR_H, display: "flex", alignItems: "center", gap: 30, opacity: chrome }}>
        <span style={{ ...text, fontWeight: 700 }}>Finder</span>
        {["File", "Edit", "View", "Go", "Window", "Help"].map((m) => (
          <span key={m} style={{ ...text, fontWeight: 500 }}>
            {m}
          </span>
        ))}
      </div>
      <div style={{ position: "absolute", right: 28, top: 0, height: MENUBAR_H, display: "flex", alignItems: "center", opacity: chrome }}>
        <span style={{ ...text, fontWeight: 500 }}>Wed Oct 7&nbsp;&nbsp;9:41 AM</span>
      </div>
      {/* control center */}
      <svg style={{ ...ico, left: 1702 }} width="26" height="22" viewBox="0 0 26 22">
        <rect x="1" y="2" width="24" height="8" rx="4" fill="none" stroke={C.ink} strokeWidth="2" />
        <circle cx="19" cy="6" r="2.4" fill={C.ink} />
        <rect x="1" y="12" width="24" height="8" rx="4" fill="none" stroke={C.ink} strokeWidth="2" />
        <circle cx="7" cy="16" r="2.4" fill={C.ink} />
      </svg>
      {/* spotlight */}
      <svg style={{ ...ico, left: 1652 }} width="22" height="22" viewBox="0 0 22 22">
        <circle cx="9" cy="9" r="6.5" fill="none" stroke={C.ink} strokeWidth="2.4" />
        <path d="M 14 14 L 20 20" stroke={C.ink} strokeWidth="2.6" strokeLinecap="round" />
      </svg>
      {/* wifi */}
      <svg style={{ ...ico, left: 1604 }} width="26" height="20" viewBox="0 0 26 20">
        <path d="M 2 7 Q 13 -2 24 7" stroke={C.ink} strokeWidth="2.6" fill="none" strokeLinecap="round" />
        <path d="M 6 11 Q 13 5 20 11" stroke={C.ink} strokeWidth="2.6" fill="none" strokeLinecap="round" />
        <circle cx="13" cy="16" r="2.6" fill={C.ink} />
      </svg>
      {/* battery */}
      <svg style={{ ...ico, left: 1550 }} width="40" height="20" viewBox="0 0 40 20">
        <rect x="1" y="2" width="33" height="16" rx="5" fill="none" stroke={C.ink} strokeOpacity="0.45" strokeWidth="2" />
        <rect x="4" y="5" width="24" height="10" rx="2.5" fill={C.ink} />
        <path d="M 36.5 7.5 Q 39 10 36.5 12.5" stroke={C.ink} strokeOpacity="0.45" strokeWidth="2" fill="none" />
      </svg>
      {showSprite && (
        <div style={{ position: "absolute", left: SPRITE_C.x - SPRITE_W / 2, top: SPRITE_C.y - SPRITE_H / 2 }}>
          <Sprite mood={mood} t={t} height={SPRITE_H} fill={C.ink} />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

export function MacWindow({ style, children, radius = 16 }: { style?: React.CSSProperties; children?: React.ReactNode; radius?: number }) {
  return (
    <div
      style={{
        position: "absolute",
        background: "#FFFFFF",
        borderRadius: radius,
        boxShadow: "0 50px 120px rgba(120,45,10,0.28), 0 18px 40px rgba(120,45,10,0.12), 0 0 0 1px rgba(0,0,0,0.08)",
        overflow: "hidden",
        fontFamily: F.ui,
        color: C.ink,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
