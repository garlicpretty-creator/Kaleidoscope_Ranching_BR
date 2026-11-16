"""Block models and paint for the M3 blocks.

Coordinates are block pixels with the origin at the bottom centre: x and z run
-8..8, y runs up. Bones whose names start with a state rule are toggled by
`bone_visibility` in the block JSON (tools/gen_blocks.mjs):

  egg_N       shown when the stored egg count is at least N
  busy        shown while a station is processing
  carcass_X   the hanging carcass X, before half of its cuts are taken
  cut_X       the same carcass, partly cut
"""

from __future__ import annotations

from model import Bone, Cube, Model, FACE_LIGHT, hash01, shade

WOOD = (150, 108, 66)
DARK_WOOD = (104, 74, 46)
IRON = (152, 156, 164)
STRAW = (222, 192, 104)
EGG = (234, 216, 184)
GLASS = (206, 228, 236)
MILK = (246, 244, 236)
CHEESE = (242, 206, 102)
TERRACOTTA = (164, 92, 62)
CLOTH = (232, 222, 200)
FAT = (244, 232, 218)

# Hanging carcass shapes: (size class, flesh colour). Kept in step with
# data/animals.js; tools/gen_blocks.mjs checks every carcass has a shape.
CARCASS_LOOK = {
    "cow_carcass": ("large", (172, 62, 58)),
    "buffalo_carcass": ("large", (150, 52, 50)),
    "yak_carcass": ("large", (156, 58, 54)),
    "pig_carcass": ("medium", (236, 160, 150)),
    "sheep_carcass": ("medium", (178, 78, 72)),
    "goat_carcass": ("medium", (170, 74, 68)),
    "chicken_carcass": ("small", (244, 214, 190)),
    "duck_carcass": ("small", (236, 200, 176)),
    "goose_carcass": ("small", (240, 214, 190)),
    "rabbit_carcass": ("small", (198, 98, 92)),
}

# (origin, size) of the full and the partly cut carcass, hanging from y = 26.
CARCASS_SHAPES = {
    "large": (((-3, 6, -2.5), (6, 20, 5)), ((-3, 14, -2.5), (6, 12, 5))),
    "medium": (((-2.5, 10, -2), (5, 16, 4)), ((-2.5, 17, -2), (5, 9, 4))),
    "small": (((-1.5, 16, -1.5), (3, 10, 3)), ((-1.5, 20, -1.5), (3, 6, 3))),
}


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
    if p in ("iron", "hook", "screw", "hoop"):
        return light(t, IRON)
    if p == "straw":
        return light(t, STRAW if hash01("s", t.point) > 0.25 else shade(STRAW, 0.85))
    if p == "egg":
        return light(t, EGG)
    if p == "glass":
        # Only the frame of each pane is drawn; the middle stays transparent.
        if t.face in ("front", "back", "side") and 0 < t.a < t.width - 1 and 0 < t.b < t.height - 1:
            return (0, 0, 0, 0)
        if t.face in ("top", "bottom"):
            return (0, 0, 0, 0)
        return light(t, GLASS)
    if p == "milk":
        return light(t, MILK)
    if p == "cheese":
        return light(t, CHEESE)
    if p == "terracotta":
        return light(t, TERRACOTTA)
    if p == "cloth":
        return light(t, CLOTH)
    if p == "lamp":
        return (255, 196, 96)
    if p.startswith("carcass:"):
        flesh = CARCASS_LOOK[p.split(":", 1)[1]][1]
        if t.face in ("front", "back", "side") and int(t.point[1]) % 3 == 0:
            return light(t, FAT)  # ribs and fat seams
        return light(t, flesh)
    raise KeyError(p)


def butcher_rack():
    bones = [Bone("frame", None, (0, 0, 0))]
    cubes = [
        Cube("frame", "dark_wood", (-8, 0, -1), (2, 30, 2), name="post"),
        Cube("frame", "dark_wood", (6, 0, -1), (2, 30, 2), mirror_of="post"),
        Cube("frame", "wood", (-8, 28, -1.5), (16, 2, 3)),
        Cube("frame", "wood", (-8, 0, -4), (2, 1, 8), name="foot"),
        Cube("frame", "wood", (6, 0, -4), (2, 1, 8), mirror_of="foot"),
        Cube("frame", "hook", (-0.5, 26, -0.5), (1, 2, 1)),
    ]
    for carcass, (size, _colour) in CARCASS_LOOK.items():
        short = carcass[: -len("_carcass")]
        (full_o, full_s), (cut_o, cut_s) = CARCASS_SHAPES[size]
        bones.append(Bone(f"carcass_{short}", "frame", (0, 26, 0)))
        bones.append(Bone(f"cut_{short}", "frame", (0, 26, 0)))
        cubes.append(Cube(f"carcass_{short}", f"carcass:{carcass}", full_o, full_s))
        cubes.append(Cube(f"cut_{short}", f"carcass:{carcass}", cut_o, cut_s))
    return Model("geometry.kaleidoscope_ranching.butcher_rack", bones, cubes, 64, 64)


