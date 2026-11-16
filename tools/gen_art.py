#!/usr/bin/env python3
"""Generates all resource-pack files for the M1 animals.

For each species in tools/art/animals.py this writes the geometry, every
texture, the client entity, the render controller, the walk animation and a
preview sheet under docs/art/. Run with: python3 tools/gen_art.py
"""

import json
import shutil
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent / "art"))

from PIL import Image, ImageDraw  # noqa: E402

from animals import ALL, SEX_IS_MALE, bone_rule, make_visible  # noqa: E402
from model import geometry_json, pack, render_texture, render_view  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
RP = ROOT / "packs" / "RP"
NS = "kaleidoscope_ranching"


def write_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n")


HANDMADE = ROOT / "art" / "animals"


def handmade(species):
    """(geometry json, rig) for a species built by hand in art/animals/<id>/, or None."""
    folder = HANDMADE / species.id
    geo_path = folder / f"{species.id}.geo.json"
    if not geo_path.exists():
        return None
    geo = json.loads(geo_path.read_text(encoding="utf8"))
    rig = json.loads((folder / "rig.json").read_text(encoding="utf8"))
    missing = [n for n in species.textures if not (folder / "textures" / f"{n}.png").exists()]
    if missing:
        raise SystemExit(f"{species.id}: hand-made textures missing: {', '.join(missing)}")
    return geo, rig


def bone_names(species, hand):
    if hand:
        return [b["name"] for b in hand[0]["minecraft:geometry"][0]["bones"]]
    return [bone.name for bone in species.model.bones]


def client_entity(species, hand=None):
    textures = {name: f"textures/entity/ranching/{species.id}/{name}" for name in species.texture_order}
    scale = f"(!q.is_baby && {SEX_IS_MALE}) ? 1.1 : 1.0"
    if hand:
        rig = hand[1]
        scale = f"q.is_baby ? 1.0 : ({SEX_IS_MALE} ? {rig['scale_male']} : {rig['scale_female']})"
    animations = {
        "walk": f"animation.{NS}.{species.id}.walk",
        "look_at_target": "animation.common.look_at_target",
    }
    base, overlay = species.egg_colors
    return {
        "format_version": "1.10.0",
        "minecraft:client_entity": {
            "description": {
                "identifier": f"{NS}:{species.id}",
                "materials": {"default": "entity_alphatest"},
                "textures": textures,
                "geometry": {"default": species.model.identifier},
                "animations": animations,
                "scripts": {
                    # Adult males are a little larger.
                    "scale": scale,
                    "animate": ["walk", "look_at_target"],
                },
                "render_controllers": [f"controller.render.{NS}.{species.id}"],
                "spawn_egg": {"base_color": base, "overlay_color": overlay},
            }
        },
    }


def render_controller(species, hand=None):
    visibility = [{"*": True}]
    for name in bone_names(species, hand):
        rule = bone_rule(name)
        if rule:
            visibility.append({name: rule[1]})
    return {
        "format_version": "1.8.0",
        "render_controllers": {
            f"controller.render.{NS}.{species.id}": {
                "geometry": "Geometry.default",
                "materials": [{"*": "Material.default"}],
                "arrays": {"textures": {"Array.skins": [f"Texture.{name}" for name in species.texture_order]}},
                "textures": [f"Array.skins[{species.texture_index}]"],
                "part_visibility": visibility,
            }
        },
    }


def walk_animation(species, hand=None):
    names = set(bone_names(species, hand))
    moves = {bone: [molang, 0, 0] for bone, molang in species.walk.items()}
    for bone, (axis, molang) in species.extra_animations.items():
        rotation = [0, 0, 0]
        rotation["xyz".index(axis)] = molang
        moves[bone] = rotation
    bones = {}
    for bone, rotation in moves.items():
        # hand-built rigs split limbs into adult (a_) and baby (b_) bones
        for name in (bone, f"a_{bone}", f"b_{bone}"):
            if name in names:
                bones[name] = {"rotation": rotation}
    if hand:
        parents = {b["name"]: b.get("parent") for b in hand[0]["minecraft:geometry"][0]["bones"]}
        if "b_head" in parents and parents["b_head"] != "head":
            # the baby's head is not under `head`, so look_at_target does not turn it
            bones["b_head"] = {"rotation": ["q.target_x_rotation", "q.target_y_rotation", 0]}
    return {
        "format_version": "1.8.0",
        "animations": {f"animation.{NS}.{species.id}.walk": {"loop": True, "bones": bones}},
    }


def preview_sheet(species, textures):
    model = species.model
    panel = (300, 260)
    columns = len(species.preview)
    sheet = Image.new("RGB", (columns * panel[0], panel[1] * 2 + 24), (232, 238, 226))
    draw = ImageDraw.Draw(sheet)
    for column, (label, texture, state) in enumerate(species.preview):
        paint = species.painter(species.textures[texture])
        visible = make_visible(model, state)
        scale = 0.5 if state["baby"] else (1.1 if state["sex"] == "male" else 1.0)
        for row, view in enumerate(("3/4", "side")):
            image = render_view(model, paint, visible, view=view, scale=8, size=panel, model_scale=scale)
            sheet.paste(image, (column * panel[0], 24 + row * panel[1]))
        draw.text((column * panel[0] + 10, 6), f"{species.id} / {label}", fill=(60, 70, 56))
    return sheet


def main():
    previews = []
    for build in ALL:
        species = build()
        hand = handmade(species)
        texture_dir = RP / "textures" / "entity" / "ranching" / species.id
        texture_dir.mkdir(parents=True, exist_ok=True)
        for stale in texture_dir.glob("*.png"):
            if stale.stem not in species.textures and not stale.stem.endswith(("_mers", "_normal")):
                stale.unlink()

        if hand:
            # Hand-built (art_src/m4_scripts/m1_animals.py): install as is.
            shutil.copyfile(HANDMADE / species.id / f"{species.id}.geo.json", RP / "models" / "entity" / f"{species.id}.geo.json")
            for name in species.textures:
                shutil.copyfile(HANDMADE / species.id / "textures" / f"{name}.png", texture_dir / f"{name}.png")
        else:
            pack(species.model)
            write_json(RP / "models" / "entity" / f"{species.id}.geo.json", geometry_json(species.model))
            textures = {}
            for name, params in species.textures.items():
                textures[name] = render_texture(species.model, species.painter(params))
                textures[name].save(texture_dir / f"{name}.png")

        write_json(RP / "entity" / f"{species.id}.entity.json", client_entity(species, hand))
        write_json(RP / "render_controllers" / f"{species.id}.render_controllers.json", render_controller(species, hand))
        write_json(RP / "animations" / f"{species.id}.animation.json", walk_animation(species, hand))

        if hand:
            print(f"{species.id}: hand-made, {len(species.textures)} textures")
            continue  # previews of hand-made animals: art_src/m4_scripts/m1_preview.py (docs/art/m1_animals_preview.png)
        sheet = preview_sheet(species, textures)
        sheet.save(ROOT / "docs" / "art" / f"{species.id}_preview.png")
        previews.append(sheet)
        print(f"{species.id}: {len(textures)} textures, {species.model.tex_width}x{species.model.tex_height}")

    # One overview image with every procedural species.
    if not previews:
        return
    width = max(p.width for p in previews)
    overview = Image.new("RGB", (width, sum(p.height for p in previews)), (232, 238, 226))
    y = 0
    for sheet in previews:
        overview.paste(sheet, (0, y))
        y += sheet.height
    overview.save(ROOT / "docs" / "art" / "m1_animals_preview.png")


if __name__ == "__main__":
    main()
