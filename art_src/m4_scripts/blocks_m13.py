"""Hand-made models for the 1.5 facilities (systems/facilities.js): the scratching post, the nursing
trough, the carcass hook rack and the milking stall. tools/gen_m3_art.py installs
art/blocks/<id>.geo.json and .png; tools/gen_pbr.py gives each texture its PBR set.

Low-poly like the rest of the series: few cubes, the detail painted per face.

Bones the block files need (tools/gen_blocks.mjs):
  nursing_trough     milk_1..milk_3  (the `fill` state: a third of the trough each)
  carcass_hook_rack  large_1..4, small_1..4  (hook_<n>: 1 a side of meat, 2 a plucked bird)

Fronts face north, the side the block turns toward the player who places it.

Run with: python art_src/m4_scripts/blocks_m13.py
(then python art_src/m4_scripts/bbmodel.py <id> to refresh the Blockbench files)
"""
import json
from pathlib import Path

from boxuv import Painter
from blocks_m3 import autouv, corners, geo, solid
from blocks_m4 import HAY, WOOD, WOOD_DK, WOOD_LT, hay, iron, mix, rope, wood

ROOT = Path(__file__).resolve().parents[2]

TIN, TIN_DK, TIN_LT = (176, 182, 188), (128, 134, 142), (220, 224, 228)
MILK, MILK_DK = (246, 246, 240), (226, 224, 214)
TEAT, TEAT_DK = (214, 120, 118), (160, 80, 80)
BRISTLE, BRISTLE_DK = (196, 168, 116), (140, 112, 70)
FUR, FUR_DK = (226, 210, 180), (170, 140, 104)
MEAT, MEAT_DK, FAT, BONE = (176, 62, 58), (126, 38, 38), (240, 226, 206), (236, 230, 214)
SKIN, SKIN_DK, SHANK = (240, 206, 180), (214, 170, 140), (226, 160, 60)
HOOK = (70, 72, 80)


def rnd(f, i, j, salt=0):
    return ((i * 73856093) ^ (j * 19349663) ^ ((sum(map(ord, f)) + salt) * 83492791)) % 100


# --- 抓癢柱 scratching post: a post on a plank foot, bristle pads front and back -----------

SCRATCHING_POST = [
    ("post", None, [0, 0, 0], [
        ("foot", [-4, 0, -4], [8, 2, 8]),
        ("pole", [-2, 2, -2], [4, 13, 4]),
        ("cap", [-2.5, 15, -2.5], [5, 1, 5]),
        ("pad", [-1.5, 4, -3], [3, 8, 1]),
        ("pad", [-1.5, 4, 2], [3, 8, 1]),
    ]),
]


def pole(f, i, j, w, h, fi):
    """Rubbed wood: a rope band near the top, the grain polished pale where hides rub, fur caught
    in the splits."""
    if f in ("top", "bottom"):
        return WOOD_LT
    if j in (1, 2):
        return rope(f, i, j, w, h, fi)
    c = wood(WOOD)(f, i, j, w, h, fi)
    if 4 <= j <= 10:
        c = mix(c, (214, 176, 128), 0.35)  # worn smooth
    if rnd(f, i, j) < 9 and j > 3:
        return FUR
    return c


def pad(f, i, j, w, h, fi):
    """A stiff bristle pad: rows of tufts, fur tangled in it."""
    if f in ("north", "south"):
        r = rnd(f, i, j, 5)
        if r < 10:
            return FUR
        return BRISTLE_DK if i == 1 and j % 3 == 0 else BRISTLE
    return mix(WOOD_DK, BRISTLE_DK, 0.3)


def foot(f, i, j, w, h, fi):
    """Two planks crossing under the post, a scatter of loose fur on top."""
    if f == "top":
        if rnd(f, i, j, 2) < 12:
            return FUR if rnd(f, i, j, 3) < 60 else FUR_DK
        return wood(WOOD_DK)(f, i if 2 <= j <= 5 else j, j, w, h, fi)
    return wood(WOOD_DK)(f, i, j, w, h, fi)


