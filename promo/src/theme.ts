// The app's own palette (src/styles.css) and type, scaled up for 1080p.

export const C = {
  ink: "#1D1A18",
  ink2: "#5D5753",
  ink3: "#948C86",
  cream: "#FFF7F0",
  cream2: "#FFEADB",
  accent: "#FF7A45",
  accentStrong: "#F0602A",
  accentSoft: "#FFE3D4",
  mint: "#8FE3BF",
  ok: "#34C759",
  warn: "#FF9F0A",
  bad: "#FF453A",
  line: "rgba(0,0,0,0.08)",
  chip: "rgba(0,0,0,0.05)",
  bubbleThem: "#F2EFED",
  dark: "#100B09",
};

export const F = {
  display: '"LG Rounded", ui-rounded, system-ui, sans-serif',
  ui: '"LG Pro", -apple-system, system-ui, sans-serif',
  mono: '"LG Mono", ui-monospace, Menlo, monospace',
};

/** The icon plate gradient. */
export const GRAD = "linear-gradient(135deg, #FFC56E 0%, #FF8F4E 55%, #FF5F45 100%)";
export const GRAD_TEXT = "linear-gradient(100deg, #FF9A4E 0%, #FF6A45 50%, #FF4F7B 100%)";

/** Avatar ring fills, straight from src/ui/Avatar.tsx. */
export const RING = {
  working: "conic-gradient(from 0deg, #ff7a45, #ffc24b, #ff5fa2, #ff7a45)",
  unread: "linear-gradient(135deg, #ff7a45, #ff5fa2)",
  needs: "linear-gradient(135deg, #ff453a, #ff9f0a)",
  idle: "rgba(0,0,0,0.1)",
};

/** Made-up guys for the demo. None of these are real bots. */
export const GUYS = {
  pip: { name: "Pip", emoji: "🦊", hue: 24 },
  juno: { name: "Juno", emoji: "🐙", hue: 280 },
  biscuit: { name: "Biscuit", emoji: "🐻", hue: 200 },
  mochi: { name: "Mochi", emoji: "🐰", hue: 330 },
  atlas: { name: "Atlas", emoji: "🦉", hue: 150 },
};
export type GuyKey = keyof typeof GUYS;
