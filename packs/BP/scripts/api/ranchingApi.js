// Ranching's own public API (企劃書 · 對外擴充 API), v1.
//
// Other add-ons talk to Ranching through Script Events carrying JSON; they
// never import Ranching's scripts. The full contract is docs/API.md.
//
//   in   kaleidoscope_ranching:api_ping           any message
//   out  kaleidoscope_ranching:api_ready          { api, version, capabilities }
//   in   kaleidoscope_ranching:register_animal    an animal joins sex, care, products, breeding, carcass
//   in   kaleidoscope_ranching:register_feed      a feed item for troughs
//   in   kaleidoscope_ranching:register_recipe    a recipe for one of the five processing stations
//   in   kaleidoscope_ranching:register_butcher   the butcher-rack cuts of a carcass
//   in   kaleidoscope_ranching:register_remedy    1.1: an item that cures a sick animal
//   out  kaleidoscope_ranching:animal_event       born / hatched / harvested / butchered / mated / cared
//   in   kaleidoscope_ranching:query_animal       { entity, ref? }: ask about one animal
//   out  kaleidoscope_ranching:animal_info        the answer: sex, hearts, needs, pregnancy
//   out  kaleidoscope_ranching:api_result         { event, id, ok, error? } for every register_*
//
// ## Rules (same as Cookery's v1 API): field names stay compatible within
// ## v1; registrations last for the current world session only and are safe
// ## to repeat; built-in content always wins; an add-on may only register
// ## identifiers in its own namespace (never minecraft: or kaleidoscope_ranching:).

import { system, world } from "@minecraft/server";
import { GESTATION_DAYS, INCUBATION_DAYS } from "../data/animals.js";
import { KIND, registerFeed } from "../data/feeds.js";
import { registerSpecies } from "../data/species.js";
import { STATIONS, addAnimal, addButcherEntry, addRecipe } from "../core/content.js";
import { onRanchEvent } from "../core/events.js";
import { isBaby, sexOf, speciesOf } from "../core/animal.js";
import { getAffection } from "../core/husbandry.js";
import { today } from "../core/time.js";
import { needsToday } from "../care/state.js";
import { DP_PREGNANT_UNTIL_DAY } from "../data/m1_contract.js";
import { isSick, registerRemedy as addRemedy } from "../systems/disease.js";
import { BLANKET, isAsleep, SLEEP_POSES } from "../systems/sleep.js";
import { HARNESSED } from "../systems/workAnimals.js";
import { PACKED } from "../systems/packBag.js";

export const API_VERSION = 1;
export const PACK_VERSION = "1.1.0";
const NS = "kaleidoscope_ranching";
const EV = (name) => `${NS}:${name}`;

export const CAPABILITIES = [
  "register_animal", "register_feed", "register_recipe", "register_butcher", "animal_event", "api_result",
  // Added after the first v1 build; check for them before relying on them.
  "query_animal", "care_events",
  // 1.1 (docs/API.md "1.1 新增")
  "recipes_1_1", "butcher_offal", "animal_1_1", "feed_1_1", "remedy", "events_1_1", "query_1_1", "tag_contract",
];

/** Most entries of each kind one world session accepts, so a broken add-on cannot grow memory forever. */
export const LIMITS = { animal: 64, feed: 256, recipe: 256, butcher: 64, remedy: 64 };
const counts = { animal: new Set(), feed: new Set(), recipe: new Set(), butcher: new Set(), remedy: new Set() };

// 1.1: "ruminant" (silage kind) and "calcium" (poultry calcium feed).
const FEED_KINDS = { grass: KIND.GRASS, grain: KIND.GRAIN, veg: KIND.VEG, mixed: KIND.MIXED, concentrate: KIND.CONCENTRATE, ruminant: KIND.SILAGE, calcium: KIND.CALCIUM };
const ID = /^[a-z0-9_.-]+:[a-z0-9_./-]+$/;

class ApiError extends Error {}
const fail = (message) => {
  throw new ApiError(message);
};

