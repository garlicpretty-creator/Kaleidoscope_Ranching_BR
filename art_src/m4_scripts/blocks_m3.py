"""Hand-made M3 processing blocks: geometry and textures for art/blocks/.

Bone names match the procedural models in tools/art/blocks.py, so the block states and
bone_visibility in packs/BP/blocks/r_<id>.json keep working:
  nest_box        box + egg_1..egg_4            (eggs state)
  incubator       base + busy + egg_1..egg_4    (eggs, busy states)
  butter_churn    churn + busy + busy_1..busy_3
  cheese_press    press + busy + busy_1..busy_3
  aging_rack      rack + busy + busy_1..busy_3
  fermenting_jar  jar + busy + busy_1..busy_3
  pickling_vat    vat + busy + busy_1..busy_3
  tanning_rack    frame + busy + busy_1..busy_3
On the stations, busy_1..3 are the contents of `busy` in the colours of the three stages of a
batch (station_stages.py); `busy` keeps what is shown all through the job.
The blocks render with alpha_test, so glass is clear pixels with a painted frame and streaks.
tools/gen_m3_art.py installs these in place of the procedural versions.

Run with: python art_src/m4_scripts/blocks_m3.py
"""
import json
from pathlib import Path

from PIL import Image

from boxuv import Painter
from blocks_m4 import WOOD, WOOD_DK, WOOD_LT, hay, iron, mix, rope, stone, wood
from station_stages import STAGE_PAINT, stage_paints, staged

ROOT = Path(__file__).resolve().parents[2]
NS = "kaleidoscope_ranching"

CREAM = (246, 238, 210)
EGG = (240, 228, 204)
GLAZE, GLAZE_DK = (124, 70, 40), (84, 46, 28)
CLAY = (184, 132, 92)


# --- geometry ------------------------------------------------------------------------

def autouv(bones, tw=64):
    """Gives every cube a box-UV place; cubes with the same name and size share one."""
    seen, x, y, row = {}, 0, 0, 0
    out = []
    for name, parent, pivot, cubes in bones:
        new = []
        for cname, o, s in cubes:
            if cname in LIT:
                new.append((cname, o, s, None))  # laid out in <block>_candled.png (lit_uv)
                continue
            key = (cname, tuple(s))
            if key not in seen:
                w, h, d = [max(1, round(v)) for v in s]
                fw, fh = 2 * (w + d), d + h
                if x + fw > tw:
                    x, y, row = 0, y + row, 0
                seen[key] = [x, y]
                x += fw
                row = max(row, fh)
            new.append((cname, o, s, seen[key]))
        out.append((name, parent, pivot, new))
    th = 16
    while th < y + row:
        th *= 2
    return out, tw, th


LIT_SCALE = 4  # texels per model pixel on the candled shells, so the chick's shadow has a shape


def lit_rects(cname):
    """Face rectangles (u, v, w, h) of a candled shell cube in <block>_candled.png: stage s on row
    16*s, the 2-pixel shell at u 0 and its 1-pixel tip at u 32, laid out as a box UV at LIT_SCALE."""
    stage, tip = int(cname[-1]), "tip" in cname
    n = LIT_SCALE * (1 if tip else 2)
    u, v = (32 if tip else 0), 16 * stage
    return {"up": (u + n, v, n, n), "down": (u + 2 * n, v, n, n), "north": (u + n, v + n, n, n),
            "east": (u, v + n, n, n), "south": (u + 3 * n, v + n, n, n), "west": (u + 2 * n, v + n, n, n)}


def lit_uv(cname):
    """Per-face UVs of a candled shell cube, drawn from <block>_candled.png (material `candled`)."""
    out = {}
    for f, (u, v, w, h) in lit_rects(cname).items():
        uv, size = ([u, v + h], [w, -h]) if f == "down" else ([u, v], [w, h])
        out[f] = {"uv": uv, "uv_size": size, "material_instance": "candled"}
    return out


