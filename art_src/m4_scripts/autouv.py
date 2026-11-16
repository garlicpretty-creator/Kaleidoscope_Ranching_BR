"""Box-UV layout for small add-on models (worn items, animal gear, the rack's drying pieces).

Cubes are written as (name, origin, size) or (name, origin, size, extra) where extra is an
inflate number or a dict of extra cube fields; lay_out() gives each its place in the texture
and returns the (name, origin, size, uv, extra) tuples boxuv.Painter and boxuv.geo() take.
"""


def footprint(size):
    """Width and height of a cube's box-UV unwrap in texels."""
    w, h, d = (max(1, round(v)) for v in size)
    return 2 * (w + d), d + h


def lay_out(cubes, width, top=0, gap=1):
    """Shelf-packs the cubes' unwraps left to right from row `top`. Returns (cubes with uv,
    first free row). The order of `cubes` is kept, so the layout only changes when they do."""
    out = []
    x, y, shelf = 0, top, 0
    for cube in cubes:
        name, origin, size, *extra = cube
        w, h = footprint(size)
        if w > width:
            raise SystemExit(f"autouv: {name} is {w} texels wide, the texture only {width}")
        if x + w > width:
            x, y, shelf = 0, y + shelf + gap, 0
        out.append((name, list(origin), list(size), [x, y], *extra))
        x += w + gap
        shelf = max(shelf, h)
    return out, y + shelf


def fit(cubes, sizes=(32, 64, 128, 256)):
    """Lays the cubes out in the smallest square texture that holds them: (cubes, size)."""
    for size in sizes:
        try:
            placed, used = lay_out(cubes, size)
        except SystemExit:
            continue
        if used <= size:
            return placed, size
    raise SystemExit("autouv: the cubes do not fit the largest texture")
