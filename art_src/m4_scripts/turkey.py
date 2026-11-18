"""Turkey (domestic bronze): a big round body, a long bare neck, a small head with a short hooked
bill, the tom's snood, wattle and breast beard, bronze barred plumage, a folded tail that fans
for the display (開屏), sturdy pink-grey legs; and a fluffy buff poult on its own b_ rig.

Bones keep the pack's conventions (a_ adult, b_ young, m_ tom only, fa_ hen only) and the names
the rest of the pack writes against: client.py's walk (a_/b_ leg_left, leg_right, wing_left,
wing_right), tools/gen_sleep.mjs (roost; snood and wattle bones are named *wattle so they do not
count as neck), tools/gen_actions.mjs (head, a_tail for the petted wag). The display moves:

  a_tail        the folded tail; FAN below stands it up behind the back and spreads it
  a_wing_*      drooped toward the ground
  head          pulled back against the puffed breast

Eyes are painted with boxuv.plain_eyes so gen_sleep can lay eyelids over them. UVs are packed by
blocks_m3.autouv. Built by new_animals.py (BUILD["turkey"]).
"""
from blocks_m3 import autouv
from boxuv import plain_eyes

BONES = [
    ("body", None, [0, 0, 0], None),
    # --- adult -------------------------------------------------------------------
    ("a_torso", "body", [0, 9, 0], [
        ("torso", [-4, 5, -5], [8, 8, 11]),
        ("back", [-3.5, 13, -4], [7, 1, 9]),       # rounds the top
        ("breast", [-3.5, 6, -7], [7, 6, 2]),      # the round breast pushed forward
        ("belly", [-3, 4, -4], [6, 1, 8]),         # softens the underside
        ("rump", [-3, 7, 6], [6, 5, 2]),           # tapers to the tail
    ]),
    # the folded tail hangs down behind the rump, its rounded tip painted in (transparent
    # corners); FAN swings it up over the back and spreads it
    ("a_tail", "body", [0, 12, 8], [("tail", [-3.5, 6, 8], [7, 6, 2])]),
    # the tom's beard: a tuft of black bristles hanging from the breast
    ("m_beard", "body", [0, 11, -7], [("beard", [-0.5, 7, -8], [1, 4, 1])]),
    ("head", "body", [0, 11, -5], None),
    ("a_head", "head", [0, 11, -5], [
        ("neck", [-1.5, 10, -8], [3, 8, 3]),
        ("head", [-2, 17, -10], [4, 3, 4]),
        ("bill", [-1, 17, -11], [2, 1, 1]),
    ]),
    # snood over the bill and the wattle under the chin: long on the tom, a nub on the hen
    ("m_wattle", "a_head", [0, 18, -10], [
        ("snood", [-1, 15, -12], [1, 4, 1]),
        ("wattle", [-1, 14, -10], [2, 3, 2]),
    ]),
    ("fa_wattle", "a_head", [0, 18, -10], [("snood_hen", [-1, 18, -11], [1, 1, 1])]),
    ("a_wing_left", "body", [4, 12, -2], [("wing_l", [4, 6, -4], [1, 6, 10])]),
    ("a_wing_right", "body", [-4, 12, -2], [("wing_r", [-5, 6, -4], [1, 6, 10])]),
    ("a_leg_left", "body", [2, 5, 0.5], [("leg", [1.5, 1, 0], [1, 4, 1]), ("foot", [0.5, 0, -2], [3, 1, 3])]),
    ("a_leg_right", "body", [-2, 5, 0.5], [("leg", [-2.5, 1, 0], [1, 4, 1]), ("foot", [-3.5, 0, -2], [3, 1, 3])]),
    # --- poult: round and fluffy, a big head on a short neck, stubby wings ---------
    ("b_torso", "body", [0, 4, 0], [("b_torso", [-2.5, 2, -3], [5, 5, 6])]),
    ("b_head", "body", [0, 6, -3], [
        ("b_head", [-2, 6, -5.5], [4, 4, 4]),
        ("b_bill", [-0.5, 7, -6.5], [1, 1, 1]),
    ]),
    ("b_wing_left", "body", [2.5, 6, -1], [("b_wing_l", [2.5, 3, -2], [1, 3, 4])]),
    ("b_wing_right", "body", [-2.5, 6, -1], [("b_wing_r", [-3.5, 3, -2], [1, 3, 4])]),
    ("b_leg_left", "body", [1, 2, 0.5], [("b_leg", [0.5, 0, 0], [1, 2, 1]), ("b_foot", [0, 0, -1], [2, 1, 2])]),
    ("b_leg_right", "body", [-1, 2, 0.5], [("b_leg", [-1.5, 0, 0], [1, 2, 1]), ("b_foot", [-2, 0, -1], [2, 1, 2])]),
]

