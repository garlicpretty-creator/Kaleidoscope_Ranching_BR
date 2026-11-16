"""Procedural block models and paint, for blocks that have no hand-made model yet.

Every other block is hand-made: its model and texture live in art/blocks/ (written by
art_src/m4_scripts/*.py) and tools/gen_m3_art.py installs those as they are. Only the
tanning rack is still drawn here.

Coordinates are block pixels with the origin at the bottom centre: x and z run
-8..8, y runs up. A bone named `busy` is shown while the station is processing
(`bone_visibility` in the block JSON, tools/gen_blocks.mjs).
"""

from __future__ import annotations

from model import Bone, Cube, Model, FACE_LIGHT, hash01, shade

WOOD = (150, 108, 66)
DARK_WOOD = (104, 74, 46)
HIDE = (176, 120, 78)


def light(t, base):
    f = FACE_LIGHT[t.face] * (0.95 + 0.08 * hash01("b", t.part, t.point))
    return shade(base, f)


def grain(t, base):
    """Wood with horizontal planks lines."""
    if t.face in ("front", "back", "side") and int(t.point[1]) % 4 == 0:
        return light(t, shade(base, 0.86))
    return light(t, base)


def paint(t):
    p = t.part
    if p == "wood":
        return grain(t, WOOD)
    if p == "dark_wood":
        return grain(t, DARK_WOOD)
    if p == "hide":
        # Cured hide: tan with a few darker blotches.
        return light(t, HIDE if hash01("h", t.point) > 0.2 else shade(HIDE, 0.85))
    raise KeyError(p)


def tanning_rack():
    # An upright frame; while busy a hide is laced across it to cure.
    bones = [Bone("frame", None, (0, 0, 0)), Bone("busy", "frame", (0, 8, 0))]
    cubes = [
        Cube("frame", "dark_wood", (-8, 0, -1), (2, 16, 2), name="post"),
        Cube("frame", "dark_wood", (6, 0, -1), (2, 16, 2), mirror_of="post"),
        Cube("frame", "wood", (-6, 14, -1), (12, 2, 2), name="beam"),
        Cube("frame", "wood", (-6, 2, -1), (12, 2, 2), mirror_of="beam"),
        Cube("frame", "dark_wood", (-8, 0, -4), (2, 1, 8), name="foot"),
        Cube("frame", "dark_wood", (6, 0, -4), (2, 1, 8), mirror_of="foot"),
        Cube("busy", "hide", (-5, 4, 0), (10, 10, 1)),
    ]
    return Model("geometry.kaleidoscope_ranching.tanning_rack", bones, cubes, 32, 32)


ALL = {
    "tanning_rack": tanning_rack,
}
