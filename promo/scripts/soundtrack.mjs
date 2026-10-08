// Synthesizes the soundtrack and sound effects into public/soundtrack.wav.
// Everything is generated (no samples) and placed from src/timeline.ts, so
// the music sections and every pop/click/whoosh land on the picture.
//
//   node scripts/soundtrack.mjs
import fs from "node:fs";
import path from "node:path";
import { BPM, FPS, S, TOTAL, cues } from "../src/timeline.ts";

const SR = 48000;
const LEN = TOTAL / FPS + 1.5;
const N = Math.ceil(LEN * SR);
const BEAT = 60 / BPM;
const BAR = BEAT * 4;
const TAU = Math.PI * 2;
const sec = (frame) => frame / FPS;
const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);

// deterministic noise
let seed = 0x9e3779b9;
const rand = () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const noise = () => rand() * 2 - 1;

const bus = () => [new Float32Array(N), new Float32Array(N)];
const music = bus();
const drums = bus();
const sfx = bus();
const send = bus();

/** Render gen(t) into a bus from t0 for dur seconds. */
function voice(b, t0, dur, gen, { pan = 0, gain = 1, verb = 0 } = {}) {
  const s0 = Math.round(t0 * SR);
  const n = Math.round(dur * SR);
  const gl = gain * Math.cos(((pan + 1) * Math.PI) / 4);
  const gr = gain * Math.sin(((pan + 1) * Math.PI) / 4);
  for (let i = 0; i < n; i++) {
    const idx = s0 + i;
    if (idx < 0 || idx >= N) continue;
    const v = gen(i / SR, i);
    b[0][idx] += v * gl;
    b[1][idx] += v * gr;
    if (verb) {
      send[0][idx] += v * gl * verb;
      send[1][idx] += v * gr * verb;
    }
  }
}

class Biquad {
  constructor(type, f, q = 0.707) {
    this.type = type;
    this.x1 = this.x2 = this.y1 = this.y2 = 0;
    this.set(f, q);
  }
  set(f, q = this.q) {
    this.q = q;
    const w = (TAU * Math.min(f, SR * 0.45)) / SR;
    const cos = Math.cos(w);
    const alpha = Math.sin(w) / (2 * q);
    let b0, b1, b2;
    if (this.type === "lp") [b0, b1, b2] = [(1 - cos) / 2, 1 - cos, (1 - cos) / 2];
    else if (this.type === "hp") [b0, b1, b2] = [(1 + cos) / 2, -(1 + cos), (1 + cos) / 2];
    else [b0, b1, b2] = [alpha, 0, -alpha]; // band-pass
    const a0 = 1 + alpha;
    this.b0 = b0 / a0;
    this.b1 = b1 / a0;
    this.b2 = b2 / a0;
    this.a1 = (-2 * cos) / a0;
    this.a2 = (1 - alpha) / a0;
  }
  run(x) {
    const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
    this.x2 = this.x1;
    this.x1 = x;
    this.y2 = this.y1;
    this.y1 = y;
    return y;
  }
}

// ---------------------------------------------------------------------------
// Instruments

function mallet(b, t0, m, { gain = 0.12, pan = 0, verb = 0.3, decay = 5.5 } = {}) {
  const f = hz(m);
  voice(
    b,
    t0,
    1.8,
    (t) => {
      const a = Math.min(1, t / 0.002);
      return a * (Math.sin(TAU * f * t) * Math.exp(-t * decay) + 0.3 * Math.sin(TAU * f * 4 * t) * Math.exp(-t * 24) + 0.1 * Math.sin(TAU * f * 2.76 * t) * Math.exp(-t * 12));
    },
    { gain, pan, verb },
  );
}

function pad(t0, t1, notes, { gain = 0.04, bright = 0.55, attack = 0.5, release = 1.2 } = {}) {
  const dur = t1 - t0 + release;
  for (const m of notes) {
    [-7, 0, 7].forEach((cents, k) => {
      const f = hz(m) * Math.pow(2, cents / 1200);
      const ph = rand() * TAU;
      voice(
        music,
        t0,
        dur,
        (t) => {
          const env = Math.min(1, t / attack) * (t > t1 - t0 ? Math.max(0, 1 - (t - (t1 - t0)) / release) : 1);
          const br = bright + 0.08 * Math.sin(TAU * 0.13 * (t0 + t));
          let v = 0;
          let amp = 1;
          for (let h = 1; h <= 7; h++) {
            v += (amp / h) * Math.sin(TAU * f * h * t + ph * h);
            amp *= br;
          }
          return v * env * (1 + 0.06 * Math.sin(TAU * 3.1 * t + k));
        },
        { gain, pan: (k - 1) * 0.45, verb: 0.35 },
      );
    });
  }
}

