// Render a handful of frames to out/stills for a quick look:
//   node scripts/stills.mjs 150 400 900
import path from "node:path";
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";

const root = path.join(import.meta.dirname, "..");
const frames = process.argv.slice(2).map(Number);
const serveUrl = await bundle({ entryPoint: path.join(root, "src/index.ts") });
const inputProps = { withAudio: false };
const composition = await selectComposition({ serveUrl, id: "Intro", inputProps });
for (const frame of frames) {
  const output = path.join(root, "out/stills", `f${String(frame).padStart(4, "0")}.png`);
  await renderStill({ serveUrl, composition, frame, output, inputProps, scale: 0.5 });
  console.log(output);
}
