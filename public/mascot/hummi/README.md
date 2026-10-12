# Hummi assets

Hummi is a little hum brought to life. Every hum deserves to become something.

Eight transparent WebP assets are served by the app. High quality PNG originals
are retained in `sources/`. WebP canvases are 768 × 768, with added transparent
motion space. No base64 images or reference sheets are served in the UI.

Generated with the built-in ImageGen tool using the supplied reference:
`sixteenth-note-mascot-action-expression-sheet-v2.png`.

Prompt specification for each separate asset:
Extract/reproduce only the corresponding reference pose (curious-listening,
unhappy, singing, dancing, group-dance, cool-sunglasses, headphones, dj).
Preserve cream-apricot short plush material, pale cream face/belly, bead eyes,
pink cheeks, tiny limbs, proportions and pose. Solo poses have one short stem
and two rounded flags. Group pose has four straight stems and two shared beams,
without individual flags. Actual transparent background; no text, labels,
floor shadow or outline; centered complete subject with motion margin.

Identity-preserving cleanup passes were attempted for dancing and DJ. They did
not improve the high-resolution alpha edge enough to replace the originals.
Some source assets retain minor matte/colored flecks at large magnification;
review these before using the currently unused poses as large illustrations.

## Integration

`lib/hummi.ts` owns state-to-asset and default alt mappings.
`components/Hummi.tsx` owns rendering so a future animation renderer can replace
the image without changing page consumers. All motion is opt-in, always stops
under `prefers-reduced-motion: reduce`, and loops with matching endpoints.

Only the record idle state (curious-listening) and successful mix state
(dancing) use Hummi in this iteration. Other states are prepared, not enabled.

## Frame animations

`animations/` contains 16-slot transparent sprite atlases and downloadable
animated WebPs. All eight can be reviewed at `/hummi-preview`; the existing
record and successful-mix integrations now use these atlases when animated.
`lib/hummiAnimations.ts` owns their paths and loop durations. Motion preferences
disable ongoing frame playback; manual stepping remains available for review.
After explicit user authorization, local cleanup and frame alignment were done
by `scripts/prepare-hummi-animations.mjs`. High-quality cleaned PNG atlases and
the detailed QA record are in `artifacts/hummi/animation-sources/` and
`artifacts/hummi/ANIMATION-NOTES.md`.
