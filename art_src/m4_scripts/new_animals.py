"""1.1 追加 新動物 (docs/1.1_追加企劃書.md 二): stand-in models and textures for the quail, the
turkey and the alpaca, until the hand-made art.

- quail, turkey: the duck's rig (duck.py BONES) scaled down or up, repainted. Same bone names, so
  client.py's walk, tools/gen_sleep.mjs (roost) and tools/gen_actions.mjs work unchanged.
- alpaca: a long-necked quadruped on the yak's conventions (a_*, b_*, legs a_leg_fl..), with its
  fleece in wool_* bones that client.py hides once it is sheared.

Eyes are painted with boxuv.plain_eyes so gen_sleep can lay eyelids over them.
UVs are packed afresh (blocks_m3.autouv): scaled cubes no longer fit the duck's sheet.

Run with: python art_src/m4_scripts/new_animals.py [quail|turkey|alpaca ...]
then python art_src/m4_scripts/client.py <id> for each, and npm run generate.
"""
import sys

from blocks_m3 import autouv
from boxuv import RP, Painter, geo, plain_eyes, write_geo
from duck import BONES as DUCK_BONES


def mix(a, b, t):
    return tuple(int(x + (y - x) * t) for x, y in zip(a, b))


def flat(c):
    return lambda f, i, j, w, h, fi: c


def speckle(base, dark, light=None, every=4):
    def fn(f, i, j, w, h, fi):
        r = (i * 7 + j * 13 + len(f)) % 11
        if r == 0:
            return dark
        if light and r == every:
            return light
        return base
    return fn


