// Generates the Vibrant Visuals material files (`*.texture_set.json`) that sit
// next to Ranching's colour textures.
//
// ## The resource pack declares the `pbr` capability. Without a texture set a
// ## texture renders as a fully rough, non-metallic surface, which is right for
// ## fur, feed and raw meat. Only surfaces that should look different are
// ## listed here: metal, glazed pottery, glass, water, worked wood, dairy fat.
// ## Each gets one uniform metalness / emissive / roughness value, so no extra
// ## image is needed and the look with Vibrant Visuals off is unchanged.
// ## A per-pixel MER or normal map can replace a uniform value later: point
// ## the texture set at the image instead of the number triple.
//
// Run with: node tools/gen_pbr.mjs   (part of `npm run generate`)

import { existsSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const textures = join(root, "packs", "RP", "textures");

/** [metalness, emissive, roughness], each 0–255. */
export const MATERIALS = {
  metal: [215, 0, 85],
  glazed: [0, 0, 80],
  glass: [0, 0, 50],
  water: [0, 0, 20],
  stone: [0, 0, 150],
  wood: [0, 0, 200],
  fat: [0, 0, 105],
  bone: [0, 0, 140],
};

/** Texture path under textures/ (no extension) → material. First match wins. */
export const RULES = [
  // Blocks
  [/^blocks\/kaleidoscope_ranching\/kr_(auto_feeder|auto_waterer)/, "metal"],
  [/^blocks\/kaleidoscope_ranching\/kr_water$/, "water"],
  [/^blocks\/kaleidoscope_ranching\/kr_(water_trough|salt_lick)$/, "stone"],
  [/^blocks\/kaleidoscope_ranching\/kr_(planks|trough|chaff_cutter|compost_bin_side|feed_mixer)/, "wood"],
  [/^blocks\/ranching\/(fermenting_jar|pickling_vat)$/, "glazed"],
  [/^blocks\/ranching\/incubator$/, "stone"],
  [/^blocks\/ranching\/(aging_rack|butcher_rack|butter_churn|cheese_press|nest_box|hay_rack|hitching_post|tanning_rack)$/, "wood"],
  [/^blocks\/ranching\/cheese_wheel$/, "fat"],
  // Items
  [/^items\/ranching\/(milking_pail|cowbell)$/, "metal"],
  [/^items\/ranching\/(nursing_bottle|\w+_milk(_fine|_superb)?|cream|whey|yogurt)$/, "glass"],
  [/^items\/ranching\/(butter|ghee|lard|beef_tallow|mutton_tallow|pork_fat|fresh_cheese|cheese_slice|aged_cheese_wheel)$/, "fat"],
  [/^items\/ranching\/(large_bone|cattle_horn|billy_goat_horn|chicken_frame)$/, "bone"],
  [/^items\/kaleidoscope_ranching\/manure_fork$/, "metal"],
];

export function materialFor(texturePath) {
  return RULES.find(([pattern]) => pattern.test(texturePath))?.[1];
}

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const files = walk(textures);
  for (const path of files) if (path.endsWith(".texture_set.json")) rmSync(path);

  const used = new Set();
  let written = 0;
  for (const path of files.filter((file) => file.endsWith(".png")).sort()) {
    const key = relative(textures, path).replace(/\\/g, "/").replace(/\.png$/, "");
    const rule = RULES.find(([pattern]) => pattern.test(key));
    if (!rule) continue;
    used.add(rule);
    const name = key.split("/").at(-1);
    const json = {
      format_version: "1.16.100",
      "minecraft:texture_set": { color: name, metalness_emissive_roughness: MATERIALS[rule[1]] },
    };
    writeFileSync(path.replace(/\.png$/, ".texture_set.json"), JSON.stringify(json, null, 2) + "\n");
    written++;
  }
  for (const rule of RULES) if (!used.has(rule)) console.warn(`gen_pbr: rule ${rule[0]} matches no texture`);
  if (!existsSync(join(root, "packs", "RP", "manifest.json"))) throw new Error("resource pack manifest missing");
  console.log(`gen_pbr: wrote ${written} texture sets`);
}
