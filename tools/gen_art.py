#!/usr/bin/env python3
"""Generates all resource-pack files for the M1 animals.

For each species in tools/art/animals.py this writes the geometry, every
texture, the client entity, the render controller, the walk animation and a
preview sheet under docs/art/. Run with: python3 tools/gen_art.py
"""

import json
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


def client_entity(species):
    textures = {name: f"textures/entity/ranching/{species.id}/{name}" for name in species.texture_order}
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
                    "scale": f"(!q.is_baby && {SEX_IS_MALE}) ? 1.1 : 1.0",
                    "animate": ["walk", "look_at_target"],
                },
                "render_controllers": [f"controller.render.{NS}.{species.id}"],
                "spawn_egg": {"base_color": base, "overlay_color": overlay},
            }
        },
    }


def render_controller(species):
    visibility = [{"*": True}]
    for bone in species.model.bones:
        rule = bone_rule(bone.name)
        if rule:
            visibility.append({bone.name: rule[1]})
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


def walk_animation(species):
    bones = {bone: {"rotation": [molang, 0, 0]} for bone, molang in species.walk.items()}
    for bone, (axis, molang) in species.extra_animations.items():
        rotation = [0, 0, 0]
        rotation["xyz".index(axis)] = molang
        bones[bone] = {"rotation": rotation}
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
        pack(species.model)
        write_json(RP / "models" / "entity" / f"{species.id}.geo.json", geometry_json(species.model))

        texture_dir = RP / "textures" / "entity" / "ranching" / species.id
        texture_dir.mkdir(parents=True, exist_ok=True)
        for stale in texture_dir.glob("*.png"):
            if stale.stem not in species.textures:
                stale.unlink()
        textures = {}
        for name, params in species.textures.items():
            textures[name] = render_texture(species.model, species.painter(params))
            textures[name].save(texture_dir / f"{name}.png")

        write_json(RP / "entity" / f"{species.id}.entity.json", client_entity(species))
        write_json(RP / "render_controllers" / f"{species.id}.render_controllers.json", render_controller(species))
        write_json(RP / "animations" / f"{species.id}.animation.json", walk_animation(species))

        sheet = preview_sheet(species, textures)
        sheet.save(ROOT / "docs" / "art" / f"{species.id}_preview.png")
        previews.append(sheet)
        print(f"{species.id}: {len(textures)} textures, {species.model.tex_width}x{species.model.tex_height}")

    # One overview image with every species.
    width = max(p.width for p in previews)
    overview = Image.new("RGB", (width, sum(p.height for p in previews)), (232, 238, 226))
    y = 0
    for sheet in previews:
        overview.paste(sheet, (0, y))
        y += sheet.height
    overview.save(ROOT / "docs" / "art" / "m1_animals_preview.png")


if __name__ == "__main__":
    main()
