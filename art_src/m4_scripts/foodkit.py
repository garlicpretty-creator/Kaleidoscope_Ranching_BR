"""Shared helpers for the placeable food models (cheese_wheel.py, placed_food.py).

A Model collects bones and boxes; every box gets its own box-UV place and is painted by a
material: a function of the face and the model-space position of each texel, so a pattern runs
unbroken across the several boxes that make up one rounded shape, and cut faces line up.
"""
import json
import math
from pathlib import Path

from boxuv import Painter
from blocks_m3 import autouv, geo

ROOT = Path(__file__).resolve().parents[2]
SIDES = ("north", "south", "east", "west")

# A quarter of a stepped disc, as (x0, x1, z0, z1) in the +x +z quadrant.
R6 = [(0, 4, 0, 6), (4, 5, 0, 5), (5, 6, 0, 4)]
R5 = [(0, 3, 0, 5), (3, 4, 0, 4), (4, 5, 0, 3)]
RIM6 = [(0, 3, 5, 6), (3, 4, 4, 6), (4, 5, 3, 5), (5, 6, 0, 4)]  # R6 without R5
# (piece, x sign, z sign): piece_4 is taken first
QUARTERS = [(1, 1, 1), (2, 1, -1), (3, -1, 1), (4, -1, -1)]


def mix(a, b, t):
    return tuple(int(x + (y - x) * t) for x, y in zip(a, b))


def rnd(x, y, z, salt=0):
    """A steady 0..99 for the texel at (x, y, z)."""
    n = (math.floor(x) * 73856093) ^ (math.floor(y) * 19349663) ^ (math.floor(z) * 83492791) ^ (salt * 2654435761)
    return (n ^ (n >> 13)) % 100


def qbox(sx, sz, rect, y0, y1, cz=0):
    """A box given in the +x +z quadrant, mirrored into the quadrant (sx, sz) around (0, cz)."""
    x0, x1, z0, z1 = rect
    return [x0 if sx > 0 else -x1, y0, cz + (z0 if sz > 0 else -z1)], [x1 - x0, y1 - y0, z1 - z0]


def is_cut(f, x, z, cz=0):
    """A side face lying on one of the two planes the quarters meet on."""
    return (f in ("east", "west") and x == 0) or (f in ("north", "south") and z == cz)


def texel(mat, origin, size):
    """Turns a material fn(face, x, y, z) into a Painter fn for one box."""
    (x, y, z), (w, h, d) = origin, size
    x1, y1, z1 = x + w, y + h, z + d

    # Box UV as Bedrock and Blockbench lay it out (test_foodkit.py): the Painter's "east" strip
    # is the face at the cube's smallest x, its "west" strip the face at the largest x.
    def fn(f, i, j, fw, fh, fi):
        if f == "top":
            return mat(f, x + i + 0.5, y1, z1 - j - 0.5)
        if f == "bottom":
            return mat(f, x + i + 0.5, y, z1 - j - 0.5)
        if f == "north":
            return mat(f, x + i + 0.5, y1 - j - 0.5, z)
        if f == "south":
            return mat(f, x1 - i - 0.5, y1 - j - 0.5, z1)
        if f == "east":
            return mat(f, x, y1 - j - 0.5, z1 - i - 0.5)
        return mat(f, x1, y1 - j - 0.5, z + i + 0.5)
    return fn


class Model:
    def __init__(self, bid):
        self.bid, self.bones, self.index, self.mats = bid, [], {}, []

    def bone(self, name, parent=None, pivot=(0, 0, 0)):
        self.index[name] = len(self.bones)
        self.bones.append((name, parent, list(pivot), []))

    def box(self, bone, origin, size, mat, raw=False):
        """mat is fn(face, x, y, z); with raw, a Painter fn(face, i, j, w, h, fi)."""
        self.bones[self.index[bone]][3].append((f"c{len(self.mats)}", list(origin), list(size)))
        self.mats.append(mat if raw else texel(mat, origin, size))

    def save(self):
        for width in (64, 128, 256):
            bones, tw, th = autouv(self.bones, width)
            if th <= tw:
                break
        p = Painter(tw, tw, bones, self.bid)
        for k, fn in enumerate(self.mats):
            p.paint(f"c{k}", fn)
        out = ROOT / "art" / "blocks"
        (out / f"{self.bid}.geo.json").write_text(json.dumps(geo(self.bid, bones, tw, tw), indent=2) + "\n", encoding="utf8")
        p.save(out / f"{self.bid}.png")
        print(f"{self.bid}: {sum(len(b[3]) for b in bones)} boxes, {tw}x{tw}")
