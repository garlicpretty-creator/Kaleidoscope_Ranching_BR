// Checks the pack before it is built or committed:
//   1. every JSON file under packs/ parses;
//   2. the data tables agree with each other (no undeclared identifiers,
//      no empty fields, every animal has a carcass and a butchering entry).
//
// Run with: node tools/validate.mjs

import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = join(root, "packs", "BP", "scripts", "data");
const load = (name) => import(pathToFileURL(join(dataDir, name)).href);

const errors = [];
const fail = (message) => errors.push(message);

// --- 1. JSON syntax -------------------------------------------------------

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

const jsonFiles = walk(join(root, "packs")).filter((path) => path.endsWith(".json"));
for (const path of jsonFiles) {
  try {
    JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    fail(`${relative(root, path)}: ${error.message}`);
  }
}

// --- 2. Data tables -------------------------------------------------------

const { ITEMS, tierIds } = await load("items.js");
const { BLOCKS } = await load("blocks.js");
const { ANIMALS, NEEDS, QUALITY_RULES, FERTILIZED_CHANCE_BY_AFFECTION, AFFECTION } = await load("animals.js");
const { FEEDS, KIND_TIER } = await load("feeds.js");
const { SPECIES } = await load("species.js");
const { PROCESSING_RECIPES, VANILLA_COOKING, WOK_MEATS } = await load("processing.js");
const { BUTCHER_TABLE } = await load("butcher.js");

const itemIds = new Set(ITEMS.map((item) => item.id));
const blockIds = new Set(BLOCKS.map((block) => block.id));

function unique(list, label) {
  const seen = new Set();
  for (const id of list) {
    if (seen.has(id)) fail(`${label}: duplicate id "${id}"`);
    seen.add(id);
  }
}
unique(ITEMS.map((item) => item.id), "items.js");
unique(BLOCKS.map((block) => block.id), "blocks.js");
unique(ANIMALS.map((animal) => animal.id), "animals.js");
unique(PROCESSING_RECIPES.map((recipe) => recipe.id), "processing.js");

for (const entry of [...ITEMS, ...BLOCKS]) {
  for (const [key, value] of Object.entries(entry)) {
    if (typeof value !== "string" || value.trim() === "") fail(`registry entry "${entry.id}" has an empty "${key}"`);
  }
}

/** An item reference is valid when it is a vanilla id or a declared Ranching item. */
function checkItem(id, where) {
  if (typeof id !== "string" || id === "") return fail(`${where}: missing item id`);
  if (id.startsWith("minecraft:")) return;
  if (id.includes(":")) return fail(`${where}: unexpected namespace in "${id}"`);
  if (!itemIds.has(id)) fail(`${where}: item "${id}" is not declared in items.js`);
}

for (const animal of ANIMALS) {
  const where = `animals.js ${animal.id}`;
  checkItem(animal.carcass, `${where} carcass`);
  checkItem(animal.treat, `${where} treat`);
  if (!BUTCHER_TABLE[animal.carcass]) fail(`${where}: no butcher.js entry for "${animal.carcass}"`);
  const care = SPECIES[`kaleidoscope_ranching:${animal.id}`];
  if (!care) fail(`${where}: no row in M2's species.js`);
  else if (care.treat !== `kaleidoscope_ranching:${animal.treat}`) fail(`${where}: treat differs from species.js (${care.treat})`);
  if (!["gestation", "egg"].includes(animal.reproduction)) fail(`${where}: unknown reproduction "${animal.reproduction}"`);
  if (!(animal.days > 0)) fail(`${where}: days must be positive`);
  if (!animal.maleTrait) fail(`${where}: missing maleTrait`);
  if (animal.replaces === null && !animal.biomes?.length) fail(`${where}: a new animal needs spawn biomes`);
  if (animal.groomProduct) checkItem(animal.groomProduct, `${where} groomProduct`);
  if (!Array.isArray(animal.breedItems) || !Array.isArray(animal.temptItems)) fail(`${where}: breedItems and temptItems must be arrays`);
  [...(animal.breedItems ?? []), ...(animal.temptItems ?? [])].forEach((id) => checkItem(id, `${where} breed/tempt`));
  if (animal.reproduction === "gestation" && !animal.breedItems?.length) fail(`${where}: a gestation animal needs breedItems`);
  if (animal.reproduction === "egg") checkItem(animal.fertilizedEgg, `${where} fertilizedEgg`);

  const product = animal.dailyProduct;
  if (product) {
    const ids = product.tierItems ?? (product.tiered ? tierIds(product.item) : [product.item]);
    ids.forEach((id) => checkItem(id, `${where} dailyProduct`));
    if (!itemIds.has(product.via) && !blockIds.has(product.via)) fail(`${where}: dailyProduct.via "${product.via}" is not a declared tool or block`);
  }
}

