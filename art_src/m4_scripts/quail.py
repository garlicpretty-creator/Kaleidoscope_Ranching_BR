"""Quail (Japanese / common quail): a plump round body low on short legs, a stub of a tail, a
small head with a short pointed bill, and barred brown plumage with pale shaft streaks. The cock
has a chestnut face, throat and breast; the hen a pale breast speckled dark. The chick is a small
buff ball with dark stripes down its back.

Bones keep the pack's conventions (a_* adult, b_* young; head / wing / leg names match the walk
written by client.py, the roost pose of tools/gen_sleep.mjs and tools/gen_actions.mjs). The chick's
head hangs from the body on its own neck pivot (client.py "baby_look" turns it to look about).

Built by new_animals.py (BUILD["quail"]):
    python art_src/m4_scripts/new_animals.py quail && python art_src/m4_scripts/client.py quail
"""
from blocks_m3 import autouv
from boxuv import plain_eyes

TW = 64

# (bone, parent, pivot, [(cube, origin, size), ...])
RAW = [
    ("body", None, [0, 0, 0], []),
    # --- adult: a round loaf 7 wide with the folded wings, 5 high, sitting on short legs ------
    ("a_torso", "body", [0, 4, 0], [
        ("torso", [-2.5, 2, -3], [5, 4, 6]),
        ("breast", [-2, 2.5, -4], [4, 3, 1]),       # the full crop bulging under the head
        ("back", [-2, 6, -2], [4, 1, 4]),           # rounds off the top
        ("belly", [-2, 1.5, -2], [4, 1, 4]),        # rounds off the underside
    ]),
    # the stub of a tail, drooping off the rump
    ("a_tail", "body", [0, 5, 3], [("tail", [-1.5, 3.5, 3], [3, 2, 1])]),
    ("head", "body", [0, 6.5, -2.5], []),
    ("a_head", "head", [0, 6.5, -2.5], [
        ("head", [-2, 6, -5.5], [4, 3, 3]),
        ("bill", [-0.5, 6.5, -6.5], [1, 1, 1]),
    ]),
    ("a_wing_left", "body", [2.5, 6, -2], [("wing", [2.5, 3, -2], [1, 3, 5])]),
    ("a_wing_right", "body", [-2.5, 6, -2], [("wing", [-3.5, 3, -2], [1, 3, 5])]),
    ("a_leg_left", "body", [1, 3, 0.5], [("leg", [0.5, 1, 0], [1, 2, 1]), ("foot", [0, 0, -1], [2, 1, 2])]),
    ("a_leg_right", "body", [-1, 3, 0.5], [("leg", [-1.5, 1, 0], [1, 2, 1]), ("foot", [-2, 0, -1], [2, 1, 2])]),
    # --- chick: a striped ball with a round head, no tail -------------------------------------
    ("b_torso", "body", [0, 2.5, 0], [("b_torso", [-2, 1, -2.5], [4, 3, 5])]),
    ("b_head", "body", [0, 4, -2], [
        ("b_head", [-1.5, 3, -4], [3, 3, 3]),
        ("b_bill", [-0.5, 3.5, -5], [1, 1, 1]),
    ]),
    ("b_wing_left", "body", [2, 4, -1], [("b_wing", [2, 2, -1.5], [1, 2, 3])]),
    ("b_wing_right", "body", [-2, 4, -1], [("b_wing", [-3, 2, -1.5], [1, 2, 3])]),
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


def hashed(i, j, f, k=0):
    return (i * 7 + j * 13 + len(f) * 3 + k) % 11


BILL = (66, 56, 50)
LEGS = (214, 166, 132)
EYE_STRIPE = (64, 46, 32)


def looks(sex):
    if sex == "male":
        return {"base": (146, 98, 58), "dark": (74, 48, 30), "pale": (236, 210, 156),
                "breast": (184, 100, 54), "throat": (140, 62, 36), "belly": (220, 180, 128),
                "face": (178, 96, 56), "brow": (244, 232, 206)}
    return {"base": (154, 112, 70), "dark": (80, 56, 36), "pale": (234, 208, 154),
            "breast": (226, 200, 154), "throat": (238, 222, 188), "belly": (230, 210, 170),
            "face": (214, 184, 136), "brow": (236, 214, 166)}


def adult(p, sex):
    L = looks(sex)
    base, dark, pale = L["base"], L["dark"], L["pale"]
    mid = mix(base, dark, 0.35)

    def back(f, i, j, w, h, fi):
        """The back from above: two long buff shaft streaks, dark chevrons down the middle."""
        if i in (1, w - 2):
            return pale
        if 1 < i < w - 2:
            return dark if j % 2 == 0 else base
        return mid if j % 3 == 1 else base

    def front(f, i, j, w, h, fi):
        """The breast: a cock's plain chestnut, a hen's pale buff speckled dark."""
        if sex == "male":
            return L["breast"] if hashed(i, j, f) else mix(L["breast"], dark, 0.2)
        return mix(dark, L["breast"], 0.35) if (i + 2 * j) % 4 == 1 and j > 0 else L["breast"]

    def body(f, i, j, w, h, fi):
        if f == "top":
            return back(f, i, j, w, h, fi)
        if f in ("east", "west"):
            if fi < 2:
                return front(f, i, j, w, h, fi)              # the breast wraps round the front
            if j == h - 1:
                return mix(base, L["belly"], 0.6)
            return pale if j == 0 else (mid if (fi + j) % 3 == 0 else base)
        if f == "south":
            return pale if j == 0 and i in (1, w - 2) else (mid if (i + j) % 2 else base)
        if f == "bottom":
            return L["belly"]
        return front(f, i, j, w, h, fi)

    p.paint("torso", body)
    p.paint("back", lambda f, i, j, w, h, fi: back(f, i, j, w, h, fi) if f == "top" else (pale if f in ("east", "west") else base))
    p.paint("breast", lambda f, i, j, w, h, fi: back(f, i, j, w, h, fi) if f == "top" else front(f, i, j, w, h, fi))
    p.paint("belly", lambda f, i, j, w, h, fi: L["belly"] if f in ("bottom", "north") else mix(base, L["belly"], 0.6))
    p.paint("tail", lambda f, i, j, w, h, fi: pale if (f == "top" and i == 1) or (f == "south" and j == 0 and i == 1) else (dark if (i + j) % 2 == 0 else mid))

    def wing(f, i, j, w, h, fi):
        """Folded wing: a buff streak along the top, barred coverts, dusky primaries behind."""
        if f in ("east", "west"):
            if fi >= w - 1:
                return mix(base, dark, 0.6) if j else mid    # primaries over the rump
            if j == 0:
                return pale
            if j == 1:
                return dark if fi % 2 == 1 else base
            return pale if fi % 2 == 0 and fi else mid
        if f == "top":
            return pale
        return mid
    p.paint("wing", wing)

    def head(f, i, j, w, h, fi):
        if f == "top":
            return mix(pale, base, 0.3) if i in (1, 2) else dark  # the pale crown stripe
        if f == "north":
            if j == 0:
                return mix(pale, base, 0.3) if i in (1, 2) else dark
            return L["face"] if j == 1 else L["throat"]
        if f in ("east", "west"):
            if j == 0:
                return L["brow"]                               # the pale eyebrow
            if j == 1:
                return L["face"] if fi == 0 else dark           # dark stripe back from the eye
            return L["throat"] if fi < 2 else mid
        if f == "bottom":
            return L["throat"]
        return dark if j == 0 and i not in (1, 2) else mid    # the nape
    p.paint("head", head)
    plain_eyes(p, "head", 1)
    p.paint("bill", lambda f, i, j, w, h, fi: mix(BILL, (150, 140, 128), 0.3) if f == "top" else BILL)
    p.paint("leg", flat(LEGS), light=False)
    p.paint("foot", lambda f, i, j, w, h, fi: mix(LEGS, (150, 100, 76), 0.3) if f == "top" and j == 0 else LEGS)


def chick(p):
    down, stripe, pale = (226, 196, 128), (110, 76, 46), (242, 222, 170)

    def body(f, i, j, w, h, fi):
        if f == "top":
            return stripe if i in (0, 2, w - 1) else down       # three dark stripes down the back
        if f in ("east", "west"):
            return stripe if j == 0 and fi % 2 == 0 else (pale if j == h - 1 else down)
        if f == "south":
            return stripe if i in (0, 2, w - 1) and j < h - 1 else down
        if f in ("north", "bottom"):
            return pale
        return down
    p.paint("b_torso", body)

    def head(f, i, j, w, h, fi):
        if f == "top":
            return stripe if i == 1 else down                   # a dark cap stripe
        if f in ("east", "west"):
            return stripe if j == 1 and fi >= 1 else down       # dark streak behind the eye
        if f == "north":
            return mix(down, stripe, 0.4) if j == 0 and i == 1 else down
        return down if f != "bottom" else pale
    p.paint("b_head", head)
    plain_eyes(p, "b_head", 1)
    p.paint("b_bill", flat(mix(BILL, (150, 120, 96), 0.4)))
    p.paint("b_wing", lambda f, i, j, w, h, fi: stripe if f in ("east", "west") and j == 0 else mix(down, stripe, 0.25))
    p.paint("b_leg", flat(LEGS), light=False)
