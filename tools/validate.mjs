// Checks the pack before it is built or committed:
//   1. every JSON file under packs/ parses;
//   2. the data tables agree with each other (no undeclared identifiers,
//      no empty fields, every animal has a carcass and a butchering entry).
//
// Run with: node tools/validate.mjs

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
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

const { ITEMS } = await load("items.js");
const { BLOCKS } = await load("blocks.js");
const { ANIMALS, NEEDS, FERTILIZED_CHANCE_BY_AFFECTION, AFFECTION } = await load("animals.js");
const { FEEDS, KIND_TIER } = await load("feeds.js");
const { SPECIES } = await load("species.js");
const { PROCESSING_RECIPES, VANILLA_COOKING, WOK_MEATS } = await load("processing.js");
const { TAGGED } = await load("tags.js");
/** A recipe input's item ids; a { tag } input stands for Ranching's own items with that tag (data/tags.js). */
const inputIdsOf = (input) => (input.tag ? TAGGED[input.tag] ?? [] : input.anyOf ?? [input.item]);
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
    const ids = [product.item];
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
  for (const input of recipe.inputs) inputIdsOf(input).forEach((id) => checkItem(id, where));
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

// Every declared item should be reachable from some table, so the registry
// does not accumulate dead entries.
const referenced = new Set();
const note = (id) => typeof id === "string" && !id.includes(":") && referenced.add(id);
for (const animal of ANIMALS) {
  [animal.carcass, animal.treat, animal.groomProduct, animal.fertilizedEgg, animal.dailyProduct?.via, ...animal.breedItems, ...animal.temptItems].forEach(note);
  const product = animal.dailyProduct;
  if (product) note(product.item);
}
Object.values(BUTCHER_TABLE).forEach((entry) => entry.cuts.forEach((cut) => note(cut.item)));
Object.keys(FEEDS).forEach((item) => note(local(item)));
Object.values(SPECIES).forEach((row) => [row.treat, ...(row.brushDrops ?? []).map(([item]) => item)].forEach((id) => note(local(id))));
PROCESSING_RECIPES.forEach((recipe) => {
  recipe.inputs.forEach((input) => inputIdsOf(input).forEach(note));
  recipe.outputs.forEach((output) => note(output.item));
  (recipe.aged?.outputs ?? []).forEach((output) => note(output.item)); // 1.1 熟成分級
});
VANILLA_COOKING.forEach((recipe) => [recipe.input, recipe.output].forEach(note));
WOK_MEATS.forEach((pair) => [pair.raw, pair.cooked].forEach(note));
{
  // 1.1: butcher-rack air-drying and water-trough washing (input → output).
  const { DRYING = {}, WASHING = {}, SMOKING = {} } = await load("processing.js");
  for (const table of [DRYING, WASHING, SMOKING]) for (const [from, to] of Object.entries(table)) [from, to].forEach(note);
}

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

// 1.1: every crafting and furnace recipe the generators wrote counts too, as a
// source (its result) and a use (its ingredients).
for (const file of readdirSync(join(root, "packs", "BP", "recipes"), { recursive: true }).filter((f) => String(f).endsWith(".json"))) {
  const data = JSON.parse(readFileSync(join(root, "packs", "BP", "recipes", String(file)), "utf8"));
  const recipe = Object.values(data).find((v) => v && typeof v === "object" && v.description);
  if (!recipe) continue;
  const ids = [
    ...Object.values(recipe.key ?? {}), ...(recipe.ingredients ?? []), recipe.input, recipe.output, recipe.result,
  ].map((entry) => (typeof entry === "string" ? entry : entry?.item));
  ids.forEach((id) => typeof id === "string" && id.startsWith("kaleidoscope_ranching:") && note(local(id)));
}

// Items whose source or use is a crafting recipe or an interaction that is not
// modelled as a table yet. Listed explicitly so a new orphan is still caught.
// M2 items are produced and used by M2's own generator and scripts.
// The two dairy drinks are made in the Tavern's shaker (api/tavern.js registers the recipes).
const CRAFTED_OR_INTERACTIVE = new Set(["cheese_slice", "cowbell", "nursing_bottle", "dried_yak_dung", "animal_crate", "cream_cocoa", "yogurt_berry_drink",
  // Milk wine ferments in the Tavern's barrel (api/tavern.js barrel recipes).
  "milk_wine", "yak_milk_wine"]);
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

// --- 3a. Things worn: player wearables, animal gear, the drying rack -----------

