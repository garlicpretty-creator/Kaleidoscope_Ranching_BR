"""M4 blocks: hay rack, hitching post, animal crate. Writes geometry, textures and the m4 fragment."""
import json
from pathlib import Path
from boxuv import Painter

ROOT = Path(r"D:\Kaleidoscope\KR")
RP = ROOT / "packs" / "RP"
NS = "kaleidoscope_ranching"

WOOD, WOOD_DK, WOOD_LT = (150, 100, 60), (104, 68, 40), (176, 124, 78)
HAY, HAY_DK = (222, 192, 92), (182, 150, 64)
IRON, IRON_DK = (156, 156, 162), (96, 96, 104)
STONE = (128, 126, 122)


def mirror_x(o, s):
    return [-(o[0] + s[0]), o[1], o[2]]


HAY_RACK = [
    ("rack", None, [0, 0, 0], [
        ("leg", [-8, 0, -6], [2, 13, 2], [0, 0]),
        ("leg", [6, 0, -6], [2, 13, 2], [0, 0]),
        ("leg", [-8, 0, 4], [2, 13, 2], [0, 0]),
        ("leg", [6, 0, 4], [2, 13, 2], [0, 0]),
        ("trough", [-6, 3, -4], [12, 2, 8], [8, 0]),
        ("rail", [-8, 12, -7], [16, 1, 1], [0, 16]),
        ("rail", [-8, 12, 6], [16, 1, 1], [0, 16]),
        ("siderail", [-8, 12, -6], [1, 1, 12], [34, 16]),
        ("siderail", [7, 12, -6], [1, 1, 12], [34, 16]),
        *[("slat", [x, 5, -6], [1, 7, 1], [0, 18]) for x in (-5, -2, 1, 4)],
        *[("slat", [x, 5, 5], [1, 7, 1], [0, 18]) for x in (-5, -2, 1, 4)],
    ]),
    # hay inside; a script can hide it when the rack is empty
    ("hay", "rack", [0, 5, 0], [
        ("hay", [-6, 5, -5], [12, 5, 10], [0, 32]),
        ("tuft", [-5, 10, -4], [10, 2, 8], [0, 48]),
    ]),
]

HITCHING_POST = [
    ("post", None, [0, 0, 0], [
        ("base", [-4, 0, -4], [8, 2, 8], [16, 8]),
        ("pole", [-2, 2, -2], [4, 12, 4], [0, 0]),
        ("cap", [-2.5, 14, -2.5], [5, 2, 5], [16, 0]),
        ("rope", [-2.5, 11, -2.5], [5, 1, 5], [36, 0]),
        # iron ring on the front face
        ("staple", [-0.5, 8, -3], [1, 1, 1], [12, 20]),
        ("ring_h", [-1, 8, -4], [2, 1, 1], [0, 20]),
        ("ring_h", [-1, 5, -4], [2, 1, 1], [0, 20]),
        ("ring_v", [-2, 6, -4], [1, 2, 1], [8, 23]),
        ("ring_v", [1, 6, -4], [1, 2, 1], [8, 23]),
    ]),
]

ANIMAL_CRATE = [
    ("crate", None, [0, 0, 0], [
        *[("corner", o, [2, 13, 2], [0, 0]) for o in ([-7, 0, -7], [5, 0, -7], [-7, 0, 5], [5, 0, 5])],
        ("panel", [-7, 0, -7], [14, 1, 14], [0, 15]),
        ("panel", [-7, 12, -7], [14, 1, 14], [0, 15]),
        *[("slat_fb", [-5, y, z], [10, 2, 1], [8, 0]) for y in (3, 7) for z in (-7, 6)],
        *[("slat_side", [x, y, -5], [1, 2, 10], [30, 0]) for y in (3, 7) for x in (-7, 6)],
        ("handle", [-3, 13, -1], [6, 1, 2], [8, 4]),
    ]),
    # shown while an animal is inside: straw bedding and a shadowed animal behind the slats
    ("occupied", "crate", [0, 1, 0], [
        ("straw", [-6, 1, -6], [12, 1, 12], [0, 32]),
        ("animal", [-4, 2, -3], [8, 6, 9], [0, 45]),
        ("animal_head", [-3, 4, -6], [6, 5, 3], [34, 45]),
    ]),
]


def block_geo(bid, bones):
    out = []
    for name, parent, pivot, cubes in bones:
        b = {"name": name, "pivot": pivot, "cubes": [{"origin": o, "size": s, "uv": uv} for _, o, s, uv in cubes]}
        if parent:
            b["parent"] = parent
        out.append(b)
    return {"format_version": "1.12.0", "minecraft:geometry": [{
        "description": {"identifier": f"geometry.{NS}.{bid}", "texture_width": 64, "texture_height": 64,
                        "visible_bounds_width": 2.0, "visible_bounds_height": 2.0, "visible_bounds_offset": [0, 0.75, 0]},
        "bones": out}]}


def mix(a, b, t):
    return tuple(int(x + (y - x) * t) for x, y in zip(a, b))


