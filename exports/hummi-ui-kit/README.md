# Hummi UI/UX asset kit

Eight current, transparent mascot animations. This handoff includes the repaired
Solo Dance and Cool Sunglasses versions, with older faulty exports excluded.

- `animations/`: playable, looping animated WebP files.
- `posters/`: transparent 384px PNG stills for static design compositions.
- `sprites/`: 96-slot WebP atlases for the app's controlled animation renderer.
  Grid: 8 columns × 12 rows; each cell is 256 × 256px. Read left-to-right,
  then top-to-bottom. The full sheet should never be shown as a UI illustration.
- `manifest.json`: timing, file mapping, grid geometry and original version paths.

Hummi is a little hum brought to life.
Every hum deserves to become something.

Keep one short stem and two rounded flags on solo characters. Group Dance has
four straight stems and two connected shared beams, with no individual flags.
Preserve apricot plush material, cream face/belly, bead eyes and pink cheeks.
Leave room around the character; respect Reduce Motion; avoid multiple large
characters on a production screen. The gallery is an asset review exception.

These are working app animation assets. Most use motion interpolation from
16 key poses. Dance and Sunglasses use a conservative affine tween to preserve
two-arm anatomy; their limb poses may appear more stepped. Minor variation
remains between generated drawings. They are not rigged 3D or Lottie assets.

High-quality cleaned keyframe PNG sheets remain in the project at
`artifacts/hummi/animation-sources/`. The reusable renderer is
`components/Hummi.tsx`; active version mapping is `lib/hummiAnimations.ts`.

Rebuild this kit with:
`/opt/anaconda3/bin/python scripts/export-hummi-kit.py`
