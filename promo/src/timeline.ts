// One clock for picture and sound. Scenes read their start frames and key
// moments from here, and scripts/soundtrack.mjs reads the same numbers to
// place music sections and sound effects, so the two can't drift apart.
//
// 60 fps, 120 bpm: a beat is 30 frames and a bar is 120.

export const FPS = 60;
export const W = 1920;
export const H = 1080;
export const BPM = 120;
export const BEAT = 30;
export const BAR = 120;

export const S = {
  chaos: { from: 0, dur: 360 },
  hello: { from: 360, dur: 210 },
  moods: { from: 540, dur: 540 },
  popover: { from: 1080, dur: 390 },
  chat: { from: 1440, dur: 510 },
  routines: { from: 1920, dur: 390 },
  anyGuy: { from: 2280, dur: 390 },
  end: { from: 2640, dur: 420 },
};

export const TOTAL = S.end.from + S.end.dur;

/** Key moments, in frames local to each scene. */
export const K = {
  chaos: { l1: 8, l1Out: 78, l2: 92, l2Out: 196, l3: 210, l3Out: 292, winFrom: 62, winEvery: 9, implode: 294, dot: 336 },
  hello: { hop: 4, impact: 30, bubble: 66, hi: 96, word: 84, sub: 126, handoff: 180 },
  moods: { zoomIn: 30, stage: 60, each: 90, zoomOut: 510 },
  popover: { click: 40, open: 42, ping: 120, rowClick: 186, typeFrom: 206, typeTo: 244, send: 252, sent: 268, openClick: 336 },
  chat: { typeFrom: 44, typeTo: 92, send: 98, typing: 110, tool: [150, 180, 212], stream: 232, approval: 330, allow: 396, done: 428, exit: 452 },
  routines: { cards: 6, runClick: 130, ran: 176, notif: 182, exit: 330 },
  anyGuy: { popFrom: 20, popEvery: 10, wave: 116, group: 190, exit: 336 },
  end: { plate: 0, bubble: 24, word: 36, tag: 70, fine: 104 },
};

export const MOODS = ["idle", "working", "news", "needs", "offline"] as const;
export type Mood = (typeof MOODS)[number];

export const CHAT_PROMPT = "Checkout tests are flaky again. Can you dig in?";
export const QUICK_REPLY = "go for it 🚀";

export type Cue =
  | { at: number; kind: "pop"; note: number; gain?: number }
  | { at: number; kind: "click" | "boop" | "blip" | "chime" | "sparkle" | "tick" | "thud"; gain?: number }
  | { at: number; kind: "whoosh"; dur: number; up?: boolean; gain?: number }
  | { at: number; kind: "suck"; dur: number }
  | { at: number; kind: "keys"; to: number; count: number };

const pentatonic = [72, 74, 76, 79, 81, 84, 86, 88, 91];

