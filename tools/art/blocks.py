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
MILK = (246, 244, 236)
CREAM = (250, 236, 200)
STRAW = (222, 192, 104)
CLOTH = (244, 242, 236)
YARN = (236, 228, 214)
DOWN = (250, 250, 246)
SILAGE = (150, 160, 70)


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
    if p == "milk":
        return light(t, MILK)
    if p == "cream":
        return light(t, CREAM)
    if p == "straw":
        return light(t, STRAW if hash01("s", t.point) > 0.25 else shade(STRAW, 0.85))
    if p == "cloth":
        return light(t, CLOTH if (int(t.point[0]) + int(t.point[2])) % 2 else shade(CLOTH, 0.94))
    if p == "yarn":
        return light(t, YARN)
    if p == "down":
        return light(t, DOWN)
    if p == "silage":
        return light(t, SILAGE if hash01("g", t.point) > 0.3 else shade(SILAGE, 0.85))
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


def milking_rack():
    # A low wooden stall: two side rails on posts, a feed box in front, a pail underneath.
    bones = [Bone("stall", None, (0, 0, 0))]
    cubes = [
        Cube("stall", "dark_wood", (-8, 0, -8), (2, 12, 2), name="post"),
        Cube("stall", "dark_wood", (6, 0, -8), (2, 12, 2), mirror_of="post"),
        Cube("stall", "dark_wood", (-8, 0, 6), (2, 12, 2), mirror_of="post"),
        Cube("stall", "dark_wood", (6, 0, 6), (2, 12, 2), mirror_of="post"),
        Cube("stall", "wood", (-8, 10, -6), (2, 1, 12), name="rail"),
        Cube("stall", "wood", (6, 10, -6), (2, 1, 12), mirror_of="rail"),
        Cube("stall", "wood", (-6, 6, -8), (12, 5, 2), name="feed_box"),
        Cube("stall", "straw", (-5, 10, -7.5), (10, 1, 1)),
        Cube("stall", "iron", (-2, 0, -1), (4, 4, 4), name="pail"),
        Cube("stall", "milk", (-1, 3, 0), (2, 1, 2)),
    ]
    return Model("geometry.kaleidoscope_ranching.milking_rack", bones, cubes, 64, 64)


def cream_separator():
    # An iron bowl on a stand with two spouts; while busy, cream shows in the bowl.
    bones = [Bone("frame", None, (0, 0, 0)), Bone("busy", "frame", (0, 12, 0))]
    cubes = [
        Cube("frame", "dark_wood", (-6, 0, -6), (12, 2, 12)),
        Cube("frame", "iron", (-2, 2, -2), (4, 8, 4)),
        Cube("frame", "iron", (-5, 10, -5), (10, 4, 10)),
        Cube("frame", "iron", (5, 8, -1), (3, 1, 2), name="spout"),
        Cube("frame", "iron", (-8, 8, -1), (3, 1, 2), mirror_of="spout"),
        Cube("frame", "dark_wood", (-1, 14, -1), (2, 2, 2)),
        Cube("busy", "cream", (-4, 13, -4), (8, 1, 8)),
    ]
    return Model("geometry.kaleidoscope_ranching.cream_separator", bones, cubes, 64, 64)


def ice_cream_churn():
    # A wooden bucket with iron hoops and a crank on top.
    bones = [Bone("bucket", None, (0, 0, 0)), Bone("busy", "bucket", (0, 10, 0))]
    cubes = [
        Cube("bucket", "wood", (-5, 0, -5), (10, 10, 10)),
        Cube("bucket", "iron", (-5.5, 2, -5.5), (11, 1, 11), name="hoop"),
        Cube("bucket", "iron", (-5.5, 7, -5.5), (11, 1, 11), mirror_of="hoop"),
        Cube("bucket", "iron", (-1, 10, -1), (2, 3, 2)),
        Cube("bucket", "iron", (-1, 12, -1), (6, 1, 1)),
        Cube("bucket", "dark_wood", (4, 12, -1), (1, 3, 1)),
        Cube("busy", "cream", (-4, 9, -4), (8, 1, 8)),
    ]
    return Model("geometry.kaleidoscope_ranching.ice_cream_churn", bones, cubes, 64, 64)


