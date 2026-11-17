"""Preview sheet for the everyday animations (tools/gen_actions.mjs): each animal at rest, eating,
drinking and being petted (and grazing, for the sheep), adult and young, drawn by
sleep_preview.py's renderer at the moment each loop moves furthest.

Run with: python art_src/m4_scripts/actions_preview.py out.png [animal ...]
"""
import json
import sys

from PIL import Image, ImageDraw

import sleep_preview as sp

ACTIONS = ["eat", "drink", "petted", "graze"]
TIME = 0.125  # a quarter of a 720°/s chew: the loops' sines peak here
KEYFRAME = "0.35"  # keyframed loops (the poultry drink): the beak at its lowest


def pose(animal, action):
    data = json.loads((sp.RP / "animations" / f"{animal}.actions.animation.json").read_text())
    anim = data["animations"].get(f"animation.{sp.NS}.{animal}.{action}")
    if anim is None:
        return None
    out = {}
    for bone, channels in anim["bones"].items():
        out[bone] = {k: (v.get(KEYFRAME, next(iter(v.values()))) if isinstance(v, dict) else v) for k, v in channels.items()}
    return out


def main():
    out, animals = sys.argv[1], sys.argv[2:] or sp.ANIMALS
    sp.ANIM_TIME = TIME
    T = 200
    cols = ["rest", *ACTIONS]
    sheet = Image.new("RGB", (len(cols) * T, len(animals) * 2 * T + 20), (232, 238, 226))
    draw = ImageDraw.Draw(sheet)
    for c, name in enumerate(cols):
        draw.text((c * T + 6, 4), name, fill=(40, 50, 40))
    for r, animal in enumerate(animals):
        for b, baby in enumerate((False, True)):
            y = 20 + (r * 2 + b) * T
            for c, action in enumerate(cols):
                bones = {} if action == "rest" else pose(animal, action)
                if bones is None:
                    continue
                tile = sp.render(animal, baby, False, tile=T, scale=5.5, pose=bones)
                sheet.paste(tile, (c * T, y))
            draw.text((4, y + 4), animal + (" (young)" if baby else ""), fill=(40, 50, 40))
    sheet.save(out)


if __name__ == "__main__":
    main()