/** Every sound effect, in global frames. */
export function cues(): Cue[] {
  const c: Cue[] = [];
  const at = (scene: keyof typeof S, f: number) => S[scene].from + f;

  // chaos: windows tick in, then everything gets sucked into a dot
  for (let i = 0; i < 16; i++) c.push({ at: at("chaos", K.chaos.winFrom + i * K.chaos.winEvery), kind: "tick", gain: 0.5 + (i % 3) * 0.15 });
  c.push({ at: at("chaos", K.chaos.l3), kind: "whoosh", dur: 24, gain: 0.5 });
  c.push({ at: at("chaos", K.chaos.implode), kind: "suck", dur: 44 });
  c.push({ at: at("chaos", K.chaos.dot), kind: "pop", note: 96, gain: 0.7 });

  // hello: hop, land, bubble, wordmark
  c.push({ at: at("hello", K.hello.hop), kind: "pop", note: 79, gain: 0.5 });
  c.push({ at: at("hello", K.hello.impact), kind: "boop" });
  c.push({ at: at("hello", K.hello.impact + 2), kind: "whoosh", dur: 34, up: true, gain: 0.6 });
  c.push({ at: at("hello", K.hello.bubble), kind: "pop", note: 84 });
  c.push({ at: at("hello", K.hello.hi), kind: "pop", note: 88, gain: 0.6 });
  c.push({ at: at("hello", K.hello.word), kind: "sparkle" });

  // moods: fly to the menu bar, zoom in, one pop per mood, zoom out
  c.push({ at: at("moods", 0), kind: "whoosh", dur: 30, up: true });
  c.push({ at: at("moods", K.moods.zoomIn), kind: "whoosh", dur: 30, up: true, gain: 0.8 });
  for (let i = 1; i < MOODS.length; i++) c.push({ at: at("moods", K.moods.stage + i * K.moods.each), kind: "pop", note: pentatonic[i + 1] });
  c.push({ at: at("moods", K.moods.zoomOut), kind: "whoosh", dur: 30, gain: 0.8 });

  // popover
  c.push({ at: at("popover", K.popover.click), kind: "click" });
  c.push({ at: at("popover", K.popover.open), kind: "pop", note: 76 });
  c.push({ at: at("popover", K.popover.ping), kind: "blip" });
  c.push({ at: at("popover", K.popover.rowClick), kind: "click" });
  c.push({ at: at("popover", K.popover.typeFrom), kind: "keys", to: at("popover", K.popover.typeTo), count: 10 });
  c.push({ at: at("popover", K.popover.send), kind: "whoosh", dur: 16, up: true, gain: 0.5 });
  c.push({ at: at("popover", K.popover.sent), kind: "pop", note: 81, gain: 0.6 });
  c.push({ at: at("popover", K.popover.openClick), kind: "click" });

  // chat
  c.push({ at: at("chat", 0), kind: "whoosh", dur: 26, up: true, gain: 0.7 });
  c.push({ at: at("chat", K.chat.typeFrom), kind: "keys", to: at("chat", K.chat.typeTo), count: 22 });
  c.push({ at: at("chat", K.chat.send), kind: "whoosh", dur: 18, up: true, gain: 0.6 });
  c.push({ at: at("chat", K.chat.typing), kind: "pop", note: 74, gain: 0.5 });
  K.chat.tool.forEach((f, i) => c.push({ at: at("chat", f), kind: "tick", gain: 0.9 - i * 0.1 }));
  c.push({ at: at("chat", K.chat.approval), kind: "blip" });
  c.push({ at: at("chat", K.chat.allow), kind: "click" });
  c.push({ at: at("chat", K.chat.allow + 6), kind: "chime" });
  c.push({ at: at("chat", K.chat.done), kind: "pop", note: 84, gain: 0.6 });
  c.push({ at: at("chat", K.chat.exit), kind: "whoosh", dur: 30, gain: 0.6 });

  // routines
  [0, 8, 16].forEach((d, i) => c.push({ at: at("routines", K.routines.cards + d), kind: "whoosh", dur: 18, gain: 0.35 + i * 0.05 }));
  c.push({ at: at("routines", K.routines.runClick), kind: "click" });
  c.push({ at: at("routines", K.routines.ran), kind: "pop", note: 88, gain: 0.6 });
  c.push({ at: at("routines", K.routines.notif), kind: "chime" });
  c.push({ at: at("routines", K.routines.exit), kind: "whoosh", dur: 30, gain: 0.6 });

  // any guy: each guy pops on a rising pentatonic note
  for (let i = 0; i < 7; i++) c.push({ at: at("anyGuy", K.anyGuy.popFrom + i * K.anyGuy.popEvery), kind: "pop", note: pentatonic[i] });
  c.push({ at: at("anyGuy", K.anyGuy.group), kind: "whoosh", dur: 30, up: true, gain: 0.6 });
  for (let i = 0; i < 3; i++) c.push({ at: at("anyGuy", K.anyGuy.group + 12 + i * 6), kind: "pop", note: 72 + i * 4, gain: 0.5 });

  // end card
  c.push({ at: at("end", K.end.plate), kind: "thud" });
  c.push({ at: at("end", K.end.plate + 2), kind: "sparkle" });
  c.push({ at: at("end", K.end.bubble), kind: "pop", note: 84 });
  c.push({ at: at("end", K.end.word), kind: "whoosh", dur: 24, up: true, gain: 0.4 });
  return c;
}
