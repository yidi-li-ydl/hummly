# First design milestone

Implemented 13 October 2026 using the approved Electric Playground × Friendly Magic proposal and UI UX Pro Max guidance.

## Delivered

- Cream/ink/electric-violet theme, lime and coral musical accents, Bricolage Grotesque headlines and existing Inter body typography.
- Responsive brand shell and Hum → Transform → Play → Create progress. The existing six internal stages remain intact for this milestone.
- A clear Start humming action, secondary upload, permission-pending state, guarded capture start, real analyser-driven waveform and elapsed time. Existing HUMMI identity and assets retained.
- Captured waveform, extracted notes and suggested chords rendered from actual musical data during analysis. Removed six fixed 400 ms waits; processing yields paint opportunities and ignores cancelled runs.
- Three initial chord/beat suggestions with all existing choices accessible through More ideas; native selection buttons and separate labeled preview controls.
- Instruments, drum sounds and timing adjustments disclosed on demand. Meter and tempo remain adjustable. Real drum hit positions represented visually.
- Playback ahead of the precision waveform editor; original selection/cut/silence/stretch/undo controls remain available through Fine-tune audio. Volume and mute controls labeled; track headers keyboard reachable.
- Analysis failure retains captured audio and supports retry. Render retry retains melody/selections. WAV export gets pending/error feedback. Brief HUMMI celebration and shared reduced-motion policy.

## Verification

- Production build, TypeScript and ESLint for every changed TS/TSX file passed. `git diff --check` passed.
- Chrome browser checks: entry at 375/768/1024/1440 px; mobile chord, drum, mix and precision views without document overflow; expanded choices and keyboard chord selection.
- Synthetic WAV upload through analysis, verse selection, optional chorus skip, beat selection, playable mix and RIFF WAV download (1,764,044 bytes for the test arrangement).
- Synthetic microphone capture produced pitch readings and a responsive live canvas; manual stop and the existing 30-second automatic stop reached review.
- Reduced motion removed mascot sprite playback, retaining static assets and functional recording feedback.
- Silence and retry, invalid file, microphone denial, and simulated sample-loading failure followed by successful render retry exercised. No uncaught page errors in the completed browser checks.
- Screenshots in `artifacts/design-first-pass/` were visually reviewed. Temporary browser harness and synthetic audio live under `/private/tmp/`; no new testing dependency was installed.

This verifies the main flow and newly changed interaction paths. It does not establish subjective sound quality, physical microphone behavior on all devices, or exhaustive coverage of the existing precision audio operations. Browser automation used headless Chrome because the in-app Browser bridge was unavailable.

## Next milestone

Consolidate review/chord/drum/mix into a persistent Play workspace with reversible, combined auditions and a unified transport. Later, add real chord reordering/custom rhythm editing with undo and protection for manually edited PCM. Those interactions are not implemented by this first visual milestone; chord blocks currently visualize selectable progressions.

## Updated direction — mobile app and restrained palette

User refinements on 13 October supersede the initial cream/violet/lime/coral palette:

- Use lavender `#E9DEFF`, electric lime `#DFFF72`, and deep ink `#241B35` as the three UI color families. HUMMI keeps the original character artwork.
- Lavender is the continuous page canvas; lime emphasizes primary actions, selected controls and musical blocks. Remove surrounding cards and decorative borders.
- Remove HUMMI’s circular backdrop, enclosing panel and renderer glow. The transparent character stands freely on the page.
- Mobile-first single-column layout, maximum 480 px app width on desktop; safe-area viewport support and 44+ px interactive controls.
- Checked 320/375/390/430 px phone widths and 768/1440 px desktop widths; no horizontal overflow and the recording action remains visible in an 812 px viewport.
- Browser checks passed for microphone capture, upload, chord/beat selection, playback, export, reduced motion and recovery. New screenshots are in `artifacts/design-app/`; development overlays are excluded from design screenshots.

## Current direction — Warm Cream + Electric Lime

Approved refinement supersedes the full-lavender canvas.

- Exact primary tokens: warm cream `#FFF9F0`, purple-black `#241B32`, electric lime `#D8FF65`, and soft lavender `#E9DDFF`. Peach/coral are small supporting accents.
- Hum: cream surrounds the free-standing original HUMMI. Lime reinforces the main recording action and a restrained headline marker; recording uses a lime waveform on an ink strip with a coral status dot.
- Transform: HUMMI remains outside a concentrated ink audio stage; captured waveform/notes use lime, with lavender supporting notes/chords. Existing real-state progression and cancellation remain unchanged.
- Play: open cream workspace, lavender chord blocks, lime selected progression with an explicit selection label, and coral rhythm hit patterns. Secondary choices stay quiet.
- Create: ink playback button with lime symbol, neutral volume rails and lime handles, lime WAV export. Expanded precision editing uses a dark audio surface, lavender waveforms and lime selection/playhead.
- No enclosing mascot bubble, new screens, additional card borders, or changes to audio processing. The same app-width layout is retained.
- TypeScript, scoped ESLint, production webpack build, and browser regression checks passed. Phone widths 320/375/390/430 px and desktop 768/1440 px fit; microphone capture, audio upload, chord/beat selection, playback, RIFF WAV export, reduced motion, and error recovery passed without uncaught page errors.
- Visually reviewed previews are saved under `artifacts/design-warm-cream/`. Production build used webpack because local Turbopack worker startup hit an environment permission error.

## Current component refinement

The approved Fredoka + DM Sans and Soft Tactile implementation now supersedes the previous typography and component styling. See `design/SOFT-TACTILE-SYSTEM.md` for the current tokens, reusable components, boundaries, preview lifecycle and validation record. New screenshots are in `artifacts/design-soft-tactile/`.
