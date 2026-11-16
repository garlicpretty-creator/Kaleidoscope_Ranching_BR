#!/usr/bin/env python3
"""Splits the butcher rack's one big texture into a small texture per animal.

The hand-made rack (art/blocks/butcher_rack.geo.json) shipped with a single
512x1024 texture holding the frame and all thirty carcass bones. In the game
the carcasses came out in the frame's wood colours, so the texture was too big
or too tall for the block atlas. This rewrites the model so that:

  * the frame keeps butcher_rack.png, now SIZE x SIZE;
  * the carcass_X, skinned_X and cut_X bones use the material instance X,
    textured by butcher_rack_X.png, also SIZE x SIZE;

and every face's UV points at the same pixels as before, copied over. Block UVs
are divided by the model's texture size, so every texture shares one size.

Run once on the hand-made source; it refuses to run on a rack already split.
    python3 tools/art/split_rack_texture.py
"""

import json
import math
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
ART = ROOT / "art" / "blocks"
GEO = ART / "butcher_rack.geo.json"
TEXTURE = ART / "butcher_rack.png"
SIZES = (64, 128, 256)


def group_of(bone_name):
    for prefix in ("carcass_", "skinned_", "cut_"):
        if bone_name.startswith(prefix):
            return bone_name[len(prefix):]
    return None  # the frame and hook: the rack's own texture


def source_rect(face):
    (u, v), (w, h) = face["uv"], face["uv_size"]
    return (math.floor(min(u, u + w)), math.floor(min(v, v + h)), math.ceil(max(u, u + w)), math.ceil(max(v, v + h)))


def pack(rects, size):
    """Shelf-packs rects (x0, y0, x1, y1) into size x size with a 1px gap. Returns {rect: (x, y)} or None."""
    placed = {}
    x = y = shelf = 0
    for rect in sorted(rects, key=lambda r: (-(r[3] - r[1]), -(r[2] - r[0]))):
        w, h = rect[2] - rect[0], rect[3] - rect[1]
        if x + w > size:
            x, y, shelf = 0, y + shelf + 1, 0
        if w > size or y + h > size:
            return None
        placed[rect] = (x, y)
        x += w + 1
        shelf = max(shelf, h)
    return placed


def main():
    data = json.loads(GEO.read_text(encoding="utf8"))
    geo = data["minecraft:geometry"][0]
    if geo["description"]["texture_width"] <= max(SIZES):
        raise SystemExit("split_rack_texture: the rack is already split")
    source = Image.open(TEXTURE).convert("RGBA")

    groups = {}
    for bone in geo["bones"]:
        for cube in bone.get("cubes", []):
            for face in cube["uv"].values():
                groups.setdefault(group_of(bone["name"]), set()).add(source_rect(face))

    for size in SIZES:
        layouts = {g: pack(rects, size) for g, rects in groups.items()}
        if all(layouts.values()):
            break
    else:
        raise SystemExit("split_rack_texture: a group does not fit in the largest texture")

    for group, layout in layouts.items():
        image = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        for rect, (x, y) in layout.items():
            image.alpha_composite(source.crop(rect), (x, y))
        name = "butcher_rack" if group is None else f"butcher_rack_{group}"
        image.save(ART / f"{name}.png")

    for bone in geo["bones"]:
        group = group_of(bone["name"])
        for cube in bone.get("cubes", []):
            for face in cube["uv"].values():
                rect = source_rect(face)
                x, y = layouts[group][rect]
                (u, v) = face["uv"]
                face["uv"] = [round(x + (u - rect[0]), 4), round(y + (v - rect[1]), 4)]
                if group:
                    face["material_instance"] = group
    geo["description"]["texture_width"] = size
    geo["description"]["texture_height"] = size
    GEO.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf8")
    print(f"split_rack_texture: {len(layouts)} textures of {size}x{size}")


if __name__ == "__main__":
    main()
