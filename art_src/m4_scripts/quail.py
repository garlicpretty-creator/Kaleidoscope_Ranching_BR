"""Quail (Japanese / common quail): a plump round body low on short legs, a stub of a tail, a
small head with a short pointed bill, and soft brown plumage with buff shaft streaks running
lengthwise. The cock has a chestnut face, throat and breast; the hen a pale breast lightly
speckled. The chick is a buff ball with two soft stripes down its back.

Bones keep the pack's conventions (a_* adult, b_* young; head / wing / leg names match the walk
written by client.py, the roost pose of tools/gen_sleep.mjs and tools/gen_actions.mjs). The chick's
head hangs from the body on its own neck pivot (client.py "baby_look" turns it to look about).
Both heads pivot at the front of the breast, so the peck (gen_actions.mjs, with the quail's
PECK_REACH offset) swings the bill down in front of the body rather than into it.

Contrast is kept at the duck's and chicken's level: bars and speckles are the base colour mixed
part way toward dark, never dark itself.

Built by new_animals.py (BUILD["quail"]):
    python art_src/m4_scripts/new_animals.py quail && python art_src/m4_scripts/client.py quail
"""
from blocks_m3 import autouv
from boxuv import plain_eyes

TW = 64

# (bone, parent, pivot, [(cube, origin, size), ...])
RAW = [
    ("body", None, [0, 0, 0], []),
    # --- adult: a round loaf 7 wide with the folded wings, 5 high, on legs showing 1 px -----
    ("a_torso", "body", [0, 4, 0], [
        ("torso", [-2.5, 2, -3], [5, 4, 6]),
        ("breast", [-2, 2.5, -4], [4, 3, 1]),       # the full crop bulging under the head
        ("back", [-2, 6, -2], [4, 1, 4]),           # rounds off the top
    ]),
    # the stub of a tail, drooping off the rump
    ("a_tail", "body", [0, 5, 3], [("tail", [-1.5, 3.5, 3], [3, 2, 1])]),
    ("head", "body", [0, 6, -4], []),
    ("a_head", "head", [0, 6, -4], [
        ("head", [-2, 6, -6.5], [4, 3, 3]),
        ("bill", [-0.5, 6.5, -7.5], [1, 1, 1]),
    ]),
    ("a_wing_left", "body", [2.5, 6, -2], [("wing", [2.5, 3, -2], [1, 3, 5])]),
    ("a_wing_right", "body", [-2.5, 6, -2], [("wing", [-3.5, 3, -2], [1, 3, 5])]),
    ("a_leg_left", "body", [1, 3, 0.5], [("leg", [0.5, 1, 0], [1, 2, 1]), ("foot", [0, 0, -1], [2, 1, 2])]),
    ("a_leg_right", "body", [-1, 3, 0.5], [("leg", [-1.5, 1, 0], [1, 2, 1]), ("foot", [-2, 0, -1], [2, 1, 2])]),
    # --- chick: a striped ball near the adult's width (the young are drawn at half scale) -----
    ("b_torso", "body", [0, 3, 0], [("b_torso", [-2.5, 1, -2.5], [5, 4, 5])]),
    # the head stands a pixel proud of the back, so it still shows turned round in the roost
    ("b_head", "body", [0, 5, -1.5], [
        ("b_head", [-2, 4.5, -4.5], [4, 3, 3]),
        ("b_bill", [-0.5, 5, -5.5], [1, 1, 1]),
    ]),
    ("b_wing_left", "body", [2.5, 4, -1], [("b_wing", [2.5, 2, -1.5], [1, 2, 3])]),
    ("b_wing_right", "body", [-2.5, 4, -1], [("b_wing", [-3.5, 2, -1.5], [1, 2, 3])]),
    ("b_leg_left", "body", [1, 1.5, 0], [("b_leg", [0.5, 0, -0.5], [1, 2, 1])]),
    ("b_leg_right", "body", [-1, 1.5, 0], [("b_leg", [-1.5, 0, -0.5], [1, 2, 1])]),
]