for (const carcass of Object.keys(BUTCHER_TABLE)) {
  if (!ANIMALS.some((animal) => animal.carcass === carcass)) fail(`butcher.js: "${carcass}" belongs to no animal`);
  const cuts = BUTCHER_TABLE[carcass].cuts;
  if (!cuts?.length) fail(`butcher.js ${carcass}: no cuts`);
  for (const cut of cuts ?? []) {
    checkItem(cut.item, `butcher.js ${carcass}`);
    const [min, max] = cut.count ?? [];
    if (!(min >= 1 && max >= min)) fail(`butcher.js ${carcass}: bad count for "${cut.item}"`);
  }
}

// M2 tables use full identifiers; strip the namespace before checking.
const local = (id) => id.replace(/^kaleidoscope_ranching:/, "");
for (const [item, feed] of Object.entries(FEEDS)) {
  checkItem(local(item), "feeds.js");
  if (!(feed.kind in KIND_TIER)) fail(`feeds.js ${item}: unknown kind ${feed.kind}`);
}
for (const [type, row] of Object.entries(SPECIES)) {
  if (!ANIMALS.some((animal) => `kaleidoscope_ranching:${animal.id}` === type)) fail(`species.js: ${type} is not in animals.js`);
  checkItem(local(row.treat), `species.js ${type} treat`);
  for (const [item] of row.brushDrops ?? []) checkItem(local(item), `species.js ${type} brushDrops`);
}

for (const recipe of PROCESSING_RECIPES) {
  const where = `processing.js ${recipe.id}`;
  if (!blockIds.has(recipe.station)) fail(`${where}: station "${recipe.station}" is not declared in blocks.js`);
  if (!(recipe.ticks >= 0)) fail(`${where}: bad ticks`);
  for (const input of recipe.inputs) (input.anyOf ?? [input.item]).forEach((id) => checkItem(id, where));
  for (const output of recipe.outputs) checkItem(output.item, where);
}
for (const recipe of VANILLA_COOKING) {
  checkItem(recipe.input, `processing.js ${recipe.id}`);
  checkItem(recipe.output, `processing.js ${recipe.id}`);
}
for (const pair of WOK_MEATS) {
  checkItem(pair.raw, "processing.js WOK_MEATS");
  checkItem(pair.cooked, "processing.js WOK_MEATS");
}

if (NEEDS.length !== 4) fail("animals.js: expected four daily needs");
if (FERTILIZED_CHANCE_BY_AFFECTION.length !== AFFECTION.max + 1) fail("animals.js: fertilized chance needs one entry per affection level");
if (QUALITY_RULES.at(-1).tier !== "plain") fail("animals.js: the last quality rule must be the plain fallback");

