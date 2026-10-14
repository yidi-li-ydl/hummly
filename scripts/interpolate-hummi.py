"""User-authorized motion interpolation of the cleaned Hummi key poses.

Uses bidirectional TV-L1 flow and premultiplied-alpha warping. Original key
poses remain available; generated in-betweens are never described as hand-drawn.
Run with /opt/anaconda3/bin/python scripts/interpolate-hummi.py.
"""
from pathlib import Path
import json
import argparse
import numpy as np
from PIL import Image
from scipy.ndimage import map_coordinates, zoom, binary_dilation
from skimage.registration import optical_flow_tvl1

ROOT = Path(__file__).resolve().parent.parent
STATES = {"curious-listening": 3, "unhappy": 2.5, "singing": 3.5,
          "singing-microphone": 3.5,
          "dancing": 2.8, "group-dance": 3.5, "cool-sunglasses": 3,
          "headphones": 3, "dj": 3.5}
SIZE, FACTOR, COLS, ROWS = 256, 6, 8, 12
OUT = ROOT / "public/mascot/hummi/animations"
SOURCE = ROOT / "artifacts/hummi/animation-sources"
GRID = np.mgrid[:SIZE, :SIZE].astype(np.float32)
parser = argparse.ArgumentParser()
parser.add_argument("--states", default=",".join(STATES))
SELECTED = set(parser.parse_args().states.split(","))


def anatomy_safe_frame(keys, index, step, state):
    """Tween one intact drawing; a bijective affine map cannot add an arm.

    Full-body position/scale changes smoothly, while limb drawing switches at
    the nearest key pose. This deliberately trades limb morphing for anatomy.
    """
    t = step / FACTOR
    first, second = keys[index], keys[(index + 1) % 16]
    chosen = first if t < .5 else second
    boxes = [im.getbbox() for im in (first, second, chosen)]
    b0, b1, box = boxes
    w = (b0[2] - b0[0]) * (1 - t) + (b1[2] - b1[0]) * t
    h = (b0[3] - b0[1]) * (1 - t) + (b1[3] - b1[1]) * t
    phase = (index + t) / 16 * 2 * np.pi
    swing = np.sin(phase * 2)
    angle = np.deg2rad((1.5 if state == "dancing" else .5) * swing)
    sx, sy = w / (box[2] - box[0]), h / (box[3] - box[1])
    pivot = np.array([(box[0] + box[2]) / 2, box[3]], dtype=np.float64)
    target = np.array([SIZE / 2, SIZE * .90 - (2 if state == "dancing" else .5) * abs(swing)])
    matrix = np.array([[np.cos(angle) * sx, -np.sin(angle) * sy],
                       [np.sin(angle) * sx, np.cos(angle) * sy]])
    translation = target - matrix @ pivot
    forward = np.eye(3)
    forward[:2, :2], forward[:2, 2] = matrix, translation
    inverse = np.linalg.inv(forward)
    return chosen.transform((SIZE, SIZE), Image.Transform.AFFINE,
                            tuple(inverse[:2, :].ravel()), Image.Resampling.BICUBIC)


def premultiplied(image):
    rgba = np.asarray(image, dtype=np.float32) / 255
    rgba[:, :, :3] *= rgba[:, :, 3:4]
    return rgba


def flow(a, b):
    # Include silhouette in the estimator, so empty alpha does not attract fur.
    def gray(im):
        luminance = im[:, :, :3] @ np.array([.2126, .7152, .0722], np.float32)
        return (luminance * .75 + im[:, :, 3] * .25)[::2, ::2]
    vectors = optical_flow_tvl1(gray(a), gray(b), num_warp=5, num_iter=10,
                               attachment=12, prefilter=True)
    return zoom(vectors, (1, 2, 2), order=1)[:, :SIZE, :SIZE] * 2


def warp(im, vectors, fraction):
    coords = GRID - vectors * fraction
    return np.stack([map_coordinates(im[:, :, channel], coords, order=1,
                                    mode="constant", cval=0)
                     for channel in range(4)], axis=2)


def image_from_premultiplied(im):
    alpha = im[:, :, 3:4]
    im[:, :, :3] = np.divide(im[:, :, :3], np.maximum(alpha, 1e-6))
    im[alpha[:, :, 0] < 1 / 255] = 0
    return Image.fromarray(np.uint8(np.clip(im, 0, 1) * 255 + .5), "RGBA")


