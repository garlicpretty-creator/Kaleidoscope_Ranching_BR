"""Item icons drawn with RetroDiffusion (https://www.retrodiffusion.ai).

The prompts live in tools/art/icon_prompts.json. Run this where the
RetroDiffusion API is reachable, with the API key in the environment:

    export RETRODIFFUSION_API_KEY=rdpk-...      # never commit or paste it
    python3 tools/art/rd_icons.py cost          # estimate, generates nothing
    python3 tools/art/rd_icons.py generate      # candidates for every icon not picked yet
    python3 tools/art/rd_icons.py generate cow_milk butter   # only these
    python3 tools/art/rd_icons.py pick cow_milk 2 butter 0   # keep candidate n
    python3 tools/art/rd_icons.py apply         # write picked icons into the RP

`generate` saves candidates to art/icons/candidates/<id>/<n>.png and a
labelled contact sheet art/icons/candidates/sheet.png to choose from.
`pick` copies the chosen candidate to art/icons/<id>.png and records the
choice in art/icons/picks.json; those files are committed. The contact sheet
shows the icon shipped today next to the candidates, on an inventory-slot
grey, and flags candidates that kept a background, came out near-empty or flat
(also written to art/icons/candidates/review.json). `apply` runs as the last step of `npm run generate`: it needs no
key and no network, and it skips every icon that has no picked art yet, so
the procedural icons stay in place until a replacement is chosen.

Only the standard library is needed for `cost` and `generate`; `pick`,
`apply` and the contact sheet use Pillow, like the other art tools.
"""

import base64
import json
import os
import shutil
import sys
import time
import urllib.error
import urllib.request

ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
PROMPTS = os.path.join(ROOT, "tools", "art", "icon_prompts.json")
ART = os.path.join(ROOT, "art", "icons")
CANDIDATES = os.path.join(ART, "candidates")
ATLAS = os.path.join(ROOT, "packs", "RP", "textures", "item_texture.json")

API = os.environ.get("RETRODIFFUSION_API_BASE", "https://api.retrodiffusion.ai/v2")  # override only for testing
KEY_ENV = "RETRODIFFUSION_API_KEY"

BADGES = {
    "fine": ((220, 226, 236), [(13, 0), (12, 1), (13, 1), (14, 1), (13, 2)]),
    "superb": ((250, 206, 60), [(13, 0), (12, 1), (13, 1), (14, 1), (13, 2)]),
    "fertilized": ((232, 92, 120), [(12, 1), (14, 1), (11, 2), (12, 2), (13, 2), (14, 2), (15, 2), (12, 3), (13, 3), (14, 3), (13, 4)]),
}


def load_prompts():
    with open(PROMPTS, encoding="utf8") as f:
        return json.load(f)


def prompted(config, only=()):
    items = {k: v for k, v in config["items"].items() if "prompt" in v}
    if only:
        unknown = [k for k in only if k not in items]
        if unknown:
            sys.exit(f"no prompt for: {', '.join(unknown)}")
        items = {k: items[k] for k in only}
    return items


# --- API ----------------------------------------------------------------------


def api_key():
    key = os.environ.get(KEY_ENV, "").strip()
    if not key:
        sys.exit(f"set {KEY_ENV} in the environment first (do not put the key in a file or the command line)")
    return key