def build():
    packed, tw, th = autouv(RAW, TW)
    th = max(th, tw // 2)
    return [(n, p, pv, cubes or None) for n, p, pv, cubes in packed], tw, th


BONES, TW, TH = build()


def mix(a, b, t):
    return tuple(int(x + (y - x) * t) for x, y in zip(a, b))


def flat(c):
    return lambda f, i, j, w, h, fi: c


BILL = (66, 56, 50)
LEGS = (214, 166, 132)


def looks(sex):
    if sex == "male":
        return {"base": (146, 100, 62), "dark": (80, 54, 34), "pale": (226, 198, 146),
                "breast": (184, 102, 56), "throat": (150, 70, 40), "belly": (214, 176, 126),
                "face": (178, 98, 58), "brow": (222, 202, 168)}
    return {"base": (154, 112, 70), "dark": (80, 56, 36), "pale": (234, 208, 154),
            "breast": (222, 196, 150), "throat": (232, 214, 178), "belly": (226, 204, 164),
            "face": (210, 180, 134), "brow": (228, 204, 158)}


def adult(p, sex):
    L = looks(sex)
    base = L["base"]
    bar = mix(base, L["dark"], 0.45)      # barring and dashes: never the dark itself
    streak = mix(base, L["pale"], 0.55)   # buff shaft streaks, lengthwise only
    shade = mix(base, L["dark"], 0.2)

    def back(f, i, j, w, h, fi):
        """From above: two buff shaft streaks running the length, short dashes between."""
        if i in (1, w - 2):
            return streak
        if 1 < i < w - 2:
            return bar if (j + i) % 3 == 0 else base
        return shade if j % 3 == 1 else base

    def front(f, i, j, w, h, fi):
        """The breast: a cock's plain chestnut, a hen's pale buff lightly speckled."""
        if sex == "male":
            return L["breast"] if (i + j) % 4 else mix(L["breast"], L["dark"], 0.15)
        return mix(L["breast"], L["dark"], 0.3) if (i + 2 * j) % 5 == 1 and j > 0 else L["breast"]

    def body(f, i, j, w, h, fi):
        if f == "top":
            return back(f, i, j, w, h, fi)
        if f in ("east", "west"):
            if fi < 2:
                return front(f, i, j, w, h, fi)              # the breast wraps round the front
            if j == h - 1:
                return mix(base, L["belly"], 0.5)
            if j == 0:
                return streak
            return bar if (fi + 2 * j) % 5 == 0 else base
        if f == "south":
            return streak if i in (1, w - 2) and j < h - 1 else (shade if j == h - 1 else base)
        if f == "bottom":
            return L["belly"]
        return front(f, i, j, w, h, fi)

    p.paint("torso", body)
    p.paint("back", lambda f, i, j, w, h, fi: back(f, i, j, w, h, fi) if f == "top" else (streak if f in ("east", "west") else base))
    p.paint("breast", lambda f, i, j, w, h, fi: back(f, i, j, w, h, fi) if f == "top" else front(f, i, j, w, h, fi))
    p.paint("tail", lambda f, i, j, w, h, fi: streak if f in ("top", "south") and i == 1 else (bar if (i + j) % 3 == 0 else shade))

    def wing(f, i, j, w, h, fi):
        """Folded wing: a buff streak along the top, dashed coverts, dusky primaries behind."""
        if f in ("east", "west"):
            if fi >= w - 1:
                return bar                                     # primaries over the rump
            if j == 0:
                return streak
            if j == 1:
                return bar if fi % 3 == 1 else base
            return shade if fi % 3 != 2 else base
        if f == "top":
            return streak
        return shade
    p.paint("wing", wing)

    crown = mix(base, L["dark"], 0.55)
    stripe = mix(base, L["pale"], 0.5)

    def head(f, i, j, w, h, fi):
        if f == "top":
            return stripe if i in (1, 2) else crown            # the pale crown stripe
        if f == "north":
            if j == 0:
                if i in (0, w - 1):
                    return L["brow"]                           # the eyebrow, over each eye
                return stripe
            return L["face"] if j == 1 else L["throat"]
        if f in ("east", "west"):
            if j == 0:
                return L["brow"]
            if j == 1:
                return L["face"] if fi == 0 else crown          # a stripe back from the eye
            return L["throat"] if fi < 2 else shade
        if f == "bottom":
            return L["throat"]
        return crown if j == 0 and i not in (1, 2) else shade  # the nape
    p.paint("head", head)
    plain_eyes(p, "head", 1)
    p.paint("bill", lambda f, i, j, w, h, fi: mix(BILL, (150, 140, 128), 0.3) if f == "top" else BILL)
    p.paint("leg", flat(LEGS), light=False)
    p.paint("foot", lambda f, i, j, w, h, fi: mix(LEGS, (150, 100, 76), 0.25) if f == "top" and j == 0 else LEGS)


def chick(p):
    down, pale = (226, 196, 128), (240, 220, 168)
    stripe = mix(down, (110, 76, 46), 0.5)
    soft = mix(down, (110, 76, 46), 0.2)

    def body(f, i, j, w, h, fi):
        if f == "top":
            return stripe if i in (1, w - 2) else (soft if i == w // 2 else down)  # two stripes down the back
        if f in ("east", "west"):
            return soft if j == 0 else (pale if j == h - 1 else down)
        if f == "south":
            return stripe if i in (1, w - 2) and j < 2 else down
        if f in ("north", "bottom"):
            return pale
        return down
    p.paint("b_torso", body)

    def head(f, i, j, w, h, fi):
        if f == "top":
            return stripe if i in (1, 2) else down              # a soft cap stripe
        if f in ("east", "west"):
            return soft if j == 1 and fi >= 1 else down         # a streak behind the eye
        if f == "north":
            return soft if j == 0 and i in (1, 2) else down
        return down if f != "bottom" else pale
    p.paint("b_head", head)
    plain_eyes(p, "b_head", 1)
    p.paint("b_bill", flat(mix(BILL, (150, 120, 96), 0.4)))
    p.paint("b_wing", lambda f, i, j, w, h, fi: soft if f in ("east", "west") and j == 0 else mix(down, soft, 0.5))
    p.paint("b_leg", flat(LEGS), light=False)
