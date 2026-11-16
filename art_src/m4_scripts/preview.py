"""Preview sheet for the hand-made block models: renders art/blocks/<id>.geo.json with its
texture from a three-quarter view, one tile per block (and per bone set, e.g. `busy`).

Only axis-aligned cubes are drawn, which is all these block models use: box UV, or per-face UV
laid out as the box UV would be (art_src/m4_scripts/blocks_m3.py material_uv), whose faces may
name a material instance drawn from <id>_<instance>.png. Texels that are partly transparent (the
candled eggs' shells) are blended over what is behind them.

Run with: python art_src/m4_scripts/preview.py out.png id[+bone+-bone][@facing] ...
(+bone shows a bone that is hidden by default, +-bone hides one, e.g. an eaten portion; +-name
may be a wildcard such as +-carcass_*, and a bone named with + is shown even if a wildcard hides
it. @east, @south or @west turns the block as the game does for that facing; ^lo-hi after it
frames the model's y band lo..hi in pixels, e.g. ^14-30 for the top of the two-block rack.)

"""
import fnmatch
import json
import math
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
ART = ROOT / "art" / "blocks"
TILE, SCALE, SUB = 260, 11, 3
YAW, PITCH = math.radians(-35), math.radians(28)
# The y rotation the block's minecraft:transformation gives each facing (tools/gen_blocks.mjs ROTATION).
FACING = {"north": 0, "east": 270, "south": 180, "west": 90}
SHADE = {"up": 1.0, "north": 0.86, "west": 0.7, "east": 0.74, "south": 0.8, "down": 0.55}


def faces(cube):
    """(name, texel rect, function from texel centre (a, b) in 0..1 to a model point, material). The
    rect is (u, v, w, h) for box UV; per-face UV gives (u, v, w, h) as written, w or h negative when
    the face is flipped (texel i of a flipped face is u - 1 - i). Material is the face's material
    instance (drawn from <id>_<instance>.png), or None for the block's own texture."""
    (x, y, z), (w, h, d) = cube["origin"], cube["size"]
    tw, th, td = [max(1, round(s)) for s in (w, h, d)]
    x1, y1, z1 = x + w, y + h, z + d
    if isinstance(cube["uv"], dict):
        box = {name: point for name, _, point, _ in faces({**cube, "uv": [0, 0]})}
        return [(name, (*f["uv"], *f["uv_size"]), box[name], f.get("material_instance"))
                for name, f in cube["uv"].items() if name in box]
    u, v = cube["uv"]
    return [(*face, None) for face in [
        # The left strip is the face at the smallest x, as in Bedrock and Blockbench (test_foodkit.py).
        ("up", (u + td, v, tw, td), lambda a, b: (x + a * w, y1, z1 - b * d)),
        ("down", (u + td + tw, v, tw, td), lambda a, b: (x + a * w, y, z1 - b * d)),
        ("north", (u + td, v + td, tw, th), lambda a, b: (x + a * w, y1 - b * h, z)),
        ("south", (u + 2 * td + tw, v + td, tw, th), lambda a, b: (x1 - a * w, y1 - b * h, z1)),
        ("east", (u, v + td, td, th), lambda a, b: (x, y1 - b * h, z1 - a * d)),
        ("west", (u + td + tw, v + td, td, th), lambda a, b: (x1, y1 - b * h, z + a * d)),
    ]]


