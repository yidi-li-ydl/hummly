"""Export only the currently active Hummi versions for UI/UX handoff."""
from pathlib import Path
import json
import re
import shutil
import zipfile
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "exports/hummi-ui-kit"
for directory in ["animations", "sprites", "posters"]:
    (OUT / directory).mkdir(parents=True, exist_ok=True)
source = (ROOT / "lib/hummiAnimations.ts").read_text()
matches = re.findall(r'^\s*(?:"([^"]+)"|(\w+)): \{ src: "([^"]+)", duration: ([\d.]+)', source, re.M)
manifest = []
for quoted, bare, asset, duration in matches:
    state = quoted or bare
    atlas = ROOT / "public" / asset.lstrip("/")
    animated = atlas.with_name(atlas.stem + "-loop.webp")
    shutil.copy2(animated, OUT / "animations" / f"{state}.webp")
    shutil.copy2(atlas, OUT / "sprites" / f"{state}.webp")
    sources = ROOT / "artifacts/hummi/animation-sources"
    corrected = sources / f"{state}-anatomy.png"
    key_sheet = Image.open(corrected if corrected.exists() else sources / f"{state}.png").convert("RGBA")
    key_sheet.crop((0, 0, 384, 384)).save(OUT / "posters" / f"{state}.png")
    manifest.append({"state": state, "durationSeconds": float(duration), "frameSlots": 96,
                     "spriteColumns": 8, "spriteRows": 12,
                     "animatedWebP": f"animations/{state}.webp",
                     "spriteAtlas": f"sprites/{state}.webp",
                     "poster": f"posters/{state}.png", "sourceAsset": asset})
if len(manifest) != 8:
    raise RuntimeError("Expected eight active Hummi assets")
(OUT / "manifest.json").write_text(json.dumps(manifest, indent=2))
(OUT / "README.md").write_text("""# Hummi UI/UX asset kit

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
""")
archive = ROOT / "exports/hummi-ui-kit.zip"
with zipfile.ZipFile(archive, "w", zipfile.ZIP_DEFLATED) as z:
    for file in sorted(OUT.rglob("*")):
        if file.is_file():
            z.write(file, Path("hummi-ui-kit") / file.relative_to(OUT))
print(f"Saved eight current animations, sprite sheets and posters to {OUT}")
print(f"ZIP: {archive}")