def pack(bones, tw):
    """autouv over a rig whose cubes may be None (bone pivots only); returns bones and sheet size."""
    raw = [(n, p, pv, [(c[0], c[1], c[2]) for c in (cubes or [])]) for n, p, pv, cubes in bones]
    packed, tw, th = autouv(raw, tw)
    th = max(th, tw // 2)
    return [(n, p, pv, cubes or None) for n, p, pv, cubes in packed], tw, th


def scaled(bones, k):
    """The duck's rig scaled by k about the ground origin (sizes stay at least one pixel)."""
    half = lambda v: round(v * k * 2) / 2
    out = []
    for name, parent, pivot, cubes in bones:
        out.append((name, parent, [half(v) for v in pivot],
                    None if cubes is None else [(c[0], [half(v) for v in c[1]], [max(1, round(v * k)) for v in c[2]]) for c in cubes]))
    return out


# --- Quail and turkey --------------------------------------------------------------

POULTRY_LOOKS = {
    # body, dark, light, head, bill, legs, chick down, chick back
    "quail": {"scale": 0.7, "female": ((150, 118, 84), (86, 62, 42), (214, 190, 150), (136, 104, 74)),
              "male": ((140, 104, 72), (80, 56, 38), (220, 196, 156), (120, 70, 44)),
              "bill": (74, 62, 52), "legs": (206, 160, 120), "down": (214, 186, 140), "back": (120, 92, 62)},
    "turkey": {"scale": 1.4, "female": ((96, 76, 58), (52, 40, 32), (150, 128, 100), (120, 104, 96)),
               "male": ((70, 58, 46), (34, 28, 24), (148, 112, 70), (150, 170, 200)),
               "bill": (196, 180, 140), "legs": (170, 120, 110), "down": (204, 180, 130), "back": (132, 104, 70)},
}
WATTLE = (200, 44, 40)


def poultry(sid):
    look = POULTRY_LOOKS[sid]

    def adult(p, sex):
        body, dark, light, head = look[sex]
        bars = speckle(body, dark, light)
        for cube in ("torso", "chest", "rump", "tail", "tail_tip", "curl", "wingtip"):
            p.paint(cube, bars)
        p.paint("belly", flat(mix(body, light, 0.5)))
        p.paint("wing_l", bars)
        p.paint("wing_r", bars)

        def head_fn(f, i, j, w, h, fi):
            # the tom's bare blue-white face over a red wattle; the quail cock's chestnut throat
            if sex == "male" and sid == "turkey" and f == "north" and j >= h - 2:
                return WATTLE
            if sex == "male" and sid == "quail" and f == "north" and j == h - 1:
                return (150, 70, 40)
            return head
        p.paint("head", head_fn)
        p.paint("neck", flat(WATTLE if (sid == "turkey" and sex == "male") else head))
        p.paint("bill_up", flat(look["bill"]))
        p.paint("bill_lo", flat(mix(look["bill"], (0, 0, 0), 0.2)))
        p.paint("leg", flat(look["legs"]), light=False)
        p.paint("foot", flat(look["legs"]))
        plain_eyes(p, "head", 1)

    def chick(p):
        down, back = look["down"], look["back"]
        p.paint("b_torso", lambda f, i, j, w, h, fi: back if f in ("top", "south") and (i + j) % 3 else down)
        p.paint("b_head", lambda f, i, j, w, h, fi: back if f == "top" else down)
        plain_eyes(p, "b_head", 1)
        p.paint("b_bill", flat(look["bill"]))
        p.paint("b_wing_l", flat(mix(down, back, 0.4)))
        p.paint("b_wing_r", flat(mix(down, back, 0.4)))
        p.paint("b_leg", flat(look["legs"]), light=False)
        p.paint("b_foot", flat(look["legs"]))

    bones, tw, th = pack(scaled(DUCK_BONES, look["scale"]), 64)
    return bones, tw, th, adult, chick


# --- Alpaca -------------------------------------------------------------------------

def mirror_x(origin, size):
    return [-(origin[0] + size[0]), origin[1], origin[2]]


def legs(prefix, cube, size, x, z_front, z_back, top):
    w, h, d = size
    out = []
    for tag, sx, z in (("fl", 1, z_front), ("fr", -1, z_front), ("bl", 1, z_back), ("br", -1, z_back)):
        ox = x if sx > 0 else -(x + w)
        out.append((f"{prefix}leg_{tag}", "body", [ox + w / 2, top, z + d / 2], [(cube, [ox, 0, z], size)]))
    return out


ALPACA_BONES = [
    ("body", None, [0, 0, 0], None),
    ("a_torso", "body", [0, 15, 0], [("torso", [-4, 12, -7], [8, 7, 14])]),
    # the fleece over the body, neck and rump; hidden once sheared (client.py RULES wool_)
    ("wool_coat", "a_torso", [0, 15, 0], [("fleece", [-5, 11, -8], [10, 9, 16])]),
    ("a_tail", "body", [0, 18, 7], [("tail", [-1, 15, 7], [2, 4, 2])]),
    ("head", "body", [0, 19, -7], None),
    ("a_head", "head", [0, 19, -7], [
        ("neck", [-1.5, 18, -10], [3, 10, 3]),
        ("skull", [-2, 26, -12], [4, 4, 5]),
        ("muzzle", [-1.5, 26, -14], [3, 3, 2]),
        ("ear", [1, 30, -9], [1, 3, 1]),
        ("ear", [-2, 30, -9], [1, 3, 1]),
    ]),
    ("wool_neck", "a_head", [0, 19, -7], [("ruff", [-2.5, 18, -10.5], [5, 9, 4])]),
    ("m_ruff", "a_head", [0, 19, -7], [("mane", [-3, 20, -11], [6, 6, 5])]),
    *legs("a_", "leg", [2, 12, 2], 2, -6, 4, 12),
    # cria: long legs, short body, big head on a thin neck
    ("b_torso", "body", [0, 11, 0], [("b_torso", [-3, 9, -5], [6, 5, 10])]),
    ("b_tail", "body", [0, 13, 5], [("b_tail", [-0.5, 11, 5], [1, 2, 1])]),
    ("b_head", "body", [0, 13, -5], [
        ("b_neck", [-1, 13, -7], [2, 6, 2]),
        ("b_head", [-2, 18, -9], [4, 4, 4]),
        ("b_ear", [1, 22, -7], [1, 2, 1]),
        ("b_ear", [-2, 22, -7], [1, 2, 1]),
    ]),
    *legs("b_", "b_leg", [2, 9, 2], 1, -4, 3, 9),
]


def alpaca():
    def adult(p, sex):
        coat = (226, 214, 190) if sex == "female" else (176, 130, 92)
        shorn = mix(coat, (120, 96, 76), 0.25)
        curly = lambda f, i, j, w, h, fi: mix(coat, (255, 250, 240), 0.2) if (i + 2 * j) % 4 == 0 else coat
        p.paint("torso", flat(shorn))
        p.paint("fleece", curly)
        p.paint("ruff", curly)
        p.paint("mane", curly)
        p.paint("tail", curly)
        p.paint("neck", flat(shorn))
        p.paint("skull", flat(mix(coat, (255, 255, 255), 0.1)))
        p.paint("muzzle", flat((92, 74, 62)))
        p.paint("ear", flat(mix(coat, (0, 0, 0), 0.2)))
        p.paint("leg", lambda f, i, j, w, h, fi: (60, 48, 40) if j == h - 1 else shorn)
        plain_eyes(p, "skull", 1)

    def cria(p):
        coat = (236, 226, 206)
        p.paint("b_torso", flat(coat))
        p.paint("b_tail", flat(coat))
        p.paint("b_neck", flat(coat))
        p.paint("b_head", flat(coat))
        p.paint("b_ear", flat(mix(coat, (0, 0, 0), 0.2)))
        p.paint("b_leg", lambda f, i, j, w, h, fi: (90, 74, 62) if j == h - 1 else coat)
        plain_eyes(p, "b_head", 1)

    bones, tw, th = pack(ALPACA_BONES, 128)
    return bones, tw, th, adult, cria


BUILD = {"quail": lambda: poultry("quail"), "turkey": lambda: poultry("turkey"), "alpaca": alpaca}


def main(ids):
    for sid in ids:
        bones, tw, th, adult, young = BUILD[sid]()
        write_geo(sid, geo(sid, tw, th, bones, bounds=(2.5, 2.5) if sid == "alpaca" else (1.5, 1.5)))
        d = RP / "textures" / "entity" / "ranching" / sid
        for variant in ("female", "male", "baby"):
            p = Painter(tw, th, bones, f"{sid}-{variant}")
            adult(p, "female" if variant == "baby" else variant)
            young(p)
            p.save(d / f"{variant}.png")
        print(sid, f"{tw}x{th}")


if __name__ == "__main__":
    main(sys.argv[1:] or list(BUILD))
