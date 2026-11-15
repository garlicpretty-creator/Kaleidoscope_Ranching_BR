// Generates the behaviour-pack block files for the M3 blocks. Geometry and
// textures come from tools/gen_m3_art.py; bone names follow tools/art/blocks.py.
//
// Run with: node tools/gen_blocks.mjs

import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const load = (name) => import(pathToFileURL(join(root, "packs/BP/scripts/data", name)).href);
const { ANIMALS } = await load("animals.js");
const { BLOCKS } = await load("blocks.js");

const NS = "kaleidoscope_ranching";
const S = (name) => `${NS}:${name}`;
const state = (name) => `q.block_state('${S(name)}')`;

const CARCASSES = ANIMALS.map((animal) => animal.id);

const FULL = { origin: [-8, 0, -8], size: [16, 16, 16] };
const box = (x, y, z, w, h, d) => ({ origin: [x, y, z], size: [w, h, d] });

const STATIONS = ["butter_churn", "cheese_press", "aging_rack", "fermenting_jar", "pickling_vat"];

const DEFS = {
  butcher_rack: {
    component: "butcher_rack",
    states: { [S("carcass")]: ["none", ...CARCASSES], [S("cut")]: [false, true] },
    bones: Object.fromEntries(
      CARCASSES.flatMap((id) => [
        [`carcass_${id}`, `${state("carcass")} == '${id}' && !${state("cut")}`],
        [`cut_${id}`, `${state("carcass")} == '${id}' && ${state("cut")}`],
      ])
    ),
    collision: FULL,
    selection: FULL,
    seconds: 1.5,
  },
  nest_box: {
    component: "nest_box",
    states: { [S("eggs")]: [0, 1, 2, 3, 4] },
    bones: Object.fromEntries([1, 2, 3, 4].map((n) => [`egg_${n}`, `${state("eggs")} >= ${n}`])),
    collision: box(-7, 0, -7, 14, 6, 14),
    selection: box(-7, 0, -7, 14, 6, 14),
    seconds: 1,
  },
  incubator: {
    component: "incubator",
    states: { [S("eggs")]: [0, 1, 2, 3, 4], [S("busy")]: [false, true] },
    bones: { ...Object.fromEntries([1, 2, 3, 4].map((n) => [`egg_${n}`, `${state("eggs")} >= ${n}`])), busy: state("busy") },
    collision: box(-7, 0, -7, 14, 12, 14),
    selection: box(-7, 0, -7, 14, 12, 14),
    seconds: 1,
    light: true,
  },
  ...Object.fromEntries(
    STATIONS.map((id) => [
      id,
      {
        component: "station",
        states: { [S("busy")]: [false, true] },
        bones: { busy: state("busy") },
        collision: FULL,
        selection: FULL,
        seconds: 1.5,
      },
    ])
  ),
};

const ROTATION = { north: 0, east: 270, south: 180, west: 90 };

function blockJson(id, def) {
  const components = {
    "minecraft:geometry": { identifier: `geometry.${NS}.${id}`, bone_visibility: def.bones },
    "minecraft:material_instances": { "*": { texture: `kr_${id}`, render_method: "alpha_test" } },
    "minecraft:collision_box": def.collision,
    "minecraft:selection_box": def.selection,
    "minecraft:destructible_by_mining": { seconds_to_destroy: def.seconds },
    "minecraft:destructible_by_explosion": { explosion_resistance: 3 },
    "minecraft:light_dampening": 0,
    "minecraft:map_color": "#8a6a44",
    [S(def.component)]: {},
  };
  return {
    format_version: "1.21.90",
    "minecraft:block": {
      description: {
        identifier: S(id),
        menu_category: { category: "items" },
        traits: {
          "minecraft:placement_direction": { enabled_states: ["minecraft:cardinal_direction"], y_rotation_offset: 180 },
        },
        states: def.states,
      },
      components,
      permutations: [
        ...Object.entries(ROTATION).map(([direction, degrees]) => ({
          condition: `q.block_state('minecraft:cardinal_direction') == '${direction}'`,
          components: { "minecraft:transformation": { rotation: [0, degrees, 0] } },
        })),
        ...(def.light ? [{ condition: state("busy"), components: { "minecraft:light_emission": 7 } }] : []),
      ],
    },
  };
}

const registered = new Set(BLOCKS.map((block) => block.id));
const dir = join(root, "packs/BP/blocks");
mkdirSync(dir, { recursive: true });
for (const name of readdirSync(dir)) if (name.startsWith("r_")) rmSync(join(dir, name));
for (const [id, def] of Object.entries(DEFS)) {
  if (!registered.has(id)) throw new Error(`${id} is not in blocks.js`);
  writeFileSync(join(dir, `r_${id}.json`), JSON.stringify(blockJson(id, def), null, 2) + "\n");
}
console.log(`gen_blocks: wrote ${Object.keys(DEFS).length} blocks`);
