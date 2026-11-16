#!/usr/bin/env python3
"""Vibrant Visuals materials for every Ranching texture: a per-pixel MERS image
(metalness, emissive, roughness, subsurface) and a normal map beside each colour
texture, tied together by a <name>.texture_set.json.

How a pixel's material is chosen
  1. The texture's path picks a base material (RULES below): fur for mammals, feathers
     for birds, wood for most hand-made blocks, glass for bottled dairy, and so on.
  2. Its colour can override that inside the texture (classify): neutral greys on
     hand-made blocks are iron fittings, pale cyan pixels on the incubator are glass and
     its lamp glows, yellow straw stays rough, the animals' eyes are wet and glossy,
     pink noses, udders and combs scatter light like skin, beaks and feet are keratin.
  3. Roughness then varies with the pixel's light/dark detail (crevices rougher, raised
     highlights smoother), and the normal map comes from the colour's luminance as a
     height field, scaled per material (fur and straw deep, glass and eyes flat).

Metal pixels get no subsurface (the game treats metal and subsurface as exclusive).
Normal maps use the DirectX convention (green = down), the same as NVIDIA's Minecraft
RTX texturing guide sets for its Substance setup; flip GREEN_UP if they look inverted in
game.

Outputs, beside each colour texture under packs/RP/textures/:
  <name>_mers.png, <name>_normal.png, <name>.texture_set.json (format 1.21.30)

Run with: python tools/gen_pbr.py   (last step of `npm run generate`)
"""
import colorsys
import json
import re
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
TEXTURES = ROOT / "packs" / "RP" / "textures"
SUFFIXES = ("_mers", "_normal")
GREEN_UP = False  # DirectX normal maps

# material: (metalness, emissive, roughness, subsurface, normal strength)
MATERIALS = {
    "metal": (230, 0, 70, 0, 1.0),
    "glazed": (0, 0, 70, 0, 0.6),
    "glass": (0, 0, 35, 0, 0.0),
    "water": (0, 0, 15, 0, 0.3),
    "stone": (0, 0, 175, 0, 2.5),
    "wood": (0, 0, 195, 0, 2.0),
    "straw": (0, 0, 225, 30, 2.5),
    "plant": (0, 0, 205, 70, 2.0),
    "dung": (0, 0, 235, 0, 2.5),
    "cloth": (0, 0, 238, 40, 1.5),
    "fat": (0, 0, 100, 110, 0.8),
    "bone": (0, 0, 140, 25, 1.2),
    "shell": (0, 0, 120, 30, 0.8),
    "meat": (0, 0, 105, 130, 1.2),
    "food": (0, 0, 165, 50, 1.5),
    "fur": (0, 0, 235, 45, 2.8),
    "feather": (0, 0, 215, 30, 2.2),
    "skin": (0, 0, 150, 120, 1.0),
    "eye": (0, 0, 25, 0, 0.0),
    "horn": (0, 0, 115, 30, 1.0),
    "glow": (0, 210, 60, 0, 0.0),
    "matte": (0, 0, 200, 0, 1.5),
}

