// Draws the little guy: menu-bar template frames (one set per mood) and the
// colorful app icon. Everything is generated from code so the sprite stays
// consistent across states.
//
//   pnpm icons         (then: pnpm tauri icon src-tauri/icons/app-icon.png)
import fs from "node:fs";
import path from "node:path";
import { Resvg } from "@resvg/resvg-js";

const root = path.join(import.meta.dirname, "..");
const trayDir = path.join(root, "src-tauri", "assets", "tray");
const iconDir = path.join(root, "src-tauri", "icons");
fs.mkdirSync(trayDir, { recursive: true });
fs.mkdirSync(iconDir, { recursive: true });

// ---------------------------------------------------------------------------
// Menu-bar sprite: 22x18pt canvas, rendered @2x. Template images only use
// alpha, so the eyes are cut out of the body with a mask.

const W = 22;
const H = 18;

/** Body silhouette: gumdrop with two feet. dy = vertical bob, feet = [left, right] lift. */
function body({ dx = 0, dy = 0, feet = [0, 0], squash = 0 } = {}) {
  const cx = 10 + dx;
  const top = 2.6 + dy + squash;
  const bottom = 14.4 + dy;
  const r = 6.2;
  const left = cx - r;
  const right = cx + r;
  const shoulder = top + r;
  const [lf, rf] = feet;
  return `
    <path d="M ${left} ${shoulder}
             A ${r} ${r - squash * 0.5} 0 0 1 ${right} ${shoulder}
             L ${right} ${bottom - 1.6}
             Q ${right} ${bottom} ${right - 1.6} ${bottom}
             L ${left + 1.6} ${bottom}
             Q ${left} ${bottom} ${left} ${bottom - 1.6} Z" fill="white"/>
    <rect x="${cx - 4.4}" y="${bottom - 0.6 - lf}" width="3" height="${2.6}" rx="1.2" fill="white"/>
    <rect x="${cx + 1.4}" y="${bottom - 0.6 - rf}" width="3" height="${2.6}" rx="1.2" fill="white"/>`;
}

/** Eye cut-outs (drawn black into the mask). */
function eyes({ dx = 0, dy = 0, look = 0, kind = "open" } = {}) {
  const cx = 10 + dx + look;
  const y = 8.6 + dy;
  const xs = [cx - 2.1, cx + 2.1];
  if (kind === "blink") {
    return xs.map((x) => `<rect x="${x - 1.1}" y="${y - 0.35}" width="2.2" height="0.8" rx="0.4" fill="black"/>`).join("");
  }
  if (kind === "sleep") {
    return xs
      .map((x) => `<path d="M ${x - 1.2} ${y - 0.2} Q ${x} ${y + 1.1} ${x + 1.2} ${y - 0.2}" stroke="black" stroke-width="0.8" fill="none" stroke-linecap="round"/>`)
      .join("");
  }
  if (kind === "happy") {
    return xs
      .map((x) => `<path d="M ${x - 1.2} ${y + 0.6} Q ${x} ${y - 1.0} ${x + 1.2} ${y + 0.6}" stroke="black" stroke-width="0.85" fill="none" stroke-linecap="round"/>`)
      .join("");
  }
  return xs.map((x) => `<ellipse cx="${x}" cy="${y}" rx="1.05" ry="1.45" fill="black"/>`).join("");
}

function sprite({ bodyOpts = {}, eyeOpts = {}, extra = "" } = {}) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W * 2}" height="${H * 2}" viewBox="0 0 ${W} ${H}">
    <defs><mask id="m" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}">
      <rect width="${W}" height="${H}" fill="black"/>
      ${body(bodyOpts)}
      ${eyes({ dx: bodyOpts.dx, dy: bodyOpts.dy, ...eyeOpts })}
    </mask></defs>
    <rect width="${W}" height="${H}" fill="black" mask="url(#m)"/>
    ${extra}
  </svg>`;
}

const arm = (angle, dy = 0) => {
  // Waving arm from the right shoulder.
  const sx = 15.6;
  const sy = 9.4 + dy;
  const len = 4.6;
  const rad = (angle * Math.PI) / 180;
  const ex = sx + Math.cos(rad) * len;
  const ey = sy - Math.sin(rad) * len;
  return `<path d="M ${sx} ${sy} L ${ex.toFixed(2)} ${ey.toFixed(2)}" stroke="black" stroke-width="1.7" stroke-linecap="round"/>
          <circle cx="${ex.toFixed(2)}" cy="${ey.toFixed(2)}" r="1.25" fill="black"/>`;
};
const bang = (dy = 0) =>
  `<rect x="19.1" y="${2 + dy}" width="1.8" height="7" rx="0.9" fill="black"/>
   <circle cx="20" cy="${11.6 + dy}" r="1.05" fill="black"/>`;
const zee = (x, y, s) =>
  `<path d="M ${x} ${y} h ${s} l ${-s} ${s} h ${s}" stroke="black" stroke-width="${0.55 + s * 0.12}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
