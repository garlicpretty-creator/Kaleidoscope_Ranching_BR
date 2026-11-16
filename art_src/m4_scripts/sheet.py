"""Builds docs/art/m4_animals_preview.png from Blockbench screenshots, scaled to in-game size."""
from PIL import Image, ImageDraw

D = "C:/Users/garli/.claude/projects/D--Kaleidoscope-KR/5f5c7b11-ef64-483b-8386-ec5d9e47d850/tool-results/mcp-blockbench-blob-"
# (species, zoom used for the shot, [(label, file, in-game scale)])
ROWS = [
    ("duck", 14, [("female 0.95", "1794777095479-cfg1k7", 0.95), ("male 1.15", "1794777095312-l19s7p", 1.15), ("baby 0.5", "1794777095598-rb1mcq", 0.5)]),
    ("goose", 19, [("female 1.0", "1794777085687-4dfqkx", 1.0), ("male 1.15", "1794777085419-cra0jw", 1.15), ("baby 0.5", "1794777085811-vpbx5o", 0.5)]),
    ("buffalo", 22, [("female 1.0", "1794777018736-qpwtoi", 1.0), ("male 1.15", "1794777012988-xriocb", 1.15), ("baby 0.5", "1794777018848-vhp87e", 0.5)]),
    ("yak", 23, [("female 0.95", "1794777030082-hdd21e", 0.95), ("male 1.15", "1794777029950-rta2pw", 1.15), ("baby 0.5", "1794777030227-64qak9", 0.5)]),
]
PX = 8  # output pixels per model pixel (1/16 block)


def load(name):
    """Remove the white backdrop by flood-filling from the border, so white feathers survive."""
    im = Image.open(D + name + ".png").convert("RGBA")
    px = im.load()
    W, H = im.size
    near_white = lambda c: c[0] > 245 and c[1] > 245 and c[2] > 245
    stack = [(x, y) for x in range(W) for y in (0, H - 1)] + [(x, y) for y in range(H) for x in (0, W - 1)]
    seen = set()
    while stack:
        x, y = stack.pop()
        if (x, y) in seen or not (0 <= x < W and 0 <= y < H):
            continue
        seen.add((x, y))
        if not near_white(px[x, y]):
            continue
        px[x, y] = (0, 0, 0, 0)
        stack += [(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)]
    return im

def detail(im, h):
    bb = im.getbbox()
    im = im.crop(bb)
    return im.resize((int(im.width * h / im.height), h), Image.NEAREST)


rows = []
for sid, model_h, shots in ROWS:
    first = load(shots[0][1])
    bb = first.getbbox()
    f = PX * model_h / (bb[3] - bb[1])  # same camera within a species, so one factor fits all three
    ims = []
    for label, name, s in shots:
        im = load(name)
        r = im.resize((max(1, int(im.width * f * s)), max(1, int(im.height * f * s))), Image.NEAREST)
        ims.append((label, r.crop(r.getbbox()), im))
    h = max(i[1].height for i in ims) + 60
    row = Image.new("RGBA", (1300, h), (214, 224, 206, 255))
    dr = ImageDraw.Draw(row)
    ground = h - 30
    dr.rectangle((0, ground, 1060, h), fill=(150, 180, 110, 255))
    dr.rectangle((1065, 0, 1300, h), fill=(232, 238, 226, 255))
    x = 16
    for label, r, _ in ims:
        row.alpha_composite(r, (x, ground - r.height))
        dr.text((x, ground + 8), f"{sid} / {label}", fill=(30, 30, 30))
        x += r.width + 40
    d = detail(ims[2][2], min(h - 40, 150))
    row.alpha_composite(d, (1080, 20))
    dr.text((1080, 4), f"{sid} / baby (detail)", fill=(30, 30, 30))
    rows.append(row)

out = Image.new("RGB", (1300, sum(r.height for r in rows)), (232, 238, 226))
y = 0
for r in rows:
    out.paste(r.convert("RGB"), (0, y))
    y += r.height
out.save(r"D:\Kaleidoscope\KR\docs\art\m4_animals_preview.png")
print(out.size)
