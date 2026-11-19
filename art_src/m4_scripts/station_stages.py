"""Stages of a running batch on the processing stations: the contents change colour.

The game shows no text on screen, so a station shows how far its batch has got by the colour of
what is being worked (systems/stations.js `stage`, tools/gen_blocks.mjs):

  bone busy     the parts shown all through the job (a weight, cords, a string tie)
  bone busy_1   the contents as they go in        (first third of the time)
  bone busy_2   half way                          (second third)
  bone busy_3   nearly or wholly done             (last third, and while it waits to be taken)

busy_1..3 hold the same cubes, each with its own place in the texture painted in that stage's
colours; one of them is shown at a time. `staged()` moves a station's content cubes out of its
`busy` bone into the three stage bones (cube names get _s1, _s2, _s3, so autouv gives each its
own texels), and STAGE_PAINT gives each copy its paint. blocks_m3.py and blocks_m7.py use both.

Colour plan (start, middle, finished):
  butter_churn     cream, lumpy cream, yellow butter
  cheese_press     milky wet cloth over the curd, curd showing through, firm golden cheese;
                   the whey at the spout goes from milky to clear greenish
  aging_rack       pale fresh wheels, golden wheels, dark amber rind
  fermenting_jar   the cloth cover: clean linen, damp cream, soured yellow
  pickling_vat     the drop-lid: fresh pale wood, wet wood, dark brine-soaked wood with a salt crust;
                   brine round the lid from stage 2, salt crystals on the stone at stage 3
  tanning_rack     raw pink hide, tan half-cured hide, brown leather
  meat_grinder     coarse dark red chunks, mince, fine pink mince
  ice_cream_churn  frost on the ice: two bluish patches, four paler ones, white all round the can
  cream_separator  milk in the supply bowl three, two, then one pixel deep; cream in the can from stage 2
  spinning_wheel   the bobbin: loose white wool, cream yarn, tight tan yarn
  weaving_loom     bare warp on the beam, plain rough weave, finished linen with red stripes
  silage_barrel    the forage tufts: fresh green, yellow-green, olive-brown silage

Run blocks_m3.py and blocks_m7.py to rebuild the models; `python station_stages.py [out.png]` draws
docs/art/station_stages_preview.png (each station at stages 1, 2 and 3).
"""
import sys
from pathlib import Path

from blocks_m4 import WOOD, WOOD_LT, wood

ROOT = Path(__file__).resolve().parents[2]
STAGES = (1, 2, 3)


def rnd(f, i, j, salt=0):
    return ((i * 73856093) ^ (j * 19349663) ^ ((sum(map(ord, f)) + salt) * 83492791)) % 100


def speckled(base, spot, p, light=None, lp=0):
    """A base colour with spots (p in 100) and optional highlights (lp in 100)."""
    def fn(f, i, j, w, h, fi):
        r = rnd(f, i, j)
        if r < p:
            return spot
        if light and r > 99 - lp:
            return light
        return base
    return fn


def rimmed(inner, rim):
    """A top face with a darker rim (cloths, lids); the sides are all rim."""
    def fn(f, i, j, w, h, fi):
        if f == "top" and 0 < i < w - 1 and 0 < j < h - 1:
            return inner(f, i, j, w, h, fi) if callable(inner) else inner
        return rim
    return fn


# --- butter churn: cream, lumpy cream, butter -------------------------------------------------

CHURN = (
    speckled((246, 238, 210), (255, 250, 232), 22),
    speckled((242, 228, 182), (236, 208, 120), 34, (255, 246, 214), 12),
    speckled((240, 198, 80), (222, 172, 58), 22, (252, 222, 122), 18),
)

# --- cheese press: the cloth over the curd, and the whey ----------------------------------------

PRESS_CLOTH = (
    rimmed(speckled((240, 240, 232), (250, 250, 246), 20), (218, 220, 212)),
    rimmed(speckled((236, 224, 182), (246, 238, 206), 30), (212, 198, 154)),
    rimmed(speckled((238, 196, 98), (226, 176, 74), 24, (250, 218, 132), 12), (204, 160, 70)),
)
WHEY = (
    speckled((242, 242, 234), (252, 252, 248), 30),
    speckled((226, 230, 186), (240, 242, 210), 30),
    speckled((200, 212, 128), (220, 228, 160), 30),
)

# --- aging rack: the wheels -----------------------------------------------------------------


def wheel(top, top_edge, side, side_edge, spot=None):
    def fn(f, i, j, w, h, fi):
        if f in ("top", "bottom"):
            if i in (0, w - 1) or j in (0, h - 1):
                return top_edge
            return spot if spot and rnd(f, i, j) < 12 else top
        return side_edge if j in (0, h - 1) else side
    return fn


