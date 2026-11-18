"""Hand-made models for the 1.1 blocks (M7 to M10): meat grinder, milking rack, cream separator,
ice cream churn, spinning wheel, weaving loom, silage barrel, down pillow, down quilt, pen gate
(both halves) and the horn decoration. They replace the stand-ins in tools/art/blocks.py:
tools/gen_m3_art.py installs art/blocks/<id>.geo.json and .png when they exist.

Bones the block files need (tools/gen_blocks.mjs): `busy` and busy_1..busy_3 (the contents in the
colours of the three stages of a batch, station_stages.py) on the stations, `closed` and `open`
on the two gate halves. The rug stays procedural: it is one flat cube dyed in 16 colours.

Run with: python art_src/m4_scripts/blocks_m7.py
(then python art_src/m4_scripts/bbmodel.py to refresh the Blockbench files)
"""
import json
from pathlib import Path

from boxuv import Painter
from blocks_m3 import autouv, corners, geo, solid, staves
from blocks_m4 import HAY, HAY_DK, WOOD, WOOD_DK, WOOD_LT, hay, iron, mix, wood
from station_stages import STAGE_PAINT, stage_paints, staged
from station_frames import crank, crank_z, shift, wheel

ROOT = Path(__file__).resolve().parents[2]

STEEL, STEEL_DK, STEEL_LT = (146, 150, 158), (98, 102, 112), (196, 200, 208)
TIN, TIN_DK, TIN_LT = (176, 182, 188), (128, 134, 142), (220, 224, 228)
MILK, CREAM = (244, 244, 238), (250, 236, 198)
ICE, ICE_DK, ICE_LT = (188, 222, 240), (140, 186, 216), (236, 248, 252)
YARN, YARN_DK = (236, 226, 208), (204, 190, 166)
DOWN, DOWN_DK, PIPING = (246, 244, 238), (222, 220, 216), (142, 170, 204)
ROCK, ROCK_DK = (128, 126, 122), (96, 94, 92)
HORN, HORN_DK, HORN_TIP = (224, 208, 176), (176, 150, 112), (92, 72, 56)
BONE = (232, 226, 208)


def ring(name, cx, cy, z):
    """A 10-pixel wheel rim standing in the x-y plane, one pixel thick, centred on (cx, cy)."""
    x, y = cx - 5, cy - 5
    px = [(3, 9, 4, 1), (1, 8, 2, 1), (7, 8, 2, 1), (1, 7, 1, 1), (8, 7, 1, 1), (0, 3, 1, 4), (9, 3, 1, 4),
          (1, 2, 1, 1), (8, 2, 1, 1), (1, 1, 2, 1), (7, 1, 2, 1), (3, 0, 4, 1)]
    return [(name, [x + i, y + j, z], [w, h, 1]) for i, j, w, h in px]


MEAT_GRINDER = [
    ("stand", None, [0, 0, 0], [
        ("board", [-7, 0, -5], [14, 2, 10]),
        ("neck", [-2, 2, -2], [4, 4, 4]),
        ("barrel", [-4, 6, -2], [8, 4, 4]),
        ("hopper", [-3, 10, -3], [6, 2, 6]),
        ("hopper_rim", [-4, 12, -4], [8, 2, 8]),
        ("plate", [4, 5.5, -2.5], [1, 5, 5]),
        ("axle", [-6, 7.5, -0.5], [2, 1, 1]),
        ("bowl", [3, 2, -3], [4, 2, 6]),
    ]),
    # 1.1 工作台互動動畫: the crank turns when it is used (station_frames.py)
    *crank("crank", "stand", -7, 8, 0, 4, knob_dx=-1),
    ("busy", "stand", [0, 4, 0], [
        ("mince", [3.5, 4, -2.5], [3, 1, 5]),
        ("strands", [5, 5, -1], [1, 2, 2]),
    ]),
]

