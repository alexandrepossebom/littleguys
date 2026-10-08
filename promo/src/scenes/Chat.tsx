import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { EASE, map, prog, sp, typed } from "../anim";
import { C, F, GUYS, type GuyKey } from "../theme";
import { CHAT_PROMPT, K, S } from "../timeline";
import { Avatar, Caption, Check, Cursor, Spinner, TrafficLights, type Ring } from "../ui/kit";
import { Grain, MacWindow, WarmStage } from "../ui/stage";

// The main window: stories row on top, threads on the left, a chat with
// Pip. We ask, Pip works (tool steps fold into one quiet line), streams an
// answer, asks before pushing, and we approve.

const k = K.chat;
const WX = 640;
const WY = 100;
const WW = 1200;
const WH = 880;
const TOP = 128;
const SIDE = 320;

const GAP = 14;
const PAD_B = 16;
const CARD_H = 184;
const CARD_PAD = 18;
const BTN_H = 36;

/** Eased 0→1 height growth for a new transcript row. */
const grow = (v: number, at: number) => prog(v, at, 14, EASE.out);

/** A transcript row whose height animates, so older rows glide up. Content hangs from the top. */
function Slot({ h, children }: { h: number; children: React.ReactNode }) {
  if (h <= 0.01) return null;
  return (
    <div style={{ flexShrink: 0, height: h, position: "relative" }}>
      <div style={{ position: "absolute", left: 0, right: 0, top: GAP }}>{children}</div>
    </div>
  );
}

function DayChip({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "center", flexShrink: 0 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: C.ink3, background: C.chip, padding: "5px 12px", borderRadius: 12 }}>{children}</div>
    </div>
  );
}

const ANSWER: Array<[string, "t" | "code" | "b"]> = [
  ["Found it 🎯", "t"],
  ["cart.spec.ts", "code"],
  ["checks the total before the price fetch resolves. I awaited the fetch and froze the clock:", "t"],
  ["40/40 green", "b"],
  ["now.", "t"],
];

function Streamed({ v, from, perWord = 2.2 }: { v: number; from: number; perWord?: number }) {
  let n = 0;
  return (
    <>
      {ANSWER.map(([text, kind], i) => {
        const words = kind === "t" ? text.split(" ") : [text];
        return (
          <React.Fragment key={i}>
            {words.map((w, j) => {
              const at = from + n++ * perWord;
              if (v < at) return null;
              const o = map(v, [at, at + 6], [0, 1]);
              const el =
                kind === "code" ? (
                  <code style={{ fontFamily: F.mono, fontSize: 16, background: "rgba(0,0,0,0.06)", padding: "2px 7px", borderRadius: 6 }}>{w}</code>
                ) : kind === "b" ? (
                  <b style={{ fontWeight: 700 }}>{w}</b>
                ) : (
                  w
                );
              return (
                <span key={j} style={{ opacity: o }}>
                  {el}{" "}
                </span>
              );
            })}
          </React.Fragment>
        );
      })}
    </>
  );
}

