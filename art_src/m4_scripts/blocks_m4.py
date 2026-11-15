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


def grain(p, name, base, dark, p_dark=0.18):
    """Wood: vertical-ish streaks with darker knots."""
    p.cube(name, base, 7, dark, p_dark)


def ends(p, name, color, faces=("top", "bottom")):
    for fc in p.cubes[name]:
        for f in faces:
            p.rect(fc[f], color, 5)


def paint_hay_rack():
    p = Painter(64, 64, HAY_RACK, "hay_rack")
    for n in ("leg", "rail", "siderail", "slat"):
        grain(p, n, WOOD, WOOD_DK)
    ends(p, "leg", WOOD_LT)
    grain(p, "trough", WOOD_DK, (80, 52, 30), 0.25)
    for n in ("hay", "tuft"):
        p.cube(n, HAY, 14, HAY_DK, 0.35)
        for fc in p.cubes[n]:  # a few green stalks
            for f in ("top", "north", "south"):
                x0, y0, w, h = fc[f]
                for _ in range(max(1, w * h // 12)):
                    p.px(x0 + p.rng.randrange(w), y0 + p.rng.randrange(h), (150, 170, 80), 10)
    return p


def paint_hitching_post():
    p = Painter(64, 64, HITCHING_POST, "hitching_post")
    p.cube("base", STONE, 10, (104, 102, 98), 0.3)
    grain(p, "pole", WOOD, WOOD_DK, 0.22)
    ends(p, "pole", WOOD_LT)
    grain(p, "cap", WOOD_DK, (80, 52, 30))
    p.cube("rope", (196, 168, 110), 8)
    for fc in p.cubes["rope"]:  # twisted rope bands
        for f in ("north", "south", "east", "west"):
            x0, y0, w, h = fc[f]
            for x in range(x0, x0 + w, 2):
                p.px(x, y0, (150, 124, 78), 4)
    for n in ("staple", "ring_h", "ring_v"):
        p.cube(n, IRON, 8, IRON_DK, 0.25)
    return p


def paint_animal_crate():
    p = Painter(64, 64, ANIMAL_CRATE, "animal_crate")
    grain(p, "corner", WOOD_DK, (80, 52, 30))
    grain(p, "panel", WOOD, WOOD_DK)
    for fc in p.cubes["panel"]:  # plank seams on the lid and floor
        for f in ("top", "bottom"):
            x0, y0, w, h = fc[f]
            for x in range(x0 + 3, x0 + w, 4):
                p.rect((x, y0, 1, h), WOOD_DK, 4)
    grain(p, "slat_fb", WOOD_LT, WOOD)
    grain(p, "slat_side", WOOD_LT, WOOD)
    p.cube("handle", (196, 168, 110), 6)  # rope handle
    p.cube("straw", HAY, 12, HAY_DK, 0.35)
    # the animal is seen in shadow through the gaps, so keep it dark and neutral
    p.cube("animal", (92, 76, 64), 8, (74, 60, 50), 0.3)
    p.cube("animal_head", (92, 76, 64), 8)
    x0, y0, w, h = p.face("animal_head", "north")
    p.px(x0 + 1, y0 + 1, (230, 220, 200))
    p.px(x0 + w - 2, y0 + 1, (230, 220, 200))
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
