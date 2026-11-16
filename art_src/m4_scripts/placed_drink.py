"""Drinks that can be put down and drunk in place (data/placedFoods.js rows with one portion):
the two milk wines in horn cups, the cream cocoa in a glass mug, the yogurt berry drink in a
milk bottle with a straw, yogurt in its crock with a spoon, milk tea in a lacquered wooden bowl
and milk-skin tea in a porcelain bowl on its saucer.

Each is a container bone and a piece_1 bone with the drink, whose top shows inside the rim
(tools/validate.mjs wants piece_1 for every placed food). The drink is drunk in one go, so the
block never hides piece_1 (tools/gen_blocks.mjs, packs/BP/scripts/systems/placedFood.js).

The blocks render alpha-tested, so glass cannot be see-through: the glass walls are painted pale
and cool above the drink and tinted with the drink below its level, with a highlight streak.
Every drink is its own model: tools/validate.mjs refuses two that are the same boxes.

Run with: python art_src/m4_scripts/placed_drink.py
"""
import math

from foodkit import Model, mix, rnd

GLASS, GLASS_LT, GLASS_DK = (206, 226, 232), (246, 252, 252), (168, 190, 198)
SILVER, SILVER_DK = (196, 200, 210), (150, 154, 166)


def ring(m, bone, x0, x1, z0, z1, y0, y1, mat, t=1):
    """Four walls, t thick, round the box x0..x1, z0..z1 from y0 to y1 (north and south whole)."""
    m.box(bone, [x0, y0, z0], [x1 - x0, y1 - y0, t], mat)
    m.box(bone, [x0, y0, z1 - t], [x1 - x0, y1 - y0, t], mat)
    m.box(bone, [x0, y0, z0 + t], [t, y1 - y0, z1 - z0 - 2 * t], mat)
    m.box(bone, [x1 - t, y0, z0 + t], [t, y1 - y0, z1 - z0 - 2 * t], mat)


def glass(liquid, level, streak=-2):
    """Glass walls: tinted by the drink below `level`, pale above, a light streak down one column."""
    def mat(f, x, y, z):
        if f == "top":
            return mix(GLASS, GLASS_DK, 0.4)  # the rim's edge, darker than what it holds
        if f == "bottom":
            return GLASS_DK
        along = x if f in ("north", "south") else z
        if math.floor(along) == streak and y > 1:
            return GLASS_LT
        if y < level:
            return mix(liquid, GLASS, 0.3)
        return GLASS
    return mat


def surface(colour, fleck, salt=0, rate=16):
    """A drink's top: flecks of foam or spice; its sides shade darker (mostly hidden in the cup)."""
    def mat(f, x, y, z):
        if f == "top":
            return fleck if rnd(x, salt, z) < rate else colour
        return mix(colour, (40, 24, 16), 0.2)
    return mat


def horn(base, dark, light, band=None, band_at=()):
    """Horn: streaks running up the cup, a lighter polished rim; optional metal bands at rows."""
    def mat(f, x, y, z):
        if band and math.floor(y) in band_at:
            return band[0] if f != "bottom" else band[1]
        if f == "top":
            return light
        if f == "bottom":
            return dark
        along = x if f in ("north", "south") else z
        r = rnd(along, 0, 0, 3)
        return dark if r < 25 else mix(base, light, 0.4) if r > 80 else base
    return mat


def ceramic(base, shade, band=None, band_at=()):
    def mat(f, x, y, z):
        if band and math.floor(y) in band_at and f not in ("top", "bottom"):
            return band
        if f == "bottom":
            return shade
        return mix(base, shade, 0.5) if f in ("east", "west") and rnd(x, y, z) < 10 else base
    return mat


def plain(colour, shade=None):
    def mat(f, x, y, z):
        return colour if f == "top" or shade is None else shade
    return mat


# --- milk wines: two horn cups ---------------------------------------------------------

def milk_wine():
    """A footed horn goblet, pale ivory wine just under its polished rim."""
    m = Model("placed_milk_wine")
    h = horn((200, 160, 104), (156, 116, 70), (232, 204, 156))
    m.bone("cup")
    m.box("cup", [-2, 0, -2], [4, 1, 4], h)  # foot
    m.box("cup", [-1, 1, -1], [2, 2, 2], h)  # stem
    m.box("cup", [-3, 3, -3], [6, 1, 6], h)  # bowl floor
    ring(m, "cup", -3, 3, -3, 3, 4, 9, h)
    m.bone("piece_1", "cup")
    m.box("piece_1", [-2, 4, -2], [4, 4, 4], surface((240, 234, 212), (252, 250, 240), 1))
    m.save()


def yak_milk_wine():
    """A tall, dark horn beaker bound with two silver bands, without a stem; a richer, creamier wine."""
    m = Model("placed_yak_milk_wine")
    h = horn((112, 80, 56), (78, 54, 38), (150, 112, 80), band=(SILVER, SILVER_DK), band_at=(1, 9))
    m.bone("cup")
    m.box("cup", [-2, 0, -2], [4, 4, 4], h)  # the narrow tip of the horn
    m.box("cup", [-3, 4, -3], [6, 1, 6], h)
    ring(m, "cup", -3, 3, -3, 3, 5, 11, h)
    m.bone("piece_1", "cup")
    m.box("piece_1", [-2, 5, -2], [4, 5, 4], surface((230, 204, 152), (246, 230, 190), 2, 22))
    m.save()


# --- cream cocoa: a glass mug ------------------------------------------------------------

COCOA, CREAM, DUST = (104, 60, 38), (250, 246, 236), (120, 74, 46)


