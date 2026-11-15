"""Shared machinery for Ranching's procedural art.

A model is a list of axis-aligned cubes grouped into bones. From one model
description this module produces:

  * box-UV layout (packed automatically, so UVs never overlap),
  * Bedrock geometry JSON,
  * textures, by asking a painter for the colour of every texel,
  * an orthographic 3/4 preview.

Coordinates are Bedrock model pixels: Y up, the animal faces -Z.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field

from PIL import Image, ImageDraw


# --- Model description --------------------------------------------------------

@dataclass
class Cube:
    bone: str
    part: str  # what the cube is, e.g. "body", "eye", "horn"; decides its paint
    origin: tuple
    size: tuple
    mirror_of: str | None = None  # name of another cube whose texels this one reuses
    name: str | None = None  # needed only when another cube mirrors this one
    uv: tuple = (0, 0)  # filled in by pack()


@dataclass
class Bone:
    name: str
    parent: str | None
    pivot: tuple


@dataclass
class Model:
    identifier: str
    bones: list
    cubes: list
    tex_width: int = 64
    tex_height: int = 64
    bounds: tuple = (2.0, 2.0, 0.75)  # visible bounds width, height, y offset

    def bone(self, name):
        return next(bone for bone in self.bones if bone.name == name)


def box(size):
    w, h, d = (max(1, math.ceil(v)) for v in size)
    return w, h, d


def uv_extent(size):
    w, h, d = box(size)
    return 2 * (w + d), d + h


def pack(model: Model):
    """Assigns box UVs with a shelf packer and grows the texture until it fits."""
    owners = [cube for cube in model.cubes if cube.mirror_of is None]
    owners.sort(key=lambda cube: (-uv_extent(cube.size)[1], -uv_extent(cube.size)[0]))
    while True:
        x = y = shelf = 0
        ok = True
        for cube in owners:
            w, h = uv_extent(cube.size)
            if x + w > model.tex_width:
                x, y, shelf = 0, y + shelf, 0
            if w > model.tex_width or y + h > model.tex_height:
                ok = False
                break
            cube.uv = (x, y)
            x += w
            shelf = max(shelf, h)
        if ok:
            break
        if model.tex_height < model.tex_width:
            model.tex_height *= 2
        else:
            model.tex_width *= 2
    named = {cube.name: cube for cube in model.cubes if cube.name}
    for cube in model.cubes:
        if cube.mirror_of:
            source = named[cube.mirror_of]
            assert box(source.size) == box(cube.size), f"mirror size mismatch: {cube.name}"
            cube.uv = source.uv


# --- Faces ----------------------------------------------------------------------

@dataclass
class Texel:
    """One texel on one face, with everything a painter may need."""
    part: str
    face: str  # front | back | side | top | bottom
    point: tuple  # model-space centre of the texel
    a: int  # column on the face; on sides and tops, distance from the front edge
    b: int  # row on the face, from the top edge
    width: int
    height: int
    cube: Cube = field(repr=False)


NORMALS = {
    "front": (0, 0, -1), "back": (0, 0, 1), "east": (1, 0, 0), "west": (-1, 0, 0),
    "top": (0, 1, 0), "bottom": (0, -1, 0),
}


def faces(cube: Cube):
    """Yields (face_name, kind, u, v, w, h, mapper) for the six box-UV rectangles.

    mapper(i, j) -> Texel for pixel (i, j) inside the rectangle.
    """
    w, h, d = box(cube.size)
    ox, oy, oz = cube.origin
    sx, sy, sz = cube.size
    u, v = cube.uv

    def texel(kind, point, a, b, fw, fh):
        return Texel(cube.part, kind, point, a, b, fw, fh, cube)

    yield ("east", "side", u, v + d, d, h,
           lambda i, j: texel("side", (ox + sx, oy + sy - (j + .5) * sy / h, oz + sz - (i + .5) * sz / d), d - 1 - i, j, d, h))
    yield ("front", "front", u + d, v + d, w, h,
           lambda i, j: texel("front", (ox + sx - (i + .5) * sx / w, oy + sy - (j + .5) * sy / h, oz), i, j, w, h))
    yield ("west", "side", u + d + w, v + d, d, h,
           lambda i, j: texel("side", (ox, oy + sy - (j + .5) * sy / h, oz + (i + .5) * sz / d), i, j, d, h))
    yield ("back", "back", u + 2 * d + w, v + d, w, h,
           lambda i, j: texel("back", (ox + (i + .5) * sx / w, oy + sy - (j + .5) * sy / h, oz + sz), i, j, w, h))
    yield ("top", "top", u + d, v, w, d,
           lambda i, j: texel("top", (ox + sx - (i + .5) * sx / w, oy + sy, oz + sz - (j + .5) * sz / d), d - 1 - j, i, d, w))
    yield ("bottom", "bottom", u + d + w, v, w, d,
           lambda i, j: texel("bottom", (ox + sx - (i + .5) * sx / w, oy, oz + sz - (j + .5) * sz / d), d - 1 - j, i, d, w))


# --- Noise and colour helpers ---------------------------------------------------

def hash01(*values):
    """Deterministic pseudo-random number in [0, 1)."""
    h = 2166136261
    for value in values:
        for byte in repr(value).encode():
            h = ((h ^ byte) * 16777619) & 0xFFFFFFFF
    h ^= h >> 15
    h = (h * 2246822519) & 0xFFFFFFFF
    h ^= h >> 13
    return h / 0x100000000


def noise3(x, y, z, seed=0):
    """Smooth value noise in [0, 1)."""
    x0, y0, z0 = math.floor(x), math.floor(y), math.floor(z)
    fx, fy, fz = x - x0, y - y0, z - z0
    sx, sy, sz = (t * t * (3 - 2 * t) for t in (fx, fy, fz))

    def corner(i, j, k):
        return hash01(seed, x0 + i, y0 + j, z0 + k)

    def lerp(a, b, t):
        return a + (b - a) * t

    return lerp(
        lerp(lerp(corner(0, 0, 0), corner(1, 0, 0), sx), lerp(corner(0, 1, 0), corner(1, 1, 0), sx), sy),
        lerp(lerp(corner(0, 0, 1), corner(1, 0, 1), sx), lerp(corner(0, 1, 1), corner(1, 1, 1), sx), sy),
        sz,
    )


def shade(color, factor):
    return tuple(max(0, min(255, round(channel * factor))) for channel in color[:3])


def mix(a, b, t):
    return tuple(round(x + (y - x) * t) for x, y in zip(a[:3], b[:3]))


FACE_LIGHT = {"top": 1.08, "front": 1.0, "side": 0.96, "back": 0.92, "bottom": 0.74}


# --- Textures -------------------------------------------------------------------

def render_texture(model: Model, painter, visible=lambda cube: True):
    """Paints every texel of every visible cube; other texels stay transparent."""
    image = Image.new("RGBA", (model.tex_width, model.tex_height), (0, 0, 0, 0))
    owner = {}
    for cube in model.cubes:
        if cube.mirror_of or not visible(cube):
            continue
        for _name, _kind, u, v, w, h, mapper in faces(cube):
            for j in range(h):
                for i in range(w):
                    pixel = (u + i, v + j)
                    assert pixel not in owner, f"UV overlap at {pixel}: {owner[pixel]} and {cube.part}"
                    owner[pixel] = cube.part
                    color = painter(mapper(i, j))
                    if color is not None:
                        image.putpixel(pixel, tuple(color[:3]) + ((color[3],) if len(color) == 4 else (255,)))
    return image


# --- Geometry JSON --------------------------------------------------------------

def geometry_json(model: Model):
    bones = []
    for bone in model.bones:
        entry = {"name": bone.name, "pivot": list(bone.pivot)}
        if bone.parent:
            entry["parent"] = bone.parent
        cubes = []
        for cube in model.cubes:
            if cube.bone != bone.name:
                continue
            data = {"origin": list(cube.origin), "size": list(cube.size), "uv": list(cube.uv)}
            if cube.mirror_of:
                data["mirror"] = True
            cubes.append(data)
        if cubes:
            entry["cubes"] = cubes
        bones.append(entry)
    width, height, offset = model.bounds
    return {
        "format_version": "1.12.0",
        "minecraft:geometry": [
            {
                "description": {
                    "identifier": model.identifier,
                    "texture_width": model.tex_width,
                    "texture_height": model.tex_height,
                    "visible_bounds_width": width,
                    "visible_bounds_height": height,
                    "visible_bounds_offset": [0, offset, 0],
                },
                "bones": bones,
            }
        ],
    }


# --- Preview --------------------------------------------------------------------

def _norm(v):
    length = math.sqrt(sum(c * c for c in v))
    return tuple(c / length for c in v)


def _cross(a, b):
    return (a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0])


def _dot(a, b):
    return sum(x * y for x, y in zip(a, b))


VIEWS = {
    "3/4": (0.75, 0.55, -1.0),
    "side": (1.0, 0.0001, 0.0),
    "front": (0.0001, 0.0001, -1.0),
}


def render_view(model: Model, painter, visible, view="3/4", scale=10, size=(300, 260), model_scale=1.0,
                background=(214, 224, 206)):
    """Orthographic view of the textured model. Returns an RGB image."""
    camera = _norm(VIEWS[view])
    forward = tuple(-c for c in camera)
    right = _norm(_cross(forward, (0, 1, 0)))
    up = _cross(right, forward)

    quads = []
    for cube in model.cubes:
        if not visible(cube):
            continue
        source = cube
        if cube.mirror_of:
            source = next(c for c in model.cubes if c.name == cube.mirror_of)
        ox, oy, oz = cube.origin
        sx, sy, sz = cube.size
        for name, _kind, _u, _v, w, h, mapper in faces(cube):
            normal = NORMALS[name]
            if _dot(normal, camera) <= 0.02:
                continue
            for j in range(h):
                for i in range(w):
                    texel = mapper(i, j)
                    if cube is not source:
                        # Paint as the mirrored source would, at this cube's position.
                        texel.part = source.part
                    color = painter(texel)
                    if color is None or (len(color) == 4 and color[3] == 0):
                        continue
                    px, py, pz = texel.point
                    # Half-texel extents along the face's two in-plane axes.
                    if name in ("front", "back"):
                        du, dv = (sx / w / 2, 0, 0), (0, sy / h / 2, 0)
                    elif name in ("east", "west"):
                        du, dv = (0, 0, sz / d_(cube) / 2), (0, sy / h / 2, 0)
                    else:
                        du, dv = (sx / w / 2, 0, 0), (0, 0, sz / d_(cube) / 2)
                    corners = []
                    for su, sv in ((-1, -1), (1, -1), (1, 1), (-1, 1)):
                        p = tuple((c + su * a + sv * b) * model_scale for c, a, b in zip((px, py, pz), du, dv))
                        corners.append(p)
                    depth = _dot(tuple(c * model_scale for c in texel.point), forward)
                    quads.append((depth, corners, color[:3]))

    image = Image.new("RGB", size, background)
    draw = ImageDraw.Draw(image)
    floor_y = size[1] - 40
    draw.rectangle([0, floor_y, size[0], size[1]], fill=(150, 178, 110))
    centre_x = size[0] / 2
    for depth, corners, color in sorted(quads, key=lambda q: -q[0]):
        points = [(centre_x + _dot(p, right) * scale, floor_y - _dot(p, up) * scale) for p in corners]
        draw.polygon(points, fill=color, outline=color)
    return image


def d_(cube):
    return box(cube.size)[2]