// Every item worn in an armour slot shows on the player: an attachable with the item's id,
// whose geometry binds only to the player's own bones and whose texture exists.
const PLAYER_BONES = new Set(["root", "waist", "body", "head", "leftArm", "rightArm", "leftLeg", "rightLeg"]);
const sameJson = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
const geometryById = new Map();
for (const path of walk(join(rp, "models")).filter((p) => p.endsWith(".json"))) {
  for (const geo of readJson(path)["minecraft:geometry"] ?? []) geometryById.set(geo.description.identifier, geo);
}
const attachables = new Map();
if (exists(join(rp, "attachables"))) {
  for (const path of walk(join(rp, "attachables")).filter((p) => p.endsWith(".json"))) {
    const description = readJson(path)["minecraft:attachable"].description;
    attachables.set(description.identifier, description);
  }
}
for (const path of walk(join(bp, "items")).filter((p) => p.endsWith(".json"))) {
  const item = readJson(path)["minecraft:item"];
  if (!item.components?.["minecraft:wearable"]?.slot?.startsWith("slot.armor.")) continue;
  const id = item.description.identifier;
  const attachable = attachables.get(id);
  if (!attachable) {
    fail(`${id}: worn in an armour slot but has no attachable (art_src/m4_scripts/wearables.py)`);
    continue;
  }
  const geo = geometryById.get(attachable.geometry?.default);
  if (!geo) fail(`${id}: attachable geometry ${attachable.geometry?.default} does not exist`);
  else {
    if (!geo.bones.some((bone) => bone.cubes?.length)) fail(`${id}: attachable geometry has no cubes`);
    for (const bone of geo.bones) if (!PLAYER_BONES.has(bone.name)) fail(`${id}: attachable bone "${bone.name}" is not a player bone`);
  }
  for (const key of ["default", "held"]) {
    const texture = attachable.textures?.[key];
    if (!texture || !exists(join(rp, texture + ".png"))) fail(`${id}: attachable texture "${key}" (${texture}.png) is missing`);
  }
  // Worn: the clothes, only in their own armour slot. Anywhere else (in a hand): the item's
  // icon as a flat sprite bound to the holding bone, with the icon as its texture.
  const slot = { "slot.armor.head": "head", "slot.armor.chest": "chest", "slot.armor.legs": "legs", "slot.armor.feet": "feet" }[item.components["minecraft:wearable"].slot];
  const entries = (attachable.render_controllers ?? []).map((entry) => (typeof entry === "string" ? [entry, null] : Object.entries(entry)[0]));
  for (const [rcId] of entries) if (!renderControllers.has(rcId)) fail(`${id}: attachable uses unknown render controller ${rcId}`);
  const worn = entries.find(([rcId]) => renderControllers.get(rcId)?.geometry === "Geometry.default");
  const held = entries.find(([rcId]) => renderControllers.get(rcId)?.geometry === "Geometry.held");
  const squash = (text) => String(text ?? "").replace(/\s+/g, "").replace(/\bcontext\./g, "c.");
  if (!worn || squash(worn[1]) !== `c.item_slot=='${slot}'`) fail(`${id}: the worn render controller must be gated on c.item_slot == '${slot}'`);
  if (!held || squash(held[1]) !== `c.item_slot!='${slot}'`) fail(`${id}: no render controller draws the held icon when c.item_slot != '${slot}'`);
  else if (!JSON.stringify(renderControllers.get(held[0]).textures ?? []).includes("Texture.held")) fail(`${id}: the held render controller does not use Texture.held`);
  const heldGeo = geometryById.get(attachable.geometry?.held);
  if (!heldGeo) fail(`${id}: attachable geometry "held" ${attachable.geometry?.held} does not exist`);
  else if (!heldGeo.bones.some((bone) => bone.cubes?.length && /item_slot_to_bone_name\(c(ontext)?\.item_slot\)/.test(bone.binding ?? ""))) {
    fail(`${id}: the held geometry has no bone bound to the holding slot`);
  }
  const icon = item.components["minecraft:icon"];
  const iconAtlas = exists(join(rp, "textures/item_texture.json")) ? readJson(join(rp, "textures/item_texture.json")).texture_data : {};
  const iconFile = iconAtlas[typeof icon === "string" ? icon : icon?.textures?.default]?.textures;
  if (iconFile && attachable.textures?.held !== iconFile) fail(`${id}: the held texture should be the item's icon ${iconFile}`);
}