# The display (開屏) pose, for whoever writes the animation: the tail swings up over the back and
# spreads, the wings drop to the ground, the head pulls back onto the breast.
FAN = {
    "a_tail": {"rotation": [165, 0, 0], "scale": [2.0, 1.6, 0.5]},
    "a_wing_left": {"rotation": [0, 0, -18], "position": [0.5, -2, 0]},
    "a_wing_right": {"rotation": [0, 0, 18], "position": [-0.5, -2, 0]},
    "head": {"rotation": [-18, 0, 0], "position": [0, 0, 1]},
    "a_torso": {"scale": [1.08, 1.06, 1.04]},
}


def mix(a, b, t):
    return tuple(int(x + (y - x) * t) for x, y in zip(a, b))


def flat(c):
    return lambda f, i, j, w, h, fi: c


# plumage per sex: base, dark bar (feather tips), glint (copper sheen), sheen (green on the tom,
# pale tips on the hen)
TOM = {"base": (64, 46, 32), "bar": (28, 22, 20), "glint": (118, 80, 44), "sheen": (58, 72, 52),
       "skin": (196, 46, 44), "face": (178, 200, 226), "wing": (44, 36, 30)}
HEN = {"base": (116, 90, 64), "bar": (72, 56, 42), "glint": (150, 116, 80), "sheen": (184, 166, 136),
       "skin": (156, 158, 176), "face": (196, 204, 220), "wing": (92, 74, 56)}
LEGS = (190, 156, 152)
BILL = (204, 186, 150)
RED, RED_DK = (204, 40, 40), (150, 26, 30)
BUFF, TAIL, TAIL_BAR = (226, 204, 160), (124, 80, 46), (52, 34, 24)


def barred(c):
    """Bronze feathers lying in bands, rows of three: a copper band, the feather, a dark tip; the
    tips scalloped (a gap every third pixel, offset per row), now and then the sheen."""
    def fn(f, i, j, w, h, fi):
        x = fi if f in ("east", "west") else i
        row = j // 3
        k = (x + row) % 3
        if j % 3 == 2:
            return c["bar"] if k != 1 else c["base"]
        if j % 3 == 0:
            if k == 1:
                return c["base"]
            return c["sheen"] if (x + 2 * row) % 7 == 0 else c["glint"]
        return c["base"]
    return fn


def rounded(f, i, j, w, h, fi):
    """The tail's free end (its lower edge at rest) is rounded: the outer corners stay transparent."""
    if f in ("south", "north"):
        return j == h - 1 and i in (0, w - 1)
    if f in ("east", "west"):
        return j == h - 1
    return f == "bottom" and i in (0, w - 1)


