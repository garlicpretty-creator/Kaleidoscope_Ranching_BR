"""16x16 item icons drawn from a few templates.

Each item id maps to a template plus colours. Quality tiers get a small star:
silver for fine, gold for superb. Fertilized eggs get a small pink heart.
"""

from __future__ import annotations

from PIL import Image

OUTLINE = (40, 30, 28, 255)


class Canvas:
    def __init__(self):
        self.image = Image.new("RGBA", (16, 16), (0, 0, 0, 0))

    def put(self, x, y, color):
        if 0 <= x < 16 and 0 <= y < 16:
            self.image.putpixel((x, y), tuple(color[:3]) + (color[3] if len(color) == 4 else 255,))

    def get(self, x, y):
        return self.image.getpixel((x, y))

    def fill(self, mask, color, shade=True):
        """Fills mask cells; darkens the bottom-right edge and lightens the top-left for volume."""
        for (x, y) in mask:
            c = color
            if shade:
                if (x + 1, y) not in mask or (x, y + 1) not in mask:
                    c = darken(color, 0.78)
                elif (x - 1, y) not in mask or (x, y - 1) not in mask:
                    c = lighten(color, 1.12)
            self.put(x, y, c)

    def outline(self):
        """Adds a dark outline around every opaque area."""
        filled = {(x, y) for x in range(16) for y in range(16) if self.get(x, y)[3] > 0}
        for (x, y) in filled:
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                n = (x + dx, y + dy)
                if 0 <= n[0] < 16 and 0 <= n[1] < 16 and n not in filled:
                    self.put(*n, OUTLINE)


def darken(color, f):
    return tuple(max(0, min(255, round(c * f))) for c in color[:3])


def lighten(color, f):
    return tuple(max(0, min(255, round(c * f))) for c in color[:3])


def ellipse(cx, cy, rx, ry):
    return {(x, y) for x in range(16) for y in range(16) if ((x + .5 - cx) / rx) ** 2 + ((y + .5 - cy) / ry) ** 2 <= 1}


def rect(x0, y0, x1, y1):
    return {(x, y) for x in range(x0, x1 + 1) for y in range(y0, y1 + 1)}


# --- Templates ----------------------------------------------------------------

def bottle(c, liquid, cork=(150, 110, 70)):
    glass = (210, 230, 236)
    c.fill(rect(6, 2, 9, 3), cork, shade=False)
    c.fill(rect(6, 4, 9, 5), glass)
    body = ellipse(8, 10.5, 4.6, 4.6)
    c.fill(body, glass)
    c.fill({p for p in body if p[1] >= 8}, liquid)
    c.put(5, 8, (255, 255, 255))


def jar(c, content, lid=(140, 100, 60)):
    c.fill(rect(4, 3, 11, 4), lid, shade=False)
    c.fill(rect(4, 5, 11, 13), (214, 230, 234))
    c.fill(rect(5, 7, 10, 12), content)


def egg(c, color, speckle=None):
    shape = ellipse(8, 9, 4.2, 5.4)
    c.fill(shape, color)
    if speckle:
        for (x, y) in shape:
            if (x * 7 + y * 13) % 9 == 0:
                c.put(x, y, speckle)
    c.put(6, 6, lighten(color, 1.2))


def carcass(c, color, fat, big):
    c.fill(rect(7, 0, 8, 2), (120, 120, 126), shade=False)  # hook
    shape = ellipse(8, 9, 5.5 if big else 4, 6.5 if big else 5)
    c.fill(shape, color)
    for (x, y) in shape:
        if y % 3 == 0 and abs(x - 8) <= (3 if big else 2):
            c.put(x, y, fat)  # ribs


def meat(c, color, fat=(240, 220, 210), bone=False):
    shape = ellipse(8, 8.5, 5.5, 4.5)
    c.fill(shape, color)
    for (x, y) in shape:
        if (x - y) % 5 == 0:
            c.put(x, y, fat)
    if bone:
        c.fill(rect(12, 6, 14, 8), (236, 230, 214))