WHEEL = (
    wheel((248, 240, 212), (232, 222, 184), (240, 230, 196), (224, 212, 172)),
    wheel((244, 204, 100), (214, 150, 52), (226, 160, 60), (196, 128, 44)),
    wheel((208, 140, 56), (150, 88, 32), (170, 102, 38), (126, 72, 28), spot=(186, 120, 46)),
)

# --- fermenting jar: the cloth cover (its red string stays red) --------------------------------


def cover(a, b):
    def fn(f, i, j, w, h, fi):
        if f != "top" and j == h - 1:
            return (196, 44, 40)  # red string
        return a if (i + j) % 4 else b
    return fn


JAR_COVER = (
    cover((236, 232, 220), (220, 214, 198)),
    cover((234, 220, 176), (214, 198, 150)),
    cover((222, 192, 120), (198, 166, 96)),
)

# --- pickling vat: the drop-lid soaks up the brine ----------------------------------------------


def salt_crust(fn):
    def out(f, i, j, w, h, fi):
        if f == "top" and (i in (0, w - 1) or j in (0, h - 1)) and (i + j) % 2 == 0:
            return (236, 236, 226)
        if f == "top" and rnd(f, i, j) < 8:
            return (220, 222, 210)
        return fn(f, i, j, w, h, fi)
    return out


DROPLID = (
    wood((218, 184, 136)),
    wood(WOOD),
    salt_crust(wood((80, 66, 42))),
)

# --- tanning rack: raw hide, half-cured, leather ------------------------------------------------


def hide(light, mid, dark, rim, back):
    """A hide stretched flat: mottled with a darker rim and a ragged outline (clear pixels at the
    corners and along the edges, read by alpha_test)."""
    def fn(f, i, j, w, h, fi):
        if f in ("north", "south"):
            ragged = {(0, 0), (1, 0), (0, 1), (w - 1, 0), (w - 2, 0), (w - 1, 1), (0, h - 1), (1, h - 1), (0, h - 2),
                      (w - 1, h - 1), (w - 2, h - 1), (w - 1, h - 2), (4, 0), (0, 5), (w - 1, 3), (6, h - 1)}
            if (i, j) in ragged:
                return None
            if i in (0, w - 1) or j in (0, h - 1) or (i, j) in {(1, 1), (w - 2, 1), (1, h - 2), (w - 2, h - 2)}:
                return rim
            r = (i * 7 + j * 11) % 13
            return light if r < 3 else dark if r > 10 else mid
        return back
    return fn


HIDE = (
    hide((236, 186, 170), (222, 166, 150), (200, 140, 126), (176, 112, 100), (190, 128, 112)),
    hide((214, 172, 128), (200, 154, 110), (184, 136, 92), (150, 104, 66), (160, 114, 74)),
    hide((160, 104, 62), (142, 90, 52), (122, 76, 42), (92, 56, 30), (110, 68, 38)),
)

# --- meat grinder: chunks, mince, fine mince ----------------------------------------------------


def mince(base, light, fat, pf, pl):
    def fn(f, i, j, w, h, fi):
        r = rnd(f, i, j)
        return fat if r < pf else light if r < pf + pl else base
    return fn


MINCE = (
    mince((150, 40, 44), (178, 60, 60), (236, 206, 196), 10, 20),
    mince((196, 92, 92), (222, 124, 118), (240, 208, 200), 12, 28),
    mince((226, 142, 136), (236, 164, 158), (244, 214, 206), 14, 30),
)

# --- ice cream churn: frost on the ice -----------------------------------------------------------

FROST = (
    speckled((176, 212, 234), (140, 186, 216), 35),
    speckled((214, 236, 248), (255, 255, 255), 35),
    speckled((246, 252, 255), (226, 242, 250), 25),
)

# (cream separator, pickling vat brine and salt: see STAGE_PAINT below)

# --- spinning wheel: the bobbin -----------------------------------------------------------------


def wound(a, b, every):
    def fn(f, i, j, w, h, fi):
        return b if (i + j) % every == 0 else a
    return fn


BOBBIN = (
    speckled((248, 246, 240), (224, 220, 212), 30),
    wound((230, 208, 158), (200, 178, 128), 3),
    wound((190, 136, 78), (150, 100, 54), 2),
)

# --- weaving loom: the cloth on the breast beam and the roll ------------------------------------


def bare_warp(f, i, j, w, h, fi):
    """A few threads wound over the bare beam."""
    if f in ("top", "bottom", "north", "south"):
        return (236, 226, 208) if i % 3 == 0 else WOOD_LT
    return WOOD


def rough(f, i, j, w, h, fi):
    return (214, 200, 168) if (i + j) % 2 else (230, 218, 190)