// Every declared item should be reachable from some table, so the registry
// does not accumulate dead entries.
const referenced = new Set();
const note = (id) => typeof id === "string" && !id.includes(":") && referenced.add(id);
for (const animal of ANIMALS) {
  [animal.carcass, animal.treat, animal.groomProduct, animal.fertilizedEgg, animal.dailyProduct?.via, ...animal.breedItems, ...animal.temptItems].forEach(note);
  const product = animal.dailyProduct;
  if (product) (product.tierItems ?? (product.tiered ? tierIds(product.item) : [product.item])).forEach(note);
}
Object.values(BUTCHER_TABLE).forEach((entry) => entry.cuts.forEach((cut) => note(cut.item)));
Object.keys(FEEDS).forEach((item) => note(local(item)));
Object.values(SPECIES).forEach((row) => [row.treat, ...(row.brushDrops ?? []).map(([item]) => item)].forEach((id) => note(local(id))));
PROCESSING_RECIPES.forEach((recipe) => {
  recipe.inputs.forEach((input) => (input.anyOf ?? [input.item]).forEach(note));
  recipe.outputs.forEach((output) => note(output.item));
});
VANILLA_COOKING.forEach((recipe) => [recipe.input, recipe.output].forEach(note));
WOK_MEATS.forEach((pair) => [pair.raw, pair.cooked].forEach(note));

// M5 dishes (data/dishes.js): every ingredient is a Ranching item, a vanilla
// item or a Cookery item; Ranching ones must be registered.
{
  const { DISHES, DISH_PREPS } = await load("dishes.js");
  const checkIngredient = (where, id) => {
    if (typeof id !== "string") return; // a { tag } slot
    const [ns, name] = id.includes(":") ? id.split(":") : ["kaleidoscope_ranching", id];
    if (ns === "kaleidoscope_ranching") {
      note(name);
      if (!itemIds.has(name)) fail(`dishes.js: ${where} uses unregistered "${id}"`);
    } else if (ns !== "minecraft" && ns !== "kaleidoscope_cookery") fail(`dishes.js: ${where} uses "${id}" from an unknown namespace`);
  };
  for (const dish of DISHES) {
    note(dish.id);
    (dish.slots ?? []).flat().forEach((id) => checkIngredient(dish.id, id));
    if (dish.input) checkIngredient(dish.id, dish.input);
    if (["stockpot", "wok"].includes(dish.station) && (dish.slots.length < 1 || dish.slots.length > 9)) fail(`dishes.js: ${dish.id} needs 1-9 slots for Cookery`);
  }
  for (const prep of DISH_PREPS) {
    note(prep.id);
    prep.makes.flat().forEach((id) => checkIngredient(prep.id, id));
  }
}

// Items whose source or use is a crafting recipe or an interaction that is not
// modelled as a table yet. Listed explicitly so a new orphan is still caught.
// M2 items are produced and used by M2's own generator and scripts.
const CRAFTED_OR_INTERACTIVE = new Set(["cheese_slice", "cowbell", "nursing_bottle", "dried_yak_dung", "animal_crate"]);
for (const item of ITEMS) {
  if (item.owner === "m2") continue;
  if (!referenced.has(item.id) && !CRAFTED_OR_INTERACTIVE.has(item.id)) fail(`items.js: "${item.id}" is declared but no table produces or uses it`);
}

// --- 3. Resource pack wiring ---------------------------------------------

const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));
const rp = join(root, "packs", "RP");
const bp = join(root, "packs", "BP");
const exists = (path) => {
  try {
    statSync(path);
    return true;
  } catch {
    return false;
  }
};

const geometries = new Set();
for (const path of walk(join(rp, "models")).filter((p) => p.endsWith(".json"))) {
  for (const geo of readJson(path)["minecraft:geometry"] ?? []) geometries.add(geo.description.identifier);
}
const animations = new Set();
for (const path of walk(join(rp, "animations")).filter((p) => p.endsWith(".json"))) {
  Object.keys(readJson(path).animations ?? {}).forEach((id) => animations.add(id));
}
const renderControllers = new Map();
for (const path of walk(join(rp, "render_controllers")).filter((p) => p.endsWith(".json"))) {
  Object.entries(readJson(path).render_controllers ?? {}).forEach(([id, rc]) => renderControllers.set(id, rc));
}
const clientEntities = new Map();
for (const path of walk(join(rp, "entity")).filter((p) => p.endsWith(".json"))) {
  const description = readJson(path)["minecraft:client_entity"].description;
  clientEntities.set(description.identifier, { description, path });
}