def drumstick(c, color):
    c.fill(ellipse(7, 7, 4.5, 4.5), color)
    c.fill({(x, y) for x in range(9, 14) for y in range(9, 14) if abs((x - 9) - (y - 9)) <= 1}, (236, 230, 214))
    c.fill(rect(12, 12, 14, 14), (236, 230, 214))


def bone(c, color=(236, 230, 214)):
    c.fill({(x, y) for x in range(3, 13) for y in range(3, 13) if abs(x - y) <= 1}, color)
    for cx, cy in ((3, 3), (12, 12)):
        c.fill(ellipse(cx + .5, cy + .5, 1.8, 1.8), color)


def sheet(c, color, spots=None):
    shape = {(x, y) for x in range(3, 14) for y in range(4, 13) if not ((x in (3, 13)) and (y in (4, 12)))}
    c.fill(shape, color)
    if spots:
        for (x, y) in shape:
            if (x * 3 + y * 5) % 7 == 0:
                c.put(x, y, spots)


def blob(c, color, rx=5, ry=4):
    c.fill(ellipse(8, 9, rx, ry), color)


def block(c, color, top=None):
    c.fill(rect(3, 6, 12, 12), color)
    c.fill(rect(3, 4, 12, 5), top or lighten(color, 1.15), shade=False)


def wheel(c, color, rind):
    c.fill(ellipse(8, 8.5, 6, 5), rind)
    c.fill(ellipse(8, 8.5, 4.6, 3.6), color)


def wedge(c, color):
    c.fill({(x, y) for x in range(3, 14) for y in range(5, 13) if y >= 13 - (x - 2)}, color)
    c.put(8, 10, darken(color, 0.8))
    c.put(10, 11, darken(color, 0.8))


def horn(c, color):
    pts = [(3, 12), (4, 11), (5, 10), (6, 9), (7, 8), (8, 7), (9, 6), (10, 5), (11, 4), (12, 4), (13, 5)]
    for i, (x, y) in enumerate(pts):
        w = 2 if i < 6 else 1
        for dx in range(w):
            for dy in range(w):
                c.put(x + dx, y + dy, color if i % 3 else darken(color, 0.85))


def fluff(c, color):
    for cx, cy in ((6, 9), (10, 8), (8, 6), (9, 11)):
        c.fill(ellipse(cx, cy, 3, 2.6), color)


def pile(c, color):
    c.fill({(x, y) for x in range(2, 14) for y in range(6, 14) if y >= 13 - min(x - 2, 13 - x) * 1.4}, color)


def sack(c, color, tie=(150, 110, 70)):
    c.fill(ellipse(8, 10, 5.5, 4.5), color)
    c.fill(rect(6, 3, 9, 5), color)
    c.fill(rect(6, 5, 9, 5), tie, shade=False)


def bundle(c, color):
    for x in range(4, 13):
        for y in range(2, 15):
            if (x + y) % 2 == 0 or y in (7, 8):
                c.put(x, y, color if y not in (7, 8) else (150, 110, 70))


def sprig(c, leaf, flower):
    for y in range(4, 15):
        c.put(8, y, (70, 120, 50))
    for (x, y) in ((6, 9), (7, 10), (10, 8), (9, 9), (6, 12), (7, 12)):
        c.put(x, y, leaf)
    c.fill(ellipse(8, 3.5, 2.2, 2.2), flower)


def seeds(c, color):
    for (x, y) in ((5, 6), (9, 5), (7, 9), (11, 9), (5, 11), (9, 12), (12, 6)):
        c.put(x, y, color)
        c.put(x + 1, y, darken(color, 0.8))


def cookie(c, color, chip):
    shape = ellipse(8, 8.5, 5.5, 5)
    c.fill(shape, color)
    for (x, y) in ((6, 7), (10, 8), (8, 11), (7, 10)):
        c.put(x, y, chip)


