# Hummi integration

Scope: record idle and successful mix only. Existing global palette, font and
other wizard page designs are preserved.

## Changed files

- `components/Hummi.tsx`: shared image renderer; state, three sizes, alt,
  className, opt-in animation, eager first-screen loading. Reduced motion is
  always respected; the optional respectReducedMotion prop accepts only true.
- `components/Hummi.module.css`: local soft halo, subtle looping transforms,
  matching first/last poses and unconditional reduced-motion override.
- `lib/hummi.ts`: all eight asset paths, default descriptions, motion mapping.
- `components/RecordStep.tsx`: curious-listening invites a first melody, helps
  make the empty state welcoming; only shown while idle. Accessible action
  names added. Analyser stored in state and callback ref updated in effect to
  resolve pre-existing render-time ref lint errors in this touched component.
- `components/MixStep.tsx`: small dancing Hummi celebrates a real successful
  render next to the existing result heading; volume sliders shrink on mobile.
- `components/StepIndicator.tsx`: shorter connectors on narrow screens prevent
  the existing six-step indicator overflowing the home and result screens.
- `public/mascot/hummi/`: eight transparent 768px WebPs, eight high-resolution
  source PNGs, asset/prompt documentation. No complete sheet is displayed.
- `artifacts/hummi/`: four browser screenshots and verification results.

## Validation

- `npx tsc --noEmit`: passed.
- ESLint for all added/touched TS/TSX files: passed.
- `npm run build -- --webpack`: passed. Default Turbopack build was blocked by
  this environment's temporary-port permission restriction; first sandboxed
  attempt also could not fetch the project's existing Google font.
- Real browser flow: uploaded a generated four-second WAV, passed analysis,
  review, skipped chords/drums, reached successful voice-only mix on desktop
  (1440 × 1000) and mobile (390 × 844). Both screens had no document overflow.
- System reduced-motion: Hummi computed animation name was `none` on both.
- Project has no configured test suite. Full repository ESLint still reports
  three pre-existing errors (ReviewStep, WaveformEditor, WaveformVisualizer)
  and three warnings. No broad unrelated fixes were made.
- Remaining asset limitation: some high-resolution alpha edges retain minor
  flecks; repeated ImageGen cleanup did not resolve them. Current 200px/88px
  page renderings were visually inspected, but unused large poses need polish
  before further rollout.

## Screenshots

- `home-desktop.png`, `home-mobile.png`
- `ready-desktop.png`, `ready-mobile.png`

Screenshots show real app state with a synthetic test melody, not a UI mock.