// --- validation helpers ----------------------------------------------------------

function itemId(value, field) {
  if (typeof value !== "string" || !ID.test(value)) fail(`${field} must be a namespaced id`);
  return value;
}
/** An identifier the add-on registers: must be in its own namespace. */
function ownId(value, field) {
  itemId(value, field);
  const ns = value.split(":")[0];
  if (ns === "minecraft" || ns === NS) fail(`${field} must use your own namespace, not ${ns}:`);
  return value;
}
function int(value, field, min, max) {
  if (!Number.isInteger(value) || value < min || value > max) fail(`${field} must be an integer ${min}–${max}`);
  return value;
}
function list(value, field, max) {
  if (!Array.isArray(value)) fail(`${field} must be an array`);
  if (value.length > max) fail(`${field} has more than ${max} entries`);
  return value;
}
/** A JSON object (not an array, not null), or the call fails naming the field. */
function object(value, field) {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(`${field} must be an object`);
  return value;
}
function room(kind, key) {
  if (!counts[kind].has(key) && counts[kind].size >= LIMITS[kind]) fail(`too many ${kind} registrations (limit ${LIMITS[kind]})`);
  counts[kind].add(key);
}

// --- handlers ----------------------------------------------------------------------

/**
 * register_animal
 * {
 *   id: "ns:alpaca",                         entity type (own namespace)
 *   reproduction: "gestation" | "egg",
 *   days?: number,                           gestation or incubation days
 *   breedItems?: [itemId],                   gestation animals: fed to start breeding
 *   carcass?: "ns:alpaca_carcass",           dropped on death (own namespace)
 *   largeCarcass?: boolean,                  true: remembers sex; the item must not stack
 *   dailyProduct?: { via: "milking_pail" | "nest_box", items: [itemId] },  (no quality grades; extra ids from
 *                                            the old three-tier form are accepted and ignored)
 *   fertilizedEgg?: "ns:..._egg",            egg animals: hatches into this animal
 *   care?: { eats: ["grass"|"grain"|"veg"|"mixed"|"concentrate"|"ruminant"|"calcium"], treat?: itemId, brushDrops?: [[itemId, chance]] }
 *   1.1 (capability animal_1_1), all optional:
 *   sleep?: "lie"|"side"|"roost"|"curl"     the animal lies down at night (it must define the
 *                                            kaleidoscope_ranching:fall_asleep / wake_up events)
 *   moult?: [itemId, chance]                 a well-kept adult drops this once a day with chance
 *   harness?: boolean                        takes the harness and the plough, like the buffalo
 *   packBag?: boolean                        carries the pack bag, like the yak (the entity gives itself a
 *                                            minecraft:inventory, always or from the event
 *                                            kaleidoscope_ranching:put_on_pack_bag)
 *   coldHardy?: boolean                      no cold nights, like the yak
 *   forage?: { item, chance?, minHearts? }   digs this up in forests, like the pig's truffle
 * }
 */
