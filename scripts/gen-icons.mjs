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
// App icon: the guy and a friend, chatting, on a warm macOS squircle
// (1024 canvas, 824 plate, continuous corners).

/**
 * Apple-style plate: a rounded square with smoothed ("continuous") corners,
 * straight sides. Corner math after figma-squircle (smoothing 0.6).
 */
function squircle(x, y, size, radius = size * 0.2237, smoothing = 0.6) {
  const rad = (deg) => (deg * Math.PI) / 180;
  const p = Math.min((1 + smoothing) * radius, size / 2);
  const arcMeasure = 90 * (1 - smoothing);
  const arc = Math.sin(rad(arcMeasure / 2)) * radius * Math.sqrt(2);
  const alpha = (90 - arcMeasure) / 2;
  const p3p4 = radius * Math.tan(rad(alpha / 2));
  const beta = 45 * smoothing;
  const c = p3p4 * Math.cos(rad(beta));
  const d = c * Math.tan(rad(beta));
  const b = (p - arc - c - d) / 3;
  const a = 2 * b;
  const R = radius;
  const f = (n) => n.toFixed(3);
  return [
    `M ${f(x + size - p)} ${f(y)}`,
    `c ${f(a)} 0 ${f(a + b)} 0 ${f(a + b + c)} ${f(d)}`,
    `a ${f(R)} ${f(R)} 0 0 1 ${f(arc)} ${f(arc)}`,
    `c ${f(d)} ${f(c)} ${f(d)} ${f(b + c)} ${f(d)} ${f(a + b + c)}`,
    `L ${f(x + size)} ${f(y + size - p)}`,
    `c 0 ${f(a)} 0 ${f(a + b)} ${f(-d)} ${f(a + b + c)}`,
    `a ${f(R)} ${f(R)} 0 0 1 ${f(-arc)} ${f(arc)}`,
    `c ${f(-c)} ${f(d)} ${f(-(b + c))} ${f(d)} ${f(-(a + b + c))} ${f(d)}`,
    `L ${f(x + p)} ${f(y + size)}`,
    `c ${f(-a)} 0 ${f(-(a + b))} 0 ${f(-(a + b + c))} ${f(-d)}`,
    `a ${f(R)} ${f(R)} 0 0 1 ${f(-arc)} ${f(-arc)}`,
    `c ${f(-d)} ${f(-c)} ${f(-d)} ${f(-(b + c))} ${f(-d)} ${f(-(a + b + c))}`,
    `L ${f(x)} ${f(y + p)}`,
    `c 0 ${f(-a)} 0 ${f(-(a + b))} ${f(d)} ${f(-(a + b + c))}`,
    `a ${f(R)} ${f(R)} 0 0 1 ${f(arc)} ${f(-arc)}`,
    `c ${f(c)} ${f(-d)} ${f(b + c)} ${f(-d)} ${f(a + b + c)} ${f(-d)}`,
    "Z",
  ].join(" ");
}

/** A little guy at the origin, `r` = head radius; feet hang below. */
function guyShape(r, fill) {
  const h = r * 0.82; // straight sides below the dome
  const k = r * 0.26; // bottom corner radius
  const foot = { w: r * 0.46, h: r * 0.34, gap: r * 0.16 };
  return `
    <path d="M ${-r} 0 A ${r} ${r} 0 0 1 ${r} 0 L ${r} ${h - k} Q ${r} ${h} ${r - k} ${h} L ${-r + k} ${h} Q ${-r} ${h} ${-r} ${h - k} Z" fill="${fill}"/>
    <rect x="${-foot.gap / 2 - foot.w}" y="${h - foot.h * 0.45}" width="${foot.w}" height="${foot.h}" rx="${foot.h * 0.48}" fill="${fill}"/>
    <rect x="${foot.gap / 2}" y="${h - foot.h * 0.45}" width="${foot.w}" height="${foot.h}" rx="${foot.h * 0.48}" fill="${fill}"/>`;
}

function face(r, { look = 0, blush = "#FF7F86", blushOpacity = 0.5 } = {}) {
  const ex = r * 0.36;
  const ey = -r * 0.12;
  const erx = r * 0.15;
  const ery = r * 0.21;
  const dx = look * r * 0.06;
  return `
    <ellipse cx="${-ex + dx}" cy="${ey}" rx="${erx}" ry="${ery}" fill="url(#eye)"/>
    <ellipse cx="${ex + dx}" cy="${ey}" rx="${erx}" ry="${ery}" fill="url(#eye)"/>
    <circle cx="${-ex + dx + erx * 0.35}" cy="${ey - ery * 0.38}" r="${erx * 0.36}" fill="#fff"/>
    <circle cx="${ex + dx + erx * 0.35}" cy="${ey - ery * 0.38}" r="${erx * 0.36}" fill="#fff"/>
    <circle cx="${-ex + dx - erx * 0.3}" cy="${ey + ery * 0.42}" r="${erx * 0.14}" fill="#fff" opacity="0.8"/>
    <circle cx="${ex + dx - erx * 0.3}" cy="${ey + ery * 0.42}" r="${erx * 0.14}" fill="#fff" opacity="0.8"/>
    <ellipse cx="${-r * 0.66}" cy="${r * 0.2}" rx="${r * 0.15}" ry="${r * 0.09}" fill="${blush}" opacity="${blushOpacity}"/>
    <ellipse cx="${r * 0.66}" cy="${r * 0.2}" rx="${r * 0.15}" ry="${r * 0.09}" fill="${blush}" opacity="${blushOpacity}"/>
    <path d="M ${-r * 0.15 + dx} ${r * 0.2} Q ${dx} ${r * 0.34} ${r * 0.15 + dx} ${r * 0.2}" stroke="#3A2318" stroke-width="${r * 0.07}" fill="none" stroke-linecap="round"/>`;
}