def wood(base, rings=None):
    """Planks/posts: grain lines running along the long axis, a darker bevel at the face edges,
    and end grain (rings) on the cut ends."""
    dark, light = mix(base, (30, 18, 10), 0.28), mix(base, (255, 230, 190), 0.14)

    def fn(f, i, j, w, h, fi):
        long_h = h >= w  # grain follows the face's longer side
        if rings and f in ("top", "bottom") and w <= 3 and h <= 3:
            return rings
        a, b = (i, j) if long_h else (j, i)
        span = w if long_h else h
        if a == 0 or a == span - 1:
            return mix(base, dark, 0.5)  # bevel
        if (a * 5 + b // 5) % 4 == 0:
            return dark
        if (a * 3 + b // 3) % 7 == 0:
            return light
        return base
    return fn


def hay(f, i, j, w, h, fi):
    """Loose straw: short streaks of three golds with the odd green stalk, scattered irregularly."""
    r = ((i * 73856093) ^ (j * 19349663) ^ sum(map(ord, f)) * 83492791) % 100
    if r < 6:
        return (150, 172, 80)
    if r < 30 or (r < 45 and (i + j) % 2 == 0):
        return HAY_DK
    if r > 82:
        return (246, 224, 136)
    return HAY


def rope(f, i, j, w, h, fi):
    return (160, 132, 82) if (i + j) % 2 == 0 else (214, 186, 124)


def iron(f, i, j, w, h, fi):
    if f == "top" or (i == 0 and j == 0):
        return (200, 200, 208)
    return IRON if j == 0 else IRON_DK


def stone(f, i, j, w, h, fi):
    """Cut stone slab with mortar seams."""
    mortar = (98, 96, 92)
    if f in ("top", "bottom"):
        return mortar if (i % 4 == 3 or j % 4 == 3) else mix(STONE, (150, 148, 144), ((i * 7 + j * 3) % 5) / 10)
    return mortar if j == h - 1 else STONE


def paint_hay_rack():
    p = Painter(64, 64, HAY_RACK, "hay_rack")
    p.paint("leg", wood(WOOD, rings=WOOD_LT))
    p.paint("rail", wood(WOOD))
    p.paint("siderail", wood(WOOD))
    p.paint("slat", wood(WOOD_LT))
    p.paint("trough", wood(WOOD_DK))
    p.paint("hay", hay)
    p.paint("tuft", hay)
    return p


def paint_hitching_post():
    p = Painter(64, 64, HITCHING_POST, "hitching_post")
    p.paint("base", stone)
    p.paint("pole", wood(WOOD, rings=WOOD_LT))
    p.paint("cap", wood(WOOD_DK))
    p.paint("rope", rope)
    for n in ("staple", "ring_h", "ring_v"):
        p.paint(n, iron)
    return p


def paint_animal_crate():
    p = Painter(64, 64, ANIMAL_CRATE, "animal_crate")
    p.paint("corner", wood(WOOD_DK, rings=mix(WOOD_DK, WOOD_LT, 0.5)))

    def panel(f, i, j, w, h, fi):
        if f in ("top", "bottom"):
            if i % 4 == 3:
                return mix(WOOD, (30, 18, 10), 0.4)  # plank seam
            if j in (1, h - 2) and i % 4 == 1:
                return (70, 66, 64)  # nail heads
        return wood(WOOD)(f, i, j, w, h, fi)
    p.paint("panel", panel)
    p.paint("slat_fb", wood(WOOD_LT))
    p.paint("slat_side", wood(WOOD_LT))
    p.paint("handle", rope)
    p.paint("straw", hay)
    # the animal is seen in shadow through the gaps, so keep it dark and neutral
    p.paint("animal", lambda f, i, j, w, h, fi: (84, 70, 60) if (i + j) % 3 else (98, 82, 70))
    p.paint("animal_head", lambda f, i, j, w, h, fi: (230, 220, 200) if (f == "north" and j == 1 and i in (1, w - 2)) else (92, 76, 64))
    return p


BLOCKS = {
    "hay_rack": (HAY_RACK, paint_hay_rack, "grass"),
    "hitching_post": (HITCHING_POST, paint_hitching_post, "wood"),
    "animal_crate": (ANIMAL_CRATE, paint_animal_crate, "wood"),
}


def main():
    terrain, sounds = {}, {"format_version": "1.21.40"}
    for bid, (bones, painter, sound) in BLOCKS.items():
        geo_path = RP / "models" / "blocks" / f"{NS}.{bid}.geo.json"
        geo_path.write_text(json.dumps(block_geo(bid, bones), indent=2) + "\n", encoding="utf8")
        painter().save(RP / "textures" / "blocks" / "ranching" / f"{bid}.png")
        terrain[f"kr_{bid}"] = {"textures": f"textures/blocks/ranching/{bid}"}
        sounds[f"{NS}:{bid}"] = {"sound": sound}
    frag = ROOT / "tools" / "fragments" / "m4"
    frag.mkdir(parents=True, exist_ok=True)
    (frag / "terrain_texture.json").write_text(json.dumps({"texture_data": terrain}, indent=2) + "\n", encoding="utf8")
    (frag / "blocks.json").write_text(json.dumps(sounds, indent=2) + "\n", encoding="utf8")
    print("ok")


if __name__ == "__main__":
    main()
