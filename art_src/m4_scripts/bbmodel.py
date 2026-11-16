"""Writes a Blockbench project (art_src/blockbench/<id>.bbmodel) for hand-made block models,
from art/blocks/<id>.geo.json and its texture, so they can be opened and edited in Blockbench.
The layout follows the files Blockbench itself saved here (format 5.0, bedrock_block, box UV).

Run with: python art_src/m4_scripts/bbmodel.py id ...   (no ids: the 1.1 blocks of blocks_m7.py)
"""
import base64
import json
import sys
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
ART = ROOT / "art" / "blocks"
OUT = ROOT / "art_src" / "blockbench"


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


def convert(block):
    model = json.loads((ART / f"{block}.geo.json").read_text(encoding="utf8"))["minecraft:geometry"][0]
    desc = model["description"]
    png = (ART / f"{block}.png").read_bytes()
    elements, groups, children = [], [], {}
    for bone in model["bones"]:
        gid = uid(block, bone["name"])
        px, py, pz = bone["pivot"]
        ids = []
        for n, cube in enumerate(bone.get("cubes", [])):
            if not isinstance(cube["uv"], list):
                continue  # per-face cubes are not used by these models
            (x, y, z), (w, h, d) = cube["origin"], cube["size"]
            u, v = cube["uv"]
            tw, th, td = [max(1, round(s)) for s in (w, h, d)]
            cid = uid(block, bone["name"], str(n))
            ids.append(cid)
            elements.append({
                "name": bone["name"], "box_uv": True, "render_order": "default", "locked": False, "export": True,
                "scope": 0, "allow_mirror_modeling": True,
                "from": [-(x + w), y, z], "to": [-x, y + h, z + d],  # Blockbench mirrors x for Bedrock
                "autouv": 0, "color": 0, "origin": [-px, py, pz], "uv_offset": [u, v],
                "faces": {k: {"uv": r, "texture": 0} for k, r in box_faces(u, v, tw, th, td).items()},
                "type": "cube", "uuid": cid,
            })
        groups.append({
            "name": bone["name"], "uuid": gid, "export": True, "locked": False, "scope": 0, "selected": False,
            "visibility": True, "_static": {"properties": {}, "temp_data": {}}, "origin": [-px, py, pz],
            "rotation": [0, 0, 0], "color": 0, "children": [], "reset": False, "shade": True, "mirror_uv": False,
            "autouv": 0, "isOpen": False, "primary_selected": False,
        })
        children[bone["name"]] = {"uuid": gid, "isOpen": False, "children": ids, "parent": bone.get("parent")}
    outliner = []
    for node in children.values():
        parent = node.pop("parent")
        (children[parent]["children"] if parent else outliner).append(node)
    tw, th = desc["texture_width"], desc["texture_height"]
    project = {
        "meta": {"format_version": "5.0", "model_format": "bedrock_block", "box_uv": True},
        "name": block, "model_identifier": block, "front_gui_light": False, "visible_box": [2, 2, 0.75],
        "variable_placeholders": "", "variable_placeholder_buttons": [], "unhandled_root_fields": {},
        "resolution": {"width": tw, "height": th},
        "elements": elements, "groups": groups, "outliner": outliner,
        "textures": [{
            "name": block, "path": "", "folder": "", "namespace": "", "id": "0", "group": "", "scope": 0,
            "width": tw, "height": th, "uv_width": tw, "uv_height": th, "particle": False,
            "use_as_default": False, "layers_enabled": False, "sync_to_project": "", "file_format": "png",
            "render_mode": "default", "render_sides": "auto", "wrap_mode": "limited", "pbr_channel": "color",
            "fps": 7, "force_translucent": False, "frame_time": 1, "frame_order_type": "loop", "frame_order": "",
            "frame_interpolate": False, "visible": True, "internal": True, "saved": False,
            "uuid": uid(block, "texture"), "source": "data:image/png;base64," + base64.b64encode(png).decode(),
        }],
    }
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / f"{block}.bbmodel").write_text(json.dumps(project, separators=(",", ":")) + "\n", encoding="utf8")
    print(f"{block}.bbmodel: {len(elements)} cubes, {len(groups)} bones")


def main():
    blocks = sys.argv[1:]
    if not blocks:
        sys.path.insert(0, str(Path(__file__).parent))
        from blocks_m7 import BLOCKS
        blocks = list(BLOCKS)
    for block in blocks:
        convert(block)


if __name__ == "__main__":
    main()