MILKING_RACK = [
    ("stall", None, [0, 0, 0], [
        *corners("post", -8, 6, -8, 6, 0, [2, 12, 2]),
        ("rail", [-7.5, 9, -6], [1, 2, 12]),
        ("rail", [-7.5, 4, -6], [1, 2, 12]),
        ("rail", [6.5, 9, -6], [1, 2, 12]),
        ("rail", [6.5, 4, -6], [1, 2, 12]),
        ("yoke", [-6, 10, -7.5], [12, 2, 1]),
        ("neck_bar", [-3, 7, -7.5], [1, 3, 1]),
        ("neck_bar", [2, 7, -7.5], [1, 3, 1]),
        ("feed_box", [-6, 3, -8], [12, 4, 3]),
        ("pail", [-2, 0, -1], [4, 4, 4]),
        ("pail_handle", [-2.5, 4, 0.5], [5, 1, 1]),
        ("stool_seat", [2, 3, 2], [4, 1, 4]),
        ("stool_leg", [2, 0, 2], [1, 3, 1]),
        ("stool_leg", [5, 0, 2], [1, 3, 1]),
        ("stool_leg", [3.5, 0, 5], [1, 3, 1]),
    ]),
]

CREAM_SEPARATOR = [
    ("frame", None, [0, 0, 0], [
        ("base", [-6, 0, -6], [12, 2, 12]),
        ("column", [-2, 2, -2], [4, 6, 4]),
        ("drum", [-4, 8, -4], [8, 3, 8]),
        ("bowl", [-5, 11, -5], [10, 3, 10]),
        ("knob", [-1, 14, -1], [2, 2, 2]),
        ("spout", [5, 9, -1], [3, 1, 2]),
        ("spout", [-8, 8, -1], [4, 1, 2]),
        ("cream_can", [5, 2, -2], [3, 5, 3]),
        ("milk_jug", [-8, 2, -2], [3, 5, 4]),
        ("crank_axle", [-0.5, 5, -4], [1, 1, 2]),
    ]),
    # 1.1 追加 方塊動畫: the crank turns when milk goes in (station_frames.py)
    *crank_z("crank", "frame", -5, 0, 5.5, 2.5, knob_dz=-1),
    ("busy", "frame", [0, 14, 0], [
        ("cream", [-4, 14, -4], [8, 1, 8]),
    ]),
]

ICE_CREAM_CHURN = [
    ("bucket", None, [0, 0, 0], [
        ("tub", [-5, 0, -5], [10, 10, 10]),
        ("hoop", [-5.5, 2, -5.5], [11, 1, 11]),
        ("hoop", [-5.5, 7, -5.5], [11, 1, 11]),
        ("ice", [-4, 10, -4], [8, 1, 8]),
        ("can", [-3, 10, -3], [6, 2, 6]),
        ("bracket", [-6, 8, -1], [1, 5, 2]),
        ("bracket", [5, 8, -1], [1, 5, 2]),
        ("bar", [-5, 12, -1], [10, 1, 2]),
        ("gear", [-1, 13, -1.5], [2, 2, 3]),
        ("crank_axle", [6, 12, -0.5], [1, 1, 1]),
    ]),
    *crank("crank", "bucket", 7, 12.5, 0, 3.5),
    ("busy", "bucket", [0, 10, 0], [
        ("frost", [-4.5, 11, -4.5], [3, 1, 3]),
        ("frost", [1.5, 11, 1.5], [3, 1, 3]),
        ("scoop", [-4, 11, 2], [2, 2, 2]),
    ]),
]

SPINNING_WHEEL = [
    ("frame", None, [0, 0, 0], [
        ("bench", [-7, 4, -2], [14, 1, 4]),
        ("leg", [-7, 0, -2], [1, 4, 1]),
        ("leg", [-7, 0, 1], [1, 4, 1]),
        ("leg", [6, 0, -2], [1, 4, 1]),
        ("leg", [6, 0, 1], [1, 4, 1]),
        ("upright", [-4, 5, -2], [2, 6, 1]),
        ("upright", [-4, 5, 1], [2, 6, 1]),
        *ring("rim", -3, 11, -0.5),
        ("hub", [-4, 10, -1], [2, 2, 2]),
        ("maiden", [3, 5, -1], [1, 5, 2]),
        ("maiden", [6, 5, -1], [1, 5, 2]),
        ("spindle", [2, 8, -0.5], [6, 1, 1]),
        ("distaff", [5, 5, 1], [1, 9, 1]),
        ("fleece", [4, 12, 0], [3, 3, 3]),
    ]),
    # the wheel turns and the treadle rocks when wool goes on (station_frames.py)
    *wheel("wheel", "frame", -3, 11, -0.5, ([-3, 0, -4], [6, 1, 3])),
    ("busy", "frame", [5, 8, 0], [
        ("bobbin", [4, 7.5, -1], [2, 2, 2]),
    ]),
]