# --- 幼獸飲水槽 nursing trough: a low milk trough with teats along the front ---------------

NURSING_TROUGH = [
    ("trough", None, [0, 0, 0], [
        ("end", [-8, 0, -5], [2, 9, 10]),
        ("end", [6, 0, -5], [2, 9, 10]),
        ("floor", [-6, 3, -4], [12, 1, 8]),
        ("wall", [-6, 3, -5], [12, 5, 1]),
        ("wall", [-6, 3, 4], [12, 5, 1]),
        ("teats", [-5, 5, -6], [10, 2, 1]),
    ]),
    # The `fill` state shows one of these (r_nursing_trough.json).
    ("milk_1", "trough", [0, 4, 0], [("milk_low", [-6, 4, -4], [12, 1, 8])]),
    ("milk_2", "trough", [0, 4, 0], [("milk_mid", [-6, 4, -4], [12, 2, 8])]),
    ("milk_3", "trough", [0, 4, 0], [("milk_high", [-6, 4, -4], [12, 3, 8])]),
]


def end(f, i, j, w, h, fi):
    """The trough's end boards: planks with a cut-out foot."""
    if f in ("east", "west") and j >= h - 3 and 3 <= i <= w - 4:
        return mix(WOOD_DK, (40, 26, 16), 0.5)  # shadow under the arch
    return wood(WOOD)(f, i, j, w, h, fi)


def wall(f, i, j, w, h, fi):
    """Tin-lined walls: wood outside, a tin rim on top."""
    if f == "top":
        return TIN_LT
    return wood(WOOD)(f, i, j, w, h, fi) if j > 0 else TIN


def teats(f, i, j, w, h, fi):
    """A tin feed pipe with three rubber teats along it."""
    if f in ("north", "bottom") and i in (1, 4, 7) and j == h - 1:
        return TEAT
    if f == "north" and i in (1, 4, 7):
        return TEAT_DK if j == 0 else TEAT
    if f == "top":
        return TIN_LT
    return TIN if j == 0 else TIN_DK


def milk(f, i, j, w, h, fi):
    if f == "top":
        return MILK_DK if rnd(f, i, j) < 10 else MILK
    return MILK_DK


# --- 屠體掛勾架 carcass hook rack: a beam on two posts, four hooks ---------------------------

def _slots():
    bones = []
    for n, x in enumerate((-6.75, -3.25, 0.25, 3.75), 1):
        bones.append((f"large_{n}", "rack", [x + 1.5, 13, 0], [("side", [x, 3, -1.5], [3, 10, 3])]))
        bones.append((f"small_{n}", "rack", [x + 1.5, 13, 0], [("bird", [x, 7, -1], [3, 6, 2])]))
    return bones


HOOK_RACK = [
    ("rack", None, [0, 0, 0], [
        ("upright", [-8, 0, -1.5], [1, 16, 3]),
        ("upright", [7, 0, -1.5], [1, 16, 3]),
        ("beam", [-7, 13, -1.5], [14, 3, 3]),
    ]),
    *_slots(),
]


def upright(f, i, j, w, h, fi):
    if f in ("top", "bottom"):
        return WOOD_LT
    c = wood(WOOD_DK)(f, i, j, w, h, fi)
    return mix(c, (60, 40, 24), 0.4) if j >= h - 2 else c


def beam(f, i, j, w, h, fi):
    """The beam with four iron S-hooks painted hanging off its front and back, over the slots."""
    if f in ("north", "south") and j == h - 1:
        x = i if f == "north" else w - 1 - i
        if x in (1, 5, 8, 12):  # one hook over each slot
            return HOOK
    if f == "bottom" and (i in (1, 5, 8, 12)) and j == 1:
        return HOOK
    if f in ("north", "south") and j == 0 and i % 4 == 2:
        return iron(f, i, j, w, h, fi)  # the bolts holding the hooks
    return wood(WOOD)(f, i, j, w, h, fi)


