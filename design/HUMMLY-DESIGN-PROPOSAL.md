# Hummly — Electric Playground × Friendly Magic

Design proposal, 13 October 2026. No application code changed.

## Recommendation

Make Hummly a warm, expressive music playground built around one continuous creation surface. Use cream, ink, electric violet, lime, and coral; preserve the peach plush HUMMI; make the user's melody the visual material that carries them from recording into an editable arrangement.

The recognizable brand gesture is a **melody ribbon**: a rounded line that listens, resolves into notes, and settles alongside chord blocks and rhythm marks. Its appearance comes from the user's audio and musical data. HUMMI accompanies the transformation without becoming the interface itself.

## Inspection and evidence

Reviewed the Next.js/React/Tailwind project, the reducer and all six creation stages, the recording and waveform components, chord/drum preview handlers, multitrack editing, mixing/export, HUMMI's renderer, asset mappings, source images, and animation QA notes. Visually inspected all seven supplied reference images, HUMMI's source listening pose, and stored desktop/mobile screenshots of recording entry and the finished mix.

The local development server started successfully. The Browser runtime failed with a native bridge trust error; screenshots reviewed here are existing repository artifacts, not fresh captures. This is a source and visual design audit, not a newly executed end-to-end audio test.

Applied `.codex/skills/ui-ux-pro-max/SKILL.md`: generated its required design-system recommendation and searched animation/accessibility and React guidelines. Its vibrant block-based direction is useful. Its marketing-page structure, generic dark-audio palette, and Fredoka/Nunito pairing are not adopted: the brief calls for a focused creation tool with a more grown-up personality. Product-specific choices below take precedence.

## Current experience audit

| Area | Observed behavior | Proposed improvement |
| --- | --- | --- |
| Brand | Near-black surfaces, purple/cyan/pink gradient title, persistent neon glow | Solid color identity, warm canvas, selective electric contrast, tactile edges |
| Entry | HUMMI and repeated introductory copy; equal-sized record and upload circles | One expressive headline, a labeled primary record action, quiet upload alternative |
| Journey | Record → Analyze → Review → Chords → Drums → Mix; six small labels | Hum → Transform → Play → Create as the mental model; retain underlying capabilities |
| Recording | Real analyser waveform and pitch tracking; mascot disappears while recording; note name prominent | HUMMI listens beside the waveform; time and Stop lead; note names become optional detail |
| Processing | Generic spinner and six technical stages; fixed 400 ms delays before each local task | Data-driven transformation with honest stage completion; remove artificial waiting |
| Review | Key, BPM, meter, alignment and click-track preview exposed before arranging | Keep detected settings, offer listening immediately, disclose timing adjustments on demand |
| Chords | Clickable progression cards, filters, instrument and pattern controls, A/B selection | Audition before committing; chord blocks within a selected progression; preserve verse/chorus options |
| Rhythm | Kit buttons and style cards; selecting a style immediately moves to mix | Select and hear the groove in place; show its actual hit pattern; explicit continue/export action |
| Mix | Precise waveform tools and three waveform lanes precede large playback button | Immediate playback and musical layers first; precision editor in expandable panel |
| Errors | Analysis error returns to Record; render error offers Start Over and shows technical detail | Preserve the recording and edits, contextual retry, encouraging copy, details behind disclosure |
| Accessibility | Some card interactions use clickable divs; icon buttons and some controls lack explicit labels; global pulse/spinner motion lacks a shared reduced-motion rule | Semantic controls, keyboard alternatives, labeled inputs, stable focus, shared motion policy |

There is useful functionality to preserve: raw PCM recording, audio upload, key/tempo detection, beat alignment and meter changes, chord instruments and patterns, A/B progressions, drum kits and previews, track levels/mutes, cut/silence/stretch/undo, playback and WAV download. Exposed UI and audio-library capabilities should be inventoried separately; a type or helper alone does not prove a working user-facing feature.

## What the references contribute

**pillowtalk:** Oversized organic graphics, confident lime/ink contrast, conversational prompts, and a strong action hierarchy. Borrow its visual confidence and expressive scale. Hummly's organic forms should come from melody and rhythm rather than reproducing pillowtalk's graphic motifs or navigation.

**Ahead:** An emotionally reassuring character, broad areas of solid color, generous space, and one small decision at a time. Borrow the timing of reassurance and restraint around HUMMI. Keep Hummly energetic enough for creative play.

**(Not Boring) Vibes:** Large editorial typography, objects that feel tangible, compact expressive choices, and a clear play control. Borrow its sense of sound becoming a physical object. Avoid copying its condensed typography, environmental gradients, or 3D icons.