WEAVING_LOOM = [
    ("frame", None, [0, 0, 0], [
        ("front_post", [-7, 0, -6], [2, 11, 2]),
        ("front_post", [5, 0, -6], [2, 11, 2]),
        ("back_post", [-7, 0, 4], [2, 16, 2]),
        ("back_post", [5, 0, 4], [2, 16, 2]),
        ("side_rail", [-6.5, 7, -4], [1, 2, 8]),
        ("side_rail", [5.5, 7, -4], [1, 2, 8]),
        ("foot_rail", [-6.5, 1, -4], [1, 1, 8]),
        ("foot_rail", [5.5, 1, -4], [1, 1, 8]),
        ("beam", [-5, 9, -6], [10, 2, 2]),
        ("beam", [-5, 13, 4], [10, 2, 2]),
        ("warp", [-5, 10, -4], [10, 1, 8]),
        ("warp_back", [-5, 11, 3], [10, 2, 1]),
        ("heddle", [-5, 9, 0], [10, 5, 1]),
        ("treadle", [-3, 0, -5], [2, 1, 9]),
        ("treadle", [1, 0, -5], [2, 1, 9]),
    ]),
    # 1.1 追加 方塊動畫: the beater swings in and out when yarn goes on (station_frames.py)
    *shift("beater", "frame", [("beater", [-5, 8, -3], [10, 4, 1])], [(0, 0, 0), (0, 0, -1), (0, 0, -2), (0, 0, -1)]),
    ("busy", "frame", [0, 10, -5], [
        ("cloth", [-5, 10.5, -4], [10, 1, 1]),
        ("cloth_roll", [-4, 8.5, -6.5], [8, 3, 3]),
    ]),
]

SILAGE_BARREL = [
    ("barrel", None, [0, 0, 0], [
        ("staves", [-6, 0, -6], [12, 13, 12]),
        ("hoop", [-6.5, 2, -6.5], [13, 1, 13]),
        ("hoop", [-6.5, 10, -6.5], [13, 1, 13]),
        ("lid", [-5, 13, -5], [10, 1, 10]),
        ("handle", [-2, 14, -0.5], [4, 1, 1]),
    ]),
    ("busy", "barrel", [0, 14, 0], [
        ("stone", [-3, 14, -3], [6, 3, 6]),
        ("tuft", [4, 13, -2], [2, 1, 3]),
        ("tuft", [-6, 13, -1], [2, 1, 3]),
    ]),
]

DOWN_PILLOW = [
    ("pillow", None, [0, 0, 0], [
        ("body", [-6, 0, -4], [12, 3, 8]),
        ("puff", [-5, 3, -3], [10, 1, 6]),
    ]),
]

DOWN_QUILT = [
    ("quilt", None, [0, 0, 0], [
        ("sheet", [-8, 0, -8], [16, 1, 16]),
        *[("square", [x, 1, z], [4, 1, 4]) for x in (-7, -2, 3) for z in (-7, -2, 3)],
    ]),
]


def leaf_closed(y0, y1, rails):
    """The gate leaf across the opening: rails behind, stiles and a stepped brace in front."""
    cubes = [("rail", [-6, y, 0], [12, 2, 1]) for y in rails]
    cubes += [("stile", [x, y0, -1], [2, y1 - y0, 1]) for x in (-6, 4)]
    return cubes