for (const path of walk(join(bp, "entities")).filter((p) => p.endsWith(".json"))) {
  const id = readJson(path)["minecraft:entity"].description.identifier;
  const client = clientEntities.get(id);
  if (!client) {
    fail(`${id}: behaviour entity has no client entity`);
    continue;
  }
  const { description } = client;
  for (const geo of Object.values(description.geometry ?? {})) if (!geometries.has(geo)) fail(`${id}: unknown geometry ${geo}`);
  for (const [name, anim] of Object.entries(description.animations ?? {})) {
    if (!anim.startsWith("animation.common.") && !animations.has(anim)) fail(`${id}: unknown animation ${anim} (${name})`);
  }
  for (const texture of Object.values(description.textures ?? {})) {
    if (!exists(join(rp, texture + ".png"))) fail(`${id}: missing texture ${texture}.png`);
  }
  for (const rcId of description.render_controllers ?? []) {
    const rc = renderControllers.get(typeof rcId === "string" ? rcId : Object.keys(rcId)[0]);
    if (!rc) {
      fail(`${id}: unknown render controller ${JSON.stringify(rcId)}`);
      continue;
    }
    for (const list of Object.values(rc.arrays?.textures ?? {})) {
      for (const ref of list) {
        if (!(ref.replace("Texture.", "") in (description.textures ?? {}))) fail(`${id}: render controller uses undefined ${ref}`);
      }
    }
  }
}

// --- 4. Registries against generated item and block files ----------------

const fileIds = (dir, key) =>
  exists(dir)
    ? walk(dir).filter((p) => p.endsWith(".json")).map((p) => ({ path: p, data: readJson(p)[key] }))
    : [];
const itemFiles = fileIds(join(bp, "items"), "minecraft:item");
const blockFiles = fileIds(join(bp, "blocks"), "minecraft:block");
const itemAtlas = exists(join(rp, "textures/item_texture.json")) ? readJson(join(rp, "textures/item_texture.json")).texture_data : {};
const terrainAtlas = exists(join(rp, "textures/terrain_texture.json")) ? readJson(join(rp, "textures/terrain_texture.json")).texture_data : {};

const fileItemIds = new Set();
for (const { path, data } of itemFiles) {
  const id = local(data.description.identifier);
  fileItemIds.add(id);
  if (!itemIds.has(id)) fail(`${relative(root, path)}: item "${id}" is not in items.js`);
  const icon = data.components?.["minecraft:icon"];
  const iconName = typeof icon === "string" ? icon : icon?.textures?.default ?? icon?.texture;
  if (!itemAtlas[iconName]) fail(`${relative(root, path)}: icon "${iconName}" missing from item_texture.json`);
}
for (const item of ITEMS) {
  if (item.owner === "m2" && !fileItemIds.has(item.id)) fail(`items.js: M2 item "${item.id}" has no file in packs/BP/items`);
}
for (const { path, data } of blockFiles) {
  const id = local(data.description.identifier);
  if (!blockIds.has(id)) fail(`${relative(root, path)}: block "${id}" is not in blocks.js`);
  const instances = [data.components?.["minecraft:material_instances"], ...(data.permutations ?? []).map((p) => p.components?.["minecraft:material_instances"])];
  for (const set of instances.filter(Boolean)) {
    for (const instance of Object.values(set)) {
      if (typeof instance === "object" && instance.texture && !terrainAtlas[instance.texture]) {
        fail(`${relative(root, path)}: texture "${instance.texture}" missing from terrain_texture.json`);
      }
    }
  }
}
const blockBones = new Map();
for (const path of walk(join(rp, "models")).filter((p) => p.endsWith(".json"))) {
  for (const geo of readJson(path)["minecraft:geometry"] ?? []) {
    blockBones.set(geo.description.identifier, new Set((geo.bones ?? []).map((bone) => bone.name)));
  }
}
for (const { path, data } of blockFiles) {
  const geometry = data.components?.["minecraft:geometry"];
  const id = typeof geometry === "string" ? geometry : geometry?.identifier;
  if (!id || id.startsWith("minecraft:")) continue;
  const bones = blockBones.get(id);
  if (!bones) {
    fail(`${relative(root, path)}: unknown geometry ${id}`);
    continue;
  }
  for (const bone of Object.keys(geometry?.bone_visibility ?? {})) {
    if (!bones.has(bone)) fail(`${relative(root, path)}: bone_visibility names missing bone "${bone}"`);
  }
}

