# Hummi UI/UX asset kit

Eight current, transparent mascot animations. This handoff includes the v3
Solo Dance and Unhappy fixes plus the v4 Cool Sunglasses revision, with older exports excluded.

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

These are working app animation assets. Five use motion interpolation from
16 key poses. Dance uses a continuous 2D part rig. Sunglasses preserves the complete
reference pose, including its crossed arms and feet, with a gentle groove;
it does not perform the earlier lowering-shades gesture. Unhappy keeps the note and body
in one connected bitmap throughout its breathing motion. Layer PNGs and rig
posters are retained in `artifacts/hummi/rig-parts/`, and the generating script
is `scripts/rig-hummi.py`. These are not 3D model or Lottie files.

High-quality cleaned keyframe PNG sheets remain in the project at
`artifacts/hummi/animation-sources/`. The reusable renderer is
`components/Hummi.tsx`; active version mapping is `lib/hummiAnimations.ts`.

Rebuild this kit with:
`/opt/anaconda3/bin/python scripts/export-hummi-kit.py`
