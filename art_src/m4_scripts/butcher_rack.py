"""Hand-made butcher rack: a timber gallows with an iron hook and a proper carcass per species.

Every species has two bones the block shows by state (packs/BP/blocks/r_butcher_rack.json):
  carcass_<x>  the whole dressed carcass
  cut_<x>      what is left after the first cuts: the top half, with a cut face showing
               marbled meat, a fat rim and the bone

Shapes by kind
  side   cow, buffalo, yak: a side of beef on the hook, shank up, round, ribbed loin, chuck
  whole  pig, sheep, goat: hung by both hind legs from a gambrel bar, headless, forelegs down
  bird   chicken, duck, goose: plucked, hung by the feet, wings tucked, neck down
  rabbit hung by the hind legs, long lean body

Writes art/blocks/butcher_rack.{geo.json,png}; tools/gen_m3_art.py installs it over the
procedural rack. UVs are packed automatically, so cubes can be added without hand layout.
"""
import json
from pathlib import Path
from boxuv import Painter
from blocks_m4 import wood, mix, WOOD, WOOD_DK, WOOD_LT

ROOT = Path(__file__).resolve().parents[2]
NS = "kaleidoscope_ranching"
TW, TH = 128, 128
HANG = 26  # underside of the hook

IRON, IRON_DK, IRON_LT = (150, 150, 158), (92, 92, 100), (200, 200, 208)
FAT, FAT_DK = (248, 236, 214), (226, 208, 182)
BONE = (240, 234, 220)

# kind, flesh, skin (outside of the carcass), size scale
SPECIES = {
    "cow": ("side", (176, 64, 58), (236, 214, 176), 0),
    "buffalo": ("side", (150, 50, 48), (226, 200, 166), 0),
    "yak": ("side", (158, 56, 52), (240, 222, 190), 0),
    "pig": ("whole", (236, 160, 150), (246, 196, 182), 1),
    "sheep": ("whole", (180, 78, 72), (240, 226, 204), 0),
    "goat": ("whole", (168, 72, 66), (232, 214, 190), 0),
    "chicken": ("bird", (244, 214, 190), (246, 214, 178), 0),
    "duck": ("bird", (236, 196, 170), (240, 206, 168), 0),
    "goose": ("bird", (240, 212, 186), (246, 222, 192), 1),
    "rabbit": ("rabbit", (200, 104, 96), (220, 150, 140), 0),
}
FEET = {"chicken": (232, 196, 92), "duck": (232, 146, 60), "goose": (236, 140, 56)}


def side(s, big):
    """(part, origin, size) list for the full carcass, and the parts kept once cut."""
    full = [
        ("shank", [-1, 22, -1], [2, 4, 2]),
        ("round", [-3, 15, -2.5], [6, 7, 5]),
        ("loin", [-2.5, 9, -2], [5, 6, 4]),
        ("chuck", [-3, 4, -2.5], [6, 5, 5]),
        ("fore", [-1, 2, -1], [2, 2, 2]),
    ]
    return full, ["shank", "round"]


def whole(s, big):
    w = 6 if big else 5  # the pig is the stout one
    d = 5 if big else 4
    x0, z0 = -w / 2, -d / 2
    full = [
        ("gambrel", [-3.5, 25, -0.5], [7, 1, 1]),
        ("leg_l", [-2.5, 20, -1], [2, 5, 2]),
        ("leg_r", [0.5, 20, -1], [2, 5, 2]),
        ("hip", [x0, 15, z0], [w, 5, d]),
        ("ribs", [x0 + 0.5, 9, z0 + 0.5], [w - 1, 6, d - 1]),
        ("shoulder", [x0, 6, z0], [w, 3, d]),
        ("fleg_l", [-2, 3, -1], [1, 3, 2]),
        ("fleg_r", [1, 3, -1], [1, 3, 2]),
    ]
    return full, ["gambrel", "leg_l", "leg_r", "hip"]


def bird(s, big):
    w, h = (5, 7) if big else (4, 6)
    neck = 5 if big else 3
    top = 21
    full = [
        ("foot_l", [-1.5, top, -0.5], [1, HANG - top, 1]),
        ("foot_r", [0.5, top, -0.5], [1, HANG - top, 1]),
        ("thigh", [-w / 2, top - 2, -w / 2 + 0.5], [w, 2, w - 1]),
        ("body", [-w / 2, top - 2 - h, -w / 2], [w, h, w]),
        ("wing_l", [-w / 2 - 1, top - 2 - h + 1, -1], [1, h - 2, 2]),
        ("wing_r", [w / 2, top - 2 - h + 1, -1], [1, h - 2, 2]),
        ("neck", [-0.5, top - 2 - h - neck, -0.5], [1, neck, 1]),
    ]
    return full, ["foot_l", "foot_r", "thigh"]


