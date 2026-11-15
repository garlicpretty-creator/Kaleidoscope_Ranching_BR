#!/usr/bin/env python3
"""Generates the chicken art sample: geometry, three textures and a preview sheet.

The model and its textures are described once here, so the geometry JSON, the
PNG textures and the preview image can never disagree.

Outputs
  packs/RP/models/entity/chicken.geo.json
  packs/RP/textures/entity/ranching/chicken/{hen,rooster,chick}.png
  docs/art/chicken_preview.png

Run with: python3 tools/gen_chicken.py
"""

import json
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
TEX_SIZE = 64

# --- Model ------------------------------------------------------------------
# Bedrock model space: Y up, the animal faces -Z. Sizes are (x, y, z) in pixels.
# Every cube is axis-aligned so the preview can be drawn without 3D maths.
# `part` names what a cube is, which decides how it is painted.

CUBES = [
    # bone,           part,      origin,            size,       uv
    ("body",          "body",    (-3, 4, -4),       (6, 6, 8),  (0, 0)),
    ("head",          "head",    (-2, 9, -7),       (4, 6, 3),  (0, 14)),
    ("head",          "beak",    (-1, 11, -9),      (2, 2, 2),  (14, 14)),
    ("hen_wattle",    "wattle",  (-1, 9, -8),       (2, 2, 1),  (22, 14)),
    ("hen_comb",      "comb",    (-1, 15, -6),      (2, 1, 2),  (28, 0)),
    ("rooster_comb",  "comb",    (-0.5, 15, -7),    (1, 3, 4),  (28, 3)),
    ("rooster_wattle", "wattle", (-1, 8, -8),       (2, 3, 1),  (28, 10)),
    ("wing_left",     "wing",    (3, 6, -3),        (1, 4, 6),  (0, 23)),
    ("wing_right",    "wing",    (-4, 6, -3),       (1, 4, 6),  (14, 23)),
    ("leg_left",      "leg",     (1, 0, -1),        (1, 4, 1),  (52, 0)),
    ("leg_left",      "toes",    (0, 0, -3),        (3, 1, 2),  (42, 0)),
    ("leg_right",     "leg",     (-2, 0, -1),       (1, 4, 1),  (52, 0)),
    ("leg_right",     "toes",    (-3, 0, -3),       (3, 1, 2),  (42, 0)),
    ("hen_tail",      "tail",    (-2, 8, 4),        (4, 3, 2),  (28, 14)),
    ("rooster_tail",  "tail",    (-1, 8, 4),        (2, 6, 3),  (0, 33)),
    ("rooster_tail",  "tail_tip", (-1, 11, 7),      (2, 5, 2),  (10, 33)),
]

BONES = {
    # name:           (parent,  pivot)
    "body":           (None,    (0, 7, 0)),
    "head":           ("body",  (0, 10, -4)),
    "hen_wattle":     ("head",  (0, 10, -7)),
    "hen_comb":       ("head",  (0, 15, -5)),
    "rooster_comb":   ("head",  (0, 15, -5)),
    "rooster_wattle": ("head",  (0, 10, -7)),
    "wing_left":      ("body",  (3, 10, 0)),
    "wing_right":     ("body",  (-3, 10, 0)),
    "leg_left":       ("body",  (1.5, 4, 0)),
    "leg_right":      ("body",  (-1.5, 4, 0)),
    "hen_tail":       ("body",  (0, 9, 4)),
    "rooster_tail":   ("body",  (0, 9, 4)),
}

# Which sex-specific bones each variant shows. Mirrors the render controller.
VISIBLE = {
    "hen": lambda bone: not bone.startswith("rooster_"),
    "rooster": lambda bone: not bone.startswith("hen_"),
    "chick": lambda bone: not bone.startswith("rooster_"),
}

# --- Palettes ---------------------------------------------------------------

PALETTES = {
    "hen": {
        "body": (238, 228, 206), "head": (242, 234, 214), "wing": (214, 196, 160),
        "tail": (196, 172, 130), "tail_tip": (196, 172, 130),
        "comb": (200, 58, 44), "wattle": (190, 50, 40),
        "beak": (232, 168, 60), "leg": (226, 176, 70), "toes": (226, 176, 70),
        "speckle": (176, 140, 96), "eye": (30, 24, 22),
    },
    "rooster": {
        "body": (150, 70, 38), "head": (214, 138, 46), "wing": (58, 78, 70),
        "tail": (34, 62, 56), "tail_tip": (26, 48, 46),
        "comb": (206, 44, 36), "wattle": (196, 40, 34),
        "beak": (236, 176, 64), "leg": (228, 180, 72), "toes": (228, 180, 72),
        "speckle": (108, 46, 26), "eye": (30, 24, 22),
    },
    "chick": {
        "body": (244, 214, 92), "head": (248, 224, 112), "wing": (236, 198, 76),
        "tail": (236, 198, 76), "tail_tip": (236, 198, 76),
        "comb": (248, 224, 112), "wattle": (248, 224, 112),
        "beak": (236, 150, 52), "leg": (236, 160, 60), "toes": (236, 160, 60),
        "speckle": (226, 188, 70), "eye": (30, 24, 22),
    },
}


