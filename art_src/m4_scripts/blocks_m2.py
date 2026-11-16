"""Hand-made models for the four M2 full-cube blocks: auto feeder, chaff cutter, feed mixer,
compost bin. They keep the full-block footprint; tools/m2/gen_content.py switches a block to
its model when art/blocks/<id>.geo.json exists, and tools/gen_m3_art.py installs the model and
texture (terrain key kr_<id>).

Compost bin bones follow its states (stage 0..2, manure 0..4):
  manure_1..manure_4  stage 0 with that many loads of manure
  fermenting          stage 1
  ready               stage 2

Run with: python art_src/m4_scripts/blocks_m2.py
"""
import json
from pathlib import Path

from boxuv import Painter
from blocks_m3 import autouv, corners, geo, solid, staves
from blocks_m4 import HAY, HAY_DK, WOOD, WOOD_DK, WOOD_LT, hay, iron, mix, wood

ROOT = Path(__file__).resolve().parents[2]

GALV, GALV_DK, GALV_LT = (150, 158, 164), (104, 112, 118), (190, 198, 204)
GRAIN = (214, 178, 96)
MANURE, MANURE_DK = (86, 70, 38), (56, 44, 24)
SOIL, SOIL_DK = (62, 44, 30), (44, 30, 20)


AUTO_FEEDER = [
    ("feeder", None, [0, 0, 0], [
        ("pan_floor", [-8, 0, -8], [16, 1, 16]),
        ("pan_fb", [-8, 1, -8], [16, 3, 1]),
        ("pan_fb", [-8, 1, 7], [16, 3, 1]),
        ("pan_s", [-8, 1, -7], [1, 3, 14]),
        ("pan_s", [7, 1, -7], [1, 3, 14]),
        ("grain", [-7, 1, -7], [14, 2, 14]),
        ("hopper", [-5, 3, -5], [10, 10, 10]),
        ("rim", [-6, 13, -6], [12, 1, 12]),
        ("lid", [-5, 14, -5], [10, 1, 10]),
        ("handle", [-1, 15, -1], [2, 1, 2]),
    ]),
]

CHAFF_CUTTER = [
    ("cutter", None, [0, 0, 0], [
        *corners("leg", -7, 5, -7, 5, 0, [2, 10, 2]),
        ("brace", [-6, 3, -6], [12, 1, 12]),
        ("chaff", [-5, 4, -5], [10, 2, 10]),
        ("table", [-8, 10, -8], [16, 2, 16]),
        ("guide", [-4, 12, -8], [1, 2, 13]),
        ("guide", [3, 12, -8], [1, 2, 13]),
        ("straw", [-3, 12, -8], [6, 1, 12]),
        ("hinge", [5, 12, 4], [2, 4, 3]),
        ("blade", [-6, 13, 5], [11, 3, 1]),
        ("grip", [-8, 14, 4], [2, 1, 3]),
    ]),
]

FEED_MIXER = [
    ("mixer", None, [0, 0, 0], [
        ("stand", [-7, 0, -7], [14, 1, 14]),
        ("barrel", [-6, 1, -6], [12, 12, 12]),
        ("hoop", [-6.5, 3, -6.5], [13, 1, 13]),
        ("hoop", [-6.5, 10, -6.5], [13, 1, 13]),
        ("axle", [-0.5, 13, -0.5], [1, 3, 1]),
        ("paddle", [-4, 13, -0.5], [8, 1, 1]),
        ("crank", [-0.5, 15, -0.5], [5, 1, 1]),
        ("knob", [4, 16, -0.5], [1, 2, 1]),
    ]),
]


def slats(y):
    return [("slat_fb", [-6, y, -8], [12, 2, 1]), ("slat_fb", [-6, y, 7], [12, 2, 1]),
            ("slat_s", [-8, y, -6], [1, 2, 12]), ("slat_s", [7, y, -6], [1, 2, 12])]


COMPOST_BIN = [
    ("bin", None, [0, 0, 0], [
        *corners("post", -8, 6, -8, 6, 0, [2, 13, 2]),
        ("floor", [-6, 0, -6], [12, 1, 12]),
        *slats(1), *slats(5), *slats(9),
    ]),
    *[(f"manure_{n}", "bin", [0, 1, 0], [(f"pile_{n}", [-6, 1, -6], [12, 2 * n, 12])]) for n in (1, 2, 3, 4)],
    ("fermenting", "bin", [0, 1, 0], [("heap", [-6, 1, -6], [12, 9, 12]), ("mound", [-4, 10, -4], [8, 1, 8])]),
    ("ready", "bin", [0, 1, 0], [("compost", [-6, 1, -6], [12, 7, 12])]),
]