function Stories({ v, pipRing }: { v: number; pipRing: Ring }) {
  const guys: Array<[GuyKey, Ring, string, number?]> = [
    ["pip", pipRing, "studio"],
    ["juno", "unread", "studio", 1],
    ["biscuit", "working", "homelab"],
    ["mochi", "unread", "homelab", 3],
    ["atlas", "idle", "this Mac"],
  ];
  return (
    <div style={{ position: "absolute", left: 104, top: 14, display: "flex", gap: 6 }}>
      <div style={{ width: 96, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, opacity: prog(v, 10, 20) }}>
        <div style={{ width: 68, height: 68, borderRadius: "50%", border: `2.5px dashed rgba(148,140,134,0.5)`, display: "flex", alignItems: "center", justifyContent: "center", color: C.ink3, fontSize: 30, fontWeight: 300 }}>+</div>
        <span style={{ fontSize: 14, color: C.ink3 }}>New guy</span>
      </div>
      {guys.map(([g, ring, gw, badge], i) => {
        const s = sp(v, 12 + i * 4, { damping: 12, stiffness: 200 });
        const hop = Math.max(0, Math.sin(Math.min(1, Math.max(0, (v - (k.exit - 40) - i * 5) / 16)) * Math.PI)) * 10;
        return (
          <div key={g} style={{ position: "relative", width: 96, display: "flex", flexDirection: "column", alignItems: "center", transform: `translateY(${(1 - s) * 16 - hop}px) scale(${0.85 + 0.15 * s})`, opacity: map(s, [0, 0.4], [0, 1]) }}>
            <Avatar guy={g} size={68} ring={ring} f={v} />
            <span style={{ fontSize: 14.5, marginTop: 5, fontWeight: g === "pip" ? 700 : 500 }}>{GUYS[g].name}</span>
            <span style={{ fontSize: 11.5, color: C.ink3 }}>{gw}</span>
            {badge && (
              <span style={{ position: "absolute", right: 10, top: -2, minWidth: 22, height: 22, borderRadius: 11, background: C.accent, color: "#fff", fontSize: 13, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 0 3px #fff" }}>
                {badge}
              </span>
            )}
            {g === "pip" && <div style={{ position: "absolute", bottom: -12, width: 26, height: 5, borderRadius: 3, background: C.accent }} />}
          </div>
        );
      })}
    </div>
  );
}

function Sidebar({ v }: { v: number }) {
  const threads = [
    ["Checkout flake", v >= k.stream ? "Found it 🎯 cart.spec.ts checks…" : v >= k.send ? `You: ${CHAT_PROMPT}` : "Tests keep timing out on CI", "now"],
    ["Release notes v2.4", "Drafted. Want a look?", "1h"],
    ["Dependency bumps", "12 PRs merged ✅", "Mon"],
    ["Main chat", "Morning! What's on today?", "Sun"],
  ];
  return (
    <div style={{ position: "absolute", left: 0, top: TOP, width: SIDE, bottom: 0, borderRight: `1px solid ${C.line}`, background: "#FCFAF9" }}>
      <div style={{ margin: 16, height: 40, borderRadius: 11, background: C.chip, display: "flex", padding: 3, gap: 2 }}>
        {["Chats", "Routines", "Files", "Skills"].map((t, i) => (
          <div
            key={t}
            style={{
              flex: 1,
              borderRadius: 8,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 14.5,
              fontWeight: i === 0 ? 650 : 500,
              color: i === 0 ? C.ink : C.ink2,
              background: i === 0 ? "#fff" : undefined,
              boxShadow: i === 0 ? "0 1px 3px rgba(0,0,0,0.1)" : undefined,
            }}
          >
            {t}
          </div>
        ))}
      </div>
      {threads.map(([title, snippet, time], i) => (
        <div key={title} style={{ margin: "0 10px", padding: "12px 14px", borderRadius: 14, background: i === 0 ? C.accentSoft : undefined, opacity: prog(v, 16 + i * 3, 20) }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontSize: 16.5, fontWeight: 650 }}>{title}</span>
            <span style={{ fontSize: 13, color: C.ink3 }}>{time}</span>
          </div>
          <div style={{ fontSize: 14.5, color: C.ink3, marginTop: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{snippet}</div>
        </div>
      ))}
    </div>
  );
}

function Bubble({ me, children, enter, style }: { me?: boolean; children: React.ReactNode; enter: number; style?: React.CSSProperties }) {
  return (
    <div style={{ display: "flex", justifyContent: me ? "flex-end" : "flex-start" }}>
      <div
        style={{
          maxWidth: 600,
          padding: "13px 18px",
          borderRadius: 22,
          [me ? "borderBottomRightRadius" : "borderBottomLeftRadius"]: 6,
          background: me ? C.accent : C.bubbleThem,
          color: me ? "#fff" : C.ink,
          fontSize: 18,
          lineHeight: 1.5,
          transformOrigin: me ? "100% 100%" : "0% 100%",
          transform: `translateY(${(1 - enter) * 30}px) scale(${0.9 + 0.1 * enter})`,
          opacity: map(enter, [0, 0.3], [0, 1]),
          ...style,
        }}
      >
        {children}
      </div>
    </div>
  );
}

export function Chat() {
  const v = useCurrentFrame();
  const { win, exit, scale, dx, dy } = windowTransform(v);

  const working = (v >= k.typing && v < k.stream + 60) || (v >= k.allow + 6 && v < k.done);
  const pipRing: Ring = working ? "working" : "idle";
  const draft = v < k.send ? typed(CHAT_PROMPT, v, k.typeFrom, k.typeTo) : "";
  const decided = v >= k.allow + 8;
  const toolStep = v < k.tool[1] ? "Reading cart.spec.ts…" : v < k.tool[2] ? "Running the tests (3×)…" : "Read 6 files, ran the tests 3 times";

  const bgIn = map(v, [0, 18], [0, 1]);

  return (
    <AbsoluteFill style={{ overflow: "hidden", fontFamily: F.ui, color: C.ink }}>
      <AbsoluteFill style={{ opacity: bgIn }}>
        <WarmStage f={S.chat.from + v} />
      </AbsoluteFill>

      <Caption lines={["Just", "chat."]} f={v} at={26} out={140} x={110} y={380} />
      <Caption lines={["Watch them", "work."]} f={v} at={152} out={318} x={110} y={380} accentLine={1} />
      <Caption lines={["Approve in", "one click."]} f={v} at={330} out={k.exit - 50} x={110} y={380} accentLine={1} />
      <Caption lines={["All your guys,", "one window."]} f={v} at={k.exit - 40} out={k.exit + 6} x={110} y={380} size={84} />

      <MacWindow
        style={{
          left: WX,
          top: WY,
          width: WW,
          height: WH,
          transformOrigin: "60% 50%",
          transform: `translate(${dx}px, ${dy}px) scale(${scale})`,
          opacity: map(win, [0, 0.3], [0, 1]) * (1 - exit),
        }}
      >
        {/* header with the stories row */}
        <div style={{ position: "absolute", left: 0, top: 0, right: 0, height: TOP, borderBottom: `1px solid ${C.line}`, background: "#FFFFFF" }}>
          <div style={{ position: "absolute", left: 24, top: 24 }}>
            <TrafficLights />
          </div>
          <Stories v={v} pipRing={pipRing} />
        </div>
        <Sidebar v={v} />

        {/* chat pane */}
        <div style={{ position: "absolute", left: SIDE, top: TOP, right: 0, bottom: 0 }}>
          <div style={{ height: 72, display: "flex", alignItems: "center", gap: 14, padding: "0 26px", borderBottom: `1px solid ${C.line}` }}>
            <Avatar guy="pip" size={46} ring={pipRing} f={v} />
            <div>
              <div style={{ fontSize: 19, fontWeight: 700 }}>Pip</div>
              <div style={{ fontSize: 14, color: working ? C.accentStrong : C.ink3, fontWeight: working ? 600 : 400 }}>{working ? "working…" : "idle"} · studio</div>
            </div>
          </div>

          <div style={{ position: "absolute", left: 0, right: 0, top: 72, bottom: 86, padding: `0 30px ${PAD_B}px`, display: "flex", flexDirection: "column", justifyContent: "flex-end", overflow: "hidden" }}>
            <DayChip>Yesterday</DayChip>
            <Bubble enter={1} style={{ marginTop: GAP }}>Morning! Dependabot opened 12 PRs overnight. Want me to batch them?</Bubble>
            <Bubble me enter={1} style={{ marginTop: GAP }}>yes please 🙏</Bubble>
            <Bubble enter={1} style={{ marginTop: GAP }}>Done. All 12 merged and CI is green ✅</Bubble>
            <div style={{ marginTop: GAP }}>
              <DayChip>Today</DayChip>
            </div>

            <Slot h={v >= k.send ? (GAP + 53) * grow(v, k.send) : 0}>
              <Bubble me enter={sp(v, k.send, { damping: 14, stiffness: 220 })}>{CHAT_PROMPT}</Bubble>
            </Slot>

            <Slot h={v < k.typing ? 0 : v < k.tool[0] ? (GAP + 42) * grow(v, k.typing) : GAP + 42 - 18 * grow(v, k.tool[0])}>
              {v < k.tool[0] ? (
                <Bubble enter={sp(v, k.typing, { damping: 14, stiffness: 240 })} style={{ padding: "16px 20px" }}>
                  <div style={{ display: "flex", gap: 7 }}>
                    {[0, 1, 2].map((i) => {
                      const lift = Math.max(0, Math.sin(((v - k.typing) / 24) * Math.PI * 2 - i * 0.9));
                      return <div key={i} style={{ width: 10, height: 10, borderRadius: "50%", background: C.ink3, opacity: 0.4 + 0.6 * lift, transform: `translateY(${-lift * 4}px)` }} />;
                    })}
                  </div>
                </Bubble>
              ) : (
                <div style={{ display: "flex", alignItems: "center", gap: 10, height: 24, fontSize: 16, color: C.ink3, paddingLeft: 4, opacity: prog(v, k.tool[0], 12) }}>
                  {v < k.tool[2] ? <Spinner f={v} size={18} /> : <Check size={18} />}
                  <span>{toolStep}</span>
                </div>
              )}
            </Slot>

            {v >= k.stream && (
              <div style={{ flexShrink: 0, height: v < k.stream + 14 ? (GAP + 53) * grow(v, k.stream) : undefined, paddingTop: GAP }}>
                <Bubble enter={sp(v, k.stream, { damping: 14, stiffness: 240 })}>
                  <Streamed v={v} from={k.stream + 4} />
                </Bubble>
              </div>
            )}

            <Slot h={v < k.approval ? 0 : !decided ? (GAP + CARD_H) * grow(v, k.approval) : GAP + CARD_H - (CARD_H - 24) * grow(v, k.allow + 8)}>
              {!decided ? (
                <div
                  style={{
                    maxWidth: 600,
                    height: CARD_H,
                    boxSizing: "border-box",
                    borderRadius: 20,
                    border: "1.5px solid rgba(255,159,10,0.45)",
                    background: "rgba(255,159,10,0.08)",
                    padding: CARD_PAD,
                    display: "flex",
                    gap: 14,
                    transformOrigin: "0% 100%",
                    transform: `scale(${0.85 + 0.15 * sp(v, k.approval, { damping: 11, stiffness: 240 })})`,
                    opacity: prog(v, k.approval, 8),
                  }}
                >
                  <svg width="26" height="26" viewBox="0 0 24 24" style={{ flexShrink: 0, marginTop: 1 }}>
                    <path d="M12 2 L20 5.5 V11.5 C20 16.5 16.5 20.5 12 22 C7.5 20.5 4 16.5 4 11.5 V5.5 Z" fill="none" stroke={C.warn} strokeWidth="2" strokeLinejoin="round" />
                    <path d="M12 8 V12.5" stroke={C.warn} strokeWidth="2.2" strokeLinecap="round" />
                    <circle cx="12" cy="16" r="1.3" fill={C.warn} />
                  </svg>
                  <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
                    <div style={{ fontSize: 17, fontWeight: 650 }}>Can I run this?</div>
                    <div style={{ marginTop: 8, fontFamily: F.mono, fontSize: 15.5, background: C.chip, borderRadius: 10, padding: "9px 12px" }}>git push origin fix/checkout-flake</div>
                    <div style={{ marginTop: 6, fontSize: 13.5, color: C.ink3 }}>in ~/shop</div>
                    <div style={{ marginTop: "auto", display: "flex", gap: 8 }}>
                      {[
                        ["Allow once", C.accent, "#fff"],
                        ["Always allow", "rgba(0,0,0,0.06)", C.ink],
                        ["Deny", "rgba(255,69,58,0.1)", C.bad],
                      ].map(([label, bg, fg], i) => (
                        <div
                          key={label}
                          style={{
                            height: BTN_H,
                            boxSizing: "border-box",
                            padding: "0 16px",
                            display: "flex",
                            alignItems: "center",
                            borderRadius: 10,
                            fontSize: 15.5,
                            fontWeight: 600,
                            background: bg,
                            color: fg,
                            transform: i === 0 ? `scale(${1 - 0.07 * map(v, [k.allow - 3, k.allow, k.allow + 6], [0, 1, 0])})` : undefined,
                          }}
                        >
                          {label}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", alignItems: "center", gap: 10, height: 24, fontSize: 16, color: C.ink3, paddingLeft: 4, opacity: prog(v, k.allow + 8, 10) }}>
                  <Check size={18} />
                  <span>
                    Allowed <code style={{ fontFamily: F.mono, fontSize: 15 }}>git push origin fix/checkout-flake</code>
                  </span>
                </div>
              )}
            </Slot>

            <Slot h={v >= k.done ? (GAP + 53) * grow(v, k.done) : 0}>
              <Bubble enter={sp(v, k.done, { damping: 13, stiffness: 240 })}>Pushed! PR #182 is up 🚀</Bubble>
            </Slot>
          </div>

          {/* composer */}
          <div style={{ position: "absolute", left: 24, right: 24, bottom: 18, height: 54, borderRadius: 27, border: `1.5px solid ${draft ? C.accent : C.line}`, background: "#fff", display: "flex", alignItems: "center", padding: "0 8px 0 22px", gap: 10 }}>
            <span style={{ flex: 1, fontSize: 18, color: draft ? C.ink : C.ink3, whiteSpace: "nowrap", overflow: "hidden" }}>
              {draft || "Message Pip…"}
              {v < k.send && <span style={{ display: "inline-block", width: 2, height: 22, marginLeft: 2, verticalAlign: "-4px", background: C.accent, opacity: Math.floor(v / 16) % 2 ? 1 : 0 }} />}
            </span>
            <div style={{ width: 40, height: 40, borderRadius: "50%", background: draft ? C.accent : "rgba(0,0,0,0.08)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="18" height="18" viewBox="0 0 18 18">
                <path d="M9 15 V3 M3.5 8.5 L9 3 L14.5 8.5" stroke="#fff" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>
        </div>
      </MacWindow>

      <Cursor
        f={v}
        show={[350, k.allow + 30]}
        clicks={[k.allow]}
        path={[{ f: 350, x: 1500, y: 1010 }, { f: k.allow - 4, ...allowButton(k.allow - 4) }]}
      />
      <Grain f={v} opacity={0.1} />
    </AbsoluteFill>
  );
}

function windowTransform(v: number) {
  const win = sp(v, 0, { damping: 15, stiffness: 140 });
  const exit = prog(v, k.exit, 30, EASE.in);
  const push = map(v, [0, k.exit], [1, 1.03]);
  return { win, exit, scale: (0.92 + 0.08 * win) * push * (1 - 0.06 * exit), dx: -exit * 260, dy: (1 - win) * 60 };
}

/** Where "Allow once" lands on screen: the card sits at the bottom of the transcript. */
function allowButton(v: number) {
  const x = WX + SIDE + 30 + CARD_PAD + 26 + 14 + 56;
  const y = WY + WH - 86 - PAD_B - CARD_PAD - BTN_H / 2;
  const t = windowTransform(v);
  const ox = WX + WW * 0.6;
  const oy = WY + WH * 0.5;
  return { x: ox + (x - ox) * t.scale + t.dx, y: oy + (y - oy) * t.scale + t.dy };
}
