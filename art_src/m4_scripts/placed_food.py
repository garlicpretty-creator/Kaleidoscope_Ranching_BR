"""Dishes that can be put down and eaten a portion at a time (data/placedFoods.js rows with
`eat`): the Margherita pizza on its board, the cheese fondue in its enamel pot, the big stews
each in their own vessel (1.3: sandy clay pot, cast-iron pot, earthenware casserole, iron wok,
porcelain tureen), the claypot rice in its clay pot, and the two gratins in a baking dish.

All follow the cheese wheel's convention: bones piece_1..piece_4, and the block hides one per
portion eaten, piece_4 first (tools/gen_blocks.mjs, packs/BP/scripts/systems/placedFood.js).
The pizza's, the rice's and the gratins' pieces are their four quarters; a pot's are four levels
of food, each with its own pieces of meat and vegetables standing half a pixel out of the broth
(so a lower level's pieces never share a plane with the level above).

Every dish is its own model: tools/validate.mjs refuses two that are the same boxes.

Run with: python art_src/m4_scripts/placed_food.py
(then python art_src/m4_scripts/bbmodel.py with the block ids to refresh the Blockbench files)
"""
import math

from blocks_m3 import solid
from blocks_m4 import WOOD_DK, WOOD_LT, wood
from foodkit import QUARTERS, R5, R6, RIM6, SIDES, Model, is_cut, mix, qbox, rnd

CRUST, CRUST_DK, CRUST_LT, CHAR = (214, 160, 92), (170, 116, 60), (236, 196, 132), (120, 78, 44)
SAUCE, SAUCE_DK = (204, 62, 44), (160, 44, 36)
MOZZ, BASIL, BASIL_DK = (248, 240, 220), (72, 140, 60), (44, 100, 44)
FLAME, FLAME_LT = (236, 128, 40), (252, 214, 96)
CHEESE, CHEESE_DK, CHEESE_LT = (244, 206, 100), (220, 176, 72), (252, 230, 150)
BREAD, BREAD_DK = (232, 196, 132), (176, 124, 68)
STEEL = (176, 178, 186)

# vessel colours: base, dark, light
IRON = ((64, 64, 72), (40, 40, 48), (104, 104, 114))
CLAY = ((150, 92, 62), (112, 64, 42), (186, 126, 90))
ENAMEL = ((172, 56, 44), (120, 36, 32), (214, 96, 76))
CERAMIC = ((236, 232, 224), (196, 190, 182), (250, 248, 244))
STONEWARE = ((104, 118, 134), (72, 84, 100), (146, 160, 174))


def vessel(base, dark, light):
    def mat(f, x, y, z):
        if f == "top":
            return light
        if f == "bottom":
            return dark
        return mix(base, dark, 0.35) if rnd(x, y, z) < 12 else base
    return mat


def lump(colour, shade, salt=0):
    """A piece of food: a lighter fleck or two on top, sides shaded toward what it sits in."""
    def mat(f, x, y, z):
        if f == "top":
            return mix(colour, (255, 248, 230), 0.25) if rnd(x, 0, z, salt) < 22 else colour
        return mix(colour, shade, 0.4)
    return mat


def burner(f, i, j, w, h, fi):
    if f == "top":
        return FLAME_LT if 0 < i < w - 1 and 0 < j < h - 1 else FLAME
    return IRON[1]


# --- pizza ---------------------------------------------------------------------------

PIZZA_CZ = -1  # the board's handle takes the two pixels at the back, so the pie sits forward
# toppings per quarter, in the +x +z quadrant: two layouts, so the pie is not four mirror images
PIZZA_TOPS = [
    [("mozz", (1, 3, 1, 3)), ("mozz", (3, 4, 3, 4)), ("basil", (3, 4, 0, 2))],
    [("mozz", (0, 2, 2, 4)), ("mozz", (3, 4, 1, 2)), ("basil", (2, 4, 0, 1))],
]


def pizza_base(f, x, y, z):
    if f == "top":
        r = rnd(x, 1, z)
        return SAUCE_DK if r < 24 else mix(MOZZ, SAUCE, 0.35) if r > 88 else SAUCE
    if is_cut(f, x, z, PIZZA_CZ):
        return CRUST_LT
    return CRUST_DK