function bass(t0, dur, m, gain = 0.32) {
  const f = hz(m);
  voice(
    music,
    t0,
    dur + 0.06,
    (t) => {
      const env = Math.min(1, t / 0.006) * (0.7 + 0.3 * Math.exp(-t * 8)) * (t > dur ? Math.max(0, 1 - (t - dur) / 0.06) : 1);
      const v = Math.sin(TAU * f * t) + 0.28 * Math.sin(TAU * 2 * f * t) + 0.08 * Math.sin(TAU * 3 * f * t);
      return Math.tanh(1.4 * v) * env;
    },
    { gain },
  );
}

const kicks = [];
function kick(t0, gain = 0.9) {
  kicks.push(t0);
  let ph = 0;
  voice(
    drums,
    t0,
    0.5,
    (t) => {
      const f = 46 + 120 * Math.exp(-t * 30);
      ph += (TAU * f) / SR;
      return Math.sin(ph) * Math.exp(-t * 7) + noise() * 0.25 * Math.exp(-t * 350);
    },
    { gain },
  );
}

function clap(t0, gain = 0.3) {
  const bp = new Biquad("bp", 1400, 0.9);
  voice(
    drums,
    t0,
    0.32,
    (t) => {
      const bursts = [0, 0.011, 0.023].reduce((s, d) => s + (t >= d ? Math.exp(-(t - d) * 190) : 0), 0);
      return bp.run(noise()) * (bursts + 0.55 * Math.exp(-t * 15));
    },
    { gain, verb: 0.25 },
  );
}

function hat(t0, open = false, gain = 0.1, pan = 0.2) {
  const hp = new Biquad("hp", 7500, 0.8);
  voice(drums, t0, open ? 0.32 : 0.07, (t) => hp.run(noise()) * Math.exp(-t * (open ? 11 : 65)), { gain, pan });
}

function shaker(t0, gain = 0.04) {
  const bp = new Biquad("bp", 5200, 1.1);
  voice(drums, t0, 0.09, (t) => bp.run(noise()) * Math.min(1, t / 0.012) * Math.exp(-t * 42), { gain, pan: -0.35 });
}

function riser(t0, dur, gain = 0.16) {
  const bp = new Biquad("bp", 400, 1.4);
  voice(
    sfx,
    t0,
    dur,
    (t, i) => {
      const p = t / dur;
      if (i % 32 === 0) bp.set(400 * Math.pow(18, p), 1.4);
      return bp.run(noise()) * p * p;
    },
    { gain, verb: 0.3 },
  );
}

// ---------------------------------------------------------------------------
// Arrangement

const CH = {
  C: { root: 36, pad: [64, 67, 71, 74], arp: [72, 76, 79, 83, 86] },
  Am: { root: 33, pad: [64, 67, 69, 72], arp: [69, 72, 76, 79, 81] },
  F: { root: 29, pad: [60, 64, 65, 69], arp: [65, 69, 72, 76, 79] },
  G: { root: 31, pad: [62, 64, 67, 71], arp: [67, 71, 74, 76, 79] },
};
const PROG = ["C", "Am", "F", "G"];
const ARP = [0, 2, 1, 3, 2, 4, 3, 1];

const tBirth = sec(S.hello.from);
const tImpact = sec(S.hello.from + 30);
const tDrop = 5 * BAR; // the groove starts as the moods stage begins
const tEnd = sec(S.end.from);
const tResolve = tEnd + 2 * BAR;

// 1. Cold open: a tense pulse that builds until everything implodes
const tCut = sec(S.chaos.from + 300);
for (let t = 0; t < tCut; t += BEAT / 2) {
  const g = 0.14 + 0.34 * (t / tCut);
  bass(t, 0.12, 33, g);
  hat(t + BEAT / 4, false, 0.05 + 0.07 * (t / tCut), 0.4);
}
for (let t = 0; t < tCut; t += BEAT / 4) shaker(t, 0.012 + 0.02 * (t / tCut));
pad(0, tCut - 0.3, [57, 60, 64, 71], { gain: 0.042, bright: 0.38, attack: 1.5, release: 0.3 });
riser(sec(200), sec(300) - sec(200), 0.12);

