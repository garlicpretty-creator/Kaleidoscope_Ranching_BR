#!/usr/bin/env python3
"""Keeps PNG bytes stable across `npm run generate`.

Generators re-encode the PNGs they write, and another machine's PNG encoder (or
Pillow version) gives different bytes for the same pixels, so a rerun would
rewrite hundreds of files with nothing changed. `npm run generate` runs

    python3 tools/png_snapshot.py save      (first)
    python3 tools/png_snapshot.py restore   (last)

`save` remembers the bytes of every PNG under packs/, art/ and docs/art/;
`restore` puts the remembered bytes back wherever the pixels are unchanged.
"""

import io
import shutil
import sys
import tempfile
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
FOLDERS = [ROOT / "packs", ROOT / "art", ROOT / "docs" / "art"]
SNAPSHOT = Path(tempfile.gettempdir()) / "kaleidoscope_ranching_png_snapshot"


def pngs():
    for folder in FOLDERS:
        if folder.exists():
            yield from folder.rglob("*.png")


def same_pixels(a, b):
    with Image.open(io.BytesIO(a)) as old, Image.open(io.BytesIO(b)) as new:
        if old.size != new.size:
            return False
        return old.convert("RGBA").tobytes() == new.convert("RGBA").tobytes()


def save():
    shutil.rmtree(SNAPSHOT, ignore_errors=True)
    count = 0
    for path in pngs():
        target = SNAPSHOT / path.relative_to(ROOT)
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(path, target)
        count += 1
    print(f"png_snapshot: remembered {count} PNGs")


def restore():
    if not SNAPSHOT.exists():
        print("png_snapshot: no snapshot, nothing to restore")
        return
    kept = 0
    for path in pngs():
        old = SNAPSHOT / path.relative_to(ROOT)
        if not old.exists():
            continue
        before, after = old.read_bytes(), path.read_bytes()
        if before != after and same_pixels(before, after):
            path.write_bytes(before)
            kept += 1
    shutil.rmtree(SNAPSHOT, ignore_errors=True)
    print(f"png_snapshot: kept the original bytes of {kept} re-encoded PNGs")


if __name__ == "__main__":
    {"save": save, "restore": restore}[sys.argv[1] if len(sys.argv) > 1 else "save"]()
