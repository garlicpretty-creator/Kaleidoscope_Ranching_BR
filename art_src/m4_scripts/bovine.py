"""Buffalo and yak: adult rig (a_*), sexed horns/udder/skirt, and a separate calf rig (b_*)."""
import sys
from boxuv import RP, Painter, plain_eyes, geo, write_geo


def mirror(origin, size):
    return [-(origin[0] + size[0]), origin[1], origin[2]]


def pair(name, origin, size, uv):
    return [(name, origin, size, uv), (name, mirror(origin, size), size, uv)]


def legs(prefix, cube, size, uv, x, z_front, z_back, top):
    w, h, d = size
    out = []
    for tag, sx, z in (("fl", 1, z_front), ("fr", -1, z_front), ("bl", 1, z_back), ("br", -1, z_back)):
        ox = x if sx > 0 else -(x + w)
        out.append((f"{prefix}leg_{tag}", "body", [ox + w / 2, top, z + d / 2], [(cube, [ox, 0, z], size, uv)]))
    return out


# --- Water buffalo ---------------------------------------------------------------
BUFFALO = [
    ("body", None, [0, 0, 0], None),
    ("a_torso", "body", [0, 17, 0], [
        ("torso", [-7, 12, -10], [14, 11, 20], [0, 0]),
        ("shoulder", [-6, 22, -9], [12, 2, 7], [42, 32]),   # withers hump
        ("belly", [-6, 11, -7], [12, 1, 13], [42, 41]),     # rounded underside
        ("dewlap", [-3, 13, -11], [6, 6, 2], [92, 32]),     # thick neck under the head
    ]),
    ("a_tail", "body", [0, 22, 10], [("tail", [-1, 13, 10], [2, 9, 1], [16, 32])]),
    ("fa_udder", "body", [0, 12, 4], [("udder", [-2.5, 10, 2], [5, 2, 5], [22, 32])]),
    ("head", "body", [0, 19, -10], None),
    ("a_head", "head", [0, 19, -10], [
        ("skull", [-4, 13, -18], [8, 8, 7], [68, 0]),
        ("muzzle", [-3, 12, -20], [6, 5, 2], [98, 0]),
        *pair("ear", [4, 18, -15], [3, 1, 2], [98, 7]),
    ]),
    # both sexes are horned: crescents that sweep out, back and up; the bull's are much bigger
    ("fa_horns", "head", [0, 20, -14], [
        *pair("horn1", [4, 19, -15], [3, 2, 2], [68, 16]),
        *pair("horn2", [7, 20, -14], [2, 2, 3], [78, 16]),
        *pair("horn3", [7, 22, -12], [1, 2, 1], [76, 24]),
    ]),
    # the bull's: thick at the root, sweeping far out, then back and up to a point
    ("m_horns", "head", [0, 20, -14], [
        *pair("mhorn1", [4, 19, -16], [4, 2, 3], [88, 16]),
        *pair("mhorn2", [8, 20, -15], [3, 2, 3], [102, 16]),
        *pair("mhorn3", [10, 21, -13], [2, 2, 4], [114, 16]),
        *pair("mhorn4", [10, 23, -10], [1, 2, 2], [68, 24]),
    ]),
    # the bull's heavy crest over the shoulders
    ("m_hump", "a_torso", [0, 23, -6], [("mhump", [-5, 23, -10], [10, 3, 7], [0, 108])]),
    *legs("a_", "leg", [4, 12, 4], [0, 32], 2, -9, 5, 12),
    # calf: leggy, short body, big head with a broad slate muzzle and two horn buds
    ("b_torso", "body", [0, 13, 0], [("b_torso", [-4, 10, -6], [8, 7, 12], [0, 64])]),
    ("b_tail", "body", [0, 16, 6], [("b_tail", [-0.5, 11, 6], [1, 5, 1], [12, 84])]),
    ("b_head", "body", [0, 15, -6], [
        ("b_head", [-3, 13, -11], [6, 6, 5], [40, 64]),
        ("b_muzzle", [-2.5, 13, -13], [5, 3, 2], [62, 64]),
        *pair("b_ear", [3, 17, -9], [2, 1, 2], [62, 69]),
        *pair("b_bud", [2, 19, -10], [1, 1, 1], [76, 64]),
    ]),
    *legs("b_", "b_leg", [3, 10, 3], [0, 84], 1, -5, 2, 10),
]

