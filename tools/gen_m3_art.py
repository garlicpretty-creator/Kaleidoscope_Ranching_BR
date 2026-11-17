#!/usr/bin/env python3
"""Generates M3's art: item icons for every registry item not owned by M2,
the M3 block models and textures, their atlas fragments, and preview sheets.

Outputs
  packs/RP/textures/items/ranching/<id>.png
  packs/RP/models/blocks/kaleidoscope_ranching.<block>.geo.json
  packs/RP/textures/blocks/ranching/<block>.png
  tools/fragments/m3/{item_texture.json, terrain_texture.json, blocks.json}
  docs/art/m3_items.png, docs/art/m3_procedural_blocks_preview.png
  (docs/art/m3_blocks_preview.png shows the hand-made blocks and is not written here)

Run with: python3 tools/gen_m3_art.py
"""

import json
import shutil
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent / "art"))

from PIL import Image, ImageDraw  # noqa: E402

import blocks as block_art  # noqa: E402
import icons  # noqa: E402
from model import geometry_json, pack, render_texture, render_view  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
RP = ROOT / "packs" / "RP"
FRAGMENT = ROOT / "tools" / "fragments" / "m3"
HANDMADE = ROOT / "art" / "blocks"  # blocks with a hand-made model replace the procedural one
NS = "kaleidoscope_ranching"

SOUNDS = {
    "butcher_rack": "wood", "nest_box": "wood", "incubator": "glass", "butter_churn": "wood",
    "cheese_press": "wood", "aging_rack": "wood", "tanning_rack": "wood", "fermenting_jar": "glass", "pickling_vat": "stone",
    "hay_rack": "wood",
    "hitching_post": "wood",
    "cheese_wheel": "cloth", "pasture_post": "wood", "vintage_cheese_wheel": "cloth", "smoked_cheese_wheel": "cloth",
    "placed_pizza": "cloth", "placed_fondue": "metal",
    "placed_old_duck_soup": "stone", "placed_braised_brisket": "metal", "placed_yak_stew": "metal", "placed_goose_stew": "metal", "placed_lion_head_meatballs": "metal", "placed_claypot_rice": "stone", "placed_cheese_gratin": "stone", "placed_truffle_gratin": "stone",
    "placed_milk_wine": "bone", "placed_yak_milk_wine": "bone", "placed_cream_cocoa": "glass", "placed_yogurt_berry_drink": "glass",
    "placed_yogurt": "stone", "placed_milk_tea": "wood", "placed_milk_skin_tea": "stone",
    "food_waste_bin": "wood",
    "meat_grinder": "metal",
    "milking_rack": "wood",
    "cream_separator": "metal",
    "ice_cream_churn": "wood",
    "spinning_wheel": "wood",
    "weaving_loom": "wood",
    "silage_barrel": "wood",
    "rug": "cloth",
    "down_pillow": "cloth",
    "down_quilt": "cloth",
    "pen_gate": "wood",
    "pen_gate_top": "wood",
    "horn_decor": "bone",
}


# 1.1: blocks dyed by state get one tinted copy of their texture per colour
# (block_<colour>.png, atlas key kr_<block>_<colour>; tools/gen_blocks.mjs textureByState).
DYE = {
    "white": (240, 240, 236), "orange": (232, 130, 40), "magenta": (190, 70, 180), "light_blue": (110, 170, 220),
    "yellow": (240, 200, 50), "lime": (130, 200, 40), "pink": (236, 150, 170), "gray": (90, 96, 100),
    "light_gray": (160, 160, 154), "cyan": (40, 140, 150), "purple": (120, 50, 170), "blue": (50, 60, 160),
    "brown": (120, 80, 50), "green": (80, 110, 30), "red": (170, 40, 36), "black": (30, 30, 34),
}
DYED = {"rug": list(DYE)}


