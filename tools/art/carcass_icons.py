#!/usr/bin/env python3
"""Draws each carcass icon from the animal's own 3D model.

A carcass is the animal itself, so its icon is rendered from the game model
(packs/RP/models/entity/<animal>.geo.json) and the adult female texture: the
animal lying on its side, seen in 3/4 from a little above, like a mob
that has just fallen over. Every pixel of the icon is one ray, so the result
stays crisp pixel art; a dark outline like the other icons' goes round it.

Runs in `npm run generate` after the picked icons are applied, and overwrites
packs/RP/textures/items/ranching/<animal>_carcass.png. Preview sheet:
docs/art/carcass_icons.png.

    python3 tools/art/carcass_icons.py
"""

import json
import math
import subprocess
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
RP = ROOT / "packs" / "RP"
OUT = RP / "textures" / "items" / "ranching"
SIZE = 32  # icon pixels; a whole animal needs more than 16
MARGIN = 1  # room for the outline

# Bones never drawn on a carcass: the baby's parts, the male's extras, wool (a carcass is
# shown shorn), the udder and the saddle.
HIDDEN_PREFIXES = ("b_", "m_", "wool_", "lids_")
HIDDEN = {"saddle", "fa_udder"}

# Texture used for each animal; the rest use female.png.
TEXTURE = {"sheep": "female_white", "rabbit": "brown"}

# Pose: roll onto its side, then turn the body so it reads in 3/4.
ROLL = math.radians(90)
YAW = math.radians(60)
# Camera: a little above, looking down at the fallen animal.
TILT = math.radians(30)  # from level, looking down

LIGHT = (-0.45, 0.8, -0.4)
OUTLINE_FACTOR = 0.35


def animal_ids():
    script = "import(process.argv[1]).then(m => console.log(JSON.stringify(m.ANIMALS.map(a => a.id))))"
    url = (ROOT / "packs/BP/scripts/data/animals.js").as_uri()
    out = subprocess.run(["node", "-e", script, url], check=True, capture_output=True, text=True)
    return json.loads(out.stdout)


def norm(v):
    length = math.sqrt(sum(c * c for c in v))
    return tuple(c / length for c in v)


def dot(a, b):
    return sum(x * y for x, y in zip(a, b))


def cross(a, b):
    return (a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0])


def rot_z(p, a):
    c, s = math.cos(a), math.sin(a)
    return (p[0] * c - p[1] * s, p[0] * s + p[1] * c, p[2])


def rot_y(p, a):
    c, s = math.cos(a), math.sin(a)
    return (p[0] * c + p[2] * s, p[1], -p[0] * s + p[2] * c)


def to_world(p):
    return rot_y(rot_z(p, ROLL), YAW)


def to_model(p):
    return rot_z(rot_y(p, -YAW), -ROLL)


def shown(bones, name):
    while name:
        if name in HIDDEN or name.startswith(HIDDEN_PREFIXES):
            return False
        name = bones[name].get("parent")
    return True


def face_uvs(cube):
    """{face: (u, v, uv_w, uv_h)} for box or per-face UVs."""
    if isinstance(cube["uv"], dict):
        return {f: (*d["uv"], *d["uv_size"]) for f, d in cube["uv"].items()}
    u, v = cube["uv"]
    w, h, d = (round(s) for s in cube["size"])
    return {
        "north": (u + d, v + d, w, h), "east": (u, v + d, d, h), "south": (u + 2 * d + w, v + d, w, h),
        "west": (u + d + w, v + d, d, h), "up": (u + d, v, w, d), "down": (u + d + w, v + d, w, -d),
    }


def texel(face, cube, point):
    """(s, t) in 0..1 across the face's UV rectangle for a model-space point on that face."""
    (ox, oy, oz), (sx, sy, sz) = cube["origin"], cube["size"]
    x, y, z = point
    fx, fy, fz = (x - ox) / sx, (y - oy) / sy, (z - oz) / sz
    return {
        "north": (1 - fx, 1 - fy), "south": (fx, 1 - fy),
        "east": (1 - fz, 1 - fy), "west": (fz, 1 - fy),
        "up": (1 - fx, 1 - fz), "down": (1 - fx, fz),
    }[face]


NORMALS = {"east": (1, 0, 0), "west": (-1, 0, 0), "up": (0, 1, 0), "down": (0, -1, 0), "south": (0, 0, 1), "north": (0, 0, -1)}