def cream_cocoa():
    """A glass mug with a handle: dark cocoa to near the rim under a dome of cream, dusted with cocoa."""
    m = Model("placed_cream_cocoa")
    g = glass(COCOA, 7)
    m.bone("cup")
    m.box("cup", [-3, 0, -3], [6, 1, 6], g)
    ring(m, "cup", -3, 3, -3, 3, 1, 8, g)
    m.box("cup", [3, 2, -0.5], [2, 1, 1], g)  # the handle
    m.box("cup", [4, 3, -0.5], [1, 3, 1], g)
    m.box("cup", [3, 6, -0.5], [2, 1, 1], g)
    m.bone("piece_1", "cup")
    m.box("piece_1", [-2, 1, -2], [4, 6, 4], plain(COCOA))
    m.box("piece_1", [-2, 7, -2], [4, 1, 4], surface(CREAM, DUST, 3, 14))
    m.box("piece_1", [-1, 8, -1], [2, 1, 2], surface(CREAM, DUST, 4, 30))  # the cream heaped over the rim
    m.save()


# --- yogurt berry drink: a milk bottle with a straw ---------------------------------------

BERRY_PINK, BERRY = (226, 120, 150), (176, 30, 52)


def yogurt_berry_drink():
    """A squat milk bottle of pink berry yogurt drink, a striped paper straw in its open neck."""
    m = Model("placed_yogurt_berry_drink")
    g = glass(BERRY_PINK, 9)
    m.bone("cup")
    m.box("cup", [-3, 0, -3], [6, 8, 6], g)  # the full body
    m.box("cup", [-2, 8, -2], [4, 1, 4], g)  # shoulder
    ring(m, "cup", -2, 2, -2, 2, 9, 11, glass(BERRY_PINK, 10))

    def straw(f, x, y, z):
        return (250, 248, 244) if math.floor(y) % 2 else (204, 52, 60)
    m.bone("piece_1", "cup")
    m.box("piece_1", [-1, 9, -1], [2, 1, 2], surface(BERRY_PINK, BERRY, 5, 30))
    m.box("piece_1", [0, 10, -1], [1, 4, 1], straw)
    m.save()


# --- yogurt: a crock with a spoon --------------------------------------------------------

def yogurt():
    """A low crock in a grey-blue glaze with a dark band, thick white yogurt to just under the rim,
    a wooden spoon in it."""
    m = Model("placed_yogurt")
    c = ceramic((132, 156, 182), (98, 118, 142), band=(64, 82, 120), band_at=(3,))
    m.bone("cup")
    m.box("cup", [-3, 0, -3], [6, 1, 6], c)
    ring(m, "cup", -3, 3, -3, 3, 1, 5, c)
    m.bone("piece_1", "cup")
    m.box("piece_1", [-2, 1, -2], [4, 3, 4], surface((250, 248, 240), (232, 228, 214), 6, 20))
    m.box("piece_1", [-2, 4, -2], [2, 1, 2], surface((252, 250, 244), (236, 232, 220), 7, 10))  # a dollop
    m.box("piece_1", [1, 4, 0], [1, 4, 1], plain((196, 150, 96), (170, 124, 76)))  # the spoon
    m.save()


# --- milk teas: two tea bowls ------------------------------------------------------------

TEA, TEA_DK = (200, 158, 108), (176, 132, 86)


def milk_tea():
    """A wide wooden tea bowl lacquered red-brown, lined with a silver rim, full of milk tea."""
    m = Model("placed_milk_tea")
    wood = horn((140, 64, 44), (98, 42, 30), (168, 88, 62), band=(SILVER, SILVER_DK), band_at=(4,))
    m.bone("cup")
    m.box("cup", [-2, 0, -2], [4, 1, 4], wood)  # foot
    m.box("cup", [-3, 1, -3], [6, 1, 6], wood)
    ring(m, "cup", -4, 4, -4, 4, 2, 5, wood)
    m.bone("piece_1", "cup")
    m.box("piece_1", [-3, 2, -3], [6, 2, 6], surface(TEA, mix(TEA, (250, 240, 220), 0.4), 8, 12))
    m.save()


def milk_skin_tea():
    """A blue-and-white porcelain bowl on a saucer, milk tea under a crinkled sheet of milk skin."""
    m = Model("placed_milk_skin_tea")
    blue = (70, 96, 160)
    porcelain = ceramic((244, 244, 238), (206, 206, 200), band=blue, band_at=(5,))
    m.bone("cup")
    m.box("cup", [-4, 0, -4], [8, 1, 8], ceramic((244, 244, 238), (206, 206, 200)))  # saucer
    m.box("cup", [-2, 1, -2], [4, 1, 4], porcelain)  # foot
    m.box("cup", [-3, 2, -3], [6, 1, 6], porcelain)
    ring(m, "cup", -3, 3, -3, 3, 3, 7, porcelain)

    def skin(f, x, y, z):
        if f != "top":
            return (226, 200, 140)
        r = rnd(x, 9, z)
        return (222, 192, 122) if r < 30 else (252, 240, 196) if r > 85 else (244, 226, 170)
    m.bone("piece_1", "cup")
    m.box("piece_1", [-2, 3, -2], [4, 2, 4], surface(TEA, TEA_DK, 9, 10))
    m.box("piece_1", [-2, 5, -2], [3, 1, 3], skin)  # the milk skin, folded over at one corner
    m.box("piece_1", [-1, 5, 1], [2, 1, 1], skin)
    m.save()


def main():
    milk_wine()
    yak_milk_wine()
    cream_cocoa()
    yogurt_berry_drink()
    yogurt()
    milk_tea()
    milk_skin_tea()


if __name__ == "__main__":
    main()