for (const [name, entry] of [...Object.entries(itemAtlas), ...Object.entries(terrainAtlas)]) {
  const file = typeof entry.textures === "string" ? entry.textures : entry.textures?.[0];
  if (file && !exists(join(rp, file + ".png"))) fail(`atlas entry "${name}": missing ${file}.png`);
}

// --- 5. API example add-on -------------------------------------------------

// ## The example is what add-on authors copy, so it must stay valid: its JSON
// ## parses, and every kr_example: id it registers has an item or entity file.
const example = join(root, "examples", "api-example");
if (exists(example)) {
  const exampleJson = walk(example).filter((path) => path.endsWith(".json"));
  for (const path of exampleJson) {
    try {
      JSON.parse(readFileSync(path, "utf8"));
    } catch (error) {
      fail(`${relative(root, path)}: ${error.message}`);
    }
  }
  const defined = new Set();
  for (const path of exampleJson) {
    const data = JSON.parse(readFileSync(path, "utf8"));
    const id = data["minecraft:item"]?.description?.identifier ?? data["minecraft:entity"]?.description?.identifier;
    if (id) defined.add(id);
  }
  const script = readFileSync(join(example, "BP", "scripts", "main.js"), "utf8");
  // (The example's recipe id equals its output item, so every id is an item or entity.)
  const used = [...script.matchAll(/`\$\{ME\}:([a-z0-9_]+)`/g)].map(([, name]) => `kr_example:${name}`);
  if (!used.length) fail("examples/api-example: no kr_example ids found in scripts/main.js");
  for (const id of new Set(used)) if (!defined.has(id)) fail(`examples/api-example uses ${id} but no item or entity file defines it`);
}

// --- Vibrant Visuals materials ---------------------------------------------

