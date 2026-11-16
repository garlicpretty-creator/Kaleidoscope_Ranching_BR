"""Dishes that can be put down and eaten a portion at a time (data/placedFoods.js rows with
`eat`): the Margherita pizza on its board, the cheese fondue and the big stews in a shared pot,
and the two gratins in a baking dish.

Both follow the cheese wheel's convention: bones piece_1..piece_4, and the block hides one per
portion eaten, piece_4 first (tools/gen_blocks.mjs, packs/BP/scripts/systems/placedFood.js).
The pizza's and the gratins' pieces are their four quarters; a pot's are four levels of food.
Every pot shares one shape and every gratin another: POTS and DISHES give each its colours.

Run with: python art_src/m4_scripts/placed_food.py
(then python art_src/m4_scripts/bbmodel.py with the block ids to refresh the Blockbench files)
"""
import json
import math
from pathlib import Path

from boxuv import Painter
from blocks_m3 import autouv, corners, geo, solid
from blocks_m4 import WOOD, WOOD_DK, WOOD_LT, mix, wood

ROOT = Path(__file__).resolve().parents[2]

CRUST, CRUST_DK, CRUST_LT = (214, 160, 92), (170, 116, 60), (236, 196, 132)
SAUCE, SAUCE_DK = (204, 62, 44), (160, 44, 36)
MOZZ, BASIL = (248, 240, 220), (72, 140, 60)
POT, POT_DK, POT_LT = (64, 64, 72), (40, 40, 48), (104, 104, 114)
CHEESE, CHEESE_DK, CHEESE_LT = (244, 206, 100), (220, 176, 72), (252, 230, 150)
FLAME, FLAME_LT = (236, 128, 40), (252, 214, 96)

# (piece, x sign, z sign): piece_4 is eaten first
QUARTERS = [(1, 1, 1), (2, 1, -1), (3, -1, 1), (4, -1, -1)]


def pizza_quarter(n, sx, sz):
    """Two overlapping boxes round off the quarter's outer corner (radius 7)."""
    a = [0 if sx > 0 else -6, 1, 0 if sz > 0 else -7]
    b = [0 if sx > 0 else -7, 1, 0 if sz > 0 else -6]
    return (f"piece_{n}", "board", [0, 1, 0], [(f"q{n}a", a, [6, 2, 7]), (f"q{n}b", b, [7, 2, 6])])


PIZZA = [
    ("board", None, [0, 0, 0], [
        ("plank", [-8, 0, -8], [16, 1, 16]),
    ]),
    *[pizza_quarter(n, sx, sz) for n, sx, sz in QUARTERS],
]

FONDUE = [
    ("pot", None, [0, 0, 0], [
        *corners("foot", -5, 4, -5, 4, 0, [1, 2, 1]),
        ("burner", [-2, 0, -2], [4, 1, 4]),
        ("floor", [-5, 2, -5], [10, 1, 10]),
        ("wall_fb", [-5, 3, -5], [10, 5, 1]),
        ("wall_fb", [-5, 3, 4], [10, 5, 1]),
        ("wall_s", [-5, 3, -4], [1, 5, 8]),
        ("wall_s", [4, 3, -4], [1, 5, 8]),
        ("handle", [5, 6, -1], [3, 1, 2]),
    ]),
    *[(f"piece_{n}", "pot", [0, 2 + n, 0], [(f"cheese_{n}", [-4, 2 + n, -4], [8, 1, 8])]) for n in (1, 2, 3, 4)],
]


def rnd(x, z, salt=0):
    return ((int(x * 2) * 73856093) ^ (int(z * 2) * 19349663) ^ (salt * 83492791)) % 100


