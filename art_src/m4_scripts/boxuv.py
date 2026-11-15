"""Shared helpers for the hand-built M4 animals: geometry JSON and box-UV painting."""
import json, random
from pathlib import Path
from PIL import Image

RP = Path(r"D:\Kaleidoscope\KR\packs\RP")


def geo(sid, tw, th, bones, bounds=(1.5, 1.5)):
    out = []
    for name, parent, pivot, cubes in bones:
        b = {"name": name, "pivot": pivot}
        if parent:
            b["parent"] = parent
        if cubes:
            b["cubes"] = [{"origin": o, "size": s, "uv": uv, **({"inflate": c[4]} if len(c) > 4 else {})}
                          for c in cubes for (_, o, s, uv) in [c[:4]]]
        out.append(b)
    return {"format_version": "1.12.0", "minecraft:geometry": [{
        "description": {"identifier": f"geometry.kaleidoscope_ranching.{sid}", "texture_width": tw, "texture_height": th,
                        "visible_bounds_width": bounds[0], "visible_bounds_height": bounds[1], "visible_bounds_offset": [0, bounds[1] / 3, 0]},
        "bones": out}]}


def faces(uv, size):
    u, v = uv
    w, h, d = [max(1, round(x)) for x in size]
    return {"top": (u + d, v, w, d), "bottom": (u + d + w, v, w, d),
            "east": (u, v + d, d, h), "north": (u + d, v + d, w, h),
            "west": (u + d + w, v + d, d, h), "south": (u + 2 * d + w, v + d, w, h)}


class Painter:
    def __init__(self, tw, th, bones, seed):
        self.img = Image.new("RGBA", (tw, th), (0, 0, 0, 0))
        self.rng = random.Random(seed)
        self.cubes = {}
        for _, _, _, cubes in bones:
            for c in cubes or []:
                self.cubes.setdefault(c[0], []).append(faces(c[3], c[2]))

    def px(self, x, y, c, amt=0):
        r = self.rng
        self.img.putpixel((x, y), tuple(max(0, min(255, v + r.randint(-amt, amt))) for v in c[:3]) + (255,))

    soft = 0.45  # scales noise and speckle: cleaner, cuter surfaces

    def rect(self, rect, color, amt=8, speck=None, p=0.0):
        amt, p = int(amt * self.soft), p * self.soft
        x0, y0, w, h = rect
        for y in range(y0, y0 + h):
            for x in range(x0, x0 + w):
                self.px(x, y, speck if speck and self.rng.random() < p else color, amt)

    def cube(self, name, color, amt=8, speck=None, p=0.0, only=None):
        for fc in self.cubes[name]:
            for f, r in fc.items():
                if only is None or f in only:
                    self.rect(r, color, amt, speck, p)

    def face(self, name, f, i=0):
        return self.cubes[name][i][f]

    def save(self, path):
        path.parent.mkdir(parents=True, exist_ok=True)
        self.img.save(path)


def cute_eyes(p, cube, row, inset=1, blush=None, size=2, rim=None):
    """Big eyes on both side faces: dark pupil, a white catch-light in the top front corner,
    optionally a pale rim (so eyes read on dark coats) and a blush pixel under the eye."""
    dark, shine = (26, 22, 26), (250, 250, 250)
    for f in ("east", "west"):
        x0, y0, w, h = p.face(cube, f)
        # the front of the head sits at the high-x end of the east face and the low-x end of the west face
        cols = [x0 + w - 1 - inset - i for i in range(size)] if f == "east" else [x0 + inset + i for i in range(size)]
        if rim:
            lo, hi = min(cols) - 1, max(cols) + 1
            for c in range(max(x0, lo), min(x0 + w - 1, hi) + 1):
                for r in range(max(0, row - 1), min(h - 1, row + size) + 1):
                    p.px(c, y0 + r, rim)
        for c in cols:
            for r in range(size):
                p.px(c, y0 + row + r, dark)
        p.px(cols[0], y0 + row, shine)
        if blush and row + size < h:
            p.px(cols[0], y0 + row + size, blush)
            if size > 1:
                p.px(cols[1], y0 + row + size, blush)


BLUSH = (242, 150, 150)


def write_geo(sid, data):
    p = RP / "models" / "entity" / f"{sid}.geo.json"
    p.write_text(json.dumps(data, indent=2) + "\n", encoding="utf8")