// 2. Birth: the world blooms, pad swells, the arp tiptoes in
pad(tImpact, tBirth + BAR, CH.F.pad, { gain: 0.026, attack: 0.6 });
pad(tBirth + BAR, tDrop, CH.G.pad, { gain: 0.03, attack: 0.3 });
bass(tImpact, BAR - 0.5, CH.F.root + 12, 0.11);
bass(tBirth + BAR, BAR, CH.G.root + 12, 0.13);
for (let i = 0; i < 2; i++) mallet(music, tBirth + BAR / 2 + i * BEAT, CH.F.arp[ARP[i]], { gain: 0.1, pan: i % 2 ? 0.3 : -0.3 });
for (let i = 0; i < 8; i++) mallet(music, tBirth + BAR + i * (BEAT / 2), CH.G.arp[ARP[i]], { gain: 0.1, pan: i % 2 ? 0.3 : -0.3 });
riser(tDrop - BAR / 2, BAR / 2, 0.14);

// 3. The groove
const fillBars = [S.popover.from, S.chat.from, S.routines.from, S.anyGuy.from, S.end.from].map((f) => Math.round(f / FPS / BAR) - 1);
for (let b = 5; b * BAR < tEnd - 0.01; b++) {
  const t = b * BAR;
  const ch = CH[PROG[(b - 5) % 4]];
  pad(t, t + BAR, ch.pad, { gain: 0.034, attack: 0.08, release: 0.5 });
  // bass bounce
  bass(t, 0.4, ch.root + 12);
  bass(t + 1.5 * BEAT, 0.2, ch.root + 12);
  bass(t + 2 * BEAT, 0.4, ch.root + 19);
  bass(t + 3.5 * BEAT, 0.2, ch.root + 24, 0.24);
  // arp
  for (let i = 0; i < 8; i++) mallet(music, t + i * (BEAT / 2), ch.arp[ARP[i]], { gain: i % 2 ? 0.07 : 0.095, pan: i % 2 ? 0.35 : -0.35 });
  // drums
  kick(t);
  kick(t + 1.5 * BEAT, 0.6);
  kick(t + 2 * BEAT);
  clap(t + BEAT);
  clap(t + 3 * BEAT);
  for (let i = 0; i < 4; i++) hat(t + i * BEAT + BEAT / 2, i === 3, i === 3 ? 0.07 : 0.1, 0.25);
  for (let i = 0; i < 16; i++) shaker(t + (i * BEAT) / 4, i % 2 ? 0.03 : 0.018);
  if (fillBars.includes(b)) {
    for (let i = 0; i < 4; i++) clap(t + 3 * BEAT + (i * BEAT) / 4, 0.12 + i * 0.05);
    riser(t + 2 * BEAT, 2 * BEAT, 0.08);
  }
}

// 4. Landing: F, G, then home to C and let it ring
const endChords = [
  ["F", tEnd, tEnd + BAR],
  ["G", tEnd + BAR, tResolve],
  ["C", tResolve, LEN],
];
for (const [name, a, z] of endChords) {
  const ch = CH[name];
  pad(a, Math.min(z, LEN - 1.6), name === "C" ? [...ch.pad, 79] : ch.pad, { gain: 0.04, attack: 0.05, release: 1.6 });
  bass(a, Math.min(z - a, 2.8), ch.root + 12, 0.26);
}
kick(tEnd, 1);
for (let i = 0; i < 8; i++) {
  const t = tEnd + i * BEAT;
  const ch = CH[i < 4 ? "F" : "G"];
  mallet(music, t, ch.arp[ARP[i % 8]], { gain: 0.085, pan: i % 2 ? 0.3 : -0.3 });
  hat(t + BEAT / 2, false, 0.05, 0.25);
}
// final strum
CH.C.arp.forEach((m, i) => mallet(music, tResolve + i * 0.045, m, { gain: 0.09, verb: 0.5, decay: 2.2 }));
mallet(music, tResolve + 0.3, 96, { gain: 0.06, verb: 0.6, decay: 2 });