def pail(c):
    metal = (176, 182, 190)
    c.fill({(x, y) for x in range(3, 14) for y in range(6, 14) if 3 + (y - 6) // 3 <= x <= 12 - (y - 6) // 3}, metal)
    for x in range(4, 12):
        c.put(x, int(3 + abs(x - 7.5) // 2), (90, 90, 96))
    c.fill(rect(4, 6, 11, 6), (236, 236, 228), shade=False)  # milk line


def brush(c):
    c.fill(rect(3, 4, 12, 7), (150, 104, 62))
    for x in range(3, 13):
        for y in range(8, 12):
            if x % 2 == 0:
                c.put(x, y, (226, 210, 180))


def bell(c):
    c.fill({(x, y) for x in range(3, 13) for y in range(4, 13) if abs(x - 7.5) <= 2 + (y - 4) * 0.45}, (210, 170, 60))
    c.fill(rect(7, 2, 8, 3), (90, 70, 40), shade=False)
    c.put(8, 13, (90, 70, 40))


def notebook(c):
    c.fill(rect(3, 2, 12, 13), (120, 82, 50))
    c.fill(rect(5, 4, 12, 12), (236, 228, 206), shade=False)
    for y in (6, 8, 10):
        for x in range(6, 12):
            c.put(x, y, (160, 150, 130))


def tag(c):
    c.fill({(x, y) for x in range(3, 13) for y in range(4, 13) if y >= 4 + abs(x - 7.5) - 3}, (238, 206, 52))
    c.put(8, 7, (60, 50, 30))


def nursing(c):
    c.fill(ellipse(8, 3, 1.6, 2), (226, 160, 120))
    c.fill(rect(6, 4, 9, 5), (120, 170, 210), shade=False)
    c.fill(rect(5, 6, 10, 13), (214, 230, 236))
    c.fill(rect(6, 8, 9, 12), (246, 244, 236))


def fork(c):
    for y in range(6, 15):
        c.put(8, y, (140, 100, 60))
    for x in (5, 8, 11):
        for y in range(1, 6):
            c.put(x, y, (170, 176, 184))
    c.fill(rect(5, 5, 11, 5), (170, 176, 184), shade=False)


def mark_star(c, color):
    for (x, y) in ((13, 0), (12, 1), (13, 1), (14, 1), (13, 2)):
        c.put(x, y, color)


def mark_heart(c):
    for (x, y) in ((12, 1), (14, 1), (11, 2), (12, 2), (13, 2), (14, 2), (15, 2), (12, 3), (13, 3), (14, 3), (13, 4)):
        c.put(x, y, (232, 92, 120))


# --- Item table ---------------------------------------------------------------

MILK = {"cow_milk": (246, 244, 236), "goat_milk": (250, 248, 240), "buffalo_milk": (244, 240, 226), "yak_milk": (240, 230, 206)}
EGG = {"egg": ((232, 214, 182), None), "duck_egg": ((206, 228, 216), None), "goose_egg": ((246, 244, 236), (210, 206, 196))}
CARCASS = {
    "cow": ((170, 60, 56), True), "sheep": ((176, 76, 70), True), "goat": ((168, 72, 66), True), "pig": ((236, 160, 150), True),
    "chicken": ((244, 214, 190), False), "rabbit": ((196, 96, 90), False), "duck": ((236, 200, 176), False),
    "goose": ((240, 214, 190), False), "buffalo": ((150, 52, 50), True), "yak": ((150, 56, 52), True),
}
RAW = (196, 70, 64)
COOKED = (140, 88, 54)


def draw(item_id):
    c = Canvas()
    tier = None
    base = item_id
    for suffix in ("_fine", "_superb"):
        if item_id.endswith(suffix):
            tier, base = suffix[1:], item_id[: -len(suffix)]

    if base in MILK:
        bottle(c, MILK[base])
    elif base in EGG:
        egg(c, *EGG[base])
    elif base.startswith("fertilized_"):
        species = base.split("_")[1]
        egg(c, *EGG["egg" if species == "chicken" else f"{species}_egg"])
    elif base.endswith("_carcass"):
        color, big = CARCASS[base[: -len("_carcass")]]
        carcass(c, color, (240, 226, 214), big)
    elif base.startswith("cooked_"):
        meat(c, COOKED, (196, 150, 110))
    elif base.endswith("_meat"):
        meat(c, RAW)
    elif base in ("chicken_leg", "duck_leg", "goose_leg", "rabbit_leg", "lamb_leg"):
        drumstick(c, (232, 170, 150) if base != "lamb_leg" else RAW)
    elif base == "chicken_wing":
        drumstick(c, (240, 196, 170))
    elif base in ("beef_brisket", "beef_shank", "beef_sirloin", "lamb_chop"):
        meat(c, RAW, bone=base in ("lamb_chop", "beef_shank"))
    elif base == "pork_belly":
        meat(c, (232, 150, 140), fat=(250, 236, 226))
    elif base == "pork_ribs":
        meat(c, (226, 130, 120), bone=True)
    elif base == "pork_trotter":
        blob(c, (236, 170, 160), 4, 5)
    elif base in ("large_bone", "chicken_frame"):
        bone(c)
    elif base in ("raw_hide", "pig_skin"):
        sheet(c, (186, 130, 100) if base == "raw_hide" else (238, 176, 166))
    elif base == "sheep_skin":
        sheet(c, (236, 232, 222), (210, 204, 194))
    elif base in ("beef_tallow", "mutton_tallow", "pork_fat"):
        blob(c, (246, 238, 220))
    elif base == "lard":
        jar(c, (250, 246, 236))
    elif base in ("cattle_horn", "billy_goat_horn"):
        horn(c, (220, 206, 176))
    elif base in ("down", "yak_hair", "pig_bristle"):
        fluff(c, {"down": (248, 248, 244), "yak_hair": (70, 56, 46), "pig_bristle": (196, 160, 140)}[base])
    elif base in ("manure", "dried_yak_dung"):
        pile(c, (98, 72, 44) if base == "manure" else (150, 124, 88))
    elif base == "fertilizer":
        sack(c, (120, 150, 80))
    elif base == "butter":
        block(c, (246, 222, 110))
    elif base in ("cream", "yogurt"):
        jar(c, (252, 250, 242))
    elif base == "ghee":
        jar(c, (238, 196, 90))
    elif base == "whey":
        bottle(c, (232, 236, 200))
    elif base == "fresh_cheese":
        block(c, (250, 246, 228))
    elif base == "aged_cheese_wheel":
        wheel(c, (240, 200, 90), (200, 150, 60))
    elif base == "cheese_slice":
        wedge(c, (242, 204, 96))
    elif base == "salted_duck_egg":
        egg(c, (226, 236, 228), (250, 250, 250))
    elif base == "century_egg":
        egg(c, (70, 60, 40), (120, 100, 60))
    elif base == "alfalfa":
        sprig(c, (90, 150, 60), (160, 120, 210))
    elif base == "alfalfa_seeds":
        seeds(c, (170, 150, 80))
    elif base == "forage":
        bundle(c, (150, 180, 80))
    elif base == "mixed_feed":
        sack(c, (200, 176, 120))
    elif base == "premium_feed":
        sack(c, (230, 190, 70))
    elif base == "swill":
        jar(c, (130, 110, 70))
    elif base.endswith("_treat"):
        cookie(c, (210, 160, 100), (120, 80, 50))
    elif base == "milking_pail":
        pail(c)
    elif base == "brush":
        brush(c)
    elif base == "cowbell":
        bell(c)
    elif base == "ranch_notebook":
        notebook(c)
    elif base == "ear_tag":
        tag(c)
    elif base == "nursing_bottle":
        nursing(c)
    elif base == "feed_bag":
        sack(c, (170, 130, 80))
    elif base == "pitchfork":
        fork(c)
    else:
        raise KeyError(f"no icon template for {item_id}")

    c.outline()
    if tier == "fine":
        mark_star(c, (220, 226, 236))
    elif tier == "superb":
        mark_star(c, (250, 206, 60))
    if base.startswith("fertilized_"):
        mark_heart(c)
    return c.image
