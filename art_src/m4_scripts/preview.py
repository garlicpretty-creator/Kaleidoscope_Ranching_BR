"""Preview sheet for the hand-made block models: renders art/blocks/<id>.geo.json with its
texture from a three-quarter view, one tile per block (and per bone set, e.g. `busy`).

Only axis-aligned box-UV cubes are drawn, which is all these block models use.

Run with: python art_src/m4_scripts/preview.py out.png id[+bone+-bone] ...
(+bone shows a bone that is hidden by default, +-bone hides one, e.g. an eaten portion)
"""
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
SHADE = {"up": 1.0, "north": 0.86, "west": 0.7, "east": 0.74, "south": 0.8, "down": 0.55}


def faces(cube):
    """(name, texel rect, function from texel centre (a, b) in 0..1 to a model point)."""
    (x, y, z), (w, h, d) = cube["origin"], cube["size"]
    u, v = cube["uv"]
    tw, th, td = [max(1, round(s)) for s in (w, h, d)]
    x1, y1, z1 = x + w, y + h, z + d
    return [
        # The left strip is the face at the smallest x, as in Bedrock and Blockbench (test_foodkit.py).
        ("up", (u + td, v, tw, td), lambda a, b: (x + a * w, y1, z1 - b * d)),
        ("down", (u + td + tw, v, tw, td), lambda a, b: (x + a * w, y, z1 - b * d)),
        ("north", (u + td, v + td, tw, th), lambda a, b: (x + a * w, y1 - b * h, z)),
        ("south", (u + 2 * td + tw, v + td, tw, th), lambda a, b: (x1 - a * w, y1 - b * h, z1)),
        ("east", (u, v + td, td, th), lambda a, b: (x, y1 - b * h, z1 - a * d)),
        ("west", (u + td + tw, v + td, td, th), lambda a, b: (x1, y1 - b * h, z + a * d)),
    ]


def render(block, shown=()):
    model = json.loads((ART / f"{block}.geo.json").read_text(encoding="utf8"))["minecraft:geometry"][0]
    tex = Image.open(ART / f"{block}.png").convert("RGBA").load()
    hidden = {"busy", "open"} | {b["name"] for b in model["bones"] if b["name"].split("_")[0] in ("egg", "hay", "manure")}
    if "open" in shown:
        hidden.add("closed")
    hidden -= set(shown)
    hidden |= {s[1:] for s in shown if s.startswith("-")}  # "-piece_4" hides a bone
    color = np.zeros((TILE, TILE, 3), np.uint8)
    color[:] = (214, 224, 208)
    depth = np.full((TILE, TILE), -1e9)
    cy, sy, cp, sp = math.cos(YAW), math.sin(YAW), math.cos(PITCH), math.sin(PITCH)
    for bone in model["bones"]:
        if bone["name"] in hidden:
            continue
        for cube in bone.get("cubes", []):
            if not isinstance(cube["uv"], list):
                continue
            for name, (u0, v0, fw, fh), point in faces(cube):
                for j in range(fh):
                    for i in range(fw):
                        r, g, b, a = tex[u0 + i, v0 + j]
                        if not a:
                            continue
                        rgb = tuple(int(c * SHADE[name]) for c in (r, g, b))
                        for sj in range(SCALE * SUB // 2):
                            for si in range(SCALE * SUB // 2):
                                px, py, pz = point((i + (si + 0.5) / (SCALE * SUB // 2)) / fw,
                                                   (j + (sj + 0.5) / (SCALE * SUB // 2)) / fh)
                                rx, rz = px * cy - pz * sy, px * sy + pz * cy
                                ry, near = py * cp + rz * sp, py * sp - rz * cp
                                X, Y = int(TILE / 2 - rx * SCALE), int(TILE * 0.72 - ry * SCALE)
                                if 0 <= X < TILE and 0 <= Y < TILE and near > depth[Y, X]:
                                    depth[Y, X] = near
                                    color[Y, X] = rgb
    return Image.fromarray(color)


def main():
    out, tiles = sys.argv[1], sys.argv[2:]
    cols = min(4, len(tiles))
    sheet = Image.new("RGB", (cols * TILE, ((len(tiles) + cols - 1) // cols) * (TILE + 18)), (232, 238, 226))
    draw = ImageDraw.Draw(sheet)
    for n, tile in enumerate(tiles):
        block, *bones = tile.split("+")
        x, y = (n % cols) * TILE, (n // cols) * (TILE + 18)
        draw.text((x + 6, y + 3), block + (" / " + " ".join(bones) if bones else ""), fill=(50, 60, 50))
        sheet.paste(render(block, bones), (x, y + 18))
    sheet.save(out)


if __name__ == "__main__":
    main()
