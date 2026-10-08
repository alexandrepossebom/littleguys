import React from "react";
import { AbsoluteFill, Audio, Sequence, staticFile, useCurrentFrame } from "remotion";
import { map } from "./anim";
import { C } from "./theme";
import { S, TOTAL } from "./timeline";
import { AnyGuy } from "./scenes/AnyGuy";
import { Chaos } from "./scenes/Chaos";
import { Chat } from "./scenes/Chat";
import { End } from "./scenes/End";
import { Hello } from "./scenes/Hello";
import { Moods } from "./scenes/Moods";
import { Popover } from "./scenes/Popover";
import { Routines } from "./scenes/Routines";

/** Crossfade a scene in over whatever is still playing underneath. */
function FadeIn({ frames = 20, children }: { frames?: number; children: React.ReactNode }) {
  const f = useCurrentFrame();
  return <AbsoluteFill style={{ opacity: map(f, [0, frames], [0, 1]) }}>{children}</AbsoluteFill>;
}

export function Intro({ withAudio = true }: { withAudio?: boolean }) {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: C.dark }}>
      <Sequence {...seq("chaos")}>
        <Chaos />
      </Sequence>
      <Sequence {...seq("hello")}>
        <Hello />
      </Sequence>
      <Sequence {...seq("moods")}>
        <Moods />
      </Sequence>
      <Sequence {...seq("popover")}>
        <Popover />
      </Sequence>
      <Sequence {...seq("chat")}>
        <Chat />
      </Sequence>
      <Sequence {...seq("routines")}>
        <FadeIn>
          <Routines />
        </FadeIn>
      </Sequence>
      <Sequence {...seq("anyGuy")}>
        <AnyGuy />
      </Sequence>
      <Sequence {...seq("end")}>
        <End />
      </Sequence>
      {/* last beat: fade to cream */}
      <AbsoluteFill style={{ background: C.cream, opacity: map(f, [TOTAL - 36, TOTAL - 1], [0, 1]), pointerEvents: "none" }} />
      {withAudio && <Audio src={staticFile("soundtrack.wav")} />}
    </AbsoluteFill>
  );
}

function seq(name: keyof typeof S) {
  return { from: S[name].from, durationInFrames: S[name].dur, name };
}