def leaf_open(y0, y1, rails):
    """The same leaf swung back along the left post."""
    cubes = [("open_rail", [-7, y, 0], [1, 2, 12]) for y in rails]
    cubes += [("open_stile", [-6, y0, z], [1, y1 - y0, 2]) for z in (0, 10)]
    return cubes


PEN_GATE = [
    ("posts", None, [0, 0, 0], [
        ("post", [-8, 0, -1], [2, 16, 2]),
        ("post", [6, 0, -1], [2, 16, 2]),
        ("hinge", [-6.5, 3, -1.5], [2, 1, 1]),
        ("hinge", [-6.5, 12, -1.5], [2, 1, 1]),
    ]),
    ("closed", "posts", [0, 0, 0], [
        *leaf_closed(2, 16, (3, 8, 13)),
        *[("brace", [-4 + 2 * n, 5 + 2 * n, -1], [2, 2, 1]) for n in range(4)],
        ("latch", [4.5, 9, -1.5], [2, 1, 1]),
    ]),
    ("open", "posts", [-7, 0, 0], [
        *leaf_open(2, 16, (3, 8, 13)),
        *[("open_brace", [-6, 5 + 2 * n, 2 + 2 * n], [1, 2, 2]) for n in range(4)],
    ]),
]

PEN_GATE_TOP = [
    ("posts", None, [0, 0, 0], [
        ("post_top", [-8, 0, -1], [2, 5, 2]),
        ("post_top", [6, 0, -1], [2, 5, 2]),
        ("cap", [-8.5, 5, -1.5], [3, 1, 3]),
        ("cap", [5.5, 5, -1.5], [3, 1, 3]),
    ]),
    ("closed", "posts", [0, 0, 0], leaf_closed(0, 4, (2,))),
    ("open", "posts", [-7, 0, 0], leaf_open(0, 4, (2,))),
]

HORN_DECOR = [
    ("plaque", None, [0, 0, 0], [
        ("board", [-4, 0, -3], [8, 1, 6]),
        ("boss", [-2, 1, -2], [4, 2, 4]),
        ("horn_root", [-4, 1, -1], [2, 2, 2]),
        ("horn_root", [2, 1, -1], [2, 2, 2]),
        ("horn_mid", [-6, 2, -1], [2, 2, 2]),
        ("horn_mid", [4, 2, -1], [2, 2, 2]),
        ("horn_rise", [-7, 3, -1], [1, 3, 2]),
        ("horn_rise", [6, 3, -1], [1, 3, 2]),
        ("horn_tip", [-7, 6, -0.5], [1, 2, 1]),
        ("horn_tip", [6, 6, -0.5], [1, 2, 1]),
    ]),
]


def rnd(f, i, j):
    return ((i * 73856093) ^ (j * 19349663) ^ (sum(map(ord, f)) * 83492791)) % 100


def cast(base=STEEL, dark=STEEL_DK, lite=STEEL_LT):
    """Cast metal: a bright top edge, darker lower edge, a few pits."""
    def fn(f, i, j, w, h, fi):
        if f == "top":
            return lite if (i in (0, w - 1) or j in (0, h - 1)) else base
        if f == "bottom":
            return dark
        if j == 0:
            return lite
        if j == h - 1 or i in (0, w - 1):
            return dark
        return dark if rnd(f, i, j) < 8 else base
    return fn


def vessel(side, inside, rim=None):
    """An open container: `side` paints the walls, the top is a rim around `inside`."""
    def fn(f, i, j, w, h, fi):
        if f == "top":
            if i in (0, w - 1) or j in (0, h - 1):
                return rim or side(f, i, j, w, h, fi)
            return inside(f, i, j, w, h, fi) if callable(inside) else inside
        return side(f, i, j, w, h, fi)
    return fn


def perforated(f, i, j, w, h, fi):
    if f in ("east", "west") and 0 < i < w - 1 and 0 < j < h - 1 and (i + j) % 2 == 0:
        return (52, 40, 44)
    return cast()(f, i, j, w, h, fi)


def ice(f, i, j, w, h, fi):
    r = rnd(f, i, j)
    return ICE_LT if r < 25 else ICE_DK if r < 50 else ICE


