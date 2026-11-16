#!/usr/bin/env python3
"""Generates M3's art: item icons for every registry item not owned by M2,
the M3 block models and textures, their atlas fragments, and preview sheets.

Outputs
  packs/RP/textures/items/ranching/<id>.png
  packs/RP/models/blocks/kaleidoscope_ranching.<block>.geo.json
  packs/RP/textures/blocks/ranching/<block>.png
  tools/fragments/m3/{item_texture.json, terrain_texture.json, blocks.json}
  docs/art/m3_items.png, docs/art/m3_blocks_preview.png

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
    "cheese_press": "wood", "aging_rack": "wood", "fermenting_jar": "glass", "pickling_vat": "stone",
    "hay_rack": "wood",
    "hitching_post": "wood",
}


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


def write_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n")


def clean(directory, keep):
    directory.mkdir(parents=True, exist_ok=True)
    for stale in directory.glob("*.png"):
        if stale.stem not in keep:
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
    clean(block_dir, set(block_art.ALL))
    terrain = {}
    previews = []
    for block_id, build in block_art.ALL.items():
        terrain[f"kr_{block_id}"] = {"textures": f"textures/blocks/ranching/{block_id}"}
        handmade = HANDMADE / f"{block_id}.geo.json"
        if handmade.exists():
            # Hand-made (art_src/m4_scripts/blocks_m3.py, blocks_m4.py, butcher_rack.py): install it as is.
            shutil.copyfile(handmade, RP / "models" / "blocks" / f"{NS}.{block_id}.geo.json")
            shutil.copyfile(HANDMADE / f"{block_id}.png", block_dir / f"{block_id}.png")
            continue
        model = build()
        pack(model)
        write_json(RP / "models" / "blocks" / f"{NS}.{block_id}.geo.json", geometry_json(model))
        texture = render_texture(model, block_art.paint)
        texture.save(block_dir / f"{block_id}.png")
        # Preview with every optional bone shown except the extra carcasses.
        def visible(cube, block_id=block_id):
            if block_id == "butcher_rack":
                return cube.bone in ("frame", "carcass_cow")
            return True
        previews.append((block_id, render_view(model, block_art.paint, visible, view="3/4", scale=7, size=(220, 240))))

    write_json(FRAGMENT / "item_texture.json", {"resource_pack_name": NS, "texture_name": "atlas.items", "texture_data": item_atlas})
    write_json(FRAGMENT / "terrain_texture.json", {"resource_pack_name": NS, "texture_name": "atlas.terrain", "texture_data": terrain})
    write_json(FRAGMENT / "blocks.json", {"format_version": "1.21.40", **{f"{NS}:{k}": {"sound": v} for k, v in SOUNDS.items()}})

    # Hand-made blocks have their preview rendered in Blockbench, so the sheet is only written
    # while some block is still procedural.
    if previews:
        board = Image.new("RGB", (220 * 4, 260 * ((len(previews) + 3) // 4)), (232, 238, 226))
        draw = ImageDraw.Draw(board)
        for index, (block_id, image) in enumerate(previews):
            x, y = (index % 4) * 220, (index // 4) * 260
            board.paste(image, (x, y + 20))
            draw.text((x + 8, y + 4), block_id, fill=(60, 70, 56))
        board.save(ROOT / "docs" / "art" / "m3_blocks_preview.png")
    print(f"gen_m3_art: {len(ids)} icons, {len(block_art.ALL)} blocks")


if __name__ == "__main__":
    main()
