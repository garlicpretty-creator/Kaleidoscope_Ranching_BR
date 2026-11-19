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
from blocks_m4 import HAY, HAY_DK, WOOD, WOOD_DK, WOOD_LT, hay, iron, mix, rope, wood
from station_stages import STAGE_PAINT, stage_paints, staged
from station_frames import crank, crank_z, shift, wheel

ROOT = Path(__file__).resolve().parents[2]

STEEL, STEEL_DK, STEEL_LT = (146, 150, 158), (98, 102, 112), (196, 200, 208)
TIN, TIN_DK, TIN_LT = (176, 182, 188), (128, 134, 142), (220, 224, 228)
MILK, CREAM = (244, 244, 238), (250, 236, 198)
ICE, ICE_DK, ICE_LT = (188, 222, 240), (140, 186, 216), (236, 248, 252)
YARN, YARN_DK = (236, 226, 208), (204, 190, 166)
DOWN, DOWN_DK = (248, 245, 236), (206, 198, 184)
SEAM, STITCH = (214, 200, 176), (196, 184, 162)
BINDING, LINING, SPRIG = (196, 128, 112), (226, 232, 214), (132, 166, 112)
FILM, FILM_DK, FILM_LT, TAPE = (60, 96, 64), (40, 66, 46), (132, 172, 134), (230, 228, 216)
SEP_RED, SEP_RED_DK, SEP_RED_LT = (138, 36, 32), (92, 24, 22), (178, 72, 60)
BONE_WHITE = (232, 224, 204)
HORN, HORN_DK, HORN_TIP = (224, 208, 176), (176, 150, 112), (92, 72, 56)


def ring(name, cx, cy, z):
    """A 10-pixel wheel rim standing in the x-y plane, one pixel thick, centred on (cx, cy)."""
    x, y = cx - 5, cy - 5
    px = [(3, 9, 4, 1), (1, 8, 2, 1), (7, 8, 2, 1), (1, 7, 1, 1), (8, 7, 1, 1), (0, 3, 1, 4), (9, 3, 1, 4),
          (1, 2, 1, 1), (8, 2, 1, 1), (1, 1, 2, 1), (7, 1, 2, 1), (3, 0, 4, 1)]
    return [(name, [x + i, y + j, z], [w, h, 1]) for i, j, w, h in px]