def geo(bid, bones, tw, th):
    out = []
    for name, parent, pivot, cubes in bones:
        b = {"name": name, "pivot": pivot, "cubes": [
            {"origin": o, "size": s, "uv": lit_uv(c) if c in LIT else uv} for c, o, s, uv in cubes]}
        if parent:
            b["parent"] = parent
        out.append(b)
    return {"format_version": "1.12.0", "minecraft:geometry": [{
        "description": {"identifier": f"geometry.{NS}.{bid}", "texture_width": tw, "texture_height": th,
                        "visible_bounds_width": 2.0, "visible_bounds_height": 2.0, "visible_bounds_offset": [0, 0.75, 0]},
        "bones": out}]}


def corners(name, x0, x1, z0, z1, y, size):
    return [(name, [x, y, z], size) for x in (x0, x1) for z in (z0, z1)]


def egg(x, y, z):
    return [("egg", [x, y, z], [2, 2, 2]), ("egg_tip", [x + 0.5, y + 2, z + 0.5], [1, 1, 1])]


# 1.1 蛋的進度: every egg slot also has a cracked look, a nearly hatched look and three candled
# looks: the egg glowing amber-white with the chick's shadow painted on the shell, small, medium
# or large by how far along it is. Which one shows is chosen by the block's
# eggs/cracks/ready/candled states (tools/gen_blocks.mjs). The candled shells are opaque and drawn
# with the same render method as the rest of the block (Bedrock wants one per block), from their
# own texture <block>_candled.png (material instance `candled`), emissive in the PBR set.
LIT = {f"lit_{part}_{stage}" for part in ("shell", "tip") for stage in range(3)}


def egg_slot(n, parent, pivot, x, y, z):
    """The bones of egg slot n: plain, cracked, hatching, and candled at each of three stages."""
    return [
        (f"egg_{n}", parent, pivot, egg(x, y, z)),
        (f"egg_{n}_crack", parent, pivot, [("egg_crack", [x, y, z], [2, 2, 2]), ("egg_tip", [x + 0.5, y + 2, z + 0.5], [1, 1, 1])]),
        # the cap is pushed up off the top, a dark gap where the chick is breaking out
        (f"egg_{n}_hatch", parent, pivot, [("egg_hatch", [x, y, z], [2, 2, 2]), ("egg_cap", [x + 0.5, y + 2.5, z + 0.5], [1, 1, 1])]),
        *[(f"egg_{n}_lit_{s}", parent, pivot,
           [(f"lit_shell_{s}", [x, y, z], [2, 2, 2]), (f"lit_tip_{s}", [x + 0.5, y + 2, z + 0.5], [1, 1, 1])])
          for s in range(3)],
    ]


NEST_BOX = [
    ("box", None, [0, 0, 0], [
        ("floor", [-7, 0, -7], [14, 1, 14]),
        ("straw", [-6, 1, -6], [12, 2, 12]),
        ("wall_b", [-7, 1, 5], [14, 5, 2]),
        ("wall_s", [-7, 1, -7], [2, 4, 12]),
        ("wall_s", [5, 1, -7], [2, 4, 12]),
        ("lip", [-5, 1, -7], [10, 2, 1]),
        ("tuft", [-6, 3, 1], [3, 1, 2]),
        ("tuft", [3, 3, -3], [3, 1, 2]),
    ]),
    *egg_slot(1, "box", [0, 3, 0], -4, 3, -3),
    *egg_slot(2, "box", [0, 3, 0], 1, 3, -4),
    *egg_slot(3, "box", [0, 3, 0], -3, 3, 1),
    *egg_slot(4, "box", [0, 3, 0], 2, 3, 1),
]

