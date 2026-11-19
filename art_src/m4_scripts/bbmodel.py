"""Writes Blockbench projects (art_src/blockbench/<id>.bbmodel) so the models can be opened and
looked at or edited in Blockbench. The layout follows the files Blockbench itself saved here
(format 5.0, box UV).

Blocks: the hand-made block models, from art/blocks/<id>.geo.json and its texture
(model format bedrock_block) -> <id>.bbmodel.

Animals (1.3): every animal as the pack ships it, from packs/RP/models/entity/<id>.geo.json
(so run it after `npm run generate`) and its skins (model format bedrock, an entity) -> one
project per look: <id>_female.bbmodel, <id>_male.bbmodel, <id>_baby.bbmodel. Each holds the
whole rig with that look's skin; the bones the render controller hides for that look (the
young's b_ bones on an adult, m_ on a female, ...) are there but hidden (Blockbench's eye
icon), the closed eyelids (lids_, made by tools/gen_sleep.mjs) are left out. Bedrock to
Blockbench: x is mirrored, bone and cube rotations about x and y change sign, per-face UVs
become Blockbench's corner UVs (up and down flipped).

Scripts stay the source of every model: a project edited in Blockbench does not flow back.

Run with: python art_src/m4_scripts/bbmodel.py [id ...]
    no ids: the 1.1 blocks of blocks_m7.py and every animal; an id may be a block or an animal.
"""
import base64
import json
import sys
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
ART = ROOT / "art" / "blocks"
OUT = ROOT / "art_src" / "blockbench"
RP = ROOT / "packs" / "RP"
NS = "kaleidoscope_ranching"
LOOKS = {"female": (False, False), "male": (False, True), "baby": (True, False)}  # (baby, male)


def uid(*parts):
    return str(uuid.uuid5(uuid.NAMESPACE_URL, "kaleidoscope_ranching/" + "/".join(parts)))


def box_faces(u, v, w, h, d):
    return {
        "north": [u + d, v + d, u + d + w, v + d + h],
        "east": [u, v + d, u + d, v + d + h],
        "south": [u + 2 * d + w, v + d, u + 2 * d + 2 * w, v + d + h],
        "west": [u + d + w, v + d, u + 2 * d + w, v + d + h],
        "up": [u + d + w, v + d, u + d, v],
        "down": [u + d + 2 * w, v, u + d + w, v + d],
    }


def face_uvs(cube):
    """Blockbench face UVs for a cube: box UV, or Bedrock per-face UV ({face: {uv, uv_size}})."""
    if isinstance(cube["uv"], list):
        u, v = cube["uv"]
        tw, th, td = [max(1, round(s)) for s in cube["size"]]
        return True, box_faces(u, v, tw, th, td)
    out = {}
    for f, d in cube["uv"].items():
        (u, v), (w, h) = d["uv"], d.get("uv_size", [0, 0])
        out[f] = [u + w, v + h, u, v] if f in ("up", "down") else [u, v, u + w, v + h]
    return False, out


def flip(rotation):
    """A Bedrock rotation as Blockbench holds it: x mirrored, so x and y turn the other way."""
    rx, ry, rz = rotation
    return [0 - rx + 0, 0 - ry + 0, rz]  # + 0: no "-0.0"


def texture_entry(key, name, png, w, h, path=""):
    return {
        "name": name, "path": path, "folder": "", "namespace": "", "id": "0", "group": "", "scope": 0,
        "width": w, "height": h, "uv_width": w, "uv_height": h, "particle": False,
        "use_as_default": False, "layers_enabled": False, "sync_to_project": "", "file_format": "png",
        "render_mode": "default", "render_sides": "auto", "wrap_mode": "limited", "pbr_channel": "color",
        "fps": 7, "force_translucent": False, "frame_time": 1, "frame_order_type": "loop", "frame_order": "",
        "frame_interpolate": False, "visible": True, "internal": True, "saved": False,
        "uuid": uid(key, "texture"), "source": "data:image/png;base64," + base64.b64encode(png).decode(),
    }