def nest_box():
    bones = [Bone("box", None, (0, 0, 0))] + [Bone(f"egg_{n}", "box", (0, 3, 0)) for n in range(1, 5)]
    cubes = [
        Cube("box", "wood", (-7, 0, -7), (14, 2, 14)),
        Cube("box", "wood", (-7, 2, -7), (14, 4, 1), name="wall_x"),
        Cube("box", "wood", (-7, 2, 6), (14, 4, 1), mirror_of="wall_x"),
        Cube("box", "wood", (-7, 2, -6), (1, 4, 12), name="wall_z"),
        Cube("box", "wood", (6, 2, -6), (1, 4, 12), mirror_of="wall_z"),
        Cube("box", "straw", (-6, 2, -6), (12, 1, 12)),
    ]
    for n, (x, z) in enumerate([(-4, -3), (1, -4), (-3, 1), (2, 2)], start=1):
        cubes.append(Cube(f"egg_{n}", "egg", (x, 3, z), (2, 3, 2), name=None if n > 1 else "egg", mirror_of="egg" if n > 1 else None))
    return Model("geometry.kaleidoscope_ranching.nest_box", bones, cubes, 64, 64)


def incubator():
    bones = [Bone("base", None, (0, 0, 0)), Bone("busy", "base", (0, 12, 0))] + [
        Bone(f"egg_{n}", "base", (0, 3, 0)) for n in range(1, 5)
    ]
    cubes = [
        Cube("base", "wood", (-7, 0, -7), (14, 3, 14)),
        Cube("base", "glass", (-6, 3, -6), (12, 8, 12)),
        Cube("base", "wood", (-7, 11, -7), (14, 1, 14)),
        Cube("base", "straw", (-5, 3, -5), (10, 1, 10)),
        Cube("busy", "lamp", (-1, 12, -1), (2, 2, 2)),
    ]
    for n, (x, z) in enumerate([(-4, -4), (1, -4), (-4, 1), (1, 1)], start=1):
        cubes.append(Cube(f"egg_{n}", "egg", (x, 4, z), (2, 3, 2), name=None if n > 1 else "egg", mirror_of="egg" if n > 1 else None))
    return Model("geometry.kaleidoscope_ranching.incubator", bones, cubes, 64, 64)


def butter_churn():
    bones = [Bone("churn", None, (0, 0, 0)), Bone("busy", "churn", (0, 13, 0))]
    cubes = [
        Cube("churn", "wood", (-4, 0, -4), (8, 12, 8)),
        Cube("churn", "hoop", (-4.5, 2, -4.5), (9, 1, 9), name="hoop"),
        Cube("churn", "hoop", (-4.5, 9, -4.5), (9, 1, 9), mirror_of="hoop"),
        Cube("churn", "dark_wood", (-4.5, 12, -4.5), (9, 1, 9)),
        Cube("churn", "wood", (-0.5, 13, -0.5), (1, 8, 1)),
        Cube("churn", "wood", (-2, 20, -0.5), (4, 1, 1)),
        Cube("busy", "milk", (-3, 12.5, -3), (6, 0.5, 6)),
    ]
    return Model("geometry.kaleidoscope_ranching.butter_churn", bones, cubes, 64, 64)


def cheese_press():
    bones = [Bone("press", None, (0, 0, 0)), Bone("busy", "press", (0, 8, 0))]
    cubes = [
        Cube("press", "wood", (-7, 0, -7), (14, 2, 14)),
        Cube("press", "dark_wood", (-4, 2, -4), (8, 6, 8)),
        Cube("press", "wood", (-7, 2, -1), (2, 12, 2), name="post"),
        Cube("press", "wood", (5, 2, -1), (2, 12, 2), mirror_of="post"),
        Cube("press", "wood", (-7, 14, -1), (14, 2, 2)),
        Cube("press", "screw", (-0.5, 9, -0.5), (1, 5, 1)),
        Cube("press", "wood", (-3.5, 8, -3.5), (7, 1, 7)),
        Cube("busy", "cheese", (-3, 7.5, -3), (6, 0.5, 6)),
    ]
    return Model("geometry.kaleidoscope_ranching.cheese_press", bones, cubes, 64, 64)


