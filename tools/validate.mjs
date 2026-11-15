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
const { FEEDS, FEED_GROUPS } = await load("feeds.js");
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
  if (!FEED_GROUPS.includes(animal.feedGroup)) fail(`${where}: unknown feed group "${animal.feedGroup}"`);
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

for (const feed of FEEDS) {
  checkItem(feed.item, "feeds.js");
  for (const group of feed.groups) if (!FEED_GROUPS.includes(group)) fail(`feeds.js ${feed.item}: unknown group "${group}"`);
}
for (const group of FEED_GROUPS) {
  for (const tier of [1, 2, 3]) {
    if (!FEEDS.some((feed) => feed.tier === tier && feed.groups.includes(group))) fail(`feeds.js: group "${group}" has no tier ${tier} feed`);
  }
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
FEEDS.forEach((feed) => note(feed.item));
PROCESSING_RECIPES.forEach((recipe) => {
  recipe.inputs.forEach((input) => (input.anyOf ?? [input.item]).forEach(note));
  recipe.outputs.forEach((output) => note(output.item));
});
VANILLA_COOKING.forEach((recipe) => [recipe.input, recipe.output].forEach(note));
WOK_MEATS.forEach((pair) => [pair.raw, pair.cooked].forEach(note));

// Items whose source or use is a crafting recipe or an interaction that is not
// modelled as a table yet. Listed explicitly so a new orphan is still caught.
const CRAFTED_OR_INTERACTIVE = new Set([
  "cheese_slice", "alfalfa_seeds",
  "brush", "cowbell", "ranch_notebook", "ear_tag", "nursing_bottle", "feed_bag", "pitchfork",
]);
for (const id of itemIds) {
  if (!referenced.has(id) && !CRAFTED_OR_INTERACTIVE.has(id)) fail(`items.js: "${id}" is declared but no table produces or uses it`);
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

// --- Report ---------------------------------------------------------------

if (errors.length) {
  console.error(`validate: ${errors.length} problem(s)`);
  for (const message of errors) console.error("  - " + message);
  process.exit(1);
}
console.log(
  `validate: ok — ${jsonFiles.length} JSON files, ${ITEMS.length} items, ${BLOCKS.length} blocks, ` +
    `${ANIMALS.length} animals, ${PROCESSING_RECIPES.length} processing recipes, ${Object.keys(BUTCHER_TABLE).length} carcasses`
);
