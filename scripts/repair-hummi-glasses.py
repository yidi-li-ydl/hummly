"""Replace anatomically invalid glasses poses using the corrected ImageGen pose."""
from pathlib import Path
import numpy as np
from PIL import Image
from scipy.ndimage import label, binary_fill_holes

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "artifacts/hummi/animation-sources"
pose = Image.open(ROOT / "artifacts/hummi/anatomy-repair/glasses-two-arms.png").convert("RGBA")
rgba = np.asarray(pose).copy()
r, g, b, alpha = [rgba[:, :, i].astype(np.int16) for i in range(4)]
white = (r > 244) & (g > 244) & (b > 244) & ((np.maximum(r, np.maximum(g, b)) - np.minimum(r, np.minimum(g, b))) < 8)
yellow = (r > 195) & (g > 185) & (b < 100)
red = (r > 190) & (g < 100) & (b < 100)
components, count = label((alpha > 8) & ~white & ~yellow & ~red)
areas = np.bincount(components.ravel()); areas[0] = 0
keep = components == areas.argmax()
# Preserve highlights/mouth inside the connected character, not exterior noise.
keep = binary_fill_holes(keep)
rgba[:, :, 3][~keep] = 0
pose = Image.fromarray(rgba).crop(Image.fromarray(np.uint8(keep) * 255).getbbox())
scale = min(307 / pose.width, 307 / pose.height)
pose = pose.resize((round(pose.width * scale), round(pose.height * scale)), Image.Resampling.LANCZOS)
tile = Image.new("RGBA", (384, 384))
tile.alpha_composite(pose, ((384 - pose.width) // 2, round(384 * .90) - pose.height))
atlas = Image.open(SOURCE / "cool-sunglasses.png").convert("RGBA")
for index in [8, 9, 10, 11, 12]:
    box = (index % 4 * 384, index // 4 * 384)
    atlas.paste(tile, box)
atlas.save(SOURCE / "cool-sunglasses-anatomy.png")
contact = Image.new("RGBA", atlas.size, "#0a0a0f")
contact.alpha_composite(atlas)
contact.convert("RGB").resize((1024, 1024)).save(SOURCE / "cool-sunglasses-anatomy-contact.png")
print("Replaced five three-arm key poses with the corrected two-arm drawing.")
