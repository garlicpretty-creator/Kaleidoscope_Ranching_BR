"""Dishes that can be put down and eaten a portion at a time (data/placedFoods.js rows with
`eat`): the Margherita pizza on its board and the cheese fondue pot.

Both follow the cheese wheel's convention: bones piece_1..piece_4, and the block hides one per
portion eaten, piece_4 first (tools/gen_blocks.mjs, packs/BP/scripts/systems/placedFood.js).
The pizza's pieces are its four quarters; the fondue's are four levels of cheese in the pot.

Run with: python art_src/m4_scripts/placed_food.py
(then python art_src/m4_scripts/bbmodel.py placed_pizza placed_fondue)
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


def main():
    build("placed_pizza", PIZZA, pizza_paints)
    build("placed_fondue", FONDUE, fondue_paints)


if __name__ == "__main__":
    main()
