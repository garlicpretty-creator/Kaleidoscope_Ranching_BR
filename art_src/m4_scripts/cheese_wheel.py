"""Placeable aged cheese wheel (proposal: 熟成架 → 熟成乳酪輪, 可放置、可切塊).

A rounded wheel made of four quarter pieces, piece_1..piece_4, so the block can hide one
piece per slice cut (piece_4 first). Faces that point into the wheel are painted as cut
paste, so every partly eaten state shows a clean cheese interior.

Writes art/blocks/cheese_wheel.{geo.json,png} for the kaleidoscope_ranching:cheese_wheel block
(tools/gen_blocks.mjs, packs/BP/scripts/systems/cheeseWheel.js).
"""
import json
from pathlib import Path
from boxuv import Painter

ROOT = Path(__file__).resolve().parents[2]
NS = "kaleidoscope_ranching"
H = 5  # wheel height in pixels

RIND, RIND_DK, RIND_LT = (198, 140, 58), (150, 98, 40), (222, 170, 84)
PASTE, PASTE_DK, HOLE = (248, 218, 126), (230, 194, 100), (204, 162, 72)


def quarter(n, sx, sz, uv_a, uv_b):
    """Two overlapping boxes per quarter round off the wheel's corners."""
    ax = 0 if sx > 0 else -5
    bx = 0 if sx > 0 else -6
    az = 0 if sz > 0 else -6
    bz = 0 if sz > 0 else -5
    return (f"piece_{n}", "wheel", [0, 0, 0], [
        (f"q{n}a", [ax, 0, az], [5, H, 6], uv_a),
        (f"q{n}b", [bx, 0, bz], [6, H, 5], uv_b),
    ])


# piece_4 (the front-left quarter as placed) is cut first, so the cut face shows straight away
QUARTERS = [(1, 1, 1), (2, 1, -1), (3, -1, 1), (4, -1, -1)]
BONES = [("wheel", None, [0, 0, 0], None)] + [
    quarter(n, sx, sz, [(k % 2) * 22, (k // 2) * 11], [(k % 2) * 22, 22 + (k // 2) * 10])
    for k, (n, sx, sz) in enumerate(QUARTERS)
]


def inner_faces(sx, sz):
    """Faces of a quarter that look toward the wheel's centre (cut surfaces)."""
    return {"west" if sx > 0 else "east", "north" if sz > 0 else "south"}


def mix(a, b, t):
    return tuple(int(x + (y - x) * t) for x, y in zip(a, b))


def paint():
    p = Painter(64, 64, BONES, "aged_cheese_wheel")
    for n, sx, sz in QUARTERS:
        cut = inner_faces(sx, sz)

        def fn(f, i, j, w, h, fi, cut=cut, n=n):
            if f in cut:
                r = (i * 7 + j * 13 + n * 5) % 17
                return HOLE if r == 0 else PASTE_DK if r < 4 else PASTE
            if f == "top":
                # waxed rind: smooth, with a faint mottle
                return RIND_LT if (i * 5 + j * 3 + n) % 11 == 0 else RIND
            if f == "bottom":
                return RIND_DK
            # outer side: rind band, lighter at the top edge, darker at the base
            if j == 0:
                return RIND_LT
            if j == h - 1:
                return RIND_DK
            return mix(RIND, RIND_DK, 0.25) if (i + j) % 5 == 0 else RIND
        p.paint(f"q{n}a", fn)
        p.paint(f"q{n}b", fn)
    return p


def geo():
    bones = []
    for name, parent, pivot, cubes in BONES:
        b = {"name": name, "pivot": pivot}
        if parent:
            b["parent"] = parent
        if cubes:
            b["cubes"] = [{"origin": o, "size": s, "uv": uv} for _, o, s, uv in cubes]
        bones.append(b)
    return {"format_version": "1.12.0", "minecraft:geometry": [{
        "description": {"identifier": f"geometry.{NS}.cheese_wheel", "texture_width": 64, "texture_height": 64,
                        "visible_bounds_width": 1.5, "visible_bounds_height": 1.0, "visible_bounds_offset": [0, 0.25, 0]},
        "bones": bones}]}


def main():
    out = ROOT / "art" / "blocks"
    out.mkdir(parents=True, exist_ok=True)
    (out / "cheese_wheel.geo.json").write_text(json.dumps(geo(), indent=2) + "\n", encoding="utf8")
    paint().save(out / "cheese_wheel.png")
    print("cheese_wheel: ok")


if __name__ == "__main__":
    main()
