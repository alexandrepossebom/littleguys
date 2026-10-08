# littleguys promo

A ~51s motion-design intro for littleguys, built with [Remotion](https://remotion.dev) (React → MP4) at 1920×1080, 60 fps.

```bash
pnpm install
pnpm studio      # live preview + scrubbing
pnpm render      # → out/master.mp4 (CRF 16) + out/littleguys-intro.mp4 (web)
node scripts/stills.mjs 600 1300 2900   # quick half-size frames → out/stills/
```

`pnpm prep` (run by studio/render) copies SF Pro, SF Pro Rounded and SF Mono from `/System/Library/Fonts` into `public/fonts/` and synthesizes `public/soundtrack.wav`. Both are gitignored.

## How it's put together

- `src/timeline.ts` is the single clock: scene start frames, key moments, and the sound-effect cue list. 120 bpm at 60 fps, so a beat is 30 frames and a bar is 120.
- `scripts/soundtrack.mjs` builds the music (pad, mallet arps, bass, drums, sidechain pump, reverb) and every pop/click/whoosh from that same timeline, so retiming a scene moves its sounds too. No samples: everything is synthesized.
- `src/ui/` holds the mascot (`Guy`, same geometry as `scripts/gen-icons.mjs`), the live menu-bar `Sprite` with all five moods, the animated `AppIcon`, and small UI kit pieces.
- `src/scenes/` holds one file per scene: Chaos → Hello → Moods → Popover → Chat → Routines → AnyGuy → End.

All guys, gateways, chats and routines are made up (Pip, Juno, Biscuit, Mochi, Atlas; "studio", "homelab").