def pizza_rim(f, x, y, z):
    if f == "top":
        r = rnd(x, 2, z)
        return CRUST_LT if r < 20 else CHAR if r > 93 else CRUST
    if is_cut(f, x, z, PIZZA_CZ):
        return CRUST_LT
    return CRUST if f in SIDES else CRUST_DK


def basil(f, x, y, z):
    if f == "top":
        return BASIL_DK if rnd(x, 3, z) < 35 else BASIL
    return BASIL_DK


def pizza():
    m = Model("placed_pizza")
    m.bone("board")
    m.box("board", [-7, 0, -8], [14, 1, 14], wood(WOOD_LT), raw=True)
    m.box("board", [-2, 0, 6], [4, 1, 2], wood(WOOD_LT), raw=True)
    tops = {"mozz": lump(MOZZ, (220, 200, 160)), "basil": basil}
    for n, sx, sz in QUARTERS:
        m.bone(f"piece_{n}", "board", (0, 1, PIZZA_CZ))
        for rect in R6:
            m.box(f"piece_{n}", *qbox(sx, sz, rect, 1, 2, PIZZA_CZ), pizza_base)
        for rect in RIM6:
            m.box(f"piece_{n}", *qbox(sx, sz, rect, 2, 3, PIZZA_CZ), pizza_rim)
        for kind, rect in PIZZA_TOPS[n % 2]:
            m.box(f"piece_{n}", *qbox(sx, sz, rect, 2, 3, PIZZA_CZ), tops[kind])
    m.save()


# --- shared pots ---------------------------------------------------------------------

def pot_body(m, colours, handles):
    """An eight-sided pot on four feet over a burner: inside x, z -4..4, food from y 4 to 8,
    level with the top of the walls, under a rim one pixel higher."""
    mat = vessel(*colours)
    m.bone("pot")
    for x in (-5, 4):
        for z in (-5, 4):
            m.box("pot", [x, 8, z], [1, 1, 1], mat)  # the rim's corners
    for x in (-4, 3):
        for z in (-4, 3):
            m.box("pot", [x, 0, z], [1, 2, 1], solid(colours[1]), raw=True)  # feet under the floor
    m.box("pot", [-2, 0, -2], [4, 1, 4], burner, raw=True)
    m.box("pot", [-4, 2, -5], [8, 2, 10], mat)  # floor
    m.box("pot", [-5, 2, -4], [1, 2, 8], mat)
    m.box("pot", [4, 2, -4], [1, 2, 8], mat)
    for z in (-5, 4):
        m.box("pot", [-4, 4, z], [8, 4, 1], mat)  # walls
    for x in (-5, 4):
        m.box("pot", [x, 4, -4], [1, 4, 8], mat)
    for z in (-6, 4):
        m.box("pot", [-4, 8, z], [8, 1, 2], mat)  # the rim, turned out by a pixel
    for x in (-6, 4):
        m.box("pot", [x, 8, -4], [2, 1, 8], mat)
    # handles sit against the wall (x -5 or 4) and under the turned-out rim
    if handles == "ears":  # an iron ear on either side
        for x in (-7, 5):
            m.box("pot", [x, 6, -1], [2, 2, 2], mat)
    elif handles == "lugs":  # the clay casserole's flat lugs
        for x in (-7, 5):
            m.box("pot", [x, 7, -2], [2, 1, 4], mat)
    else:  # the fondue pot's one wooden handle
        m.box("pot", [5, 6, -1], [3, 1, 2], wood(WOOD_DK), raw=True)


def broth(liquid, liquid_dk, salt):
    def mat(f, x, y, z):
        if f != "top":
            return liquid_dk
        r = rnd(x, salt, z)
        return liquid_dk if r < 12 else mix(liquid, (255, 244, 210), 0.3) if r > 93 else liquid
    return mat


def turn(piece, quarter_turns):
    x, z, w, d, colour = piece
    for _ in range(quarter_turns % 4):
        x, z, w, d = -z - d, x, d, w
    return x, z, w, d, colour