INCUBATOR = [
    ("base", None, [0, 0, 0], [
        ("plinth", [-7, 0, -7], [14, 3, 14]),
        ("knob", [-1, 1, -8], [2, 1, 1]),
        ("tray", [-6, 3, -6], [12, 1, 12]),
        *corners("post", -7, 6, -7, 6, 3, [1, 7, 1]),
        ("pane_fb", [-6, 3, -7], [12, 7, 1]),
        ("pane_fb", [-6, 3, 6], [12, 7, 1]),
        ("pane_s", [-7, 3, -6], [1, 7, 12]),
        ("pane_s", [6, 3, -6], [1, 7, 12]),
        ("roof", [-7, 10, -7], [14, 1, 14]),
        ("roof_top", [-5, 11, -5], [10, 1, 10]),
        ("lamp", [-2, 12, -2], [4, 1, 4]),
    ]),
    # warming lamp: a glowing bulb on top and the heater under the roof, seen through the glass
    ("busy", "base", [0, 12, 0], [
        ("bulb", [-1, 13, -1], [2, 1, 2]),
        ("heater", [-2, 9, -2], [4, 1, 4]),
    ]),
    *egg_slot(1, "base", [0, 4, 0], -4, 4, -4),
    *egg_slot(2, "base", [0, 4, 0], 2, 4, -4),
    *egg_slot(3, "base", [0, 4, 0], -4, 4, 1),
    *egg_slot(4, "base", [0, 4, 0], 2, 4, 1),
]

BUTTER_CHURN = [
    ("churn", None, [0, 0, 0], [
        ("stand", [-5, 0, -5], [10, 1, 10]),
        ("staves", [-4, 1, -4], [8, 11, 8]),
        ("hoop", [-4.5, 2, -4.5], [9, 1, 9]),
        ("hoop", [-4.5, 9, -4.5], [9, 1, 9]),
        ("lid", [-3, 12, -3], [6, 1, 6]),
        ("pole", [-0.5, 13, -0.5], [1, 7, 1]),
        ("handle", [-2.5, 19, -0.5], [5, 1, 1]),
    ]),
    # churning: cream foams up around the dasher and runs down the front
    ("busy", "churn", [0, 12, 0], [
        ("foam", [-1.5, 13, -1.5], [3, 1, 3]),
        ("spill", [0, 12, -3.5], [2, 1, 1]),
        ("drip", [1, 10, -4.5], [1, 2, 1]),
    ]),
]

CHEESE_PRESS = [
    ("press", None, [0, 0, 0], [
        ("board", [-7, 0, -7], [14, 2, 14]),
        ("spout", [-1, 1, -8], [2, 1, 1]),
        ("mould", [-4, 2, -4], [8, 6, 8]),
        ("band", [-4.5, 3, -4.5], [9, 1, 9]),
        ("band", [-4.5, 6, -4.5], [9, 1, 9]),
        ("follower", [-3, 8, -3], [6, 1, 6]),
        ("upright", [-7, 2, -1], [2, 13, 2]),
        ("upright", [5, 2, -1], [2, 13, 2]),
        ("beam", [-7, 12, -1.5], [14, 2, 3]),
        ("screw", [-0.5, 9, -0.5], [1, 5, 1]),
        ("bar", [-3, 14, -0.5], [6, 1, 1]),
        ("bar_z", [-0.5, 14, -3], [1, 1, 6]),
    ]),
    # pressing: cheesecloth over the mould and whey pooling at the spout
    ("busy", "press", [0, 2, 0], [
        ("cloth", [-4.5, 7, -4.5], [9, 1, 9]),
        ("whey", [-3, 2, -7], [6, 1, 3]),
    ]),
]

AGING_RACK = [
    ("rack", None, [0, 0, 0], [
        *corners("post", -8, 6, -8, 6, 0, [2, 15, 2]),
        ("shelf", [-6, 1, -6], [12, 1, 12]),
        ("shelf", [-6, 8, -6], [12, 1, 12]),
        ("top", [-8, 15, -8], [16, 1, 16]),
        ("rail", [-6, 5, 6], [12, 1, 1]),
        ("rail", [-6, 12, 6], [12, 1, 1]),
    ]),
    ("busy", "rack", [0, 2, 0], [
        ("wheel", [-6, 2, -5], [5, 3, 5]),
        ("wheel", [0, 2, -2], [5, 3, 5]),
        ("wheel", [-4, 9, -3], [5, 3, 5]),
        ("wheel_s", [2, 9, 0], [4, 2, 4]),
    ]),
]

