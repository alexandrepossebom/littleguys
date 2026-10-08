import React from "react";
import { Composition } from "remotion";
import "./fonts";
import { Intro } from "./Intro";
import { FPS, H, TOTAL, W } from "./timeline";

export function Root() {
  return <Composition id="Intro" component={Intro} durationInFrames={TOTAL} fps={FPS} width={W} height={H} defaultProps={{ withAudio: true }} />;
}