# --- 1.3: the stews each in their own vessel -----------------------------------------------------
# A vessel function builds the pot and returns (half, floor): the food sits in four 1-pixel levels
# from y `floor` (piece_4 the top one) in a square inside of half-width `half`. The deep pots hold
# it from y 4 under a rim at 9 pixels (tools/gen_blocks.mjs `pot`, `lugged`); the wok from y 3
# under a rim at 8 (`wok`). A wall face toward the inside paints as the inside.


def ware(outside, inside, rim, half, band=None):
    """Material for a vessel's walls: `inside` on faces toward the food, `rim` on top, `outside`
    elsewhere; band(y) may give a colour for a stripe round the outside."""
    def mat(f, x, y, z):
        if f == "top":
            return rim(x, y, z) if callable(rim) else rim
        if f == "bottom":
            return mix(outside(x, y, z), (0, 0, 0), 0.3)
        if (f in ("east", "west") and abs(x) <= half + 0.01) or (f in ("north", "south") and abs(z) <= half + 0.01):
            return inside
        if band and band(y):
            return band(y)
        return outside(x, y, z)
    return mat


def walls(m, bone, half, y0, y1, mat):
    """Four walls round the square inside -half..half, from y0 to y1."""
    o = half + 1
    for z in (-o, half):
        m.box(bone, [-o, y0, z], [2 * o, y1 - y0, 1], mat)
    for x in (-o, half):
        m.box(bone, [x, y0, -half], [1, y1 - y0, 2 * half], mat)


def speckle(base, spot, p, salt=0):
    return lambda x, y, z: spot if rnd(x, y, z, salt) < p else base


def loop_handle(f, i, j, w, h, fi, colour):
    """A loop handle seen from the side: the middle of its lower edge is open."""
    if f in ("east", "west") and j == h - 1 and 0 < i < w - 1:
        return None
    return colour


SANDY, SANDY_DK, GLAZE_BLACK = (204, 186, 156), (160, 140, 112), (44, 38, 36)
CAST, CAST_DK, CAST_LT = (52, 52, 58), (34, 34, 40), (92, 92, 102)
EARTH, EARTH_DK, EARTH_LT, EARTH_IN = (122, 62, 34), (84, 40, 24), (170, 98, 60), (214, 188, 138)
WOK, WOK_DK, WOK_LT = (46, 48, 54), (28, 30, 34), (112, 116, 126)
PORCELAIN, PORCELAIN_DK, COBALT, GILT = (244, 242, 236), (214, 212, 206), (54, 84, 160), (214, 178, 88)


DUCK_GLAZE = (62, 46, 38)


def clay_pot(m):
    """砂鍋: a tall sandy clay pot on a narrow foot, dark glaze over its upper half and inside, two
    small ears at the rim."""
    m.bone("pot")
    m.box("pot", [-4, 0, -4], [8, 4, 8], vessel(SANDY_DK, (120, 104, 84), SANDY_DK))
    sandy = speckle(SANDY, mix(SANDY, SANDY_DK, 0.6), 10)

    def outside(x, y, z):
        if y > 6 or (y > 5 and rnd(x, 0, z, 6) < 45):  # the glaze ends in uneven runs
            return mix(DUCK_GLAZE, (120, 96, 80), 0.25) if rnd(x, y, z, 7) < 12 else DUCK_GLAZE
        return sandy(x, y, z)
    walls(m, "pot", 4, 1, 9, ware(outside, GLAZE_BLACK, mix(DUCK_GLAZE, (150, 120, 96), 0.3), 4))
    for x in (-6, 5):
        m.box("pot", [x, 7, -1], [1, 1, 2], solid(DUCK_GLAZE), raw=True)
    return 4, 4


def iron_pot(m):
    """鑄鐵鍋: a tall black cast-iron pot standing on three legs, loop handles at the sides."""
    m.bone("pot")
    m.box("pot", [-5, 2, -5], [10, 2, 10], vessel(*IRON))
    walls(m, "pot", 5, 2, 9, ware(speckle(CAST, mix(CAST, CAST_DK, 0.5), 10), CAST_DK, CAST_LT, 5))
    for x, z in ((-5, -5), (4, -5), (-0.5, 4)):
        m.box("pot", [x, 0, z], [1, 2, 1], solid(CAST_DK), raw=True)
    for x in (-7, 6):
        m.box("pot", [x, 6, -1.5], [1, 2, 3], lambda f, i, j, w, h, fi: loop_handle(f, i, j, w, h, fi, CAST_LT), raw=True)
    return 5, 4


