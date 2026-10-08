// The app uses SF Pro Rounded for display type and SF Mono for code. Chrome
// can't reach the hidden system copies by name, so copy them into public/
// (gitignored) for the render.
import fs from "node:fs";
import path from "node:path";

const out = path.join(import.meta.dirname, "..", "public", "fonts");
fs.mkdirSync(out, { recursive: true });
const fonts = { "SFRounded.ttf": "SFNSRounded.ttf", "SFMono.ttf": "SFNSMono.ttf", "SFPro.ttf": "SFNS.ttf" };
for (const [dst, src] of Object.entries(fonts)) {
  const from = path.join("/System/Library/Fonts", src);
  const to = path.join(out, dst);
  if (!fs.existsSync(to)) fs.copyFileSync(from, to);
}
console.log("fonts ready");