report = []
for state, duration in STATES.items():
    if state not in SELECTED:
        continue
    suffix = "anatomy-v2" if state in {"dancing", "cool-sunglasses"} else "smooth"
    corrected = SOURCE / f"{state}-anatomy.png"
    atlas = Image.open(corrected if corrected.exists() else SOURCE / f"{state}.png").convert("RGBA")
    cell = atlas.width // 4
    keys = [atlas.crop(((i % 4) * cell, (i // 4) * cell,
                       (i % 4 + 1) * cell, (i // 4 + 1) * cell))
            .resize((SIZE, SIZE), Image.Resampling.LANCZOS) for i in range(16)]
    frames = []
    for index in range(16):
        if state in {"dancing", "cool-sunglasses"}:
            for step in range(FACTOR):
                frames.append(anatomy_safe_frame(keys, index, step, state))
            continue
        a, b = premultiplied(keys[index]), premultiplied(keys[(index + 1) % 16])
        if np.array_equal(a, b):
            frames.extend([keys[index].copy() for _ in range(FACTOR)])
            continue
        forward, backward = flow(a, b), flow(b, a)
        for step in range(FACTOR):
            if step == 0:
                frames.append(keys[index].copy())
                continue
            t = step / FACTOR
            wa, wb = warp(a, forward, t), warp(b, backward, 1 - t)
            dominant = wa if t < .5 else wb
            mixed = dominant.copy()
            # Blend only matching opaque interior texture. Silhouette/disocclusion
            # regions use one warped source, so moving hands do not leave ghosts.
            stable = (wa[:, :, 3] > .98) & (wb[:, :, 3] > .98)
            stable &= np.mean(np.abs(wa[:, :, :3] - wb[:, :, :3]), axis=2) < .10
            blended = wa * (1 - t) + wb * t
            mixed[stable] = blended[stable]
            # Open/closed eyes and mouth shapes change topology. Blending both
            # produces transparent double eyes; keep the nearer warped drawing
            # for dark facial details while interpolating body/limb motion.
            def dark_detail(im):
                alpha = im[:, :, 3]
                rgb = im[:, :, :3] / np.maximum(alpha[:, :, None], 1e-6)
                return (alpha > .15) & (rgb.mean(axis=2) < .32)
            details = binary_dilation(dark_detail(wa) | dark_detail(wb), iterations=2)
            mixed[details] = dominant[details]
            frames.append(image_from_premultiplied(mixed))
    # Match terminal drawing exactly, including safe tween's subtle body motion.
    frames[-1] = frames[0].copy()
    sheet = Image.new("RGBA", (SIZE * COLS, SIZE * ROWS))
    for i, frame in enumerate(frames):
        sheet.paste(frame, ((i % COLS) * SIZE, (i // COLS) * SIZE))
    sheet.save(OUT / f"{state}-{suffix}.webp", quality=90, method=4)
    delays = [round((i + 1) * duration * 1000 / 96) - round(i * duration * 1000 / 96)
              for i in range(96)]
    frames[0].save(OUT / f"{state}-{suffix}-loop.webp", save_all=True,
                   append_images=frames[1:], duration=delays, loop=0, quality=88,
                   method=1, minimize_size=False)
    # Representative in-betweens for visual QA, rather than a 96-image dump.
    contact = Image.new("RGBA", (SIZE * 4, SIZE * 2), "#0a0a0f")
    picks = [0, 9, 15, 27, 39, 51, 69, 87]
    for i, pick in enumerate(picks):
        contact.alpha_composite(frames[pick], ((i % 4) * SIZE, (i // 4) * SIZE))
    contact.convert("RGB").save(SOURCE / f"{state}-smooth-contact.png")
    report.append({"state": state, "frames": 96, "keyPoses": 16,
                   "fps": round(96 / duration, 2), "duration": duration,
                   "method": "anatomy-preserving affine tween" if state in {"dancing", "cool-sunglasses"} else "bidirectional TV-L1 motion interpolation",
                   "width": SIZE * COLS, "height": SIZE * ROWS})
    print(f"{state}: 16 → 96 frames, {96 / duration:.1f} fps", flush=True)

metadata = SOURCE / "interpolation.json"
prior = json.loads(metadata.read_text()) if metadata.exists() else []
updated = {entry["state"]: entry for entry in prior}
updated.update({entry["state"]: entry for entry in report})
metadata.write_text(json.dumps(list(updated.values()), indent=2))
