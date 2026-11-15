"""Hand-drawn 16x16 icon for the animal crate: an isometric slatted crate with a rope handle."""
import sys
from PIL import Image

OUT = sys.argv[1] if len(sys.argv) > 1 else "animal_crate.png"

T, L, R = (176, 124, 78), (150, 100, 60), (118, 78, 46)  # top, left and right plank shades
POST_L, POST_R = (104, 68, 40), (84, 54, 32)
GAP = (58, 38, 24)
OUTLINE = (40, 30, 28)
ROPE, ROPE_DK = (214, 186, 124), (160, 132, 82)

img = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
px = img.load()


def put(x, y, c):
    if 0 <= x < 16 and 0 <= y < 16:
        px[x, y] = c + (255,)


# isometric cube: top diamond rows 1..7, side faces below it down to row 14
for x in range(1, 15):
    # top face spans a 2:1 diamond between the outer edges
    d = abs(x - 7.5)
    top0, top1 = 1 + int(d / 2), 7 - int(d / 2)
    for y in range(top0, top1 + 1):
        put(x, y, T)
    side_top = top1 + 1
    for y in range(side_top, side_top + 7):
        put(x, y, L if x < 8 else R)

# plank seams on the lid, running toward the back-left
for x in range(1, 15):
    d = abs(x - 7.5)
    top0, top1 = 1 + int(d / 2), 7 - int(d / 2)
    if x in (5, 10):
        for y in range(top0 + 1, top1):
            put(x, y, (150, 104, 62))

# horizontal gaps between slats on both sides, and dark corner posts
for x in range(1, 15):
    d = abs(x - 7.5)
    side_top = 8 - int(d / 2)
    for k in (2, 4):
        put(x, side_top + k, GAP)
    if x in (1, 2, 13, 14, 7, 8):
        for y in range(side_top, side_top + 7):
            put(x, y, POST_L if x < 8 else POST_R)

# rope handle on the lid
for x, y in ((6, 3), (7, 2), (8, 2), (9, 3)):
    put(x, y, ROPE)
put(6, 4, ROPE_DK)
put(9, 4, ROPE_DK)

# outline every opaque pixel that touches transparency
src = img.copy().load()
for y in range(16):
    for x in range(16):
        if src[x, y][3] == 0:
            continue
        edge = any(not (0 <= x + dx < 16 and 0 <= y + dy < 16) or src[x + dx, y + dy][3] == 0
                   for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
        if edge:
            r, g, b, _ = src[x, y]
            px[x, y] = (int(r * 0.62), int(g * 0.58), int(b * 0.55), 255)

img.save(OUT)
print("ok")