The supplied references are largely introductory and selection screens. Editing proposals are adaptations to Hummly's functionality, not claims about those apps' editors.

## Design system

### Palette

| Token | Value | Intended role |
| --- | --- | --- |
| Cream | `#FFF7ED` | Main canvas; warmth without tinting HUMMI |
| Ink | `#241B35` | Headlines, body text, outlines |
| Electric violet | `#6038E8` | Primary actions and selected controls; cream labels |
| Lime | `#DFFF72` | Creative accents, play/export emphasis; ink labels |
| Coral | `#FF806E` | Rhythm elements and recording surface; ink labels |
| Lavender | `#E9DEFF` | Chord work area and secondary selections |
| Peach | `#FFD7B5` | Supporting warmth; original HUMMI colors preserved |
| Muted ink | `#665B73` | Supporting copy on cream |

Use cream as the stable workspace and bold color in meaningful objects. Keep waveform contrast strong with an ink inset where helpful. Avoid a different full-screen color at every step. Color identifies layers, while labels, patterns and selection markers also communicate meaning. Validate final text, control and focus contrast before implementation is accepted.

### Typography

Proposed pairing: **Bricolage Grotesque** for expressive headlines and **Inter** for controls/body, subject to checking available font files. Keep the existing Inter integration as the starting point.

Headline sizes: 44–64 px desktop, 32–40 px mobile, with tight but legible line spacing. Body: 16–18 px; controls: 14–16 px; supporting labels generally at least 12 px. Use tabular figures for time and tempo. Avoid all-caps paragraphs, distorted letters, and novelty body fonts. Expressiveness belongs in a few high-value phrases.

### Shapes and layout

Use note-head pills, broad rounded stage surfaces, chord blocks with subtly varied corners, and rhythm dots. Restrict stars and decorative marks to transitions or one focal composition. Keep controls aligned even when the illustration is asymmetrical.

Adopt an 8 px spacing rhythm with 4 px refinements; 24–32 px gaps between working groups; generous outer space. Major surface radii around 28–40 px, small musical objects around 12–20 px, pill controls fully rounded. Use restrained 1–2 px ink outlines and short solid shadows for manipulable objects. Never rotate labels or shrink touch targets to achieve playfulness.

Desktop: approximately 1040–1120 px maximum workspace, with a large musical stage and a smaller contextual control area. Mobile: one column with a compact stage and bottom transport; reserve space for transport and safe-area insets so it cannot cover content. Keep complete control access at 375 px width and at 200% zoom.

### Components

- **Primary action:** Visible verb, consistent position, generous target; “Start humming,” “Stop & hear it,” or “Download WAV.” Upload remains a labeled secondary action.
- **Recording stage:** HUMMI, audio-reactive ribbon, elapsed time, clear active recording label, prominent Stop. Show the existing 30-second limit before recording.
- **Transport:** One coherent playback/status control shared across musical editing. Prevent simultaneous chord/drum previews.
- **Chord blocks:** Chord symbol plus accessible full name, selected marker, preview state; grouped into labeled progressions and optional verse/chorus sections.
- **Rhythm tiles:** Real kick/snare/hi-hat marks, labeled style, kit and preview. Empty hits and active hits differ by shape/mark as well as color.
- **Style choices:** A small set of named musical starting points built from supported instrument/pattern/kit combinations. Explain what changes; avoid implying a new generative model.
- **Details disclosure:** Timing, meter, alignment, instrument/pattern refinements and precision waveform editor. Remains keyboard reachable and remembers edits.
- **Recovery message:** Plain-language explanation plus a relevant retry action. Technical diagnostics are optional details.

### Motion

Press response: 100–160 ms with a small inward translation inside reserved bounds. Selection change: 180–240 ms. Stage transition: approximately 240–360 ms. Musical pulses follow actual playback tempo. One main moving region at a time; avoid permanent glow and simultaneous decorative loops.

Reduced motion: static HUMMI, immediate arrangement changes or restrained fades, no bouncing/rearrangement/confetti. Recording still communicates amplitude with a simple level meter and text. Playback status remains explicit. Announce important stages in a polite live region, never every pitch reading.

## HUMMI integration

Existing assets are in `public/mascot/hummi/`, with PNG originals in `sources/` and animated atlases in `animations/`. `lib/hummi.ts` maps eight poses; `lib/hummiAnimations.ts` selects current atlas versions; `components/Hummi.tsx` already centralizes rendering, static fallback and reduced-motion behavior. Preserve this path.

Identity lock: cream-apricot plush texture, cream face/belly, bead eyes, pink cheeks, tiny limbs, short connected stem and two rounded flags. Do not recolor the character to match UI states, replace it with vector art, or distort its anatomy with pitch-driven transforms.

