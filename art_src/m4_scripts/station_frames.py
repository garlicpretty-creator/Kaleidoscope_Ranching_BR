"""Moving parts of the hand-worked stations, as flip-book frames (packs/BP/scripts/data/stationFrames.js).

Custom blocks cannot play animations, so each moving part is modelled in four positions, one bone
per position (<bone>_0 .. <bone>_3), and the block's `frame` state shows one of them
(tools/gen_blocks.mjs). Frame 0 is the resting look. blocks_m3.py and blocks_m7.py add these bones
to their models in place of the static part.

  crank(...)    a crank arm turning about an axle that runs along x: down, forward, up, back
  plunger(...)  a churn dasher pushed down and pulled up again
  wheel(...)    spinning-wheel spokes, upright cross then diagonal, with the treadle rocking
  crank_z(...)  a crank whose axle runs along z (the cream separator): down, left, up, right
  shift(...)    the same cubes moved by an offset per frame (the chaff cutter's blade)
  swing(...)    a beater hanging on two swords pivoted low, its top swung forward a pixel a frame (the loom)
  extra(...)    adds cubes of a frame's own to each frame bone (the cream separator's ribbed bowl)
"""

FRAMES = 4


def crank(prefix, parent, x, cy, cz, length, knob_dx=0):
    """Arm in the plane x..x+1, turning about the axle centre (cy, cz); a knob at its tip."""
    bones = []
    for i, (dy, dz) in enumerate([(-1, 0), (0, -1), (1, 0), (0, 1)]):
        if dy:
            arm = ([x, cy - length if dy < 0 else cy, cz - 0.5], [1, length, 1])
        else:
            arm = ([x, cy - 0.5, cz - length if dz < 0 else cz], [1, 1, length])
        ty, tz = cy + dy * length, cz + dz * length
        knob = ([x + knob_dx, ty - 0.5, tz - 0.5], [1, 1, 1])
        bones.append((f"{prefix}_{i}", parent, [x, cy, cz], [("crank", *arm), ("grip", *knob)]))
    return bones


def plunger(prefix, parent, cubes, drops=(0, 2, 4, 2)):
    """The dasher's cubes lowered by each frame's drop (pixels)."""
    return [(f"{prefix}_{i}", parent, [0, 0, 0], [(name, [o[0], o[1] - d, o[2]], s) for name, o, s in cubes])
            for i, d in enumerate(drops)]


def wheel(prefix, parent, cx, cy, z, treadle):
    """Spokes about the hub at (cx, cy) in the plane z..z+1: a cross on even frames, the diagonals
    on odd ones (so the wheel seems to turn by an eighth each frame). The treadle (origin, size)
    lifts a pixel on odd frames."""
    cross = [("spoke_h", [cx - 4, cy - 0.5, z], [3, 1, 1]), ("spoke_h", [cx + 1, cy - 0.5, z], [3, 1, 1]),
             ("spoke_v", [cx - 0.5, cy + 1, z], [1, 3, 1]), ("spoke_v", [cx - 0.5, cy - 4, z], [1, 3, 1])]
    diagonal = [("spoke_d", [cx + sx * k - 0.5, cy + sy * k - 0.5, z], [1, 1, 1])
                for sx in (-1, 1) for sy in (-1, 1) for k in (1.5, 2.5)]
    (tx, ty, tz), size = treadle
    bones = []
    for i in range(FRAMES):
        odd = i % 2
        bones.append((f"{prefix}_{i}", parent, [cx, cy, z],
                      [*(diagonal if odd else cross), ("treadle", [tx, ty + odd, tz], size)]))
    return bones


def crank_z(prefix, parent, z, cx, cy, length, knob_dz=0):
    """Arm in the plane z..z+1, turning about the axle centre (cx, cy); a knob at its tip."""
    bones = []
    for i, (dx, dy) in enumerate([(0, -1), (-1, 0), (0, 1), (1, 0)]):
        if dy:
            arm = ([cx - 0.5, cy - length if dy < 0 else cy, z], [1, length, 1])
        else:
            arm = ([cx - length if dx < 0 else cx, cy - 0.5, z], [length, 1, 1])
        tx, ty = cx + dx * length, cy + dy * length
        knob = ([tx - 0.5, ty - 0.5, z + knob_dz], [1, 1, 1])
        bones.append((f"{prefix}_{i}", parent, [cx, cy, z], [("crank", *arm), ("grip", *knob)]))
    return bones


def shift(prefix, parent, cubes, offsets):
    """The cubes moved by (dx, dy, dz) in each frame."""
    return [(f"{prefix}_{i}", parent, [0, 0, 0],
             [(name, [o[0] + dx, o[1] + dy, o[2] + dz], s) for name, o, s in cubes])
            for i, (dx, dy, dz) in enumerate(offsets)]


def swing(prefix, parent, x0, x1, y0, y1, z, swings=(0, -1, -2, -1), reed=3):
    """A loom beater: two swords (1 pixel square, at x0..x0+1 and x1-1..x1) standing from the pivot at
    y0 to the hand-tree at y1, with the reed (`reed` pixels tall) under the hand-tree between them.
    Each frame swings the top by the frame's offset along z; the swords become a staircase of
    |offset|+1 equal steps from the pivot, so they stay joined to it and to the hand-tree."""
    bones = []
    for i, d in enumerate(swings):
        steps = abs(d) + 1
        cubes = []
        for k in range(steps):
            lo = y0 + (y1 - y0) * k / steps
            hi = y0 + (y1 - y0) * (k + 1) / steps
            dz = -k if d < 0 else k
            for sx in (x0, x1 - 1):
                cubes.append(("sword", [sx, lo, z + dz], [1, hi - lo, 1]))
        cubes.append(("reed", [x0 + 1, y1 - reed, z + d], [x1 - x0 - 2, reed, 1]))
        cubes.append(("hand_tree", [x0, y1, z + d], [x1 - x0, 1, 1]))
        bones.append((f"{prefix}_{i}", parent, [0, y0, z], cubes))
    return bones


def extra(bones, cubes_of):
    """The frame bones with cubes_of(frame) added to each."""
    return [(name, parent, pivot, cubes + cubes_of(i)) for i, (name, parent, pivot, cubes) in enumerate(bones)]