def _hash(*values):
    """Deterministic pseudo-random value in [0, 1) so reruns give identical art."""
    h = 2166136261
    for value in values:
        for byte in str(value).encode():
            h = ((h ^ byte) * 16777619) & 0xFFFFFFFF
    return ((h ^ (h >> 15)) * 2246822519 & 0xFFFFFFFF) / 0xFFFFFFFF


def _shade(color, factor):
    return tuple(max(0, min(255, round(channel * factor))) for channel in color)


def texel(variant, part, face, a, b, w, h):
    """Colour of one texel.

    face is one of side/front/back/top/bottom. (a, b) are the texel's column
    and row on that face, with `a` measured from the animal's FRONT edge on
    side faces and tops, and `b` measured from the top edge. (w, h) is the
    face size.
    """
    palette = PALETTES[variant]
    color = palette[part]

    # Lighting: tops lighter, undersides darker, sides fade toward the bottom.
    if face == "top":
        factor = 1.08
    elif face == "bottom":
        factor = 0.78
    else:
        factor = 1.0 - 0.14 * (b / max(1, h - 1))
        if face == "back":
            factor *= 0.94

    # Feather texture: scattered darker flecks on the large surfaces.
    if part in ("body", "wing", "tail", "tail_tip") and face != "bottom":
        if _hash(variant, part, face, a, b) < 0.16:
            color = palette["speckle"]
    if part == "wing" and face == "side":
        # Layered flight feathers: darker bands toward the rear lower edge.
        if (a + b) % 3 == 0 and a > 1:
            factor *= 0.88
    if part in ("tail", "tail_tip") and variant == "rooster" and face == "side":
        # Sheen streaks on the sickle feathers.
        if (a + 2 * b) % 4 == 0:
            color = (52, 110, 96)

    if part == "body" and variant == "rooster" and face in ("side", "front") and b <= 1:
        # Golden hackle feathers spilling from the neck onto the shoulders.
        if face == "front" or a <= 3:
            color = palette["head"]
    if part == "body" and face == "side" and b >= h - 2 and variant != "chick":
        factor *= 0.93  # belly shadow

    if part == "head":
        if face == "side" and a == 1 and b == 2:
            return palette["eye"]
        if face == "front" and b == 2 and a in (0, w - 1):
            return palette["eye"]
        if variant == "rooster" and face in ("side", "back") and b >= 4:
            factor *= 0.9  # neck feathers darken toward the body

    if part == "comb" and variant != "chick" and face == "side":
        # Serrated comb: notch the top edge.
        if b == 0 and a % 2 == 1:
            factor *= 0.8

    if part == "beak" and face in ("side", "front") and b == h - 1:
        factor *= 0.86  # lower mandible

    factor *= 0.97 + 0.06 * _hash("grain", variant, part, face, a, b)
    return _shade(color, factor)


# --- Box-UV layout ----------------------------------------------------------

def faces(size, uv):
    """Box-UV rectangles of a cube: name -> (x, y, w, h, mapping).

    `mapping(i, j)` converts a pixel inside the rectangle to the (a, b) texel
    coordinates used by `texel`, so both mirrored side strips share one design
    and features such as the eye land near the front on both sides.
    """
    w, h, d = (max(1, round(v)) for v in size)
    u, v = uv
    return {
        # First strip: the cube's side whose right edge meets the front face.
        "side_a": (u, v + d, d, h, lambda i, j: ("side", d - 1 - i, j, d, h)),
        "front": (u + d, v + d, w, h, lambda i, j: ("front", i, j, w, h)),
        # Third strip: the opposite side, whose left edge meets the front face.
        "side_b": (u + d + w, v + d, d, h, lambda i, j: ("side", i, j, d, h)),
        "back": (u + d + w + d, v + d, w, h, lambda i, j: ("back", i, j, w, h)),
        # The top face's bottom edge meets the front face.
        "top": (u + d, v, w, d, lambda i, j: ("top", d - 1 - j, i, d, w)),
        "bottom": (u + d + w, v, w, d, lambda i, j: ("bottom", j, i, d, w)),
    }


def render_texture(variant):
    image = Image.new("RGBA", (TEX_SIZE, TEX_SIZE), (0, 0, 0, 0))
    painted = {}
    for bone, part, _origin, size, uv in CUBES:
        for name, (x, y, w, h, mapping) in faces(size, uv).items():
            for j in range(h):
                for i in range(w):
                    face, a, b, fw, fh = mapping(i, j)
                    px = (x + i, y + j)
                    assert 0 <= px[0] < TEX_SIZE and 0 <= px[1] < TEX_SIZE, f"{bone}/{part} leaves the texture"
                    # Mirrored legs intentionally share texels; anything else must not overlap.
                    owner = painted.setdefault(px, (part, uv))
                    assert owner == (part, uv), f"UV overlap at {px}: {owner} vs {(part, uv)}"
                    image.putpixel(px, texel(variant, part, face, a, b, fw, fh) + (255,))
    return image