# Texture path under textures/ (no extension) -> base material. First match wins.
RULES = [
    # M2 blocks (16x16, tiled)
    (r"^blocks/kaleidoscope_ranching/kr_(auto_feeder|auto_waterer)", "metal"),
    (r"^blocks/kaleidoscope_ranching/kr_water$", "water"),
    (r"^blocks/kaleidoscope_ranching/kr_(water_trough|salt_lick)$", "stone"),
    (r"^blocks/kaleidoscope_ranching/kr_(manure|compost_bin_top)", "dung"),
    (r"^blocks/kaleidoscope_ranching/kr_(feed_|alfalfa)", "plant"),
    (r"^blocks/kaleidoscope_ranching/", "wood"),
    # Hand-made blocks (box-UV atlases)
    (r"^blocks/ranching/auto_feeder$", "metal"),
    (r"^blocks/ranching/fermenting_jar$", "glazed"),
    (r"^blocks/ranching/cheese_wheel$", "fat"),
    (r"^blocks/ranching/", "wood"),
    # Items
    (r"^items/.*/(milking_pail|cowbell|manure_fork|ear_tag)$", "metal"),
    (r"^items/.*/(nursing_bottle|\w+_milk(_fine|_superb)?|cream|whey|yogurt)$", "glass"),
    (r"^items/.*/(butter|ghee|lard|beef_tallow|mutton_tallow|pork_fat|fresh_cheese|cheese_slice|aged_cheese_wheel)$", "fat"),
    (r"^items/.*/(large_bone|cattle_horn|billy_goat_horn|chicken_frame)$", "bone"),
    (r"^items/.*/(\w*egg(_fine|_superb)?|fertilized_\w+)$", "shell"),
    (r"^items/.*/(down|yak_hair|pig_bristle|raw_hide|sheep_skin|rabbit_hide|brush)$", "fur"),
    (r"^items/.*/pig_skin$", "skin"),
    (r"^items/.*/cooked_\w+$", "food"),
    (r"^items/.*/(\w+_meat|beef_\w+|pork_\w+|lamb_\w+|\w+_leg|\w+_wing|\w+_carcass|\w+_trotter)$", "meat"),
    (r"^items/.*/(manure|dried_yak_dung|food_waste|fertilizer)$", "dung"),
    (r"^items/.*/(forage|alfalfa\w*|mixed_feed|concentrate_feed|\w+_cake|carrot_chips|beet_sugar_cube)$", "plant"),
    (r"^items/", "food"),
    # Animals
    (r"^entity/ranching/(chicken|duck|goose)/", "feather"),
    (r"^entity/ranching/pig/", "skin"),
    (r"^entity/ranching/", "fur"),
    (r"^entity/", "matte"),
]
RULES = [(re.compile(p), m) for p, m in RULES]

# Textures whose neutral greys are iron fittings (hoops, hinges, blades, pans).
METAL_ACCENTS = re.compile(r"^blocks/ranching/(?!cheese_wheel$)")
GLASS_TEXTURES = re.compile(r"^blocks/ranching/incubator$")
EYE = (26, 22, 26)  # boxuv.plain_eyes
EYE_WHITE = (238, 236, 232)


def base_material(key):
    return next((m for pattern, m in RULES if pattern.search(key)), None)


def hsv(rgb):
    h, s, v = colorsys.rgb_to_hsv(*(c / 255 for c in rgb))
    return h * 360, s, v


def near(a, b, tol):
    return all(abs(x - y) <= tol for x, y in zip(a, b))


# Hand-made models whose bones glow: every pixel of those bones' cubes is emissive. The
# incubator's `busy` bone is the warming lamp and heater, only shown while it runs.
GLOW_BONES = {"blocks/ranching/incubator": ("kaleidoscope_ranching.incubator", {"busy"})}


def glow_mask(key, size):
    """Pixels covered by the glowing bones' cubes (box UV: 2*(d+w) wide, d+h tall)."""
    if key not in GLOW_BONES:
        return set()
    geo_name, bones = GLOW_BONES[key]
    geo = json.loads((ROOT / "packs" / "RP" / "models" / "blocks" / f"{geo_name}.geo.json").read_text(encoding="utf8"))
    mask = set()
    for bone in geo["minecraft:geometry"][0]["bones"]:
        if bone["name"] not in bones:
            continue
        for cube in bone.get("cubes", []):
            (u, v), (w, h, d) = cube["uv"], [max(1, round(s)) for s in cube["size"]]
            mask.update((x, y) for x in range(u, min(size[0], u + 2 * (d + w))) for y in range(v, min(size[1], v + d + h)))
    return mask


def classify(key, base, rgb, neighbours):
    h, s, v = hsv(rgb)
    if key.startswith("entity/"):
        if near(rgb, EYE, 4) or (near(rgb, EYE_WHITE, 3) and any(near(n, EYE, 4) for n in neighbours)):
            return "eye"
        if (h >= 330 or h < 20) and 0.18 < s < 0.7 and v > 0.5:
            return "skin"  # noses, udders, combs, wattles, pink pig skin
        if base == "feather" and 20 <= h < 58 and s > 0.5 and v > 0.45:
            return "horn"  # beaks and feet
        return base
    if GLASS_TEXTURES.search(key):
        if 175 < rgb[2] and rgb[2] >= rgb[0] + 10 and s < 0.25:
            return "glass"
    if METAL_ACCENTS.search(key) and s < 0.09 and 0.42 < v:
        return "metal"
    if base == "metal" and s > 0.25:
        return "straw" if 30 <= h < 65 else "food"  # feed showing through the feeder
    if base in ("wood", "metal") and 35 <= h < 62 and 0.35 < s and v > 0.55:
        return "straw"
    if base == "wood" and 80 <= h < 160 and s > 0.3:
        return "plant"  # greens: brine vegetables, scraps, alfalfa bits
    return base