def casserole(m):
    """陶鍋: a wide earthenware casserole, its glazed belly over a rounded bare-clay base, flat lugs
    at the rim, standing on a woven straw trivet."""
    m.bone("pot")
    m.box("pot", [-6, 0, -6], [12, 1, 12], lambda f, i, j, w, h, fi: (196, 160, 88) if (i // 2 + j) % 2 else (168, 128, 64), raw=True)
    m.box("pot", [-5, 1, -5], [10, 3, 10], vessel((168, 110, 72), (130, 82, 52), (168, 110, 72)))
    glaze = lambda x, y, z: EARTH_LT if rnd(x, 0, z, 3) < 10 else EARTH_DK if y < 5 and rnd(x, 1, z) < 50 else EARTH
    walls(m, "pot", 5, 4, 9, ware(glaze, EARTH_IN, EARTH_DK, 5))
    for x in (-7, 6):
        m.box("pot", [x, 8, -2], [1, 1, 4], solid(EARTH, edge=EARTH_DK), raw=True)
    return 5, 4


def wok(m):
    """鐵鍋: a wide, shallow iron wok sitting low: its round bottom steps out 6, 10, 12, then 14 pixels,
    the thick rim has its corners cut, loop handles at the sides; flat corn cakes stuck to the inside
    of the wall, as 鐵鍋燉大鵝 is served."""
    m.bone("pot")
    m.box("pot", [-3, 0, -3], [6, 1, 6], solid(WOK_DK), raw=True)
    m.box("pot", [-5, 1, -5], [10, 1, 10], vessel(WOK, WOK_DK, WOK))
    m.box("pot", [-6, 2, -6], [12, 1, 12], vessel(WOK, WOK_DK, WOK))
    mat = ware(speckle(WOK, mix(WOK, WOK_DK, 0.5), 12), (70, 72, 80), WOK_LT, 5)
    walls(m, "pot", 5, 3, 5, mat)  # the lower wall, a pixel thick
    for z in (-7, 5):  # the flared upper wall, two pixels thick with its corners cut
        m.box("pot", [-6, 5, z], [12, 3, 2], mat)
    for x in (-7, 5):
        m.box("pot", [x, 5, -5], [2, 3, 10], mat)
    for x in (-8, 7):
        m.box("pot", [x, 5, -1.5], [1, 2, 3], lambda f, i, j, w, h, fi: loop_handle(f, i, j, w, h, fi, WOK_LT), raw=True)
    cake = lump((236, 196, 92), (196, 150, 60), 9)
    m.box("pot", [-5, 5, -2], [1, 2, 4], cake)
    m.box("pot", [-2, 5, 4], [4, 2, 1], cake)
    return 5, 3


def tureen(m):
    """A white porcelain soup tureen on a raised foot, a cobalt band round the belly, a gilt lip and
    two scroll handles."""
    m.bone("pot")
    m.box("pot", [-3, 0, -3], [6, 1, 6], solid(PORCELAIN_DK), raw=True)
    m.box("pot", [-4, 1, -4], [8, 3, 8], vessel(PORCELAIN, PORCELAIN_DK, PORCELAIN))
    walls(m, "pot", 4, 4, 9, ware(lambda x, y, z: PORCELAIN, PORCELAIN, GILT, 4,
                                   band=lambda y: COBALT if 5 < y < 7 else None))
    for x in (-6, 5):
        m.box("pot", [x, 6, -1], [1, 2, 2], lambda f, i, j, w, h, fi: COBALT if j == 0 else PORCELAIN, raw=True)
    return 4, 4


def stew(bid, vessel_fn, liquid, liquid_dk, pieces):
    """Four levels of broth in the dish's vessel; each has the dish's pieces, turned a quarter from
    the level below."""
    m = Model(bid)
    half, floor = vessel_fn(m)
    for n in (1, 2, 3, 4):
        y = floor + n - 1
        m.bone(f"piece_{n}", "pot", (0, y, 0))
        m.box(f"piece_{n}", [-half, y, -half], [2 * half, 1, 2 * half], broth(liquid, liquid_dk, n))
        for k, piece in enumerate(pieces):
            x, z, w, d, colour = turn(piece, n - 1)
            m.box(f"piece_{n}", [x, y + 0.5, z], [w, 1, d], colour if callable(colour) else lump(colour, liquid_dk, k))
    m.save()


POTATO, CARROT, GREENS, CHILI = (228, 202, 132), (228, 132, 52), (88, 150, 70), (204, 52, 40)
DUCK, BAMBOO, GOJI = (172, 118, 76), (236, 224, 176), (206, 56, 44)
BEEF, YAK, RADISH, GOOSE = (98, 48, 32), (84, 44, 34), (238, 232, 214), (208, 150, 84)
MEATBALL, MEATBALL_DK = (134, 72, 46), (96, 50, 34)


def skin_on(meat, skin, edge):
    """A piece of poultry: golden skin on top with a darker edge, the meat showing at the sides."""
    def mat(f, x, y, z):
        if f == "top":
            return mix(skin, (255, 236, 190), 0.3) if rnd(x, 0, z, 4) < 20 else skin
        return edge if rnd(x, y, z) < 30 else meat
    return mat


def brisket(f, x, y, z):
    """Braised brisket: dark glossy slices with a pale streak of fat across each."""
    if f == "top":
        return (214, 170, 120) if math.floor(z) % 3 == 0 else mix(BEEF, (255, 220, 170), 0.18) if rnd(x, 1, z) < 15 else BEEF
    return mix(BEEF, (40, 18, 10), 0.3)


# block id -> (vessel, broth, broth dark, [(x, z, w, d, colour or material) inside -half..half])
STEWS = {
    # 老鴨湯 in a sandy clay pot: a skin-on duck leg with its bone end, bamboo shoots and goji
    "placed_old_duck_soup": (clay_pot, (214, 186, 120), (188, 156, 92), [
        (-3, -3, 3, 3, skin_on((214, 170, 130), DUCK, (150, 98, 60))), (0, -2, 1, 1, (240, 232, 214)),
        (1, -3, 2, 1, BAMBOO), (-2, 1, 1, 2, BAMBOO), (2, 2, 1, 1, GOJI)]),
    # braised brisket in a cast-iron pot: slabs of brisket, carrot and potato
    "placed_braised_brisket": (iron_pot, (124, 62, 38), (96, 44, 28), [
        (-4, -4, 3, 3, brisket), (0, -3, 3, 3, brisket), (-3, 1, 3, 2, brisket),
        (2, 1, 2, 2, CARROT), (-1, 3, 2, 1, POTATO)]),
    # yak stew in an earthenware casserole: chunks of yak, white radish, potato, greens
    "placed_yak_stew": (casserole, (116, 60, 46), (88, 42, 34), [
        (-4, -4, 3, 3, YAK), (1, 0, 3, 3, YAK), (1, -4, 2, 2, RADISH), (-4, 0, 2, 2, POTATO), (-1, 3, 1, 1, GREENS)]),
    # 鐵鍋燉大鵝 in an iron wok: big pieces of goose with their skin, potato, a scatter of greens
    "placed_goose_stew": (wok, (164, 104, 56), (132, 78, 40), [
        (-4, -4, 3, 3, skin_on((220, 176, 130), GOOSE, (160, 104, 56))), (1, 0, 3, 3, skin_on((220, 176, 130), GOOSE, (160, 104, 56))),
        (1, -4, 2, 2, POTATO), (-4, 1, 2, 2, POTATO), (-1, 3, 2, 1, GREENS)]),
}


def meatball(f, x, y, z):
    """A big braised meatball: shaded darker toward its edges so the 4 x 3 x 4 lump reads round."""
    lx, lz = x - math.floor(x / 4) * 4, z - math.floor(z / 4) * 4  # 0..4 across the ball
    edge = (lx < 1 or lx > 3) + (lz < 1 or lz > 3)
    if f == "top":
        if edge == 2:
            return MEATBALL_DK
        if edge == 0:
            return mix(MEATBALL, (236, 190, 140), 0.3) if rnd(x, 5, z) < 35 else MEATBALL
        return mix(MEATBALL, MEATBALL_DK, 0.4)
    if f == "bottom":
        return MEATBALL_DK
    across = lz if f in ("east", "west") else lx
    if across < 1 or across > 3:
        return MEATBALL_DK
    return mix(MEATBALL, MEATBALL_DK, 0.5) if rnd(x, y, z) < 30 else MEATBALL


def lion_head_meatballs():
    """Four big round meatballs, one to a portion, in a brown broth, served in a porcelain tureen.
    Each fills a quarter of the tureen and stands a pixel over its own level, so the next one down
    already shows its crown; piece_4's top is the tureen's rim at 9 pixels."""
    m = Model("placed_lion_head_meatballs")
    tureen(m)
    liquid, liquid_dk = (212, 164, 96), (184, 134, 72)
    for n, sx, sz in QUARTERS:
        m.bone(f"piece_{n}", "pot", (0, 3 + n, 0))
        m.box(f"piece_{n}", [-4, 3 + n, -4], [8, 1, 8], broth(liquid, liquid_dk, n))
        m.box(f"piece_{n}", [0 if sx > 0 else -4, 2 + n, 0 if sz > 0 else -4], [4, 3, 4], meatball)
    m.save()


def fondue():
    """Molten cheese in an enamel pot, two long forks laid over the rim with bread on their tines."""
    m = Model("placed_fondue")
    pot_body(m, ENAMEL, "handle")
    m.box("pot", [-1, 9, -5], [1, 1, 8], solid(STEEL), raw=True)   # fork across the pot
    m.box("pot", [-1, 9, -8], [1, 1, 3], wood(WOOD_DK), raw=True)
    m.box("pot", [-1.5, 8.5, 1.5], [2, 2, 2], lump(BREAD, BREAD_DK))
    m.box("pot", [-2, 10, -3], [7, 1, 1], solid(STEEL), raw=True)  # a second resting on it
    m.box("pot", [5, 10, -3], [3, 1, 1], wood(WOOD_DK), raw=True)
    m.box("pot", [-3.5, 9.5, -3.5], [2, 2, 2], lump(BREAD, BREAD_DK, 1))

    def cheese(f, x, y, z):
        if f != "top":
            return CHEESE_DK
        r = rnd(x, y, z)
        return CHEESE_LT if r < 18 else CHEESE_DK if r > 82 else CHEESE
    for n in (1, 2, 3, 4):
        m.bone(f"piece_{n}", "pot", (0, 3 + n, 0))
        m.box(f"piece_{n}", [-4, 3 + n, -4], [8, 1, 8], cheese)
    m.save()


# --- claypot rice --------------------------------------------------------------------

RICE, RICE_DK, SCORCH = (242, 234, 212), (222, 210, 182), (212, 164, 96)
SAUSAGE, CURED, EGG_WHITE, YOLK = (176, 52, 46), (120, 40, 36), (250, 248, 240), (246, 178, 44)
# toppings per portion in the +x +z quadrant: (x0, x1, z0, z1), colour, y of the underside
RICE_TOPS = {
    1: [((1, 4, 1, 4), EGG_WHITE, 3.5), ((2, 3, 2, 3), YOLK, 4)],
    2: [((1, 3, 1, 2), SAUSAGE, 4), ((2, 4, 3, 4), SAUSAGE, 4), ((0, 1, 3, 5), SAUSAGE, 4)],
    3: [((1, 2, 1, 4), GREENS, 4), ((3, 4, 0, 3), GREENS, 4), ((2, 3, 2, 4), CURED, 4)],
    4: [((1, 3, 2, 3), SAUSAGE, 4), ((3, 4, 0, 2), CURED, 4), ((0, 1, 0, 3), GREENS, 4)],
}


def rice(f, x, y, z):
    if is_cut(f, x, z):
        return SCORCH if y < 2 else RICE_DK if rnd(x, y, z) < 25 else RICE
    if f == "top":
        if max(abs(x), abs(z)) > 4:  # the scorched crust against the hot clay
            return SCORCH
        r = rnd(x, 7, z)
        return RICE_DK if r < 18 else (176, 128, 80) if r > 91 else RICE  # grains, and a drizzle of soy
    return SCORCH


def claypot_rice():
    """A wide, shallow clay pot, the rice in four quarters under sausage, greens and an egg."""
    m = Model("placed_claypot_rice")
    mat = vessel(*CLAY)
    m.bone("pot")
    m.box("pot", [-5, 0, -6], [10, 1, 12], mat)  # floor, corners cut
    for x in (-6, 5):
        m.box("pot", [x, 0, -5], [1, 1, 10], mat)
        m.box("pot", [x, 1, -5], [1, 4, 10], mat)
    for z in (-6, 5):
        m.box("pot", [-5, 1, z], [10, 4, 1], mat)
    for x in (-7, 6):
        m.box("pot", [x, 3, -2], [1, 1, 4], mat)
    for n, sx, sz in QUARTERS:
        m.bone(f"piece_{n}", "pot", (0, 1, 0))
        m.box(f"piece_{n}", *qbox(sx, sz, (0, 5, 0, 5), 1, 4), rice)
        for k, (rect, colour, y) in enumerate(RICE_TOPS[n]):
            m.box(f"piece_{n}", *qbox(sx, sz, rect, y, y + 1), lump(colour, RICE_DK, k))
    m.save()


# --- gratins -------------------------------------------------------------------------

TRUFFLE = (58, 44, 40)
# block id -> (dish colours, crust, crust dark, inside, fleck,
#              raised crust per quarter [(x0, x1, z0, z1)] for even and odd pieces, truffle slices, drips)
GRATINS = {
    "placed_cheese_gratin": (CERAMIC, (236, 178, 84), (196, 124, 52), (250, 232, 170), (150, 86, 40),
                             ([(1, 3, 1, 2), (3, 5, 2, 3)], [(2, 4, 0, 1), (0, 2, 2, 3)]), [], True),
    "placed_truffle_gratin": (STONEWARE, (228, 170, 88), (184, 118, 54), (248, 228, 176), (58, 44, 40),
                              ([(0, 2, 1, 2)], [(3, 5, 0, 1)]), [(3, 4, 1, 2), (1, 2, 2, 3)], False),
}


def gratin(bid):
    colours, crust, crust_dk, inside, fleck, bumps, truffles, drips = GRATINS[bid]
    m = Model(bid)
    mat = vessel(*colours)
    m.bone("dish")
    m.box("dish", [-6, 0, -4], [12, 1, 8], mat)
    for z in (-4, 3):
        m.box("dish", [-6, 1, z], [12, 3, 1], mat)
    for x in (-6, 5):
        m.box("dish", [x, 1, -3], [1, 3, 6], mat)
    for x in (-7, 6):
        m.box("dish", [x, 3, -2], [1, 1, 4], mat)
    if drips:  # cheese that bubbled over the side
        m.box("dish", [2, 3, -5], [1, 1, 1], lump(crust, crust_dk))
        m.box("dish", [-4, 3, 4], [1, 1, 1], lump(crust, crust_dk))

    def filling(f, x, y, z):
        if f == "top":
            r = rnd(x, 9, z)
            return fleck if r > 93 else crust_dk if r < 28 else crust
        if is_cut(f, x, z):  # under the crust: cream sauce between slices of potato
            if y > 2:
                return crust
            along = abs(z) if f in ("east", "west") else abs(x)
            return inside if math.floor(along) % 2 else mix(inside, (226, 196, 120), 0.5)
        return crust_dk

    def blister(f, x, y, z):
        return crust_dk if f == "top" and rnd(x, 4, z) < 55 else mix(crust, crust_dk, 0.5)

    def truffle(f, x, y, z):
        return mix(TRUFFLE, (150, 130, 118), 0.5) if f == "top" and rnd(x, 6, z) < 40 else TRUFFLE

    for n, sx, sz in QUARTERS:
        m.bone(f"piece_{n}", "dish", (0, 1, 0))
        m.box(f"piece_{n}", *qbox(sx, sz, (0, 5, 0, 3), 1, 3), filling)
        for rect in bumps[n % 2]:
            m.box(f"piece_{n}", *qbox(sx, sz, rect, 3, 4), blister)
        for rect in truffles:
            m.box(f"piece_{n}", *qbox(sx, sz, rect, 3, 4), truffle)
    m.save()


ROAST, ROAST_DK, ROAST_LT, MEAT_IN = (196, 120, 60), (140, 78, 36), (226, 162, 88), (240, 214, 184)
CARVED, CARVED_FIBRE = (214, 170, 118), (190, 140, 88)  # roast turkey meat, cooked through
BONE_END = (240, 232, 214)
HERB, HERB_DK, CARROT = (92, 150, 62), (60, 108, 44), (230, 128, 44)
TURKEY_CZ = 1  # the body's front and back halves meet at z = 1; the drumsticks lie in front of it


def roast_turkey():
    """1.1 追加: the whole roast turkey on a platter, breast up with the drumsticks toward the front,
    a sprig of herbs and roast carrots beside it. Six portions, piece_6 first: the two drumsticks,
    then the body a quarter at a time, front quarters before back ones. Wherever a portion was cut
    away the faces left behind show the white meat (the body's quarters meet on x = 0 and
    z = TURKEY_CZ). The top is 5 pixels, the block's selection box (tools/gen_blocks.mjs `roast`)."""
    m = Model("placed_roast_turkey")
    plate = vessel(*CERAMIC)
    m.bone("platter")
    m.box("platter", [-6, 0, -5], [12, 1, 10], plate)
    m.box("platter", [-6, 1, 3], [2, 1, 2], lump(HERB, HERB_DK, 5))
    m.box("platter", [4, 1, 3], [2, 1, 1], lump(CARROT, (176, 84, 28), 6))
    m.box("platter", [-6, 1, -2], [1, 1, 2], lump(CARROT, (176, 84, 28), 7))

    def skin(f, x, y, z):
        if is_cut(f, x, z, TURKEY_CZ):
            # carved: cooked meat with fibres, and a rim of skin a pixel deep round the cut
            across = f in ("east", "west")  # on the x = 0 cut, the section runs along z
            along = abs(z - TURKEY_CZ) if across else abs(x)
            body, breast = (3, 2) if across else (4, 3)  # how far each part reaches from the cut line
            if y > 4 or along > body - 1 or (y > 3 and along > breast - 1):
                return ROAST_DK
            return CARVED_FIBRE if rnd(x, y, z, 2) < 25 else CARVED
        if f == "top":
            r = rnd(x, 7, z)
            return ROAST_LT if r > 84 else ROAST_DK if r < 16 else ROAST  # glaze catching the light
        if f == "bottom":
            return ROAST_DK
        if f in ("east", "west") and 1.5 < y < 3 and 0 < z - TURKEY_CZ + 1 < 3:
            return mix(ROAST, ROAST_DK, 0.7)  # the folded wing's outline along each flank
        return ROAST if y > 2 else mix(ROAST, ROAST_DK, 0.45)  # darker where it sat in the juices

    # body: a broad lower part and the breast on top, in four quarters (wings tucked under, painted rather than built, so it stays a bird and not a turtle)
    for n, sx, sz in ((1, -1, 1), (2, 1, 1), (3, -1, -1), (4, 1, -1)):
        m.bone(f"piece_{n}", "platter", (0, 1, 0))
        m.box(f"piece_{n}", *qbox(sx, sz, (0, 4, 0, 3), 1, 4, TURKEY_CZ), skin)
        m.box(f"piece_{n}", *qbox(sx, sz, (0, 3, 0, 2), 4, 5, TURKEY_CZ), skin)
    # the drumsticks: a thick leg against the body's front, the bone end raised toward the front
    for n, x in ((5, -3), (6, 1)):
        m.bone(f"piece_{n}", "platter", (0, 1, 0))
        m.box(f"piece_{n}", [x, 1, -4], [2, 2, 2], lump(ROAST, ROAST_DK, n))
        m.box(f"piece_{n}", [x + 0.5, 2, -5], [1, 1, 1], solid(BONE_END), raw=True)
    m.save()


def main():
    roast_turkey()
    pizza()
    fondue()
    for bid, row in STEWS.items():
        stew(bid, *row)
    lion_head_meatballs()
    claypot_rice()
    for bid in GRATINS:
        gratin(bid)


if __name__ == "__main__":
    main()
