"""Hand-built M1 animals (cow, sheep, goat, pig, chicken, rabbit), shaped and proportioned like
vanilla's (plain square eyes on the face, vanilla leg lengths), with a separate baby rig.

Bone prefixes (render controller rules, see tools/art/animals.py and tools/gen_art.py):
  a_ adults   b_ babies   m_ adult males   fa_ adult females
  wool_ hidden once sheared (adult wool sits under a_, the lamb's under b_)
  saddle shown when saddled
Bone names are a contract (tools/validate.mjs checks it): the walk animation, the sleep poses and
eyelids (tools/gen_sleep.mjs) and the butcher rack go by them. Cubes are axis-aligned and whole
pixels in size, so box UVs stay exact; curves (horns, tails, combs) are stepped.

Writes art/animals/<id>/{<id>.geo.json, rig.json, textures/<variant>.png}. tools/gen_art.py uses
these in place of its procedural models and keeps writing the client entity, render controller
and walk animation from them. Texture variants and their order come from tools/art/animals.py.

Run: python m1_animals.py [species ...]
Then `npm run generate`, art_src/m4_scripts/butcher_rack.py + tools/art/split_rack_texture.py
(the rack hangs these models) and `npm run generate` again; m1_preview.py draws the sheets.
"""
import json
import sys
from pathlib import Path

from boxuv import Painter, geo, plain_eyes
from bovine import ear_fn, flat, mix

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "art" / "animals"
TW = TH = 128

sys.path.insert(0, str(ROOT / "tools" / "art"))
from animals import DYES, RABBIT_COATS  # noqa: E402

WHITE, BLACK = (255, 255, 255), (0, 0, 0)


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


def legs(prefix, cube, size, x, z_front, z_back, parent="body"):
    """Four legs standing on the ground, `x` out from the middle, pivoting at their tops."""
    w, top, d = size
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


# --- Painting ----------------------------------------------------------------------
# Paint functions are fn(face, i, j, w, h, fi) -> colour (boxuv.Painter.paint, which also bakes
# the light: lit tops, dark undersides, a fade down the sides).

def dims(p, name):
    _, _, w, h = p.face(name, "north")
    _, _, d, _ = p.face(name, "east")
    return w, h, d


def xyz(f, i, j, W, H, D):
    """Centre of a face texel inside its cube: x in from the side the "east" strip is on (the
    cube's smallest x in the game), y down from the top, z back from the front. Lets a marking
    run round the corners of a box."""
    if f == "north":
        return i + .5, j + .5, 0
    if f == "south":
        return W - i - .5, j + .5, D
    if f == "east":
        return 0, j + .5, D - i - .5
    if f == "west":
        return W, j + .5, i + .5
    if f == "top":
        return i + .5, 0, D - j - .5
    return i + .5, H, D - j - .5


