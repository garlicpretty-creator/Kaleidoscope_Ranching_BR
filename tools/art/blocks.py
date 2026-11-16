"""Procedural block models and paint, for blocks that have no hand-made model yet.

Every other block is hand-made: its model and texture live in art/blocks/ (written by
art_src/m4_scripts/*.py) and tools/gen_m3_art.py installs those as they are. Blocks
drawn here are stand-ins until their hand-made model exists (1.1 blocks start here).

Coordinates are block pixels with the origin at the bottom centre: x and z run
-8..8, y runs up. A bone named `busy` is shown while the station is processing
(`bone_visibility` in the block JSON, tools/gen_blocks.mjs).
"""

from __future__ import annotations

from model import Bone, Cube, Model, FACE_LIGHT, hash01, shade

WOOD = (150, 108, 66)
DARK_WOOD = (104, 74, 46)
HIDE = (176, 120, 78)
IRON = (152, 156, 164)
MINCE = (206, 108, 104)


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
    if p == "iron":
        return light(t, IRON)
    if p == "mince":
        return light(t, MINCE if hash01("m", t.point) > 0.3 else shade(MINCE, 1.15))
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


def meat_grinder():
    # A hand-cranked iron mincer on a wooden stand; while busy, mince in the tray.
    bones = [Bone("stand", None, (0, 0, 0)), Bone("busy", "stand", (0, 6, 0))]
    cubes = [
        Cube("stand", "dark_wood", (-6, 0, -5), (12, 4, 10)),
        Cube("stand", "iron", (-3, 4, -3), (6, 6, 6)),
        Cube("stand", "iron", (-4, 10, -4), (8, 3, 8)),
        Cube("stand", "iron", (3, 6, -1), (4, 2, 2), name="spout"),
        Cube("stand", "iron", (-5, 6, -0.5), (2, 1, 1), name="axle"),
        Cube("stand", "dark_wood", (-6, 6, -0.5), (1, 5, 1), name="crank"),
        Cube("stand", "wood", (4, 4, -3), (4, 1, 6), name="tray"),
        Cube("busy", "mince", (4.5, 5, -2.5), (3, 1, 5)),
    ]
    return Model("geometry.kaleidoscope_ranching.meat_grinder", bones, cubes, 32, 32)


ALL = {
    "tanning_rack": tanning_rack,
    "meat_grinder": meat_grinder,
}
