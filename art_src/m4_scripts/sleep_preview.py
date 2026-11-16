"""Preview sheet for the sleeping poses (tools/gen_sleep.mjs): each animal awake and asleep,
adult and baby, rendered from packs/RP with its sleep animation and eyelids applied.

Bedrock conventions used here: a positive X rotation tips a bone's front (-Z) down, as
look_at_target does with a positive pitch; Y and Z rotations are drawn with the
right-hand rule (the poses are symmetric, so a mirrored roll or turn looks the same).

Run with: python art_src/m4_scripts/sleep_preview.py out.png [animal ...]
"""
import json
import math
import re
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
RP = ROOT / "packs" / "RP"
NS = "kaleidoscope_ranching"
TILE, SCALE = 300, 8.0
YAW, PITCH = math.radians(-40), math.radians(22)
SHADE = {"up": 1.0, "north": 0.86, "west": 0.72, "east": 0.76, "south": 0.8, "down": 0.55}
SS = 6
ANIMALS = ["cow", "buffalo", "yak", "sheep", "goat", "pig", "chicken", "duck", "goose", "rabbit"]


def molang(expr, baby):
    if isinstance(expr, (int, float)):
        return float(expr)
    e = expr.replace("q.is_baby", "1" if baby else "0").replace("q.life_time", "0")
    e = e.replace("math.sin", "_sin")
    e = re.sub(r"(\S+)\s*\?\s*(\S+)\s*:\s*(\S+)", r"(\2 if \1 else \3)", e)
    return float(eval(e, {"_sin": lambda d: math.sin(math.radians(d))}))


def rot(rx, ry, rz):
    rx, ry, rz = (math.radians(a) for a in (-rx, ry, rz))
    X = np.array([[1, 0, 0], [0, math.cos(rx), -math.sin(rx)], [0, math.sin(rx), math.cos(rx)]])
    Y = np.array([[math.cos(ry), 0, math.sin(ry)], [0, 1, 0], [-math.sin(ry), 0, math.cos(ry)]])
    Z = np.array([[math.cos(rz), -math.sin(rz), 0], [math.sin(rz), math.cos(rz), 0], [0, 0, 1]])
    return X @ Y @ Z


def face_rects(cube):
    if isinstance(cube["uv"], dict):
        return {f: (*d["uv"], *d["uv_size"]) for f, d in cube["uv"].items()}
    u, v = cube["uv"]
    w, h, d = (max(1, round(s)) for s in cube["size"])
    return {"up": (u + d, v, w, d), "down": (u + d + w, v, w, d), "north": (u + d, v + d, w, h),
            "south": (u + 2 * d + w, v + d, w, h), "east": (u, v + d, d, h), "west": (u + d + w, v + d, d, h)}


def face_point(cube, face, a, b):
    (x, y, z), (w, h, d) = cube["origin"], cube["size"]
    x1, y1, z1 = x + w, y + h, z + d
    return {
        # Bedrock box UV: the left strip ("east") is the cube's smallest-x side, and the top,
        # bottom and north faces run their first texel column from the smallest x.
        "up": (x + a * w, y1, z1 - b * d), "down": (x + a * w, y, z1 - b * d),
        "north": (x + a * w, y1 - b * h, z), "south": (x1 - a * w, y1 - b * h, z1),
        "east": (x, y1 - b * h, z1 - a * d), "west": (x1, y1 - b * h, z + a * d),
    }[face]


def visible(name, bones, baby, asleep, rules, male=False, sheared=False):
    while name:
        for rule in rules:
            key, expr = next(iter(rule.items()))
            if key == name and isinstance(expr, str):
                env = expr.replace("q.is_baby", str(baby)).replace(f"q.property('{NS}:sleeping')", str(asleep))
                env = env.replace("q.is_saddled", "False").replace("q.is_sheared", str(sheared)).replace("&&", " and ").replace("||", " or ").replace("!", " not ")
                env = re.sub(r"q\.property\('[^']+'\)\s*==\s*'male'", str(male), env)
                if not eval(env):
                    return False
        name = bones[name].get("parent")
    return True


