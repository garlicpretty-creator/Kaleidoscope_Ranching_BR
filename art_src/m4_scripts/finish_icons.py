"""Finishes the picked RetroDiffusion icons so they match the pack's icons (dark outline),
adds the hitching post's iron ring, and installs all three into the resource pack."""
import json, shutil, sys
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "rd_test" / "m4_blocks"
DST = ROOT / "packs" / "RP" / "textures" / "items" / "ranching"
OUTLINE = (40, 30, 28, 255)

PICKS = {"hay_rack": "hay_rack_3.png", "hitching_post": "hitching_post_3.png", "animal_crate": "crate_hand.png"}


def clean(img):
    """Hard alpha (no half-transparent pixels) and an outline around the silhouette."""
    img = img.convert("RGBA")
    px = img.load()
    for y in range(16):
        for x in range(16):
            r, g, b, a = px[x, y]
            px[x, y] = (r, g, b, 255) if a >= 128 else (0, 0, 0, 0)
    src = img.copy().load()
    for y in range(16):
        for x in range(16):
            if src[x, y][3] == 0:
                continue
            if any(not (0 <= x + dx < 16 and 0 <= y + dy < 16) or src[x + dx, y + dy][3] == 0
                   for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                # soft "sel-out" edge: a darker shade of the pixel itself instead of one flat black line
                r, g, b, _ = src[x, y]
                px[x, y] = (int(r * 0.62), int(g * 0.58), int(b * 0.55), 255)
    return img


def add_ring(img):
    """Small iron ring hanging from the front of the post."""
    px = img.load()
    xs = [x for x in range(16) for y in range(16) if px[x, y][3]]
    cx = (min(xs) + max(xs)) // 2
    iron, dark = (170, 170, 178, 255), (90, 90, 98, 255)
    for x, y, c in ((cx - 2, 8, iron), (cx - 3, 9, iron), (cx - 3, 10, dark), (cx - 2, 11, dark), (cx - 1, 10, iron)):
        if 0 <= x < 16:
            px[x, y] = c
    return img


def main():
    entries = {}
    for bid, name in PICKS.items():
        img = Image.open(SRC / name).convert("RGBA")
        if bid == "hitching_post":
            img = add_ring(img)
        img = clean(img)
        img.save(DST / f"{bid}.png")
        entries[f"kr_{bid}"] = {"textures": f"textures/items/ranching/{bid}"}
    frag = ROOT / "tools" / "fragments" / "m4" / "item_texture.json"
    frag.write_text(json.dumps({"texture_data": entries}, indent=2) + "\n", encoding="utf8")
    print("ok", list(entries))


if __name__ == "__main__":
    main()