def request(method, path, body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(API + path, data=data, method=method)
    req.add_header("X-RD-Token", api_key())
    req.add_header("Content-Type", "application/json")
    for attempt in range(6):
        try:
            with urllib.request.urlopen(req, timeout=120) as response:
                return json.loads(response.read())
        except urllib.error.HTTPError as error:
            if error.code == 429 and attempt < 5:
                time.sleep(float(error.headers.get("Retry-After", "10")))
                continue
            detail = error.read().decode(errors="replace")[:500]
            raise SystemExit(f"{method} {path}: HTTP {error.code} {detail}")
    raise SystemExit(f"{method} {path}: gave up after repeated rate limits")


def find_images(payload):
    if isinstance(payload, dict):
        if isinstance(payload.get("base64_images"), list) and payload["base64_images"]:
            return payload["base64_images"]
        for value in payload.values():
            found = find_images(value)
            if found:
                return found
    return None


def run(body):
    """Submits one inference and waits for its images (list of PNG bytes)."""
    started = request("POST", "/inferences", body)
    images = find_images(started)
    task = started.get("task_id")
    while not images:
        if not task:
            raise SystemExit(f"unexpected response: {json.dumps(started)[:500]}")
        time.sleep(2)
        state = request("GET", f"/inferences/tasks/{task}")
        status = str(state.get("status", "")).lower()
        if status in ("failed", "error", "cancelled", "canceled"):
            raise SystemExit(f"task {task} {status}: {json.dumps(state)[:500]}")
        images = find_images(state)
    return [base64.b64decode(image) for image in images]


def body_for(config, entry, check_cost=False):
    return {
        "prompt": entry["prompt"],
        "prompt_style": entry.get("style", config["style"]),
        "width": config["size"],
        "height": config["size"],
        "num_images": config["candidates"],
        "seed": config.get("seed"),
        "remove_bg": True,
        "check_cost": check_cost,
    }


# --- Commands -----------------------------------------------------------------


def cmd_cost(config, only):
    items = prompted(config, only)
    size, n = config["size"], config["candidates"]
    each = max(0.02, (size * size + 13700) / 600000) * n  # published low-res price formula
    print(f"{len(items)} icons x {n} candidates at {size}x{size} ({config['style']})")
    print(f"estimated cost: about {each * len(items):.2f} credits (formula); asking the API for one icon:")
    first = next(iter(items.values()))
    print(json.dumps(request("POST", "/inferences", body_for(config, first, check_cost=True)), indent=2)[:800])


def cmd_generate(config, only):
    items = prompted(config, only)
    os.makedirs(CANDIDATES, exist_ok=True)
    for i, (item_id, entry) in enumerate(items.items(), 1):
        folder = os.path.join(CANDIDATES, item_id)
        if not only and (os.path.exists(os.path.join(ART, item_id + ".png")) or os.path.isdir(folder)):
            continue  # already picked or already has candidates
        print(f"[{i}/{len(items)}] {item_id}", flush=True)
        images = run(body_for(config, entry))
        if os.path.isdir(folder):
            shutil.rmtree(folder)
        os.makedirs(folder)
        for n, png in enumerate(images):
            with open(os.path.join(folder, f"{n}.png"), "wb") as f:
                f.write(png)
    contact_sheet()


# Automatic screening. RetroDiffusion sometimes keeps a background, returns a
# near-empty image or a flat blob; such candidates are flagged on the sheet and
# in review.json so picking only has to compare the plausible ones.
MIN_OPAQUE = 20  # of 256 pixels
MAX_OPAQUE = 236  # more than this almost always means the background stayed
MIN_COLORS = 4


def screen(icon):
    """Metrics and flags for one 16x16 RGBA icon."""
    pixels = [icon.getpixel((x, y)) for y in range(16) for x in range(16)]
    opaque = [p for p in pixels if p[3] == 255]
    colors = len({p[:3] for p in opaque})
    flags = []
    if len(opaque) < MIN_OPAQUE:
        flags.append("empty")
    if len(opaque) > MAX_OPAQUE:
        flags.append("background")
    if colors < MIN_COLORS:
        flags.append("flat")
    return {"opaque": len(opaque), "colors": colors, "flags": flags}


def current_icon(item_id):
    """The icon the pack ships today (procedural placeholder or earlier pick), or None."""
    from PIL import Image

    try:
        with open(ATLAS, encoding="utf8") as f:
            entry = json.load(f)["texture_data"].get(f"kr_{item_id}")
    except OSError:
        return None
    if not entry:
        return None
    texture = entry["textures"] if isinstance(entry["textures"], str) else entry["textures"][0]
    path = os.path.join(ROOT, "packs", "RP", texture + ".png")
    return Image.open(path).convert("RGBA") if os.path.exists(path) else None


def contact_sheet():
    """art/icons/candidates/sheet.png (now | candidates, flagged) and review.json."""
    try:
        from PIL import Image, ImageDraw
    except ImportError:
        print("Pillow not installed: skipped the contact sheet")
        return
    ids = sorted(d for d in os.listdir(CANDIDATES) if os.path.isdir(os.path.join(CANDIDATES, d)))
    if not ids:
        return
    scale, label = 4, 170
    most = max(len(os.listdir(os.path.join(CANDIDATES, d))) for d in ids)
    cell = 16 * scale + 6
    sheet = Image.new("RGB", (label + (most + 1) * cell + 6, len(ids) * cell + 14), (58, 58, 64))
    draw = ImageDraw.Draw(sheet)
    draw.text((label + 2, 1), "now", fill=(170, 170, 170))
    draw.text((label + cell + 8, 1), "candidates (red = flagged)", fill=(170, 170, 170))
    slot = (139, 139, 139)  # inventory slot grey, so icons are judged on the colour they appear on
    review = {}
    for row, item_id in enumerate(ids):
        y = 14 + row * cell
        draw.text((4, y + cell // 2 - 6), item_id, fill=(230, 230, 230))
        now = current_icon(item_id)
        if now:
            draw.rectangle([label, y, label + 16 * scale - 1, y + 16 * scale - 1], fill=slot)
            big = now.resize((16 * scale, 16 * scale), Image.NEAREST)
            sheet.paste(big, (label, y), big)
        files = sorted((f for f in os.listdir(os.path.join(CANDIDATES, item_id)) if f.endswith(".png")), key=lambda f: int(f.split(".")[0]))
        review[item_id] = []
        for col, name in enumerate(files):
            icon = to_icon(os.path.join(CANDIDATES, item_id, name))
            result = {"n": int(name.split(".")[0]), **screen(icon)}
            review[item_id].append(result)
            x = label + (col + 1) * cell + 6
            draw.rectangle([x, y, x + 16 * scale - 1, y + 16 * scale - 1], fill=slot)
            big = icon.resize((16 * scale, 16 * scale), Image.NEAREST)
            sheet.paste(big, (x, y), big)
            mark = (240, 80, 80) if result["flags"] else (255, 220, 120)
            draw.text((x + 2, y + 1), str(result["n"]), fill=mark)
            if result["flags"]:
                draw.rectangle([x - 1, y - 1, x + 16 * scale, y + 16 * scale], outline=(240, 80, 80))
    path = os.path.join(CANDIDATES, "sheet.png")
    sheet.save(path)
    with open(os.path.join(CANDIDATES, "review.json"), "w", encoding="utf8") as f:
        json.dump(review, f, indent=1)
    flagged = sum(bool(r["flags"]) for rows in review.values() for r in rows)
    usable = sum(any(not r["flags"] for r in rows) for rows in review.values())
    print(f"contact sheet: {os.path.relpath(path, ROOT)} ({flagged} flagged candidates; {usable}/{len(review)} icons have a usable one)")


def to_icon(path):
    from PIL import Image

    image = Image.open(path).convert("RGBA")
    if image.size != (16, 16):
        image = image.resize((16, 16), Image.NEAREST)
    # Hard alpha edges, like hand-drawn Minecraft icons.
    pixels = image.load()
    for y in range(16):
        for x in range(16):
            r, g, b, a = pixels[x, y]
            pixels[x, y] = (r, g, b, 255 if a >= 128 else 0)
    return image


PICKS = os.path.join(ART, "picks.json")


def record_pick(item_id, n):
    """art/icons/picks.json: which candidate became each icon, for review and re-picking."""
    picks = {}
    if os.path.exists(PICKS):
        with open(PICKS, encoding="utf8") as f:
            picks = json.load(f)
    picks[item_id] = n
    with open(PICKS, "w", encoding="utf8") as f:
        json.dump(dict(sorted(picks.items())), f, indent=1)
        f.write("\n")


def cmd_pick(config, args):
    if len(args) % 2:
        sys.exit("usage: pick <id> <n> [<id> <n> ...]")
    os.makedirs(ART, exist_ok=True)
    for item_id, n in zip(args[::2], args[1::2]):
        source = os.path.join(CANDIDATES, item_id, f"{n}.png")
        if not os.path.exists(source):
            sys.exit(f"no candidate {source}")
        to_icon(source).save(os.path.join(ART, item_id + ".png"))
        record_pick(item_id, int(n))
        print(f"picked {item_id} <- candidate {n}")


def cmd_apply(config):
    if not os.path.isdir(ART):
        print("rd_icons: no picked icons yet")
        return
    from PIL import Image  # noqa: F401  (only needed once there is art)

    with open(ATLAS, encoding="utf8") as f:
        atlas = json.load(f)["texture_data"]
    written = 0
    for item_id, entry in config["items"].items():
        if entry.get("ship") is False:
            continue
        key = f"kr_{item_id}"
        if key not in atlas:
            continue
        base = entry.get("from", item_id)
        source = os.path.join(ART, base + ".png")
        if not os.path.exists(source):
            continue
        icon = to_icon(source)
        if entry.get("badge"):
            color, points = BADGES[entry["badge"]]
            for x, y in points:
                icon.putpixel((x, y), color + (255,))
        texture = atlas[key]["textures"]
        texture = texture if isinstance(texture, str) else texture[0]
        icon.save(os.path.join(ROOT, "packs", "RP", texture + ".png"))
        written += 1
    print(f"rd_icons: applied {written} icons")


def main():
    config = load_prompts()
    command, args = (sys.argv[1], sys.argv[2:]) if len(sys.argv) > 1 else ("help", [])
    if command == "cost":
        cmd_cost(config, args)
    elif command == "generate":
        cmd_generate(config, args)
    elif command == "pick":
        cmd_pick(config, args)
    elif command == "apply":
        cmd_apply(config)
    elif command == "sheet":
        contact_sheet()
    else:
        print(__doc__)


if __name__ == "__main__":
    main()