def render(animal, baby, asleep, male=False, sheared=False, texture=None, tile=TILE, scale=SCALE, model_scale=1.0, ground=0.72):
    """One tile. The defaults draw the female (or first) skin; `texture` names another skin,
    `model_scale` is the entity's own scale (males are larger)."""
    TILE, SCALE = tile, scale * model_scale
    geo = json.loads((RP / "models" / "entity" / f"{animal}.geo.json").read_text())["minecraft:geometry"][0]
    entity = json.loads((RP / "entity" / f"{animal}.entity.json").read_text())["minecraft:client_entity"]["description"]
    rc = json.loads((RP / "render_controllers" / f"{animal}.render_controllers.json").read_text())
    rules = next(iter(rc["render_controllers"].values()))["part_visibility"]
    textures = entity["textures"]
    key = "baby" if baby and "baby" in textures else ("female" if "female" in textures else next(iter(textures)))
    if animal == "sheep":
        key = "baby_white" if baby else "female_white"
    key = texture or key
    tex = Image.open(RP / f"{textures[key]}.png").convert("RGBA")
    tw, th = geo["description"]["texture_width"], geo["description"]["texture_height"]
    tex = tex.resize((tw, th), Image.NEAREST).load() if tex.size != (tw, th) else tex.load()
    anim = {}
    if asleep:
        a = json.loads((RP / "animations" / f"{animal}.sleep.animation.json").read_text())
        anim = next(iter(a["animations"].values()))["bones"]
    bones = {b["name"]: b for b in geo["bones"]}

    def world(name):
        b = bones[name]
        piv = np.array(b.get("pivot", [0, 0, 0]), float)
        st = anim.get(name, {})
        r = rot(*[molang(v, baby) for v in st.get("rotation", [0, 0, 0])]) @ rot(*b.get("rotation", [0, 0, 0]))
        s = np.diag([molang(v, baby) for v in st.get("scale", [1, 1, 1])]) if not isinstance(st.get("scale"), (int, float)) else np.eye(3) * st["scale"]
        t = np.array([molang(v, baby) for v in st.get("position", [0, 0, 0])])
        M = r @ s
        local = lambda p: piv + t + (np.asarray(p, float) - piv) @ M.T  # points as rows
        parent = b.get("parent")
        if parent:
            pw = world(parent)
            return lambda p: pw(local(p))
        return local

    color = np.zeros((TILE, TILE, 3), np.uint8)
    color[:] = (196, 214, 176) if asleep else (214, 224, 208)
    depth = np.full(TILE * TILE, -1e9)
    flat = color.reshape(-1, 3)
    pixels = np.array([[tex[x, y] for x in range(tw)] for y in range(th)], np.uint8)  # [v][u] -> rgba
    cy, sy, cp, sp = math.cos(YAW), math.sin(YAW), math.cos(PITCH), math.sin(PITCH)
    ss = max(SS, int(SCALE * 1.7) + 1)  # samples per texel edge: enough to leave no holes
    for name, b in bones.items():
        if not visible(name, bones, baby, asleep, rules, male, sheared):
            continue
        f = world(name)
        for cube in b.get("cubes", []):
            for face, (u, v, uw, uh) in face_rects(cube).items():
                nw, nh = max(1, round(abs(uw))), max(1, round(abs(uh)))
                if not uw or not uh:
                    continue
                i, j = np.meshgrid(np.arange(nw * ss), np.arange(nh * ss))
                i, j = i.ravel(), j.ravel()
                ti, tj = i // ss, j // ss
                px = (u + np.where(uw > 0, ti, -ti - 1)).astype(int)
                py = (v + np.where(uh > 0, tj, -tj - 1)).astype(int)
                ok = (px >= 0) & (px < tw) & (py >= 0) & (py < th)
                i, j, px, py = i[ok], j[ok], px[ok], py[ok]
                rgba = pixels[py, px]
                ok = rgba[:, 3] >= 128
                i, j, rgba = i[ok], j[ok], rgba[ok]
                if not len(i):
                    continue
                pts = np.stack(np.broadcast_arrays(*face_point(cube, face, (i + 0.5) / (nw * ss), (j + 0.5) / (nh * ss))), axis=1)
                w = f(pts)
                x, y, z = w[:, 0], w[:, 1], w[:, 2]
                x2, z2 = x * cy - z * sy, x * sy + z * cy
                y2, z3 = y * cp + z2 * sp, -y * sp + z2 * cp  # camera above the ground, looking down
                sxp = (TILE / 2 + x2 * SCALE).astype(int)
                syp = (TILE * ground - y2 * SCALE).astype(int)
                ok = (sxp >= 0) & (sxp < TILE) & (syp >= 0) & (syp < TILE)
                idx, d, rgba = (syp * TILE + sxp)[ok], -z3[ok], rgba[ok]
                np.maximum.at(depth, idx, d)
                win = d >= depth[idx]
                flat[idx[win]] = (rgba[win, :3] * SHADE[face]).astype(np.uint8)
    img = Image.fromarray(color)
    d = ImageDraw.Draw(img)
    gy = int(TILE * ground)
    d.line([(0, gy), (TILE, gy)], fill=(120, 140, 110))
    return img


def main():
    out = Path(sys.argv[1])
    animals = sys.argv[2:] or ANIMALS
    sheet = Image.new("RGB", (TILE * 4, TILE * len(animals)), (255, 255, 255))
    for row, animal in enumerate(animals):
        for col, (baby, asleep) in enumerate([(False, False), (False, True), (True, False), (True, True)]):
            sheet.paste(render(animal, baby, asleep), (col * TILE, row * TILE))
    out.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(out)
    print("wrote", out)


if __name__ == "__main__":
    main()
