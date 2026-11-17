"""Dishes that can be put down and eaten a portion at a time (data/placedFoods.js rows with
`eat`): the Margherita pizza on its board, the cheese fondue and the big stews in a shared pot,
the claypot rice in its clay pot, and the two gratins in a baking dish.

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


def stew(bid, colours, handles, liquid, liquid_dk, pieces):
    """Four levels of broth; each has the dish's pieces, turned a quarter from the level below."""
    m = Model(bid)
    pot_body(m, colours, handles)
    for n in (1, 2, 3, 4):
        m.bone(f"piece_{n}", "pot", (0, 3 + n, 0))
        m.box(f"piece_{n}", [-4, 3 + n, -4], [8, 1, 8], broth(liquid, liquid_dk, n))
        for k, piece in enumerate(pieces):
            x, z, w, d, colour = turn(piece, n - 1)
            m.box(f"piece_{n}", [x, 3.5 + n, z], [w, 1, d], lump(colour, liquid_dk, k))
    m.save()


POTATO, CARROT, GREENS, CHILI = (228, 202, 132), (228, 132, 52), (88, 150, 70), (204, 52, 40)
DUCK, BAMBOO, GOJI = (172, 118, 76), (236, 224, 176), (206, 56, 44)
BEEF, YAK, RADISH, GOOSE = (98, 48, 32), (84, 44, 34), (238, 232, 214), (208, 150, 84)
MEATBALL, MEATBALL_DK, BOK_CHOY = (134, 72, 46), (96, 50, 34), (112, 170, 84)

# block id -> (pot colours, handles, broth, broth dark, [(x, z, w, d, colour) inside -4..4])
STEWS = {
    "placed_old_duck_soup": (CLAY, "lugs", (214, 186, 120), (188, 156, 92), [
        (-3, -2, 3, 2, DUCK), (0, -2, 1, 1, BAMBOO), (1, 1, 2, 1, BAMBOO), (-2, 2, 2, 1, BAMBOO),
        (2, -3, 1, 1, GOJI), (-1, 0, 1, 1, GOJI), (3, 3, 1, 1, GOJI)]),
    "placed_braised_brisket": (IRON, "ears", (124, 62, 38), (96, 44, 28), [
        (-3, -3, 2, 2, BEEF), (1, -2, 2, 2, BEEF), (-2, 1, 2, 2, BEEF),
        (0, 2, 2, 1, CARROT), (-4, -1, 1, 2, CARROT), (2, 1, 2, 2, POTATO)]),
    "placed_yak_stew": (IRON, "ears", (116, 60, 46), (88, 42, 34), [
        (-3, -3, 3, 2, YAK), (0, 1, 3, 2, YAK), (1, -3, 2, 2, RADISH), (-3, 0, 2, 2, POTATO), (-1, 3, 1, 1, GREENS)]),
    "placed_goose_stew": (IRON, "ears", (164, 104, 56), (132, 78, 40), [
        (-3, -3, 3, 2, GOOSE), (0, 0, 3, 2, GOOSE), (1, -3, 1, 2, CHILI), (-3, 1, 2, 1, CHILI),
        (-2, 2, 2, 2, POTATO), (3, 3, 1, 1, GREENS)]),
}


def meatball(f, x, y, z):
    if f == "top":
        return MEATBALL_DK if rnd(x, 5, z) < 30 else MEATBALL
    return mix(MEATBALL, MEATBALL_DK, 0.5) if rnd(x, y, z) < 40 else MEATBALL


def lion_head_meatballs():
    """Four big meatballs, one to a portion, in a brown broth round a bok choy heart. Each stands
    a pixel and a half over its own level, so the next one down already shows its crown."""
    m = Model("placed_lion_head_meatballs")
    pot_body(m, IRON, "ears")
    liquid, liquid_dk = (212, 164, 96), (184, 134, 72)
    for n, sx, sz in QUARTERS:
        m.bone(f"piece_{n}", "pot", (0, 3 + n, 0))
        m.box(f"piece_{n}", [-4, 3 + n, -4], [8, 1, 8], broth(liquid, liquid_dk, n))
        m.box(f"piece_{n}", [1 if sx > 0 else -4, 2.5 + n, 1 if sz > 0 else -4], [3, 3, 3], meatball)
        m.box(f"piece_{n}", [-1, 3.5 + n, -1], [2, 1, 2], lump(BOK_CHOY, liquid_dk, n))
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


ROAST, ROAST_DK, MEAT_IN = (196, 120, 60), (140, 78, 36), (240, 214, 184)


def roast_turkey():
    """1.1 追加: the roast turkey on a platter, six portions (piece_6 first: the drumsticks go first).
    A stand-in until the art pass."""
    m = Model("placed_roast_turkey")
    plate = vessel(*CERAMIC)
    m.bone("platter")
    m.box("platter", [-6, 0, -5], [12, 1, 10], plate)

    def skin(f, x, y, z):
        if f == "top":
            return ROAST_DK if rnd(x, 7, z) < 18 else ROAST
        if f in ("east", "west") and abs(x) < 1.5:
            return MEAT_IN  # a carved face shows the white meat
        return mix(ROAST, ROAST_DK, 0.3)

    # body in six portions: three across, front and back halves
    cols = [(-4, 3), (-1, 2), (1, 3)]
    n = 0
    for z0, depth in ((0, 3), (-3, 3)):
        for x0, w in cols:
            n += 1
            m.bone(f"piece_{n}", "platter", (0, 1, 0))
            m.box(f"piece_{n}", [x0, 1, z0], [w, 4, depth], skin)
    # the drumsticks on the two front-most portions
    m.box("piece_6", [3, 1, -4], [2, 2, 2], lump(ROAST, ROAST_DK))
    m.box("piece_6", [5, 1, -4], [1, 1, 1], solid((236, 226, 206)), raw=True)
    m.box("piece_4", [-5, 1, -4], [2, 2, 2], lump(ROAST, ROAST_DK, 3))
    m.box("piece_4", [-6, 1, -4], [1, 1, 1], solid((236, 226, 206)), raw=True)
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