const dots = (n) =>
  [0, 1, 2]
    .map((i) => `<circle cx="${17.4 + i * 1.9}" cy="15.6" r="0.85" fill="black" opacity="${i < n ? 1 : 0.28}"/>`)
    .join("");

const frames = {
  "idle-0": sprite(),
  "idle-1": sprite({ eyeOpts: { kind: "blink" } }),
  "idle-2": sprite({ eyeOpts: { look: 0.7 } }),
  "work-0": sprite({ bodyOpts: { dy: 0, feet: [1.1, 0] }, eyeOpts: { look: 0.6 } }),
  "work-1": sprite({ bodyOpts: { dy: -0.7, feet: [0, 0] }, eyeOpts: { look: 0.6 } }),
  "work-2": sprite({ bodyOpts: { dy: 0, feet: [0, 1.1] }, eyeOpts: { look: 0.6 } }),
  "work-3": sprite({ bodyOpts: { dy: -0.7, feet: [0, 0] }, eyeOpts: { look: 0.6 } }),
  "news-0": sprite({ eyeOpts: { kind: "happy" }, extra: arm(18) }),
  "news-1": sprite({ eyeOpts: { kind: "happy" }, extra: arm(62) }),
  "needs-0": sprite({ extra: bang(0) }),
  "needs-1": sprite({ bodyOpts: { dy: -1.1, squash: 0.3 }, extra: bang(-0.6) }),
  "off-0": sprite({ eyeOpts: { kind: "sleep" }, extra: zee(16.4, 3.6, 2.2) }),
  "off-1": sprite({ eyeOpts: { kind: "sleep" }, extra: zee(16.4, 3.6, 2.2) + zee(18.6, 0.8, 2.6) }),
  "off-2": sprite({ eyeOpts: { kind: "sleep" }, extra: zee(18.6, 0.8, 2.6) }),
  "setup-0": sprite({ extra: dots(1) }),
  "setup-1": sprite({ extra: dots(2) }),
  "setup-2": sprite({ extra: dots(3) }),
};

for (const [name, svg] of Object.entries(frames)) {
  const png = new Resvg(svg, { fitTo: { mode: "original" } }).render().asPng();
  fs.writeFileSync(path.join(trayDir, `${name}.png`), png);
}
console.log(`wrote ${Object.keys(frames).length} tray frames to ${path.relative(root, trayDir)}`);

// ---------------------------------------------------------------------------
// App icon: the guy, in color, on a warm squircle (macOS 1024 grid: 824 plate).

const appIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#FFD27A"/>
      <stop offset="1" stop-color="#FF8A5B"/>
    </linearGradient>
    <linearGradient id="guy" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#FFFFFF"/>
      <stop offset="1" stop-color="#FFF1E6"/>
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="14" stdDeviation="18" flood-color="#7A2E0E" flood-opacity="0.28"/>
    </filter>
    <filter id="plate" x="-10%" y="-10%" width="120%" height="125%">
      <feDropShadow dx="0" dy="10" stdDeviation="14" flood-color="#000" flood-opacity="0.22"/>
    </filter>
  </defs>
  <rect x="100" y="100" width="824" height="824" rx="186" fill="url(#bg)" filter="url(#plate)"/>
  <g filter="url(#shadow)" transform="translate(512 548)">
    <path d="M -230 -40 A 230 230 0 0 1 230 -40 L 230 150 Q 230 210 170 210 L -170 210 Q -230 210 -230 150 Z" fill="url(#guy)"/>
    <rect x="-150" y="190" width="110" height="80" rx="40" fill="url(#guy)"/>
    <rect x="40" y="190" width="110" height="80" rx="40" fill="url(#guy)"/>
  </g>
  <g transform="translate(512 548)">
    <ellipse cx="-78" cy="-34" rx="36" ry="50" fill="#2B1B14"/>
    <ellipse cx="78" cy="-34" rx="36" ry="50" fill="#2B1B14"/>
    <circle cx="-66" cy="-52" r="12" fill="#fff"/>
    <circle cx="90" cy="-52" r="12" fill="#fff"/>
    <ellipse cx="-150" cy="40" rx="34" ry="20" fill="#FF8A8A" opacity="0.55"/>
    <ellipse cx="150" cy="40" rx="34" ry="20" fill="#FF8A8A" opacity="0.55"/>
    <path d="M -34 40 Q 0 72 34 40" stroke="#2B1B14" stroke-width="16" fill="none" stroke-linecap="round"/>
  </g>
</svg>`;
fs.writeFileSync(path.join(iconDir, "app-icon.png"), new Resvg(appIcon).render().asPng());
fs.writeFileSync(path.join(root, "src", "ui", "guy.svg"), appIcon);
console.log("wrote src-tauri/icons/app-icon.png");
