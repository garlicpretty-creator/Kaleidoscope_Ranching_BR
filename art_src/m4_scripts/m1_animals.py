"""Hand-built M1 animals (cow, sheep, goat, pig, chicken, rabbit) in the style of the M4 ones:
stubby legs, big eyes with a catch-light, blush on the young, and a separate baby rig.

Bone prefixes (render controller rules, see tools/art/animals.py and tools/gen_art.py):
  a_ adults   b_ babies   m_ adult males   fa_ adult females
  wool_ hidden once sheared (adult wool sits under a_, the lamb's under b_)
  saddle shown when saddled

Writes art/animals/<id>/{<id>.geo.json, rig.json, textures/<variant>.png}. tools/gen_art.py uses
these in place of its procedural models and keeps writing the client entity, render controller
and walk animation from them. Texture variants and their order come from tools/art/animals.py.

Run: python m1_animals.py [species ...]
"""
import json
import sys
from pathlib import Path

from boxuv import BLUSH, Painter, cute_eyes, geo
from bovine import ear_fn, flat, hide_fn, horn_fn, leg_fn, mix, muzzle_fn

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "art" / "animals"
TW = TH = 128

sys.path.insert(0, str(ROOT / "tools" / "art"))
from animals import DYES, RABBIT_COATS  # noqa: E402


def h32(*a):
    h = 2166136261
    for v in a:
        for ch in str(v):
            h = ((h ^ ord(ch)) * 16777619) & 0xFFFFFFFF
    return h


def mirror(o, s):
    return [-(o[0] + s[0]), o[1], o[2]]


def pair(name, o, s, *extra):
    return [(name, o, s, *extra), (name, mirror(o, s), s, *extra)]


def legs(prefix, cube, size, x, z_front, z_back, top, parent="body"):
    w, _, d = size
    out = []
    for tag, sx, z in (("fl", 1, z_front), ("fr", -1, z_front), ("bl", 1, z_back), ("br", -1, z_back)):
        ox = x if sx > 0 else -(x + w)
        out.append((f"{prefix}leg_{tag}", parent, [ox + w / 2, top, z + d / 2], [(cube, [ox, 0, z], size)]))
    return out


def autouv(bones):
    """Gives every cube a box-UV place; cubes with the same name and size share one."""
    seen, x, y, row = {}, 0, 0, 0
    out = []
    for name, parent, pivot, cubes in bones:
        new = None
        if cubes is not None:
            new = []
            for c in cubes:
                cname, o, s = c[0], c[1], c[2]
                key = (cname, tuple(s))
                if key not in seen:
                    w, h, d = [max(1, round(v)) for v in s]
                    fw, fh = 2 * (w + d), d + h
                    if x + fw > TW:
                        x, y, row = 0, y + row, 0
                    if y + fh > TH:
                        raise SystemExit(f"texture full at {cname}")
                    seen[key] = [x, y]
                    x += fw
                    row = max(row, fh)
                new.append((cname, o, s, seen[key], *c[3:]))
        out.append((name, parent, pivot, new))
    return out


def dot_eyes(p, cube, row, inset=1, size=1, color=(26, 22, 26), blush=None):
    """Small solid eyes (no catch-light) for faces too small for cute_eyes."""
    for f in ("east", "west"):
        x0, y0, w, h = p.face(cube, f)
        cols = [x0 + w - 1 - inset - k for k in range(size)] if f == "east" else [x0 + inset + k for k in range(size)]
        for c in cols:
            for r in range(size):
                p.px(c, y0 + row + r, color)
        if blush and row + size < h:
            p.px(cols[0], y0 + row + size, blush)


def spots(base, spot, seed, cell=3, rate=3):
    """Blocky coat patches (cow): whole cells switch colour, edges get a stray pixel."""
    def fn(f, i, j, w, h, fi):
        ci, cj = (i + h32(seed, f) % 3) // cell, (j + h32(seed, "y", f) % 2) // cell
        on = h32(seed, f, ci, cj) % rate == 0
        if not on and h32(seed, "e", f, i, j) % 23 == 0:
            on = True
        return spot if on else base
    return fn