FERMENTING_JAR = [
    ("jar", None, [0, 0, 0], [
        ("foot", [-3, 0, -3], [6, 1, 6]),
        ("belly", [-5, 1, -5], [10, 7, 10]),
        ("shoulder", [-4, 8, -4], [8, 2, 8]),
        ("neck", [-3, 10, -3], [6, 1, 6]),
        ("lid", [-3.5, 11, -3.5], [7, 1, 7]),
        ("knob", [-1, 12, -1], [2, 1, 2]),
    ]),
    # fermenting: the mouth is sealed under a cloth tied with red string
    ("busy", "jar", [0, 11, 0], [
        ("cover", [-4, 11, -4], [8, 2, 8]),
        ("tie", [-1, 13, -1], [2, 1, 2]),
    ]),
]


def hoops(y):
    return [("hoop_fb", [-7, y, -7], [14, 1, 1]), ("hoop_fb", [-7, y, 6], [14, 1, 1]),
            ("hoop_s", [-7, y, -6], [1, 1, 12]), ("hoop_s", [6, y, -6], [1, 1, 12])]


PICKLING_VAT = [
    ("vat", None, [0, 0, 0], [
        ("floor", [-6, 0, -6], [12, 1, 12]),
        ("wall_fb", [-6, 1, -6], [12, 9, 1]),
        ("wall_fb", [-6, 1, 5], [12, 9, 1]),
        ("wall_s", [-6, 1, -5], [1, 9, 10]),
        ("wall_s", [5, 1, -5], [1, 9, 10]),
        *hoops(2), *hoops(7),
        ("brine", [-5, 1, -5], [10, 7, 10]),
        ("veg", [-3, 8, -3], [3, 1, 3]),
        ("veg", [1, 8, 0], [3, 1, 3]),
    ]),
    # pickling: a drop-lid pressed down with a stone
    ("busy", "vat", [0, 8, 0], [
        ("droplid", [-5, 8, -5], [10, 1, 10]),
        ("weight", [-2, 9, -2], [4, 3, 4]),
    ]),
]


# Food waste bin (systems/foodWasteBin.js): an open slatted bucket with its lid propped up at
# the back; fill_1..fill_4 raise the scraps by the block's `fill` state.
FOOD_WASTE_BIN = [
    ("bin", None, [0, 0, 0], [
        ("floor", [-5, 0, -5], [10, 1, 10]),
        ("wall_fb", [-6, 0, -6], [12, 13, 1]),
        ("wall_fb", [-6, 0, 5], [12, 13, 1]),
        ("wall_s", [-6, 0, -5], [1, 13, 10]),
        ("wall_s", [5, 0, -5], [1, 13, 10]),
        ("band_fb", [-6.5, 2, -6.5], [13, 1, 1]), ("band_fb", [-6.5, 2, 5.5], [13, 1, 1]),
        ("band_s", [-6.5, 2, -5.5], [1, 1, 11]), ("band_s", [5.5, 2, -5.5], [1, 1, 11]),
        ("band_fb", [-6.5, 10, -6.5], [13, 1, 1]), ("band_fb", [-6.5, 10, 5.5], [13, 1, 1]),
        ("band_s", [-6.5, 10, -5.5], [1, 1, 11]), ("band_s", [5.5, 10, -5.5], [1, 1, 11]),
        ("lid", [-6, 13, 5], [12, 7, 1]),
        ("lid_grip", [-2, 17, 4], [4, 1, 1]),
    ]),
    *[(f"fill_{n}", "bin", [0, 1, 0], [(f"scraps_{n}", [-5, 1, -5], [10, 3 * n, 10])]) for n in (1, 2, 3, 4)],
]


# Tanning rack (proposal 1.1, in 1.0): an upright stretching frame with a tub of tanning
# liquor at its foot; while busy a raw hide is laced into the frame.
TANNING_RACK = [
    ("frame", None, [0, 0, 0], [
        ("post", [-8, 0, -1], [2, 16, 2]),
        ("post", [6, 0, -1], [2, 16, 2]),
        ("foot", [-8, 0, -4], [2, 1, 8]),
        ("foot", [6, 0, -4], [2, 1, 8]),
        ("rail", [-6, 14, -1], [12, 2, 2]),
        ("rail", [-6, 2, -1], [12, 2, 2]),
        ("peg", [-7.5, 16, -0.5], [1, 1, 1]),
        ("peg", [6.5, 16, -0.5], [1, 1, 1]),
        ("tub", [1, 0, -7], [5, 3, 3]),
    ]),
    ("busy", "frame", [0, 4, 0], [
        ("hide", [-5, 4, -0.5], [10, 10, 1]),
        *[("cord", [x, y, -0.5], [1, 1, 1]) for x in (-6, 5) for y in (5, 8, 11)],
        *[("cord_v", [x, 13, -0.5], [1, 1, 1]) for x in (-3, 2)],
    ]),
]


