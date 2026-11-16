"""Meat air-drying on the butcher rack (1.1 掛架風乾): four pieces hung from the beam.

Adds the drying bones to the hand-made rack (art/blocks/butcher_rack.geo.json) and paints them
into free rows of the frame's texture (art/blocks/butcher_rack.png):

  dry_<n>            slot n's loop of twine, shown while a piece hangs there
  dry_<n>_fresh      the strip as hung: bright red with white fat
  dry_<n>_half       half dry: dark red, the fat gone cream
  dry_<n>_dried      done, ready to take: deep brown, shrunk a texel, the fat amber

The block picks one look per slot from its `drying` and `drying_mix` states (tools/gen_blocks.mjs,
data/processing.js DRYING_LOOKS), driest in the first slots, so a player sees at a glance which
strips are nearly done. The four strips differ a little in length and colour but stand for any
of the things that can be dried, since the block cannot hold a kind per slot.

The pieces hang in two rows, in front of and behind the gambrel, so they stay clear of it.

A step of `npm run generate`, run before tools/gen_m3_art.py installs the rack, so the
pieces come back whenever art_src/m4_scripts/butcher_rack.py rewrites art/blocks/butcher_rack.*.
It adds the bones and paints their rows when they are missing or differ (clearing the texels
of the drying bones it replaces), and touches nothing when they are already in place. It stops
if the rows it paints are taken by anything other than earlier drying bones.
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

# slot: (x of its middle, front or back row, length of the strip, lean colour when fresh)
SLOTS = [
    (-4.5, "front", 7, (176, 56, 50)),
    (-1.5, "back", 6, (164, 48, 48)),
    (1.5, "front", 8, (170, 52, 46)),
    (4.5, "back", 6, (182, 64, 54)),
]
TWINE, TWINE_DK = (206, 186, 142), (164, 142, 100)

# stage: (lean colour from the fresh one, fat colour, how much shorter the strip is)
STAGES = {
    "fresh": (lambda lean: lean, (238, 216, 184), 0),
    "half": (lambda lean: mix(lean, (84, 16, 24), 0.5), (196, 150, 120), 0),
    "dried": (lambda lean: mix(lean, (88, 50, 30), 0.88), (152, 108, 62), 1),
}


def mix(a, b, t):
    return tuple(int(x + (y - x) * t) for x, y in zip(a, b))


def pieces():
    """[(bone name, [(cube name, origin, size)])]: per slot its twine, then a strip per stage."""
    out = []
    for n, (x, row, length, _) in enumerate(SLOTS, 1):
        twine_z, meat_z = (-1.5, -2) if row == "front" else (0.5, 0)
        out.append((f"dry_{n}", [(f"twine_{n}", [x - 0.5, HANG, twine_z], [1, BEAM - HANG, 1])]))
        for stage, (_, _, shrink) in STAGES.items():
            size = length - shrink
            out.append((f"dry_{n}_{stage}", [(f"meat_{n}_{stage}", [x - 1, HANG - size, meat_z], [2, size, 2])]))
    return out


def meat(lean, fat, seed):
    tip = mix(lean, (40, 12, 14), 0.5)

    def fn(f, i, j, w, h, fi):
        if f == "top":
            return TWINE_DK if (i + j) % 2 else mix(lean, tip, 0.2)
        if f == "bottom":
            return mix(lean, tip, 0.45)
        if j == 0:
            return TWINE  # tied round the top
        if f in ("north", "south") and i == (seed % 2) * (w - 1) and j < h - 1:
            return mix(lean, fat, 0.8)  # a rim of fat down one edge
        if (i * 3 + j * 2 + seed) % 7 == 0:
            return mix(lean, fat, 0.45)  # marbling
        return mix(lean, tip, 0.1 + 0.25 * j / max(1, h - 1))  # darker toward the tip
    return fn


def face_rects(uv):
    """Texel rectangles (x, y, w, h) of a cube's per-face uv, flips undone."""
    out = []
    for face in uv.values():
        (x, y), (w, h) = face["uv"], face["uv_size"]
        out.append((min(x, x + w), min(y, y + h), abs(w), abs(h)))
    return out


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
        for stage, (shade, fat, _) in STAGES.items():
            painter.paint(f"meat_{n}_{stage}", meat(shade(lean), fat, n), amt=5)

    texture = Image.open(TEXTURE).convert("RGBA")
    if texture.crop((0, 0, tw, ROW)).getbbox() is None or texture.size != (tw, th):
        raise SystemExit("rack_drying: unexpected rack texture")

    def face_uvs(uv, size):
        out = {}
        for f, (x, y, w, h) in faces(uv, size).items():
            name = {"top": "up", "bottom": "down"}.get(f, f)
            out[name] = {"uv": [x, y + h], "uv_size": [w, -h]} if f == "bottom" else {"uv": [x, y], "uv_size": [w, h]}
        return out

    dry = [{"name": name, "parent": parent, "pivot": pivot,
            "cubes": [{"origin": o, "size": s, "uv": face_uvs(uv, s)} for _, o, s, uv in cubes]}
           for name, parent, pivot, cubes in bones]
    old = [b for b in geo["bones"] if b["name"].startswith("dry_")]
    ours = painter.img.crop((0, ROW, tw, used))
    if old == dry and texture.crop((0, ROW, tw, used)).tobytes() == ours.tobytes():
        print("rack_drying: already in place")
        return

    # The texels of the drying bones being replaced are ours to clear; anything else in the rows
    # we paint belongs to something else.
    clear = Image.new("RGBA", (tw, th), (0, 0, 0, 0))
    for bone in old:
        for cube in bone.get("cubes", []):
            for x, y, w, h in face_rects(cube["uv"]):
                if y < ROW:
                    raise SystemExit(f"rack_drying: {bone['name']} uses texels above row {ROW}")
                texture.paste(clear.crop((0, 0, w, h)), (x, y))
    if texture.crop((0, ROW, tw, used)).getbbox() is not None:
        raise SystemExit(f"rack_drying: rows {ROW}..{used} of the rack texture are taken by something else")
    texture.paste(ours, (0, ROW))
    texture.save(TEXTURE)
    geo["bones"] = [b for b in geo["bones"] if not b["name"].startswith("dry_")] + dry
    GEO.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf8", newline="\n")
    print("rack_drying:", len(bones), "drying bones added")


if __name__ == "__main__":
    main()
