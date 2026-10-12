# Hummi torso layers

Saved component PNGs:
- `dance-body.png`: closed-eye smiling torso with attached short stem/two flags.
- `sunglasses-body.png`: side-glancing torso with attached short stem/two flags.

Generated using the built-in ImageGen tool, with the existing Hummi frames as
identity-preserving edit references. These are animation components; complete
UI characters receive exactly two arms and two feet from the saved part layers.

## Prompt set

Shared prompt: Precise identity-preserving edit for a 2D animation component,
deliberately an isolated torso rather than a complete character. Keep the
original cream-apricot short plush material, cream face/belly, pink cheeks,
face proportions, camera angle and lighting. Keep one short stem and two
rounded flags directly and solidly connected to the torso. No neck or floating
note. No arms, hands, elbows, legs, feet or accessories on this component.
Full torso and note centered with 12% transparent margin; no ground shadow,
text, white matte, outline or colored stray pixels.

Dance-specific edit: Keep the same closed-eye singing smile, cheek positions
and face proportions. Remove both arms and both legs; reconstruct a clean
naturally rounded plush torso, with no limb bumps or stumps.

Sunglasses-specific edit: Remove both arms, both legs and sunglasses. Keep the
playful side glance, smile and bead-eye sizes/positions; restore the eyes hidden
behind the glasses. Reconstruct the clean rounded cream-apricot plush torso.

## Local processing

The user authorized local alpha cleanup, contour repair, alignment and part
compositing. `scripts/rig-hummi.py` keeps the note/body connected, cleans alpha
flecks, trims the unwanted lower belly bulge from the glasses component and
composites separate limb/accessory layers with continuous transforms.

Prepared layer PNGs and 384px poster frames are in `../rig-parts/`. Served
96-frame atlases/loops use `*-rig-v3.webp` in the project's mascot directory.