const plate = squircle(100, 100, 824);
const appIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <defs>
    <linearGradient id="bg" x1="0.15" y1="0" x2="0.85" y2="1">
      <stop offset="0" stop-color="#FFC56E"/>
      <stop offset="0.55" stop-color="#FF8F4E"/>
      <stop offset="1" stop-color="#FF5F45"/>
    </linearGradient>
    <radialGradient id="sheen" cx="0.3" cy="0.12" r="0.75">
      <stop offset="0" stop-color="#FFFFFF" stop-opacity="0.55"/>
      <stop offset="0.6" stop-color="#FFFFFF" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="vignette" cx="0.5" cy="1.05" r="0.7">
      <stop offset="0" stop-color="#C2321A" stop-opacity="0.35"/>
      <stop offset="1" stop-color="#C2321A" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="guy" cx="0.36" cy="0.25" r="0.95">
      <stop offset="0" stop-color="#FFFFFF"/>
      <stop offset="0.6" stop-color="#FFF6F0"/>
      <stop offset="1" stop-color="#F5D9CB"/>
    </radialGradient>
    <radialGradient id="pal" cx="0.36" cy="0.25" r="0.95">
      <stop offset="0" stop-color="#C9F7E2"/>
      <stop offset="0.6" stop-color="#8FE3BF"/>
      <stop offset="1" stop-color="#5BC79F"/>
    </radialGradient>
    <linearGradient id="eye" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#4A2E22"/>
      <stop offset="1" stop-color="#21130D"/>
    </linearGradient>
    <linearGradient id="bubble" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#FFFFFF"/>
      <stop offset="1" stop-color="#FFF1E8"/>
    </linearGradient>
    <clipPath id="plateClip"><path d="${plate}"/></clipPath>
    <filter id="plateShadow" x="-10%" y="-10%" width="120%" height="125%">
      <feDropShadow dx="0" dy="12" stdDeviation="16" flood-color="#000" flood-opacity="0.24"/>
    </filter>
    <filter id="lift" x="-30%" y="-30%" width="160%" height="170%">
      <feDropShadow dx="0" dy="16" stdDeviation="20" flood-color="#8A2A10" flood-opacity="0.3"/>
    </filter>
    <filter id="soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="14"/></filter>
  </defs>

  <path d="${plate}" fill="url(#bg)" filter="url(#plateShadow)"/>
  <g clip-path="url(#plateClip)">
    <rect width="1024" height="1024" fill="url(#vignette)"/>
    <rect width="1024" height="1024" fill="url(#sheen)"/>
  </g>

  <!-- contact shadows -->
  <ellipse cx="282" cy="716" rx="104" ry="16" fill="#9C2F12" opacity="0.3" filter="url(#soft)"/>
  <ellipse cx="560" cy="788" rx="176" ry="22" fill="#9C2F12" opacity="0.34" filter="url(#soft)"/>

  <!-- the friend, peeking from behind -->
  <g transform="translate(282 584)" filter="url(#lift)">
    ${guyShape(124, "url(#pal)")}
    ${face(124, { look: 1.4, blush: "#FF5C8A", blushOpacity: 0.42 })}
  </g>

  <!-- the main guy -->
  <g transform="translate(560 574)" filter="url(#lift)">
    ${guyShape(204, "url(#guy)")}
    <ellipse cx="-88" cy="-122" rx="66" ry="36" transform="rotate(-24 -88 -122)" fill="#FFFFFF" opacity="0.9"/>
    ${face(204, { look: -0.4 })}
  </g>

  <!-- chat bubble, typing -->
  <g transform="translate(712 256)" filter="url(#lift)">
    <path d="M -116 -64 h 232 a 64 64 0 0 1 64 64 v 0 a 64 64 0 0 1 -64 64 h -150 l -58 44 l 6 -46 a 64 64 0 0 1 -94 -62 v 0 a 64 64 0 0 1 64 -64 z" fill="url(#bubble)"/>
    <circle cx="-62" cy="0" r="22" fill="#FF8F4E"/>
    <circle cx="0" cy="0" r="22" fill="#FF8F4E" opacity="0.75"/>
    <circle cx="62" cy="0" r="22" fill="#FF8F4E" opacity="0.5"/>
  </g>
</svg>`;
fs.writeFileSync(path.join(iconDir, "app-icon.png"), new Resvg(appIcon).render().asPng());
fs.writeFileSync(path.join(root, "src", "ui", "guy.svg"), appIcon);
console.log("wrote src-tauri/icons/app-icon.png");
