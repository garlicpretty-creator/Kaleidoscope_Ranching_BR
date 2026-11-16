"""Preview sheet for what is worn and hung (1.1 美術): the three worn items on a plain
mannequin, each kind of animal gear on the animals that take it (standing, young and asleep),
and the butcher rack with pieces air-drying.

Everything is rendered from the files in packs/RP and art/blocks as the game would combine
them: the animal's model with its sleep animation, the gear geometry on the same bones, each
with its own texture. The mannequin is only a stand-in for the player (flat colours).

Run with: python art_src/m4_scripts/gear_preview.py [out.png]   (default docs/art/gear_preview.png)
"""
import json
import math
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

from sleep_preview import face_rects, molang, rot


def molang_bool(expr):
    """Evaluates a render-controller condition already reduced to True/False, and, or, not and
    parentheses, without running it as Python: anything else is an error."""
    import ast

    def walk(node):
        if isinstance(node, ast.Expression):
            return walk(node.body)
        if isinstance(node, ast.Constant) and isinstance(node.value, bool):
            return node.value
        if isinstance(node, ast.UnaryOp) and isinstance(node.op, ast.Not):
            return not walk(node.operand)
        if isinstance(node, ast.BoolOp):
            values = [walk(v) for v in node.values]
            return all(values) if isinstance(node.op, ast.And) else any(values)
        raise ValueError(f"unsupported condition: {expr!r}")
    return walk(ast.parse(expr.strip(), mode="eval"))


def face_point(cube, face, a, b):
    """The model point at (a, b) of a face's texels, 0..1 across and down, as Bedrock lays out
    box UV: the first column of the top, bottom and north faces is at the smallest x, and the
    left strip of the unwrap ("east" to boxuv.Painter) is the face at the smallest x."""
    (x, y, z), (w, h, d) = cube["origin"], cube["size"]
    x1, y1, z1 = x + w, y + h, z + d
    return {
        "up": (x + a * w, y1, z1 - b * d), "down": (x + a * w, y, z1 - b * d),
        "north": (x + a * w, y1 - b * h, z), "south": (x1 - a * w, y1 - b * h, z1),
        "east": (x, y1 - b * h, z1 - a * d), "west": (x1, y1 - b * h, z + a * d),
    }[face]

ROOT = Path(__file__).resolve().parents[2]
RP = ROOT / "packs" / "RP"
NS = "kaleidoscope_ranching"
TILE = 300
PITCH = math.radians(22)
SHADE = {"up": 1.0, "north": 0.86, "west": 0.76, "east": 0.72, "south": 0.8, "down": 0.55}
BACKGROUND = (214, 224, 208)


def load(path):
    return json.loads(path.read_text(encoding="utf8"))


class Layer:
    """One geometry with its texture; `shown(bone name)` says which bones are drawn."""

    def __init__(self, bones, texture, size, shown=lambda name: True):
        self.bones = {b["name"]: b for b in bones}
        self.texture = texture.convert("RGBA")
        if self.texture.size != tuple(size):
            self.texture = self.texture.resize(size, Image.NEAREST)
        self.size, self.shown = size, shown


def grown(cube):
    g = cube.get("inflate", 0)
    return dict(cube, origin=[v - g for v in cube["origin"]], size=[v + 2 * g for v in cube["size"]])