def rabbit(s, big):
    full = [
        ("leg_l", [-1.5, 20, -0.5], [1, 6, 1]),
        ("leg_r", [0.5, 20, -0.5], [1, 6, 1]),
        ("haunch", [-1.5, 17, -1.5], [3, 3, 3]),
        ("body", [-1, 10, -1], [2, 7, 2]),
        ("fleg", [-1, 8, -0.5], [2, 2, 1]),
    ]
    return full, ["leg_l", "leg_r", "haunch"]


SHAPES = {"side": side, "whole": whole, "bird": bird, "rabbit": rabbit}

FRAME = [
    ("post", [-8, 0, -1], [2, 30, 2]),
    ("post", [6, 0, -1], [2, 30, 2]),
    ("beam", [-8, 28, -1.5], [16, 2, 3]),
    ("brace", [-6, 24, -0.5], [3, 1, 1]),
    ("brace", [3, 24, -0.5], [3, 1, 1]),
    ("foot", [-8, 0, -4], [2, 1, 8]),
    ("foot", [6, 0, -4], [2, 1, 8]),
    ("hook", [-0.5, 26, -0.5], [1, 2, 1]),
]


class Packer:
    """Shelf packer for box-UV footprints; cubes with the same name and size share a region."""

    def __init__(self, w, h):
        self.w, self.h, self.x, self.y, self.row = w, h, 0, 0, 0
        self.seen = {}

    def place(self, name, size):
        key = (name, tuple(size))
        if key in self.seen:
            return self.seen[key]
        sw, sh, sd = [max(1, round(v)) for v in size]
        fw, fh = 2 * (sw + sd), sd + sh
        if self.x + fw > self.w:
            self.x, self.y, self.row = 0, self.y + self.row, 0
        if self.y + fh > self.h:
            raise SystemExit(f"butcher_rack: texture full at {name} {size}")
        uv = [self.x, self.y]
        self.x += fw
        self.row = max(self.row, fh)
        self.seen[key] = uv
        return uv


def build():
    pk = Packer(TW, TH)
    frame = [(f"frame_{n}", o, s, pk.place(f"frame_{n}", s)) for n, o, s in FRAME]
    bones = [("frame", None, [0, 0, 0], frame)]
    for sp, (kind, _flesh, _skin, big) in SPECIES.items():
        full, kept = SHAPES[kind](sp, big)
        cubes = {part: (f"{sp}_{part}", o, s, pk.place(f"{sp}_{part}", s)) for part, o, s in full}
        bones.append((f"carcass_{sp}", "frame", [0, HANG, 0], list(cubes.values())))
        cut = []
        for part, o, s in full:
            if part not in kept:
                continue
            if part == kept[-1]:
                # the lowest kept part is cut through: a separate cube whose underside is the cut face
                name = f"{sp}_cut"
                cut.append((name, o, s, pk.place(name, s)))
            else:
                cut.append(cubes[part])
        bones.append((f"cut_{sp}", "frame", [0, HANG, 0], cut))
    return bones


# --- painting -----------------------------------------------------------------


def hsh(*a):
    h = 2166136261
    for v in a:
        for ch in str(v):
            h = ((h ^ ord(ch)) * 16777619) & 0xFFFFFFFF
    return h


