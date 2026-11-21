// M5: Ranching dishes, meats and the guidebook chapter registered with Cookery.
//
// Everything comes from data tables (data/dishes.js, data/processing.js), sent
// through Cookery's public Script Event API once Cookery reports it is ready:
//
//   kaleidoscope_cookery:register_recipe    stockpot, wok and steamer dishes;
//                                           cheese wheels on the chopping board
//   kaleidoscope_cookery:register_wok_meat  raw/cooked pairs (duck, goose, ...)
//   kaleidoscope_cookery:register_oil_container  lard as wok oil
//   kaleidoscope_cookery:guidebook_*        the "Kaleidoscope Ranching" chapter
//
// ## Cookery keeps registrations for the current world session only, so this
// ## runs again on every load. Each registration is checked against Cookery's
// ## capability list first, so an older Cookery simply skips what it lacks.

import { system } from "@minecraft/server";
import { cookeryHas, onCookeryReady } from "./cookery.js";
import { DISHES } from "../data/dishes.js";
import { GUIDE_TEXT_KEYS, guideCategories, guideEntries, guideName } from "../data/guidebook.js";
import { NAMESPACE } from "../data/items.js";
import { WOK_MEATS } from "../data/processing.js";
import { toSimplified } from "../data/zh_cn.js";

const SOURCE = NAMESPACE;
const rid = (id) => (id.includes(":") ? id : `${NAMESPACE}:${id}`);
const KIND = { stockpot: "stockpot_exact", wok: "wok", steamer: "steamer" };

/** Sends one script event; false if the game refused it. */
function send(event, payload) {
  try {
    system.sendScriptEvent(event, typeof payload === "string" ? payload : JSON.stringify(payload));
    return true;
  } catch (error) {
    console.warn(`[kaleidoscope_ranching] could not send ${event}: ${error}`);
    return false;
  }
}

/** The register_recipe payload for one dish, or null for dishes made outside Cookery. */
export function cookeryRecipeFor(dish) {
  const kind = KIND[dish.station];
  if (!kind) return null;
  const id = `${NAMESPACE}:${dish.station}/${dish.id}`;
  const recipe =
    dish.station === "steamer"
      ? { id, input: rid(dish.input), result: rid(dish.id), count: 1, time: dish.time }
      : {
          id,
          ingredients: dish.slots.map((slot) => slot.map(rid)),
          result: rid(dish.id),
          count: 1,
          carrier: dish.carrier,
          time: dish.time,
          ...(dish.station === "stockpot" ? { base: "minecraft:water", finishedKind: "default" } : {}),
        };
  return { api: 1, kind, source: SOURCE, recipe };
}

/** Cutting an aged cheese wheel on Cookery's chopping board. */
export const CHEESE_BOARD_RECIPE = {
  api: 1,
  kind: "chopping_board",
  source: SOURCE,
  recipe: { id: `${NAMESPACE}:board/cheese_slices`, input: rid("aged_cheese_wheel"), result: rid("cheese_slice"), count: 4, cuts: 4 },
};

/** Lard works as wok oil: 16 uses, then an empty bowl is left. */
export const LARD_OIL = {
  api: 1,
  source: SOURCE,
  container: { id: rid("lard"), empty: "minecraft:bowl", oil: rid("lard"), capacity: 16, defaultAmount: 16, amountProperty: `${NAMESPACE}:lard_oil` },
};

export function registerRecipes() {
  let sent = 0;
  for (const dish of DISHES) {
    const payload = cookeryRecipeFor(dish);
    if (payload && cookeryHas(payload.kind)) {
      send("kaleidoscope_cookery:register_recipe", payload);
      sent++;
    }
  }
  if (cookeryHas("chopping_board")) {
    send("kaleidoscope_cookery:register_recipe", CHEESE_BOARD_RECIPE);
    sent++;
  }
  if (cookeryHas("oil_containers")) send("kaleidoscope_cookery:register_oil_container", LARD_OIL);
  if (cookeryHas("wok_meat_conversions")) {
    // ## Unlike register_recipe, the wok-meat endpoint wants a namespaced source
    // ## ("namespace:name") whose namespace matches the raw item's.
    for (const pair of WOK_MEATS) send("kaleidoscope_cookery:register_wok_meat", { source: `${SOURCE}:wok_meats`, raw: rid(pair.raw), cooked: rid(pair.cooked) });
  }
  return sent;
}

// --- Guidebook chapter ---------------------------------------------------------------
//
// The chapter's categories, entries and lines live in data/guidebook.js; this turns
// them into the payload Cookery's guidebook extension registry accepts (Cookery 1.6.6
// scripts/api/guidebookExtensionRegistry.js): at most 32 categories, 1024 entries,
// 8 lines of 512 characters per entry and 4096 characters per text value.

const GUIDEBOOK_ID = `${NAMESPACE}:guidebook`;
const CHUNK_SIZE = 1600;
const LOCALES = ["en_US", "zh_TW", "zh_CN"];

// ## Cookery translates these station names and shows a cooking time for the timed ones
// ## (its extensionPreparationLabel); any other method string is shown as it is.
const METHOD = { stockpot: "Stockpot", wok: "Wok", steamer: "Steamer", crafting: "Crafting Table" };