# --- textures ------------------------------------------------------------------------

def solid(c, edge=None):
    def fn(f, i, j, w, h, fi):
        if edge and (i in (0, w - 1) or j in (0, h - 1)) and w > 2 and h > 2:
            return edge
        return c
    return fn


def staves(base, top=None):
    """Barrel staves: vertical boards with dark seams on the sides; plain boards on top."""
    dark = mix(base, (30, 18, 10), 0.3)

    def fn(f, i, j, w, h, fi):
        if f in ("top", "bottom"):
            if top:
                return top
            return dark if i % 3 == 2 else base
        if i % 3 == 2:
            return dark
        return mix(base, (255, 230, 190), 0.12) if (i * 7 + j // 3) % 5 == 0 else base
    return fn


def wicker(f, i, j, w, h, fi):
    a, b = (176, 128, 74), (128, 88, 50)
    if f == "top":
        return mix(a, b, 0.3)
    return a if ((i // 2) + j) % 2 == 0 else b


def egg_paint(f, i, j, w, h, fi):
    if (i * 5 + j * 3 + len(f)) % 7 == 0:
        return (206, 184, 150)
    return EGG if f != "top" else (252, 244, 226)


CRACK, CRACK_DK, HOLE = (168, 138, 100), (92, 66, 46), (58, 40, 30)


SIDES = ("north", "east", "south", "west")


def egg_crack(f, i, j, w, h, fi):
    """Small cracks: a fine brown mark near the top of every side, a step higher or lower in turn."""
    if f in SIDES and (i, j) == ((1, 0) if SIDES.index(f) % 2 else (0, 1)):
        return CRACK
    return egg_paint(f, i, j, w, h, fi)


def egg_hatch(f, i, j, w, h, fi):
    """Big cracks: a dark break round the top of every side, the top broken open under the lifted cap."""
    if f == "top":
        return HOLE if i == j else egg_paint(f, i, j, w, h, fi)
    if f in SIDES and j == 0 and i == SIDES.index(f) % 2:
        return CRACK_DK
    if f in SIDES and (i, j) == ((0, 1) if SIDES.index(f) % 2 else (1, 1)):
        return CRACK
    return egg_paint(f, i, j, w, h, fi)


def egg_cap(f, i, j, w, h, fi):
    return mix(EGG, HOLE, 0.5) if f == "bottom" else egg_paint(f, i, j, w, h, fi)


# The candled egg: lamp light through the shell, the chick's shadow on it. Shapes are ellipses in
# the texels of an 8 x 8 side face (x left to right, y down from the shell's top; the tip's side
# faces are y -4..0, x 2..6): (centre x, centre y, radius x, radius y) for the body and the head.
EMBRYO = [
    [(4, 5.2, 1.2, 1.1)],
    [(4, 5.4, 1.8, 1.6), (4, 3.0, 1.0, 1.0)],
    [(4, 5.3, 2.4, 2.2), (4, 2.0, 1.4, 1.4)],
]
GLOW_HI, GLOW_LO, GLOW_UNDER = (255, 246, 214), (255, 200, 118), (236, 170, 96)
SHADOW, SHADOW_EDGE, SHADOW_SOFT = (104, 46, 30), (150, 74, 42), (222, 142, 78)


def shade(d, glow):
    """Colour at distance d (1 = the shape's edge) from the chick's shadow, over the glow."""
    if d < 0.75:
        return SHADOW
    if d < 1.0:
        return SHADOW_EDGE
    if d < 1.2:
        return SHADOW_SOFT
    return glow


def paint_lit(img, stage):
    """Paints the candled shell and tip of `stage` into the candled texture."""
    px = img.load()
    shapes = EMBRYO[stage]

    def dist(x, y):
        return min(((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 for cx, cy, rx, ry in shapes) ** 0.5

    for tip in (False, True):
        for f, (u, v, w, h) in lit_rects(f"lit_{'tip' if tip else 'shell'}_{stage}").items():
            for j in range(h):
                for i in range(w):
                    a, b = (i + 0.5) / w, (j + 0.5) / h  # 0..1 across the face
                    glow = mix(GLOW_HI, GLOW_LO, min(1.0, 2 * ((a - 0.5) ** 2 + (b - 0.5) ** 2) ** 0.5))
                    if f == "down":
                        c = GLOW_UNDER
                    elif f == "up":
                        # seen from above, the shell's top shows the body as a round shadow; the
                        # tip's top is clear glow (the head stays below it)
                        r = shapes[0][2] / 8  # body radius as a fraction of the face
                        c = glow if tip else shade((((a - 0.5) ** 2 + (b - 0.5) ** 2) ** 0.5) / r, glow)
                    elif tip:
                        c = shade(dist(2 + 4 * a, -4 + 4 * b), glow)
                    else:
                        c = shade(dist(8 * a, 8 * b), glow)
                    px[u + i, v + j] = (*c, 255)


def glass(f, i, j, w, h, fi):
    """Clear pane (alpha_test): a pale frame and two diagonal streaks, the rest see-through."""
    if f in ("top", "bottom"):
        return (210, 232, 236)
    if i in (0, w - 1) or j in (0, h - 1):
        return (196, 226, 232)
    if w > 3 and 1 <= j <= 3 and i + j in (4, 7):
        return (236, 248, 250)
    return None


def glow(core, rim):
    def fn(f, i, j, w, h, fi):
        return core if 0 < i < w - 1 or w <= 2 else rim
    return fn


def glaze(f, i, j, w, h, fi):
    if f == "top":
        return mix(GLAZE, GLAZE_DK, 0.4)
    if i == 2 or i == 3:
        return mix(GLAZE, (255, 220, 180), 0.22)  # highlight
    if j == 1:
        return (150, 96, 54)  # pale glaze band
    return GLAZE


def brine(f, i, j, w, h, fi):
    if f == "top":
        return (174, 186, 120) if (i * 3 + j * 5) % 11 else (206, 214, 160)
    return (150, 160, 100)


def leafy(f, i, j, w, h, fi):
    return (120, 168, 72) if (i + j) % 2 else (156, 196, 96)


def scraps(f, i, j, w, h, fi):
    """Kitchen scraps: brown mash with carrot, greens, bread crust and peel bits on top."""
    r = (i * 31 + j * 17 + len(f) * 7) % 23
    if f == "top":
        bits = {0: (232, 128, 40), 1: (232, 128, 40), 2: (118, 170, 70), 3: (118, 170, 70), 4: (182, 128, 66),
                5: (236, 214, 150), 6: (196, 60, 52)}
        return bits.get(r, (124, 100, 66) if r % 3 else (104, 82, 52))
    return (112, 90, 58) if r % 4 else (92, 72, 46)


def liquor(f, i, j, w, h, fi):
    if f == "top" and 0 < i < w - 1 and 0 < j < h - 1:
        return (96, 58, 30)  # oak-bark tanning liquor
    return wood(WOOD_DK)(f, i, j, w, h, fi)


PAINT = {
    "nest_box": {"floor": wood(WOOD_DK), "straw": hay, "tuft": hay, "wall_b": wicker, "wall_s": wicker,
                 "lip": wicker, "egg": egg_paint, "egg_tip": egg_paint},
    "incubator": {"plinth": wood(WOOD), "knob": iron, "tray": hay, "post": wood(WOOD_DK, rings=WOOD_LT),
                  "pane_fb": glass, "pane_s": glass, "roof": wood(WOOD_DK), "roof_top": wood(WOOD),
                  "lamp": iron, "bulb": glow((255, 214, 96), (255, 170, 60)),
                  "heater": glow((255, 150, 60), (220, 90, 40)), "egg": egg_paint, "egg_tip": egg_paint},
    "butter_churn": {"stand": wood(WOOD_DK), "staves": staves(WOOD), "hoop": iron, "lid": wood(WOOD_DK),
                     "pole": wood(WOOD_LT), "handle": wood(WOOD)},
    "cheese_press": {"board": wood(WOOD), "spout": wood(WOOD_DK), "mould": staves(WOOD_LT, top=CREAM),
                     "band": iron, "follower": wood(WOOD_DK), "upright": wood(WOOD_DK, rings=WOOD_LT),
                     "beam": wood(WOOD_DK), "screw": iron, "bar": wood(WOOD_LT), "bar_z": wood(WOOD_LT)},
    "aging_rack": {"post": wood(WOOD_DK, rings=WOOD_LT), "shelf": wood(WOOD), "top": wood(WOOD),
                   "rail": wood(WOOD_LT)},
    "fermenting_jar": {"foot": solid(CLAY), "belly": glaze, "shoulder": glaze, "neck": solid(GLAZE_DK),
                       "lid": solid(CLAY, edge=mix(CLAY, (40, 20, 10), 0.25)), "knob": solid(CLAY),
                       "tie": solid((196, 44, 40))},
    "pickling_vat": {"floor": wood(WOOD_DK), "wall_fb": staves(WOOD), "wall_s": staves(WOOD),
                     "hoop_fb": iron, "hoop_s": iron, "brine": brine, "veg": leafy,
                     "weight": stone},
}

PAINT["food_waste_bin"] = {
    "floor": wood(WOOD_DK), "wall_fb": staves(mix(WOOD, (90, 110, 70), 0.25)), "wall_s": staves(mix(WOOD, (90, 110, 70), 0.25)),
    "band_fb": iron, "band_s": iron, "lid": wood(WOOD_DK), "lid_grip": iron,
    **{f"scraps_{n}": scraps for n in (1, 2, 3, 4)},
}

# 1.1 蛋的進度: painted after the old cubes, so the noise on everything else stays as it was.
EGG_LOOKS = {"egg_crack": egg_crack, "egg_hatch": egg_hatch, "egg_cap": egg_cap}
for _bid in ("nest_box", "incubator"):
    PAINT[_bid].update(EGG_LOOKS)

PAINT["tanning_rack"] = {
    "post": wood(WOOD_DK, rings=WOOD_LT), "foot": wood(WOOD_DK), "rail": wood(WOOD), "peg": wood(WOOD_LT),
    "tub": liquor, "cord": rope, "cord_v": rope,
}

BLOCKS = {
    "food_waste_bin": FOOD_WASTE_BIN,
    "tanning_rack": staged("tanning_rack", TANNING_RACK),
    "nest_box": NEST_BOX,
    "incubator": INCUBATOR,
    "butter_churn": staged("butter_churn", BUTTER_CHURN),
    "cheese_press": staged("cheese_press", CHEESE_PRESS),
    "aging_rack": staged("aging_rack", AGING_RACK),
    "fermenting_jar": staged("fermenting_jar", FERMENTING_JAR),
    "pickling_vat": staged("pickling_vat", PICKLING_VAT),
}


def main():
    out = ROOT / "art" / "blocks"
    out.mkdir(parents=True, exist_ok=True)
    for bid, raw in BLOCKS.items():
        bones, tw, th = autouv(raw)
        p = Painter(tw, th, [(n, pa, pv, [c for c in cubes if c[0] not in LIT]) for n, pa, pv, cubes in bones], bid)
        paints = {**PAINT[bid], **(stage_paints(bid) if bid in STAGE_PAINT else {})}
        for cube, fn in paints.items():
            p.paint(cube, fn)
        (out / f"{bid}.geo.json").write_text(json.dumps(geo(bid, bones, tw, th), indent=2) + "\n", encoding="utf8")
        p.save(out / f"{bid}.png")
        if any(c in LIT for _, _, _, cubes in bones for c, *_ in cubes):
            # Same size as the block's texture, so the per-face UVs line up with its texture size.
            lit = Image.new("RGBA", (tw, th), (0, 0, 0, 0))
            for stage in range(3):
                paint_lit(lit, stage)
            lit.save(out / f"{bid}_candled.png")
        print(f"{bid}: {tw}x{th}")


if __name__ == "__main__":
    main()
