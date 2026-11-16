#!/usr/bin/env python3
"""Makes every block model's texture square.

Block textures that were not square (64x128, 64x32, and the butcher rack's old
512x1024) came out with parts in the wrong colours or missing in game. This pads
each such texture with transparent pixels to a square and sets the model's
texture_width/height to match. UVs are in texture pixels, so they still point at
the same pixels and nothing moves.

Runs in `npm run generate` before gen_pbr.py (whose light maps follow the
padded size). Idempotent.

    python3 tools/square_block_textures.py
"""

import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
RP = ROOT / "packs" / "RP"
NS = "kaleidoscope_ranching"


def textures_of(block_id, geo):
    """The texture files a block model samples: <id>.png plus one per material instance."""
    names = {block_id}
    for bone in geo["bones"]:
        for cube in bone.get("cubes", []):
            if isinstance(cube.get("uv"), dict):
                names.update(f"{block_id}_{f['material_instance']}" for f in cube["uv"].values() if "material_instance" in f)
    return [RP / "textures" / "blocks" / "ranching" / f"{n}.png" for n in sorted(names)]


def main():
    changed = 0
    for path in sorted((RP / "models" / "blocks").glob(f"{NS}.*.geo.json")):
        block_id = path.name[len(NS) + 1 : -len(".geo.json")]
        data = json.loads(path.read_text(encoding="utf8"))
        geo = data["minecraft:geometry"][0]
        width, height = geo["description"]["texture_width"], geo["description"]["texture_height"]
        files = [f for f in textures_of(block_id, geo) if f.exists()]
        if width == height or not files:
            continue
        side = max(width, height)
        for file in files:
            image = Image.open(file).convert("RGBA")
            # The image may be larger than the model's texture size; keep the same ratio.
            scale = image.width / width
            square = Image.new("RGBA", (round(side * scale), round(side * scale)), (0, 0, 0, 0))
            square.alpha_composite(image, (0, 0))
            square.save(file)
        geo["description"]["texture_width"] = side
        geo["description"]["texture_height"] = side
        path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf8")
        changed += 1
        print(f"square_block_textures: {block_id}: {width}x{height} -> {side}x{side}")
    print(f"square_block_textures: {changed} block texture(s) made square")


if __name__ == "__main__":
    main()