def galvanized(f, i, j, w, h, fi):
    """Galvanized sheet: vertical seams, a rivet row, a slot window on the front showing feed."""
    if f in ("top", "bottom"):
        return GALV_DK
    if f == "north" and 3 <= i <= 6 and 2 <= j <= h - 3:
        return GRAIN if (i + j) % 3 else mix(GRAIN, (120, 90, 40), 0.3)
    if i in (0, w - 1):
        return GALV_DK
    if j == 1 and i % 3 == 1:
        return GALV_LT
    return GALV if (i // 3 + j // 4) % 2 else mix(GALV, GALV_LT, 0.3)


def grain(f, i, j, w, h, fi):
    r = (i * 7 + j * 11 + len(f)) % 9
    return (238, 206, 120) if r == 0 else (176, 140, 70) if r < 2 else GRAIN


def blade(f, i, j, w, h, fi):
    if j == h - 1:
        return (224, 228, 234)  # sharpened edge
    return (128, 132, 140) if (i + j) % 4 else (160, 164, 170)


def chopped(f, i, j, w, h, fi):
    r = (i * 5 + j * 3) % 7
    return HAY_DK if r == 0 else (196, 170, 84) if r < 3 else HAY


def mixed_top(f, i, j, w, h, fi):
    """Barrel: staves on the sides; the open top is a wooden rim around mixed feed."""
    if f == "top":
        if i in (0, w - 1) or j in (0, h - 1):
            return WOOD_DK
        r = (i * 7 + j * 5) % 6
        return (120, 160, 70) if r == 0 else (220, 190, 120) if r < 3 else (184, 150, 88)
    return staves(WOOD)(f, i, j, w, h, fi)


def lumpy(base, dark, light=None):
    def fn(f, i, j, w, h, fi):
        r = (i * 13 + j * 7 + len(f) * 3) % 11
        if r < 3:
            return dark
        if light and r == 10:
            return light
        return base
    return fn


def steaming(f, i, j, w, h, fi):
    if f == "top" and (i * 3 + j) % 9 == 0:
        return (150, 140, 120)  # pale steam-dried crust
    return lumpy((90, 66, 40), (66, 46, 26))(f, i, j, w, h, fi)


PAINT = {
    "auto_feeder": {"pan_floor": solid(GALV_DK), "pan_fb": iron, "pan_s": iron, "grain": grain,
                    "hopper": galvanized, "rim": iron, "lid": solid(GALV, edge=GALV_DK), "handle": iron},
    "chaff_cutter": {"leg": wood(WOOD_DK, rings=WOOD_LT), "brace": wood(WOOD_DK), "chaff": chopped,
                     "table": wood(WOOD), "guide": wood(WOOD_DK), "straw": hay, "hinge": wood(WOOD_DK),
                     "blade": blade, "grip": wood(WOOD_LT)},
    "feed_mixer": {"stand": wood(WOOD_DK), "barrel": mixed_top, "hoop": iron, "axle": iron,
                   "paddle": iron, "crank": iron, "knob": wood(WOOD_LT)},
    "compost_bin": {"post": wood(WOOD_DK, rings=WOOD_LT), "floor": wood(WOOD_DK), "slat_fb": wood(WOOD),
                    "slat_s": wood(WOOD),
                    **{f"pile_{n}": lumpy(MANURE, MANURE_DK, (196, 170, 84)) for n in (1, 2, 3, 4)},  # straw flecks
                    "heap": steaming, "mound": steaming,
                    "compost": lumpy(SOIL, SOIL_DK, (96, 74, 50))},
}

BLOCKS = {
    "auto_feeder": AUTO_FEEDER,
    "chaff_cutter": CHAFF_CUTTER,
    "feed_mixer": FEED_MIXER,
    "compost_bin": COMPOST_BIN,
}


def main():
    out = ROOT / "art" / "blocks"
    out.mkdir(parents=True, exist_ok=True)
    for bid, raw in BLOCKS.items():
        bones, tw, th = autouv(raw)
        if th > 128:  # the compost piles are wide: a wider sheet packs them shorter
            bones, tw, th = autouv(raw, tw=128)
        p = Painter(tw, th, bones, bid)
        for cube, fn in PAINT[bid].items():
            p.paint(cube, fn)
        (out / f"{bid}.geo.json").write_text(json.dumps(geo(bid, bones, tw, th), indent=2) + "\n", encoding="utf8")
        p.save(out / f"{bid}.png")
        print(f"{bid}: {tw}x{th}")


if __name__ == "__main__":
    main()