# --- Yak -------------------------------------------------------------------------
YAK = [
    ("body", None, [0, 0, 0], None),
    ("a_torso", "body", [0, 17, 0], [
        ("torso", [-6, 12, -9], [12, 11, 18], [0, 0]),
        ("hump", [-4, 22, -7], [8, 3, 6], [60, 0]),
    ]),
    # long hair skirt hanging from the flanks; the bull's reaches lower
    ("fa_skirt", "body", [0, 12, 0], [("skirt_f", [-6.5, 8, -8.5], [13, 4, 17], [0, 30])]),
    ("m_skirt", "body", [0, 12, 0], [("skirt_m", [-6.5, 5, -8.5], [13, 7, 17], [0, 52])]),
    ("a_tail", "body", [0, 21, 9], [("tail", [-1.5, 12, 9], [3, 9, 2], [82, 30])]),
    ("fa_udder", "body", [0, 12, 4], [("udder", [-2, 8, 2], [4, 2, 4], [92, 30])]),
    ("head", "body", [0, 19, -9], None),
    ("a_head", "head", [0, 19, -9], [
        ("skull", [-3.5, 13, -15], [7, 7, 6], [60, 9]),
        ("muzzle", [-2.5, 13, -16], [5, 4, 1], [88, 0]),
        *pair("ear", [3.5, 18, -12], [3, 1, 2], [88, 5]),
        ("forelock", [-3.5, 18, -15.5], [7, 3, 1], [82, 46]),  # shaggy fringe over the brow
        ("beard", [-2.5, 11, -14], [5, 3, 2], [66, 46]),       # hair hanging under the chin
    ]),
    ("fa_horns", "head", [0, 20, -12], [
        *pair("horn1", [3.5, 19, -12], [2, 1, 1], [100, 0]),
        *pair("horn2", [4.5, 20, -12], [1, 3, 1], [106, 0]),
    ]),
    ("m_horns", "head", [0, 20, -12], [
        *pair("mhorn1", [3.5, 18, -13], [3, 2, 2], [110, 0]),
        *pair("mhorn2", [5.5, 20, -13], [2, 3, 2], [100, 4]),
        *pair("mhorn3", [6, 23, -12.5], [1, 2, 1], [120, 0]),
    ]),
    *legs("a_", "leg", [4, 12, 4], [66, 30], 2, -8, 4, 12),
    # calf: dark and shaggy already, a fringe over the brow and a short hair skirt
    ("b_torso", "body", [0, 12, 0], [("b_torso", [-4, 9, -6], [8, 7, 12], [0, 80])]),
    ("b_skirt", "body", [0, 10, 0], [("b_skirt", [-4.5, 7, -5.5], [9, 3, 11], [0, 112])]),
    ("b_tail", "body", [0, 15, 6], [("b_tail", [-1, 11, 6], [2, 4, 1], [12, 100])]),
    ("b_head", "body", [0, 14, -6], [
        ("b_head", [-3, 12, -11], [6, 6, 5], [40, 80]),
        ("b_muzzle", [-2, 12, -12], [4, 3, 1], [62, 80]),
        *pair("b_ear", [3, 16, -8], [2, 1, 2], [62, 84]),
        ("b_forelock", [-3, 16, -11.5], [6, 2, 1], [72, 80]),
    ]),
    *legs("b_", "b_leg", [3, 9, 3], [0, 100], 1, -5, 2, 9),
]


def mix(a, b, t):
    return tuple(int(x + (y - x) * t) for x, y in zip(a, b))


def flat(c):
    return lambda f, i, j, w, h, fi: c