def blobs(p, name, shapes, seed, rough=0.22, cell=1):
    """Test for 'inside a marking': the union of ellipsoids (cx, cy, cz, rx, ry, rz) in the
    cube's own space (see xyz), with a ragged edge: `rough` how ragged, `cell` the size of its
    steps in texels (2: a coarser, more natural outline)."""
    W, H, D = dims(p, name)

    def inside(f, i, j):
        x, y, z = xyz(f, i, j, W, H, D)
        wobble = 1.0 + ((h32(seed, f, i // cell, j // cell) % 100) / 100 - 0.5) * rough
        return any(((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 + ((z - cz) / rz) ** 2 < wobble
                   for cx, cy, cz, rx, ry, rz in shapes)
    return inside


def fur(base, back=None, belly=None, seed="", grain=0.05, belly_rows=2, cell=2):
    """A short coat with form: the back's colour on top and bleeding one row down the sides,
    the belly's colour underneath and fading up the last rows, darker box edges, and soft
    two-pixel mottling so no face is a flat fill."""
    back = back or mix(base, BLACK, 0.06)
    belly = belly or mix(base, WHITE, 0.25)

    def fn(f, i, j, w, h, fi):
        if f == "top":
            c = back
        elif f == "bottom":
            c = belly
        else:
            c = base
            if h >= 4:
                if j == 0:
                    c = mix(base, back, 0.6)
                elif j >= h - belly_rows:
                    c = mix(base, belly, 0.8 if j == h - 1 else 0.4)
            if w >= 4 and i in (0, w - 1):
                c = mix(c, BLACK, 0.04)
        r = h32(seed, f, i // cell, (j + (i // cell) % 2) // cell) % 9
        if r == 0:
            c = mix(c, BLACK, grain * 1.4)
        elif r in (1, 2):
            c = mix(c, WHITE, grain)
        elif r == 3:
            c = mix(c, BLACK, grain * 0.6)
        return c
    return fn


def hair(base, dark, belly=None, seed=""):
    """A longer coat (goat): fur() with fine vertical strokes down the sides."""
    inner = fur(base, mix(base, dark, 0.35), belly, seed)

    def fn(f, i, j, w, h, fi):
        c = inner(f, i, j, w, h, fi)
        if f not in ("top", "bottom") and (i * 3 + j // 3 + h32(seed, i) % 2) % 4 == 0:
            c = mix(c, dark, 0.22)
        return c
    return fn


def wool_fn(base, seed):
    """Wool: round two-pixel curls, each lit at its top-left and shaded at its bottom-right."""
    lt, dk, deep = mix(base, WHITE, 0.2), mix(base, BLACK, 0.10), mix(base, BLACK, 0.2)

    def fn(f, i, j, w, h, fi):
        row = j // 2
        ii = i + (row % 2)
        r = h32(seed, f, ii // 2, row) % 5
        a, b = ii % 2, j % 2
        if (a, b) == (0, 0):
            return lt if r else base
        if (a, b) == (1, 1):
            return deep if r == 0 else dk
        return base if r != 1 else dk
    return fn


def stubble(skin, wool, seed):
    """Sheared hide: skin with a faint trace of the fleece in short clipper rows."""
    tint = mix(skin, wool, 0.16)
    inner = fur(skin, mix(skin, BLACK, 0.05), mix(skin, WHITE, 0.2), seed, grain=0.03)

    def fn(f, i, j, w, h, fi):
        c = inner(f, i, j, w, h, fi)
        if f in ("east", "west", "top") and (j % 3 == 1) and h32(seed, f, i // 2, j) % 3:
            return mix(c, tint, 0.7)
        return c
    return fn


def muzzle(base, nostril, mouth=None, nose=None):
    """A muzzle box: nostrils on the second row of its front, an optional nose pad between
    them and a mouth line along the bottom edge."""
    def fn(f, i, j, w, h, fi):
        c = base
        if f == "north":
            if j == min(1, h - 1) and i in (1, w - 2) and w >= 4:
                return nostril
            if nose and j <= 1 and 1 < i < w - 2:
                return nose
            if nose and w < 4 and j == 0 and i == w // 2:
                return nose
            if mouth and j == h - 1 and 0 < i < w - 1:
                return mouth
        elif f in ("east", "west") and mouth and j == h - 1 and fi == 0:
            return mouth
        elif f == "bottom":
            return mix(base, BLACK, 0.08)
        return c
    return fn


def limb(coat, hoof, sock=None, sock_rows=3, hoof_rows=2, seed="leg", inner=None):
    """A leg: coat with the same mottling as the body, an optional sock, a dark hoof with a
    lighter rim on top."""
    body = fur(coat, coat, coat, seed, grain=0.04)

    def fn(f, i, j, w, h, fi):
        if f == "bottom":
            return hoof
        if f == "top":
            return coat
        if j >= h - hoof_rows:
            return mix(hoof, WHITE, 0.12) if j == h - hoof_rows else hoof
        if sock and j >= h - hoof_rows - sock_rows:
            return sock if j > h - hoof_rows - sock_rows or (i + fi) % 2 else mix(coat, sock, 0.5)
        c = body(f, i, j, w, h, fi)
        return mix(c, BLACK, 0.05) if j >= h - hoof_rows - 2 and not sock else c
    return fn


def horn(base, tip, ridges=True, grow="y"):
    """Horn: ridged along its length, darkening toward the tip (the far end along `grow`:
    'y' up, 'x' out, 'z' back, '-y' down, '-z' forward)."""
    ridge = mix(base, BLACK, 0.14)

    def fn(f, i, j, w, h, fi):
        if grow == "y":
            t = 1 - (j + .5) / h if f not in ("top", "bottom") else (1 if f == "top" else 0)
            band = j
        elif grow == "-y":
            t = (j + .5) / h if f not in ("top", "bottom") else (0 if f == "top" else 1)
            band = j
        elif grow in ("z", "-z"):
            if f in ("east", "west"):
                t, band = (fi + .5) / w, fi
            elif f in ("top", "bottom"):
                t, band = 1 - (j + .5) / h, j
            else:
                t, band = (1 if f == "south" else 0), 1
            if grow == "-z":
                t = 1 - t
        else:  # x: away from the head on either side
            t = abs((i + .5) / w - 0.5) * 2 if f in ("north", "south", "top", "bottom") else 1
            band = i
        c = mix(base, tip, max(0.0, min(1.0, t)) * 0.8)
        return mix(c, ridge, 0.5) if ridges and band % 2 == 1 else c
    return fn


PUPIL, EYE_WHITE = (26, 22, 26), (238, 236, 232)  # boxuv.plain_eyes
PUPIL_TOL, WHITE_TOL = 10, 6                       # tools/gen_sleep.mjs isPupil / isWhite


def eyes(p, cube, row, color=None):
    """Vanilla-style eyes on a head's front face (boxuv.plain_eyes). tools/gen_sleep.mjs finds the
    eyes again by their colours (within PUPIL_TOL of the pupil, WHITE_TOL of the white) to lay the
    closed lids over them, so first every other pixel of this cube's front face is moved out of
    both ranges: a near-black pixel gets its red raised past the pupil's range, a near-white one
    its blue lowered past the white's. Other cubes on the head (a muzzle) are not touched; their
    colours must stay clear of both on their own."""
    x0, y0, w, h = p.face(cube, "north")
    for y in range(y0, y0 + h):
        for x in range(x0, x0 + w):
            c = p.img.getpixel((x, y))[:3]
            if all(abs(a - b) <= PUPIL_TOL for a, b in zip(c, PUPIL)):
                p.px(x, y, (PUPIL[0] + PUPIL_TOL + 4, c[1], c[2]))
            elif all(abs(a - b) <= WHITE_TOL for a, b in zip(c, EYE_WHITE)):
                p.px(x, y, (c[0], c[1], EYE_WHITE[2] - WHITE_TOL - 4))
    plain_eyes(p, cube, row, **({"color": color} if color else {}))


# --- Cow ---------------------------------------------------------------------------

COW = [
    ("body", None, [0, 0, 0], None),
    ("a_torso", "body", [0, 17, 0], [("torso", [-6, 12, -9], [12, 10, 18])]),
    ("fa_udder", "a_torso", [0, 12, 3], [("udder", [-2, 10, 1], [4, 2, 5]), *pair("teat", [1, 9, 2], [1, 1, 1])]),
    ("a_tail", "a_torso", [0, 21, 9], [("tail", [-0.5, 13, 9], [1, 8, 1]), ("tuft", [-1, 11, 8.5], [2, 3, 2])]),
    ("head", "body", [0, 20, -9], None),
    ("a_head", "head", [0, 20, -9], [
        ("skull", [-4, 16, -15], [8, 8, 6]),
        ("muzzle", [-3.5, 16, -16], [7, 3, 1]),    # a broad, low muzzle across the bottom of the face
        *pair("ear", [4, 20, -12], [3, 2, 1]),
    ]),
    # horns leave the poll sideways, then turn up, the tips leaning forward
    ("fa_horns", "head", [0, 23, -12], [*pair("fhorn", [4, 22, -13], [2, 1, 1]), *pair("fhorntip", [5, 23, -13], [1, 1, 1])]),
    ("m_horns", "head", [0, 23, -12], [
        *pair("horn", [4, 22, -13], [2, 2, 2]),
        *pair("hornmid", [6, 23, -13], [1, 2, 2]),
        *pair("horntip", [6, 25, -13], [1, 1, 1]),
    ]),
    *legs("a_", "leg", [4, 12, 4], 2, -8, 4),
    ("b_torso", "body", [0, 11, 0], [("b_torso", [-4, 8, -6], [8, 6, 12])]),
    ("b_tail", "b_torso", [0, 13, 6], [("b_tail", [-0.5, 9, 6], [1, 4, 1])]),
    ("b_head", "body", [0, 13, -6], [
        ("b_skull", [-3, 11, -11], [6, 6, 5]),
        ("b_muzzle", [-2.5, 11, -12], [5, 2, 1]),
        *pair("b_ear", [3, 14, -9], [2, 2, 1]),
    ]),
    *legs("b_", "b_leg", [3, 8, 3], 1, -5, 2),
]

# white patches, in the torso's own space (12 wide, 10 high, 18 long): see blobs()
# Uneven in size and spacing, as on a real pied cow: one large saddle, a few smaller patches
# and splashes, the white belly showing low on the flanks.
COW_PATCHES = {
    "female": [(3, 0, 8, 6, 4.5, 4.5), (10, 2, 10, 2.5, 3, 3), (12, 6, 3, 2.5, 3.5, 3), (9, 0, 16.5, 4, 4, 3),
               (6, 10, 9, 5.5, 2.4, 7.5), (0, 7, 14, 2, 3, 2.5), (1, 4, 2.5, 1.5, 1.8, 1.6)],
    "male": [(7.5, 0, 11, 5.5, 4, 4.5), (0, 4.5, 5, 2.5, 3.5, 3.5), (3, 0, 0.5, 3.5, 3, 2.5), (6, 10, 8, 4.5, 2, 6),
             (12, 7, 15.5, 2, 3, 3), (12, 2, 6, 1.5, 1.6, 1.8)],
    "baby": [(3, 0, 6, 3.5, 3, 3.5), (8, 4, 12, 2.5, 3, 2.5), (4, 6, 5, 3.5, 1.8, 4), (8, 1.5, 1, 2, 2, 1.8), (0, 2, 9, 1.5, 1.5, 1.5)],
}


def cow_paint(p, sex):
    adult = sex if sex != "baby" else "female"
    coat = {"female": (112, 70, 46), "male": (70, 44, 32)}[adult]
    back, white = mix(coat, BLACK, 0.12), (240, 236, 228)
    pink, hoof = (232, 180, 172), (46, 36, 30)
    coat_fn, white_fn = fur(coat, back, mix(coat, WHITE, 0.12), "cow"), fur(white, white, (226, 220, 210), "coww", grain=0.03)
    patch = blobs(p, "torso", COW_PATCHES[adult], "cow", rough=0.5, cell=2)
    p.paint("torso", lambda f, i, j, w, h, fi: (white_fn if patch(f, i, j) else coat_fn)(f, i, j, w, h, fi))
    p.paint("udder", lambda f, i, j, w, h, fi: mix(pink, (200, 130, 130), 0.3) if f != "bottom" and j == h - 1 else pink)
    p.paint("teat", flat((214, 136, 140)))
    p.paint("tail", lambda f, i, j, w, h, fi: coat if j < h - 1 else back)
    p.paint("tuft", fur((52, 38, 30), (44, 32, 26), (60, 44, 36), "tuft"))

    def skull(f, i, j, w, h, fi):
        mid = abs(i - (w - 1) / 2)
        if f == "north" and (mid < 1 or (j >= h - 3 and mid < 2) or (j == 0 and mid < 2)):
            return white  # blaze: a star on the forehead running down to the muzzle
        if f == "top" and mid < (2 if j >= h - 2 else 1):
            return white
        return coat_fn(f, i, j, w, h, fi)
    p.paint("skull", skull)
    # the muzzle: pale hair round a moist nose pad, flesh-coloured on the cow, dark on the bull
    pad = (196, 150, 140) if adult == "female" else (80, 66, 64)
    nostril = (128, 86, 80) if adult == "female" else (54, 40, 40)  # clear of the eye's black
    lip = (224, 212, 202)

    def cow_muzzle(f, i, j, w, h, fi):
        if f == "north":
            if j == 0:
                return nostril if i in (1, w - 2) else (pad if 1 < i < w - 2 else lip)
            if j == h - 1 and 0 < i < w - 1:
                return mix(lip, pad, 0.45)  # mouth line
            return lip
        if f == "top":
            return mix(lip, pad, 0.3) if 1 < i < w - 2 and j == h - 1 else lip
        if f == "bottom":
            return mix(lip, BLACK, 0.1)
        return mix(lip, coat, 0.35) if fi > 0 else lip
    p.paint("muzzle", cow_muzzle)
    p.paint("ear", ear_fn(coat, (226, 164, 156)))
    ivory, tip = (236, 226, 200), (96, 82, 66)
    p.paint("fhorn", horn(ivory, mix(ivory, tip, 0.3), False, "x"))
    p.paint("fhorntip", flat(mix(ivory, tip, 0.6)))
    p.paint("horn", horn(ivory, ivory, True, "x"))
    p.paint("hornmid", horn(ivory, mix(ivory, tip, 0.6), True, "y"))
    p.paint("horntip", flat(tip))
    p.paint("leg", limb(coat, hoof, white, sock_rows=3, seed="cowleg"))
    eyes(p, "skull", 3)
    # calf: light tan, white socks and star, a flesh-coloured nose
    calf = (180, 128, 88)
    calf_fn = fur(calf, mix(calf, BLACK, 0.1), mix(calf, WHITE, 0.3), "calf")
    cpatch = blobs(p, "b_torso", COW_PATCHES["baby"], "calf", rough=0.5, cell=2)
    p.paint("b_torso", lambda f, i, j, w, h, fi: (white_fn if cpatch(f, i, j) else calf_fn)(f, i, j, w, h, fi))
    p.paint("b_tail", lambda f, i, j, w, h, fi: calf if j < h - 1 else mix(calf, BLACK, 0.3))

    def b_skull(f, i, j, w, h, fi):
        mid = abs(i - (w - 1) / 2)
        if (f == "north" and (mid < 1 or (j >= h - 2 and mid < 2))) or (f == "top" and mid < 1 and j >= h - 2):
            return white
        return calf_fn(f, i, j, w, h, fi)
    p.paint("b_skull", b_skull)
    calf_lip, calf_pad = (230, 216, 204), (206, 164, 150)
    p.paint("b_muzzle", lambda f, i, j, w, h, fi: (
        ((150, 104, 96) if i in (1, w - 2) else (calf_pad if 1 < i < w - 2 else calf_lip)) if f == "north" and j == 0
        else mix(calf_lip, calf_pad, 0.4) if f == "north" and j == h - 1 and 0 < i < w - 1
        else mix(calf_lip, calf, 0.35) if f in ("east", "west") and fi > 0 else calf_lip))
    p.paint("b_ear", ear_fn(calf, (240, 180, 172)))
    p.paint("b_leg", limb(calf, (90, 70, 60), white, sock_rows=2, seed="calfleg"))
    eyes(p, "b_skull", 2)


# --- Sheep face ----------------------------------------------------------------------
# A sheep's face is all of a piece, as in vanilla: the muzzle is a one-pixel step in the
# face's own colour (a shade darker), with a small dark nose and a mouth line. Pink belongs
# to the pig's snout only. (The goat has its own long, dark-bridged muzzle: goat_paint.)

SHEEP_NOSE = (92, 74, 70)   # dark grey-brown


def ruminant_muzzle(face, nose, stripe=None):
    base = mix(face, (120, 96, 84), 0.12)
    mouth = mix(base, nose, 0.45)

    def fn(f, i, j, w, h, fi):
        mid = abs(i - (w - 1) / 2)
        if f == "north":
            if j == 0 and mid < 1:
                return nose                      # the nose: one or two pixels at the top
            if j == h - 1 and mid < 1:
                return mouth                     # the mouth under it
            return base
        if f == "top":
            return stripe if stripe and mid < 1 else base
        if f == "bottom":
            return mix(base, BLACK, 0.08)
        return base
    return fn


# --- Sheep -------------------------------------------------------------------------

def wool_cuffs(prefix="a_"):
    """Wool on the upper legs, hidden with the rest of the fleece once sheared."""
    out = []
    for tag, sx, z in (("fl", 1, -7), ("fr", -1, -7), ("bl", 1, 4), ("br", -1, 4)):
        ox = 0.5 if sx > 0 else -4.5
        out.append((f"wool_leg_{tag}", f"{prefix}leg_{tag}", [ox + 2, 12, z + 1.5], [("woolcuff", [ox, 7, z - 0.5], [4, 5, 4])]))
    return out


SHEEP = [
    ("body", None, [0, 0, 0], None),
    ("a_torso", "body", [0, 16, 0], [("skin", [-4, 12, -8], [8, 6, 16])]),
    # the fleece wraps the whole trunk, rounded off by a lump along the back and pads on the chest and rump
    ("wool_body", "a_torso", [0, 16, 0], [
        ("wool", [-5.5, 11, -9], [11, 9, 18]),
        ("woolback", [-4.5, 20, -8], [9, 1, 16]),
        ("woolchest", [-4.5, 12, -10], [9, 7, 1]),
        ("woolrump", [-4.5, 12, 9], [9, 7, 1]),
    ]),
    ("wool_tail", "a_torso", [0, 16, 10], [("wooltail", [-1.5, 14, 10], [3, 4, 1])]),
    ("head", "body", [0, 18, -9], None),
    ("a_head", "head", [0, 18, -9], [
        ("face", [-3, 14, -15], [6, 6, 6]),
        ("nose", [-2, 14, -16], [4, 3, 1]),          # the muzzle: one pixel proud of the face, in the face's colour
        *pair("ear", [3, 17, -12], [2, 1, 2]),
    ]),
    ("wool_head", "a_head", [0, 19, -11], [("woolcap", [-3.5, 18, -13], [7, 3, 5])]),
    # a ram's horns: heavy spirals that leave the poll, curl back, down and forward round
    # the ears, the tips turning out beside the cheeks
    ("m_horns", "head", [0, 18, -11], [
        *pair("horn", [3.5, 18, -13], [3, 3, 4]),
        *pair("hornback", [3.5, 14, -10], [3, 5, 3]),
        *pair("horncurl", [3.5, 13, -14], [3, 3, 4]),
        *pair("horntip", [4.5, 14, -15], [2, 2, 1]),
    ]),
    *legs("a_", "leg", [3, 12, 3], 1, -7, 4),
    *wool_cuffs(),
    # lamb: a wool ball on long legs
    ("b_torso", "body", [0, 10, 0], [("b_skin", [-3, 8, -5], [6, 4, 10])]),
    ("wool_lamb", "b_torso", [0, 10, 0], [
        ("b_wool", [-4, 7, -5.5], [8, 6, 11]),
        ("b_woolback", [-3, 13, -4.5], [6, 1, 9]),
        ("b_wooltail", [-1, 9, 5.5], [2, 2, 1]),
    ]),
    ("b_head", "body", [0, 12, -5], [
        ("b_face", [-2.5, 10, -9], [5, 5, 4]),
        ("b_nose", [-1.5, 10, -10], [3, 2, 1]),     # one pixel proud, face-coloured
        *pair("b_ear", [2.5, 12, -7], [2, 1, 1]),
        ("b_cap", [-3, 13, -8.5], [6, 2, 4]),
    ]),
    *legs("b_", "b_leg", [2, 8, 2], 1, -4, 2),
]


def sheep_paint(p, sex, wool):
    skin = {"female": (232, 214, 194), "male": (214, 194, 172), "baby": (240, 226, 210)}[sex]
    face = {"female": (238, 224, 206), "male": (222, 204, 184), "baby": (244, 232, 218)}[sex]
    shade = mix(face, (150, 120, 104), 0.25)
    p.paint("skin", stubble(skin, wool, "skin"))
    for n in ("wool", "woolback", "woolchest", "woolrump", "wooltail", "woolcap", "woolcuff"):
        p.paint(n, wool_fn(wool, n))
    face_fn = fur(face, face, shade, "face", grain=0.03, belly_rows=1)
    p.paint("face", face_fn)
    p.paint("nose", ruminant_muzzle(face, SHEEP_NOSE))
    p.paint("ear", ear_fn(mix(face, (150, 120, 104), 0.12), mix(face, (150, 120, 104), 0.3)))
    ivory, deep = (196, 176, 138), (112, 92, 68)
    p.paint("horn", horn(ivory, mix(ivory, deep, 0.3), True, "z"))
    p.paint("hornback", horn(mix(ivory, deep, 0.3), mix(ivory, deep, 0.6), True, "-y"))
    p.paint("horncurl", horn(mix(ivory, deep, 0.6), deep, True, "-z"))
    p.paint("horntip", flat(mix(deep, BLACK, 0.1)))
    p.paint("leg", limb(face, (62, 50, 44), seed="sheepleg"))
    eyes(p, "face", 2)
    lamb, fleece = (246, 234, 220), mix(wool, WHITE, 0.2)
    p.paint("b_skin", fur(lamb, lamb, lamb, "lamb", grain=0.03))
    for n in ("b_wool", "b_woolback", "b_wooltail", "b_cap"):
        p.paint(n, wool_fn(fleece, n))
    p.paint("b_face", fur(lamb, lamb, mix(lamb, (190, 150, 140), 0.2), "lambf", grain=0.03, belly_rows=1))
    p.paint("b_nose", ruminant_muzzle(lamb, SHEEP_NOSE))
    p.paint("b_ear", ear_fn(lamb, mix(lamb, (150, 120, 104), 0.22)))
    p.paint("b_leg", limb(lamb, (110, 92, 80), hoof_rows=1, seed="lambleg"))
    eyes(p, "b_face", 1)


# --- Goat --------------------------------------------------------------------------

GOAT = [
    ("body", None, [0, 0, 0], None),
    # leaner and deeper than a sheep: a narrow, deep barrel on slim legs; the head is carried
    # a little low (BONE_ROTATION), not held up like a deer's
    ("a_torso", "body", [0, 15, 0], [("torso", [-3.5, 11, -8], [7, 8, 15])]),
    ("fa_udder", "a_torso", [0, 11, 3], [("udder", [-1.5, 9, 2], [3, 2, 4])]),
    # the tail is carried up like a flag: a stub out of the rump, then its tip pointing up
    ("a_tail", "a_torso", [0, 19, 7], [("tail", [-1, 18, 7], [2, 1, 1]), ("tailtip", [-1, 19, 7], [2, 2, 1])]),
    ("head", "body", [0, 19, -8], None),
    ("a_head", "head", [0, 19, -8], [
        ("skull", [-2.5, 16, -14], [5, 5, 6]),        # a narrow, long face...
        ("muzzle", [-1.5, 16, -16], [3, 3, 2]),       # ...running out to a narrow muzzle
        *pair("ear", [2.5, 18, -11], [3, 1, 2]),       # ears held out sideways
    ]),
    # horns rise from the poll and sweep back; the nanny's are short
    ("fa_horns", "head", [0, 21, -10], [*pair("fhorn", [1, 21, -11], [1, 2, 2]), *pair("fhorntip", [1, 22, -9], [1, 1, 1])]),
    ("m_horns", "head", [0, 21, -10], [
        *pair("mhorn", [1, 21, -11], [1, 3, 2]),
        *pair("mhornmid", [1, 23, -9], [1, 2, 3]),
        *pair("mhorntip", [1, 22, -6], [1, 2, 1]),
    ]),
    # the beard under the chin: a tuft on the nanny, a long one on the billy
    ("fa_beard", "head", [0, 16, -15], [("fbeard", [-0.5, 14, -15.5], [1, 2, 1])]),
    ("m_beard", "head", [0, 16, -15], [("beard", [-1, 12, -15.5], [2, 4, 1])]),
    *legs("a_", "leg", [2, 11, 2], 1, -7, 4),
    # kid: long slim legs, a short body, the tail already up
    ("b_torso", "body", [0, 10, 0], [("b_torso", [-2.5, 8, -5], [5, 4, 9])]),
    ("b_tail", "b_torso", [0, 12, 4], [("b_tail", [-0.5, 12, 3.5], [1, 2, 1])]),
    ("b_head", "body", [0, 12, -5], [
        ("b_skull", [-2, 11, -9], [4, 4, 4]),
        ("b_muzzle", [-1, 11, -11], [2, 2, 2]),
        *pair("b_ear", [2, 13, -7], [2, 1, 1]),
        *pair("b_bud", [0.5, 15, -7], [1, 1, 1]),
    ]),
    *legs("b_", "b_leg", [2, 8, 2], 0.5, -4, 2),
]


def goat_paint(p, sex):
    """A brown goat with black points (dorsal stripe, face, beard, lower legs): nothing like
    the cream of a shorn sheep. The billy darker, the kid lighter."""
    coat = {"female": (170, 122, 82), "male": (122, 84, 58), "baby": (190, 146, 104)}[sex]
    black = (54, 42, 36)
    belly = mix(coat, (236, 220, 196), 0.45)
    body = hair(coat, mix(coat, BLACK, 0.4), belly, "goat")

    def torso(f, i, j, w, h, fi):
        if f == "top" and abs(i - (w - 1) / 2) < 1:
            return black  # dorsal stripe
        return body(f, i, j, w, h, fi)
    p.paint("torso", torso)
    p.paint("udder", lambda f, i, j, w, h, fi: (196, 150, 140) if f != "bottom" and j == h - 1 else (214, 172, 160))
    p.paint("tail", lambda f, i, j, w, h, fi: black if f in ("top", "south") else coat)
    p.paint("tailtip", flat(black))
    head = fur(coat, mix(coat, BLACK, 0.2), belly, "goathead", grain=0.04, belly_rows=1)

    def skull(f, i, j, w, h, fi):
        if f == "north":
            return coat  # plain round the eyes: only the eyes may come near their colours
        if f == "top" and abs(i - (w - 1) / 2) < 1:
            return black
        return head(f, i, j, w, h, fi)
    p.paint("skull", skull)

    pale = mix(coat, (236, 220, 196), 0.3)

    def muzzle_fn(f, i, j, w, h, fi):
        if f == "north":
            if j == 0:
                return (44, 34, 32) if i in (0, w - 1) else black  # dark nose, nostrils clear of the eye's black
            return mix(pale, black, 0.5) if j == h - 1 else pale  # pale lips, a mouth line
        if f == "top":
            return black  # the dark bridge of the nose
        if f in ("east", "west"):
            return black if j == 0 else pale  # the dark face stripe running down to the nose
        return mix(pale, black, 0.2)
    p.paint("muzzle", muzzle_fn)
    p.paint("ear", ear_fn(coat, mix(coat, black, 0.6)))
    hbase, htip = (132, 116, 94), (62, 52, 44)
    p.paint("fhorn", horn(hbase, mix(hbase, htip, 0.5), True, "y"))
    p.paint("fhorntip", flat(mix(hbase, htip, 0.8)))
    p.paint("mhorn", horn(hbase, mix(hbase, htip, 0.3), True, "y"))
    p.paint("mhornmid", horn(mix(hbase, htip, 0.3), mix(hbase, htip, 0.7), True, "z"))
    p.paint("mhorntip", flat(htip))
    p.paint("fbeard", lambda f, i, j, w, h, fi: mix(black, coat, 0.2 * (j % 2)))
    p.paint("beard", lambda f, i, j, w, h, fi: mix(black, coat, 0.25 * ((i + j) % 2)))
    p.paint("leg", limb(coat, (40, 32, 28), sock=black, sock_rows=5, seed="goatleg"))
    eyes(p, "skull", 1)
    kid, kblack = (196, 152, 110), (92, 70, 56)
    kid_fn = fur(kid, mix(kid, kblack, 0.3), mix(kid, WHITE, 0.4), "kid", grain=0.03)
    p.paint("b_torso", lambda f, i, j, w, h, fi: kblack if f == "top" and abs(i - (w - 1) / 2) < 1 else kid_fn(f, i, j, w, h, fi))
    p.paint("b_tail", flat(kblack))
    p.paint("b_skull", lambda f, i, j, w, h, fi: kid if f == "north" else kid_fn(f, i, j, w, h, fi))
    p.paint("b_muzzle", lambda f, i, j, w, h, fi: (64, 50, 44) if f == "north" and j == 0 else (kblack if f in ("top", "east", "west") else mix(kid, kblack, 0.5)))
    p.paint("b_ear", ear_fn(kid, mix(kid, kblack, 0.6)))
    p.paint("b_bud", flat((176, 160, 136)))
    p.paint("b_leg", limb(kid, (70, 56, 48), sock=kblack, sock_rows=3, hoof_rows=1, seed="kidleg"))
    eyes(p, "b_skull", 1)


# --- Pig ---------------------------------------------------------------------------

PIG = [
    ("body", None, [0, 0, 0], None),
    ("a_torso", "body", [0, 10, 0], [("torso", [-5, 6, -8], [10, 8, 16])]),
    ("a_tail", "a_torso", [0, 12, 8], [("tail", [-0.5, 11, 8], [1, 1, 2]), ("tailcurl", [-0.5, 12, 9], [1, 1, 1])]),
    ("saddle", "a_torso", [0, 14, 0], [("saddle", [-5.5, 14, -4], [11, 1, 8]), *pair("strap", [5, 9, -1], [1, 5, 1])]),
    ("head", "body", [0, 12, -8], None),
    ("a_head", "head", [0, 12, -8], [
        ("skull", [-4, 7, -14], [8, 7, 6]),
        ("snout", [-2, 8, -16], [4, 3, 2]),
        *pair("ear", [2, 13, -13], [3, 2, 1]),
    ]),
    ("m_tusks", "head", [0, 8, -16], [*pair("tusk", [2, 8, -16], [1, 2, 1])]),
    *legs("a_", "leg", [4, 6, 4], 1, -7, 3),
    ("b_torso", "body", [0, 6, 0], [("b_torso", [-3, 3, -5], [6, 5, 10])]),
    ("b_tail", "b_torso", [0, 7, 5], [("b_tail", [-0.5, 7, 5], [1, 1, 1])]),
    ("b_head", "body", [0, 7, -5], [
        ("b_skull", [-3, 3, -9], [6, 6, 4]),
        ("b_snout", [-1.5, 4, -10], [3, 2, 1]),
        *pair("b_ear", [1.5, 8, -8], [2, 2, 1]),
    ]),
    *legs("b_", "b_leg", [2, 3, 2], 1, -4, 2),
]


def pig_paint(p, sex):
    skin = {"female": (240, 168, 164), "male": (214, 142, 136), "baby": (240, 168, 164)}[sex]
    deep = mix(skin, (150, 76, 80), 0.3)
    back, belly = mix(skin, (150, 76, 80), 0.1), mix(skin, (255, 226, 214), 0.5)
    body = fur(skin, back, belly, "pig", grain=0.04)

    def hide(f, i, j, w, h, fi):
        c = body(f, i, j, w, h, fi)
        if sex == "male" and f == "top" and abs(i - (w - 1) / 2) < 1:
            return mix(c, (110, 64, 60), 0.45 if (i + j) % 2 else 0.3)  # crest of dark bristles down the spine
        if sex == "male" and f != "bottom" and h32("br", f, i, j // 2) % 6 == 0:
            return mix(c, (110, 64, 60), 0.3 if f == "top" else 0.18)  # bristles
        return c
    p.paint("torso", hide)
    p.paint("tail", flat(deep))
    p.paint("tailcurl", flat(mix(deep, BLACK, 0.1)))
    p.paint("saddle", lambda f, i, j, w, h, fi: (92, 52, 28) if f == "top" and i % 3 == 0 else (118, 68, 36))
    p.paint("strap", flat((60, 40, 26)))

    def skull(f, i, j, w, h, fi):
        if f == "north" and j == h - 1:
            return mix(skin, belly, 0.7)  # pale chin
        return hide(f, i, j, w, h, fi)
    p.paint("skull", skull)
    disc = mix(skin, (236, 130, 134), 0.55)

    def snout(f, i, j, w, h, fi):
        if f == "north":
            if j == 1 and i in (1, 2):
                return (136, 66, 70)  # nostrils
            return mix(disc, WHITE, 0.18) if j == 0 else disc
        if f == "bottom":
            return deep
        return mix(disc, deep, 0.35) if fi == 0 else mix(skin, deep, 0.3)
    p.paint("snout", snout)
    p.paint("ear", lambda f, i, j, w, h, fi: mix(deep, (255, 200, 196), 0.25) if f == "north" and 0 < i < w - 1 and j > 0 else mix(skin, deep, 0.35))
    p.paint("tusk", lambda f, i, j, w, h, fi: (250, 244, 226) if j == 0 else (226, 214, 188))
    p.paint("leg", limb(skin, mix(deep, (90, 50, 50), 0.5), hoof_rows=1, seed="pigleg"))
    eyes(p, "skull", 2)
    pig = (248, 196, 192)
    pdeep = mix(pig, (170, 96, 100), 0.3)
    piglet = fur(pig, mix(pig, pdeep, 0.3), mix(pig, WHITE, 0.4), "piglet", grain=0.03)
    p.paint("b_torso", piglet)
    p.paint("b_tail", flat(pdeep))
    p.paint("b_skull", piglet)
    p.paint("b_snout", lambda f, i, j, w, h, fi: (176, 96, 100) if f == "north" and j == 1 and i != 1 else (244, 164, 164))
    p.paint("b_ear", lambda f, i, j, w, h, fi: mix(pig, pdeep, 0.5))
    p.paint("b_leg", limb(pig, pdeep, hoof_rows=1, seed="pigletleg"))
    eyes(p, "b_skull", 2)


# --- Chicken -----------------------------------------------------------------------

def foot(side):
    """Three toes: the middle one long, the outer two shorter and set back."""
    cubes = [("leg", [1, 0, -1], [1, 4, 1]), ("toe", [1, 0, -3], [1, 1, 2]),
             ("claw", [0, 0, -2], [1, 1, 1]), ("claw", [2, 0, -2], [1, 1, 1])]
    if side < 0:
        cubes = [(n, mirror(o, s), s) for n, o, s in cubes]
    return cubes


CHICKEN = [
    ("body", None, [0, 0, 0], None),
    ("a_torso", "body", [0, 7, 0], [("torso", [-3, 4, -4], [6, 6, 8]), ("breast", [-2.5, 5, -5], [5, 4, 1])]),
    ("head", "body", [0, 10, -4], None),
    ("a_head", "head", [0, 10, -4], [
        ("hhead", [-2, 9, -7], [4, 5, 4]),
        ("beak", [-1, 12, -9], [2, 1, 2]),
        ("beaklow", [-1, 11, -8], [2, 1, 1]),
    ]),
    # combs are saw-toothed, wattles hang in a pair under the beak
    ("fa_comb", "head", [0, 14, -5], [("fcomb", [-0.5, 14, -6.5], [1, 1, 3]), ("fcombtip", [-0.5, 15, -6], [1, 1, 1])]),
    ("fa_wattle", "head", [0, 10, -8], [*pair("fwattle", [0.25, 10, -8], [1, 1, 1])]),
    ("m_comb", "head", [0, 14, -5], [
        ("mcomb", [-0.5, 14, -7.5], [1, 1, 5]),
        ("mcombtip", [-0.5, 15, -7.5], [1, 1, 1]),
        ("mcombtall", [-0.5, 15, -6], [1, 2, 1]),
        ("mcombtall", [-0.5, 15, -4.5], [1, 2, 1]),
        ("mcombtip", [-0.5, 15, -3.5], [1, 1, 1]),
    ]),
    ("m_wattle", "head", [0, 10, -8], [*pair("mwattle", [0.25, 9, -8], [1, 2, 1])]),
    ("a_wing_left", "body", [3, 9, 0], [("wing", [3, 5, -3], [1, 4, 6]), ("wingtip", [3, 6, 3], [1, 2, 2])]),
    ("a_wing_right", "body", [-3, 9, 0], [("wing", [-4, 5, -3], [1, 4, 6]), ("wingtip", [-4, 6, 3], [1, 2, 2])]),
    ("a_leg_left", "body", [1.5, 4, 0], foot(1)),
    ("a_leg_right", "body", [-1.5, 4, 0], foot(-1)),
    # tails step up and back: a short fan for the hen, a tall arching sickle for the rooster
    ("fa_tail", "a_torso", [0, 9, 4], [("ftail", [-2, 7, 4], [4, 3, 1]), ("ftailmid", [-1.5, 9, 5], [3, 2, 1]), ("ftailtip", [-1, 10, 6], [2, 2, 1])]),
    ("m_tail", "a_torso", [0, 9, 4], [
        ("mtail", [-1, 7, 4], [2, 5, 2]),
        ("mtailmid", [-1, 10, 6], [2, 5, 2]),
        ("mtaildroop", [-0.5, 9, 8], [1, 6, 1]),
        ("mtailtip", [-0.5, 7, 9], [1, 4, 1]),
    ]),
    # chick: a round fuzzball
    ("b_torso", "body", [0, 3, 0], [("b_torso", [-2, 1, -2.5], [4, 4, 5])]),
    ("b_head", "body", [0, 5, -2], [("b_head", [-1.5, 4, -4.5], [3, 3, 3]), ("b_beak", [-0.5, 5, -5.5], [1, 1, 1])]),
    ("b_wing_left", "body", [2, 4, 0], [("b_wing", [2, 2, -1.5], [1, 2, 3])]),
    ("b_wing_right", "body", [-2, 4, 0], [("b_wing", [-3, 2, -1.5], [1, 2, 3])]),
    ("b_leg_left", "body", [1, 1, 0], [("b_leg", [0.5, 0, -0.5], [1, 1, 1])]),
    ("b_leg_right", "body", [-1, 1, 0], [("b_leg", [-1.5, 0, -0.5], [1, 1, 1])]),
]


def plumage(base, shaft, fringe, seed):
    """Overlapping feathers in rows of three-pixel scallops: a pale fringe under each feather,
    a darker shaft down its middle."""
    def fn(f, i, j, w, h, fi):
        if f == "bottom":
            return mix(base, WHITE, 0.15)
        row = j // 2
        k = (i + row % 2 * 2 + h32(seed, f) % 3) % 3
        if j % 2 == 1:
            return fringe if k != 1 else base
        return shaft if k == 1 and h32(seed, f, i, row) % 4 else base
    return fn


def chicken_paint(p, sex):
    s = "female" if sex == "baby" else sex
    red, red_dk = (212, 50, 42), (160, 30, 30)
    gold, gold_dk = (238, 180, 66), (196, 132, 40)
    if s == "female":
        body, shaft, fringe = (238, 228, 208), (216, 200, 172), (250, 244, 230)
        p.paint("torso", plumage(body, shaft, fringe, "hen"))
        p.paint("breast", plumage(mix(body, WHITE, 0.3), shaft, fringe, "henb"))
        p.paint("hhead", fur((246, 238, 222), (246, 238, 222), body, "henh", grain=0.03, belly_rows=1))
        p.paint("wing", plumage((214, 196, 162), (180, 158, 120), (234, 220, 192), "henw"))
        p.paint("wingtip", flat((176, 152, 112)))
        for n, c in (("ftail", (206, 184, 144)), ("ftailmid", (188, 162, 120)), ("ftailtip", (164, 136, 96))):
            p.paint(n, lambda f, i, j, w, h, fi, c=c: mix(c, BLACK, 0.14) if i % 2 else c)
    else:
        body, shaft, fringe = (150, 66, 36), (104, 42, 24), (188, 96, 44)
        hackle, hackle_dk = (226, 150, 50), (190, 104, 34)

        def torso(f, i, j, w, h, fi):
            # golden hackle feathers hang off the neck over the front of the body
            if f in ("east", "west", "top") and fi <= 2 - (j // 2 if f != "top" else 0):
                return hackle_dk if (i + j) % 2 else hackle
            if f == "north":
                return hackle_dk if j < 2 and i % 2 else (hackle if j < 2 else body)
            if f == "south":
                return (38, 62, 56)
            return plumage(body, shaft, fringe, "roo")(f, i, j, w, h, fi)
        p.paint("torso", torso)
        p.paint("breast", plumage((116, 50, 30), (84, 34, 22), (150, 66, 36), "roob"))
        p.paint("hhead", lambda f, i, j, w, h, fi: hackle_dk if (j >= h - 2 and (i + j) % 2 and f != "north") else hackle)
        teal, teal_dk, sheen = (44, 84, 74), (26, 50, 48), (70, 136, 112)
        p.paint("wing", lambda f, i, j, w, h, fi: (body if j == 0 else plumage(teal, teal_dk, sheen, "roow")(f, i, j, w, h, fi)))
        p.paint("wingtip", flat(teal_dk))
        for n, lo in (("mtail", teal), ("mtailmid", teal), ("mtaildroop", teal_dk), ("mtailtip", teal_dk)):
            p.paint(n, lambda f, i, j, w, h, fi, lo=lo: sheen if (i + j) % 3 == 0 and f in ("east", "west") else (teal_dk if (i + 2 * j) % 4 == 0 else lo))
    p.paint("beak", lambda f, i, j, w, h, fi: gold_dk if f == "north" else gold)
    p.paint("beaklow", flat(gold_dk))
    for n in ("fcomb", "fcombtip", "mcomb", "mcombtip", "mcombtall"):
        p.paint(n, lambda f, i, j, w, h, fi: red)
    for n in ("fwattle", "mwattle"):
        p.paint(n, lambda f, i, j, w, h, fi: red_dk if j == h - 1 and h > 1 else red)
    shank, shank_dk = (228, 176, 70), (188, 132, 44)
    p.paint("leg", lambda f, i, j, w, h, fi: shank_dk if j % 2 else shank, light=False)
    p.paint("toe", lambda f, i, j, w, h, fi: shank_dk if (f == "top" and j == h - 1) or f == "north" else shank)
    p.paint("claw", flat(shank))
    eyes(p, "hhead", 1)
    chick, down, fluff = (250, 222, 100), (240, 200, 76), (255, 238, 150)

    def fuzz(f, i, j, w, h, fi):
        if f == "bottom":
            return down
        r = h32("chick", f, i, j) % 6
        c = fluff if r == 0 else (down if r == 1 else chick)
        return mix(c, down, 0.5) if f != "top" and j == h - 1 else c
    p.paint("b_torso", fuzz)
    p.paint("b_head", fuzz)
    p.paint("b_beak", flat((240, 150, 60)))
    p.paint("b_wing", lambda f, i, j, w, h, fi: down if (i + j) % 2 else mix(down, (200, 150, 50), 0.4))
    p.paint("b_leg", flat((238, 156, 60)), light=False)
    eyes(p, "b_head", 1)


# --- Rabbit ------------------------------------------------------------------------

RABBIT = [
    ("body", None, [0, 0, 0], None),
    # a slim chest in front of round, higher haunches
    ("a_torso", "body", [0, 5, 0], [("torso", [-2.5, 2, -4], [5, 4, 5]), ("rump", [-3, 2, 0], [6, 5, 5])]),
    ("a_tail", "a_torso", [0, 5, 5], [("tail", [-1, 4, 5], [2, 2, 1])]),
    ("head", "body", [0, 6, -4], None),
    ("a_head", "head", [0, 6, -4], [("hhead", [-2, 5, -7], [4, 4, 4])]),
    # a buck: heavy jowls that widen the head (and drawn a little larger: scale_male)
    ("m_cheeks", "head", [0, 6, -5], [("cheeks", [-3, 5, -6.5], [6, 3, 3])]),
    ("a_ears", "head", [0, 9, -4], [*pair("ear", [0.5, 9, -5], [1, 4, 1])]),
    ("a_leg_fl", "body", [1.5, 2, -3.5], [("fleg", [1, 0, -4], [1, 2, 1])]),
    ("a_leg_fr", "body", [-1.5, 2, -3.5], [("fleg", [-2, 0, -4], [1, 2, 1])]),
    # hind feet swing from inside the haunch, over the foot's middle: a flat foot rocking about a
    # pivot this high dips at most ~0.6 px into the ground at mid-hop (2 px about its own top)
    ("a_leg_bl", "body", [2, 5, 1.5], [("hleg", [1, 0, -1], [2, 2, 5])]),
    ("a_leg_br", "body", [-2, 5, 1.5], [("hleg", [-3, 0, -1], [2, 2, 5])]),
    ("b_torso", "body", [0, 2, 0], [("b_torso", [-2, 1, -2.5], [4, 3, 5])]),
    ("b_tail", "b_torso", [0, 3, 2.5], [("b_tail", [-0.5, 2, 2.5], [1, 1, 1])]),
    ("b_head", "body", [0, 3, -2.5], [("b_head", [-1.5, 2, -5], [3, 3, 3]), *pair("b_ear", [0.5, 5, -3], [1, 2, 1])]),
    ("b_leg_fl", "body", [1, 1, -2], [("b_fleg", [0.5, 0, -2.5], [1, 1, 1])]),
    ("b_leg_fr", "body", [-1, 1, -2], [("b_fleg", [-1.5, 0, -2.5], [1, 1, 1])]),
    ("b_leg_bl", "body", [1.5, 1, 1], [("b_hleg", [1, 0, -0.5], [1, 1, 3])]),
    ("b_leg_br", "body", [-1.5, 1, 1], [("b_hleg", [-2, 0, -0.5], [1, 1, 3])]),
]

# patches of the splotched coat, per cube, in the cube's own space (see blobs())
RABBIT_PATCHES = {
    "torso": [(0, 1, 3, 2.5, 2.5, 2)], "rump": [(4, 0, 3, 3, 2.5, 2.5), (0, 4, 4, 1.5, 2, 2)],
    "hhead": [(0, 1, 2.5, 1.6, 2.2, 2.5), (4, 1, 2.5, 1.6, 2.2, 2.5)],
    "b_torso": [(1, 0, 3, 2, 1.5, 2)], "b_head": [(0, 1, 2, 1.2, 1.6, 2), (3, 1, 2, 1.2, 1.6, 2)],
}


def rabbit_paint(p, coat):
    base, belly = coat["coat"], coat["belly"]
    variant = coat["variant"]
    back = mix(base, BLACK, 0.12)

    def coat_fn(name):
        plain = fur(base, back, belly, name, grain=0.05, belly_rows=1)
        patch = blobs(p, name, RABBIT_PATCHES[name], name) if "patch" in coat and name in RABBIT_PATCHES else None

        def fn(f, i, j, w, h, fi):
            if patch and f != "bottom" and patch(f, i, j):
                # kept clear of the eye colour: tools/gen_sleep.mjs finds the eyes by it
                return mix(coat["patch"], WHITE, 0.06)
            c = plain(f, i, j, w, h, fi)
            if "speckle" in coat and f != "bottom" and h32(name, f, i, j) % 4 == 0:
                c = mix(c, coat["speckle"], 0.55)  # ticked fur
            return c
        return fn
    for n in ("torso", "rump", "cheeks", "fleg", "hleg", "b_torso", "b_fleg", "b_hleg"):
        p.paint(n, coat_fn(n))
    nose = (226, 146, 156)
    for n in ("hhead", "b_head"):
        inner = coat_fn(n)

        def head(f, i, j, w, h, fi, inner=inner):
            mid = abs(i - (w - 1) / 2)
            if f == "north" and j >= h - 2:
                if j == h - 2 and mid < 1:
                    return mix(mix(belly, base, 0.25), nose, 0.55)
                return mix(belly, base, 0.25)  # pale muzzle and chin
            return inner(f, i, j, w, h, fi)
        p.paint(n, head, amt=2)
    pink = mix(base, (236, 168, 176), 0.35 if variant == "black" else 0.85)
    p.paint("ear", lambda f, i, j, w, h, fi: pink if f == "north" and 0 < j < h - 1 else (back if f == "south" else base))
    p.paint("b_ear", lambda f, i, j, w, h, fi: pink if f == "north" and j > 0 else base)
    scut = (246, 244, 240)
    p.paint("tail", lambda f, i, j, w, h, fi: scut if f != "top" else mix(scut, base, 0.5))
    p.paint("b_tail", flat(scut))
    eye = (170, 40, 52) if variant == "white" else None
    eyes(p, "hhead", 1, eye)
    eyes(p, "b_head", 1, eye)


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
               {"scale_male": 1.1, "scale_female": 1.0}),
}


# Bones that rest turned (degrees about x, y, z; a positive x tips the front down). The goat
# carries its head a little low (horns and beard with it; the eyelids of tools/gen_sleep.mjs
# hang from a_head and turn too). Animations add to this rest turn.
BONE_ROTATION = {"goat": {"head": [15, 0, 0]}}


def build(sid):
    bones, variants, rig = SPECIES[sid]
    bones = autouv(bones)
    out = OUT / sid
    (out / "textures").mkdir(parents=True, exist_ok=True)
    for stale in (out / "textures").glob("*.png"):
        if stale.stem not in variants:
            stale.unlink()
    data = geo(sid, TW, TH, bones, bounds=(2.5, 2.5) if sid in ("cow", "sheep", "goat", "pig") else (1.5, 1.5))
    for bone in data["minecraft:geometry"][0]["bones"]:
        if bone["name"] in BONE_ROTATION.get(sid, {}):
            bone["rotation"] = BONE_ROTATION[sid][bone["name"]]
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