def threads(a, b, along="i"):
    """Parallel threads: alternating columns (or rows) of two tones."""
    def fn(f, i, j, w, h, fi):
        k = i if along == "i" else j
        return a if k % 2 == 0 else b
    return fn


def pillow(f, i, j, w, h, fi):
    edge = i in (0, w - 1) or j in (0, h - 1)
    if f in ("top", "bottom"):
        return PIPING if edge else (DOWN_DK if (i + j) % 5 == 0 else DOWN)
    return PIPING if j == h // 2 else (DOWN_DK if j == h - 1 else DOWN)


def quilt_square(f, i, j, w, h, fi):
    if f == "top":
        if (i, j) in ((1, 1), (2, 2), (1, 2), (2, 1)):
            return DOWN
        return mix(DOWN, DOWN_DK, 0.5)
    return DOWN_DK


def quilt_sheet(f, i, j, w, h, fi):
    if f in ("top", "bottom"):
        if i in (0, w - 1) or j in (0, h - 1):
            return PIPING
        return mix(DOWN_DK, PIPING, 0.35)  # stitched channels between the squares
    return PIPING if j == 0 else DOWN_DK


def rock(f, i, j, w, h, fi):
    r = rnd(f, i, j)
    if f == "top":
        return mix(ROCK, (160, 158, 152), (r % 5) / 6)
    return ROCK_DK if r < 30 or j == h - 1 else ROCK