{
  // ## Texture sets only take effect when the manifest declares `pbr`, and a
  // ## set whose colour layer is missing makes the game drop the texture.
  // ## tools/gen_pbr.py writes, beside every colour texture, a per-pixel MERS
  // ## image (RGBA: metalness, emissive, roughness, subsurface), a normal map and
  // ## the texture set that names them. The game rejects a set whose layers are
  // ## missing or have the wrong channel count.
  const textureRoot = join(rp, "textures");
  const textureFiles = walk(textureRoot);
  const pngs = new Set(textureFiles.filter((path) => path.endsWith(".png")));
  const isLayer = (path) => /_(mers|normal)\.png$/.test(path);
  const sets = textureFiles.filter((path) => path.endsWith(".texture_set.json"));
  const manifest = JSON.parse(readFileSync(join(rp, "manifest.json"), "utf8"));
  if (!manifest.capabilities?.includes("pbr")) fail("RP manifest does not declare the pbr capability");
  /** PNG width, height and colour type (2 = RGB, 6 = RGBA) from the IHDR chunk. */
  const pngHeader = (path) => {
    const b = readFileSync(path);
    return { width: b.readUInt32BE(16), height: b.readUInt32BE(20), colorType: b[25] };
  };
  for (const path of sets) {
    const where = relative(root, path);
    const set = JSON.parse(readFileSync(path, "utf8"))["minecraft:texture_set"];
    const png = path.replace(/\.texture_set\.json$/, ".png");
    const name = png.split(/[\\/]/).at(-1).replace(/\.png$/, "");
    if (!pngs.has(png)) fail(`${where}: no colour texture next to it`);
    if (set?.color !== name) fail(`${where}: color must name the texture beside it`);
    if (set?.metalness_emissive_roughness && set?.metalness_emissive_roughness_subsurface) fail(`${where}: MER and MERS together`);
    if (set?.normal && set?.heightmap) fail(`${where}: normal and heightmap together`);
    if (!pngs.has(png)) continue;
    const size = pngHeader(png);
    for (const [layer, channels] of [["metalness_emissive_roughness_subsurface", [6]], ["normal", [2, 6]]]) {
      const file = join(dirname(png), `${set?.[layer]}.png`);
      if (typeof set?.[layer] !== "string" || !pngs.has(file)) {
        fail(`${where}: ${layer} image missing, run npm run generate`);
        continue;
      }
      const head = pngHeader(file);
      if (head.width !== size.width || head.height !== size.height) fail(`${relative(root, file)}: not the colour texture's size, run npm run generate`);
      if (!channels.includes(head.colorType)) fail(`${relative(root, file)}: wrong channel count for ${layer}`);
    }
  }
  // Every colour texture has its set (tools/gen_pbr.py), and no layer is left without one.
  for (const png of pngs) {
    if (isLayer(png)) {
      const owner = png.replace(/_(mers|normal)\.png$/, ".texture_set.json");
      if (!sets.includes(owner)) fail(`${relative(root, png)}: stale material layer, run npm run generate`);
      continue;
    }
    if (!sets.includes(png.replace(/\.png$/, ".texture_set.json"))) fail(`${relative(root, png)}: no texture set, run npm run generate`);
  }
}

// --- Report ---------------------------------------------------------------

// --- RetroDiffusion icon prompts (tools/art/rd_icons.py) -----------------------
// Every registry item needs a prompt, or a `from` + `badge` entry, so new items
// are not forgotten when the icons are regenerated.

const iconPrompts = readJson(join(root, "tools/art/icon_prompts.json")).items;
for (const item of ITEMS) {
  const entry = iconPrompts[item.id];
  if (!entry) fail(`tools/art/icon_prompts.json: no entry for item "${item.id}"`);
  else if (!entry.prompt && !(entry.from && iconPrompts[entry.from]?.prompt)) fail(`tools/art/icon_prompts.json: "${item.id}" needs a prompt or a "from" with one`);
}

// --- Simplified Chinese names (data/zh_cn.js) ---------------------------------

{
  const { toSimplified, TRADITIONAL_HINTS } = await import(pathToFileURL(join(root, "packs/BP/scripts/data/zh_cn.js")).href);
  const { ANIMAL_NAMES } = await import(pathToFileURL(join(root, "packs/BP/scripts/data/items.js")).href);
  const names = [...ITEMS.filter((i) => i.owner !== "m2"), ...BLOCKS.filter((b) => b.owner !== "m2")].map((row) => [row.id, row.zh]);
  for (const [id, zh] of [...names, ...ANIMAL_NAMES.map(([id, zh]) => [id, zh])]) {
    const left = [...toSimplified(zh)].filter((ch) => TRADITIONAL_HINTS.includes(ch));
    if (left.length) fail(`zh_CN name of "${id}" (${toSimplified(zh)}) still has Traditional characters: ${left.join("")}; add them to data/zh_cn.js`);
  }
}

if (errors.length) {
  console.error(`validate: ${errors.length} problem(s)`);
  for (const message of errors) console.error("  - " + message);
  process.exit(1);
}
console.log(
  `validate: ok — ${jsonFiles.length} JSON files, ${ITEMS.length} items, ${BLOCKS.length} blocks, ` +
    `${ANIMALS.length} animals, ${PROCESSING_RECIPES.length} processing recipes, ${Object.keys(BUTCHER_TABLE).length} carcasses`
);