def spinning_wheel():
    # A wooden wheel on a slanted bench with a spindle; while busy, yarn on the spindle.
    bones = [Bone("frame", None, (0, 0, 0)), Bone("busy", "frame", (5, 9, 0))]
    cubes = [
        Cube("frame", "dark_wood", (-7, 4, -2), (14, 2, 4)),
        Cube("frame", "dark_wood", (-6, 0, -2), (2, 4, 1), name="leg"),
        Cube("frame", "dark_wood", (4, 0, 1), (2, 4, 1), mirror_of="leg"),
        Cube("frame", "dark_wood", (-6, 0, 1), (2, 4, 1), mirror_of="leg"),
        Cube("frame", "wood", (-5, 6, -0.5), (1, 9, 1), name="upright"),
        Cube("frame", "wood", (-9, 7, -0.5), (9, 9, 1)),
        Cube("frame", "iron", (4, 6, -0.5), (1, 4, 1)),
        Cube("busy", "yarn", (3, 9, -1), (3, 2, 2)),
    ]
    return Model("geometry.kaleidoscope_ranching.spinning_wheel", bones, cubes, 64, 64)


def weaving_loom():
    # A frame loom with a cloth on it; while busy, the cloth grows.
    bones = [Bone("frame", None, (0, 0, 0)), Bone("busy", "frame", (0, 4, 0))]
    cubes = [
        Cube("frame", "dark_wood", (-7, 0, -5), (2, 14, 2), name="post"),
        Cube("frame", "dark_wood", (5, 0, -5), (2, 14, 2), mirror_of="post"),
        Cube("frame", "dark_wood", (-7, 0, 3), (2, 8, 2), name="back"),
        Cube("frame", "dark_wood", (5, 0, 3), (2, 8, 2), mirror_of="back"),
        Cube("frame", "wood", (-5, 12, -5), (10, 2, 2)),
        Cube("frame", "wood", (-5, 6, -5), (10, 1, 10)),
        Cube("frame", "yarn", (-5, 7, -5), (10, 5, 1)),
        Cube("busy", "cloth", (-5, 3, -5), (10, 3, 1)),
    ]
    return Model("geometry.kaleidoscope_ranching.weaving_loom", bones, cubes, 64, 64)


def silage_barrel():
    # A sealed wooden barrel with iron hoops; while busy, the lid is weighted with a stone.
    bones = [Bone("barrel", None, (0, 0, 0)), Bone("busy", "barrel", (0, 14, 0))]
    cubes = [
        Cube("barrel", "wood", (-6, 0, -6), (12, 14, 12)),
        Cube("barrel", "iron", (-7, 2, -7), (14, 1, 14), name="hoop"),
        Cube("barrel", "iron", (-7, 11, -7), (14, 1, 14), mirror_of="hoop"),
        Cube("barrel", "dark_wood", (-5, 14, -5), (10, 1, 10)),
        Cube("busy", "silage", (-2, 15, -2), (4, 2, 4)),
    ]
    return Model("geometry.kaleidoscope_ranching.silage_barrel", bones, cubes, 64, 64)


def rug():
    bones = [Bone("rug", None, (0, 0, 0))]
    cubes = [Cube("rug", "cloth", (-8, 0, -8), (16, 1, 16))]
    return Model("geometry.kaleidoscope_ranching.rug", bones, cubes, 64, 64)


def down_pillow():
    bones = [Bone("pillow", None, (0, 0, 0))]
    cubes = [
        Cube("pillow", "down", (-6, 0, -4), (12, 3, 8)),
        Cube("pillow", "cloth", (-5, 3, -3), (10, 1, 6)),
    ]
    return Model("geometry.kaleidoscope_ranching.down_pillow", bones, cubes, 64, 64)


def down_quilt():
    bones = [Bone("quilt", None, (0, 0, 0))]
    cubes = [
        Cube("quilt", "down", (-8, 0, -8), (16, 2, 16)),
    ]
    return Model("geometry.kaleidoscope_ranching.down_quilt", bones, cubes, 64, 64)


ALL = {
    "tanning_rack": tanning_rack,
    "meat_grinder": meat_grinder,
    "milking_rack": milking_rack,
    "cream_separator": cream_separator,
    "ice_cream_churn": ice_cream_churn,
    "spinning_wheel": spinning_wheel,
    "weaving_loom": weaving_loom,
    "silage_barrel": silage_barrel,
    "rug": rug,
    "down_pillow": down_pillow,
    "down_quilt": down_quilt,
}