MEAT_GRINDER = [
    # 1.3: a hand-cranked mincer clamped to the front edge of a plank bench: the barrel runs front to
    # back with a funnel hopper on top, the cutting plate at the front over a bowl on the ground, a
    # clamp down the plank's edge and the crank turning behind the plank.
    ("stand", None, [0, 0, 0], [
        ("leg", [-6, 0, -1], [2, 3, 4]),
        ("leg", [4, 0, -1], [2, 3, 4]),
        ("board", [-7, 3, -1], [14, 2, 4]),
        ("seat", [-2, 5, -1], [4, 1, 3]),
        ("clamp", [-1, 2, -2], [2, 4, 1]),
        ("jaw", [-1, 2, -1], [2, 1, 2]),
        ("barrel", [-2, 6, -5], [4, 4, 6]),
        ("plate", [-2.5, 5.5, -6], [5, 5, 1]),
        ("neck", [-2, 10, -4], [4, 1, 4]),
        ("hopper", [-3, 11, -5], [6, 1, 6]),
        ("axle", [-0.5, 7.5, 1], [1, 1, 2]),
        ("bowl", [-2.5, 0, -7.5], [5, 2, 4]),
    ]),
    # 1.1 工作台互動動畫: the crank turns when it is used (station_frames.py)
    *crank_z("crank", "stand", 3, 0, 8, 3, knob_dz=1),
    ("busy", "stand", [0, 2, 0], [
        ("mince", [-2, 1.5, -7], [4, 1, 3]),
        ("strands", [-1, 2.5, -6.5], [2, 3, 1]),
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
    # 1.3: a hand-cranked separator: a red cast-iron pedestal, the separating bowl in its housing with
    # the skim and cream spouts reaching over a jug and a can, the round supply bowl on top with its
    # tap, the crank at the side.
    ("frame", None, [0, 0, 0], [
        ("base", [-5, 0, -6], [10, 1, 10]),
        ("column", [-2, 1, -2], [4, 7, 4]),
        ("axle", [2, 6, -0.5], [3, 1, 1]),
        ("housing", [-3, 8, -3], [6, 2, 6]),
        ("spout", [-2, 8.5, -6], [1, 1, 3]),
        ("spout", [1, 9.5, -6], [1, 1, 3]),
        ("tap", [-0.5, 10, -0.5], [1, 1, 1]),
        ("bowl_base", [-3, 11, -3], [6, 1, 6]),
        ("bowl_fb", [-4, 12, -4], [8, 3, 1]),
        ("bowl_fb", [-4, 12, 3], [8, 3, 1]),
        ("bowl_s", [-4, 12, -3], [1, 3, 6]),
        ("bowl_s", [3, 12, -3], [1, 3, 6]),
        ("milk_jug", [-3, 1, -6], [2, 4, 2]),
        ("cream_can", [1, 1, -6], [2, 3, 2]),
    ]),
    # 1.1 追加 方塊動畫: the crank turns when milk goes in (station_frames.py)
    *crank("crank", "frame", 5, 6.5, 0, 3, knob_dx=1),
    # separating: skim milk and cream run from the spouts all through the job; the milk in the supply
    # bowl goes down a pixel a stage and cream gathers in the can (station_stages.py)
    ("busy", "frame", [0, 12, 0], [
        ("skim_stream", [-1.75, 5, -5.75], [0.5, 3.5, 0.5]),
        ("cream_stream", [1.25, 4, -5.75], [0.5, 5.5, 0.5]),
        ("milk_lo", [-3, 12, -3], [6, 1, 6]),
        ("milk_mid", [-3, 13, -3], [6, 1, 6]),
        ("milk_hi", [-3, 14, -3], [6, 1, 6]),
        ("cream_cap", [1, 4, -6], [2, 1, 2]),
    ]),
]

ICE_CREAM_CHURN = [
    # 1.3: a squat wooden tub packed with ice round a tin canister; the gear yoke across the top
    # turns the dasher, with the crank on its side.
    ("bucket", None, [0, 0, 0], [
        ("tub", [-6, 0, -6], [12, 7, 12]),
        ("hoop", [-6.5, 1, -6.5], [13, 1, 13]),
        ("hoop", [-6.5, 5, -6.5], [13, 1, 13]),
        ("can", [-2.5, 7, -2.5], [5, 4, 5]),
        ("can_lid", [-2, 11, -2], [4, 1, 4]),
        ("bracket", [-6, 7, -1], [1, 7, 2]),
        ("bracket", [5, 7, -1], [1, 7, 2]),
        ("bar", [-5, 12, -1], [10, 1, 2]),
        ("gear", [-1.5, 12, -1.5], [3, 2, 3]),
    ]),
    *crank("crank", "bucket", 6, 12.5, 0, 2.5, knob_dx=1),
    # freezing: frost spreads over the ice, two patches, then four, then all round the can
    ("busy", "bucket", [0, 7, 0], [
        ("frost_a", [-5, 7, -5], [2, 0.5, 2]),
        ("frost_a", [3, 7, 3], [2, 0.5, 2]),
        ("frost_b", [3, 7, -5], [2, 0.5, 2]),
        ("frost_b", [-5, 7, 3], [2, 0.5, 2]),
        ("frost_c", [-1, 7, -5], [2, 0.5, 2]),
        ("frost_c", [-1, 7, 3], [2, 0.5, 2]),
        ("frost_c", [-5, 7, -1], [2, 0.5, 2]),
        ("frost_c", [3, 7, -1], [2, 0.5, 2]),
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
    # 1.1 追加 方塊動畫: the beater swings in and out when yarn goes on (station_frames.py):
    # one cube, swords at its ends riding on the side rails, the reed between
    # them under the hand-tree; it slides from the heddle to the cloth at the front beam and back
    *shift("beater", "frame", [("beater", [-6.5, 9, -1], [13, 5, 1])], [(0, 0, 0), (0, 0, -1), (0, 0, -2), (0, 0, -1)]),
    ("busy", "frame", [0, 10, -5], [
        ("cloth", [-5, 10.5, -4], [10, 1, 1]),
        ("cloth_roll", [-4, 8.5, -6.5], [8, 3, 3]),
    ]),
]

SILAGE_BARREL = [
    # 1.3: a tall drum sealed in green silage wrap, gathered and tied at the top, on a pallet; while
    # busy an old tyre weighs the top down and forage pokes out at the edge.
    ("barrel", None, [0, 0, 0], [
        ("pallet", [-6, 0, -6], [12, 1, 12]),
        ("drum", [-5, 1, -4], [10, 12, 8]),
        ("drum", [-4, 1, -5], [8, 12, 10]),
        ("shoulder", [-4, 13, -4], [8, 1, 8]),
        ("knot", [-1, 14, -1], [2, 1, 2]),
    ]),
    ("busy", "barrel", [0, 14, 0], [
        ("tyre", [-3, 14, -3], [6, 2, 6]),
        ("tuft", [4, 13, -1.5], [1, 1, 3]),
        ("tuft", [-5, 13, -1.5], [1, 1, 3]),
    ]),
]

DOWN_PILLOW = [
    # 1.3: a plump pillow: a fat middle, thinner gathered ends, and the top puffed up.
    ("pillow", None, [0, 0, 0], [
        ("body", [-5, 0, -4], [10, 4, 8]),
        ("end", [-6, 0.5, -3], [1, 3, 6]),
        ("end", [5, 0.5, -3], [1, 3, 6]),
        ("puff", [-4, 4, -3], [8, 1, 6]),
    ]),
]

DOWN_QUILT = [
    # 1.3: a thick quilted comforter, its top edge stepped in a pixel so it reads puffed, the top
    # third folded back over itself with a rolled edge, showing the lining.
    ("quilt", None, [0, 0, 0], [
        ("sheet", [-8, 0, -8], [16, 3, 16]),
        ("top", [-7, 3, -7], [14, 1, 14]),
        ("fold", [-7, 4, 3], [14, 2, 4]),
        ("roll", [-7, 4, 2], [14, 1, 1]),
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
    # 1.3: a pair of horns on a wooden wall plaque. The plaque stands at the back of the block (+z,
    # away from whoever placed it), so set against a wall it hangs there. The horns leave the skull
    # boss sideways, climb in diagonal steps and turn their tips in toward each other.
    ("plaque", None, [0, 0, 0], [
        ("foot", [-4, 0, 5], [8, 1, 3]),
        ("board", [-6, 1, 6], [12, 9, 2]),
        ("crest", [-4, 10, 6], [8, 1, 2]),
        ("boss", [-2, 6, 4], [4, 4, 2]),
        ("horn_root", [-4, 8, 4.5], [2, 2, 1]),
        ("horn_root", [2, 8, 4.5], [2, 2, 1]),
        ("horn_mid", [-6, 9, 4.5], [2, 1, 1]),
        ("horn_mid", [4, 9, 4.5], [2, 1, 1]),
        ("horn_rise", [-7, 10, 4.5], [1, 3, 1]),
        ("horn_rise", [6, 10, 4.5], [1, 3, 1]),
        ("horn_tip", [-6, 13, 4.5], [1, 1, 1]),
        ("horn_tip", [5, 13, 4.5], [1, 1, 1]),
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


def beater(f, i, j, w, h, fi):
    """The loom's beater in one cube: a sword at each end, the hand-tree along the top, and the reed
    between them, fine dark dents between bright wires over a wooden bottom rail."""
    if f in ("north", "south"):
        if i in (0, w - 1):
            return wood(WOOD)(f, i, j, w, h, fi)  # the swords
        if j == 0:
            return WOOD_LT  # the hand-tree
        if j == h - 1:
            return WOOD
        return (88, 64, 44) if i % 2 else (196, 188, 170)
    return WOOD_LT if f == "top" else WOOD


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


def soft(f, i, j, w, h, fi, lit=DOWN, dark=DOWN_DK):
    """Puffed cloth: bright in the middle of a face, shading off toward its edges."""
    di = abs(i + 0.5 - w / 2) / (w / 2)
    dj = abs(j + 0.5 - h / 2) / (h / 2)
    return mix(lit, dark, min(1.0, max(di, dj) ** 2 * 1.1))


def pillow(f, i, j, w, h, fi):
    if f in ("top", "bottom"):
        return soft(f, i, j, w, h, fi)
    if j == 1 and f in ("north", "south") and 0 < i < w - 1:
        return SEAM  # the piped seam round the middle
    return mix(DOWN, DOWN_DK, 0.25 + 0.5 * j / max(1, h - 1))


def pillow_end(f, i, j, w, h, fi):
    """The gathered ends: fine creases running out from the corners."""
    if f in ("east", "west"):
        return DOWN_DK if i % 2 else mix(DOWN, DOWN_DK, 0.4)
    return mix(DOWN, DOWN_DK, 0.5)


def quilt_top(f, i, j, w, h, fi):
    """Quilted down: 5-pixel puffs, each bright in the middle and shading off to soft stitched seams,
    with a binding round the edge."""
    if f == "bottom":
        return LINING
    if f != "top":
        return BINDING if j == 0 else mix(DOWN, DOWN_DK, 0.35)
    if i in (0, w - 1) or j in (0, h - 1):
        return BINDING
    a, b = (i - 1) % 5, (j - 1) % 5
    return soft(f, a, b, 5, 5, fi, DOWN, STITCH)


def quilt_fold(f, i, j, w, h, fi):
    """The folded-back third shows the sprigged lining on top; its front is the rolled edge."""
    if f == "top":
        if i in (0, w - 1) or j in (0, h - 1):
            return mix(LINING, DOWN_DK, 0.4)
        return SPRIG if (i * 3 + j * 5) % 7 == 0 else LINING
    if f in ("east", "west"):
        return mix(DOWN, DOWN_DK, 0.5)
    return mix(LINING, DOWN_DK, 0.25 + 0.4 * j / max(1, h - 1))


def quilt_side(f, i, j, w, h, fi):
    """The quilt's thick sides: the binding at the top edge, the down bulging out below it."""
    if f == "top":
        return BINDING
    if f == "bottom":
        return LINING
    if j == 0:
        return BINDING
    return mix(DOWN, DOWN_DK, 0.15 + 0.6 * abs(j - h / 2) / h) if i % 5 else STITCH


def round_tin(f, i, j, w, h, fi):
    """The supply bowl's walls: tin shading off at both ends of each side so the bowl reads round."""
    if f == "top":
        return TIN_LT
    if f == "bottom":
        return TIN_DK
    if i in (0, w - 1):
        return mix(TIN_DK, (60, 64, 72), 0.3)
    if i in (1, w - 2):
        return TIN_DK if w > 2 else TIN
    if j == 0:
        return TIN_LT
    return TIN if i != 2 else mix(TIN, TIN_LT, 0.6)


def funnel(f, i, j, w, h, fi):
    """The mincer's hopper tray, seen into from above: darker toward the throat in the middle."""
    if f == "top":
        d = max(abs(i + 0.5 - w / 2), abs(j + 0.5 - h / 2))
        if d > w / 2 - 1:
            return STEEL_LT
        return mix((112, 116, 126), (30, 30, 36), 1 - d / (w / 2 - 1))
    return cast()(f, i, j, w, h, fi)


def horn(f, i, j, w, h, fi):
    return HORN_DK if (j + i // 2) % 3 == 0 else HORN


def plaque(f, i, j, w, h, fi):
    """The wall board: dark stained wood with a carved border a pixel in from the edge."""
    if f in ("north", "south") and w > 4 and (i in (1, w - 2) and 0 < j < h - 1 or j in (1, h - 2) and 0 < i < w - 1):
        return mix(WOOD_DK, (30, 18, 10), 0.45)
    return wood(WOOD_DK)(f, i, j, w, h, fi)


def hide_boss(f, i, j, w, h, fi):
    """The boss the horns are set in: the bleached top of the skull, a ridge down the middle."""
    if f == "north" and i in (w // 2 - 1, w // 2) and j > 0:
        return mix(BONE_WHITE, HORN_DK, 0.35)
    if j == h - 1 and f != "top":
        return mix(BONE_WHITE, HORN_DK, 0.5)
    return BONE_WHITE if rnd(f, i, j) > 15 else mix(BONE_WHITE, HORN_DK, 0.2)


def film(f, i, j, w, h, fi):
    """Green silage wrap wound round the drum: overlapping turns running on a slant, a sheen down
    one side, a white tape band."""
    if f in ("top", "bottom"):
        return FILM_DK if (i + j) % 4 == 0 else FILM
    if j in (h // 2, h // 2 + 1):
        return TAPE if j == h // 2 else mix(TAPE, FILM_DK, 0.3)
    base = mix(FILM, FILM_DK, 0.35) if (i + 2 * j) % 11 == 0 else FILM
    if i == 1:
        return mix(base, FILM_LT, 0.6)
    if i == w - 1:
        return mix(base, FILM_DK, 0.6)
    return base


def gathered(f, i, j, w, h, fi):
    """The wrap bunched together over the top: pleats running in to the knot."""
    if f == "top":
        return FILM_DK if (i + j) % 2 or (i - j) % 3 == 0 else FILM
    return FILM_DK if i % 2 else FILM


def tyre(f, i, j, w, h, fi):
    if f == "top":
        if 1 < i < w - 2 and 1 < j < h - 2:
            return (22, 22, 24)  # the hole
        return (70, 70, 74) if (i + j) % 3 == 0 else (54, 54, 58)
    return (40, 40, 44) if (i + j) % 2 else (62, 62, 66)  # tread


def pallet(f, i, j, w, h, fi):
    if f == "top":
        return mix(WOOD_LT, (30, 18, 10), 0.5) if i % 4 == 3 else WOOD_LT
    return wood(WOOD)(f, i, j, w, h, fi)


def feed_box(f, i, j, w, h, fi):
    if f == "top" and 0 < i < w - 1 and 0 < j < h - 1:
        return hay(f, i, j, w, h, fi)
    return wood(WOOD)(f, i, j, w, h, fi)


def fleece(f, i, j, w, h, fi):
    r = rnd(f, i, j)
    return YARN_DK if r < 25 else (250, 246, 236) if r > 80 else YARN


GATE = {"rail": wood(WOOD), "stile": wood(WOOD_LT), "open_rail": wood(WOOD), "open_stile": wood(WOOD_LT)}

PAINT = {
    "meat_grinder": {"leg": wood(WOOD_DK), "board": wood(WOOD), "seat": cast(), "clamp": cast(), "jaw": cast(),
                     "barrel": cast(), "plate": perforated, "neck": cast(), "hopper": funnel, "axle": iron, "crank": cast(), "grip": wood(WOOD_LT),
                     "bowl": vessel(cast(TIN, TIN_DK, TIN_LT), (96, 100, 108), TIN_LT)},
    "milking_rack": {"post": wood(WOOD_DK, rings=WOOD_LT), "rail": wood(WOOD), "yoke": wood(WOOD),
                     "neck_bar": wood(WOOD_LT), "feed_box": feed_box,
                     "pail": vessel(cast(TIN, TIN_DK, TIN_LT), MILK, TIN_LT), "pail_handle": iron,
                     "stool_seat": wood(WOOD_LT), "stool_leg": wood(WOOD_DK)},
    "cream_separator": {"base": cast(SEP_RED, SEP_RED_DK, SEP_RED_LT), "column": cast(SEP_RED, SEP_RED_DK, SEP_RED_LT),
                        "axle": iron, "housing": cast(TIN, TIN_DK, TIN_LT), "spout": cast(TIN, TIN_DK, TIN_LT),
                        "tap": iron, "bowl_base": vessel(cast(TIN, TIN_DK, TIN_LT), (84, 90, 100), TIN_LT),
                        "bowl_fb": round_tin, "bowl_s": round_tin, "skim_stream": solid((226, 234, 242)),
                        "cream_stream": solid((250, 238, 200)),
                        "cream_can": vessel(cast(TIN, TIN_DK, TIN_LT), CREAM, TIN_LT),
                        "milk_jug": vessel(cast(TIN, TIN_DK, TIN_LT), MILK, TIN_LT),
                        "crank": cast(), "grip": wood(WOOD_LT)},
    "ice_cream_churn": {"tub": vessel(staves(WOOD), ice, WOOD_DK), "hoop": iron,
                        "can": cast(TIN, TIN_DK, TIN_LT), "can_lid": cast(TIN, TIN_DK, TIN_LT), "bracket": cast(),
                        "bar": cast(), "gear": cast(), "crank": cast(), "grip": wood(WOOD_LT)},
    "spinning_wheel": {"bench": wood(WOOD_DK), "leg": wood(WOOD_DK), "treadle": wood(WOOD),
                       "upright": wood(WOOD), "rim": solid(WOOD_DK), "hub": wood(WOOD_DK, rings=WOOD_LT),
                       "spoke_h": solid(WOOD_LT), "spoke_v": solid(WOOD_LT), "spoke_d": solid(WOOD_LT), "maiden": wood(WOOD),
                       "spindle": iron, "distaff": wood(WOOD_LT), "fleece": fleece},
    "weaving_loom": {"front_post": wood(WOOD_DK, rings=WOOD_LT), "back_post": wood(WOOD_DK, rings=WOOD_LT),
                     "side_rail": wood(WOOD), "foot_rail": wood(WOOD_DK), "beam": wood(WOOD_LT),
                     "warp": threads(YARN, YARN_DK), "warp_back": threads(YARN, YARN_DK),
                     "heddle": threads(WOOD, YARN), "beater": beater,
                     "treadle": wood(WOOD)},
    "silage_barrel": {"pallet": pallet, "drum": film, "shoulder": gathered, "knot": rope, "tyre": tyre},
    "down_pillow": {"body": pillow, "end": pillow_end, "puff": pillow},
    "down_quilt": {"sheet": quilt_side, "top": quilt_top, "fold": quilt_fold, "roll": quilt_fold},
    "pen_gate": {"post": wood(WOOD_DK, rings=WOOD_LT), "hinge": iron, "latch": iron,
                 "brace": wood(WOOD_DK), "open_brace": wood(WOOD_DK), **GATE},
    "pen_gate_top": {"post_top": wood(WOOD_DK), "cap": wood(WOOD_LT, rings=WOOD_LT), **GATE},
    "horn_decor": {"foot": wood(WOOD), "board": plaque, "crest": plaque, "boss": hide_boss,
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