def luminance(rgb):
    return (0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]) / 255


def build(path, key, base):
    img = Image.open(path).convert("RGBA")
    w, h = img.size
    px = img.load()
    tiled = key.startswith("blocks/kaleidoscope_ranching/") and w == h <= 32

    def at(x, y):
        if tiled:
            return px[x % w, y % h]
        if 0 <= x < w and 0 <= y < h:
            return px[x, y]
        return None

    lum = [[luminance(px[x, y][:3]) for x in range(w)] for y in range(h)]
    glowing = glow_mask(key, (w, h))

    def height(x, y, fallback):
        p = at(x, y)
        if p is None or p[3] < 16:
            return fallback
        return lum[y % h][x % w] if tiled else lum[y][x]

    mers = Image.new("RGBA", (w, h), (0, 0, 255, 0))
    normal = Image.new("RGB", (w, h), (128, 128, 255))
    mp, np_ = mers.load(), normal.load()
    for y in range(h):
        for x in range(w):
            p = px[x, y]
            if p[3] < 16:
                continue
            around = [q[:3] for q in (at(x - 1, y), at(x + 1, y), at(x, y - 1), at(x, y + 1)) if q and q[3] >= 16]
            material = "glow" if (x, y) in glowing else classify(key, base, p[:3], around)
            m, e, r, sss, strength = MATERIALS[material]
            c = lum[y][x]
            mean = sum(luminance(q) for q in around) / len(around) if around else c
            r = max(0, min(255, int(r + max(-22, min(22, (mean - c) * 140)))))
            mp[x, y] = (m, e, r, 0 if m > 0 else sss)
            dx = height(x + 1, y, c) - height(x - 1, y, c)
            dy = height(x, y + 1, c) - height(x, y - 1, c)
            # Image rows grow downward, so dy is the slope toward the bottom of the image. A
            # surface rising downward tilts its normal up the image: +green in OpenGL (green =
            # up the image), -green in DirectX (green = down the image).
            nx = -dx * strength
            ny = (dy if GREEN_UP else -dy) * strength
            length = (nx * nx + ny * ny + 1) ** 0.5
            np_[x, y] = tuple(int(round((v / length * 0.5 + 0.5) * 255)) for v in (nx, ny, 1))
    return mers, normal


def texture_files():
    for path in sorted(TEXTURES.rglob("*.png")):
        if path.stem.endswith(SUFFIXES):
            continue
        yield path, path.relative_to(TEXTURES).with_suffix("").as_posix()


def save_png(image, path, previous):
    """Save, but keep the previous file's bytes when the pixels are unchanged, so rerunning the
    generator on another machine (another PNG encoder) does not rewrite hundreds of files."""
    old = previous.get(path)
    if old is not None:
        import io
        with Image.open(io.BytesIO(old)) as prev:
            if prev.mode == image.mode and prev.size == image.size and prev.tobytes() == image.tobytes():
                path.write_bytes(old)
                return
    image.save(path)


def main():
    for stale in TEXTURES.rglob("*.texture_set.json"):
        stale.unlink()
    previous = {}
    for stale in TEXTURES.rglob("*.png"):
        if stale.stem.endswith(SUFFIXES):
            previous[stale] = stale.read_bytes()
            stale.unlink()
    written, counts = 0, {}
    for path, key in texture_files():
        base = base_material(key)
        if base is None:
            continue
        mers, normal = build(path, key, base)
        name = path.stem
        save_png(mers, path.with_name(f"{name}_mers.png"), previous)
        save_png(normal, path.with_name(f"{name}_normal.png"), previous)
        texture_set = {
            "format_version": "1.21.30",
            "minecraft:texture_set": {
                "color": name,
                "metalness_emissive_roughness_subsurface": f"{name}_mers",
                "normal": f"{name}_normal",
            },
        }
        path.with_name(f"{name}.texture_set.json").write_text(json.dumps(texture_set, indent=2) + "\n", encoding="utf8")
        counts[base] = counts.get(base, 0) + 1
        written += 1
    print(f"gen_pbr: {written} texture sets ({', '.join(f'{k} {v}' for k, v in sorted(counts.items()))})")


if __name__ == "__main__":
    main()