def woven(f, i, j, w, h, fi):
    if f in ("top", "bottom") and i in (1, w - 2):
        return (176, 78, 70)
    return (214, 204, 184) if (i + j) % 2 else (240, 234, 220)


CLOTH = (bare_warp, rough, woven)

# --- silage barrel: the forage tufts ------------------------------------------------------------

TUFT = (
    speckled((104, 164, 56), (136, 192, 80), 35),
    speckled((150, 156, 62), (176, 172, 86), 35),
    speckled((122, 108, 46), (96, 84, 34), 35, (146, 132, 62), 10),
)

def hidden(f, i, j, w, h, fi):
    """A stage copy left clear: the cube is there in every stage (tools/validate.mjs wants the same
    cubes in busy_1..3) but shows only in the stages that paint it."""
    return None


MILK_SKIM = speckled((232, 238, 244), (216, 226, 236), 20)
CREAM_CAP = (hidden, speckled((248, 240, 212), (255, 250, 232), 25), speckled((250, 222, 140), (236, 200, 116), 25))
BRINE = speckled((168, 182, 116), (196, 206, 150), 30)
SALT = speckled((244, 244, 236), (222, 224, 214), 30)

# Content cubes of each station's busy bone and their three paints.
STAGE_PAINT = {
    "butter_churn": {"foam": CHURN},
    "cheese_press": {"cloth": PRESS_CLOTH, "whey": WHEY},
    "aging_rack": {"wheel": WHEEL, "wheel_s": WHEEL},
    "fermenting_jar": {"cover": JAR_COVER},
    # 1.3: brine rises round the drop-lid from half way; salt crystals on the stone at the end
    "pickling_vat": {"droplid": DROPLID, "brine_ring": (hidden, BRINE, BRINE), "salt": (hidden, hidden, SALT)},
    "tanning_rack": {"hide": HIDE},
    "meat_grinder": {"mince": MINCE, "strands": MINCE},
    # 1.3: frost spreads over the ice: two patches, four, then all round the can
    "ice_cream_churn": {"frost_a": FROST, "frost_b": (hidden, FROST[1], FROST[2]), "frost_c": (hidden, hidden, FROST[2])},
    # 1.3: the milk in the supply bowl goes down a pixel a stage; cream gathers in the can
    "cream_separator": {"milk_hi": (MILK_SKIM, hidden, hidden), "milk_mid": (MILK_SKIM, MILK_SKIM, hidden),
                        "milk_lo": (MILK_SKIM, MILK_SKIM, MILK_SKIM), "cream_cap": CREAM_CAP},
    "spinning_wheel": {"bobbin": BOBBIN},
    "weaving_loom": {"cloth": CLOTH, "cloth_roll": CLOTH},
    "silage_barrel": {"tuft": TUFT},
}
STATIONS = list(STAGE_PAINT)


def staged(station, raw):
    """The station's bones with its `busy` contents moved into busy_1..busy_3."""
    contents = STAGE_PAINT[station]
    out, stage_bones = [], []
    for name, parent, pivot, cubes in raw:
        if name != "busy":
            out.append((name, parent, pivot, cubes))
            continue
        moved = [c for c in cubes if c[0] in contents]
        assert moved, f"{station}: nothing in busy to stage"
        out.append((name, parent, pivot, [c for c in cubes if c[0] not in contents]))
        for n in STAGES:
            stage_bones.append((f"busy_{n}", parent, pivot, [(f"{c}_s{n}", o, s) for c, o, s in moved]))
    assert stage_bones, f"{station}: no busy bone"
    return out + stage_bones


def stage_paints(station):
    """Paint functions for the stage copies: {"<cube>_s<n>": fn}."""
    return {f"{cube}_s{n}": paints[n - 1] for cube, paints in STAGE_PAINT[station].items() for n in STAGES}


def preview(out):
    """docs/art/station_stages_preview.png: each station with stages 1, 2 and 3 side by side."""
    from PIL import Image, ImageDraw

    from preview import TILE, render

    label = 18
    sheet = Image.new("RGB", (3 * TILE, len(STATIONS) * (TILE + label)), (232, 238, 226))
    draw = ImageDraw.Draw(sheet)
    for row, station in enumerate(STATIONS):
        for n in STAGES:
            x, y = (n - 1) * TILE, row * (TILE + label)
            draw.text((x + 6, y + 3), f"{station}  stage {n}", fill=(50, 60, 50))
            sheet.paste(render(station, ["busy", f"busy_{n}"]), (x, y + label))
    out.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(out)
    print("station_stages: wrote", out)


if __name__ == "__main__":
    preview(Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "docs" / "art" / "station_stages_preview.png")