def pizza_paint(origin, size, sx, sz):
    """Paints a quarter by where each pixel sits on the whole pizza, so the two boxes of a quarter
    and the four quarters line up: crust at the rim, sauce, mozzarella rounds and basil inside."""
    (x, y, z), (w, h, d) = origin, size
    x1, z1 = x + w, z + d
    inner = {"west" if sx > 0 else "east", "north" if sz > 0 else "south"}

    def top(px, pz):
        r = math.hypot(px, pz)
        if r > 5.4:
            return CRUST_LT if rnd(px, pz) < 25 else CRUST
        # three mozzarella rounds per quarter and a basil leaf, mirrored into every quarter
        ax, az = abs(px), abs(pz)
        if math.hypot(ax - 2.5, az - 2.5) < 1.3 or math.hypot(ax - 4.5, az - 0.5) < 0.8 or math.hypot(ax - 0.5, az - 4.5) < 0.8:
            return MOZZ
        if (int(ax), int(az)) in ((3, 0), (0, 3), (4, 3)):
            return BASIL
        return SAUCE_DK if rnd(px, pz, 1) < 30 else SAUCE

    def fn(f, i, j, w_, h_, fi):
        if f == "top":
            return top(x1 - i - 0.5, z1 - j - 0.5)
        if f == "bottom":
            return CRUST_DK
        if f in inner:  # the cut edge: cheese over crumb
            return MOZZ if j == 0 else CRUST_LT
        return CRUST if j == 0 else CRUST_DK
    return fn


def pot(f, i, j, w, h, fi):
    if f == "top":
        return POT_LT
    if f == "bottom":
        return POT_DK
    if j == 0:
        return POT_LT
    return POT_DK if (i * 7 + j * 3) % 11 == 0 or j == h - 1 else POT


def cheese(f, i, j, w, h, fi):
    if f != "top":
        return CHEESE_DK
    r = (i * 7 + j * 13) % 17
    return CHEESE_LT if r < 3 else CHEESE_DK if r < 6 else CHEESE


def burner(f, i, j, w, h, fi):
    if f == "top":
        return FLAME_LT if 0 < i < w - 1 and 0 < j < h - 1 else FLAME
    return POT_DK


IRON_POT = (POT, POT_DK, POT_LT)
CLAY_POT = ((150, 92, 62), (112, 64, 42), (186, 126, 90))
POTATO, CARROT, GREENS, CHILI = (228, 202, 132), (228, 132, 52), (88, 150, 70), (204, 52, 40)

# block id -> (pot colours, liquid, liquid dark, [chunk colours])
POTS = {
    "placed_old_duck_soup": (IRON_POT, (214, 186, 120), (188, 156, 92), [(150, 100, 70), (206, 214, 146), (236, 220, 170)]),
    "placed_braised_brisket": (IRON_POT, (124, 62, 38), (96, 44, 28), [(84, 40, 28), CARROT, POTATO]),
    "placed_yak_stew": (IRON_POT, (116, 60, 46), (88, 42, 34), [(78, 40, 32), (156, 44, 66), POTATO]),
    "placed_goose_stew": (IRON_POT, (164, 104, 56), (132, 78, 40), [(204, 160, 110), CHILI, POTATO]),
    "placed_lion_head_meatballs": (IRON_POT, (156, 84, 46), (124, 60, 34), [(112, 64, 46), (112, 64, 46), GREENS]),
    "placed_claypot_rice": (CLAY_POT, (242, 234, 212), (222, 210, 182), [(156, 52, 46), (120, 40, 36), GREENS]),
}

# block id -> (crust, crust dark, inside, fleck)
DISHES = {
    "placed_cheese_gratin": ((236, 178, 84), (196, 124, 52), (250, 232, 170), (150, 86, 40)),
    "placed_truffle_gratin": ((228, 170, 88), (184, 118, 54), (248, 228, 176), (58, 44, 40)),
}
CERAMIC, CERAMIC_DK = (236, 232, 224), (196, 190, 182)

GRATIN = [
    ("dish", None, [0, 0, 0], [
        ("base", [-6, 0, -4], [12, 1, 8]),
        ("side_fb", [-6, 1, -4], [12, 3, 1]),
        ("side_fb", [-6, 1, 3], [12, 3, 1]),
        ("side_s", [-6, 1, -3], [1, 3, 6]),
        ("side_s", [5, 1, -3], [1, 3, 6]),
        ("ear", [-7, 3, -1], [1, 1, 2]),
        ("ear", [6, 3, -1], [1, 1, 2]),
    ]),
    *[(f"piece_{n}", "dish", [0, 1, 0], [(f"q{n}", [0 if sx > 0 else -5, 1, 0 if sz > 0 else -3], [5, 2, 3])])
      for n, sx, sz in QUARTERS],
]


