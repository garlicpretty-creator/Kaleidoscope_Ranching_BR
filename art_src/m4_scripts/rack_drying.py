"""Meat air-drying on the butcher rack (1.1 掛架風乾): four pieces hung from the beam.

Adds the bones dry_1 … dry_4 to the hand-made rack (art/blocks/butcher_rack.geo.json) and
paints them into free rows of the frame's texture (art/blocks/butcher_rack.png). The block
shows dry_<n> while its `drying` state is n or more (tools/gen_blocks.mjs), so the rack shows
how many pieces hang on it. A piece is a strip of curing meat on a loop of twine; the four
differ a little in length and colour but stand for any of the things that can be dried, since
the block cannot hold a kind per slot (see gen_blocks.mjs).

The pieces hang in two rows, in front of and behind the gambrel, so they stay clear of it.

Run after editing, then `npm run generate` installs the rack. Running it again changes
nothing: the dry_ bones and their rows of the texture are replaced, the rest is left as is.
    python art_src/m4_scripts/rack_drying.py
"""
import json
from pathlib import Path

from PIL import Image

from autouv import lay_out
from boxuv import Painter, faces

ROOT = Path(__file__).resolve().parents[2]
GEO = ROOT / "art" / "blocks" / "butcher_rack.geo.json"
TEXTURE = ROOT / "art" / "blocks" / "butcher_rack.png"
ROW = 40  # the frame's own texels end above this row
BEAM, HANG = 28, 24  # underside of the beam; where the twine meets the meat

# slot: (x of its middle, front or back row, length of the strip, lean colour)
SLOTS = [
    (-4.5, "front", 7, (158, 54, 50)),
    (-1.5, "back", 6, (142, 46, 46)),
    (1.5, "front", 8, (150, 50, 44)),
    (4.5, "back", 6, (164, 62, 52)),
]
TWINE, TWINE_DK = (206, 186, 142), (164, 142, 100)
FAT = (236, 212, 176)


def mix(a, b, t):
    return tuple(int(x + (y - x) * t) for x, y in zip(a, b))


def pieces():
    """[(bone name, [(cube name, origin, size)])] for the four slots."""
    out = []
    for n, (x, row, length, _) in enumerate(SLOTS, 1):
        twine_z, meat_z = (-1.5, -2) if row == "front" else (0.5, 0)
        out.append((f"dry_{n}", [
            (f"twine_{n}", [x - 0.5, HANG, twine_z], [1, BEAM - HANG, 1]),
            (f"meat_{n}", [x - 1, HANG - length, meat_z], [2, length, 2]),
        ]))
    return out


def meat(lean, seed):
    def fn(f, i, j, w, h, fi):
        if f == "top":
            return TWINE_DK if (i + j) % 2 else mix(lean, (60, 14, 18), 0.2)
        if f == "bottom":
            return mix(lean, (60, 14, 18), 0.45)
        if j == 0:
            return TWINE  # tied round the top
        if f in ("north", "south") and i == (seed % 2) * (w - 1) and j < h - 1:
            return mix(lean, FAT, 0.8)  # a rim of fat down one edge
        if (i * 3 + j * 2 + seed) % 7 == 0:
            return mix(lean, FAT, 0.45)  # marbling
        dry = 0.1 + 0.25 * j / max(1, h - 1)  # darker and drier toward the tip
        return mix(lean, (70, 18, 20), dry)
    return fn


def main():
    data = json.loads(GEO.read_text(encoding="utf8"))
    geo = data["minecraft:geometry"][0]
    tw, th = geo["description"]["texture_width"], geo["description"]["texture_height"]
    slots = pieces()
    placed, used = lay_out([c for _, cubes in slots for c in cubes], tw, top=ROW)
    if used > th:
        raise SystemExit("rack_drying: no room left in the rack's texture")
    it = iter(placed)
    bones = [(name, "frame", [0, BEAM, 0], [next(it) for _ in cubes]) for name, cubes in slots]

    painter = Painter(tw, th, bones, "rack_drying")
    for n, (_, _, _, lean) in enumerate(SLOTS, 1):
        painter.paint(f"twine_{n}", lambda f, i, j, w, h, fi: TWINE if j % 2 == 0 else TWINE_DK, amt=3)
        painter.paint(f"meat_{n}", meat(lean, n), amt=5)

    texture = Image.open(TEXTURE).convert("RGBA")
    if texture.crop((0, 0, tw, ROW)).getbbox() is None or texture.size != (tw, th):
        raise SystemExit("rack_drying: unexpected rack texture")
    texture.paste(painter.img.crop((0, ROW, tw, th)), (0, ROW))
    texture.save(TEXTURE)

    def face_uvs(uv, size):
        out = {}
        for f, (x, y, w, h) in faces(uv, size).items():
            name = {"top": "up", "bottom": "down"}.get(f, f)
            out[name] = {"uv": [x, y + h], "uv_size": [w, -h]} if f == "bottom" else {"uv": [x, y], "uv_size": [w, h]}
        return out

    geo["bones"] = [b for b in geo["bones"] if not b["name"].startswith("dry_")]
    for name, parent, pivot, cubes in bones:
        geo["bones"].append({"name": name, "parent": parent, "pivot": pivot,
                             "cubes": [{"origin": o, "size": s, "uv": face_uvs(uv, s)} for _, o, s, uv in cubes]})
    GEO.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf8", newline="\n")
    print("rack_drying:", len(bones), "pieces")


if __name__ == "__main__":
    main()