| Moment | Existing pose | Meaning and restraint |
| --- | --- | --- |
| Idle | curious-listening | Medium/large inviting companion; gentle optional breathing |
| Recording | curious-listening or singing | Smaller companion beside live ribbon; restrained amplitude response |
| Transforming | singing | Brief accompaniment while musical elements resolve |
| Editing | headphones; DJ only in rhythm context | Small contextual helper when first opening a tool or needing guidance; otherwise absent |
| Ready | dancing | Brief celebration only after a playable buffer is ready |
| Recovery | curious-listening, or subtle unhappy pose after QA | Encouraging retry; never imply the user's singing disappointed HUMMI |

Existing animated poses are not independently rigged facial/body controls. Audio reactivity should first modulate a bounded container/adjacent meter, rather than promising lip-sync or anatomically independent pitch gestures. Keep atlas playback optional. Review large-pose alpha edges, the active v3/v4 paths, texture variation and decoded memory cost before expanding usage. QA notes contain historical versions; the current mapping is authoritative.

## Redesigned core journey

### Hum

Small Hummly wordmark and compact journey context. Main headline: **“Got a tune in your head?”** Supporting sentence: “Hum a little. Let's see where it goes.” HUMMI occupies one side of a broad lavender/cream stage, with a quiet melody ribbon nearby. Primary action: **Start humming**. Secondary: **Upload audio**. One supporting line explains the 30-second recording limit.

After microphone permission resolves, the stage becomes a listening surface: **“I'm listening.”** The ribbon reflects real voice energy; time and recording status remain clear. Note labels are optional. Stop reads **“Stop & hear it.”** Do not add onboarding, required style selection, or setup before the first hum.

### Transform

Keep the same stage and recorded melody material. The captured ribbon resolves into note objects when note quantization succeeds. Their pitch positions and widths reflect note pitch and duration. Chord objects appear after progression generation completes; rhythm patterns appear after preparation completes. HUMMI stays peripheral.

User-facing stage language: “Finding your melody,” “Finding its feel,” and “Bringing it together.” Specific technical detail remains available. No fabricated percentage or fixed-duration magic sequence. Fast analysis may resolve nearly instantly; rendering and sample loading remain visibly pending until complete.

If an initial arrangement is introduced, select an explicitly labeled, reversible suggested chord progression and meter-compatible groove. This changes the current manual-selection behavior and belongs in the later journey phase. First milestone can preserve existing selections while delivering the truthful transformation.

### Play

Enter one persistent workspace. Lead with **“Your hum has possibilities.”**, audible playback, and three musical layers: **Your hum / Chords / Beat**. Present a few supported suggestions first; keep all current choices available through “More.”

Selecting a chord progression updates the selected musical blocks without advancing screens. Preview starts from a clear user gesture, with visible loading/play/error feedback. Audition melody and accompaniment together where the audio engine supports it; current chord previews are standalone, so combined audition needs implementation.

Tapping a block can audition it. Reordering blocks can alter the progression only when the canonical chord order and renderer are connected; merely moving pixels is not a shipped interaction. Provide Move left/right alternatives and Undo. Keep current A/B progressions under **Add a chorus**.

Rhythm begins with real pattern tiles that can be auditioned and selected. A later **Make it yours** disclosure can enable hit toggling; this needs custom-pattern state and validation because the current interface selects preset `DrumStyle` objects. Preserve meter compatibility and instrument mapping.

Timing controls move into **Adjust timing**: BPM, beats per bar, alignment and voice/click preview. Precision PCM tools remain under **Fine-tune audio**: waveform selection, cut, silence, stretch, zoom and undo. Treat symbolic chord editing and rendered-waveform edits as separate layers so changing a style cannot silently destroy manual audio edits.

### Create

Export lives in the same workspace; no extra completion screen is required. A ready message and a short HUMMI celebration follow successful rendering. **Download WAV** is enabled only for the latest rendered arrangement. Keep playback available and offer “Keep playing” or secondary “New hum.”

The present product creates a demo arrangement. Use “Your demo is ready” until product capabilities warrant describing it as a fully produced song. No unsupported save/library/share promises.

## Technical approach