// Every gear kind shows on every animal that can wear it: a synced property on the entity, and
// on the client a gear geometry layered over the animal by its own render controller. The gear
// geometry repeats the animal's skeleton (same names, parents and pivots, no cubes) so the
// walk and sleep animations carry the gear along.
{
  const { GEAR, gearProperty } = await load("gear.js");
  for (const gear of GEAR) {
    if (!itemIds.has(gear.item)) fail(`gear.js ${gear.id}: item "${gear.item}" is not declared in items.js`);
    for (const animalId of gear.animals) {
      const where = `gear ${gear.id} on ${animalId}`;
      const property = gearProperty(gear.id);
      if (!ANIMALS.some((animal) => animal.id === animalId)) {
        fail(`${where}: not in animals.js`);
        continue;
      }
      const declared = readJson(join(bp, "entities", `${animalId}.json`))["minecraft:entity"].description.properties?.[property];
      if (declared?.type !== "bool" || declared.client_sync !== true) fail(`${where}: the entity has no synced bool property ${property}`);
      const description = clientEntities.get(`kaleidoscope_ranching:${animalId}`)?.description;
      const geo = geometryById.get(description?.geometry?.gear);
      const base = geometryById.get(description?.geometry?.default);
      if (!geo || !base) {
        fail(`${where}: the client entity has no gear geometry`);
        continue;
      }
      if (!description.textures?.gear) fail(`${where}: the client entity has no gear texture`);
      const controller = (description.render_controllers ?? [])
        .map((rcId) => renderControllers.get(typeof rcId === "string" ? rcId : Object.keys(rcId)[0]))
        .find((rc) => rc?.geometry === "Geometry.gear");
      if (!controller) fail(`${where}: no render controller draws Geometry.gear`);
      else if (!JSON.stringify(controller.textures ?? []).includes("Texture.gear")) fail(`${where}: the gear render controller does not use Texture.gear`);
      const baseBones = new Map(base.bones.map((bone) => [bone.name, bone]));
      const gearBones = new Map(geo.bones.map((bone) => [bone.name, bone]));
      for (const bone of geo.bones) {
        if (bone.name.startsWith("gear_")) {
          // A gear bone with no parent stands on the ground by itself (the plough).
          if (bone.parent && !gearBones.has(bone.parent)) fail(`${where}: bone ${bone.name} hangs on missing bone "${bone.parent}"`);
          continue;
        }
        const own = baseBones.get(bone.name);
        if (!own) fail(`${where}: skeleton bone "${bone.name}" is not in the animal's model`);
        else if (!sameJson(own.parent, bone.parent) || !sameJson(own.pivot, bone.pivot) || !sameJson(own.rotation, bone.rotation)) fail(`${where}: skeleton bone "${bone.name}" differs from the animal's model (run npm run generate)`);
        if (bone.cubes?.length) fail(`${where}: skeleton bone "${bone.name}" must not carry cubes`);
      }
      for (const name of [`gear_${gear.id}`, ...(gear.babies ? [`gear_${gear.id}_baby`] : [])]) {
        if (!gearBones.get(name)?.cubes?.length) fail(`${where}: the gear geometry has no bone ${name} with cubes`);
        const rule = (controller?.part_visibility ?? []).find((entry) => name in entry)?.[name];
        if (typeof rule !== "string" || !rule.includes(`'${property}'`)) fail(`${where}: bone ${name} is not shown by ${property}`);
      }
    }
  }
}

// The butcher rack shows what is air-drying on it: a `drying` state counting the pieces and
// one `dry_<n>` bone per slot (the bones' existence is checked with the other blocks below).
{
  const { DRYING_SLOTS } = await load("processing.js");
  const rack = readJson(join(bp, "blocks", "r_butcher_rack.json"))["minecraft:block"];
  const counts = rack.description.states?.["kaleidoscope_ranching:drying"];
  if (!sameJson(counts, Array.from({ length: DRYING_SLOTS + 1 }, (_, n) => n))) fail(`butcher rack: state kaleidoscope_ranching:drying must count 0..${DRYING_SLOTS}`);
  const shown = rack.components["minecraft:geometry"].bone_visibility ?? {};
  for (let n = 1; n <= DRYING_SLOTS; n++) {
    if (!String(shown[`dry_${n}`] ?? "").includes("kaleidoscope_ranching:drying")) fail(`butcher rack: no bone dry_${n} shown by the drying state`);
  }
}