def stew(liquid, liquid_dk, chunks):
    """A level of stew seen from above: liquid with 2x2 chunks of the dish's ingredients."""
    def fn(f, i, j, w, h, fi):
        if f != "top":
            return liquid_dk
        cell = (i // 2) * 5 + (j // 2) * 3
        if cell % 4 == 1 and 0 < i < w - 1 and 0 < j < h - 1:
            return chunks[(cell // 4) % len(chunks)]
        return liquid_dk if (i * 7 + j * 13) % 9 == 0 else liquid
    return fn


def vessel(base, dark, light):
    def fn(f, i, j, w, h, fi):
        if f == "top":
            return light
        if f == "bottom":
            return dark
        if j == 0:
            return light
        return dark if (i * 7 + j * 3) % 11 == 0 or j == h - 1 else base
    return fn


def gratin_piece(colours, sx, sz):
    crust, crust_dk, inside, fleck = colours
    inner = {"west" if sx > 0 else "east", "north" if sz > 0 else "south"}

    def fn(f, i, j, w, h, fi):
        if f == "top":
            r = (i * 7 + j * 11 + sx + sz * 2) % 13
            return fleck if r == 0 else crust_dk if r < 4 else crust
        if f in inner:
            return crust if j == 0 else inside
        return crust_dk
    return fn


def build(bid, raw, paint):
    bones, tw, th = autouv(raw)
    th = tw = max(tw, th)
    p = Painter(tw, th, bones, bid)
    for name, fn in paint(bones).items():
        p.paint(name, fn)
    out = ROOT / "art" / "blocks"
    (out / f"{bid}.geo.json").write_text(json.dumps(geo(bid, bones, tw, th), indent=2) + "\n", encoding="utf8")
    p.save(out / f"{bid}.png")
    print(f"{bid}: {tw}x{th}")


def pizza_paints(bones):
    paints = {"plank": wood(WOOD_LT)}
    signs = {n: (sx, sz) for n, sx, sz in QUARTERS}
    for name, _, _, cubes in bones:
        if name.startswith("piece_"):
            for cname, origin, size, _ in cubes:
                paints[cname] = pizza_paint(origin, size, *signs[int(name[-1])])
    return paints


def fondue_paints(bones):
    return {"foot": solid(POT_DK), "burner": burner, "floor": pot, "wall_fb": pot, "wall_s": pot,
            "handle": wood(WOOD_DK), **{f"cheese_{n}": cheese for n in (1, 2, 3, 4)}}


def pot_paints(colours, liquid, liquid_dk, chunks):
    walls = vessel(*colours)
    return lambda bones: {"foot": solid(colours[1]), "burner": burner, "floor": walls, "wall_fb": walls, "wall_s": walls,
                          "handle": wood(WOOD_DK), **{f"cheese_{n}": stew(liquid, liquid_dk, chunks) for n in (1, 2, 3, 4)}}


def gratin_paints(colours):
    signs = {n: (sx, sz) for n, sx, sz in QUARTERS}
    ceramic = vessel(CERAMIC, CERAMIC_DK, (250, 248, 244))
    return lambda bones: {"base": ceramic, "side_fb": ceramic, "side_s": ceramic, "ear": ceramic,
                          **{f"q{n}": gratin_piece(colours, *signs[n]) for n in signs}}


def main():
    build("placed_pizza", PIZZA, pizza_paints)
    build("placed_fondue", FONDUE, fondue_paints)
    for bid, row in POTS.items():
        build(bid, FONDUE, pot_paints(*row))
    for bid, colours in DISHES.items():
        build(bid, GRATIN, gratin_paints(colours))


if __name__ == "__main__":
    main()