def fluff(base, seed):
    """Wool: soft lumps of a lighter and a darker shade."""
    lt, dk = mix(base, (255, 255, 255), 0.18), mix(base, (0, 0, 0), 0.12)

    def fn(f, i, j, w, h, fi):
        r = h32(seed, f, i // 2, j // 2) % 7
        if r == 0:
            return lt
        if r == 1 and (i + j) % 2:
            return dk
        return base
    return fn


def feathers(base, edge, seed):
    """Small scalloped feathers: a darker rim every other row."""
    def fn(f, i, j, w, h, fi):
        if f in ("east", "west", "top") and (j % 2 == 1) and ((i + j // 2) % 3 == 0):
            return edge
        return base
    return fn


# --- Cow ---------------------------------------------------------------------------

COW = [
    ("body", None, [0, 0, 0], None),
    ("a_torso", "body", [0, 14, 0], [("torso", [-6, 9, -9], [12, 10, 18])]),
    ("fa_udder", "a_torso", [0, 9, 3], [("udder", [-2, 7, 1], [4, 2, 5]), *pair("teat", [1, 6, 2], [1, 1, 1])]),
    ("a_tail", "a_torso", [0, 18, 9], [("tail", [-0.5, 10, 9], [1, 8, 1]), ("tuft", [-1, 8, 8.5], [2, 3, 2])]),
    ("head", "body", [0, 17, -9], None),
    ("a_head", "head", [0, 17, -9], [
        ("skull", [-4, 13, -15], [8, 8, 6]),
        ("muzzle", [-3, 12, -17], [6, 4, 2]),
        *pair("ear", [4, 18, -12], [3, 1, 2]),
    ]),
    ("m_horns", "head", [0, 21, -12], [*pair("horn", [4, 20, -13], [3, 1, 2]), *pair("horntip", [6, 21, -13], [1, 2, 1])]),
    *legs("a_", "leg", [4, 9, 4], 2, -8, 4, 9),
    ("b_torso", "body", [0, 11, 0], [("b_torso", [-4, 8, -6], [8, 6, 12])]),
    ("b_tail", "b_torso", [0, 13, 6], [("b_tail", [-0.5, 9, 6], [1, 4, 1])]),
    ("b_head", "body", [0, 13, -6], [
        ("b_skull", [-3, 11, -11], [6, 6, 5]),
        ("b_muzzle", [-2, 11, -12], [4, 3, 1]),
        *pair("b_ear", [3, 15, -9], [2, 1, 2]),
    ]),
    *legs("b_", "b_leg", [3, 8, 3], 1, -5, 2, 8),
]


def cow_paint(p, sex):
    coat = {"female": (104, 66, 44), "male": (66, 42, 30)}[sex if sex != "baby" else "female"]
    white = (240, 236, 228)
    p.paint("torso", spots(coat, white, "cow"))
    p.paint("udder", flat((240, 168, 170)))
    p.paint("teat", flat((226, 140, 146)))
    p.paint("tail", flat(coat))
    p.paint("tuft", flat((44, 32, 26)))

    def skull(f, i, j, w, h, fi):
        if f == "north" and abs(i - (w - 1) / 2) < 1.1:
            return white  # blaze
        if f == "top":
            return white if i in (3, 4) else coat
        return spots(coat, white, "cowhead", cell=4, rate=4)(f, i, j, w, h, fi)
    p.paint("skull", skull)
    p.paint("muzzle", muzzle_fn((226, 186, 172), (240, 204, 192), (110, 70, 66)))
    p.paint("ear", ear_fn(coat, (232, 170, 160)))
    p.paint("horn", flat((236, 224, 196)))
    p.paint("horntip", flat((176, 160, 128)))
    p.paint("leg", lambda f, i, j, w, h, fi: (46, 36, 30) if j >= h - 1 or f == "bottom" else (white if j >= h - 4 else coat))
    cute_eyes(p, "skull", 3, inset=1, rim=(224, 214, 204))
    # calf: light tan with white socks and a pink nose
    calf = (176, 124, 86)
    p.paint("b_torso", spots(calf, white, "calf", cell=3, rate=4))
    p.paint("b_tail", flat(calf))
    p.paint("b_skull", lambda f, i, j, w, h, fi: white if f == "north" and abs(i - (w - 1) / 2) < 1 else calf)
    p.paint("b_muzzle", muzzle_fn((242, 196, 186), (246, 214, 206), (150, 96, 92)))
    p.paint("b_ear", ear_fn(calf, (240, 180, 172)))
    p.paint("b_leg", leg_fn(calf, white, (90, 70, 60)))
    cute_eyes(p, "b_skull", 2, inset=1, blush=BLUSH)


# --- Sheep -------------------------------------------------------------------------

SHEEP = [
    ("body", None, [0, 0, 0], None),
    ("a_torso", "body", [0, 13, 0], [("skin", [-4, 9, -8], [8, 6, 16])]),
    ("wool_body", "a_torso", [0, 13, 0], [("wool", [-5, 8, -9], [10, 9, 18]), ("woolback", [-4, 17, -7], [8, 1, 13])]),
    ("wool_tail", "a_torso", [0, 13, 9], [("wooltail", [-1.5, 11, 9], [3, 3, 2])]),
    ("head", "body", [0, 15, -9], None),
    ("a_head", "head", [0, 15, -9], [
        ("face", [-3, 11, -14], [6, 6, 5]),
        ("nose", [-2, 11, -15], [4, 3, 1]),
        *pair("ear", [3, 14, -11], [3, 1, 2]),
    ]),
    ("wool_head", "a_head", [0, 16, -11], [("woolcap", [-3.5, 16, -13], [7, 2, 4])]),
    ("m_horns", "head", [0, 15, -11], [*pair("horn", [3, 13, -12], [2, 4, 3]), *pair("horncurl", [3, 12, -14], [2, 2, 2])]),
    *legs("a_", "leg", [3, 9, 3], 1, -7, 4, 9),
    # lamb: a little wool ball on long legs
    ("b_torso", "body", [0, 10, 0], [("b_skin", [-3, 8, -5], [6, 4, 10])]),
    ("wool_lamb", "b_torso", [0, 10, 0], [("b_wool", [-3.5, 7, -5.5], [7, 6, 11]), ("b_wooltail", [-1, 9, 5.5], [2, 2, 1])]),
    ("b_head", "body", [0, 12, -5], [
        ("b_face", [-2.5, 10, -9], [5, 5, 4]),
        ("b_nose", [-1.5, 10, -10], [3, 2, 1]),
        *pair("b_ear", [2.5, 13, -7], [2, 1, 1]),
        ("b_cap", [-2.5, 14, -8.5], [5, 1, 3]),
    ]),
    *legs("b_", "b_leg", [2, 8, 2], 1, -4, 2, 8),
]


def sheep_paint(p, sex, wool):
    skin = {"female": (236, 220, 200), "male": (206, 186, 166), "baby": (244, 230, 214)}[sex]
    face = skin if sex != "male" else mix(skin, (120, 100, 86), 0.15)
    p.paint("skin", flat(skin))
    for n in ("wool", "woolback", "wooltail", "woolcap"):
        p.paint(n, fluff(wool, n))
    p.paint("face", flat(face))
    p.paint("nose", muzzle_fn(mix(face, (220, 160, 158), 0.5), face, (150, 100, 98)))
    p.paint("ear", ear_fn(face, (232, 176, 170)))
    p.paint("horn", horn_fn((210, 196, 168), (178, 162, 134)))
    p.paint("horncurl", horn_fn((194, 180, 150), (166, 150, 122)))
    p.paint("leg", leg_fn(face, None, (64, 52, 44)))
    cute_eyes(p, "face", 2, inset=1, rim=None)
    lamb = (246, 234, 220)
    p.paint("b_skin", flat(lamb))
    p.paint("b_wool", fluff(mix(wool, (255, 255, 255), 0.2), "lamb"))
    p.paint("b_wooltail", fluff(mix(wool, (255, 255, 255), 0.2), "lambt"))
    p.paint("b_cap", fluff(mix(wool, (255, 255, 255), 0.2), "lambc"))
    p.paint("b_face", flat(lamb))
    p.paint("b_nose", muzzle_fn((240, 196, 192), lamb, (170, 120, 118)))
    p.paint("b_ear", ear_fn(lamb, (240, 186, 182)))
    p.paint("b_leg", leg_fn(lamb, None, (110, 92, 80)))
    cute_eyes(p, "b_face", 1, inset=1, blush=BLUSH)


# --- Goat --------------------------------------------------------------------------

GOAT = [
    ("body", None, [0, 0, 0], None),
    ("a_torso", "body", [0, 13, 0], [("torso", [-4, 9, -8], [8, 8, 16])]),
    ("fa_udder", "a_torso", [0, 9, 3], [("udder", [-1.5, 7, 2], [3, 2, 4])]),
    ("a_tail", "a_torso", [0, 16, 8], [("tail", [-1, 15, 8], [2, 3, 1])]),
    ("head", "body", [0, 16, -8], None),
    ("a_head", "head", [0, 16, -8], [
        ("skull", [-3, 13, -14], [6, 6, 6]),
        ("muzzle", [-2, 12, -16], [4, 4, 2]),
        *pair("ear", [3, 16, -11], [3, 1, 2]),
    ]),
    ("fa_horns", "head", [0, 19, -11], [*pair("fhorn", [1, 19, -11], [1, 2, 1])]),
    ("m_horns", "head", [0, 19, -10], [*pair("mhorn", [1, 19, -11], [1, 4, 2]), *pair("mhorntip", [1, 22, -9], [1, 1, 2])]),
    ("m_beard", "head", [0, 12, -15], [("beard", [-1, 9, -16], [2, 3, 1])]),
    *legs("a_", "leg", [3, 9, 3], 1, -7, 4, 9),
    ("b_torso", "body", [0, 10, 0], [("b_torso", [-3, 8, -5], [6, 5, 10])]),
    ("b_tail", "b_torso", [0, 12, 5], [("b_tail", [-0.5, 12, 5], [1, 2, 1])]),
    ("b_head", "body", [0, 12, -5], [
        ("b_skull", [-2.5, 11, -9], [5, 5, 4]),
        ("b_muzzle", [-1.5, 11, -10], [3, 2, 1]),
        *pair("b_ear", [2.5, 13, -7], [2, 1, 1]),
        *pair("b_bud", [0.5, 16, -7], [1, 1, 1]),
    ]),
    *legs("b_", "b_leg", [2, 8, 2], 1, -4, 2, 8),
]


def goat_paint(p, sex):
    coat = {"female": (238, 232, 220), "male": (210, 200, 186), "baby": (238, 232, 220)}[sex]
    shade = mix(coat, (120, 110, 96), 0.18)
    p.paint("torso", hide_fn(coat, coat, mix(coat, (255, 255, 255), 0.3), 0.05))
    p.paint("udder", flat((236, 186, 182)))
    p.paint("tail", lambda f, i, j, w, h, fi: shade if j == 0 else coat)
    p.paint("skull", flat(coat))
    p.paint("muzzle", muzzle_fn(mix(coat, (220, 190, 180), 0.5), coat, (110, 90, 86)))
    p.paint("ear", ear_fn(coat, (232, 186, 176)))
    p.paint("fhorn", horn_fn((170, 156, 128), (146, 132, 108)))
    p.paint("mhorn", horn_fn((160, 146, 118), (128, 116, 94)))
    p.paint("mhorntip", flat((112, 100, 82)))
    p.paint("beard", flat(shade))
    p.paint("leg", leg_fn(coat, None, (70, 60, 50)))
    cute_eyes(p, "skull", 2, inset=1)
    kid = (246, 240, 230)
    p.paint("b_torso", flat(kid))
    p.paint("b_tail", flat(kid))
    p.paint("b_skull", flat(kid))
    p.paint("b_muzzle", muzzle_fn((242, 206, 198), kid, (160, 120, 116)))
    p.paint("b_ear", ear_fn(kid, (242, 194, 186)))
    p.paint("b_bud", flat((200, 188, 164)))
    p.paint("b_leg", leg_fn(kid, None, (120, 104, 92)))
    cute_eyes(p, "b_skull", 1, inset=1, blush=BLUSH)


# --- Pig ---------------------------------------------------------------------------

PIG = [
    ("body", None, [0, 0, 0], None),
    ("a_torso", "body", [0, 9, 0], [("torso", [-5, 5, -8], [10, 8, 16])]),
    ("a_tail", "a_torso", [0, 11, 8], [("tail", [-0.5, 10, 8], [1, 1, 2]), ("tailcurl", [-0.5, 11, 9], [1, 1, 1])]),
    ("saddle", "a_torso", [0, 13, 0], [("saddle", [-5.5, 13, -4], [11, 1, 8]), *pair("strap", [5, 8, -1], [1, 5, 1])]),
    ("head", "body", [0, 11, -8], None),
    ("a_head", "head", [0, 11, -8], [
        ("skull", [-4, 6, -14], [8, 7, 6]),
        ("snout", [-2, 7, -16], [4, 3, 2]),
        *pair("ear", [2, 12, -12], [3, 2, 1]),
    ]),
    ("m_tusks", "head", [0, 7, -16], [*pair("tusk", [2, 7, -16], [1, 2, 1])]),
    *legs("a_", "leg", [4, 5, 4], 1, -7, 3, 5),
    ("b_torso", "body", [0, 6, 0], [("b_torso", [-3, 3, -5], [6, 5, 10])]),
    ("b_tail", "b_torso", [0, 7, 5], [("b_tail", [-0.5, 7, 5], [1, 1, 1])]),
    ("b_head", "body", [0, 7, -5], [
        ("b_skull", [-3, 3, -9], [6, 6, 4]),
        ("b_snout", [-1.5, 4, -10], [3, 2, 1]),
        *pair("b_ear", [1.5, 9, -7], [2, 1, 1]),
    ]),
    *legs("b_", "b_leg", [2, 3, 2], 1, -4, 2, 3),
]


def pig_paint(p, sex):
    skin = {"female": (244, 172, 168), "male": (220, 146, 140), "baby": (248, 192, 188)}[sex]
    dk = mix(skin, (150, 80, 80), 0.25)

    def body(f, i, j, w, h, fi):
        if sex == "male" and h32("br", f, i, j) % 7 == 0:
            return mix(skin, (120, 70, 66), 0.2)  # bristles
        return skin
    p.paint("torso", body)
    p.paint("tail", flat(dk))
    p.paint("tailcurl", flat(dk))
    p.paint("saddle", lambda f, i, j, w, h, fi: (92, 52, 28) if f == "top" and i % 3 == 0 else (118, 68, 36))
    p.paint("strap", flat((60, 40, 26)))
    p.paint("skull", body)
    p.paint("snout", muzzle_fn(mix(skin, (220, 120, 120), 0.3), dk, (130, 64, 66)))
    p.paint("ear", ear_fn(skin, dk))
    p.paint("tusk", flat((244, 236, 216)))
    p.paint("leg", leg_fn(skin, None, dk))
    cute_eyes(p, "skull", 2, inset=1, blush=BLUSH if sex == "female" else None)
    pig = (250, 200, 196)
    p.paint("b_torso", flat(pig))
    p.paint("b_tail", flat(mix(pig, (150, 80, 80), 0.2)))
    p.paint("b_skull", flat(pig))
    p.paint("b_snout", muzzle_fn((246, 168, 166), pig, (176, 96, 98)))
    p.paint("b_ear", ear_fn(pig, (236, 150, 150)))
    p.paint("b_leg", leg_fn(pig, None, mix(pig, (150, 80, 80), 0.3)))
    cute_eyes(p, "b_skull", 2, inset=1, blush=BLUSH)


# --- Chicken -----------------------------------------------------------------------

CHICKEN = [
    ("body", None, [0, 0, 0], None),
    ("a_torso", "body", [0, 7, 0], [("torso", [-3, 4, -4], [6, 6, 8]), ("breast", [-2.5, 5, -5], [5, 4, 1])]),
    ("head", "body", [0, 10, -4], None),
    ("a_head", "head", [0, 10, -4], [
        ("hhead", [-2, 9, -7], [4, 5, 4]),
        ("beak", [-1, 11, -9], [2, 2, 2]),
    ]),
    ("fa_comb", "head", [0, 14, -5], [("fcomb", [-0.5, 14, -6.5], [1, 1, 3])]),
    ("fa_wattle", "head", [0, 10, -8], [("fwattle", [-0.5, 9, -8], [1, 2, 1])]),
    ("m_comb", "head", [0, 14, -5], [("mcomb", [-0.5, 14, -8], [1, 3, 5])]),
    ("m_wattle", "head", [0, 10, -8], [("mwattle", [-1, 8, -8], [2, 3, 1])]),
    ("a_wing_left", "body", [3, 9, 0], [("wing", [3, 5, -3], [1, 4, 6])]),
    ("a_wing_right", "body", [-3, 9, 0], [("wing", [-4, 5, -3], [1, 4, 6])]),
    ("a_leg_left", "body", [1.5, 4, 0], [("leg", [1, 0, -1], [1, 4, 1]), ("toes", [0, 0, -3], [3, 1, 2])]),
    ("a_leg_right", "body", [-1.5, 4, 0], [("leg", [-2, 0, -1], [1, 4, 1]), ("toes", [-3, 0, -3], [3, 1, 2])]),
    ("fa_tail", "a_torso", [0, 9, 4], [("ftail", [-2, 8, 4], [4, 4, 2])]),
    ("m_tail", "a_torso", [0, 9, 4], [("mtail", [-1, 8, 4], [2, 6, 3]), ("mtailtip", [-1, 11, 7], [2, 5, 2])]),
    # chick: a round fuzzball
    ("b_torso", "body", [0, 3, 0], [("b_torso", [-2, 1, -2.5], [4, 4, 5])]),
    ("b_head", "body", [0, 5, -2], [("b_head", [-1.5, 4, -4.5], [3, 3, 3]), ("b_beak", [-0.5, 5, -5.5], [1, 1, 1])]),
    ("b_wing_left", "body", [2, 4, 0], [("b_wing", [2, 2, -1.5], [1, 2, 3])]),
    ("b_wing_right", "body", [-2, 4, 0], [("b_wing", [-3, 2, -1.5], [1, 2, 3])]),
    ("b_leg_left", "body", [1, 1, 0], [("b_leg", [0.5, 0, -0.5], [1, 1, 1])]),
    ("b_leg_right", "body", [-1, 1, 0], [("b_leg", [-1.5, 0, -0.5], [1, 1, 1])]),
]


def chicken_paint(p, sex):
    s = "female" if sex == "baby" else sex
    pal = {
        "female": {"body": (240, 230, 210), "head": (244, 236, 218), "wing": (216, 198, 164), "tail": (198, 174, 132), "edge": (184, 160, 120)},
        "male": {"body": (156, 72, 38), "head": (220, 142, 48), "wing": (60, 82, 72), "tail": (34, 64, 58), "edge": (110, 48, 26)},
    }[s]
    red = (214, 52, 42)
    p.paint("torso", lambda f, i, j, w, h, fi: pal["head"] if s == "male" and f in ("east", "west", "top") and fi < 3 and j < 3
            else feathers(pal["body"], pal["edge"], "b")(f, i, j, w, h, fi))
    p.paint("breast", flat(pal["body"] if s == "female" else (120, 52, 30)))
    p.paint("hhead", flat(pal["head"]))
    p.paint("beak", lambda f, i, j, w, h, fi: (214, 150, 50) if j == h - 1 else (240, 178, 64))
    for n in ("fcomb", "fwattle", "mcomb", "mwattle"):
        p.paint(n, flat(red))
    p.paint("wing", feathers(pal["wing"], pal["edge"], "w"))
    p.paint("leg", flat((232, 182, 74)))
    p.paint("toes", flat((222, 170, 64)))
    p.paint("ftail", feathers(pal["tail"], pal["edge"], "t"))
    p.paint("mtail", lambda f, i, j, w, h, fi: (56, 118, 100) if (i + 2 * j) % 4 == 0 else pal["tail"])
    p.paint("mtailtip", lambda f, i, j, w, h, fi: (56, 118, 100) if (i + j) % 3 == 0 else (24, 46, 44))
    cute_eyes(p, "hhead", 1, inset=1, size=2)
    chick, wing = (250, 222, 100), (238, 200, 78)
    p.paint("b_torso", flat(chick))
    p.paint("b_head", flat(chick))
    p.paint("b_beak", flat((240, 150, 60)))
    p.paint("b_wing", flat(wing))
    p.paint("b_leg", flat((238, 156, 60)))
    dot_eyes(p, "b_head", 1, inset=0)
    # blush under the chick's eye
    for f in ("east", "west"):
        x0, y0, w, h = p.face("b_head", f)
        p.px(x0 + (w - 1 if f == "east" else 0), y0 + 1, BLUSH)


# --- Rabbit ------------------------------------------------------------------------

RABBIT = [
    ("body", None, [0, 0, 0], None),
    ("a_torso", "body", [0, 5, 0], [("torso", [-3, 2, -4], [6, 5, 8]), ("rump", [-3.5, 2, 1], [7, 4, 3])]),
    ("a_tail", "a_torso", [0, 5, 4], [("tail", [-1, 4, 4], [2, 2, 2])]),
    ("head", "body", [0, 7, -4], None),
    ("a_head", "head", [0, 7, -4], [("hhead", [-2.5, 5, -8], [5, 4, 5]), ("nose", [-1, 5, -8.5], [2, 1, 1])]),
    ("m_cheeks", "head", [0, 6, -6], [("cheeks", [-3.5, 5, -7], [7, 2, 3])]),
    ("a_ears", "head", [0, 9, -5], [*pair("ear", [0.5, 9, -5], [2, 5, 1])]),
    ("a_leg_fl", "body", [1.5, 2, -3], [("fleg", [1, 0, -4], [1, 2, 1])]),
    ("a_leg_fr", "body", [-1.5, 2, -3], [("fleg", [-2, 0, -4], [1, 2, 1])]),
    ("a_leg_bl", "body", [3, 3, 1], [("hleg", [2, 0, -1], [2, 3, 5])]),
    ("a_leg_br", "body", [-3, 3, 1], [("hleg", [-4, 0, -1], [2, 3, 5])]),
    ("b_torso", "body", [0, 2, 0], [("b_torso", [-2, 1, -2.5], [4, 3, 5])]),
    ("b_tail", "b_torso", [0, 3, 2.5], [("b_tail", [-0.5, 2, 2.5], [1, 1, 1])]),
    ("b_head", "body", [0, 3, -2.5], [("b_head", [-2, 2, -5.5], [4, 4, 4]), *pair("b_ear", [0.5, 6, -3.5], [1, 3, 1])]),
    ("b_leg_fl", "body", [1, 1, -2], [("b_fleg", [0.5, 0, -2.5], [1, 1, 1])]),
    ("b_leg_fr", "body", [-1, 1, -2], [("b_fleg", [-1.5, 0, -2.5], [1, 1, 1])]),
    ("b_leg_bl", "body", [1.5, 1, 1], [("b_hleg", [1, 0, -0.5], [1, 1, 3])]),
    ("b_leg_br", "body", [-1.5, 1, 1], [("b_hleg", [-2, 0, -0.5], [1, 1, 3])]),
]


def rabbit_paint(p, coat):
    base, belly = coat["coat"], coat["belly"]
    variant = coat["variant"]

    def fur(f, i, j, w, h, fi, seed="r"):
        if f == "bottom":
            return belly
        if "patch" in coat and h32(seed, f, i // 2, j // 2) % 3 == 0:
            return coat["patch"]
        if "speckle" in coat and h32(seed, f, i, j) % 3 == 0:
            return coat["speckle"]
        return base
    for n in ("torso", "rump", "hhead", "cheeks", "fleg", "hleg", "b_torso", "b_head", "b_fleg", "b_hleg"):
        p.paint(n, lambda f, i, j, w, h, fi, n=n: fur(f, i, j, w, h, fi, n))
    p.paint("nose", flat((232, 150, 162)))
    inner = base if variant == "black" else (236, 172, 178)
    p.paint("ear", lambda f, i, j, w, h, fi: inner if f == "north" and 0 < j and 0 < i < w else base)
    p.paint("b_ear", lambda f, i, j, w, h, fi: inner if f == "north" and j > 0 else base)
    p.paint("tail", flat((246, 244, 240)))
    p.paint("b_tail", flat((246, 244, 240)))
    rim = (170, 40, 52) if variant == "white" else None
    if rim:
        dot_eyes(p, "hhead", 2, inset=1, size=1, color=rim)
    else:
        cute_eyes(p, "hhead", 1, inset=1, size=2)
    dot_eyes(p, "b_head", 1, inset=1, blush=BLUSH)


# --- Species table -------------------------------------------------------------------

def variants_standard(paint):
    return {v: (lambda p, v=v: paint(p, v)) for v in ("female", "male", "baby")}


SPECIES = {
    "cow": (COW, variants_standard(cow_paint), {"scale_male": 1.15, "scale_female": 1.0}),
    "sheep": (SHEEP, {f"{sex}_{dye}": (lambda p, sex=sex, rgb=rgb: sheep_paint(p, sex, rgb))
                      for sex in ("female", "male", "baby") for dye, rgb in DYES}, {"scale_male": 1.1, "scale_female": 1.0}),
    "goat": (GOAT, variants_standard(goat_paint), {"scale_male": 1.1, "scale_female": 1.0}),
    "pig": (PIG, variants_standard(pig_paint), {"scale_male": 1.1, "scale_female": 1.0}),
    "chicken": (CHICKEN, variants_standard(chicken_paint), {"scale_male": 1.15, "scale_female": 0.95}),
    "rabbit": (RABBIT, {name: (lambda p, c=dict(coat, variant=name): rabbit_paint(p, c)) for name, coat in RABBIT_COATS},
               {"scale_male": 1.0, "scale_female": 1.0}),
}


def build(sid):
    bones, variants, rig = SPECIES[sid]
    bones = autouv(bones)
    out = OUT / sid
    (out / "textures").mkdir(parents=True, exist_ok=True)
    for stale in (out / "textures").glob("*.png"):
        if stale.stem not in variants:
            stale.unlink()
    data = geo(sid, TW, TH, bones, bounds=(2.5, 2.5) if sid in ("cow", "sheep", "goat", "pig") else (1.5, 1.5))
    (out / f"{sid}.geo.json").write_text(json.dumps(data, indent=1) + "\n", encoding="utf8")
    (out / "rig.json").write_text(json.dumps(rig, indent=1) + "\n", encoding="utf8")
    for name, paint in variants.items():
        p = Painter(TW, TH, bones, f"{sid}-{name}")
        paint(p)
        p.save(out / "textures" / f"{name}.png")
    print(f"{sid}: {len(variants)} textures")


if __name__ == "__main__":
    for sid in sys.argv[1:] or list(SPECIES):
        build(sid)
