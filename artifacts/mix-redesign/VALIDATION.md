# Mix redesign validation

- Existing rendering, instrument generation, EQ and Rubber Band stretch algorithms reused.
- One shared Web Audio transport controls both views; real source offsets implement pause/resume and seek.
- Editor remains mounted across view changes, preserving selection, zoom, horizontal scroll and undo.
- Playback and WAV export use the current rendered/edited buffers and the same track gains.
- Browser checks with real Web Audio: play/pause/resume/seek, view navigation, volume/mute restore, selection gating, Cut/Silence/Stretch/Undo, persistent zoom/history, missing drums, reduced motion and Start over confirmation.
- Downloaded WAV inspected: editing chords to silence produces zero samples in the edited region, including after a subsequent voice edit; all-muted export is exactly silent.
- Screenshots checked at 375px, 393px and desktop widths; no page horizontal overflow.

The browser fixture used a generated hum, existing chord/drum generation and instrument samples. It is temporary and is not shipped as an application route.
- Touch emulation at 375px: drag selection works and swiping the ruler scrolls the shared waveform viewport.
- Actual seek verified at 3 seconds, continuous playback verified across view navigation, and natural song end resets transport to the start.
- TypeScript, ESLint on changed components, and production `next build --webpack` all passed.
