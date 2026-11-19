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
from station_frames import shift

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
        ("guide", [-4, 12, -6], [1, 2, 12]),
        ("guide", [3, 12, -6], [1, 2, 12]),
        ("straw", [-3, 12, -6], [6, 1, 11]),
        # the straw fed out through the mouth, in front of the knife
        ("straw", [-3, 12, -8], [6, 1, 1]),
        # the knife slides between two uprights over the mouth at the front
        ("upright", [-5, 12, -8], [1, 4, 2]),
        ("upright", [4, 12, -8], [1, 4, 2]),
    ]),
    # 1.1 追加 方塊動畫: the knife waits raised and drops through the straw at the mouth when the
    # cutter is opened (station_frames.py); everything stays inside the block's 16 pixels
    *shift("blade", "cutter", [("blade", [-4, 14, -7], [8, 2, 1]), ("grip", [-1, 15, -8], [2, 1, 1])],
           [(0, 0, 0), (0, -2, 0)]),
]

FEED_MIXER = [
    # 1.3: a hand-cranked mixing trough: a long plank trough on two trestle ends no taller than its
    # rim, feed heaped above the rim, a paddle shaft along it and a big crank outside the right end.
    ("mixer", None, [0, 0, 0], [
        ("end", [-7, 0, -5], [1, 12, 10]),
        ("end", [6, 0, -5], [1, 12, 10]),
        ("wall", [-6, 5, -5], [12, 6, 1]),
        ("wall", [-6, 5, 4], [12, 6, 1]),
        ("feed", [-6, 4, -4], [12, 7, 8]),
        ("heap", [-4, 11, -3], [8, 1, 6]),
        ("stretcher", [-6, 1, -0.5], [12, 1, 1]),
        ("shaft", [-7.5, 11, -0.5], [15.5, 1, 1]),
        ("paddle", [-3, 10, -2], [1, 3, 4]),
        ("paddle", [2, 10, -2], [1, 3, 4]),
        ("crank", [7, 11, -0.5], [1, 3.5, 1]),
        ("knob", [7, 13.5, -3], [1, 1, 2.5]),
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


def mixed_feed(f, i, j, w, h, fi):
    """Mixed feed heaped in the trough: chopped hay, grain and green flecks."""
    r = (i * 7 + j * 5) % 6
    return (120, 160, 70) if r == 0 else (220, 190, 120) if r < 3 else (184, 150, 88)


def trestle(f, i, j, w, h, fi):
    """The trough's end boards, with an arch cut out between the two legs (clear pixels)."""
    if f in ("east", "west") and j >= h - 4 and 2 <= i <= w - 3:
        return None
    if f == "bottom" and 2 <= j <= h - 3:
        return None
    return wood(WOOD_DK)(f, i, j, w, h, fi)


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
                     "table": wood(WOOD), "guide": wood(WOOD_DK), "straw": hay, "upright": wood(WOOD_DK, rings=WOOD_LT),
                     "blade": blade, "grip": wood(WOOD_LT)},
    "feed_mixer": {"end": trestle, "wall": wood(WOOD), "feed": mixed_feed, "heap": mixed_feed, "stretcher": wood(WOOD_DK),
                   "shaft": iron, "paddle": wood(WOOD_LT), "crank": iron, "knob": wood(WOOD_LT)},
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