export function registerAnimal(data) {
  const id = ownId(data.id, "id");
  const reproduction = data.reproduction;
  if (!["gestation", "egg"].includes(reproduction)) fail('reproduction must be "gestation" or "egg"');
  const row = {
    id,
    external: true,
    reproduction,
    days: data.days === undefined ? (reproduction === "egg" ? INCUBATION_DAYS : GESTATION_DAYS) : int(data.days, "days", 1, 30),
    breedItems: list(data.breedItems ?? [], "breedItems", 16).map((v, i) => itemId(v, `breedItems[${i}]`)),
    temptItems: [],
    largeCarcass: Boolean(data.largeCarcass),
    groomProduct: null,
  };
  if (reproduction === "gestation" && !row.breedItems.length) fail("a gestation animal needs breedItems");
  if (data.carcass !== undefined) row.carcass = ownId(data.carcass, "carcass");
  if (data.dailyProduct !== undefined) {
    const { via, items } = object(data.dailyProduct, "dailyProduct");
    if (!["milking_pail", "nest_box"].includes(via)) fail('dailyProduct.via must be "milking_pail" or "nest_box"');
    if (via === "nest_box" && reproduction !== "egg") fail("only egg animals use the nest box");
    if (via === "milking_pail" && reproduction !== "gestation") fail("only gestation animals are milked");
    const ids = list(items, "dailyProduct.items", 3).map((v, i) => itemId(v, `dailyProduct.items[${i}]`));
    if (!ids.length) fail("dailyProduct.items needs the product's item id");
    row.dailyProduct = { item: ids[0], via };
  }
  if (reproduction === "egg") {
    if (data.fertilizedEgg === undefined) fail("an egg animal needs fertilizedEgg");
    row.fertilizedEgg = ownId(data.fertilizedEgg, "fertilizedEgg");
  }
  const care = data.care === undefined ? {} : object(data.care, "care");
  const eats = list(care.eats ?? ["mixed", "concentrate"], "care.eats", 7).map((kind) => FEED_KINDS[kind] ?? fail(`unknown feed kind "${kind}"`));
  const treat = care.treat === undefined ? undefined : itemId(care.treat, "care.treat");
  const brushDrops = list(care.brushDrops ?? [], "care.brushDrops", 4).map((drop, i) => {
    if (!Array.isArray(drop)) fail(`care.brushDrops[${i}] must be [item, chance]`);
    const [item, chance] = drop;
    if (!(typeof chance === "number" && chance >= 0 && chance <= 1)) fail(`care.brushDrops[${i}] chance must be 0–1`);
    return [itemId(item, `care.brushDrops[${i}]`), chance];
  });

  if (data.sleep !== undefined) {
    if (!SLEEP_POSES.includes(data.sleep)) fail(`sleep must be one of ${SLEEP_POSES.join(", ")}`);
    row.sleep = data.sleep;
  }
  if (data.moult !== undefined) {
    const [item, chance] = Array.isArray(data.moult) ? data.moult : [];
    if (!(typeof chance === "number" && chance > 0 && chance <= 1)) fail("moult must be [item, chance 0–1]");
    row.moult = [itemId(item, "moult[0]"), chance];
  }
  if (data.harness !== undefined) row.harness = Boolean(data.harness);
  if (data.packBag !== undefined) row.packBag = Boolean(data.packBag);
  if (data.coldHardy !== undefined) row.coldHardy = Boolean(data.coldHardy);
  if (data.forage !== undefined) {
    const forage = object(data.forage, "forage");
    const chance = forage.chance ?? 0.25;
    if (!(typeof chance === "number" && chance > 0 && chance <= 1)) fail("forage.chance must be 0–1");
    row.forage = { item: itemId(forage.item, "forage.item"), chance, minHearts: int(forage.minHearts ?? 5, "forage.minHearts", 0, 5) };
  }

  room("animal", id);
  if (!addAnimal(row)) fail("built-in animals cannot be replaced");
  registerSpecies(id, { key: id, eats, treat, brushDrops });
  return id;
}

/** register_feed { item: "ns:hay_cube", kind: "grass"|"grain"|"veg"|"mixed"|"concentrate"|"ruminant"|"calcium", units?: 1–9 } */
export function registerFeedItem(data) {
  const item = ownId(data.item, "item");
  const kind = FEED_KINDS[data.kind] ?? fail(`unknown feed kind "${data.kind}"`);
  const units = data.units === undefined ? 1 : int(data.units, "units", 1, 9);
  room("feed", item);
  if (!registerFeed(item, kind, units)) fail("built-in feeds cannot be replaced");
  return item;
}

function ingredient(entry, field) {
  object(entry, field);
  const count = int(entry.count ?? 1, `${field}.count`, 1, 64);
  if (entry?.anyOf !== undefined) {
    const anyOf = list(entry.anyOf, `${field}.anyOf`, 12).map((v, i) => itemId(v, `${field}.anyOf[${i}]`));
    if (!anyOf.length) fail(`${field}.anyOf is empty`);
    return { anyOf, count };
  }
  return { item: itemId(entry?.item, `${field}.item`), count };
}