def hit_box(origin, direction, lo, hi):
    """(t, face) of the ray's entry into the box, or None."""
    t0, t1, face = -math.inf, math.inf, None
    names = (("west", "east"), ("down", "up"), ("north", "south"))
    for i in range(3):
        if abs(direction[i]) < 1e-12:
            if not lo[i] <= origin[i] <= hi[i]:
                return None
            continue
        a = (lo[i] - origin[i]) / direction[i]
        b = (hi[i] - origin[i]) / direction[i]
        near = names[i][0] if a < b else names[i][1]
        if a > b:
            a, b = b, a
        if a > t0:
            t0, face = a, near
        t1 = min(t1, b)
        if t0 > t1:
            return None
    return (t0, face) if t1 > 0 else None


def render(animal):
    geo = json.loads((RP / "models" / "entity" / f"{animal}.geo.json").read_text(encoding="utf8"))["minecraft:geometry"][0]
    tex_w, tex_h = geo["description"]["texture_width"], geo["description"]["texture_height"]
    texture = Image.open(RP / "textures" / "entity" / "ranching" / animal / f"{TEXTURE.get(animal, 'female')}.png").convert("RGBA")
    scale_u, scale_v = texture.width / tex_w, texture.height / tex_h
    bones = {b["name"]: b for b in geo["bones"]}
    cubes = [c for b in geo["bones"] if shown(bones, b["name"]) for c in b.get("cubes", [])]

    # Camera basis in world space.
    forward = norm((0.0, -math.cos(TILT), math.sin(TILT)))
    right = norm(cross(forward, (0, 1, 0)))
    up = cross(right, forward)

    # Fit the projected model into the icon.
    corners = []
    for c in cubes:
        (ox, oy, oz), (sx, sy, sz) = c["origin"], c["size"]
        for dx in (0, sx):
            for dy in (0, sy):
                for dz in (0, sz):
                    corners.append(to_world((ox + dx, oy + dy, oz + dz)))
    xs = [dot(p, right) for p in corners]
    ys = [dot(p, up) for p in corners]
    span = max(max(xs) - min(xs), max(ys) - min(ys))
    pixel = span / (SIZE - 2 * MARGIN)
    cx, cy = (max(xs) + min(xs)) / 2, (max(ys) + min(ys)) / 2

    direction = to_model(forward)
    light = norm(LIGHT)
    image = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    for j in range(SIZE):
        for i in range(SIZE):
            a = cx + (i + 0.5 - SIZE / 2) * pixel
            b = cy - (j + 0.5 - SIZE / 2) * pixel
            start_world = tuple(r * a + u * b - f * 1000 for r, u, f in zip(right, up, forward))
            start = to_model(start_world)
            hits = []
            for c in cubes:
                (ox, oy, oz), (sx, sy, sz) = c["origin"], c["size"]
                hit = hit_box(start, direction, (ox, oy, oz), (ox + sx, oy + sy, oz + sz))
                if hit:
                    hits.append((hit[0], hit[1], c))
            for t, face, c in sorted(hits, key=lambda h: h[0]):
                point = tuple(s + d * t for s, d in zip(start, direction))
                s, tt = texel(face, c, point)
                u, v, uw, vh = face_uvs(c)[face]
                px = (u + min(max(s, 0), 0.999) * uw) * scale_u
                py = (v + min(max(tt, 0), 0.999) * vh) * scale_v
                color = texture.getpixel((min(int(px), texture.width - 1), min(int(py), texture.height - 1)))
                if color[3] < 128:
                    continue
                normal = to_world(NORMALS[face])
                shade = 0.62 + 0.45 * max(0.0, dot(normal, light))
                image.putpixel((i, j), tuple(min(255, round(ch * shade)) for ch in color[:3]) + (255,))
                break
    return outline(image)


def outline(image):
    """Dark edge round the silhouette, coloured from the pixel it borders, like the other icons."""
    px = image.load()
    out = image.copy()
    opx = out.load()
    for y in range(SIZE):
        for x in range(SIZE):
            if px[x, y][3]:
                continue
            near = [px[x + dx, y + dy] for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))
                    if 0 <= x + dx < SIZE and 0 <= y + dy < SIZE and px[x + dx, y + dy][3]]
            if near:
                r, g, b = (sum(c[k] for c in near) / len(near) for k in range(3))
                opx[x, y] = (round(r * OUTLINE_FACTOR), round(g * OUTLINE_FACTOR), round(b * OUTLINE_FACTOR), 255)
    return out


def main():
    animals = animal_ids()
    sheet = Image.new("RGBA", (len(animals) * SIZE * 4, SIZE * 4), (139, 139, 139, 255))
    for index, animal in enumerate(animals):
        icon = render(animal)
        icon.save(OUT / f"{animal}_carcass.png")
        sheet.alpha_composite(icon.resize((SIZE * 4, SIZE * 4), Image.NEAREST), (index * SIZE * 4, 0))
    sheet.save(ROOT / "docs" / "art" / "carcass_icons.png")
    print(f"carcass_icons: {len(animals)} icons from the animal models")


if __name__ == "__main__":
    main()
