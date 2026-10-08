import { continueRender, delayRender, staticFile } from "remotion";

// Copied from /System/Library/Fonts by scripts/fonts.mjs.
const FONTS: Array<[string, string]> = [
  ["LG Rounded", "fonts/SFRounded.ttf"],
  ["LG Pro", "fonts/SFPro.ttf"],
  ["LG Mono", "fonts/SFMono.ttf"],
];

const handle = delayRender("Loading fonts");
Promise.all(
  FONTS.map(async ([family, file]) => {
    const face = new FontFace(family, `url(${staticFile(file)})`, { weight: "1 1000" });
    document.fonts.add(await face.load());
  }),
)
  .catch((err) => console.error("font load failed", err))
  .finally(() => continueRender(handle));