def tint(image, color):
    out = image.copy()
    px = out.load()
    for y in range(out.height):
        for x in range(out.width):
            r, g, b, a = px[x, y]
            if a:
                px[x, y] = (r * color[0] // 255, g * color[1] // 255, b * color[2] // 255, a)
    return out


def registry_items():
    """Ids of items this generator draws (registry items whose owner is not m2)."""
    script = (
        "import(process.argv[1]).then(m => console.log(JSON.stringify("
        "m.ITEMS.filter(i => i.owner !== 'm2').map(i => i.id))))"
    )
    url = (ROOT / "packs/BP/scripts/data/items.js").as_uri()
    out = subprocess.run(["node", "-e", script, url], check=True, capture_output=True, text=True)
    return json.loads(out.stdout)


def dish_looks():
    """{dish id: (shape, colour)} for M5 dishes and their uncooked steps."""
    script = (
        "import(process.argv[1]).then(m => console.log(JSON.stringify(Object.fromEntries(["
        "...m.DISHES.map(d => [d.id, d.look]),"
        "...m.DISH_PREPS.map(p => [p.id, ['bowl', p.id === 'egg_custard' ? [250, 210, 90] : [236, 220, 170]]])]))))"
    )
    url = (ROOT / "packs/BP/scripts/data/dishes.js").as_uri()
    out = subprocess.run(["node", "-e", script, url], check=True, capture_output=True, text=True)
    return {k: (v[0], tuple(v[1])) for k, v in json.loads(out.stdout).items()}


def handmade_materials(block_id):
    """Material instance names a hand-made block model's faces use, beyond the default `*`."""
    geo = HANDMADE / f"{block_id}.geo.json"
    if not geo.exists():
        return []
    names = set()
    for bone in json.loads(geo.read_text(encoding="utf8"))["minecraft:geometry"][0]["bones"]:
        for cube in bone.get("cubes", []):
            if isinstance(cube.get("uv"), dict):
                names.update(face["material_instance"] for face in cube["uv"].values() if "material_instance" in face)
    return sorted(names)


def write_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n")


def clean(directory, keep):
    directory.mkdir(parents=True, exist_ok=True)
    for stale in directory.glob("*.png"):
        # Light maps (<id>_mers / <id>_normal) belong to gen_pbr.py, which cleans its own.
        if stale.stem not in keep and not stale.stem.endswith(("_mers", "_normal")):
            stale.unlink()


def main():
    # Item icons
    ids = registry_items()
    icons.DISH_LOOKS.update(dish_looks())
    icon_dir = RP / "textures" / "items" / "ranching"
    clean(icon_dir, set(ids))
    item_atlas = {}
    sheet = Image.new("RGBA", (16 * 16 * 3, ((len(ids) + 15) // 16) * 16 * 3), (226, 232, 220, 255))
    for index, item_id in enumerate(ids):
        image = icons.draw(item_id)
        image.save(icon_dir / f"{item_id}.png")
        item_atlas[f"kr_{item_id}"] = {"textures": f"textures/items/ranching/{item_id}"}
        big = image.resize((48, 48), Image.NEAREST)
        sheet.alpha_composite(big, ((index % 16) * 48, (index // 16) * 48))
    sheet.save(ROOT / "docs" / "art" / "m3_items.png")

    # Blocks
    block_dir = RP / "textures" / "blocks" / "ranching"
    # Hand-made blocks with no procedural version (the placed cheese wheel) install the same way.
    blocks = dict(block_art.ALL)
    for geo in HANDMADE.glob("*.geo.json"):
        blocks.setdefault(geo.name.removesuffix(".geo.json"), None)
    blocks = dict(sorted(blocks.items()))
    extras = {block_id: handmade_materials(block_id) for block_id in blocks}
    clean(block_dir, set(blocks) | {f"{b}_{m}" for b, ms in extras.items() for m in ms}
          | {f"{b}_{c}" for b, colors in DYED.items() for c in colors})
    terrain = {}
    previews = []
    for block_id, build in blocks.items():
        terrain[f"kr_{block_id}"] = {"textures": f"textures/blocks/ranching/{block_id}"}
        handmade = HANDMADE / f"{block_id}.geo.json"
        if handmade.exists():
            # Hand-made (art_src/m4_scripts/*.py): install it as is.
            shutil.copyfile(handmade, RP / "models" / "blocks" / f"{NS}.{block_id}.geo.json")
            shutil.copyfile(HANDMADE / f"{block_id}.png", block_dir / f"{block_id}.png")
            # Faces with a material instance (the rack's carcasses) use <block>_<instance>.png.
            for material in extras[block_id]:
                name = f"{block_id}_{material}"
                shutil.copyfile(HANDMADE / f"{name}.png", block_dir / f"{name}.png")
                terrain[f"kr_{name}"] = {"textures": f"textures/blocks/ranching/{name}"}
            continue
        model = build()
        pack(model)
        write_json(RP / "models" / "blocks" / f"{NS}.{block_id}.geo.json", geometry_json(model))
        texture = render_texture(model, block_art.paint)
        texture.save(block_dir / f"{block_id}.png")
        for color in DYED.get(block_id, []):
            tint(texture, DYE[color]).save(block_dir / f"{block_id}_{color}.png")
            terrain[f"kr_{block_id}_{color}"] = {"textures": f"textures/blocks/ranching/{block_id}_{color}"}
        previews.append((block_id, render_view(model, block_art.paint, lambda cube: True, view="3/4", scale=7, size=(220, 240))))

    write_json(FRAGMENT / "item_texture.json", {"resource_pack_name": NS, "texture_name": "atlas.items", "texture_data": item_atlas})
    write_json(FRAGMENT / "terrain_texture.json", {"resource_pack_name": NS, "texture_name": "atlas.terrain", "texture_data": terrain})
    write_json(FRAGMENT / "blocks.json", {"format_version": "1.21.40", **{f"{NS}:{k}": {"sound": v} for k, v in SOUNDS.items()}})

    # Only procedurally drawn blocks are previewed here. The hand-made blocks have their own sheet
    # (docs/art/m3_blocks_preview.png, rendered from their models), which this must not overwrite.
    if previews:
        board = Image.new("RGB", (220 * 4, 260 * ((len(previews) + 3) // 4)), (232, 238, 226))
        draw = ImageDraw.Draw(board)
        for index, (block_id, image) in enumerate(previews):
            x, y = (index % 4) * 220, (index // 4) * 260
            board.paste(image, (x, y + 20))
            draw.text((x + 8, y + 4), block_id, fill=(60, 70, 56))
        board.save(ROOT / "docs" / "art" / "m3_procedural_blocks_preview.png")
    else:
        # Every block is hand-made: a sheet left from an earlier procedural block would be stale.
        (ROOT / "docs" / "art" / "m3_procedural_blocks_preview.png").unlink(missing_ok=True)
    print(f"gen_m3_art: {len(ids)} icons, {len(blocks)} blocks")


if __name__ == "__main__":
    main()
