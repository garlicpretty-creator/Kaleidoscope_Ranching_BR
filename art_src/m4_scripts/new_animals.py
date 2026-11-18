"""1.1 追加 新動物 (docs/1.1_追加企劃書.md 二): models and textures for the quail, the turkey and
the alpaca. Each has its own rig and painting: quail.py, turkey.py and alpaca.py.

- quail, turkey: the poultry bone names (a_/b_ head, torso, leg_left/right, wing_left/right), so
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
import turkey


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
    """autouv over a rig whose cubes may be None (bone pivots only); returns bones and sheet size.
    A cube's extras (inflate, rotation) stay after its UV."""
    raw = [(n, p, pv, [(c[0], c[1], c[2]) for c in (cubes or [])]) for n, p, pv, cubes in bones]
    packed, tw, th = autouv(raw, tw)
    th = max(th, tw // 2)
    out = [(n, p, pv, [(*c, *src[3:]) for c, src in zip(new, cubes)] if cubes else None)
           for (n, p, pv, cubes), (_, _, _, new) in zip(bones, packed)]
    return out, tw, th


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
# The alpaca has its own rig and painting in alpaca.py.

def alpaca():
    import alpaca as model
    return model.build()


BUILD = {"quail": lambda: poultry("quail"), "turkey": turkey.build, "alpaca": alpaca}


def main(ids):
    for sid in ids:
        bones, tw, th, adult, young = BUILD[sid]()
        data = geo(sid, tw, th, bones, bounds=(2.5, 2.5) if sid == "alpaca" else (1.5, 1.5))
        if sid == "turkey":
            turkey.finish(data)
        write_geo(sid, data)
        d = RP / "textures" / "entity" / "ranching" / sid
        for variant in ("female", "male", "baby"):
            p = Painter(tw, th, bones, f"{sid}-{variant}")
            adult(p, "female" if variant == "baby" else variant)
            young(p)
            p.save(d / f"{variant}.png")
        print(sid, f"{tw}x{th}")


if __name__ == "__main__":
    main(sys.argv[1:] or list(BUILD))