/**
 * register_recipe
 * { id: "ns:alpaca_butter", station: "butter_churn"|"cheese_press"|"aging_rack"|"fermenting_jar"|"pickling_vat",
 *   inputs: [{ item | anyOf, count }], outputs: [{ item, count }], ticks: 0–168000 }
 */
export function registerRecipe(data) {
  const id = ownId(data.id, "id");
  if (!STATIONS.includes(data.station)) fail(`station must be one of ${STATIONS.join(", ")}`);
  const inputs = list(data.inputs, "inputs", 4).map((entry, i) => ingredient(entry, `inputs[${i}]`));
  const outputs = list(data.outputs, "outputs", 4).map((entry, i) => ({
    item: itemId(object(entry, `outputs[${i}]`).item, `outputs[${i}].item`),
    count: int(entry.count ?? 1, `outputs[${i}].count`, 1, 64),
  }));
  if (!inputs.length || !outputs.length) fail("a recipe needs inputs and outputs");
  const ticks = int(data.ticks ?? 0, "ticks", 0, 24000 * 7);
  room("recipe", id);
  if (!addRecipe({ id, station: data.station, inputs, outputs, ticks, external: true })) fail("built-in recipes cannot be replaced");
  return id;
}

/**
 * register_butcher
 * { carcass: "ns:alpaca_carcass", look?: "cow"|"sheep"|…|"yak",
 *   cuts: [{ item, count: [min, max], maleBonus?, maleOnly?, chance? }] }
 */
export function registerButcher(data) {
  const carcass = ownId(data.carcass, "carcass");
  const cuts = list(data.cuts, "cuts", 12).map((cut, i) => {
    const where = `cuts[${i}]`;
    object(cut, where);
    const [min, max] = Array.isArray(cut.count) ? cut.count : [];
    int(min, `${where}.count[0]`, 0, 64);
    int(max, `${where}.count[1]`, min, 64);
    const entry = { item: itemId(cut.item, `${where}.item`), count: [min, max] };
    if (cut.maleBonus !== undefined) entry.maleBonus = int(cut.maleBonus, `${where}.maleBonus`, 0, 16);
    if (cut.maleOnly !== undefined) entry.maleOnly = Boolean(cut.maleOnly);
    // 1.1 (capability butcher_offal): mark the hide strokes and the offal stroke.
    if (cut.skin !== undefined) entry.skin = Boolean(cut.skin);
    if (cut.offal !== undefined) entry.offal = Boolean(cut.offal);
    if (cut.chance !== undefined) {
      if (!(typeof cut.chance === "number" && cut.chance >= 0 && cut.chance <= 1)) fail(`${where}.chance must be 0–1`);
      entry.chance = cut.chance;
    }
    return entry;
  });
  if (!cuts.length) fail("cuts is empty");
  room("butcher", carcass);
  if (!addButcherEntry(carcass, { cuts, look: typeof data.look === "string" ? data.look : undefined, external: true })) {
    fail("built-in carcasses cannot be replaced");
  }
  return carcass;
}

/** register_remedy { item: "ns:herb_tonic" } (1.1, capability remedy): using it on a sick animal cures it, and uses one. */
export function registerRemedyItem(data) {
  const item = ownId(data.item, "item");
  room("remedy", item);
  addRemedy(item);
  return item;
}

/**
 * query_animal { entity: "<entity id>", ref?: string }
 * Answers with animal_info. `ref` is echoed back so the asker can match the
 * answer to its question. Built-in and registered animals both answer.
 */