def render(block, shown=(), facing="north", band=(0, 16)):
    model = json.loads((ART / f"{block}.geo.json").read_text(encoding="utf8"))["minecraft:geometry"][0]
    textures = {None: Image.open(ART / f"{block}.png").convert("RGBA").load()}
    hidden = {"busy", "open"} | {b["name"] for b in model["bones"] if b["name"].split("_")[0] in ("egg", "hay", "manure", "busy")}
    if "open" in shown:
        hidden.add("closed")
    names = [b["name"] for b in model["bones"]]
    hidden |= {n for s in shown if s.startswith("-") for n in fnmatch.filter(names, s[1:])}  # "-piece_4" hides a bone
    hidden -= set(shown)
    turn = math.radians(FACING[facing])
    ct, st = math.cos(turn), math.sin(turn)
    k = SCALE * 16 / (band[1] - band[0])  # screen pixels per model pixel
    color = np.zeros((TILE, TILE, 3), np.uint8)
    color[:] = (214, 224, 208)
    depth = np.full((TILE, TILE), -1e9)
    cy, sy, cp, sp = math.cos(YAW), math.sin(YAW), math.cos(PITCH), math.sin(PITCH)
    seen = {}  # partly transparent texels: (cube, face, pixel) -> (depth, colour, alpha)
    for bone in model["bones"]:
        if bone["name"] in hidden:
            continue
        for cube in bone.get("cubes", []):
            for name, (u0, v0, sw, sh), point, material in faces(cube):
                fw, fh = abs(int(sw)), abs(int(sh))
                if material not in textures:
                    textures[material] = Image.open(ART / f"{block}_{material}.png").convert("RGBA").load()
                tex = textures[material]
                for j in range(fh):
                    for i in range(fw):
                        r, g, b, a = tex[u0 + i if sw > 0 else u0 - 1 - i, v0 + j if sh > 0 else v0 - 1 - j]
                        if not a:
                            continue
                        rgb = tuple(int(c * SHADE[name]) for c in (r, g, b))
                        for sj in range(SCALE * SUB // 2):
                            for si in range(SCALE * SUB // 2):
                                mx, py, mz = point((i + (si + 0.5) / (SCALE * SUB // 2)) / fw,
                                                   (j + (sj + 0.5) / (SCALE * SUB // 2)) / fh)
                                px, pz = mx * ct + mz * st, mz * ct - mx * st
                                rx, rz = px * cy - pz * sy, px * sy + pz * cy
                                ry, near = py * cp + rz * sp, py * sp - rz * cp
                                X, Y = int(TILE / 2 - rx * k), int(TILE * 0.72 - (ry - band[0] * cp) * k)
                                if not (0 <= X < TILE and 0 <= Y < TILE):
                                    continue
                                if a < 255:
                                    seen[(id(cube), name, Y, X)] = (near, rgb, a / 255)
                                elif near > depth[Y, X]:
                                    depth[Y, X] = near
                                    color[Y, X] = rgb
    # Blend the see-through texels far to near over the solid picture.
    for (_, _, Y, X), (near, rgb, alpha) in sorted(seen.items(), key=lambda item: item[1][0]):
        if near > depth[Y, X]:
            color[Y, X] = [int(c * (1 - alpha) + n * alpha) for c, n in zip(color[Y, X], rgb)]
    return Image.fromarray(color)


def main():
    out, tiles = sys.argv[1], sys.argv[2:]
    cols = min(4, len(tiles))
    sheet = Image.new("RGB", (cols * TILE, ((len(tiles) + cols - 1) // cols) * (TILE + 18)), (232, 238, 226))
    draw = ImageDraw.Draw(sheet)
    for n, tile in enumerate(tiles):
        tile, _, view = tile.partition("@")
        facing, _, framed = view.partition("^")
        band = tuple(float(v) for v in framed.split("-")) if framed else (0, 16)
        block, *bones = tile.split("+")
        x, y = (n % cols) * TILE, (n // cols) * (TILE + 18)
        label = " ".join([*(f"@{facing}" for _ in [0] if facing), *(b for b in bones if not b.startswith("-"))])
        text = block + (" / " + label if label else "")
        draw.text((x + 6, y + 3), text if len(text) < 44 else text[:42] + "..", fill=(50, 60, 50))
        sheet.paste(render(block, bones, facing or "north", band), (x, y + 18))
    sheet.save(out)


if __name__ == "__main__":
    main()
