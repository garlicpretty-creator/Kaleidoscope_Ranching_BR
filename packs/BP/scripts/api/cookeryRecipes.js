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
import { ANIMALS } from "../data/animals.js";
import { DAIRY_PRODUCTS, DISHES, DISH_PREPS, MEAT_PRODUCTS } from "../data/dishes.js";
import { ITEMS, NAMESPACE } from "../data/items.js";
import { BLOCKS } from "../data/blocks.js";
import { WOK_MEATS } from "../data/processing.js";
import { toSimplified } from "../data/zh_cn.js";

const SOURCE = NAMESPACE;
const rid = (id) => (id.includes(":") ? id : `${NAMESPACE}:${id}`);
const KIND = { stockpot: "stockpot_exact", wok: "wok", steamer: "steamer" };

function send(event, payload) {
  try {
    system.sendScriptEvent(event, typeof payload === "string" ? payload : JSON.stringify(payload));
  } catch (error) {
    console.warn(`[kaleidoscope_ranching] could not send ${event}: ${error}`);
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

const GUIDEBOOK_ID = `${NAMESPACE}:guidebook`;
const GUIDEBOOK_REVISION = "m5r1";
const CHUNK_SIZE = 1600;

const NAMES = new Map(ITEMS.map((item) => [item.id, item]));
const BLOCK_NAMES = new Map(BLOCKS.map((block) => [block.id, block]));
const icon = (id) => `textures/items/ranching/${id}`;
const STATION_LABEL = { stockpot: "stockpot", wok: "wok", steamer: "steamer", furnace: "furnace", crafting: "crafting" };

const TEXT = {
  en_US: {
    title: "Kaleidoscope Ranching",
    intro:
      "Butchering comes first: a Ranching animal that dies drops one carcass instead of meat. Hang the carcass on a Butcher Rack (use it on the rack), then cut it piece by piece with a kitchen knife, a sword or an axe. Each cut gives one kind of meat or by-product; males of large animals give more.\n\nMilk adult females once a day with the Milking Pail (each milking needs an empty glass bottle). Hens lay into Nest Boxes; fertilized eggs hatch under a hen or in a heated Incubator.\n\nRanching dishes cook on Cookery's stockpot, wok and steamer. Any milk works.",
    all: "All Entries",
    select: "Select an entry.",
    language_note: "This section uses the same language setting as the main guidebook.",
    back: "Back",
    item: "Item",
    block: "Block",
    item_block: "Item + Block",
    dishes: "Dishes",
    dairy: "Dairy and Eggs",
    butchery: "Butchery",
  },
  zh_TW: {
    title: "森羅物語：樂牧",
    intro:
      "先從屠宰開始：樂牧的動物死亡後不會直接掉肉，而是掉一具屠體。拿屠體點一下屠宰掛架把它掛上，再用廚房菜刀、劍或斧逐刀分切。每一刀切下一類部位肉或副產物；大型動物的公畜切得比較多。\n\n成年母畜每天可以用擠奶桶擠一次奶，每次需要一個空玻璃瓶。母禽在巢箱裡下蛋；受精蛋放在母禽身邊或有熱源的孵化器裡就會孵化。\n\n樂牧的料理用廚房的湯鍋、炒鍋與蒸籠烹調，任何一種奶都能用。",
    all: "全部條目",
    select: "請選擇條目。",
    language_note: "本章節與主手冊使用相同的語言設定。",
    back: "返回",
    item: "物品",
    block: "方塊",
    item_block: "物品＋方塊",
    dishes: "料理",
    dairy: "乳製品與蛋",
    butchery: "屠宰",
  },
};
TEXT.zh_CN = Object.fromEntries(Object.entries(TEXT.zh_TW).map(([key, value]) => [key, toSimplified(value)]));

const METHOD = {
  en_US: { stockpot: "Stockpot", wok: "Wok", steamer: "Steamer", furnace: "Furnace or smoker", crafting: "Crafting table" },
  zh_TW: { stockpot: "湯鍋", wok: "炒鍋", steamer: "蒸籠", furnace: "熔爐或煙燻爐", crafting: "工作台" },
};
METHOD.zh_CN = Object.fromEntries(Object.entries(METHOD.zh_TW).map(([key, value]) => [key, toSimplified(value)]));

const BUTCHER_STEPS = {
  en_US: ["Hold the carcass and use it on a Butcher Rack to hang it.", "Use a kitchen knife, sword or axe on the hanging carcass, once per cut.", "Each cut puts one kind of meat or by-product in your inventory and costs durability.", "An empty rack air-dries up to 4 raw sausages, pork bellies, duck legs or beef shanks; take them down after 3 days."],
  zh_TW: ["手拿屠體點屠宰掛架，把屠體掛上。", "用廚房菜刀、劍或斧點掛著的屠體，一次切一刀。", "每一刀把一類部位肉或副產物放進背包，並消耗工具耐久。", "空的掛架可以風乾最多 4 件生香腸、五花肉、鴨腿或牛腱，3 天後取下。"],
};
BUTCHER_STEPS.zh_CN = BUTCHER_STEPS.zh_TW.map(toSimplified);

/** The guidebook payload Cookery shows as a "Kaleidoscope Ranching" tab. */
export function guidebookPayload() {
  const entries = [];
  for (const dish of DISHES) {
    const ingredients = dish.station === "steamer" || dish.station === "furnace" ? [rid(dish.input)] : dish.slots.map((slot) => rid(slot[0]));
    entries.push({
      id: rid(dish.id),
      category: "dishes",
      kinds: ["item"],
      stack: 64,
      food: { nutrition: dish.food[0], saturation: dish.food[1] },
      icon: icon(dish.id),
      recipes: [{ method: STATION_LABEL[dish.station], ingredients, count: 1, time: dish.time ?? 0, result: rid(dish.id), ...(dish.station === "stockpot" ? { base: "minecraft:water" } : {}) }],
      mechanicsByLocale: Object.fromEntries(Object.entries(METHOD).map(([locale, labels]) => [locale, [labels[dish.station]]])),
    });
  }
  for (const prep of DISH_PREPS) entries.push({ id: rid(prep.id), category: "dishes", kinds: ["item"], stack: 16, icon: icon(prep.id) });
  for (const id of DAIRY_PRODUCTS) entries.push({ id: rid(id), category: "dairy", kinds: ["item"], icon: icon(id) });
  entries.push({ id: rid("butcher_rack"), category: "butchery", kinds: ["block"], icon: icon("cow_carcass"), mechanicsByLocale: BUTCHER_STEPS });
  for (const animal of ANIMALS) entries.push({ id: rid(animal.carcass), category: "butchery", kinds: ["item"], icon: icon(animal.carcass) });
  for (const id of MEAT_PRODUCTS) entries.push({ id: rid(id), category: "butchery", kinds: ["item"], icon: icon(id) });

  const names = {};
  for (const locale of ["en_US", "zh_TW", "zh_CN"]) {
    const column = locale === "en_US" ? "en" : "zh";
    const localize = locale === "zh_CN" ? toSimplified : (text) => text;
    names[locale] = Object.fromEntries(
      entries.map((entry) => {
        const id = entry.id.split(":")[1];
        const row = NAMES.get(id) ?? BLOCK_NAMES.get(id);
        return [entry.id, localize(row[column])];
      })
    );
  }

  return {
    api: 1,
    id: GUIDEBOOK_ID,
    version: "1.0.0",
    order: 200,
    icon: icon("cow_milk"),
    titleKey: "title",
    introKey: "intro",
    allKey: "all",
    selectKey: "select",
    languageNoteKey: "language_note",
    backKey: "back",
    showIds: false,
    categories: [
      { id: "butchery", labelKey: "butchery", fallback: "Butchery", icon: icon("cow_carcass") },
      { id: "dishes", labelKey: "dishes", fallback: "Dishes", icon: icon("cream_stew") },
      { id: "dairy", labelKey: "dairy", fallback: "Dairy and Eggs", icon: icon("butter") },
    ],
    entries,
    names,
    text: TEXT,
  };
}

/** Splits the payload into Cookery's begin / chunk / end messages. */
export function guidebookMessages(payload = guidebookPayload()) {
  const json = JSON.stringify(payload);
  const parts = [];
  for (let at = 0; at < json.length; at += CHUNK_SIZE) parts.push(json.slice(at, at + CHUNK_SIZE));
  return [
    ["kaleidoscope_cookery:guidebook_begin", JSON.stringify({ api: 1, source: SOURCE, id: GUIDEBOOK_ID, revision: GUIDEBOOK_REVISION, chunks: parts.length })],
    ...parts.map((data, index) => ["kaleidoscope_cookery:guidebook_chunk", [SOURCE, GUIDEBOOK_ID, GUIDEBOOK_REVISION, index, data].join("\n")]),
    ["kaleidoscope_cookery:guidebook_end", JSON.stringify({ api: 1, source: SOURCE, id: GUIDEBOOK_ID, revision: GUIDEBOOK_REVISION })],
  ];
}

let guidebookSent = false;

export function startCookeryContent() {
  onCookeryReady(() => registerRecipes());

  system.afterEvents.scriptEventReceive.subscribe((event) => {
    if (event.id !== "kaleidoscope_cookery:guidebook_ready" || guidebookSent) return;
    guidebookSent = true;
    for (const [id, message] of guidebookMessages()) send(id, message);
  });
  system.run(() => send("kaleidoscope_cookery:guidebook_ping", SOURCE));
}

