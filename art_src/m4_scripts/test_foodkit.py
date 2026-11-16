"""Checks that foodkit paints each texel where Bedrock (and Blockbench) shows it.

Box UV as Blockbench lays it out for a Bedrock cube (bbmodel.py: Blockbench x = -geo x):
  the left strip (u, v+d) is the face at the cube's smallest geo x, the strip after the front
  (u+d+w, v+d) the face at its largest geo x; on the top, front and back faces the texture's
  left column is the smallest geo x on top and front, the largest on the back.

Run with: python art_src/m4_scripts/test_foodkit.py
"""
from foodkit import texel

ORIGIN, SIZE = [10, 0, 20], [4, 3, 2]  # x 10..14, y 0..3, z 20..22


def probe(face, i, j):
    """The model point foodkit paints at texel (i, j) of `face` in the Painter's face layout."""
    return texel(lambda f, x, y, z: (f, x, y, z), ORIGIN, SIZE)(face, i, j, 0, 0, 0)


def check(name, got, want):
    ok = all(abs(a - b) < 1e-9 for a, b in zip(got[1:], want))
    print(("ok  " if ok else "FAIL") + f" {name}: {got[1:]} (want {tuple(want)})")
    return ok


results = [
    check("left strip is the min-x face", probe("east", 0, 0), (10, 2.5, 21.5)),
    check("strip after the front is the max-x face", probe("west", 0, 0), (14, 2.5, 20.5)),
    check("top: first column is min x, first row max z", probe("top", 0, 0), (10.5, 3, 21.5)),
    check("bottom: first column is min x", probe("bottom", 0, 0), (10.5, 0, 21.5)),
    check("front (north): first column is min x", probe("north", 0, 0), (10.5, 2.5, 20)),
    check("back (south): first column is max x", probe("south", 0, 0), (13.5, 2.5, 22)),
]
raise SystemExit(0 if all(results) else 1)
