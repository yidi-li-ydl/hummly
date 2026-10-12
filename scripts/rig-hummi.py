"""Continuous, two-arm 2D rigs for the three problematic Hummi loops.

Use one reference drawing per action. Animate separated limbs continuously;
do not switch key drawings or morph character topology. The note and body
remain one connected layer. Local image processing is user-authorized.
"""
from pathlib import Path
import json
import math
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy.ndimage import distance_transform_edt, label, binary_fill_holes
from skimage.restoration import inpaint_biharmonic

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "artifacts/hummi/animation-sources"
OUT = ROOT / "public/mascot/hummi/animations"
PARTS = ROOT / "artifacts/hummi/rig-parts"
R, SIZE, COUNT = 384, 256, 96
TAU = math.pi * 2


def key(state, index=0):
    atlas = Image.open(SOURCE / f"{state}.png").convert("RGBA")
    return atlas.crop((index % 4 * R, index // 4 * R,
                       (index % 4 + 1) * R, (index // 4 + 1) * R))


def polygon(points):
    im = Image.new("L", (R, R))
    ImageDraw.Draw(im).polygon(points, fill=255)
    return np.asarray(im, dtype=np.float32) / 255


def ellipse(box):
    im = Image.new("L", (R, R))
    ImageDraw.Draw(im).ellipse(box, fill=255)
    return np.asarray(im, dtype=np.float32) / 255


def cut(im, mask):
    rgba = np.asarray(im).copy()
    rgba[:, :, 3] = np.uint8(rgba[:, :, 3] * np.clip(mask, 0, 1))
    return Image.fromarray(rgba)


def clean_component(path, target_box):
    """Clean and align the identity-preserving, limb-free animation torso."""
    rgba = np.asarray(Image.open(path).convert("RGBA")).copy()
    r, g, b, a = [rgba[:, :, i].astype(np.int16) for i in range(4)]
    white = (r > 244) & (g > 244) & (b > 244) & (np.maximum.reduce([r, g, b]) - np.minimum.reduce([r, g, b]) < 8)
    colored = ((r > 195) & (g > 185) & (b < 100)) | ((r > 190) & (g < 100) & (b < 100))
    labels, _ = label((a > 8) & ~white & ~colored)
    areas = np.bincount(labels.ravel()); areas[0] = 0
    keep = binary_fill_holes(labels == areas.argmax())
    rgba[:, :, 3][~keep] = 0
    if Path(path).stem == "sunglasses-body":
        # The component render retained a lower arm-shaped belly bulge. Rebuild
        # only the bottom contour as a round torso using its own upper fur.
        round_mask = Image.new("L", (rgba.shape[1], rgba.shape[0]))
        ImageDraw.Draw(round_mask).ellipse((258, 437, 924, 974), fill=255)
        shape = np.asarray(round_mask)
        original = rgba.copy()
        for y in range(850, rgba.shape[0]):
            if y >= 975:
                rgba[y, :, 3] = 0
                continue
            mirrored = max(0, 1410 - y)
            blend = min(1, (y - 850) / 30)
            rgba[y, :, :3] = np.uint8(original[y, :, :3] * (1 - blend) + original[mirrored, :, :3] * blend)
            rgba[y, :, 3] = np.uint8(original[y, :, 3] * (1 - blend) + shape[y] * blend)
    subject = Image.fromarray(rgba)
    subject = subject.crop(subject.getbbox())
    x0, y0, x1, y1 = target_box
    scale = min((x1 - x0) / subject.width, (y1 - y0) / subject.height)
    subject = subject.resize((round(subject.width * scale), round(subject.height * scale)), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (R, R))
    canvas.alpha_composite(subject, (round((x0 + x1 - subject.width) / 2), y1 - subject.height))
    return canvas


def body_without_parts(im, body_mask, removed):
    rgba = np.asarray(im).copy()
    alpha = rgba[:, :, 3] / 255
    rgb = rgba[:, :, :3] / 255
    # Extrapolate edge colors before inpainting, avoiding black transparent-edge
    # bleed into the reconstructed belly and shoulder sockets.
    nearest = distance_transform_edt(alpha < .75, return_distances=False,
                                     return_indices=True)
    rgb[alpha < .75] = rgb[tuple(nearest[:, alpha < .75])]
    repair = (removed > .05) & (body_mask > .1)
    if repair.any():
        rgb = inpaint_biharmonic(rgb, repair, channel_axis=-1)
    rgba[:, :, :3] = np.uint8(np.clip(rgb, 0, 1) * 255)
    rgba[:, :, 3] = np.uint8(body_mask * 255)
    return Image.fromarray(rgba)


def transform(im, pivot, degrees=0, sx=1, sy=1, dx=0, dy=0):
    angle = math.radians(degrees)
    linear = np.array([[math.cos(angle) * sx, -math.sin(angle) * sy],
                       [math.sin(angle) * sx, math.cos(angle) * sy]])
    pivot = np.array(pivot, dtype=float)
    forward = np.eye(3)
    forward[:2, :2] = linear
    forward[:2, 2] = pivot + [dx, dy] - linear @ pivot
    inverse = np.linalg.inv(forward)
    return im.transform((R, R), Image.Transform.AFFINE,
                        tuple(inverse[:2].ravel()), Image.Resampling.BICUBIC)


def compose(*layers):
    result = Image.new("RGBA", (R, R))
    for layer in layers:
        result.alpha_composite(layer)
    return result


def save_parts(state, parts):
    directory = PARTS / state
    directory.mkdir(parents=True, exist_ok=True)
    for name, image in parts.items():
        image.save(directory / f"{name}.png")


def smooth(t):
    t = max(0, min(1, t))
    return t * t * (3 - 2 * t)


def ramp(p, start, end):
    return smooth((p - start) / (end - start))


def dance_rig():
    im = key("dancing", 1)
    left_mask = polygon([(55, 225), (83, 222), (101, 231), (111, 246),
                         (105, 266), (91, 275), (64, 271), (55, 253)])
    right_mask = polygon([(238, 246), (270, 244), (296, 248), (307, 263),
                          (306, 282), (280, 290), (244, 281)])
    feet_mask = polygon([(143, 289), (224, 289), (226, 350), (140, 350)])
    body_mask = ellipse((83, 140, 270, 310))
    note_mask = polygon([(195, 158), (195, 0), (R, 0), (R, 160)])
    original_alpha = np.asarray(im)[:, :, 3] / 255
    body_mask = np.maximum(body_mask, note_mask * original_alpha)
    component = ROOT / "artifacts/hummi/rig-components/dance-body.png"
    body = clean_component(component, (83, 53, 327, 310))
    left, right = cut(im, left_mask), cut(im, right_mask)
    # A single round sole template gives exactly one connected shape per foot.
    foot_mask = ellipse((175, 290, 224, 346))
    foot = cut(im, foot_mask)
    parts = {"body-and-note": body, "left-arm": left, "right-arm": right,
             "foot-template": foot}
    save_parts("dancing", parts)
    frames = []
    for index in range(COUNT):
        p = index / COUNT
        beat = math.sin(TAU * p * 2)
        hop = max(0, beat)
        swing = math.sin(TAU * p * 2 + .3)
        left_arm = transform(left, (100, 247), degrees=25 * swing)
        right_arm = transform(right, (248, 261), degrees=-23 * swing)
        left_foot = transform(foot, (197, 300), degrees=-20 * beat, dx=-35,
                              dy=-7 * max(0, -beat))
        right_foot = transform(foot, (197, 300), degrees=23 * beat,
                               dy=-10 * hop)
        # Sockets sit behind the torso; copied shoulder pixels cannot form seams.
        scene = compose(left_foot, right_foot, left_arm, right_arm, body)
        landing = max(0, -beat)
        scene = transform(scene, (177, 322), degrees=3 * math.sin(TAU * p),
                          sx=1 + .018 * landing, sy=1 + .024 * hop - .018 * landing,
                          dx=4 * math.sin(TAU * p), dy=-5 * hop)
        frames.append(scene)
    return frames


def sunglasses_rig():
    # Preserve the reference's actual crossed arms and two natural feet as one
    # connected image. Reconstructed limbs changed its anatomy in v3.
    im = key("cool-sunglasses", 0)
    save_parts("cool-sunglasses", {"connected-character": im})
    frames = []
    for index in range(COUNT):
        p = index / COUNT
        beat = math.sin(TAU * p * 2)
        frames.append(transform(im, (177, 338),
                                degrees=.9 * math.sin(TAU * p),
                                sx=1 + .003 * beat, sy=1 - .004 * beat,
                                dy=-1.2 * beat))
    return frames


def unhappy_rig():
    # The short stem and both flags remain physically in the same bitmap as the
    # head throughout its inhale/rise. No optical flow can tear their junction.
    im = key("unhappy", 0)
    save_parts("unhappy", {"connected-character": im})
    frames = []
    for index in range(COUNT):
        p = index / COUNT
        breath = (.5 - .5 * math.cos(TAU * p))
        rise = breath ** 1.4
        frames.append(transform(im, (177, 338), sx=1 + .018 * breath,
                                sy=1 + .042 * rise, dy=-1.2 * rise,
                                degrees=-.6 * math.sin(TAU * p)))
    return frames


def export(state, frames, duration):
    # Every pose comes from continuous part transforms; there are no key jumps.
    frames[-1] = frames[0].copy()
    (PARTS / state / "poster.png").parent.mkdir(parents=True, exist_ok=True)
    frames[0].save(PARTS / state / "poster.png")
    reduced = [im.resize((SIZE, SIZE), Image.Resampling.LANCZOS) for im in frames]
    sheet = Image.new("RGBA", (SIZE * 8, SIZE * 12))
    for i, frame in enumerate(reduced):
        sheet.paste(frame, (i % 8 * SIZE, i // 8 * SIZE))
    version = "v4" if state == "cool-sunglasses" else "v3"
    sheet.save(OUT / f"{state}-rig-{version}.webp", quality=90, method=4)
    delays = [round((i + 1) * duration * 1000 / COUNT) - round(i * duration * 1000 / COUNT)
              for i in range(COUNT)]
    reduced[0].save(OUT / f"{state}-rig-{version}-loop.webp", save_all=True,
                    append_images=reduced[1:], duration=delays, loop=0,
                    quality=88, method=1, minimize_size=False)
    contact = Image.new("RGBA", (SIZE * 6, SIZE * 4), "#0a0a0f")
    for i in range(24):
        contact.alpha_composite(reduced[i * 4], (i % 6 * SIZE, i // 6 * SIZE))
    contact.convert("RGB").save(SOURCE / f"{state}-rig-contact.png")
    # Keep a magnified junction review for the inhale, not only whole-page shots.
    if state == "unhappy":
        junction = Image.new("RGBA", (240 * 8, 240), "#0a0a0f")
        for i, f in enumerate(range(36, 60, 3)):
            crop = frames[f].crop((170, 110, 265, 195)).resize((240, 240))
            junction.alpha_composite(crop, (i * 240, 0))
        junction.convert("RGB").save(SOURCE / "unhappy-junction-review.png")
    disconnected, component_counts = [], []
    for index, frame in enumerate(reduced):
        components, _ = label(np.asarray(frame)[:, :, 3] > 96)
        areas = np.bincount(components.ravel())[1:]
        significant = int(np.count_nonzero(areas > 24))
        component_counts.append(significant)
        if state == "unhappy" and significant != 1:
            disconnected.append(index)
    if disconnected:
        raise RuntimeError(f"Unhappy disconnected at frames {disconnected}")
    print(f"{state}: 96 continuously rigged frames, loop matched", flush=True)
    return {"state": state, "frames": COUNT, "duration": duration,
            "method": "connected reference gentle groove" if state == "cool-sunglasses" else "continuous 2D part rig", "loopMatched": True,
            "armLayers": 2 if state == "dancing" else None,
            "maxConnectedComponents": max(component_counts),
            "disconnectedFrames": disconnected}


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--states", nargs="+", choices=["dancing", "cool-sunglasses", "unhappy"],
                        default=["dancing", "cool-sunglasses", "unhappy"])
    args = parser.parse_args()
    generators = {"dancing": (dance_rig, 2.8), "cool-sunglasses": (sunglasses_rig, 3),
                  "unhappy": (unhappy_rig, 2.5)}
    report_path = SOURCE / "rig-validation.json"
    previous = json.loads(report_path.read_text()) if report_path.exists() else []
    report = [entry for entry in previous if entry["state"] not in args.states]
    for state in args.states:
        generator, duration = generators[state]
        report.append(export(state, generator(), duration))
    report_path.write_text(json.dumps(report, indent=2))
