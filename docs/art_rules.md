# 樂牧 art rules (from the user, binding)

Repo: D:\Kaleidoscope\KR (Minecraft Bedrock add-on 《森羅物語：樂牧》). Scripts are the source; .bbmodel is output.
Never hand-edit generated files under packs/ except via the scripts/generators. Windows: run npm/python in Git Bash.
CRLF noise: commit only files listed by `git -c core.autocrlf=false diff --ignore-cr-at-eol --name-only` plus new files.

## Animal models
- Bone names must not change. Required: body, head, a_head, b_head, a_torso, b_torso.
- Legs: poultry use a_/b_ + leg_left, leg_right, wing_left, wing_right; alpaca uses leg_fl, leg_fr, leg_bl, leg_br (with a_/b_ prefix).
  Walk, sleep poses and eat/drink actions are generated from these names; validate blocks missing ones.
- Prefixes mean things: a_ adult, b_ young, m_ male only, fa_ adult female only. wool_ is alpaca fleece, hidden after shearing, so the body under it must be painted as short fleece.
- Eyes: paint with exactly two fixed colours on the front of the head: pupil (26, 22, 26), white (238, 236, 232). Eyelids are added automatically by finding these colours; other colours fail validate.
- The head turns: when eating/drinking it rotates 38-62 degrees down. A long muzzle will poke into the trough or the ground. Check with art_src/m4_scripts/actions_preview.py.
- Style: follow the existing animals, aligned to vanilla's look: small square eyes, vanilla leg lengths, NOT big-eyed chibi. Males a bit larger than females; the young is a separate model set.
- Textures: female, male, baby for each species.
- Low-poly: few cubes, detail painted per face, not geometry (existing Cookery median ~8 cubes per block model; animals like the existing cow/duck scripts).

## Blocks
- Flip-book parts: crank_0..3, plunger_0..3, wheel_0..3, blade_0..1, beater_0..3. Names and frame counts follow packs/BP/scripts/data/stationFrames.js; frame 0 is the resting look.
- Processing blocks keep busy, busy_1..3 (contents in three processing stages).
- Placeable food: piece_1..piece_N, eaten highest number first; roast turkey has 6 pieces.
- Model top must equal the selection box height; roast turkey is currently 5 px. If the height changes, also change `roast` in tools/gen_blocks.mjs.
- Hand-made models: put art/blocks/<id>.geo.json and .png; the generator uses them instead of the script-drawn one.

## Regeneration order
- Animal: run that animal's model script, then `python art_src/m4_scripts/client.py <id>`.
- Butcher rack: butcher_rack.py, then split_rack_texture.py (carcass three-stage looks).
- Finally `npm run generate` (carcass icons, PBR, sleep poses, eyelids redone automatically). Then `npm run validate`, `npm test`, `python tools/fix_zfight.py --check`.
- New textures that are not fur or wood: add a material rule in tools/gen_pbr.py RULES (e.g. metal, feathers).

## Licence
All original. Do not copy Cookery (CC BY-NC-SA) or vanilla textures/models.