/** The recipe Cookery lists for a dish (none for the furnace: Cookery has no "furnace only" label). */
function dishRecipe(dish) {
  const method = METHOD[dish.station];
  if (!method) return [];
  const ingredients = dish.station === "steamer" ? [rid(dish.input)] : dish.slots.map((slot) => rid(slot[0]));
  return [{ method, ingredients, count: 1, time: dish.time ?? 0, result: rid(dish.id), ...(dish.station === "stockpot" ? { base: "minecraft:water" } : {}) }];
}

/** The guidebook payload Cookery shows as a "Kaleidoscope Ranching" tab. */
export function guidebookPayload() {
  const rows = guideEntries();
  const entries = rows.map((row) => {
    const entry = {
      id: rid(row.id),
      category: row.category,
      categories: row.categories,
      kinds: row.kind === "animal" ? [] : row.kind === "block" || row.placeable ? ["item", "block"] : ["item"],
      icon: row.icon,
      mechanics: row.lines.en_US,
      // ## English goes only in `mechanics`, Cookery's fallback for every language
      // ## without lines of its own, so the chapter does not carry English twice.
      mechanicsByLocale: { zh_TW: row.lines.zh_TW, zh_CN: row.lines.zh_CN },
    };
    if (row.dish) {
      Object.assign(entry, { stack: 64, food: { nutrition: row.dish.food[0], saturation: row.dish.food[1] } });
      const recipes = dishRecipe(row.dish);
      if (recipes.length) entry.recipes = recipes;
    }
    return entry;
  });

  // Names for every entry and every Ranching ingredient a recipe lists.
  const named = new Set(entries.map((entry) => entry.id));
  for (const entry of entries) for (const recipe of entry.recipes ?? []) for (const id of recipe.ingredients) if (id.startsWith(`${NAMESPACE}:`)) named.add(id);
  const names = Object.fromEntries(LOCALES.map((locale) => [locale, {}]));
  for (const id of named) {
    const [zh, en] = guideName(id);
    names.en_US[id] = en;
    names.zh_TW[id] = zh;
    names.zh_CN[id] = toSimplified(zh);
  }

  const categories = guideCategories();
  const text = {
    en_US: { ...GUIDE_TEXT_KEYS.en },
    zh_TW: { ...GUIDE_TEXT_KEYS.zh },
    zh_CN: Object.fromEntries(Object.entries(GUIDE_TEXT_KEYS.zh).map(([key, value]) => [key, toSimplified(value)])),
  };
  for (const category of categories) for (const locale of LOCALES) text[locale][category.id] = category.labels[locale];

  return {
    api: 1,
    id: GUIDEBOOK_ID,
    version: "1.3.1",
    order: 200,
    icon: "textures/ui/kr_guidebook", // the series star, as every Kaleidoscope add-on shows in the guidebook list
    titleKey: "title",
    introKey: "intro",
    allKey: "all",
    selectKey: "select",
    languageNoteKey: "language_note",
    backKey: "back",
    showAll: false,
    showIds: false,
    showKinds: false,
    categories: categories.map(({ id, parent, icon }) => ({ id, labelKey: id, fallback: text.en_US[id], icon, ...(parent ? { parent } : {}) })),
    entries,
    names,
    text,
  };
}

/** A short hash of the chapter, so Cookery always takes a changed chapter as new. */
function revisionOf(json) {
  let a = 0x811c9dc5;
  let b = 0;
  for (let i = 0; i < json.length; i++) {
    const c = json.charCodeAt(i);
    a = Math.imul(a ^ c, 0x01000193) >>> 0;
    b = (Math.imul(b, 31) + c) >>> 0;
  }
  return `g${a.toString(36)}${b.toString(36)}`;
}

/** Splits the payload into Cookery's begin / chunk / end messages. */
export function guidebookMessages(payload = guidebookPayload()) {
  const json = JSON.stringify(payload);
  const revision = revisionOf(json);
  const parts = [];
  for (let at = 0; at < json.length; at += CHUNK_SIZE) parts.push(json.slice(at, at + CHUNK_SIZE));
  return [
    ["kaleidoscope_cookery:guidebook_begin", JSON.stringify({ api: 1, source: SOURCE, id: GUIDEBOOK_ID, revision, chunks: parts.length })],
    ...parts.map((data, index) => ["kaleidoscope_cookery:guidebook_chunk", [SOURCE, GUIDEBOOK_ID, revision, index, data].join("\n")]),
    ["kaleidoscope_cookery:guidebook_end", JSON.stringify({ api: 1, source: SOURCE, id: GUIDEBOOK_ID, revision })],
  ];
}

/** Builds and sends the chapter; true only if every message went out. */
export function sendGuidebook() {
  let messages;
  try {
    messages = guidebookMessages();
  } catch (error) {
    console.warn(`[kaleidoscope_ranching] could not build the guidebook chapter: ${error}`);
    return false;
  }
  // A refused message spoils the transfer; stop there and let the next guidebook_ready retry.
  for (const [id, message] of messages) if (!send(id, message)) return false;
  return true;
}

let guidebookSent = false;

export function startCookeryContent() {
  onCookeryReady(() => registerRecipes());

  // ## A chapter that fails to build or send is tried again on Cookery's next
  // ## guidebook_ready (Cookery broadcasts it several times) instead of being lost.
  system.afterEvents.scriptEventReceive.subscribe((event) => {
    if (event.id !== "kaleidoscope_cookery:guidebook_ready" || guidebookSent) return;
    guidebookSent = sendGuidebook();
  });
  system.run(() => send("kaleidoscope_cookery:guidebook_ping", SOURCE));
}