// --- 3c. Animal rigs: the bones everything else is written against ---------------
// The walk animation (tools/gen_art.py drops a bone it cannot find without a word), the sleep
// poses and eyelids (tools/gen_sleep.mjs), the render controllers and the butcher rack all go by
// bone name. A reshaped model has to keep them.
{
  const QUAD = ["leg_fl", "leg_fr", "leg_bl", "leg_br"];
  const BIRD = ["leg_left", "leg_right", "wing_left", "wing_right"];
  const LIMBS = { cow: QUAD, buffalo: QUAD, yak: QUAD, sheep: QUAD, goat: QUAD, pig: QUAD, rabbit: QUAD, chicken: BIRD, duck: BIRD, goose: BIRD };
  const geoBones = new Map();
  for (const path of walk(join(rp, "models", "entity")).filter((p) => p.endsWith(".json"))) {
    for (const geo of readJson(path)["minecraft:geometry"] ?? []) geoBones.set(geo.description.identifier, geo.bones ?? []);
  }
  for (const animal of ANIMALS) {
    const client = clientEntities.get(`kaleidoscope_ranching:${animal.id}`);
    if (!client) continue; // reported above
    const { description } = client;
    const bones = geoBones.get(description.geometry?.default) ?? [];
    const names = new Set(bones.map((bone) => bone.name));
    const where = `${animal.id} model`;
    const need = (bone, why) => names.has(bone) || fail(`${where}: missing bone "${bone}" (${why})`);

    for (const bone of ["body", "head", "a_head", "b_head", "a_torso", "b_torso"]) need(bone, "rig");
    for (const limb of LIMBS[animal.id] ?? []) for (const age of ["a", "b"]) need(`${age}_${limb}`, "walk animation and sleep pose");
    for (const bone of ["lids_a", "lids_b"]) need(bone, "closed eyes while asleep: tools/gen_sleep.mjs found no eye on the head's front face");
    for (const bone of bones) {
      if (bone.parent && !names.has(bone.parent)) fail(`${where}: bone "${bone.name}" hangs from missing bone "${bone.parent}"`);
    }

    // Every bone an animation moves or a render controller shows and hides must exist.
    const animationFiles = walk(join(rp, "animations")).filter((p) => p.endsWith(".json")).map(readJson);
    for (const [key, animId] of Object.entries(description.animations ?? {})) {
      if (animId.startsWith("animation.common.")) continue;
      const anim = animationFiles.map((file) => file.animations?.[animId]).find(Boolean);
      for (const bone of Object.keys(anim?.bones ?? {})) need(bone, `animation "${key}"`);
      if (key === "walk") {
        for (const limb of LIMBS[animal.id] ?? []) {
          for (const age of ["a", "b"]) if (!anim?.bones?.[`${age}_${limb}`]) fail(`${where}: walk animation does not move "${age}_${limb}"`);
        }
      }
    }
    for (const rcId of description.render_controllers ?? []) {
      const rc = renderControllers.get(typeof rcId === "string" ? rcId : Object.keys(rcId)[0]);
      if (rc?.geometry === "Geometry.gear") continue; // the gear layer: its bones are in its own geometry, checked with the gear
      for (const entry of rc?.part_visibility ?? []) {
        const bone = Object.keys(entry)[0];
        if (bone !== "*") need(bone, "render controller part_visibility");
      }
    }
    // Sexed, aged and shearable parts are switched by bone-name prefix (tools/art/animals.py).
    if (animal.id === "sheep" && !bones.some((bone) => bone.name.startsWith("wool_"))) fail(`${where}: no wool_ bone to hide when sheared`);
    if (animal.id === "pig") need("saddle", "shown when saddled");
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

// --- 4a. Things the game rejects at load time ---------------------------------

// ## Content-log errors seen in game: 1.20+ crafting recipes without unlock data,
// ## and render controllers using query.color, which they cannot resolve.
for (const path of walk(join(bp, "recipes")).filter((p) => p.endsWith(".json"))) {
  const data = readJson(path);
  for (const type of ["minecraft:recipe_shaped", "minecraft:recipe_shapeless"]) {
    if (data[type] && !(Array.isArray(data[type].unlock) && data[type].unlock.length)) {
      fail(`${relative(root, path)}: crafting recipe needs "unlock" (1.20+ recipes require unlock data)`);
    }
  }
}
for (const path of walk(join(rp, "render_controllers")).filter((p) => p.endsWith(".json"))) {
  if (/\bq(uery)?\.color\b/.test(readFileSync(path, "utf8"))) {
    fail(`${relative(root, path)}: render controllers cannot use query.color; mirror it into an entity property`);
  }
}

// ## Block models: a square texture whose size matches the model (non-square ones drew
// ## parts in the wrong colours or not at all), and single-sided rendering (plain
// ## alpha_test also draws back faces, which flickered). Crossed-plane plants may use alpha_test.
{
  const pngSize = (path) => {
    const b = readFileSync(path);
    return [b.readUInt32BE(16), b.readUInt32BE(20)];
  };
  for (const path of walk(join(rp, "models", "blocks")).filter((p) => p.endsWith(".geo.json"))) {
    const geo = readJson(path)["minecraft:geometry"][0];
    const { texture_width: w, texture_height: h } = geo.description;
    if (w !== h) fail(`${relative(root, path)}: texture ${w}x${h} is not square (run tools/square_block_textures.py)`);
    const id = geo.description.identifier.split(".").pop();
    const png = join(rp, "textures", "blocks", "ranching", `${id}.png`);
    if (existsSync(png)) {
      const [pw, ph] = pngSize(png);
      if (pw !== ph || pw % w) fail(`${relative(root, png)}: ${pw}x${ph} does not match its model's ${w}x${h}`);
    }
  }
  // Placed food (data/placedFoods.js): one bone per portion, inside the block's cell, and every
  // shared pot and baking dish is its own model, not one shape in another colour.
  {
    const { PLACED_FOODS } = await load("placedFoods.js");
    const shapes = new Map();
    for (const food of PLACED_FOODS) {
      const path = join(rp, "models", "blocks", `kaleidoscope_ranching.${food.block}.geo.json`);
      if (!existsSync(path)) { fail(`placed food ${food.block}: no model`); continue; }
      const bones = readJson(path)["minecraft:geometry"][0].bones;
      for (let n = 1; n <= food.portions; n++) {
        if (!bones.find((b) => b.name === `piece_${n}`)?.cubes?.length) fail(`placed food ${food.block}: bone piece_${n} is missing or empty`);
      }
      const cubes = bones.flatMap((b) => b.cubes ?? []);
      for (const { origin: [x, y, z], size: [w, h, d] } of cubes) {
        if (x < -8 || z < -8 || y < 0 || x + w > 8 || z + d > 8 || y + h > 16) fail(`placed food ${food.block}: cube at ${[x, y, z]} size ${[w, h, d]} leaves the block's cell`);
      }
      if (food.shape !== "wheel") {
        const key = JSON.stringify(cubes.map((c) => [c.origin, c.size]).sort());
        if (shapes.has(key)) fail(`placed food ${food.block}: same model as ${shapes.get(key)}; each dish needs its own`);
        else shapes.set(key, food.block);
      }
    }
  }
  for (const path of walk(join(bp, "blocks")).filter((p) => p.endsWith(".json"))) {
    const block = readJson(path)["minecraft:block"];
    const all = [block.components, ...(block.permutations ?? []).map((p) => p.components)];
    const geometry = block.components["minecraft:geometry"];
    const crossed = (typeof geometry === "string" ? geometry : geometry?.identifier ?? "").endsWith(".cross");
    for (const components of all) {
      for (const [name, material] of Object.entries(components["minecraft:material_instances"] ?? {})) {
        if (material.render_method === "alpha_test" && !crossed) {
          fail(`${relative(root, path)}: material "${name}" uses alpha_test; use alpha_test_single_sided`);
        }
      }
    }
  }
}

// ## Action-bar text goes through core/actionBar.js, which hides hints and status
// ## read-outs; a direct setActionBar would bypass that.
for (const path of walk(join(bp, "scripts")).filter((p) => p.endsWith(".js") && !p.endsWith(join("core", "actionBar.js")))) {
  if (readFileSync(path, "utf8").includes("onScreenDisplay.setActionBar(")) {
    fail(`${relative(root, path)}: use showActionBar from core/actionBar.js instead of setActionBar`);
  }
}

// ## Every item and block names its language key (minecraft:display_name), and the
// ## key exists in each language: without it, catalog-grouped items showed raw keys.
{
  const langs = Object.fromEntries(["en_US", "zh_TW", "zh_CN"].map((l) => [l, new Set(
    readFileSync(join(rp, "texts", `${l}.lang`), "utf8").split("\n").map((line) => line.split("=")[0])
  )]));
  for (const [folder, key] of [["items", "minecraft:item"], ["blocks", "minecraft:block"]]) {
    for (const path of walk(join(bp, folder)).filter((p) => p.endsWith(".json"))) {
      const data = readJson(path)[key];
      if (!data || data.description?.identifier?.split(":")[0] !== "kaleidoscope_ranching") continue;
      if (data.description.menu_category?.category === "none") continue;
      const name = data.components?.["minecraft:display_name"];
      const langKey = typeof name === "string" ? name : name?.value;
      if (!langKey) fail(`${relative(root, path)}: no minecraft:display_name`);
      else for (const [l, keys] of Object.entries(langs)) if (!keys.has(langKey)) fail(`${relative(root, path)}: "${langKey}" missing from ${l}.lang`);
    }
  }
}

// --- 4b. Every item has somewhere to go --------------------------------------

// ## A player who gets an item must be able to do something with it: eat or
// ## drink it, use it, place it, burn it, or put it into a crafting, furnace,
// ## processing, Cookery or feed recipe. Catches by-products that pile up with
// ## no use (企劃書: 產物都有去處).
{
  const { DISHES, DISH_PREPS } = await load("dishes.js");
  const consumed = new Set();
  const take = (id) => typeof id === "string" && consumed.add(local(id));
  for (const path of walk(join(bp, "recipes")).filter((p) => p.endsWith(".json"))) {
    const recipe = Object.values(readJson(path)).find((v) => v && typeof v === "object" && v.description);
    if (!recipe) continue;
    for (const entry of [...Object.values(recipe.key ?? {}), ...(recipe.ingredients ?? [])]) take(typeof entry === "string" ? entry : entry.item);
    if (recipe.input) take(typeof recipe.input === "string" ? recipe.input : recipe.input.item);
  }
  for (const recipe of PROCESSING_RECIPES) for (const input of recipe.inputs) inputIdsOf(input).forEach(take);
  for (const recipe of VANILLA_COOKING) take(recipe.input);
  // 1.1: air-dried on the butcher rack, washed at the water trough.
  {
    const { DRYING, WASHING } = await load("processing.js");
    Object.keys(DRYING ?? {}).forEach(take);
    Object.keys(WASHING ?? {}).forEach(take);
  }
  const walkSlots = (value) => {
    if (typeof value === "string") take(value);
    else if (Array.isArray(value)) value.forEach(walkSlots);
    else if (value && typeof value === "object" && !value.tag) Object.values(value).forEach(walkSlots);
  };
  for (const dish of [...DISHES, ...(DISH_PREPS ?? [])]) {
    walkSlots(dish.slots ?? []);
    if (dish.input) walkSlots(dish.input);
  }
  Object.keys(FEEDS).forEach(take);
  Object.values(SPECIES).forEach((row) => take(row.treat));
  for (const animal of ANIMALS) {
    [...(animal.breedItems ?? []), ...(animal.temptItems ?? [])].forEach(take);
    take(animal.fertilizedEgg); // nest box and incubator
    take(animal.carcass); // butcher rack
  }
  Object.keys(BUTCHER_TABLE).forEach(take);
  for (const { data } of itemFiles) {
    const c = data.components ?? {};
    const usable = c["minecraft:food"] || c["minecraft:block_placer"] || c["minecraft:fuel"] || c["minecraft:durability"] ||
      Object.keys(c).some((k) => k.startsWith("kaleidoscope_ranching:"));
    if (usable) take(data.description.identifier);
  }
  // Used by clicking an animal or a block (scripts), not by a recipe.
  const CLICKED = ["ranch_notebook", "ear_tag", "manure_item", "milking_pail", "nursing_bottle", "brush", "feed_bag",
    // 1.1 (systems/workAnimals.js): used on a buffalo or another animal.
    "harness", "plough", "animal_blanket",
    // 1.1 (systems/disease.js): used on a sick or dirty animal.
    "vet_medicine", "soap",
    // 1.1 (systems/packBag.js): put on a yak.
    "pack_bag",
    // 1.1 (api/tavern.js): the milk buckets are Tavern fluids, the horn cup the wine's carrier.
    "fresh_milk_bucket", "yak_milk_bucket", "horn_cup"];
  // Registered with Cookery as wok oil (api/cookeryRecipes.js register_oil_container).
  take("lard");
  CLICKED.forEach(take);
  for (const item of ITEMS) if (!consumed.has(item.id)) fail(`items.js: "${item.id}" (${item.zh}) has no use: no recipe, feed, dish, block or script consumes it`);
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
  // `rendered`: drawn by that script instead (the carcasses, from the animal models).
  else if (!entry.prompt && !entry.rendered && !(entry.from && iconPrompts[entry.from]?.prompt)) fail(`tools/art/icon_prompts.json: "${item.id}" needs a prompt or a "from" with one`);
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
