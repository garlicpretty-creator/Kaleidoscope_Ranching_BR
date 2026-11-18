"""Hand-made model for the 1.1 追加 block (docs/1.1_追加企劃書.md 八、九): the pasture post, a
wooden stake driven into a tuft of turf with a small board nailed on near the top and a bunch of
clover tied under its cap. It replaces the stand-in in tools/art/blocks.py: tools/gen_m3_art.py
installs art/blocks/<id>.geo.json and .png when they exist.

The other new block, the placed roast turkey, is drawn with the other dishes in placed_food.py.

The board faces north, the side the block turns toward the player who places it
(tools/gen_blocks.mjs). The post is 16 pixels tall, the height of its selection box.

Run with: python art_src/m4_scripts/blocks_m12.py
(then python art_src/m4_scripts/bbmodel.py pasture_post to refresh the Blockbench file)
"""
import json
from pathlib import Path

from boxuv import Painter
from blocks_m3 import autouv, geo
from blocks_m4 import WOOD, WOOD_DK, WOOD_LT, mix, rope, wood

ROOT = Path(__file__).resolve().parents[2]

TURF, TURF_DK, TURF_LT = (96, 140, 58), (68, 106, 40), (134, 176, 80)
SOIL = (110, 80, 52)
CLOVER, CLOVER_DK, BLOSSOM = (82, 150, 64), (54, 112, 46), (236, 214, 232)
NAIL = (176, 176, 182)
PLANK, PLANK_DK = (214, 184, 132), (168, 132, 84)  # the board: paler, weathered
PAINTED = (70, 128, 54)  # the green sprout painted on the board

PASTURE_POST = [
    ("post", None, [0, 0, 0], [
        ("turf", [-3, 0, -3], [6, 1, 6]),
        ("stake", [-1.5, 1, -1.5], [3, 14, 3]),
        ("cap", [-1, 15, -1], [2, 1, 2]),
        ("lashing", [-2, 12, -2], [4, 1, 4]),
        ("board", [-4, 7, -2.5], [8, 5, 1]),
        ("clover", [1.5, 9, -1], [1, 3, 2]),
    ]),
]


def rnd(f, i, j, salt=0):
    return ((i * 73856093) ^ (j * 19349663) ^ ((sum(map(ord, f)) + salt) * 83492791)) % 100


def stake(f, i, j, w, h, fi):
    """Weathered wood, darker and earth-stained near the ground, a split in the grain."""
    if f in ("top", "bottom"):
        return WOOD_LT
    if j >= h - 2:
        return mix(WOOD_DK, SOIL, 0.5)
    c = wood(WOOD)(f, i, j, w, h, fi)
    return mix(c, WOOD_DK, 0.35) if j >= h - 5 else c


def cap(f, i, j, w, h, fi):
    """The cut top: end grain rings."""
    if f == "top":
        return WOOD_LT if (i, j) in ((0, 0), (1, 1)) else mix(WOOD_LT, WOOD_DK, 0.3)
    return WOOD


def turf(f, i, j, w, h, fi):
    """A ring of grass round the foot of the stake; soil on the sides."""
    if f == "top":
        r = rnd(f, i, j)
        return TURF_LT if r < 20 else TURF_DK if r > 78 else TURF
    if f == "bottom":
        return SOIL
    return TURF_DK if rnd(f, i, j, 3) < 40 else mix(TURF, SOIL, 0.4)


def board(f, i, j, w, h, fi):
    """A pale plank sign framed by a darker edge, a nail in two opposite corners, and a two-leaf
    sprout painted on both broad faces."""
    if f in ("north", "south"):
        if j in (0, h - 1) or i in (0, w - 1):
            return PLANK_DK
        if (i, j) in ((1, 1), (w - 2, h - 2)):
            return NAIL
        if (i, j) in ((2, 1), (3, 2), (5, 1), (6, 1), (5, 2)):
            return PAINTED  # two leaves
        if (i, j) in ((4, 2), (4, 3)):
            return mix(PAINTED, (30, 50, 20), 0.4)  # the stem
        return PLANK if (i + 3 * j) % 7 else mix(PLANK, PLANK_DK, 0.5)
    return PLANK_DK


def clover(f, i, j, w, h, fi):
    """A bunch of clover tied to the post: leaves, a pale flower head at the top."""
    if j == 0 and f != "bottom":
        return BLOSSOM if i % 2 == 0 else mix(BLOSSOM, CLOVER, 0.3)
    return CLOVER_DK if (i + j) % 2 else CLOVER


PAINT = {
    "pasture_post": {"turf": turf, "stake": stake, "cap": cap, "lashing": rope, "board": board,
                     "clover": clover},
}

BLOCKS = {
    "pasture_post": PASTURE_POST,
}


def main():
    out = ROOT / "art" / "blocks"
    out.mkdir(parents=True, exist_ok=True)
    for bid, raw in BLOCKS.items():
        bones, tw, th = autouv(raw)
        th = tw = max(tw, th)
        p = Painter(tw, th, bones, bid)
        missing = {c[0] for b in bones for c in b[3]} - set(PAINT[bid])
        assert not missing, (bid, missing)
        for cube, fn in PAINT[bid].items():
            p.paint(cube, fn)
        (out / f"{bid}.geo.json").write_text(json.dumps(geo(bid, bones, tw, th), indent=2) + "\n", encoding="utf8")
        p.save(out / f"{bid}.png")
        print(f"{bid}: {sum(len(b[3]) for b in bones)} cubes, {tw}x{th}")


if __name__ == "__main__":
    main()