def hide_fn(base, top=None, belly=None, streak=0.08):
    """Short coat: faint hair strokes on the sides, a darker back and a paler belly."""
    dark = mix(base, (0, 0, 0), streak)

    def fn(f, i, j, w, h, fi):
        if f == "top":
            return top or base
        if f == "bottom":
            return belly or base
        return dark if (i + (j // 3)) % 3 == 0 else base
    return fn


def strands(base, light, ragged=False):
    """Long hanging hair: vertical strands of two shades, with a ragged hem."""
    def fn(f, i, j, w, h, fi):
        if f in ("top", "bottom"):
            return base
        if ragged and j == h - 1 and (i * 7) % 3 == 0:
            return None  # leave transparent: uneven hem
        return light if (i * 5 + (j // 4)) % 4 == 0 else base
    return fn


def leg_fn(coat, sock, hoof):
    """Upper leg in coat colour, pale lower 'socks', dark hooves."""
    def fn(f, i, j, w, h, fi):
        if f == "bottom":
            return hoof
        if f == "top":
            return coat
        if j >= h - 2:
            return hoof
        if sock and j >= h - 5:
            return sock
        return coat
    return fn


def horn_fn(base, ridge, tip=None):
    """Ridged horn: alternating bands across its length."""
    def fn(f, i, j, w, h, fi):
        if tip:
            return tip
        return ridge if (i + j) % 2 == 0 else base
    return fn


def muzzle_fn(base, lip, nostril):
    def fn(f, i, j, w, h, fi):
        if f == "north":
            if j == 1 and i in (1, w - 2):
                return nostril
            if j == h - 1:
                return lip
        return base
    return fn


def ear_fn(outer, inner):
    return lambda f, i, j, w, h, fi: inner if f in ("south", "bottom") else outer


def buffalo_adult(p, sex):
    hide = (92, 90, 96) if sex == "female" else (68, 66, 72)
    back, belly = mix(hide, (0, 0, 0), 0.15), mix(hide, (200, 196, 196), 0.35)
    p.paint("torso", hide_fn(hide, back, belly))
    p.paint("shoulder", hide_fn(hide, back))
    p.paint("belly", flat(belly))
    p.paint("dewlap", lambda f, i, j, w, h, fi: (186, 180, 174) if (f == "north" and j in (1, 2) and 1 <= i <= w - 2) else hide)  # pale throat chevron
    p.paint("tail", lambda f, i, j, w, h, fi: (30, 28, 32) if j >= h - 3 else hide)
    p.paint("udder", flat((168, 136, 136)))

    def skull_fn(f, i, j, w, h, fi):
        if f in ("east", "west") and j == 1 and 1 <= fi <= 3:
            return mix(hide, (220, 214, 208), 0.45)  # pale brow above the eye
        return hide_fn(hide, back)(f, i, j, w, h, fi)
    p.paint("skull", skull_fn)
    p.paint("muzzle", muzzle_fn((48, 46, 50), (132, 126, 128), (10, 8, 10)))  # nostrils kept clear of the eye's black: gen_sleep.mjs lids whatever matches it
    p.paint("ear", ear_fn(hide, (164, 132, 132)))
    p.paint("horn1", horn_fn((134, 124, 108), (112, 102, 90)))
    p.paint("horn2", horn_fn((134, 124, 108), (112, 102, 90)))
    p.paint("horn3", horn_fn(None, None, tip=(84, 76, 68)))
    p.paint("mhorn1", horn_fn((128, 118, 102), (104, 94, 82)))
    p.paint("mhorn2", horn_fn((120, 110, 96), (98, 88, 78)))
    p.paint("mhorn3", horn_fn((100, 92, 80), (84, 76, 66)))
    p.paint("mhorn4", horn_fn(None, None, tip=(66, 58, 52)))
    p.paint("mhump", hide_fn(hide, back))
    p.paint("leg", leg_fn(hide, (176, 172, 168), (30, 28, 30)))
    plain_eyes(p, "skull", 3)


def buffalo_calf(p):
    """Slate grey-black like its mother from birth, pale socks, a broad dark muzzle, horn buds."""
    coat = (84, 82, 88)
    back, belly = mix(coat, (0, 0, 0), 0.18), mix(coat, (200, 196, 196), 0.3)
    p.paint("b_torso", hide_fn(coat, back, belly, 0.06))
    p.paint("b_tail", lambda f, i, j, w, h, fi: (40, 38, 42) if j >= h - 2 else coat)

    def head_fn(f, i, j, w, h, fi):
        if f in ("east", "west") and j == 1 and 1 <= fi <= 2:
            return mix(coat, (220, 214, 208), 0.35)  # pale brow, as on the adults
        if f == "north":
            return coat  # plain front: only the eyes may come near their colours
        return hide_fn(coat, back, streak=0.05)(f, i, j, w, h, fi)
    p.paint("b_head", head_fn)
    p.paint("b_muzzle", muzzle_fn((52, 50, 56), (112, 106, 110), (12, 10, 12)))  # nostrils clear of the eye's black
    p.paint("b_ear", ear_fn(coat, (150, 124, 124)))
    p.paint("b_bud", flat((150, 140, 124)))
    p.paint("b_leg", leg_fn(coat, (176, 172, 168), (40, 36, 38)))
    plain_eyes(p, "b_head", 2)


def yak_adult(p, sex):
    coat = (88, 68, 54) if sex == "female" else (64, 50, 42)
    hair, light = mix(coat, (0, 0, 0), 0.25), mix(coat, (255, 240, 220), 0.18)
    blaze = (228, 222, 212)
    p.paint("torso", strands(coat, light))
    p.paint("hump", strands(coat, light))
    p.paint("skirt_f", strands(hair, coat, ragged=True))
    p.paint("skirt_m", strands(hair, coat, ragged=True))
    p.paint("tail", strands(hair, light))
    p.paint("udder", flat((156, 124, 114)))

    def skull_fn(f, i, j, w, h, fi):
        if f == "north" and w // 2 - 1 <= i <= w // 2:
            return blaze  # white blaze down the face
        return strands(coat, light)(f, i, j, w, h, fi)
    p.paint("skull", skull_fn)
    p.paint("forelock", strands(hair, light, ragged=True))
    p.paint("beard", strands(hair, coat, ragged=True))
    p.paint("muzzle", muzzle_fn((190, 170, 152) if sex == "female" else (164, 144, 126), (214, 200, 186), (56, 40, 34)))  # nostrils clear of the eye's black (gen_sleep.mjs)
    p.paint("ear", ear_fn(coat, (176, 140, 124)))
    cream, tip = (232, 222, 200), (96, 86, 74)
    p.paint("horn1", flat(cream))
    p.paint("horn2", lambda f, i, j, w, h, fi: tip if j == 0 else cream)
    p.paint("mhorn1", flat(cream))
    p.paint("mhorn2", flat(mix(cream, tip, 0.2)))
    p.paint("mhorn3", flat(tip))
    p.paint("leg", leg_fn(hair, None, (24, 20, 18)))
    plain_eyes(p, "skull", 3)


def yak_calf(p):
    """Dark brown and shaggy like the adults: long strands, a fringe over the brow, a ragged
    hair skirt, a dark nose."""
    coat = (82, 60, 46)
    hair, light = mix(coat, (0, 0, 0), 0.22), mix(coat, (255, 236, 210), 0.16)
    p.paint("b_torso", strands(coat, light))
    p.paint("b_skirt", strands(hair, coat, ragged=True))
    p.paint("b_tail", strands(hair, light))
    p.paint("b_head", lambda f, i, j, w, h, fi: coat if f == "north" else strands(coat, light)(f, i, j, w, h, fi))
    p.paint("b_forelock", strands(hair, light, ragged=True))
    p.paint("b_muzzle", muzzle_fn((70, 56, 50), (96, 80, 72), (46, 34, 30)))  # dark nose; nostrils clear of the eye's black
    p.paint("b_ear", ear_fn(coat, (150, 116, 102)))
    p.paint("b_leg", leg_fn(hair, None, (40, 32, 28)))
    plain_eyes(p, "b_head", 2)


def stubby(bones, dy=3):
    """Shorter adult legs (12 -> 9) with everything above lowered to match: a chunkier, cuter stance."""
    out = []
    for name, parent, pivot, cubes in bones:
        adult = name == "head" or name.startswith(("a_", "fa_", "m_"))
        if not adult:
            out.append((name, parent, pivot, cubes))
        elif name.startswith("a_leg_"):
            out.append((name, parent, [pivot[0], pivot[1] - dy, pivot[2]],
                        [(n, o, [s[0], s[1] - dy, s[2]], uv) for n, o, s, uv in cubes]))
        else:
            out.append((name, parent, [pivot[0], pivot[1] - dy, pivot[2]],
                        [(n, [o[0], o[1] - dy, o[2]], s, uv) for n, o, s, uv in cubes] if cubes else cubes))
    return out


# Vanilla-length legs (12): stubby() is no longer applied.

SPECIES = {"buffalo": (BUFFALO, buffalo_adult, buffalo_calf), "yak": (YAK, yak_adult, yak_calf)}


def main(sid):
    bones, adult, calf = SPECIES[sid]
    write_geo(sid, geo(sid, 128, 128, bones, bounds=(2.5, 2.5)))
    d = RP / "textures" / "entity" / "ranching" / sid
    for v in ("female", "male", "baby"):
        p = Painter(128, 128, bones, f"{sid}-{v}")
        adult(p, "female" if v == "baby" else v)
        calf(p)
        p.save(d / f"{v}.png")
    print(sid, "ok")


if __name__ == "__main__":
    main(sys.argv[1])