def project(key, model, png, fmt, shown=lambda name: True, skip=lambda name: False):
    """The Blockbench project for geometry `model` with texture `png`. `shown(bone)` False hides a
    bone (and its cubes), `skip(bone)` leaves it out."""
    desc = model["description"]
    elements, groups, children = [], [], {}
    for bone in model["bones"]:
        if skip(bone["name"]):
            continue
        gid = uid(key, bone["name"])
        px, py, pz = bone["pivot"]
        visible = shown(bone["name"])
        ids = []
        for n, cube in enumerate(bone.get("cubes", [])):
            (x, y, z), (w, h, d) = cube["origin"], cube["size"]
            box, faces = face_uvs(cube)
            cid = uid(key, bone["name"], str(n))
            ids.append(cid)
            el = {
                "name": bone["name"], "box_uv": box, "render_order": "default", "locked": False, "export": True,
                **({} if visible else {"visibility": False}), "scope": 0, "allow_mirror_modeling": True,
                "from": [-(x + w), y, z], "to": [-x, y + h, z + d],  # Blockbench mirrors x for Bedrock
                "autouv": 0, "color": 0, "origin": [-px, py, pz],
                **({"uv_offset": list(cube["uv"])} if box else {}),
                "faces": {k: {"uv": r, "texture": 0} for k, r in faces.items()},
                "type": "cube", "uuid": cid,
            }
            if cube.get("inflate"):
                el["inflate"] = cube["inflate"]
            if cube.get("mirror", bone.get("mirror")):
                el["mirror_uv"] = True
            if cube.get("rotation"):
                cx, cy, cz = cube.get("pivot", bone["pivot"])
                el["rotation"], el["origin"] = flip(cube["rotation"]), [-cx, cy, cz]
            elements.append(el)
        group = {
            "name": bone["name"], "uuid": gid, "export": True, "locked": False, "scope": 0, "selected": False,
            "visibility": visible, "_static": {"properties": {}, "temp_data": {}}, "origin": [-px, py, pz],
            "rotation": flip(bone.get("rotation", [0, 0, 0])), "color": 0, "children": [], "reset": False, "shade": True,
            "mirror_uv": False, "autouv": 0, "isOpen": False, "primary_selected": False,
        }
        if fmt == "bedrock":
            group["bedrock_binding"] = ""
        groups.append(group)
        children[bone["name"]] = {"uuid": gid, "isOpen": False, "children": ids, "parent": bone.get("parent")}
    outliner = []
    for node in children.values():
        parent = node.pop("parent")
        (children[parent]["children"] if parent in children else outliner).append(node)
    tw, th = desc["texture_width"], desc["texture_height"]
    data = {
        "meta": {"format_version": "5.0", "model_format": fmt, "box_uv": True},
        "name": key, "model_identifier": key if fmt == "bedrock_block" else desc["identifier"].removeprefix("geometry."),
        **({"front_gui_light": False} if fmt == "bedrock_block" else {}),
        "visible_box": [2, 2, 0.75] if fmt == "bedrock_block" else [desc.get("visible_bounds_width", 2),
                                                                     desc.get("visible_bounds_height", 2),
                                                                     desc.get("visible_bounds_offset", [0, 0, 0])[1]],
        "variable_placeholders": "", "variable_placeholder_buttons": [],
        **({"bedrock_animation_mode": "entity", "timeline_setups": []} if fmt == "bedrock" else {}),
        "unhandled_root_fields": {},
        "resolution": {"width": tw, "height": th},
        "elements": elements, "groups": groups, "outliner": outliner,
        "textures": [texture_entry(key, key, png, tw, th)],
    }
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / f"{key}.bbmodel").write_text(json.dumps(data, separators=(",", ":")) + "\n", encoding="utf8")
    print(f"{key}.bbmodel: {len(elements)} cubes, {len(groups)} bones")


def convert(block):
    """A hand-made block model (box UV cubes only, as these models use)."""
    model = json.loads((ART / f"{block}.geo.json").read_text(encoding="utf8"))["minecraft:geometry"][0]
    model = dict(model, bones=[dict(b, cubes=[c for c in b.get("cubes", []) if isinstance(c["uv"], list)]) for b in model["bones"]])
    project(block, model, (ART / f"{block}.png").read_bytes(), "bedrock_block")


# --- Animals -------------------------------------------------------------------------

def animals():
    """Every animal the pack ships: a client entity with its own geometry and skins folder."""
    out = []
    for path in sorted((RP / "entity").glob("*.entity.json")):
        sid = path.name.removesuffix(".entity.json")
        if (RP / "models" / "entity" / f"{sid}.geo.json").exists() and (RP / "textures" / "entity" / "ranching" / sid).is_dir():
            out.append(sid)
    return out


def skin(textures, look):
    """The skin for a look: its own (female, male, baby), else its plain colour (sheep: <look>_white),
    else the first (the rabbit's coats are worn by both sexes and the young)."""
    if look in textures:
        return textures[look]
    named = [k for k in textures if k.startswith(look + "_")]
    return textures[f"{look}_white"] if f"{look}_white" in textures else textures[named[0] if named else next(iter(textures))]


def animal(sid):
    import sleep_preview as sp  # the preview's reading of the render controller's part_visibility
    model = json.loads((RP / "models" / "entity" / f"{sid}.geo.json").read_text(encoding="utf8"))["minecraft:geometry"][0]
    entity = json.loads((RP / "entity" / f"{sid}.entity.json").read_text(encoding="utf8"))["minecraft:client_entity"]["description"]
    rc = json.loads((RP / "render_controllers" / f"{sid}.render_controllers.json").read_text(encoding="utf8"))
    rules = next(iter(rc["render_controllers"].values()))["part_visibility"]
    bones = {b["name"]: b for b in model["bones"]}
    for look, (baby, male) in LOOKS.items():
        png = (RP / f"{skin(entity['textures'], look)}.png").read_bytes()
        project(f"{sid}_{look}", model, png, "bedrock",
                shown=lambda name: sp.visible(name, bones, baby, False, rules, male),
                skip=lambda name: name.startswith("lids_"))


def main():
    sys.path.insert(0, str(Path(__file__).parent))
    ids = sys.argv[1:]
    every = animals()
    if not ids:
        from blocks_m7 import BLOCKS
        ids = list(BLOCKS) + every
    for i in ids:
        animal(i) if i in every else convert(i)


if __name__ == "__main__":
    main()
