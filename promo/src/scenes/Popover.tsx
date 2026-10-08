import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { EASE, map, prog, sp, typed } from "../anim";
import { C, F, GUYS, type GuyKey } from "../theme";
import { K, QUICK_REPLY, S } from "../timeline";
import { Avatar, Caption, Cursor, Spinner, type Ring } from "../ui/kit";
import { Grain, MENUBAR_H, MenuBar, SPRITE_C, Wallpaper } from "../ui/stage";

// Click the guy: the popover lists everyone with a live ring and their last
// message. One guy asks for something; we answer without leaving the popover.

const k = K.popover;
const PW = 560;
const PX = SPRITE_C.x - PW / 2;
const PY = MENUBAR_H + 8;
const HEADER = 58;
const LABEL = 36;
const ROW = 80;
const REPLY = 66;
// the camera pushes in on the top-right corner
const ZOOM = 1.24;
const CAM_X = 1500;
// cursor targets (reply box closed)
const BISCUIT_Y = PY + HEADER + LABEL + 2 * ROW + LABEL + ROW / 2;
const FOOTER_Y = PY + HEADER + 3 * LABEL + 5 * ROW + 12 + 23;

type RowState = { guy: GuyKey; ring: Ring; time: string; preview: React.ReactNode; bold?: boolean; flash?: number };

