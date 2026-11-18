"""Preview sheet for the everyday animations (tools/gen_actions.mjs): each animal at rest, eating,
drinking and being petted (and grazing, for the sheep), adult and young, drawn by
sleep_preview.py's renderer at the moment each loop moves furthest.

Run with: python art_src/m4_scripts/actions_preview.py out.png [animal ...]

The new animals' special actions (1.1 追加: the tom's display, the quail's dust bath, the
alpaca's spit and head shake) are drawn at several moments of each loop, one sheet per animal,
with the lowest point of the model printed under each tile (red when it dips under the ground):

     python art_src/m4_scripts/actions_preview.py --special docs/art [turkey quail alpaca]
  -> docs/art/<id>_special_preview.png
"""
import json
import sys
from pathlib import Path

import numpy as np

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


def keyed(v, t):
    """A keyframed channel at time t (linear between keys, held after the last)."""
    keys = sorted((float(k), val) for k, val in v.items())
    if t <= keys[0][0]:
        return keys[0][1]
    for (t0, a), (t1, b) in zip(keys, keys[1:]):
        if t <= t1:
            k = (t - t0) / (t1 - t0)
            return [x + (y - x) * k for x, y in zip(a, b)]
    return keys[-1][1]


def pose_at(animal, action, t):
    data = json.loads((sp.RP / "animations" / f"{animal}.actions.animation.json").read_text())
    anim = data["animations"].get(f"animation.{sp.NS}.{animal}.{action}")
    if anim is None:
        return None
    return {bone: {k: (keyed(v, t) if isinstance(v, dict) else v) for k, v in ch.items()} for bone, ch in anim["bones"].items()}


def lowest(animal, baby, pose, male=False):
    """The lowest point (model pixels above the ground) of every cube drawn, posed."""
    geo = json.loads((sp.RP / "models" / "entity" / f"{animal}.geo.json").read_text())["minecraft:geometry"][0]
    rc = json.loads((sp.RP / "render_controllers" / f"{animal}.render_controllers.json").read_text())
    rules = next(iter(rc["render_controllers"].values()))["part_visibility"]
    bones = {b["name"]: b for b in geo["bones"]}

    def world(name):
        b = bones[name]
        piv = np.array(b.get("pivot", [0, 0, 0]), float)
        st = pose.get(name, {})
        r = sp.rot(*[sp.molang(v, baby) for v in st.get("rotation", [0, 0, 0])]) @ sp.rot(*b.get("rotation", [0, 0, 0]))
        scale = st.get("scale", [1, 1, 1])
        m = np.eye(3) * sp.molang(scale, baby) if isinstance(scale, (int, float, str)) else np.diag([sp.molang(v, baby) for v in scale])
        t = np.array([sp.molang(v, baby) for v in st.get("position", [0, 0, 0])])
        local = lambda p: piv + t + (np.asarray(p, float) - piv) @ (r @ m).T
        parent = b.get("parent")
        if parent:
            pw = world(parent)
            return lambda p: pw(local(p))
        return local

    low = 1e9
    for name, b in bones.items():
        if name.startswith("lids_") or not sp.visible(name, bones, baby, False, rules, male):
            continue
        f = world(name)
        for c in b.get("cubes", []):
            (x, y, z), (w, h, d) = c["origin"], c["size"]
            corners = [[x + i * w, y + j * h, z + k * d] for i in (0, 1) for j in (0, 1) for k in (0, 1)]
            low = min(low, float(f(np.array(corners))[:, 1].min()))
    return low


# The special actions per animal: (action, [moments in seconds]).
SPECIAL = {
    "turkey": [("display", [0.0, 0.25, 0.75, 1.5])],
    "quail": [("dust_bath", [0.0, 0.375, 0.7, 1.125])],
    "alpaca": [("spit", [0.3, 0.45, 0.8]), ("shake", [0.083, 0.25, 0.42])],
}


ZOOM = {"quail": 11.0}  # the quail is small


def special(out_dir, animals):
    T = 220
    for animal in animals:
        cols = [("rest", None)] + [(a, t) for a, ts in SPECIAL[animal] for t in ts]
        rows = [("adult", False, False), ("male", False, True), ("young", True, False)]
        sheet = Image.new("RGB", (len(cols) * T, len(rows) * (T + 16) + 20), (232, 238, 226))
        draw = ImageDraw.Draw(sheet)
        for c, (action, t) in enumerate(cols):
            draw.text((c * T + 6, 4), action if t is None else f"{action} {t:g}s", fill=(40, 50, 40))
        worst = 1e9
        for r, (label, baby, male) in enumerate(rows):
            y = 20 + r * (T + 16)
            for c, (action, t) in enumerate(cols):
                if action == "display" and (baby or not male):
                    continue  # only the adult tom displays (systems/specialActions.js)
                sp.ANIM_TIME = t or 0.0
                bones = {} if t is None else pose_at(animal, action, t)
                tile = sp.render(animal, baby, False, male=male, texture="male" if male else None, tile=T, scale=ZOOM.get(animal, 5.0),
                                 model_scale=1.0, pose=bones)
                sheet.paste(tile, (c * T, y))
                low = lowest(animal, baby, bones, male)
                worst = min(worst, low)
                draw.text((c * T + 6, y + T + 2), f"lowest {low:+.2f} px", fill=(200, 30, 30) if low < -0.05 else (40, 50, 40))
            draw.text((4, y + 4), f"{animal} {label}", fill=(40, 50, 40))
        path = Path(out_dir) / f"{animal}_special_preview.png"
        sheet.save(path)
        print("wrote", path, f"lowest point {worst:+.2f} px")


def main():
    if sys.argv[1] == "--special":
        return special(sys.argv[2], sys.argv[3:] or list(SPECIAL))
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