def meat(flesh, seed):
    """Lean meat with white fat seams that wander across the side faces."""
    dark = mix(flesh, (60, 10, 14), 0.25)

    def fn(f, i, j, w, h, fi):
        if f in ("top", "bottom"):
            return cut_face(flesh, i, j, w, h, seed)
        # thin horizontal fat seams, broken into short runs, one every five rows
        if (j + hsh(seed, f) % 5) % 5 == 0 and hsh(seed, f, i // 3, j) % 3:
            return mix(flesh, FAT, 0.75)
        if hsh(seed, "d", f, i, j) % 13 == 0:
            return dark
        return flesh
    return fn


def cut_face(flesh, i, j, w, h, seed):
    """Cross-section: fat rim, marbled lean, a round bone near the middle."""
    if i == 0 or j == 0 or i == w - 1 or j == h - 1:
        return FAT
    cx, cy = (w - 1) / 2, (h - 1) / 2
    if abs(i - cx) <= 0.5 and abs(j - cy) <= 0.5:
        return BONE
    if hsh(seed, "m", i, j) % 6 == 0:
        return mix(flesh, FAT, 0.6)
    return flesh


def skin(base, bumps=True, seed=""):
    """Plucked or scalded skin: pale, with goosebump dots and a darker crease at the base."""
    dk = mix(base, (120, 70, 50), 0.22)

    def fn(f, i, j, w, h, fi):
        if f == "bottom":
            return dk
        if bumps and hsh(seed, f, i, j) % 7 == 0:
            return mix(base, (200, 140, 110), 0.35)
        return base
    return fn


def ribbed(flesh, skin_c, seed):
    """Loin of a side: rib bones showing on the inner (north) face, fat cover outside."""
    def fn(f, i, j, w, h, fi):
        if f in ("top", "bottom"):
            return cut_face(flesh, i, j, w, h, seed)
        if f == "north":
            return BONE if j % 2 == 0 and 0 < i < w - 1 else flesh
        if f == "south":
            return mix(skin_c, FAT, 0.5) if hsh(seed, i, j) % 4 else FAT_DK
        return meat(flesh, seed)(f, i, j, w, h, fi)
    return fn


def solid(c, c2=None):
    def fn(f, i, j, w, h, fi):
        if c2 and (i + j) % 3 == 0:
            return c2
        return c
    return fn


def iron(f, i, j, w, h, fi):
    if f == "top":
        return IRON_LT
    return IRON if i == 0 else IRON_DK


def paint():
    bones = build()
    p = Painter(TW, TH, bones, "butcher_rack")
    p.paint("frame_post", wood(WOOD_DK, rings=WOOD))
    p.paint("frame_beam", wood(WOOD))
    p.paint("frame_brace", wood(WOOD))
    p.paint("frame_foot", wood(WOOD_DK))
    p.paint("frame_hook", iron)
    for sp, (kind, flesh, sk, big) in SPECIES.items():
        names = {c[0] for b in bones if b[0] in (f"carcass_{sp}", f"cut_{sp}") for c in b[3]}
        for name in names:
            part = name[len(sp) + 1:]
            if part == "cut":
                # underside is the cut face, sides match the part above it
                outer = skin(sk, seed=sp) if kind == "bird" or sp == "pig" else meat(flesh, sp)
                p.paint(name, lambda f, i, j, w, h, fi, o=outer, fl=flesh, sp=sp:
                        cut_face(fl, i, j, w, h, sp) if f == "bottom" else o(f, i, j, w, h, fi))
            elif part == "gambrel":
                p.paint(name, iron)
            elif part in ("shank", "fore") or (kind == "rabbit" and part in ("leg_l", "leg_r", "fleg")):
                p.paint(name, lambda f, i, j, w, h, fi, fl=flesh: BONE if f in ("top", "bottom") or j == 0 else mix(fl, FAT, 0.35))
            elif part in ("foot_l", "foot_r"):
                p.paint(name, solid(FEET[sp], mix(FEET[sp], (90, 60, 30), 0.25)))
            elif part == "loin":
                p.paint(name, ribbed(flesh, sk, sp))
            elif kind == "bird" or sp == "pig":
                p.paint(name, skin(sk, bumps=kind == "bird", seed=sp + part))
            elif kind == "whole" and part in ("leg_l", "leg_r", "fleg_l", "fleg_r"):
                p.paint(name, lambda f, i, j, w, h, fi, fl=flesh: BONE if f == "top" else mix(fl, FAT, 0.2))
            else:
                p.paint(name, meat(flesh, sp + part))
    return p, bones


def geo(bones):
    out = []
    for name, parent, pivot, cubes in bones:
        b = {"name": name, "pivot": pivot,
             "cubes": [{"origin": o, "size": s, "uv": uv} for _, o, s, uv in cubes]}
        if parent:
            b["parent"] = parent
        out.append(b)
    return {"format_version": "1.12.0", "minecraft:geometry": [{
        "description": {"identifier": f"geometry.{NS}.butcher_rack", "texture_width": TW, "texture_height": TH,
                        "visible_bounds_width": 2.0, "visible_bounds_height": 2.5, "visible_bounds_offset": [0, 1.0, 0]},
        "bones": out}]}


def main():
    out = ROOT / "art" / "blocks"
    out.mkdir(parents=True, exist_ok=True)
    p, bones = paint()
    (out / "butcher_rack.geo.json").write_text(json.dumps(geo(bones), indent=2) + "\n", encoding="utf8")
    p.save(out / "butcher_rack.png")
    print("butcher_rack: ok,", len(bones), "bones")


if __name__ == "__main__":
    main()