function Row({ r, f, enter }: { r: RowState; f: number; enter: number }) {
  return (
    <div
      style={{
        height: ROW,
        display: "flex",
        alignItems: "center",
        gap: 16,
        padding: "0 14px",
        margin: "0 8px",
        borderRadius: 16,
        background: r.flash ? `rgba(255,122,69,${0.16 * r.flash})` : undefined,
        opacity: enter,
        transform: `translateY(${(1 - enter) * 12}px)`,
      }}
    >
      <Avatar guy={r.guy} size={56} ring={r.ring} f={f} bg="#FBF8F6" />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <span style={{ fontSize: 20, fontWeight: r.bold ? 700 : 600 }}>{GUYS[r.guy].name}</span>
          <span style={{ fontSize: 15, color: r.ring === "working" ? C.accentStrong : C.ink3, fontWeight: r.ring === "working" ? 600 : 400 }}>{r.time}</span>
        </div>
        <div style={{ fontSize: 17, marginTop: 3, color: r.bold ? C.ink : C.ink3, fontWeight: r.bold ? 600 : 400, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.preview}</div>
      </div>
    </div>
  );
}

function Label({ text, enter }: { text: string; enter: number }) {
  return (
    <div style={{ height: LABEL, padding: "12px 24px 0", fontSize: 13.5, fontWeight: 700, letterSpacing: "0.06em", color: C.ink3, opacity: enter }}>{text}</div>
  );
}

const code = (s: string) => <code style={{ fontFamily: F.mono, fontSize: 15, background: C.chip, padding: "1px 6px", borderRadius: 6 }}>{s}</code>;

export function Popover() {
  const u = useCurrentFrame();
  const open = sp(u, k.open, { damping: 16, stiffness: 260 });
  const close = prog(u, k.openClick + 2, 14, EASE.in);
  const enter = (i: number) => prog(u, k.open + 4 + i * 3, 22);

  const tests = Math.min(40, 12 + Math.max(0, Math.floor((u - 20) / 5)));
  const pipDone = u >= 190;
  const sent = u >= k.sent;
  const replyOpen = map(u, [k.rowClick + 2, k.rowClick + 16], [0, 1], EASE.out) * (1 - map(u, [k.sent + 6, k.sent + 20], [0, 1], EASE.inOut));
  const ping = u >= k.ping;

  const rows: Record<GuyKey, RowState> = {
    pip: pipDone
      ? { guy: "pip", ring: "unread", time: "now", preview: "All 40 green ✅ pushed the fix", bold: true, flash: map(u, [190, 196, 240], [0, 1, 0]) }
      : { guy: "pip", ring: "working", time: "working", preview: `Running checkout tests… ${tests}/40` },
    juno: { guy: "juno", ring: "unread", time: "2m", preview: "Launch post draft is ready ✍️", bold: true },
    biscuit: sent
      ? { guy: "biscuit", ring: "working", time: "working", preview: u < k.sent + 40 ? `You: ${QUICK_REPLY}` : "Publishing v2.4.0 to npm…" }
      : { guy: "biscuit", ring: "needs", time: "5m", preview: <>Can I run {code("pnpm publish")}?</>, bold: true },
    mochi: ping
      ? { guy: "mochi", ring: "unread", time: "now", preview: "Found 3 invoices to pay 🧾", bold: true, flash: map(u, [k.ping, k.ping + 6, k.ping + 60], [0, 1, 0]) }
      : { guy: "mochi", ring: "idle", time: "1h", preview: "Inbox zero. Archived 42 threads 📬" },
    atlas: { guy: "atlas", ring: "idle", time: "9:02", preview: "Weekly numbers are in 📈" },
  };

  const hoverOpen = u >= k.openClick - 10 && u < k.openClick + 16;
  const trayMood = u < k.sent ? "news" : "working";
  const draft = typed(QUICK_REPLY, u, k.typeFrom, k.typeTo);
  const sending = u >= k.send && u < k.sent;

  const cam = map(u, [4, k.click + 6], [1, ZOOM], EASE.inOut);

  return (
    <AbsoluteFill style={{ overflow: "hidden", fontFamily: F.ui, color: C.ink }}>
      <AbsoluteFill style={{ transformOrigin: `${CAM_X}px 0px`, transform: `scale(${cam})` }}>
      <Wallpaper />
      <MenuBar mood={trayMood} t={S.popover.from + u} />


      {u >= k.open && (
        <div
          style={{
            position: "absolute",
            left: PX,
            top: PY,
            width: PW,
            borderRadius: 20,
            background: "rgba(251,247,244,0.86)",
            backdropFilter: "blur(40px) saturate(1.8)",
            WebkitBackdropFilter: "blur(40px) saturate(1.8)",
            boxShadow: "0 40px 90px rgba(120,40,10,0.28), 0 0 0 1px rgba(0,0,0,0.09)",
            transformOrigin: "50% 0%",
            transform: `translateY(${(1 - open) * -14}px) scale(${(0.93 + 0.07 * open) * (1 - 0.04 * close)})`,
            opacity: map(open, [0, 0.4], [0, 1]) * (1 - close),
            paddingBottom: 10,
            maxHeight: map(u, [k.open, k.open + 36], [140, 1000], EASE.out),
            overflow: "hidden",
          }}
        >
          <div style={{ height: HEADER, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 24px", opacity: enter(0) }}>
            <span style={{ fontFamily: F.display, fontSize: 21, fontWeight: 700, letterSpacing: "-0.02em" }}>littleguys</span>
            <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 15, color: C.ink3 }}>
              <span style={{ width: 9, height: 9, borderRadius: "50%", background: C.ok }} /> 3 gateways
            </span>
          </div>
          <Label text="STUDIO" enter={enter(1)} />
          <Row r={rows.pip} f={u} enter={enter(2)} />
          <Row r={rows.juno} f={u} enter={enter(3)} />
          <Label text="HOMELAB" enter={enter(4)} />
          <div
            style={{
              margin: "0 8px",
              borderRadius: 16,
              background: replyOpen > 0 ? `rgba(0,0,0,${0.05 * Math.min(1, replyOpen * 3)})` : undefined,
            }}
          >
            <div style={{ margin: "0 -8px" }}>
              <Row r={rows.biscuit} f={u} enter={enter(5)} />
            </div>
            <div style={{ height: REPLY * replyOpen, overflow: "hidden" }}>
              <div style={{ padding: "4px 14px 14px" }}>
                <div
                  style={{
                    height: 46,
                    borderRadius: 12,
                    border: `1.5px solid ${draft ? C.accent : C.line}`,
                    background: "#fff",
                    display: "flex",
                    alignItems: "center",
                    padding: "0 14px",
                    gap: 10,
                    fontSize: 18,
                  }}
                >
                  <span style={{ flex: 1, color: draft ? C.ink : C.ink3 }}>
                    {draft || "Reply to Biscuit…"}
                    {!sending && <span style={{ display: "inline-block", width: 2, height: 22, marginLeft: 2, verticalAlign: "-4px", background: C.accent, opacity: Math.floor(u / 16) % 2 ? 1 : 0 }} />}
                  </span>
                  {sending ? <Spinner f={u} size={20} /> : <span style={{ color: C.ink3, fontSize: 18 }}>↵</span>}
                </div>
              </div>
            </div>
          </div>
          <Row r={rows.mochi} f={u} enter={enter(6)} />
          <Label text="THIS MAC" enter={enter(7)} />
          <Row r={rows.atlas} f={u} enter={enter(8)} />
          <div style={{ margin: "12px 0 0", borderTop: `1px solid ${C.line}`, padding: "8px 8px 0", opacity: enter(9) }}>
            {[
              ["Open littleguys", "⌘O"],
              ["New guy…", "⌘N"],
              ["Settings…", "⌘,"],
            ].map(([label, key], i) => {
              const hot = i === 0 && hoverOpen;
              return (
                <div
                  key={label}
                  style={{
                    height: 46,
                    display: "flex",
                    alignItems: "center",
                    padding: "0 16px",
                    borderRadius: 10,
                    fontSize: 18,
                    background: hot ? C.accent : undefined,
                    color: hot ? "#fff" : C.ink,
                  }}
                >
                  <span style={{ flex: 1 }}>{label}</span>
                  <span style={{ fontSize: 15, opacity: 0.5 }}>{key}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <Cursor
        f={u}
        show={[6, k.openClick + 14]}
        clicks={[k.click, k.rowClick, k.openClick]}
        path={[
          { f: 6, x: 1120, y: 760 },
          { f: k.click - 4, x: SPRITE_C.x + 4, y: SPRITE_C.y + 4 },
          { f: 150, x: SPRITE_C.x + 30, y: 300 },
          { f: k.rowClick - 4, x: PX + 330, y: BISCUIT_Y + 6 },
          { f: 296, x: PX + 380, y: BISCUIT_Y + 120 },
          { f: k.openClick - 6, x: PX + 170, y: FOOTER_Y },
        ]}
      />
      </AbsoluteFill>
      <Caption lines={["Everyone,", "at a glance."]} f={u} at={62} out={176} y={392} />
      <Caption lines={["Reply in a few", "keystrokes."]} f={u} at={192} out={300} y={392} accentLine={1} />
      <Grain f={u} opacity={0.1} />
    </AbsoluteFill>
  );
}