# --- Geometry JSON ----------------------------------------------------------

def build_geometry():
    bones = []
    for name, (parent, pivot) in BONES.items():
        bone = {"name": name, "pivot": list(pivot)}
        if parent:
            bone["parent"] = parent
        cubes = []
        for cube_bone, part, origin, size, uv in CUBES:
            if cube_bone != name:
                continue
            cube = {"origin": list(origin), "size": list(size), "uv": list(uv)}
            # The right leg reuses the left leg's texels, mirrored.
            if name == "leg_right":
                cube["mirror"] = True
            cubes.append(cube)
        if cubes:
            bone["cubes"] = cubes
        bones.append(bone)

    return {
        "format_version": "1.12.0",
        "minecraft:geometry": [
            {
                "description": {
                    "identifier": "geometry.kaleidoscope_ranching.chicken",
                    "texture_width": TEX_SIZE,
                    "texture_height": TEX_SIZE,
                    "visible_bounds_width": 2,
                    "visible_bounds_height": 2,
                    "visible_bounds_offset": [0, 0.75, 0],
                },
                "bones": bones,
            }
        ],
    }


# --- Preview ----------------------------------------------------------------

def draw_view(canvas, variant, view, left, floor, scale):
    """Paints an orthographic view of one variant onto the preview canvas.

    view "side" looks at the animal's side with its front to the left;
    view "front" looks at its face.
    """
    visible = [c for c in CUBES if VISIBLE[variant](c[0])]
    if view == "side":
        # Nearer cubes (larger x) are painted last.
        visible.sort(key=lambda c: c[2][0] + c[3][0])
    else:
        # Nearer cubes (smaller z) are painted last.
        visible.sort(key=lambda c: -(c[2][2]))

    draw = ImageDraw.Draw(canvas)
    for _bone, part, origin, size, _uv in visible:
        ox, oy, oz = origin
        w, h, d = (max(1, round(v)) for v in size)
        if view == "side":
            face, cols, start = "side", d, oz
        else:
            face, cols, start = "front", w, -(ox + size[0])
        for j in range(h):
            for i in range(cols):
                color = texel(variant, part, face, i, j, cols, h)
                x0 = left + (start + i) * scale
                y0 = floor - (oy + h - j) * scale
                draw.rectangle([x0, y0, x0 + scale - 1, y0 + scale - 1], fill=color)


def render_preview(textures):
    scale = 14
    panel_w, panel_h = 300, 330
    margin = 24
    variants = ["rooster", "hen", "chick"]
    width = margin * 2 + panel_w * 3
    height = margin * 2 + panel_h * 2 + 150
    canvas = Image.new("RGB", (width, height), (232, 238, 226))
    draw = ImageDraw.Draw(canvas)

    for column, variant in enumerate(variants):
        # Chicks are shown at the half scale the game gives baby animals.
        variant_scale = scale // 2 if variant == "chick" else scale
        for row, view in enumerate(["side", "front"]):
            x = margin + column * panel_w
            y = margin + row * panel_h
            draw.rectangle([x + 6, y + 6, x + panel_w - 6, y + panel_h - 6], fill=(214, 224, 206))
            floor = y + panel_h - 60
            draw.rectangle([x + 6, floor, x + panel_w - 6, y + panel_h - 6], fill=(150, 178, 110))
            # The model is centred on its own origin in both views.
            draw_view(canvas, variant, view, x + panel_w // 2, floor, variant_scale)
            draw.text((x + 14, y + 12), f"{variant} / {view}", fill=(60, 70, 56))

    # Texture sheets, enlarged, along the bottom.
    sheet_y = margin + panel_h * 2 + 10
    for column, variant in enumerate(variants):
        sheet = textures[variant].resize((TEX_SIZE * 2, TEX_SIZE * 2), Image.NEAREST)
        x = margin + column * panel_w + (panel_w - sheet.width) // 2
        draw.rectangle([x - 2, sheet_y - 2, x + sheet.width + 1, sheet_y + sheet.height + 1], fill=(120, 130, 116))
        canvas.paste(sheet, (x, sheet_y), sheet)
    return canvas


def main():
    geo_path = ROOT / "packs/RP/models/entity/chicken.geo.json"
    geo_path.parent.mkdir(parents=True, exist_ok=True)
    geo_path.write_text(json.dumps(build_geometry(), indent=2) + "\n")

    tex_dir = ROOT / "packs/RP/textures/entity/ranching/chicken"
    tex_dir.mkdir(parents=True, exist_ok=True)
    textures = {}
    for variant in PALETTES:
        textures[variant] = render_texture(variant)
        textures[variant].save(tex_dir / f"{variant}.png")

    preview_path = ROOT / "docs/art/chicken_preview.png"
    preview_path.parent.mkdir(parents=True, exist_ok=True)
    render_preview(textures).save(preview_path)
    print(f"wrote {geo_path.relative_to(ROOT)}, 3 textures, {preview_path.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