export function queryAnimal(data) {
  const id = typeof data.entity === "string" ? data.entity : fail("entity must be an entity id string");
  const info = { entity: id, found: false };
  if (data.ref !== undefined) info.ref = String(data.ref).slice(0, 64);
  let entity;
  try {
    entity = world.getEntity(id);
  } catch {}
  // An unloaded, dead or non-Ranching entity is simply "not found".
  if (!entity?.isValid || !speciesOf(entity)) return info;
  const needs = needsToday(entity);
  const day = today();
  const due = entity.getDynamicProperty(DP_PREGNANT_UNTIL_DAY);
  const pregnant = typeof due === "number" && due >= day;
  Object.assign(info, {
    found: true,
    animal: entity.typeId,
    sex: sexOf(entity),
    baby: isBaby(entity),
    hearts: getAffection(entity),
    needs: { fed: needs.fed, water: needs.water, groom: needs.groom, clean: needs.clean, all: needs.all },
    pregnant,
    // 1.1 (capability query_1_1)
    sleeping: isAsleep(entity),
    sick: isSick(entity),
    blanket: entity.getDynamicProperty(BLANKET) === true,
    harness: entity.getDynamicProperty(HARNESSED) === true,
    packBag: entity.getDynamicProperty(PACKED) === true,
  });
  if (pregnant) info.dueInDays = due - day;
  const tag = entity.getDynamicProperty("kr:ear_tag");
  if (tag !== undefined) info.earTag = tag;
  if (entity.nameTag) info.name = entity.nameTag;
  return info;
}

const HANDLERS = {
  [EV("register_animal")]: registerAnimal,
  [EV("register_feed")]: registerFeedItem,
  [EV("register_recipe")]: registerRecipe,
  [EV("register_butcher")]: registerButcher,
  [EV("register_remedy")]: registerRemedyItem,
};

// --- transport -----------------------------------------------------------------------

function send(name, payload) {
  try {
    system.sendScriptEvent(EV(name), JSON.stringify(payload));
  } catch (error) {
    console.warn(`[kaleidoscope_ranching] could not send ${name}: ${error}`);
  }
}

export function announceReady() {
  send("api_ready", { api: API_VERSION, version: PACK_VERSION, capabilities: CAPABILITIES });
}

/** Handles one incoming script event; returns the api_result payload for register_* (exported for tests). */
export function handleScriptEvent(id, message) {
  if (id === EV("api_ping")) return announceReady();
  if (id === EV("query_animal")) {
    let info;
    try {
      info = queryAnimal(object(JSON.parse(String(message ?? "")), "message"));
    } catch (error) {
      info = { found: false, error: error instanceof ApiError ? error.message : "message is not valid JSON" };
    }
    send("animal_info", info);
    return info;
  }
  const handler = HANDLERS[id];
  if (!handler) return undefined;
  const event = id.slice(NS.length + 1);
  let data;
  try {
    data = JSON.parse(String(message ?? ""));
    if (!data || typeof data !== "object" || Array.isArray(data)) fail("message must be a JSON object");
  } catch (error) {
    const result = { event, ok: false, error: error instanceof ApiError ? error.message : "message is not valid JSON" };
    send("api_result", result);
    return result;
  }
  let result;
  try {
    result = { event, id: handler(data), ok: true };
  } catch (error) {
    if (!(error instanceof ApiError)) console.warn(`[kaleidoscope_ranching] ${event} failed: ${error}`);
    result = { event, id: data.id ?? data.item ?? data.carcass, ok: false, error: error instanceof ApiError ? error.message : String(error) };
  }
  send("api_result", result);
  return result;
}

export function startRanchingApi() {
  system.afterEvents.scriptEventReceive.subscribe(({ id, message }) => {
    if (id.startsWith(`${NS}:`)) handleScriptEvent(id, message);
  });

  // Rebroadcast ranch events for quest and achievement add-ons.
  onRanchEvent((type, data) => send("animal_event", { type, ...data }));

  // ## Answer pings, and also announce once after load for add-ons that only
  // ## listen (they may have pinged before Ranching subscribed).
  world.afterEvents.worldLoad.subscribe(() => system.runTimeout(announceReady, 20));
}