def render(layers, anim=None, baby=False, yaw=-40, scale=8.0, ground=0.74, background=BACKGROUND):
    """Draws the layers into one tile; every layer is posed by `anim` through its own bones."""
    anim = anim or {}
    SS = int(scale * 1.6) + 2  # samples per texel: enough that no screen pixel is skipped
    color = np.zeros((TILE, TILE, 3), np.uint8)
    color[:] = background
    depth = np.full((TILE, TILE), -1e9)
    cy, sy, cp, sp = math.cos(math.radians(yaw)), math.sin(math.radians(yaw)), math.cos(PITCH), math.sin(PITCH)
    for layer in layers:
        tex, (tw, th) = np.asarray(layer.texture), layer.size

        def world(name, bones=layer.bones):
            b = bones[name]
            piv = np.array(b.get("pivot", [0, 0, 0]), float)
            st = anim.get(name, {})
            r = rot(*[molang(v, baby) for v in st.get("rotation", [0, 0, 0])]) @ rot(*b.get("rotation", [0, 0, 0]))
            s = np.diag([molang(v, baby) for v in st.get("scale", [1, 1, 1])])
            t = np.array([molang(v, baby) for v in st.get("position", [0, 0, 0])])
            m = r @ s
            local = lambda p: piv + t + m @ (np.asarray(p) - piv)
            parent = b.get("parent")
            if parent:
                up = world(parent)
                return lambda p: up(local(p))
            return local

        for name, bone in layer.bones.items():
            if not layer.shown(name):
                continue
            place = world(name)
            for cube in bone.get("cubes", []):
                box = grown(cube)
                for face, (u, v, uw, uh) in face_rects(cube).items():
                    nw, nh = max(1, round(abs(uw))), max(1, round(abs(uh)))
                    if not uw or not uh:
                        continue
                    # The face is flat, so three posed corners place every sample on it.
                    o, pu, pv = (np.array(place(face_point(box, face, a, b))) for a, b in ((0, 0), (1, 0), (0, 1)))
                    ii, jj = np.meshgrid(np.arange(nw * SS), np.arange(nh * SS))
                    ii, jj = ii.ravel(), jj.ravel()
                    px = (u + np.where(uw > 0, ii // SS, -(ii // SS) - 1)).astype(int)
                    py = (v + np.where(uh > 0, jj // SS, -(jj // SS) - 1)).astype(int)
                    keep = (px >= 0) & (px < tw) & (py >= 0) & (py < th)
                    ii, jj, px, py = ii[keep], jj[keep], px[keep], py[keep]
                    rgba = tex[py, px]
                    keep = rgba[:, 3] >= 128
                    ii, jj, rgba = ii[keep], jj[keep], rgba[keep]
                    pts = o + np.outer((ii + 0.5) / (nw * SS), pu - o) + np.outer((jj + 0.5) / (nh * SS), pv - o)
                    x, y, z = pts[:, 0], pts[:, 1], pts[:, 2]
                    x2, z2 = x * cy - z * sy, x * sy + z * cy
                    y2, near = y * cp - z2 * sp, -(y * sp + z2 * cp)
                    sx, syp = (TILE / 2 + x2 * scale).astype(int), (TILE * ground - y2 * scale).astype(int)
                    keep = (sx >= 0) & (sx < TILE) & (syp >= 0) & (syp < TILE)
                    sx, syp, near, rgba = sx[keep], syp[keep], near[keep], rgba[keep]
                    order = np.argsort(near)  # nearest last, so it wins where samples share a pixel
                    sx, syp, near, rgba = sx[order], syp[order], near[order], rgba[order]
                    front = near > depth[syp, sx]
                    depth[syp[front], sx[front]] = near[front]
                    color[syp[front], sx[front]] = (rgba[front, :3] * SHADE[face]).astype(np.uint8)
    return Image.fromarray(color)


# --- Animals ---------------------------------------------------------------------


def animal_layers(animal, worn, baby=False, asleep=False, skin=None, sheared=False, saddled=False):
    """The animal and its gear layer, with the gear kinds in `worn` switched on."""
    entity = load(RP / "entity" / f"{animal}.entity.json")["minecraft:client_entity"]["description"]
    values = {f"q.property('{NS}:gear_{kind}')": "True" for kind in worn}

    def truth(expr):
        e = expr.replace("q.is_baby", str(baby)).replace(f"q.property('{NS}:sleeping')", str(asleep))
        for key, value in values.items():
            e = e.replace(key, value)
        e = e.replace(f"q.property('{NS}:sex') == 'male'", "False")
        e = e.replace("q.is_saddled", str(saddled)).replace("q.is_sheared", str(sheared))
        import re
        e = re.sub(r"q\.property\('[^']+'\)", "False", e)
        return molang_bool(e.replace("&&", " and ").replace("||", " or ").replace("!", " not "))

    def layer(geo_key, tex_key, controller):
        geo = next(g for path in (RP / "models" / "entity").glob("*.json")
                   for g in load(path)["minecraft:geometry"] if g["description"]["identifier"] == entity["geometry"][geo_key])
        rules = controller["part_visibility"]
        bones = {b["name"]: b for b in geo["bones"]}

        def shown(name):
            while name:  # a hidden parent hides its children here, the stricter reading
                for rule in rules:
                    key, expr = next(iter(rule.items()))
                    if key == name and isinstance(expr, str) and not truth(expr):
                        return False
                name = bones[name].get("parent")
            return True
        texture = Image.open(RP / f"{entity['textures'][tex_key]}.png")
        return Layer(geo["bones"], texture, (geo["description"]["texture_width"], geo["description"]["texture_height"]), shown)

    controllers = {}
    for path in (RP / "render_controllers").glob("*.json"):
        controllers.update(load(path)["render_controllers"])
    textures = entity["textures"]
    skin = skin or ("baby" if baby and "baby" in textures else "female")
    if animal == "sheep":
        skin = "baby_white" if baby else "female_white"
    layers = [layer("default", skin, controllers[f"controller.render.{NS}.{animal}"])]
    if worn:
        layers.append(layer("gear", "gear", controllers[f"controller.render.{NS}.{animal}.gear"]))
    anim = next(iter(load(RP / "animations" / f"{animal}.sleep.animation.json")["animations"].values()))["bones"] if asleep else None
    return layers, anim


def animal_tile(animal, worn, baby=False, asleep=False, yaw=-40, scale=8.0, sheared=False, saddled=False):
    layers, anim = animal_layers(animal, worn, baby, asleep, sheared=sheared, saddled=saddled)
    return render(layers, anim, baby, yaw, scale)


# --- The mannequin and what it wears ---------------------------------------------

SKIN, SHIRT, SLEEVE, TROUSERS = (206, 170, 140), (150, 160, 170), (128, 140, 152), (96, 104, 120)


def mannequin():
    """A plain figure with the player's proportions and bone names, in flat colours."""
    parts = [
        ("head", "body", [0, 24, 0], [-4, 24, -4], [8, 8, 8], SKIN),
        ("body", "waist", [0, 24, 0], [-4, 12, -2], [8, 12, 4], SHIRT),
        ("rightArm", "body", [-5, 22, 0], [-8, 12, -2], [4, 12, 4], SLEEVE),
        ("leftArm", "body", [5, 22, 0], [4, 12, -2], [4, 12, 4], SLEEVE),
        ("rightLeg", "root", [-1.9, 12, 0], [-3.9, 0, -2], [4, 12, 4], TROUSERS),
        ("leftLeg", "root", [1.9, 12, 0], [-0.1, 0, -2], [4, 12, 4], TROUSERS),
    ]
    texture = Image.new("RGBA", (64, 128), (0, 0, 0, 0))
    bones = [{"name": "root", "pivot": [0, 0, 0]}, {"name": "waist", "parent": "root", "pivot": [0, 12, 0]}]
    y = 0
    for name, parent, pivot, origin, size, colour in parts:
        w, h, d = size
        texture.paste(colour + (255,), (0, y, 2 * (w + d), y + d + h))
        if name == "head":  # two eyes, so the front reads as the front
            for x in (d + 1, d + w - 3):
                texture.paste((60, 50, 50, 255), (x, y + d + 4, x + 2, y + d + 5))
        bone = {"name": name, "parent": parent, "pivot": pivot, "cubes": [{"origin": origin, "size": size, "uv": [0, y]}]}
        bones.insert(2, bone) if name == "body" else bones.append(bone)
        y += d + h
    return Layer(bones, texture, (64, 128))


def worn_tile(items, yaw, scale=7.0):
    layers = [mannequin()]
    for item in items:
        attachable = load(RP / "attachables" / f"{item}.json")["minecraft:attachable"]["description"]
        geo = load(RP / "models" / "entity" / f"wearable_{item}.geo.json")["minecraft:geometry"][0]
        size = (geo["description"]["texture_width"], geo["description"]["texture_height"])
        layers.append(Layer(geo["bones"], Image.open(RP / f"{attachable['textures']['default']}.png"), size))
    return render(layers, yaw=yaw, scale=scale, ground=0.9 if scale < 10 else 2.2)


def held_tile(item, yaw=-25):
    """The flat icon sprite the attachable shows in a hand (bound to the hand bone in game)."""
    attachable = load(RP / "attachables" / f"{item}.json")["minecraft:attachable"]["description"]
    geo = load(RP / "models" / "entity" / f"wearable_{item}_held.geo.json")["minecraft:geometry"][0]
    size = (geo["description"]["texture_width"], geo["description"]["texture_height"])
    return render([Layer(geo["bones"], Image.open(RP / f"{attachable['textures']['held']}.png"), size)], yaw=yaw, scale=22, ground=0.8)


# --- The rack --------------------------------------------------------------------


def rack_tile(pieces, yaw=-30):
    geo = load(ROOT / "art" / "blocks" / "butcher_rack.geo.json")["minecraft:geometry"][0]
    size = (geo["description"]["texture_width"], geo["description"]["texture_height"])
    shown = lambda name: name == "frame" or (name.startswith("dry_") and int(name[4:]) <= pieces)
    layer = Layer(geo["bones"], Image.open(ROOT / "art" / "blocks" / "butcher_rack.png"), size, shown)
    return render([layer], yaw=yaw, scale=7.5, ground=0.92)


def main():
    out = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "docs" / "art" / "gear_preview.png"
    rows = [
        [("毛帽 wool_hat", lambda: worn_tile(["wool_hat"], -35)), ("圍巾 wool_scarf", lambda: worn_tile(["wool_scarf"], -35)),
         ("皮圍裙 leather_apron", lambda: worn_tile(["leather_apron"], -35)), ("hat + scarf, from behind", lambda: worn_tile(["wool_hat", "wool_scarf"], 145)),
         ("apron, from behind", lambda: worn_tile(["leather_apron"], 145))],
        [("buffalo: harness", lambda: animal_tile("buffalo", ["harness"], scale=7)), ("buffalo: harness + plough", lambda: animal_tile("buffalo", ["harness", "plough"], yaw=-60, scale=5.5)),
         ("the same from behind", lambda: animal_tile("buffalo", ["harness", "plough"], yaw=150, scale=5.5)), ("buffalo: harness + blanket", lambda: animal_tile("buffalo", ["harness", "blanket"], scale=7)),
         ("asleep, all three", lambda: animal_tile("buffalo", ["harness", "plough", "blanket"], asleep=True, yaw=-60, scale=5.5))],
        [("cow: blanket", lambda: animal_tile("cow", ["blanket"])), ("sheep: blanket", lambda: animal_tile("sheep", ["blanket"])),
         ("goat: blanket", lambda: animal_tile("goat", ["blanket"])), ("pig: blanket", lambda: animal_tile("pig", ["blanket"])),
         ("calf: blanket", lambda: animal_tile("cow", ["blanket"], baby=True))],
        [("sheared sheep: blanket", lambda: animal_tile("sheep", ["blanket"], sheared=True)),
         ("sheared sheep, from behind", lambda: animal_tile("sheep", ["blanket"], sheared=True, yaw=140)),
         ("sheared lamb: blanket", lambda: animal_tile("sheep", ["blanket"], baby=True, sheared=True)),
         ("saddled pig: blanket", lambda: animal_tile("pig", ["blanket"], saddled=True)),
         ("saddled pig, no blanket", lambda: animal_tile("pig", [], saddled=True))],
        [("cow asleep: blanket", lambda: animal_tile("cow", ["blanket"], asleep=True)), ("pig asleep: blanket", lambda: animal_tile("pig", ["blanket"], asleep=True)),
         ("yak: pack bag", lambda: animal_tile("yak", ["pack_bag"], scale=7)), ("yak: pack bag, from behind", lambda: animal_tile("yak", ["pack_bag"], yaw=140, scale=7)),
         ("yak asleep: pack bag", lambda: animal_tile("yak", ["pack_bag"], asleep=True, scale=7))],
        [("held: wool_hat icon", lambda: held_tile("wool_hat")), ("held: wool_scarf icon", lambda: held_tile("wool_scarf")),
         ("held: leather_apron icon", lambda: held_tile("leather_apron")), ("held: hat icon, back", lambda: held_tile("wool_hat", 155))],
        [("rack: nothing drying", lambda: rack_tile(0)), ("rack: 1 piece drying", lambda: rack_tile(1)), ("rack: 2 pieces", lambda: rack_tile(2)),
         ("rack: 4 pieces", lambda: rack_tile(4)), ("rack: 4 pieces, from the side", lambda: rack_tile(4, yaw=-75))],
    ]
    only = sys.argv[2:]
    if only:
        rows = [rows[int(n)] for n in only]
    cols = max(len(r) for r in rows)
    sheet = Image.new("RGB", (cols * TILE, len(rows) * (TILE + 18)), (232, 238, 226))
    draw = ImageDraw.Draw(sheet)
    for r, row in enumerate(rows):
        for c, (label, tile) in enumerate(row):
            sheet.paste(tile(), (c * TILE, r * (TILE + 18) + 18))
            draw.text((c * TILE + 6, r * (TILE + 18) + 3), label.encode("ascii", "ignore").decode().strip(), fill=(50, 60, 50))
    out.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(out)
    print("wrote", out)


if __name__ == "__main__":
    main()