// sidechain pump: duck the music under every kick
for (const tk of kicks) {
  const s0 = Math.round(tk * SR);
  const n = Math.round(0.32 * SR);
  for (let i = 0; i < n && s0 + i < N; i++) {
    const g = 1 - 0.5 * Math.exp(-(i / SR) / 0.085) * Math.min(1, i / (0.004 * SR));
    music[0][s0 + i] *= g;
    music[1][s0 + i] *= g;
  }
}

// ---------------------------------------------------------------------------
// Sound effects

const fx = {
  pop(t0, note, g) {
    const f = hz(note);
    let ph = 0;
    voice(sfx, t0, 0.22, (t) => {
      const ff = f * (0.75 + 0.25 * Math.min(1, t / 0.03));
      ph += (TAU * ff) / SR;
      return (Math.sin(ph) + 0.2 * Math.sin(2 * ph)) * Math.exp(-t * 24) * Math.min(1, t / 0.002);
    }, { gain: 0.2 * g, verb: 0.15, pan: (rand() - 0.5) * 0.4 });
  },
  click(t0, g) {
    const hp = new Biquad("hp", 2500);
    voice(sfx, t0, 0.05, (t) => hp.run(noise()) * Math.exp(-t * 420) + 0.35 * Math.sin(TAU * 2300 * t) * Math.exp(-t * 160), { gain: 0.24 * g });
  },
  tick(t0, g) {
    voice(sfx, t0, 0.03, (t) => Math.sin(TAU * 3400 * t) * Math.exp(-t * 260), { gain: 0.05 * g, pan: (rand() - 0.5) * 1.2, verb: 0.2 });
  },
  key(t0) {
    const bp = new Biquad("bp", 2500 + rand() * 1500, 1.2);
    voice(sfx, t0, 0.03, (t) => bp.run(noise()) * Math.exp(-t * 320), { gain: 0.16 + rand() * 0.06, pan: (rand() - 0.5) * 0.3 });
  },
  whoosh(t0, dur, up, g) {
    const bp = new Biquad("bp", 500, 1.1);
    voice(sfx, t0, dur, (t, i) => {
      const p = t / dur;
      if (i % 32 === 0) bp.set(up ? 300 * Math.pow(14, p) : 4200 * Math.pow(1 / 14, p), 1.1);
      return bp.run(noise()) * Math.pow(Math.sin(Math.PI * p), 2);
    }, { gain: 0.32 * g, verb: 0.2, pan: up ? 0.2 : -0.2 });
  },
  suck(t0, dur) {
    const bp = new Biquad("bp", 500, 1.3);
    let ph = 0;
    voice(sfx, t0, dur, (t, i) => {
      const p = t / dur;
      if (i % 32 === 0) bp.set(500 * Math.pow(12, p), 1.3);
      ph += (TAU * (70 + 330 * p * p)) / SR;
      const env = Math.pow(p, 2.6) * (p > 0.96 ? (1 - p) / 0.04 : 1);
      return (bp.run(noise()) * 1.2 + 0.5 * Math.sin(ph)) * env;
    }, { gain: 0.32, verb: 0.25 });
  },
  boop(t0, g) {
    let ph = 0;
    voice(sfx, t0, 0.4, (t) => {
      ph += (TAU * (100 + 160 * Math.exp(-t * 18))) / SR;
      return Math.sin(ph) * Math.exp(-t * 11);
    }, { gain: 0.45 * g, verb: 0.15 });
  },
  thud(t0, g) {
    let ph = 0;
    const lp = new Biquad("lp", 3500);
    voice(sfx, t0, 2.5, (t) => {
      ph += (TAU * (44 + 80 * Math.exp(-t * 20))) / SR;
      return Math.sin(ph) * Math.exp(-t * 4) + lp.run(noise()) * 0.22 * Math.exp(-t * 2.2) * Math.min(1, t / 0.01);
    }, { gain: 0.5 * g, verb: 0.35 });
  },
  blip(t0, g) {
    mallet(sfx, t0, 84, { gain: 0.16 * g, verb: 0.25, decay: 9 });
    mallet(sfx, t0 + 0.075, 91, { gain: 0.14 * g, verb: 0.25, decay: 9 });
  },
  chime(t0, g) {
    [88, 91, 96].forEach((m, i) => mallet(sfx, t0 + i * 0.055, m, { gain: 0.14 * g, verb: 0.45, decay: 6, pan: (i - 1) * 0.3 }));
  },
  sparkle(t0, g) {
    [91, 93, 96, 98, 100, 103].forEach((m, i) => mallet(sfx, t0 + i * 0.035, m, { gain: 0.07 * g, verb: 0.55, decay: 7, pan: (i / 5 - 0.5) * 0.8 }));
  },
};

