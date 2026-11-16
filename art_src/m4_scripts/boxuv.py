"""Shared helpers for the hand-built M4 animals: geometry JSON and box-UV painting."""
import json, random
from pathlib import Path
from PIL import Image

RP = Path(__file__).resolve().parents[2] / "packs" / "RP"


def extras(c):
    """A cube tuple may end with a number (inflate) or a dict (rotation, pivot, inflate)."""
    if len(c) < 5:
        return {}
    return {"inflate": c[4]} if isinstance(c[4], (int, float)) else dict(c[4])


def geo(sid, tw, th, bones, bounds=(1.5, 1.5)):
    out = []
    for name, parent, pivot, cubes in bones:
        b = {"name": name, "pivot": pivot}
        if parent:
            b["parent"] = parent
        if cubes:
            b["cubes"] = [{"origin": c[1], "size": c[2], "uv": c[3], **extras(c)} for c in cubes]
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

    LIGHT = {"top": 1.10, "bottom": 0.70, "north": 1.0, "south": 0.90, "east": 0.95, "west": 0.95}

    def paint(self, name, fn, amt=4, only=None, light=True):
        """Paint every face of a cube from fn(face, i, j, w, h, fi) -> colour, where i/j are the
        pixel within the face, j counts down from its top and fi counts back from the head end on
        the side faces. Adds baked light: lit tops, darker undersides, a soft top-to-bottom fade."""
        for fc in self.cubes[name]:
            for f, (x0, y0, w, h) in fc.items():
                if only is not None and f not in only:
                    continue
                for j in range(h):
                    for i in range(w):
                        fi = (w - 1 - i) if f == "east" else i
                        c = fn(f, i, j, w, h, fi)
                        if c is None:
                            continue
                        k = 1.0
                        if light:
                            k = self.LIGHT[f]
                            if f in ("north", "south", "east", "west") and h > 1:
                                k *= 1.05 - 0.14 * j / (h - 1)
                        self.px(x0 + i, y0 + j, tuple(min(255, int(v * k)) for v in c[:3]), amt)

    def face(self, name, f, i=0):
        return self.cubes[name][i][f]

    def save(self, path):
        path.parent.mkdir(parents=True, exist_ok=True)
        self.img.save(path)


def plain_eyes(p, cube, row, color=(26, 22, 26)):
    """Vanilla-style eyes: small square eyes on the front face at the outer corners. Wide faces
    get a white pixel outside a dark one; narrow faces (5 or less) a single dark pixel."""
    x0, y0, w, h = p.face(cube, "north")
    row = min(row, h - 1)
    for left in (True, False):
        def col(k):
            return x0 + k if left else x0 + w - 1 - k
        if w >= 6:
            p.px(col(0), y0 + row, (238, 236, 232))
            p.px(col(1), y0 + row, color)
        else:
            p.px(col(0), y0 + row, color)




def write_geo(sid, data):
    p = RP / "models" / "entity" / f"{sid}.geo.json"
    p.write_text(json.dumps(data, indent=2) + "\n", encoding="utf8")