def adult(p, sex):
    c = TOM if sex == "male" else HEN
    body = barred(c)
    p.paint("torso", lambda f, i, j, w, h, fi: mix(c["base"], c["bar"], 0.3) if f == "bottom" else body(f, i, j, w, h, fi))
    p.paint("back", lambda f, i, j, w, h, fi: body(f, i, j, w, h, fi) if f == "top" else mix(c["base"], c["bar"], 0.3))
    p.paint("breast", body)
    p.paint("belly", flat(mix(c["base"], c["bar"], 0.35)))
    p.paint("rump", body)

    def tail_fn(f, i, j, w, h, fi):
        # the fan (south face; the front once fanned): chestnut feathers barred black with dark
        # shafts between them, a black band and a pale tip along the free end
        if rounded(f, i, j, w, h, fi):
            return None
        if f in ("south", "north"):
            if j == h - 1 or (j == h - 2 and i in (0, w - 1)):
                return BUFF if sex == "female" else mix(BUFF, (250, 248, 240), 0.4)
            if j == h - 2 or (j == h - 3 and i in (0, w - 1)):
                return (26, 20, 18)
            if f == "north":
                return mix(c["base"], c["bar"], 0.3)
            if i % 2 == 1:
                return mix(TAIL, TAIL_BAR, 0.5)
            return TAIL_BAR if j % 2 == 1 else (TAIL if sex == "male" else mix(TAIL, c["base"], 0.5))
        if f == "bottom":
            return BUFF
        return mix(c["base"], c["bar"], 0.3)
    p.paint("tail", tail_fn)
    p.paint("beard", lambda f, i, j, w, h, fi: (20, 18, 18) if j < h - 1 else (40, 34, 30))

    def neck_fn(f, i, j, w, h, fi):
        # bare skin above, feathers below; the tom's throat warty red
        if j < 4:
            if sex == "male":
                if j == 0 and f in ("south", "top"):
                    return c["face"]
                return RED_DK if (i + j) % 3 == 0 and f == "north" else c["skin"]
            return c["skin"] if j > 1 else mix(c["skin"], c["face"], 0.5)
        return body(f, i, j, w, h, fi)
    p.paint("neck", neck_fn)

    def head_fn(f, i, j, w, h, fi):
        # small bare head: pale blue face and crown, the skin below
        if f == "top" or j == 0:
            return c["face"]
        if f in ("east", "west") and fi < 2 and j == 1:
            return c["face"]
        return c["skin"]
    p.paint("head", head_fn)
    p.paint("bill", lambda f, i, j, w, h, fi: mix(BILL, (90, 74, 60), 0.5) if f in ("north", "bottom") else BILL)
    p.paint("snood", lambda f, i, j, w, h, fi: RED_DK if j == h - 1 else RED)
    p.paint("wattle", lambda f, i, j, w, h, fi: RED_DK if (i + j) % 2 else RED)
    p.paint("snood_hen", flat((186, 96, 96)))
    plain_eyes(p, "head", 1)

    def wing_fn(f, i, j, w, h, fi):
        # bronze coverts over the flight feathers, thinly barred white toward the back
        if f in ("east", "west"):
            if j >= 3:
                # flight feathers: thin pale bars across the back half
                return (206, 200, 186) if (fi >= 5 and j % 2 == 1) else c["wing"]
            return body(f, i, j, w, h, fi)
        if f == "top":
            return c["glint"] if i % 3 == 0 else c["base"]
        return c["wing"]
    p.paint("wing_l", wing_fn)
    p.paint("wing_r", wing_fn)
    p.paint("leg", lambda f, i, j, w, h, fi: mix(LEGS, (110, 90, 90), 0.3) if j % 2 else LEGS, light=False)
    p.paint("foot", lambda f, i, j, w, h, fi: mix(LEGS, (110, 90, 90), 0.4) if (f == "top" and i == 1) else LEGS)


def baby(p):
    down, back, dark = (222, 196, 146), (150, 112, 72), (104, 74, 48)

    def body_fn(f, i, j, w, h, fi):
        if f == "top":
            return dark if i in (1, 3) else back  # brown back stripes
        if f == "south":
            return back
        if f in ("east", "west") and j == 0:
            return mix(down, back, 0.6)
        return down
    p.paint("b_torso", body_fn)

    def head_fn(f, i, j, w, h, fi):
        if f == "top":
            return dark if (i, j) in ((1, 1), (2, 2), (1, 3)) else back  # spotted crown
        if f == "south":
            return back
        if f in ("east", "west") and j == 1 and fi >= 2:
            return dark  # eye stripe behind the eye
        return down
    p.paint("b_head", head_fn)
    plain_eyes(p, "b_head", 1)
    p.paint("b_bill", flat((176, 146, 120)))
    p.paint("b_wing_l", flat(mix(down, back, 0.5)))
    p.paint("b_wing_r", flat(mix(down, back, 0.5)))
    p.paint("b_leg", flat((210, 176, 160)), light=False)
    p.paint("b_foot", flat((210, 176, 160)))


def build():
    raw = [(n, pa, pv, [(c[0], c[1], c[2]) for c in (cubes or [])]) for n, pa, pv, cubes in BONES]
    packed, tw, th = autouv(raw, 64)
    th = max(th, tw // 2)
    return [(n, pa, pv, cubes or None) for n, pa, pv, cubes in packed], tw, th, adult, baby