for (const c of cues()) {
  const t0 = sec(c.at);
  const g = c.gain ?? 1;
  switch (c.kind) {
    case "pop":
      fx.pop(t0, c.note, g);
      break;
    case "whoosh":
      fx.whoosh(t0, sec(c.dur), !!c.up, g);
      break;
    case "suck":
      fx.suck(t0, sec(c.dur));
      break;
    case "keys":
      for (let i = 0; i < c.count; i++) fx.key(t0 + ((sec(c.to) - t0) * (i + rand() * 0.4)) / c.count);
      break;
    default:
      fx[c.kind](t0, g);
  }
}

// ---------------------------------------------------------------------------
// Reverb (Freeverb) on the send bus

function freeverb(input, spread) {
  const k = SR / 44100;
  const combs = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617].map((d) => ({ buf: new Float32Array(Math.round((d + spread) * k)), i: 0, store: 0 }));
  const alls = [556, 441, 341, 225].map((d) => ({ buf: new Float32Array(Math.round((d + spread) * k)), i: 0 }));
  const out = new Float32Array(N);
  const room = 0.86;
  const damp = 0.3;
  for (let n = 0; n < N; n++) {
    const x = input[n] * 0.015;
    let y = 0;
    for (const c of combs) {
      const o = c.buf[c.i];
      c.store = o * (1 - damp) + c.store * damp;
      c.buf[c.i] = x + c.store * room;
      if (++c.i >= c.buf.length) c.i = 0;
      y += o;
    }
    for (const a of alls) {
      const o = a.buf[a.i];
      a.buf[a.i] = y + o * 0.5;
      if (++a.i >= a.buf.length) a.i = 0;
      y = o - y;
    }
    out[n] = y;
  }
  return out;
}
const verbL = freeverb(send[0], 0);
const verbR = freeverb(send[1], 23);

// ---------------------------------------------------------------------------
// Mix, glue, fade, write

const L = new Float32Array(N);
const R = new Float32Array(N);
for (let n = 0; n < N; n++) {
  L[n] = music[0][n] * 0.85 + drums[0][n] * 0.9 + sfx[0][n] + verbL[n] * 2.2;
  R[n] = music[1][n] * 0.85 + drums[1][n] * 0.9 + sfx[1][n] + verbR[n] * 2.2;
}
let peak = 0;
for (let n = 0; n < N; n++) peak = Math.max(peak, Math.abs(L[n]), Math.abs(R[n]));
const drive = 1.6;
const norm = Math.tanh(drive);
const fadeFrom = sec(TOTAL) - 1.2;
const fadeTo = sec(TOTAL);
const pcm = Buffer.alloc(N * 4);
let outPeak = 0;
for (let n = 0; n < N; n++) {
  const t = n / SR;
  const fade = t < fadeFrom ? 1 : Math.max(0, 1 - (t - fadeFrom) / (fadeTo - fadeFrom));
  const l = (Math.tanh((drive * L[n]) / peak) / norm) * 0.89 * fade;
  const r = (Math.tanh((drive * R[n]) / peak) / norm) * 0.89 * fade;
  outPeak = Math.max(outPeak, Math.abs(l), Math.abs(r));
  pcm.writeInt16LE(Math.round(l * 32767), n * 4);
  pcm.writeInt16LE(Math.round(r * 32767), n * 4 + 2);
}

const header = Buffer.alloc(44);
header.write("RIFF", 0);
header.writeUInt32LE(36 + pcm.length, 4);
header.write("WAVE", 8);
header.write("fmt ", 12);
header.writeUInt32LE(16, 16);
header.writeUInt16LE(1, 20);
header.writeUInt16LE(2, 22);
header.writeUInt32LE(SR, 24);
header.writeUInt32LE(SR * 4, 28);
header.writeUInt16LE(4, 32);
header.writeUInt16LE(16, 34);
header.write("data", 36);
header.writeUInt32LE(pcm.length, 40);

const out = path.join(import.meta.dirname, "..", "public", "soundtrack.wav");
fs.writeFileSync(out, Buffer.concat([header, pcm]));
console.log(`soundtrack: ${LEN.toFixed(1)}s, peak ${outPeak.toFixed(2)} → ${path.relative(process.cwd(), out)}`);