def horn(f, i, j, w, h, fi):
    return HORN_DK if (j + i // 2) % 3 == 0 else HORN


def lid(f, i, j, w, h, fi):
    if f == "top" and (i in (0, w - 1) or j in (0, h - 1)):
        return mix(WOOD_DK, (30, 18, 10), 0.3)
    return wood(WOOD_DK)(f, i, j, w, h, fi)


def feed_box(f, i, j, w, h, fi):
    if f == "top" and 0 < i < w - 1 and 0 < j < h - 1:
        return hay(f, i, j, w, h, fi)
    return wood(WOOD)(f, i, j, w, h, fi)


def fleece(f, i, j, w, h, fi):
    r = rnd(f, i, j)
    return YARN_DK if r < 25 else (250, 246, 236) if r > 80 else YARN


GATE = {"rail": wood(WOOD), "stile": wood(WOOD_LT), "open_rail": wood(WOOD), "open_stile": wood(WOOD_LT)}

PAINT = {
    "meat_grinder": {"board": wood(WOOD_DK), "neck": cast(), "barrel": cast(), "hopper": cast(),
                     "hopper_rim": vessel(cast(), (58, 60, 68), STEEL_LT), "plate": perforated,
                     "axle": iron, "crank": cast(), "grip": wood(WOOD_LT),
                     "bowl": vessel(wood(WOOD_LT), mix(WOOD_DK, (30, 18, 10), 0.3))},
    "milking_rack": {"post": wood(WOOD_DK, rings=WOOD_LT), "rail": wood(WOOD), "yoke": wood(WOOD),
                     "neck_bar": wood(WOOD_LT), "feed_box": feed_box,
                     "pail": vessel(cast(TIN, TIN_DK, TIN_LT), MILK, TIN_LT), "pail_handle": iron,
                     "stool_seat": wood(WOOD_LT), "stool_leg": wood(WOOD_DK)},
    "cream_separator": {"base": wood(WOOD_DK), "column": cast(), "drum": cast(TIN, TIN_DK, TIN_LT),
                        "bowl": vessel(cast(TIN, TIN_DK, TIN_LT), (104, 110, 120), TIN_LT),
                        "knob": wood(WOOD_LT), "spout": cast(TIN, TIN_DK, TIN_LT),
                        "cream_can": vessel(cast(TIN, TIN_DK, TIN_LT), CREAM, TIN_LT),
                        "milk_jug": vessel(cast(TIN, TIN_DK, TIN_LT), MILK, TIN_LT),
                        "crank_axle": iron, "crank": cast(), "grip": wood(WOOD_LT)},
    "ice_cream_churn": {"tub": vessel(staves(WOOD), ice, WOOD_DK), "hoop": iron, "ice": ice,
                        "can": cast(TIN, TIN_DK, TIN_LT), "bracket": cast(), "bar": cast(), "gear": cast(),
                        "crank_axle": iron, "crank": cast(), "grip": wood(WOOD_LT)},
    "spinning_wheel": {"bench": wood(WOOD_DK), "leg": wood(WOOD_DK), "treadle": wood(WOOD),
                       "upright": wood(WOOD), "rim": solid(WOOD_DK), "hub": wood(WOOD_DK, rings=WOOD_LT),
                       "spoke_h": solid(WOOD_LT), "spoke_v": solid(WOOD_LT), "spoke_d": solid(WOOD_LT), "maiden": wood(WOOD),
                       "spindle": iron, "distaff": wood(WOOD_LT), "fleece": fleece},
    "weaving_loom": {"front_post": wood(WOOD_DK, rings=WOOD_LT), "back_post": wood(WOOD_DK, rings=WOOD_LT),
                     "side_rail": wood(WOOD), "foot_rail": wood(WOOD_DK), "beam": wood(WOOD_LT),
                     "warp": threads(YARN, YARN_DK), "warp_back": threads(YARN, YARN_DK),
                     "heddle": threads(WOOD, YARN), "beater": threads(WOOD_LT, WOOD_DK),
                     "treadle": wood(WOOD)},
    "silage_barrel": {"staves": staves(WOOD), "hoop": iron, "lid": lid, "handle": iron,
                      "stone": rock},
    "down_pillow": {"body": pillow, "puff": pillow},
    "down_quilt": {"sheet": quilt_sheet, "square": quilt_square},
    "pen_gate": {"post": wood(WOOD_DK, rings=WOOD_LT), "hinge": iron, "latch": iron,
                 "brace": wood(WOOD_DK), "open_brace": wood(WOOD_DK), **GATE},
    "pen_gate_top": {"post_top": wood(WOOD_DK), "cap": wood(WOOD_LT, rings=WOOD_LT), **GATE},
    "horn_decor": {"board": wood(WOOD_DK), "boss": solid(BONE, edge=mix(BONE, HORN_DK, 0.5)),
                   "horn_root": horn, "horn_mid": horn, "horn_rise": horn, "horn_tip": solid(HORN_TIP)},
}

BLOCKS = {
    "meat_grinder": staged("meat_grinder", MEAT_GRINDER),
    "milking_rack": MILKING_RACK,
    "cream_separator": staged("cream_separator", CREAM_SEPARATOR),
    "ice_cream_churn": staged("ice_cream_churn", ICE_CREAM_CHURN),
    "spinning_wheel": staged("spinning_wheel", SPINNING_WHEEL),
    "weaving_loom": staged("weaving_loom", WEAVING_LOOM),
    "silage_barrel": staged("silage_barrel", SILAGE_BARREL),
    "down_pillow": DOWN_PILLOW,
    "down_quilt": DOWN_QUILT,
    "pen_gate": PEN_GATE,
    "pen_gate_top": PEN_GATE_TOP,
    "horn_decor": HORN_DECOR,
}


def main():
    out = ROOT / "art" / "blocks"
    out.mkdir(parents=True, exist_ok=True)
    for bid, raw in BLOCKS.items():
        bones, tw, th = autouv(raw)
        if th > tw:  # keep the sheet square: a wider sheet packs shorter
            bones, tw, th = autouv(raw, tw=th)
        th = tw
        p = Painter(tw, th, bones, bid)
        paints = {**PAINT[bid], **(stage_paints(bid) if bid in STAGE_PAINT else {})}
        missing = {c[0] for b in bones for c in b[3]} - set(paints)
        assert not missing, (bid, missing)
        for cube, fn in paints.items():
            p.paint(cube, fn)
        (out / f"{bid}.geo.json").write_text(json.dumps(geo(bid, bones, tw, th), indent=2) + "\n", encoding="utf8")
        p.save(out / f"{bid}.png")
        print(f"{bid}: {tw}x{th}")


if __name__ == "__main__":
    main()