1. **Preserve the audio domain.** Retain PCM, pitch readings, quantized notes, key/tempo/alignment detection, chord/drum data and mixing helpers. Begin with theme/components before altering orchestration. Follow repository Next.js guidance before writing application code.
2. **Separate musical state from presentation.** Keep `StepWizard`'s reducer as the migration anchor, then introduce a persistent arrangement state so review/chord/drum/mix controls can coexist. Map existing stages to the four user-facing phases initially. Retain compatible meter filtering and optional accompaniment.
3. **Use real processing events.** Emit started/completed/failed events around actual analysis tasks. Carry note data and recorded waveform across the transition. Yield between tasks so status can paint; move heavier work to a worker only if profiling warrants it. Add cancellation and stale-run protection. Removing all delays without yielding could hide every intermediate state through batching.
4. **Make capture reactive without React updates every frame.** Read the existing `AnalyserNode` in a frame loop for waveform/energy. Smooth RMS energy and clamp visual response. Use pitch clarity thresholds before reflecting pitch movement. Keep continuous visuals in canvas/refs or CSS variables; publish only coarse UI state to React. Cancel loops and release microphones/audio contexts on cleanup.
5. **Separate analysis from rendering.** Current processing is local musical analysis, not a remote AI request. Mixer previews/rendering load samples separately. Track analysis, sample loading, rendering and playback independently. If remote generation arrives later, connect it to actual job events rather than simulating progress.
6. **Share playback and edit lifecycle.** Reuse existing synth/sample paths behind one preview coordinator. Give operations a version id so slower previews/renders cannot overwrite newer edits. Stop prior preview on selection changes. Keep latest playable output during refresh where appropriate, clearly label it, and disable export until the current version succeeds. Move precise volume/mute feedback through live gain nodes when feasible; rerender/export from the same values.
7. **Protect edits and recovery.** Keep immutable source PCM plus edit history. Retain capture after analysis failure and valid arrangement after render failure. Offer Retry analysis/Retry render rather than forcing Reset. Changing chord/beat definitions after PCM edits needs an explicit keep/discard decision or separate source/edit composition.
8. **Accessible interaction.** Semantic buttons/radio groups, labeled sliders, clear focus and selected states, keyboard move actions, non-drag alternatives, 44–48 px interactive targets, color-independent indicators. Extend HUMMI's existing reduced-motion policy to all global effects and waveform transformations.

Likely application touchpoints: `app/page.tsx`, `app/globals.css`, `app/layout.tsx`; `StepWizard`, `StepIndicator`, `RecordStep`, `ProcessingStep`, `ReviewStep`, `ChordStep`, `DrumStep`, `MixStep`; `Hummi`, `WaveformVisualizer`, and the existing precision editor. Introduce shared musical-stage, transport, chord-block, rhythm-pattern, disclosure and recovery components as the design becomes concrete. No animation library is required for the first version.

## Prioritized implementation roadmap

| Priority | Deliverable | Why now | Acceptance |
| --- | --- | --- | --- |
| P0 | Inventory exposed features and capture a fresh baseline flow | Protect working music behavior | Record/upload through WAV export; optional accompaniment; meter/timing and edit tools documented |
| P1 | Tokens, typography, shared controls, entry/recording redesign | Establish recognizable identity with limited orchestration risk | One obvious record action; upload retained; responsive and keyboard accessible; HUMMI identity intact |
| P1 | Real-state transformation, recording feedback, contextual recovery | Delivers signature magic and trust | No fabricated waiting/progress; fast and slow paths work; silence/permission/decode errors recover |
| P2 | Persistent Play workspace, unified transport, suggested arrangement | Largest reduction in cognitive load | Hear an arrangement without compulsory configuration; all prior choices remain accessible; selections reversible |
| P2 | Timing/precision disclosures and export lifecycle | Keep beginner simplicity and existing depth | BPM/meter/alignment, PCM operations, mute/levels and latest-version WAV export preserved |
| P3 | Chord rearrangement, custom beat toggles, curated style combinations | Adds meaningful direct manipulation | Musical data and playback change together; Undo and keyboard alternatives; edited audio protected |
| P3 | Motion polish and broader mascot QA | Refine delight once core behavior is stable | Short celebrations, bounded audio response, valid atlas fallbacks, reduced motion and resource limits |

Validate each milestone at 375, 768, 1024 and 1440 px, keyboard-only and 200% zoom, with reduced motion. Exercise microphone rejection, silence/no pitch, invalid upload, sample failure, interrupted previews, rapid selection changes, stale render completion, chorus choices, meter changes, optional tracks, precision edits and export. Use type/lint/build checks appropriate to changed code plus focused browser/audio regression checks; do not treat visual snapshots alone as proof of musical correctness.

Success criteria: a first-time user can identify how to start, hear an arrangement without understanding music theory, change one musical element and hear its effect, recover from failure without losing the hum, and export the current version. Measure time to first playable demo and abandonments across transitions against the baseline. Delight should be evaluated through observed use, not inferred from animation quantity.