def side(f, i, j, w, h, fi):
    """A hanging side of meat: deep red with white fat seams, the bone knuckle at the bottom and
    the hook through the hock at the top."""
    if f == "top":
        return HOOK if (i, j) == (1, 1) else FAT
    if f == "bottom":
        return BONE if (i, j) == (1, 1) else FAT
    if j == 0:
        return HOOK if i == 1 else MEAT_DK
    if j >= h - 2 and i == 1:
        return BONE
    if j in (3, 7) and rnd(f, i, j, 1) < 70:
        return FAT  # the fat seams between the muscles
    if i == w - 1 and f in ("north", "south"):
        return MEAT_DK
    return MEAT_DK if rnd(f, i, j) < 12 else MEAT


def bird(f, i, j, w, h, fi):
    """A plucked bird hung by its feet: orange shanks at the top, pale skin below."""
    if j <= 1 and f not in ("bottom",):
        if f == "top":
            return HOOK if (i, j) == (1, 0) else SHANK
        return SHANK if i != 1 else HOOK
    if f == "top":
        return SHANK
    return SKIN_DK if rnd(f, i, j) < 22 or j == h - 1 else SKIN


# --- 多欄擠奶架 milking stall: four posts, side rails, a head yoke and feed box -------------

MILKING_STALL = [
    ("stall", None, [0, 0, 0], [
        ("floor", [-8, 0, -8], [16, 1, 16]),
        *corners("post", -8, 6, -8, 6, 1, [2, 13, 2]),
        ("rail", [-7.5, 7, -6], [1, 2, 12]),
        ("rail", [6.5, 7, -6], [1, 2, 12]),
        ("yoke", [-6, 9, -7.5], [12, 4, 1]),
        ("feed_box", [-6, 1, -8], [12, 4, 3]),
    ]),
]


def floor(f, i, j, w, h, fi):
    """Floor boards running front to back, straw scattered at the back where she stands."""
    if f == "top":
        if j > 6 and rnd(f, i, j) < 30:
            return hay(f, i, j, w, h, fi)
        c = WOOD if i % 4 else mix(WOOD, (30, 18, 10), 0.3)
        return mix(c, (255, 230, 190), 0.1) if (i * 5 + j) % 9 == 0 else c
    return wood(WOOD_DK)(f, i, j, w, h, fi)


def yoke(f, i, j, w, h, fi):
    """The head yoke: top and bottom bars, two upright neck bars, the gap between them open."""
    if f in ("north", "south"):
        if 1 <= j <= h - 2 and not (i in (3, 4, 7, 8)):
            return None  # the open neck gap and the sides (left clear)
        return wood(WOOD_LT if j in (0, h - 1) else WOOD)(f, i, j, w, h, fi)
    if f in ("top", "bottom"):
        return WOOD_LT
    return None if 1 <= j <= h - 2 else WOOD


def feed_box(f, i, j, w, h, fi):
    if f == "top" and 0 < i < w - 1 and 0 < j < h - 1:
        return hay(f, i, j, w, h, fi)
    return wood(WOOD)(f, i, j, w, h, fi)


PAINT = {
    "scratching_post": {"foot": foot, "pole": pole, "cap": wood(WOOD_LT, rings=WOOD_DK), "pad": pad},
    "nursing_trough": {"end": end, "floor": solid(TIN_DK), "wall": wall, "teats": teats,
                       "milk_low": milk, "milk_mid": milk, "milk_high": milk},
    "carcass_hook_rack": {"upright": upright, "beam": beam, "side": side, "bird": bird},
    "milking_stall": {"floor": floor, "post": wood(WOOD_DK, rings=WOOD_LT), "rail": wood(WOOD),
                      "yoke": yoke, "feed_box": feed_box},
}

BLOCKS = {
    "scratching_post": SCRATCHING_POST,
    "nursing_trough": NURSING_TROUGH,
    "carcass_hook_rack": HOOK_RACK,
    "milking_stall": MILKING_STALL,
}


def main():
    out = ROOT / "art" / "blocks"
    out.mkdir(parents=True, exist_ok=True)
    for bid, raw in BLOCKS.items():
        bones, tw, th = autouv(raw)
        if th > tw:
            bones, tw, th = autouv(raw, tw=th)
        th = tw
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
