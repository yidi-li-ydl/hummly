# Hummi frame animations

## v3: continuous rigs and connected note

The earlier 96-slot Dance/Sunglasses version still switched limb key drawings,
which looked stepped. `scripts/rig-hummi.py` now renders 96 continuously varying
poses from isolated PNG parts: torso+note, exactly two arms, feet, and shades.
No nearest-key selection or optical-flow topology changes occur in these loops.
Solo Dance uses an uncluttered closed-eye smile; glasses keeps the side glance.
The same reference pose was edited with ImageGen into limb-free torso components;
local cleanup/part compositing is authorized by the user. Sources are retained
in `artifacts/hummi/rig-components/` and `artifacts/hummi/rig-parts/`.

Unhappy uses one physically connected character bitmap for continuous inhale,
rise and exhale, keeping its stem and both flags attached. All 96 decoded WebP
frames in all three v3 loops were checked for disconnected major components;
each had one connected component and identical first/last alpha. Timing remains
unchanged at 2.8s / 3s / 2.5s. Frame-difference measurements and junction detail
review are in `animation-sources/rig-decoded-verification.json` and
`animation-sources/unhappy-junction-review.png`.

Current files: `dancing-rig-v3.webp`, `cool-sunglasses-rig-v3.webp`,
`unhappy-rig-v3.webp` and their matching `-loop.webp` downloads. The exported
asset kit and its poster images now use these versions as well. The older
versions below are kept for reference and reproduction, not active playback.

## Smooth version

## Anatomy repair

The dancing optical-flow in-betweens distorted limbs. The glasses source poses
8–12 also retained two crossed belly arms while adding a hand at the glasses.
ImageGen produced a corrected single raised-hand pose with only one belly arm;
`scripts/repair-hummi-glasses.py` cleans it and replaces those five invalid keys.

Dancing and sunglasses now use a one-drawing affine tween instead of optical
flow: body position and size interpolate, while limb drawings switch at the
nearest verified key. This preserves two arms throughout, with a more stepped
limb motion as a deliberate tradeoff. Both retain 96 slots and original timing.
Versioned `dancing-anatomy-v2.webp` and `cool-sunglasses-anatomy-v2.webp` prevent
the browser reusing old faulty sprite files. Matching `-loop.webp` downloads
use the same corrected frame sequences. Corrected glasses PNG source is retained
in `animation-sources/cool-sunglasses-anatomy.png`.

## Interpolated versions

Active animations now have 96 frame slots on an 8 × 12 atlas with 256px cells.
Duration remains 2.5–3.5 seconds, yielding approximately 27–38 fps. Original
16-pose cleaned sources and exports remain available. The 80 new slots are
computed in-betweens, not newly hand-drawn poses.

`scripts/interpolate-hummi.py` uses bidirectional TV-L1 optical flow. Alpha is
premultiplied during warping, matching body texture can blend, and silhouettes
and facial details use one warped source to avoid double eyes and ghost hands.
AI-generated topology changes can still produce minor warping; this does not
turn the original poses into a professionally rigged 3D animation.

Active atlas files use `STATE-smooth.webp`; downloadable animated images use
`STATE-smooth-loop.webp`. Per-state timing and interpolation metadata are in
`animation-sources/interpolation.json`. A regular animated WebP may store fewer
than 96 coded frames by combining identical hold frames, preserving duration.

Each action was generated separately as sixteen row-major frames in a
four-column, four-row sprite atlas, preserving the supplied Hummi reference.
The renderer clips one cell and uses discrete CSS steps, not whole-character
rotation. Manual frame selection is available on `/hummi-preview`.

Timing: listening 3s; unhappy 2.5s; singing 3.5s; dancing 2.8s; group 3.5s;
sunglasses 3s; headphones 3s; DJ 3.5s. Sixteen poses gives approximately 5–6
frames per second, a stylized pose animation, not cinematic 24fps animation.

Initial ImageGen transparent sprite outputs had colored/white background
artifacts. The user explicitly authorized local image processing. The script
`scripts/prepare-hummi-animations.mjs` removes background noise, keeps the main
connected subject, restores small enclosed facial details and aligns frames
on consistent canvases. Cleaned atlases and animated WebPs are now enabled.

Eight draft sheets are retained in `animation-drafts/`. Cleaned PNG atlases,
dark-background contact sheets and processing metadata are retained in
`animation-sources/`. Served files are in `public/mascot/hummi/animations/`:
`STATE.webp` is a 4 × 4 sprite atlas and `STATE-loop.webp` is a downloadable
animated image. Every atlas has 16 frame slots; some poses repeat as holds.
Singing uses closed-eye poses throughout. A broken DJ jump cell was replaced
with a raised-hand pose and a small body lift with the turntable held fixed.
Every terminal frame is identical to the first, avoiding a hard loop cut.

The renderer and controls pass TypeScript, scoped ESLint and Webpack production
build. Real-browser desktop and 390px mobile checks verified all eight atlases
load, continuous animation advances, manual next-frame changes the displayed
cell, reduced-motion switches to static images, and pages do not overflow.
The home/upload-to-mix flow also passed. Screenshots:
`animations-desktop.png`, `animations-mobile.png`; updated home/result shots.

The renderer falls back to the established static image when a
sprite is unavailable. System reduced-motion also uses the static image;
manual stepping remains available because it does not create ongoing motion.

This is a usable first frame-animation version, not a polished 24fps production
character rig. Minor pose/texture variation remains between AI-generated frames;
fine pupil direction, precise flag lag, and DJ scratching can be refined later.
No frame interpolation or crossfading is presented as new animation frames.

## Cool Sunglasses v4

Replaced reconstructed hands, forearms and duplicated feet with the intact
reference pose. All 96 frames preserve the original crossed arms and feet,
using only a restrained whole-character groove. The lowering-shades gesture
is withdrawn from this version; gallery copy and the export kit match this.