def aging_rack():
    bones = [Bone("rack", None, (0, 0, 0)), Bone("busy", "rack", (0, 8, 0))]
    cubes = [
        Cube("rack", "dark_wood", (-8, 0, -8), (2, 16, 2), name="post"),
        Cube("rack", "dark_wood", (6, 0, -8), (2, 16, 2), mirror_of="post"),
        Cube("rack", "dark_wood", (-8, 0, 6), (2, 16, 2), mirror_of="post"),
        Cube("rack", "dark_wood", (6, 0, 6), (2, 16, 2), mirror_of="post"),
        Cube("rack", "wood", (-7, 1, -7), (14, 1, 14), name="shelf"),
        Cube("rack", "wood", (-7, 8, -7), (14, 1, 14), mirror_of="shelf"),
        Cube("rack", "wood", (-7, 15, -7), (14, 1, 14), mirror_of="shelf"),
        Cube("busy", "cheese", (-5, 2, -3), (5, 3, 5), name="wheel"),
        Cube("busy", "cheese", (1, 2, -2), (5, 3, 5), mirror_of="wheel"),
        Cube("busy", "cheese", (-3, 9, -3), (5, 3, 5), mirror_of="wheel"),
    ]
    return Model("geometry.kaleidoscope_ranching.aging_rack", bones, cubes, 64, 64)


def hitching_post():
    # A squared oak post with an iron tie ring near the top.
    bones = [Bone("post", None, (0, 0, 0))]
    cubes = [
        Cube("post", "dark_wood", (-2, 0, -2), (4, 16, 4)),
        Cube("post", "wood", (-3, 14, -3), (6, 2, 6)),
        Cube("post", "iron", (-1, 10, -3), (2, 2, 1), name="ring"),
        Cube("post", "iron", (-1, 10, 2), (2, 2, 1), mirror_of="ring"),
    ]
    return Model("geometry.kaleidoscope_ranching.hitching_post", bones, cubes, 32, 32)


def hay_rack():
    # A slatted wooden manger; hay fills it in three layers (state hay 1-3).
    bones = [Bone("rack", None, (0, 0, 0))] + [Bone(f"hay_{n}", "rack", (0, 4 + 4 * n, 0)) for n in (1, 2, 3)]
    cubes = [
        Cube("rack", "dark_wood", (-8, 0, -6), (2, 16, 2), name="leg"),
        Cube("rack", "dark_wood", (6, 0, -6), (2, 16, 2), mirror_of="leg"),
        Cube("rack", "dark_wood", (-8, 0, 4), (2, 16, 2), mirror_of="leg"),
        Cube("rack", "dark_wood", (6, 0, 4), (2, 16, 2), mirror_of="leg"),
        Cube("rack", "wood", (-6, 4, -5), (12, 1, 10), name="floor"),
        Cube("rack", "wood", (-6, 6, -6), (12, 1, 1), name="slat"),
        Cube("rack", "wood", (-6, 10, -6), (12, 1, 1), mirror_of="slat"),
        Cube("rack", "wood", (-6, 14, -6), (12, 1, 1), mirror_of="slat"),
        Cube("rack", "wood", (-6, 6, 5), (12, 1, 1), mirror_of="slat"),
        Cube("rack", "wood", (-6, 10, 5), (12, 1, 1), mirror_of="slat"),
        Cube("rack", "wood", (-6, 14, 5), (12, 1, 1), mirror_of="slat"),
        Cube("hay_1", "straw", (-6, 5, -5), (12, 3, 10), name="hay"),
        Cube("hay_2", "straw", (-6, 8, -5), (12, 3, 10), mirror_of="hay"),
        Cube("hay_3", "straw", (-6, 11, -5), (12, 4, 10)),
    ]
    return Model("geometry.kaleidoscope_ranching.hay_rack", bones, cubes, 64, 64)


def fermenting_jar():
    bones = [Bone("jar", None, (0, 0, 0)), Bone("busy", "jar", (0, 1, 0))]
    cubes = [
        Cube("jar", "glass", (-4, 0, -4), (8, 10, 8)),
        Cube("jar", "cloth", (-3.5, 10, -3.5), (7, 1, 7)),
        Cube("jar", "hoop", (-2, 11, -2), (4, 1, 4)),
        Cube("busy", "milk", (-3, 1, -3), (6, 7, 6)),
    ]
    return Model("geometry.kaleidoscope_ranching.fermenting_jar", bones, cubes, 64, 64)


def pickling_vat():
    bones = [Bone("vat", None, (0, 0, 0)), Bone("busy", "vat", (0, 10, 0))]
    cubes = [
        Cube("vat", "terracotta", (-6, 0, -6), (12, 10, 12)),
        Cube("vat", "terracotta", (-7, 10, -7), (14, 1, 14)),
        Cube("busy", "wood", (-5, 11, -5), (10, 1, 10)),
    ]
    return Model("geometry.kaleidoscope_ranching.pickling_vat", bones, cubes, 64, 64)


ALL = {
    "butcher_rack": butcher_rack,
    "nest_box": nest_box,
    "incubator": incubator,
    "butter_churn": butter_churn,
    "cheese_press": cheese_press,
    "aging_rack": aging_rack,
    "fermenting_jar": fermenting_jar,
    "pickling_vat": pickling_vat,
    "hay_rack": hay_rack,
    "hitching_post": hitching_post,
    # Hand-made in Blockbench only (art/blocks/aged_cheese_wheel.geo.json); no procedural model.
    "aged_cheese_wheel": None,
}
