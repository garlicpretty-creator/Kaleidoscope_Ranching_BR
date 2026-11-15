"""Buffalo and yak: adult rig (a_*), sexed horns/udder/skirt, and a separate calf rig (b_*)."""
import sys
from boxuv import RP, BLUSH, Painter, cute_eyes, geo, write_geo


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
    ("a_torso", "body", [0, 17, 0], [("torso", [-7, 12, -10], [14, 11, 20], [0, 0])]),
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
    ("m_horns", "head", [0, 20, -14], [
        *pair("mhorn1", [4, 19, -16], [4, 2, 3], [88, 16]),
        *pair("mhorn2", [8, 20, -15], [2, 2, 5], [102, 16]),
        *pair("mhorn3", [8, 22, -11], [2, 3, 2], [68, 24]),
    ]),
    *legs("a_", "leg", [4, 12, 4], [0, 32], 2, -9, 5, 12),
    # calf: leggy, short body, big head, no horns
    ("b_torso", "body", [0, 13, 0], [("b_torso", [-4, 10, -6], [8, 7, 12], [0, 64])]),
    ("b_tail", "body", [0, 16, 6], [("b_tail", [-0.5, 11, 6], [1, 5, 1], [12, 84])]),
    ("b_head", "body", [0, 15, -6], [
        ("b_head", [-3, 13, -11], [6, 6, 5], [40, 64]),
        ("b_muzzle", [-2, 13, -13], [4, 3, 2], [62, 64]),
        *pair("b_ear", [3, 18, -8], [2, 1, 2], [62, 69]),
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
    # calf: woolly, compact
    ("b_torso", "body", [0, 12, 0], [("b_torso", [-4, 9, -6], [8, 7, 12], [0, 80])]),
    ("b_tail", "body", [0, 15, 6], [("b_tail", [-1, 11, 6], [2, 4, 1], [12, 100])]),
    ("b_head", "body", [0, 14, -6], [
        ("b_head", [-3, 12, -11], [6, 6, 5], [40, 80]),
        ("b_muzzle", [-2, 12, -12], [4, 3, 1], [62, 80]),
        *pair("b_ear", [3, 17, -8], [2, 1, 2], [62, 84]),
    ]),
    *legs("b_", "b_leg", [3, 9, 3], [0, 100], 1, -5, 2, 9),
]


def eyes(p, cube, row, color=(18, 16, 16)):
    for f in ("east", "west"):
        x0, y0, w, h = p.face(cube, f)
        p.px(x0 + 1 if f == "east" else x0 + w - 2, y0 + row, color)
        p.px(x0 + 1 if f == "east" else x0 + w - 2, y0 + row + 1, color)


def hooves(p, cube, color, rows=2):
    for f in ("north", "south", "east", "west"):
        x0, y0, w, h = p.face(cube, f)
        p.rect((x0, y0 + h - rows, w, rows), color, 4)


def nostrils(p, cube, color):
    x0, y0, w, h = p.face(cube, "north")
    p.px(x0 + 1, y0 + 1, color)
    p.px(x0 + w - 2, y0 + 1, color)


def horn(p, names, base, tip):
    for i, n in enumerate(names):
        c = base if i < len(names) - 1 else tip
        p.cube(n, c, 6)


def buffalo_adult(p, sex):
    hide = (84, 82, 86) if sex == "female" else (62, 60, 64)
    p.cube("torso", hide, 6, tuple(v - 12 for v in hide), 0.25)
    p.rect(p.face("torso", "bottom"), (96, 92, 94), 6)  # paler belly
    p.cube("tail", hide, 5)
    x0, y0, w, h = p.face("tail", "north")
    p.rect((x0, y0 + h - 3, w, 3), (24, 22, 24), 4)  # tail tuft
    p.cube("udder", (150, 120, 122), 6)
    p.cube("skull", hide, 6)
    p.cube("muzzle", (36, 34, 36), 4)
    nostrils(p, "muzzle", (14, 12, 14))
    cute_eyes(p, "skull", 3, inset=1, rim=(150, 146, 150))
    p.cube("ear", hide, 5)
    horn(p, ["horn1", "horn2", "horn3"], (124, 114, 98), (92, 84, 74))
    horn(p, ["mhorn1", "mhorn2", "mhorn3"], (118, 108, 92), (78, 70, 62))
    p.cube("leg", hide, 6)
    hooves(p, "leg", (28, 26, 28))
    # pale chevron on the throat, typical of swamp buffalo
    x0, y0, w, h = p.face("skull", "north")
    p.rect((x0 + 1, y0 + h - 1, w - 2, 1), (150, 146, 140), 4)


def buffalo_calf(p):
    coat = (150, 128, 112)
    p.cube("b_torso", coat, 8, (108, 92, 82), 0.3)
    p.cube("b_tail", coat, 6)
    p.cube("b_head", coat, 8)
    p.cube("b_muzzle", (206, 160, 150), 4)
    nostrils(p, "b_muzzle", (30, 26, 26))
    cute_eyes(p, "b_head", 2, inset=1, blush=BLUSH)
    p.cube("b_ear", coat, 6)
    p.cube("b_leg", coat, 6)
    hooves(p, "b_leg", (40, 36, 36))


def yak_adult(p, sex):
    coat = (84, 64, 50) if sex == "female" else (62, 48, 40)
    hair = (60, 46, 38) if sex == "female" else (42, 32, 28)
    p.cube("torso", coat, 7, hair, 0.3)
    p.cube("hump", coat, 7, hair, 0.3)
    for n in ("skirt_f", "skirt_m"):
        p.cube(n, hair, 8, coat, 0.15)
        for f in ("north", "south", "east", "west"):  # long vertical strands
            x0, y0, w, h = p.face(n, f)
            for x in range(x0, x0 + w):
                if p.rng.random() < 0.35:
                    p.rect((x, y0, 1, h), tuple(v + 18 for v in hair), 6)
        for f in ("north", "south", "east", "west"):  # ragged hem
            x0, y0, w, h = p.face(n, f)
            for x in range(x0, x0 + w):
                if p.rng.random() < 0.45:
                    p.img.putpixel((x, y0 + h - 1), (0, 0, 0, 0))
    p.cube("tail", hair, 7)
    p.cube("udder", (140, 112, 104), 6)
    p.cube("skull", coat, 7, hair, 0.2)
    p.cube("muzzle", (156, 136, 118), 5)
    nostrils(p, "muzzle", (30, 24, 20))
    cute_eyes(p, "skull", 3, inset=1, rim=(164, 138, 116))
    p.cube("ear", coat, 6)
    horn(p, ["horn1", "horn2"], (220, 210, 188), (120, 110, 96))
    horn(p, ["mhorn1", "mhorn2", "mhorn3"], (214, 204, 180), (110, 100, 88))
    p.cube("leg", hair, 6)
    hooves(p, "leg", (22, 18, 16))


def yak_calf(p):
    coat = (128, 98, 76)
    p.cube("b_torso", coat, 10, (88, 66, 52), 0.4)
    p.cube("b_tail", (80, 62, 50), 6)
    p.cube("b_head", coat, 10, (88, 66, 52), 0.3)
    p.cube("b_muzzle", (214, 176, 158), 5)
    nostrils(p, "b_muzzle", (50, 40, 32))
    cute_eyes(p, "b_head", 2, inset=1, blush=BLUSH)
    p.cube("b_ear", coat, 6)
    p.cube("b_leg", (80, 62, 50), 6)
    hooves(p, "b_leg", (34, 28, 24))


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


BUFFALO, YAK = stubby(BUFFALO), stubby(YAK)

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
