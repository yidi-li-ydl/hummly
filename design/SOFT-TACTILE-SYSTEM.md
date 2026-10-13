# Hummly — Soft Tactile refinement

Approved and implemented on 13 October 2026. This is the current component system; earlier proposal snapshots are historical.

## Identity and typography

Flat graphic interface, soft tactile musical objects, original 3D HUMMI. The cream mobile canvas and 480px maximum app width remain. HUMMI has no surrounding bubble or decorative card, and uses the established renderer, poses, asset fallbacks and reduced-motion policy.

Fredoka is the display face: 44px/600 hero, 32px/600 page titles, 22px/600 section headings. DM Sans serves body, interface controls and musical data: 16px body/buttons, 12–13px supporting labels, 22px/600 chord names. Fonts are loaded through next/font and self-hosted. Labels use sentence case. The lime headline marker is reserved for the recording entry headline.

`app/design-tokens.css` owns palette, type sizes, radii, spacing and response durations. Old neon palette aliases and blanket selected-button overrides have been removed. `app/globals.css` contains the shared component and layout rules.

## Components and boundaries

- `ActionButton`: lime or dark, 56px minimum height, pill radius, DM Sans 600, restrained .98 press response.
- `SecondaryButton`: quiet, outline or neutral surface; clear hover, focus and disabled states. Upload uses the quiet outlined pill.
- `SelectionGroup`: accessible radio group with arrow/Home/End keyboard navigation; neutral inactive choices and dark/white selected choices. Used for mood, instrument, playing pattern, drum kit and meter.
- `Surface`: open, soft or active. Open content stays on cream; soft work areas use #F1EBE4 and a 24px radius; active areas alone receive an ink outline.
- `MusicalBlock`: lavender, peach, mint or pink, 12px radius, 22px DM Sans music data, separate selected/playing markers and tactile response.
- `ProgressionModule`: coherent name/notation/chord/preview/apply module. Single-chord buttons are independent of progression selection and preview controls; no nested buttons or decorative drag handles.

Chord colors follow root position relative to the detected tonic, not list order: tonic/home → lavender, fifth/dominant → peach, second/fourth/support → mint, other scale/color positions → pink. Selection uses an outline and explicit label instead of changing every chord to lime. Rhythm marks follow instrument type: kick → peach, snare → pink, hi-hat → mint; active hits also have a mark, and the audio-clock position gets an outline.

## Recording and editing

The recording waveform is an ink live signal on a neutral soft surface, with a restrained lime energy strip. The dark Stop button remains the strongest action. Reduced motion retains a quiet level meter. The analyser, captured PCM and pitch detection behavior are preserved.

Timing adjustments and precision audio editing reuse existing logic in shared soft surfaces. A labeled beat-alignment slider supplements the existing pointer alignment interaction. Cut, silence, stretch, zoom, undo, mixing, mute and WAV export controls remain available. All major actions use the shared components.

## Preview lifecycle

`hooks/useAudioPreview.ts` owns loading/playing/ended/error UI state and rejects stale callbacks. The existing synthesis and sample paths are retained in `lib/audio/mixer.ts`.

Preview requests receive a version before awaiting Tone startup or sample loading. A cancelled or superseded request cannot schedule audio later. A shared preview gain bus silences synthesized and sampled previews when stopped. Clock observation uses the same AudioContext.currentTime as sound scheduling; start, current chord/step and natural end are not inferred from promise resolution. Piano scheduling begins after its samples have loaded.

`previewChord` reuses the existing instrument path for a one-beat audition without changing the arrangement. Full-progression highlighting follows bar boundaries; its small motion follows the selected tempo. Drum preview position follows sixteenth-note audio-clock boundaries. Navigation, changing sound/filter settings and collapsing additional choices cancel previews where needed. Reduced motion suppresses the decorative pulse while keeping functional selection/playback indications.

## Verification

- Final production webpack build, TypeScript, ESLint across components/new hooks/audio changes and git diff whitespace checks passed.
- Headless Chrome verified the actual loaded Fredoka/DM Sans faces and 600 hero weight, not just font declarations.
- Entry layout passed at 320/375/390/430/768/1440px; phone recording action is visible in an 812px viewport. Chord, rhythm, mix and precision views have no page overflow.
- Radio arrow-key selection, selected-state contrast, expanded options and keyboard progression selection passed.
- Forced sample failure recovered; full progression advanced and ended on the audio clock; piano single-chord audition worked; reduced motion retained state feedback without animation.
- Delayed cold sample loading followed by navigation produced zero stale scheduled preview sources.
- Synthetic microphone recording, uploaded melody analysis, verse selection, optional chorus skip, drum preview/selection, playback, mute and RIFF WAV download passed. Invalid input and silence/retry recovery passed. No uncaught page errors.
- Screenshots are in `artifacts/design-soft-tactile/`. Development overlays are omitted from visual captures. The local regression harness is `/private/tmp/hummly-soft-tactile-regression.cjs` and requires the host's Playwright/Chrome installation.

This refinement does not introduce chord reordering or custom rhythm composition. Precision PCM operations are reused; their full numerical correctness and subjective sound quality were not exhaustively retested here. The standalone WaveformEditor retains its reset-on-new-input semantics with guarded render synchronization, resolving its pre-existing lint violation without changing the active multitrack editor.
