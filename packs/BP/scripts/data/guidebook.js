// The "Kaleidoscope Ranching" chapter of Cookery's guidebook: its categories,
// its front page and a few short lines for every animal, item and block.
//
// Since the add-on shows no hint text on screen, this chapter is where a player
// reads how things work, so every rule a hint used to explain is written here.
//
// - Categories are the creative-inventory groups (data/catalog.js) plus the
//   animals and the dishes; three of them are split into sub-categories.
// - Entries come from the registries (ITEMS, BLOCKS, ANIMALS): an item or block
//   without lines in GUIDE_TEXT, and not in GUIDE_SKIP, fails `npm test` and
//   `npm run validate`, so new content cannot go out unexplained.
// - Dish and carcass lines are written from their tables (data/dishes.js,
//   data/butcher.js), so they follow a recipe change.
// - Lines are [zh_TW, en_US] pairs; zh_CN comes from data/zh_cn.js. Cookery takes
//   at most 8 lines of 512 characters; this chapter keeps to 1-4 short ones.
//
// api/cookeryRecipes.js turns guideEntries() into Cookery's payload.
// Plain data: no @minecraft imports (scripts/ARCHITECTURE.md).

import { ANIMALS } from "./animals.js";
import { BLOCKS } from "./blocks.js";
import { BUTCHER_TABLE } from "./butcher.js";
import { CATALOG_GROUPS } from "./catalog.js";
import { DISHES } from "./dishes.js";
import { GEAR } from "./gear.js";
import { ANIMAL_NAMES, ITEMS } from "./items.js";
import { PLACED_FOODS } from "./placedFoods.js";
import { toSimplified } from "./zh_cn.js";

// --- Categories -----------------------------------------------------------------------

/**
 * Top-level categories in order, then sub-categories (`parent`). `icon` is an item
 * or block id (see iconPath). Items, blocks and dishes find their sub-category by
 * `items` (item registry categories), `blocks` (data/blocks.js groups) or `stations`.
 */
export const GUIDE_CATEGORIES = [
  { id: "animals", zh: "動物", en: "Animals", icon: "cow_milk" },
  ...CATALOG_GROUPS.map(({ id, zh, en, icon }) => ({ id, zh, en, icon })),
  { id: "dishes", zh: "料理", en: "Dishes", icon: "cream_stew" },

  { id: "facilities_husbandry", parent: "facilities", blocks: ["husbandry"], zh: "飼養與管理", en: "Husbandry", icon: "trough" },
  { id: "facilities_processing", parent: "facilities", blocks: ["processing"], zh: "加工", en: "Processing", icon: "butter_churn" },
  { id: "facilities_decoration", parent: "facilities", blocks: ["decoration"], zh: "裝飾", en: "Decoration", icon: "rug" },
  { id: "meat_raw", parent: "meat", items: ["meat"], zh: "生肉與熟肉", en: "Raw and Cooked Meat", icon: "duck_meat" },
  { id: "meat_cuts", parent: "meat", items: ["cut"], zh: "部位肉", en: "Cuts", icon: "beef_brisket" },
  { id: "meat_cured", parent: "meat", items: ["mince", "cured"], zh: "絞肉與臘味", en: "Mince and Cured Meat", icon: "cured_sausage" },
  { id: "meat_offal", parent: "meat", items: ["offal"], zh: "內臟", en: "Offal", icon: "pork_liver" },
  { id: "dishes_stockpot", parent: "dishes", stations: ["stockpot"], zh: "湯鍋料理", en: "Stockpot", icon: "bone_broth" },
  { id: "dishes_wok", parent: "dishes", stations: ["wok"], zh: "炒鍋料理", en: "Wok", icon: "braised_pork_belly" },
  { id: "dishes_other", parent: "dishes", stations: ["steamer", "furnace", "crafting", "prep"], zh: "蒸籠、熔爐與工作台", en: "Steamer, Furnace and Crafting", icon: "egg_tart" },
];

/** Entries that also show under another category (the first is always their own). */
export const GUIDE_ALSO = {
  butcher_rack: ["carcasses"],
  nest_box: ["eggs"],
  incubator: ["eggs"],
  milking_rack: ["milk"],
  milking_pail: ["milk"],
  trough: ["feed"],
  hay_rack: ["feed"],
  pasture_post: ["feed"],
};

/**
 * Blocks with no entry of their own, and why. Food set down on the ground (data/placedFoods.js)
 * is added below: its block is explained in the food item's entry.
 */
export const GUIDE_SKIP = {
  manure: "Left by animals and cleared with the manure fork; explained in the Manure item's entry.",
  alfalfa_crop: "Grows from Alfalfa Seeds planted on farmland; explained in the seeds' entry.",
  pen_gate_top: "The upper half of the Pen Gate, placed with it.",
};
for (const food of PLACED_FOODS) {
  if (food.block !== food.item) GUIDE_SKIP[food.block] ??= `The ${food.item} item set down on the ground; explained in that item's entry.`;
}

// --- Icons ------------------------------------------------------------------------------

const ITEM_BY_ID = new Map(ITEMS.map((item) => [item.id, item]));
const BLOCK_BY_ID = new Map(BLOCKS.map((block) => [block.id, block]));

// ## Most blocks are drawn from a model texture sheet, which makes a poor button
// ## icon, so a block shows an item that belongs to it, or its own face texture.
const M2_FACE = (name) => `textures/blocks/kaleidoscope_ranching/kr_${name}`;
const BLOCK_ICONS = {
  trough: M2_FACE("trough"),
  water_trough: M2_FACE("water_trough"),
  auto_waterer: M2_FACE("auto_waterer"),
  auto_feeder: M2_FACE("auto_feeder_side"),
  feed_mixer: M2_FACE("feed_mixer_side"),
  chaff_cutter: M2_FACE("chaff_cutter_side"),
  salt_lick: M2_FACE("salt_lick"),
  compost_bin: M2_FACE("compost_bin_side"),
  hay_rack: "forage",
  pasture_post: "pasture_seed",
  nest_box: "fertilized_chicken_egg",
  incubator: "fertilized_duck_egg",
  hitching_post: "lasso",
  food_waste_bin: "food_waste",
  milking_rack: "milking_pail",
  silage_barrel: "silage",
  pen_gate: "herding_horn",
  butcher_rack: "cow_carcass",
  butter_churn: "butter",
  cheese_press: "fresh_cheese",
  aging_rack: "aged_cheese_wheel",
  tanning_rack: "oiled_leather",
  fermenting_jar: "yogurt",
  pickling_vat: "century_egg",
  meat_grinder: "pork_mince",
  cream_separator: "skim_milk",
  ice_cream_churn: "vanilla_ice_cream",
  spinning_wheel: "yarn",
  weaving_loom: "wool_cloth",
  rug: "plush_cloth",
  down_pillow: "down",
  down_quilt: "felt",
  horn_decor: "cattle_horn",
};

/** Animal entries show the thing they are kept for. */
const ANIMAL_ICONS = {
  cow: "cow_milk", sheep: "sheep_skin", goat: "goat_milk", pig: "pork_belly", chicken: "fertilized_chicken_egg",
  rabbit: "rabbit_fur", duck: "duck_egg", goose: "goose_egg", buffalo: "buffalo_milk", yak: "yak_milk",
  quail: "quail_egg", turkey: "turkey_leg", alpaca: "alpaca_wool",
};

/** Texture path for an item or block id (without namespace), or a texture path as it is. */
export function iconPath(id) {
  if (id.includes("/")) return id;
  const item = ITEM_BY_ID.get(id);
  if (item) return item.owner === "m2" ? `textures/items/kaleidoscope_ranching/${id}` : `textures/items/ranching/${id}`;
  if (BLOCK_ICONS[id]) return iconPath(BLOCK_ICONS[id]);
  throw new Error(`guidebook: no icon for ${id}`);
}

// --- Names used inside generated lines -------------------------------------------------

/** Vanilla and Cookery items that dish and carcass lines name: [zh_TW, en_US]. */
const OTHER_NAMES = {
  "minecraft:beef": ["生牛肉", "Raw Beef"],
  "minecraft:porkchop": ["生豬肉", "Raw Porkchop"],
  "minecraft:mutton": ["生羊肉", "Raw Mutton"],
  "minecraft:chicken": ["生雞肉", "Raw Chicken"],
  "minecraft:rabbit": ["生兔肉", "Raw Rabbit"],
  "minecraft:feather": ["羽毛", "Feather"],
  "minecraft:rabbit_hide": ["兔子皮", "Rabbit Hide"],
  "minecraft:rabbit_foot": ["兔子腳", "Rabbit's Foot"],
  "minecraft:white_wool": ["羊毛", "Wool"],
  "minecraft:potato": ["馬鈴薯", "Potato"],
  "minecraft:carrot": ["胡蘿蔔", "Carrot"],
  "minecraft:beetroot": ["甜菜根", "Beetroot"],
  "minecraft:sugar": ["糖", "Sugar"],
  "kaleidoscope_cookery:red_chili": ["紅辣椒", "Red Chili"],
  "kaleidoscope_cookery:green_chili": ["青辣椒", "Green Chili"],
};
const NS = "kaleidoscope_ranching:";

/** [zh_TW, en_US] name of an item id (namespaced or not). */
export function guideName(id) {
  const short = id.startsWith(NS) ? id.slice(NS.length) : id;
  const item = ITEM_BY_ID.get(short) ?? BLOCK_BY_ID.get(short);
  if (item) return [item.zh, item.en];
  if (ANIMAL_NAME.has(short)) return ANIMAL_NAME.get(short);
  if (OTHER_NAMES[id]) return OTHER_NAMES[id];
  throw new Error(`guidebook: no name for ${id}`);
}

const ANIMAL_NAME = new Map(ANIMAL_NAMES.map(([id, zh, en]) => [id, [zh, en]]));
const enList = (names) => (names.length < 2 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`);
const zhOr = (names) => (names.length < 2 ? names.join("") : `${names.slice(0, -1).join("、")}或${names.at(-1)}`);
const enOr = (names) => (names.length < 2 ? names.join("") : `${names.slice(0, -1).join(", ")} or ${names.at(-1)}`);

// --- Front page and labels --------------------------------------------------------------

export const GUIDE_TEXT_KEYS = {
  zh: {
    title: "森羅物語：樂牧",
    intro: [
      "先從屠宰開始：樂牧的動物死亡後不會直接掉肉，而是掉一具屠體。把屠體掛上屠宰掛架，再用廚房菜刀、劍或斧一刀一刀分切，每一刀切下一類部位肉或副產物。",
      "照顧：每隻動物每天要吃到飼料、喝到水、被照料（蹲下空手撫摸，或用毛刷刷）、畜欄乾淨。四項都做到，隔天好感度 +1 心，最多 5 心。繁殖、受精蛋、換羽、松露和役用都要看好感度。",
      "成年母畜每天可以擠一次奶，每次用掉一個空玻璃瓶。母禽只在巢箱裡下蛋；受精蛋放在巢箱或有熱源的孵化器裡，2 天孵化。",
      "加工方塊都一樣：手持任一材料點方塊，背包裡材料齊了就開始；時間到再點一次取出。加工途中打掉會退回材料。一個遊戲日約是現實 20 分鐘。樂牧的食物吃飽了也能吃。",
      "畫面上不會跳出提示文字，各樣東西怎麼用，都寫在本章的條目裡。",
    ].join("\n\n"),
    all: "全部條目",
    select: "請選擇條目。",
    food_groups_body: "請選擇分類。",
    language_note: "本章節與主手冊使用相同的語言設定。",
    back: "返回",
    item: "物品",
    block: "方塊",
    item_block: "物品＋方塊",
  },
  en: {
    title: "Kaleidoscope Ranching",
    intro: [
      "Butchering comes first: a Ranching animal that dies drops one carcass instead of meat. Hang the carcass on a Butcher Rack, then cut it with a kitchen knife, a sword or an axe, one stroke at a time; each stroke gives one kind of meat or by-product.",
      "Care: every day each animal needs feed, water, care (pet it while sneaking with an empty hand, or brush it) and a clean pen. With all four met, its affection rises by one heart the next day, up to five. Breeding, fertilized eggs, molting, truffles and work all depend on affection.",
      "Adult females can be milked once a day; each milking uses an empty glass bottle. Hens lay only in Nest Boxes; fertilized eggs hatch in two days in a nest box or a heated Incubator.",
      "Every processing block works the same way: use it while holding any ingredient and it starts when your inventory holds them all; use it again when the time is up to take the result. Breaking it while it works gives the ingredients back. A game day is about 20 real minutes. All Ranching food can be eaten with a full hunger bar.",
      "Nothing pops up on screen to explain things; how each item and block works is written in this chapter's entries.",
    ].join("\n\n"),
    all: "All Entries",
    select: "Select an entry.",
    food_groups_body: "Select a category.",
    language_note: "This section uses the same language setting as the main guidebook.",
    back: "Back",
    item: "Item",
    block: "Block",
    item_block: "Item + Block",
  },
};

// --- Hand-written lines -------------------------------------------------------------------

// Shared wording for the processing blocks (systems/stations.js).
const STATION = [
  "手持任一材料點它，背包裡材料齊了就全部取走並開始；裡面的東西分三階段變色，時間到再點一次取出。加工途中打掉會退回材料。",
  "Use it while holding any ingredient: when your inventory holds them all, they are taken and it starts. What is inside changes color in three stages; use it again when the time is up. Breaking it early gives the ingredients back.",
];
const AUTO_STATION = [
  "也會自己做：從正上方的容器拿材料，成品放進正下方的容器。",
  "It also works on its own: ingredients from the container above, results into the container below.",
];
const OFFAL_FEED = ["沒用完的生內臟算蔬菜類飼料，豬和兔會吃。", "Offal nobody cooks is vegetable feed for pigs and rabbits."];
const TAVERN = ["需要《森羅物語：酒館》。", "Needs Kaleidoscope Tavern."];
const RUMINANTS = ["牛、羊、山羊、水牛、氂牛", "cows, sheep, goats, buffalo and yaks"];

/** Lines per id: [zh_TW, en_US] pairs. */
export const GUIDE_TEXT = {
  // --- Animals ---------------------------------------------------------------------------
  cow: [
    ["取代原版的牛。成年母牛每天可用擠奶桶或擠奶架擠一次牛奶。", "Replaces the vanilla cow. An adult female gives milk once a day, by Milking Pail or Milking Rack."],
    ["吃乾草類、青貯料、混合飼料和精飼料；最愛苜蓿草餅。", "Eats grass feed, silage, mixed feed and concentrate; its favorite treat is the Alfalfa Cake."],
    ["繁殖要一公一母：拿小麥、飼草、混合飼料或精飼料餵成年的牠，雙方當天都要照顧好，8 格內一起發情就會懷孕，3 天後生產。生產後要休息 5 分鐘。", "Breeding needs a male and a female: feed adults wheat, forage, mixed feed or concentrate; both must have had all their care that day. In love within 8 blocks, she carries for 3 days. Parents then rest 5 minutes."],
    ["成年死亡時掉一具牛屠體，幼體不掉東西。", "An adult drops a Cow Carcass when it dies; a calf drops nothing."],
  ],
  sheep: [
    ["取代原版的羊，可以用剪刀剪毛。沒剪過毛的羊，屠體會先切下 1 塊同色羊毛。", "Replaces the vanilla sheep and can be shorn. An unshorn sheep's carcass first gives one wool of its color."],
    ["吃乾草類、青貯料、混合飼料和精飼料；最愛苜蓿草餅。", "Eats grass feed, silage, mixed feed and concentrate; its favorite treat is the Alfalfa Cake."],
    ["繁殖要一公一母：拿小麥、飼草、混合飼料或精飼料餵成年的牠，雙方當天都要照顧好，3 天後生產；生產後休息 5 分鐘。", "Breeding needs a male and a female fed wheat, forage, mixed feed or concentrate, both cared for that day; lambs come 3 days later, and parents rest 5 minutes."],
    ["成年死亡時掉一具羊屠體，幼體不掉東西。", "An adult drops a Sheep Carcass when it dies; a lamb drops nothing."],
  ],
  goat: [
    ["取代原版的山羊。成年母山羊每天可擠一次山羊奶；用毛刷刷牠有 30% 機率掉山羊絨。", "Replaces the vanilla goat. An adult female gives goat milk once a day; brushing has a 30% chance to comb out cashmere."],
    ["吃乾草類、青貯料、混合飼料和精飼料；最愛苜蓿草餅。", "Eats grass feed, silage, mixed feed and concentrate; its favorite treat is the Alfalfa Cake."],
    ["繁殖要一公一母：拿小麥、飼草、混合飼料或精飼料餵成年的牠，雙方當天都要照顧好，3 天後生產；生產後休息 5 分鐘。", "Breeding needs a male and a female fed wheat, forage, mixed feed or concentrate, both cared for that day; kids come 3 days later, and parents rest 5 minutes."],
    ["成年死亡時掉一具山羊屠體，公山羊的屠體有羊角。", "An adult drops a Goat Carcass when it dies; a billy's carcass has horns."],
  ],
  pig: [
    ["取代原版的豬。用毛刷刷牠有 35% 機率掉豬鬃。", "Replaces the vanilla pig. Brushing has a 35% chance to give a Pig Bristle."],
    ["吃蔬菜類（包括廚餘和生內臟）、混合飼料和精飼料；最愛甜菜糖塊。", "Eats vegetable feed (food scraps and raw offal count), mixed feed and concentrate; its favorite treat is the Beet Sugar Cube."],
    ["繁殖要一公一母：拿胡蘿蔔、馬鈴薯、甜菜根、混合飼料或精飼料餵成年的牠，雙方當天都要照顧好，3 天後生產；生產後休息 5 分鐘。", "Breeding needs a male and a female fed carrots, potatoes, beetroot, mixed feed or concentrate, both cared for that day; piglets come 3 days later, and parents rest 5 minutes."],
    ["好感度滿 5 心的成年豬站在草地或灰壤上、4 格內有原木時，每天有 25% 機率拱出松露。", "A five-heart adult pig on grass or podzol with a log within 4 blocks has a 25% chance a day to root up a Truffle."],
  ],
  chicken: [
    ["取代原版的雞。母雞不會隨地下蛋，只在 8 格內的巢箱裡每天下 1 顆雞蛋。", "Replaces the vanilla chicken. Hens never lay on the ground: one egg a day into a Nest Box within 8 blocks."],
    ["吃穀粒類、鈣質飼料、混合飼料和精飼料；最愛穀物糕。", "Eats grain feed, calcium feed, mixed feed and concentrate; its favorite treat is the Grain Cake."],
    ["繁殖靠受精蛋：巢箱 8 格內有成年公雞時，蛋有機會受精，好感度越高越容易。受精蛋放在巢箱或孵化器，2 天孵出小雞。", "Chickens breed through eggs: with an adult rooster within 8 blocks of the nest, eggs may be fertilized, more often the happier the hen. They hatch in 2 days in a nest box or incubator."],
    ["公雞每天清晨啼叫。成年死亡時掉一具雞屠體。", "Roosters crow at dawn. An adult drops a Chicken Carcass when it dies."],
  ],
  rabbit: [
    ["取代原版的兔子。用毛刷刷牠有 30% 機率掉兔毛。", "Replaces the vanilla rabbit. Brushing has a 30% chance to give Rabbit Fur."],
    ["吃乾草類、蔬菜類、混合飼料和精飼料；最愛胡蘿蔔脆片。", "Eats grass feed, vegetable feed, mixed feed and concentrate; its favorite treat is Carrot Chips."],
    ["繁殖要一公一母：拿蒲公英、胡蘿蔔、金胡蘿蔔、飼草、混合飼料或精飼料餵成年的牠，雙方當天都要照顧好，3 天後生產；生產後休息 5 分鐘。", "Breeding needs a male and a female fed dandelions, carrots, golden carrots, forage, mixed feed or concentrate, both cared for that day; kits come 3 days later, and parents rest 5 minutes."],
    ["成年死亡時掉一具兔屠體，幼體不掉東西。", "An adult drops a Rabbit Carcass when it dies; a kit drops nothing."],
  ],
  duck: [
    ["新動物，出現在河流與沼澤。會游泳，不受摔落傷害。", "A new animal of rivers and swamps. It swims and takes no fall damage."],
    ["母鴨每天在 8 格內的巢箱下 1 顆鴨蛋。好感度 4 心以上的成年鴨每天有 20% 機率掉一根羽絨。", "A female lays one Duck Egg a day into a Nest Box within 8 blocks. An adult with four hearts or more has a 20% chance a day to molt a Down."],
    ["吃穀粒類、鈣質飼料、混合飼料和精飼料；最愛穀物糕。", "Eats grain feed, calcium feed, mixed feed and concentrate; its favorite treat is the Grain Cake."],
    ["繁殖靠受精蛋：巢箱 8 格內有成年公鴨時，蛋有機會受精；受精蛋 2 天孵化。", "Ducks breed through eggs: with an adult drake within 8 blocks of the nest, eggs may be fertilized; they hatch in 2 days."],
  ],
  // 1.1 追加 新動物
  quail: [
    ["新動物，出現在平原與莽原。體型小，不吃草，不放牧。", "A new animal of plains and savannas. Small; it does not graze."],
    ["母鵪鶉每天在 8 格內的巢箱下 2 顆鵪鶉蛋。", "A female lays two Quail Eggs a day into a Nest Box within 8 blocks."],
    ["吃穀粒類、鈣質飼料、混合飼料和精飼料。", "Eats grain feed, calcium feed, mixed feed and concentrate."],
    ["繁殖靠受精蛋：巢箱 8 格內有成年公鵪鶉時，蛋有機會受精；受精蛋只要 1 天就孵化。", "Quail breed through eggs: with an adult cock within 8 blocks of the nest, eggs may be fertilized; they hatch in just 1 day."],
  ],
  turkey: [
    ["新動物，出現在森林。公火雞較大，有紅色肉垂。", "A new animal of forests. The tom is larger, with a red wattle."],
    ["母火雞每 2 天在 8 格內的巢箱下 1 顆火雞蛋。會在草場吃草，每天 1 格。", "A hen lays one Turkey Egg every two days into a Nest Box within 8 blocks. It grazes on a pasture, 1 grass a day."],
    ["吃穀粒類、乾草類、鈣質飼料、混合飼料和精飼料。", "Eats grain, hay, calcium feed, mixed feed and concentrate."],
    ["繁殖靠受精蛋：巢箱 8 格內有成年公火雞時，蛋有機會受精；受精蛋 2 天孵化。", "Turkeys breed through eggs: with an adult tom within 8 blocks of the nest, eggs may be fertilized; they hatch in 2 days."],
  ],
  alpaca: [
    ["新動物，出現在草甸與風蝕丘陵。不怕冷；成年公羊駝會攻擊 8 格內的敵對生物（苦力怕除外），晚上也會守夜。", "A new animal of meadows and windswept hills. It does not mind the cold; an adult male attacks hostile mobs within 8 blocks (not creepers) and keeps watch at night."],
    ["用剪刀剪毛得 1 到 2 份羊駝毛，不必宰殺；毛一天後長回來。會在草場吃草，每天 3 格。", "Shear it for 1 or 2 Alpaca Wool without harm; the fleece grows back in a day. It grazes on a pasture, 3 grass a day."],
    ["吃乾草類、青貯料、混合飼料和精飼料。", "Eats hay, silage, mixed feed and concentrate."],
    ["懷孕 3 天後生下小羊駝。", "A female carries for 3 days before the cria is born."],
  ],
  goose: [
    ["新動物，出現在平原與河流。成年公鵝會攻擊 8 格內的敵對生物（苦力怕除外），晚上也會守夜：16 格內有敵對生物就醒來。", "A new animal of plains and rivers. An adult gander attacks hostile mobs within 8 blocks (not creepers) and keeps watch at night, waking when one comes within 16."],
    ["母鵝每天在 8 格內的巢箱下 1 顆鵝蛋。好感度 4 心以上的成年鵝每天有 20% 機率掉一根羽絨。", "A female lays one Goose Egg a day into a Nest Box within 8 blocks. An adult with four hearts or more has a 20% chance a day to molt a Down."],
    ["吃穀粒類、鈣質飼料、混合飼料和精飼料；最愛穀物糕。", "Eats grain feed, calcium feed, mixed feed and concentrate; its favorite treat is the Grain Cake."],
    ["繁殖靠受精蛋：巢箱 8 格內有成年公鵝時，蛋有機會受精；受精蛋 2 天孵化。", "Geese breed through eggs: with an adult gander within 8 blocks of the nest, eggs may be fertilized; they hatch in 2 days."],
  ],
  buffalo: [
    ["新動物，出現在沼澤與叢林。成年母水牛每天可擠一次水牛奶。", "A new animal of swamps and jungles. An adult female gives buffalo milk once a day."],
    ["好感度 3 心以上的成年水牛可以裝挽具、拉犁耕地。", "An adult buffalo with three hearts or more takes a Harness and can pull a Plow."],
    ["吃乾草類、青貯料、混合飼料和精飼料；最愛苜蓿草餅。", "Eats grass feed, silage, mixed feed and concentrate; its favorite treat is the Alfalfa Cake."],
    ["繁殖要一公一母：拿小麥、飼草、混合飼料或精飼料餵成年的牠，雙方當天都要照顧好，3 天後生產；生產後休息 5 分鐘。", "Breeding needs a male and a female fed wheat, forage, mixed feed or concentrate, both cared for that day; calves come 3 days later, and parents rest 5 minutes."],
  ],
  yak: [
    ["新動物，出現在山地、草甸、雪坡與凍峰。成年母氂牛每天可擠一次氂牛奶。", "A new animal of mountains, meadows, snowy slopes and frozen peaks. An adult female gives yak milk once a day."],
    ["不怕冷，晚上不會受寒。成年氂牛可以背馱袋。牠的糞便留在地上過一天會曬乾。", "It never feels the cold at night. An adult can carry a Pack Bag. Its dung dries after a day on the ground."],
    ["吃乾草類、青貯料、混合飼料和精飼料；最愛苜蓿草餅。", "Eats grass feed, silage, mixed feed and concentrate; its favorite treat is the Alfalfa Cake."],
    ["繁殖要一公一母：拿小麥、飼草、混合飼料或精飼料餵成年的牠，雙方當天都要照顧好，3 天後生產；生產後休息 5 分鐘。", "Breeding needs a male and a female fed wheat, forage, mixed feed or concentrate, both cared for that day; calves come 3 days later, and parents rest 5 minutes."],
  ],

  // --- Facilities: husbandry ---------------------------------------------------------------
  trough: [
    ["手持飼料點它放進 1 份，蹲下點放入整疊，也可以拿飼料袋倒。最多 15 份，一次只能放一類飼料。", "Use it holding feed to add one, sneak to add the stack, or pour from a Feed Bag. It holds 15 units of one kind of feed at a time."],
    ["8 格內的樂牧動物每天各吃 1 份，只吃自己吃的種類；混合飼料和精飼料大家都吃。", "Ranching animals within 8 blocks eat one unit a day each, of a kind they eat; everyone eats mixed feed and concentrate."],
    ["動物當天吃到飼料、喝到水、被照料、畜欄乾淨，隔天好感度 +1 心。連續 2 天沒吃到會 −1 心。", "An animal fed, watered, cared for and in a clean pen gains a heart the next day. Two days without feed costs a heart."],
    ["飼槽 8 格內的糞便超過 6 坨，畜欄就算不乾淨。", "More than 6 manure piles within 8 blocks of the trough make the pen dirty."],
  ],
  water_trough: [
    ["拿水桶點它裝滿 3 格水；有動物來喝的那天用掉 1 格，一桶水大約 3 天。", "Fill it with a water bucket: 3 levels. Each day animals drink uses one, so a bucket lasts about 3 days."],
    ["8 格內的樂牧動物從這裡喝水。連續兩天沒喝到水的動物可能生病。", "Ranching animals within 8 blocks drink here. Two days without water can make an animal ill."],
    ["手持豬腸或牛肚點它，用掉 1 格水，洗成洗淨的大腸或洗淨的牛肚。", "Use it holding a Pig Intestine or Beef Tripe to wash it, using one level of water."],
  ],
  auto_waterer: [
    ["只要緊貼著一格水源方塊就不會缺水，不用加水。", "Never runs dry while it touches a water source block; no refilling."],
    ["8 格內的樂牧動物從這裡喝水。", "Ranching animals within 8 blocks drink here."],
  ],
  auto_feeder: [
    ["放在飼槽正上方，再往上接箱子、漏斗或木桶。", "Place it right on top of a trough, with a chest, hopper or barrel above it."],
    ["每 30 秒從上方容器拿最多 4 個飼料補進飼槽；只補飼槽裡同一類的飼料。", "Every 30 seconds it moves up to 4 feed items from the container into the trough, only of the kind already there."],
  ],
  feed_mixer: [
    ["打開後是專用的合成格，做飼料和獸藥。", "Opens its own crafting grid for feed and medicine."],
    ["混合飼料：2 飼草、1 苜蓿，加小麥種子、胡蘿蔔、馬鈴薯、甜菜根或廚餘其中一樣，得 4 份。", "Mixed Feed: 2 forage, 1 alfalfa and one of wheat seeds, carrot, potato, beetroot or food scraps, for 4."],
    ["精飼料：2 混合飼料、2 小麥、1 骨粉，得 4 份。鈣質飼料：精飼料加鈣粉，得 2 份。", "Concentrate: 2 mixed feed, 2 wheat and 1 bone meal, for 4. Calcium Feed: concentrate and calcium powder, for 2."],
    ["獸藥：苜蓿、一朵蒲公英、罌粟或矢車菊，加一瓶水。", "Veterinary Medicine: alfalfa, a dandelion, poppy or cornflower, and a water bottle."],
  ],
  chaff_cutter: [
    ["打開後是專用的合成格，把草料切成飼草。", "Opens its own crafting grid that cuts fodder into forage."],
    ["1 小麥 → 2 飼草；1 苜蓿 → 3 飼草；1 乾草塊 → 12 飼草；2 株草 → 1 飼草。", "1 wheat → 2 forage; 1 alfalfa → 3; 1 hay bale → 12; 2 grass → 1."],
    ["在一般工作台做，3 小麥只換 2 飼草。", "On a crafting table, 3 wheat make only 2 forage."],
  ],
  hay_rack: [
    ["只放乾草類飼料：乾草塊（算 9 份）、小麥、飼草、苜蓿。最多 36 份，蹲下點可放入整疊。", "Takes only grass feed: hay bales (9 units each), wheat, forage and alfalfa. Holds 36 units; sneak to add a stack."],
    ["每天餵 8 格內吃乾草的動物：牛、羊、山羊、水牛、氂牛、兔。雞、鴨、鵝、豬不吃。", "Feeds the grass eaters within 8 blocks every day: cows, sheep, goats, buffalo, yaks and rabbits. Poultry and pigs do not eat from it."],
    ["範圍內也有飼槽時，飼槽先餵。打掉時存量變回乾草塊和小麥。", "When a trough is also in range, the trough feeds first. Broken, it gives its hay back as hay bales and wheat."],
    ["動物入睡時 4 格內有乾草架或地毯、頭上 8 格內有遮蔽，就算睡得好，好感度 +4 點。", "An animal that falls asleep with a hay rack or rug within 4 blocks and a roof within 8 sleeps well: +4 affection points."],
  ],
  pasture_post: [
    ["半徑 8 格內的草方塊就是草場。牛、水牛、氂牛每天吃 3 格草，羊、山羊 2 格，兔、鵝 1 格，幼體吃一半。", "The grass blocks within 8 blocks are its pasture. Cows, buffalo and yaks eat 3 a day, sheep and goats 2, rabbits and geese 1; young ones half."],
    ["今天還沒吃飽的放牧動物會吃草場的草，等於吃了乾草；範圍內有飼槽或乾草架時先吃那些。豬、雞、鴨不吃草。", "Grazers that have not eaten today eat its grass as if it were hay; troughs and hay racks in range feed them first. Pigs, chickens and ducks do not graze."],
    ["每吃掉 2 格草，就有 1 格草方塊變成泥土，旁邊的草地會慢慢長回來，也可以撒牧草種子。", "Every 2 grass eaten turns one grass block to dirt; the grass grows back from its neighbours, or sow Pasture Seed."],
    ["連續 2 天沒有動物吃草就算休養過，那之後第一天在這裡吃飽的動物好感度 +5 點。手持觀察手冊點它可以看今天的草。", "Left ungrazed for two days it is rested: animals that eat there the next day gain 5 affection points. Use the Observation Notebook on it to see today's grass."],
  ],
  nest_box: [
    ["8 格內的成年母雞、母鴨、母鵝每天在這裡下 1 顆蛋。巢箱最多存 16 顆，多的掉在旁邊。", "Adult hens, ducks and geese within 8 blocks lay one egg a day into it. It stores 16; more drop beside it."],
    ["空手或拿其他東西點它，取出所有的蛋；正下方接漏斗會自動送出。", "Use it with anything but a fertilized egg to take the eggs; a hopper below collects them."],
    ["8 格內有同種成年公禽時，蛋依母禽好感度有 10% 到 75% 機率受精。", "With an adult male of the same kind within 8 blocks, each egg has a 10% to 75% chance, by the hen's affection, to be fertilized."],
    ["手持受精蛋點它可放進去孵，最多 4 顆；2 天後只要 4 格內有同種母禽就會孵化。", "Use it holding a fertilized egg to brood it, up to 4. After 2 days they hatch while a female of that kind is within 4 blocks."],
  ],
  incubator: [
    ["手持受精蛋點它放進去，最多 4 顆，不需要母禽。", "Use it holding a fertilized egg; it takes up to 4 and needs no hen."],
    ["要有熱源：正下方兩格內或四周緊貼著營火、靈魂營火、岩漿塊、岩漿、火，或燃燒中的熔爐、煙燻爐、高爐。", "It needs heat: a campfire, soul campfire, magma block, lava, fire, or a lit furnace, smoker or blast furnace beside it or up to two blocks below."],
    ["有熱源時 2 天孵化，沒有熱源時暫停倒數；有蛋又有熱源時孵化器會亮。", "With heat the eggs hatch in 2 days; without, the count pauses. It glows while it has eggs and heat."],
    ["空手點它取回還沒孵的蛋。用照蛋燈照，可以看蛋裡的胚胎長多大了。", "Use it with an empty hand to take unhatched eggs back. An Egg Candler shows how big the embryos have grown."],
  ],
  salt_lick: [
    ["8 格內的樂牧動物每天多得 ¼ 心好感度。", "Ranching animals within 8 blocks gain an extra quarter heart a day."],
    ["用了 7 天就會舔完消失。", "It is licked away after 7 days of use."],
  ],
  hitching_post: [
    ["牽著動物時點它，12 格內你牽著的樂牧動物都會拴在樁上；沒牽動物時再點一次，動物交回給你牽。", "Use it while leading animals: every Ranching animal you lead within 12 blocks is tied to it. Use it again with none on a lead to take them back."],
    ["拴在樁上的動物晚上不睡覺。打掉拴畜樁時動物會鬆開，牽繩掉落。", "Tied animals do not sleep at night. Breaking the post frees them and drops the leads."],
    ["拿牧笛點它，設為牧羊犬趕畜的集合點。", "Use a Herding Horn on it to make it your sheepdogs' rally point."],
  ],
  compost_bin: [
    ["放進 4 份糞便，再放 1 份小麥（或廚房的稻草）就開始發酵。", "Put in 4 manure, then 1 wheat (or Cookery straw) to start it."],
    ["1 個遊戲日後點它取出 4 份肥料。", "After one game day, use it to take 4 fertilizer."],
  ],
  food_waste_bin: [
    ["手持任何食物點它丟進 1 份，蹲下點丟進整疊；最多 32 份。廚餘本身不能丟。", "Use it holding any food to add one, or sneak to add the stack; it holds 32. Food scraps themselves cannot go in."],
    ["空手或拿其他東西點它，每份換 1 個廚餘取出。", "Use it with anything else to take one Food Scraps per portion."],
    ["廚餘是蔬菜類飼料，豬和兔會吃。", "Food scraps are vegetable feed for pigs and rabbits."],
  ],
  milking_rack: [
    ["牽著成年的母牛、母山羊、母水牛或母氂牛點它，就綁在架上，一架一隻；沒牽動物時再點一次解開。", "Use it while leading an adult female cow, goat, buffalo or yak to tie her on, one per rack. Use it again with nothing on a lead to untie her."],
    ["每個遊戲日自動擠一次奶：從上方的容器拿一個空玻璃瓶，奶放進下方的容器（沒有容器就放在架上）。", "Once a game day it milks her: an empty glass bottle from the container above, the milk into the container below (or on the rack)."],
    ["和擠奶桶共用「今天擠過了」的記錄。綁在架上的動物晚上不睡覺。", "It shares the pail's once-a-day record. A tied animal does not sleep at night."],
  ],
  silage_barrel: [
    STATION,
    ["4 份飼草密封 3 天，得 4 份青貯料。", "4 forage sealed for 3 days make 4 silage."],
    AUTO_STATION,
  ],
  pen_gate: [
    ["兩格高的門。玩家走到 2 格內就自動打開，離開就關上。", "A two-block gate that opens while a player is within 2 blocks and shuts after them."],
    ["動物不會讓它打開，所以不會跟著跑出畜欄。", "Animals never open it, so they cannot follow you out of the pen."],
  ],

  // --- Facilities: processing -----------------------------------------------------------------
  butcher_rack: [
    ["上方要有空間才能放。手持屠體點它掛上，一次一具。", "Needs room above to be placed. Use it holding a carcass to hang it, one at a time."],
    ["用廚房菜刀、劍或斧點屠體，一刀切下一類部位肉或副產物，直接進背包，每刀扣 1 點耐久度。打掉掛架時，沒切過的屠體整具掉回，切過的掉出剩下的部位。", "Use a kitchen knife, sword or axe on the carcass: each stroke puts one kind of meat or by-product in your inventory and costs 1 durability. Broken, an uncut carcass drops whole, a cut one drops what is left."],
    ["空的掛架可以風乾最多 4 件，各自計時，3 天後取下：生香腸 → 臘腸、五花肉 → 臘肉、鴨腿 → 臘鴨腿、牛腱 → 牛肉乾。掛著的肉會一邊風乾一邊變色。", "An empty rack air-dries up to 4 pieces, each on its own clock, ready after 3 days: Raw Sausage → Cured Sausage, Pork Belly → Cured Pork Belly, Duck Leg → Cured Duck Leg, Beef Shank → Beef Jerky. Each piece changes color as it dries."],
    ["風乾中不能掛屠體。身上有漁歌的海鹽時，掛上的那一件用掉一份海鹽，2 天就好。", "No carcass while pieces are drying. Carrying Fishing Voyage's sea salt uses one per piece and dries it in 2 days."],
  ],
  butter_churn: [
    STATION,
    ["2 瓶牛奶、山羊奶或水牛奶 → 奶油（30 秒）；這類奶不到 2 瓶時 → 1 份鮮奶油（15 秒）。2 瓶氂牛奶 → 酥油（30 秒）。", "2 cow, goat or buffalo milk → Butter (30 s); with fewer than 2 of those milks → Cream (15 s). 2 yak milk → Ghee (30 s)."],
    ["手拿雞蛋點：2 雞蛋、1 瓶任何奶、1 糖 → 2 份卡士達醬（15 秒）。", "Holding an egg: 2 eggs, 1 milk of any kind and 1 sugar → 2 Custard (15 s)."],
    ["1 鵝肝加 1 奶油 → 鵝肝醬（30 秒）。", "1 goose liver and 1 butter → Goose Liver Pâté (30 s)."],
  ],
  cheese_press: [
    STATION,
    ["3 瓶奶壓半個遊戲日：牛奶 → 新鮮乳酪、山羊奶 → 山羊乳酪、水牛奶 → 莫札瑞拉、氂牛奶 → 曲拉，都附 1 份乳清。", "3 milk for half a game day: cow → Fresh Cheese, goat → Goat Cheese, buffalo → Mozzarella, yak → Chhurpi, each with 1 whey."],
    ["3 份乳清壓四分之一個遊戲日 → 瑞可塔；3 瓶脫脂奶壓半個遊戲日 → 2 塊奶豆腐與 1 份乳清。", "3 whey for a quarter day → Ricotta; 3 skim milk for half a day → 2 Milk Tofu and 1 whey."],
  ],
  aging_rack: [
    STATION,
    ["4 塊新鮮乳酪放 3 天 → 熟成乳酪輪；放滿 7 天才取出 → 陳年乳酪輪。", "4 fresh cheese for 3 days → Aged Cheese Wheel; left 7 days before you take it → Vintage Cheese Wheel."],
    ["2 塊山羊乳酪放 3 天 → 熟成山羊乳酪；2 塊曲拉放 2 天 → 2 份曲拉塊。", "2 goat cheese for 3 days → Aged Goat Cheese; 2 chhurpi for 2 days → 2 Dried Chhurpi."],
    ["正下方有點燃的營火時，取出的乳酪輪變成煙燻乳酪輪。", "Over a lit campfire, a wheel comes out as a Smoked Cheese Wheel."],
  ],
  tanning_rack: [
    STATION,
    ["生皮或豬皮放 1 天 → 皮革；羊皮 → 皮革加 1 塊白色羊毛；4 張兔子皮 → 1 張皮革。", "Raw hide or pig skin for a day → Leather; sheepskin → leather and a white wool; 4 rabbit hides → 1 leather."],
    ["1 張皮革加 1 份牛脂或羊脂放 1 天 → 油鞣皮革。", "1 leather and 1 beef or mutton tallow for a day → Oiled Leather."],
    ["樂牧取代了原版的牛，皮革主要從這裡來。", "Ranching replaces the vanilla cow, so this is where leather comes from."],
  ],
  fermenting_jar: [
    STATION,
    ["1 瓶任何奶放 1 個遊戲日 → 優格。", "1 milk of any kind for one game day → Yogurt."],
  ],
  pickling_vat: [
    STATION,
    ["4 顆鴨蛋、1 顆黏土球放 2 天 → 4 顆鹹鴨蛋。", "4 duck eggs and 1 clay ball for 2 days → 4 Salted Duck Eggs."],
    ["4 顆鴨蛋、1 塊木炭、1 顆黏土球放 3 天 → 4 顆皮蛋。背包裡有木炭時會先做皮蛋。", "4 duck eggs, 1 charcoal and 1 clay ball for 3 days → 4 Century Eggs. With charcoal in your inventory it makes these first."],
    ["裝了漁歌時，4 顆鴨蛋加 1 份海鹽也能做鹹鴨蛋。", "With Fishing Voyage, 4 duck eggs and 1 sea salt also make salted duck eggs."],
  ],
  meat_grinder: [
    ["手持肉點一下，立刻出一份絞肉，不用等：生豬肉 → 豬絞肉；生牛肉、生水牛肉、生氂牛肉 → 牛絞肉；生羊肉 → 羊絞肉。", "Use it holding meat for one mince at once: raw porkchop → Ground Pork; raw beef, buffalo or yak → Ground Beef; raw mutton → Ground Mutton."],
    ["手持絞肉點：任兩份絞肉加 1 份腸衣 → 2 條生香腸。", "Holding mince: any 2 mince and 1 sausage casing → 2 Raw Sausages."],
    ["裝了漁歌時，2 份魚骨 → 1 份鈣粉。", "With Fishing Voyage, 2 fish bones → 1 Calcium Powder."],
  ],
  cream_separator: [
    STATION,
    ["1 瓶任何奶分半個遊戲日 → 1 份鮮奶油與 1 瓶脫脂奶。", "1 milk of any kind for half a game day → 1 Cream and 1 Skim Milk."],
    AUTO_STATION,
  ],
  ice_cream_churn: [
    ["手持鮮奶油、糖或冰點一下，用掉各 1 份，立刻得 2 份香草冰淇淋。", "Use it holding cream, sugar or ice: one of each makes 2 Vanilla Ice Cream at once."],
    ["背包裡有甜莓時改做莓果冰淇淋，有可可豆時做可可冰淇淋（兩樣都有時先做莓果），多用掉 1 個。", "With sweet berries in your inventory it makes Berry Ice Cream, with cocoa beans Chocolate (berries first if you carry both), using one more."],
  ],
  spinning_wheel: [
    STATION,
    ["半個遊戲日：1 塊羊毛（任何顏色）→ 2 毛線；2 份氂牛毛 → 2 毛線；2 份山羊絨或兔毛 → 2 絨線。", "Half a game day: 1 wool of any color → 2 Yarn; 2 yak hair → 2 yarn; 2 goat cashmere or rabbit fur → 2 Fine Yarn."],
    AUTO_STATION,
  ],
  weaving_loom: [
    STATION,
    ["半個遊戲日：2 毛線 → 1 毛呢布；2 絨線 → 1 絨布。", "Half a game day: 2 yarn → 1 Wool Cloth; 2 fine yarn → 1 Plush Cloth."],
    AUTO_STATION,
  ],

  // --- Facilities: decoration ---------------------------------------------------------------
  rug: [
    ["2 張絨布做 2 塊。拿染料點它就染成那個顏色，共 16 色。", "2 plush cloth make 2. Use a dye on it to color it, 16 colors."],
    ["動物入睡時 4 格內有地毯，算睡得好。", "Animals that fall asleep with a rug within 4 blocks sleep well."],
  ],
  down_pillow: [["3 羽絨、1 毛氈做成的裝飾方塊。", "A decoration made from 3 down and 1 felt."]],
  down_quilt: [["4 羽絨、2 絨布做成的裝飾方塊。", "A decoration made from 4 down and 2 plush cloth."]],
  horn_decor: [["牛角或羊角加 1 塊木材做成的裝飾方塊。", "A decoration made from a cattle or billy goat horn and a plank."]],

  // --- Tools --------------------------------------------------------------------------------
  milking_pail: [
    ["對成年母牛、母山羊、母水牛或母氂牛使用，每隻每天只能擠一次。", "Use it on an adult female cow, goat, buffalo or yak, once a day each."],
    ["每擠一次要用掉背包裡一個空玻璃瓶，換成一瓶奶。耐久度 128。", "Each milking needs an empty glass bottle from your inventory and fills it. 128 durability."],
    ["生病的動物不產奶。睡著的動物被擠奶會醒來，副手戴皮手套就不會。", "A sick animal gives no milk. Milking wakes a sleeping animal unless you wear Leather Gloves in your off hand."],
  ],
  nursing_bottle: [
    ["對哺乳類的幼體使用，用掉背包裡一瓶奶（先用脫脂奶），還回玻璃瓶。", "Use it on a mammal baby: it uses a bottle of milk from your inventory (skim milk first) and gives the bottle back."],
    ["餵滿 3 次幼體就立刻長大。耐久度 32。", "Three feedings and the baby grows up at once. 32 durability."],
  ],
  cowbell: [
    ["搖一下，32 格內好感度 3 心以上的樂牧動物會過來，一分鐘內跟著拿牧鈴的你走。", "Ring it: Ranching animals with three hearts or more within 32 blocks come and follow you for a minute."],
    ["冷卻 3 秒。搖鈴會吵醒睡著的動物。", "3-second cooldown. The bell wakes sleeping animals."],
  ],
  animal_crate: [
    ["拿空籠點樂牧動物就裝進去；拿裝了動物的籠子點地面就放出來。", "Use the empty crate on a Ranching animal to pack it; use the full crate on the ground to let it out."],
    ["保留性別、名字、幼體、毛色、好感度、耳標、懷孕等全部資料。", "It keeps sex, name, age, coat, affection, ear tag, pregnancy and everything else."],
    ["被牽著、有人騎著，或背著裝了東西的馱袋時，不能裝籠。", "An animal on a lead, being ridden, or carrying a pack bag with things in it cannot be crated."],
  ],
  brush: [
    ["對動物使用，算當天的照料。每隻每天只算一次。耐久度 64。", "Use it on an animal to give its daily care, once a day each. 64 durability."],
    ["刷豬可能掉豬鬃，刷山羊、兔各有 30% 機率掉山羊絨、兔毛，刷家禽可能掉羽毛。", "Brushing may give a pig bristle from pigs, cashmere or fur (30%) from goats and rabbits, and feathers from poultry."],
    ["不用毛刷時，蹲下空手撫摸也算照料。", "Petting while sneaking with an empty hand counts as care too."],
  ],
  ranch_notebook: [
    ["對動物使用：顯示名字、性別、年齡、好感度、今日需求、健康、作息、產出、繁殖與裝備，還可以替牠命名。", "Use it on an animal to see its name, sex, age, affection, today's needs, health, sleep, products, breeding and gear, and to name it."],
    ["對空中使用：打開耳標名冊。管理員還能開設定頁，切換清潔需求、動物作息和疾病。", "Use it in the air to open the ear tag roster. Operators also get the settings: the cleanliness need, sleeping and illness."],
  ],
  ear_tag: [
    ["對樂牧動物使用，掛上編號並記進名冊（觀察手冊對空中使用可以看）。", "Use it on a Ranching animal to give it a number in the roster (open it with the Observation Journal in the air)."],
    ["掛了耳標的動物不會自然消失。一次合成 4 個。", "A tagged animal never despawns. Crafted four at a time."],
  ],
  feed_bag: [
    ["裝一類飼料，最多 64 份。", "Holds up to 64 units of one kind of feed."],
    ["蹲下對空中使用，把背包裡同類的飼料收進袋子；拿它點飼槽就倒進去。", "Sneak and use it in the air to gather that feed from your inventory; use it on a trough to pour it in."],
  ],
  manure_fork: [
    ["對地面使用，清掉周圍 3×3 範圍的糞便，掉出糞便物品。耐久度 128。", "Use it on the ground to clear manure in a 3×3 area; the manure drops as items. 128 durability."],
    ["氂牛的糞便留在地上超過一天再清，得到的是乾氂牛糞。", "Yak dung left on the ground over a day comes up as Dried Yak Dung."],
  ],
  leather_apron: [
    ["穿在胸甲欄位，護甲 2，耐久度 120。", "Worn in the chest slot: 2 armor, 120 durability."],
    ["在屠宰掛架分切時，每一刀有 30% 機率不扣刀的耐久度。", "While butchering on the rack, each stroke has a 30% chance not to wear the blade."],
  ],
  lasso: [
    ["看著 8 格內的樂牧動物使用，就像牽繩一樣把牠牽住。", "Use it looking at a Ranching animal within 8 blocks to put it on a lead."],
    ["耐久度 64，每次扣 1。被套住會吵醒睡著的動物。", "64 durability, 1 per throw. Being lassoed wakes a sleeping animal."],
  ],
  pack_bag: [
    ["對成年氂牛使用就裝上，共 15 格。", "Use it on an adult yak to put it on: 15 slots."],
    ["蹲下拿著物品對氂牛互動，整組放進馱袋；不蹲下空手互動，打開清單選一組取出。", "Sneak and use an item on the yak to store the stack; use it with an empty hand, standing, to pick a stack to take out."],
    ["清空後才能取下馱袋。氂牛死亡時馱袋和裡面的東西會掉出來。", "Empty it before taking it off. If the yak dies, the bag and its contents drop."],
  ],
  pasture_seed: [
    ["工作台：苜蓿種子與小麥種子各 1，做出 2 份。", "Crafting table: 1 alfalfa seeds and 1 wheat seeds make 2."],
    ["對泥土使用，周圍 3×3 的泥土立刻變成草方塊，補回被吃光的草場。", "Use it on dirt to turn the 3×3 patch of dirt around it into grass at once, mending a bare pasture."],
  ],
  feather_duster: [["對蜘蛛網或雪層使用，清掉周圍 3×3 範圍內的同種方塊。耐久度 64。", "Use it on cobwebs or snow layers to clear that block in a 3×3 area. 64 durability."]],
  wool_hat: [["戴在頭盔欄位，護甲 1，耐久度 80。", "Worn in the helmet slot: 1 armor, 80 durability."]],
  wool_scarf: [["穿在胸甲欄位，護甲 1，耐久度 80。", "Worn in the chest slot: 1 armor, 80 durability."]],
  harness: [
    ["對好感度 3 心以上的成年水牛使用就裝上；幼體和還不親近的水牛不肯裝。", "Use it on an adult buffalo with three hearts or more; calves and shy buffalo refuse it."],
    ["拿剪刀點水牛卸下挽具，犁也一起卸。", "Use shears on the buffalo to take the harness (and any plow) off."],
  ],
  plough: [
    ["對裝了挽具的水牛使用就接上犁，再用一次卸下。沒有挽具接不上。", "Use it on a harnessed buffalo to hitch it, again to unhitch. Without a harness it will not hitch."],
    ["用牽繩牽著水牛走，牠腳下與左右各一格的草地、泥土、土徑會變成耕地（上方要是空氣）。", "Lead the buffalo and the grass, dirt or path under it and one block to each side turns to farmland (with air above)."],
  ],
  animal_blanket: [
    ["披在牛、羊、山羊、豬或水牛身上，晚上就不會受寒。", "Put it on a cow, sheep, goat, pig or buffalo and it no longer feels the cold at night."],
    ["受寒：入睡時頭上沒遮蔽、腳邊 2 格內有雪、粉雪或冰，好感度 −4 點。氂牛不怕冷。", "Cold: falling asleep with no roof and snow, powder snow or ice within 2 blocks costs 4 affection points. Yaks never feel it."],
  ],
  leather_gloves: [["戴在副手，替睡著的動物擠奶時不會吵醒牠。耐久度 100。", "Worn in the off hand: milking a sleeping animal does not wake it. 100 durability."]],
  herding_horn: [
    ["對拴畜樁使用，設為集合點；對你馴服的狼使用，牠就成為你的牧羊犬。", "Use it on a hitching post to set your rally point; on a wolf you tamed to make it your sheepdog."],
    ["在空中吹：叫醒附近 32 格的動物，並派 48 格內你的牧羊犬去趕畜。要先設好集合點。", "Blow it in the air to wake animals within 32 blocks and send your sheepdogs within 48 to herd. Set a rally point first."],
    ["牧羊犬把 24 格內、離集合點超過 4 格的樂牧動物往集合點趕，每次最多 16 隻、30 秒；被牽著的不會被趕。", "Sheepdogs drive Ranching animals within 24 blocks and more than 4 from the rally point toward it, up to 16 at a time for 30 seconds; animals on a lead stay."],
  ],
  vet_medicine: [
    ["在飼料攪拌桶做。拿它點生病的動物，牠就痊癒。", "Made in the Feed Mixer. Use it on a sick animal to cure it."],
    ["每天檢查一次：連續兩天沒喝到水，或畜欄昨天、今天都不乾淨，有 20% 機率生病。", "Checked daily: two days without water, or a dirty pen yesterday and today, gives a 20% chance of falling ill."],
    ["生病的動物不產奶、不下蛋、不能繁殖、好感度不會上升，但不會死。", "A sick animal gives no milk or eggs, cannot breed and gains no affection, but it does not die."],
  ],
  soap: [
    ["牛脂或羊脂、木炭、水桶合成 2 塊。", "Beef or mutton tallow, charcoal and a water bucket make 2."],
    ["拿它點動物：當天算照料過，當天也不會因為畜欄髒而生病（缺水還是會）。", "Use it on an animal: it counts as cared for that day and cannot fall ill from a dirty pen that day (thirst still can)."],
  ],
  horn_cup: [
    ["1 個牛角做成，是奶酒的容器。", "Made from one cattle horn; it carries milk wine."],
    [`${TAVERN[0]}用它從酒館的酒桶裝出奶酒，喝完角杯留下。`, `${TAVERN[1]} Fill it with milk wine from a Tavern barrel; the cup is left when you drink it.`],
  ],
  egg_candler: [
    ["對巢箱或孵化器使用，裡面正在孵的蛋會亮 5 秒，透出蛋裡的胚胎。", "Use it on a nest box or incubator: the eggs hatching inside glow for 5 seconds and show the embryo within."],
    ["胚胎越大，離孵化越近。不用照蛋燈也看得出大概：孵到一半蛋殼出現小裂紋，快孵化時裂開。", "The bigger the embryo, the closer it is to hatching. The shells tell too: small cracks halfway, big cracks when the chick is nearly out."],
  ],

  // --- Feed and treats -------------------------------------------------------------------------
  alfalfa: [
    ["苜蓿長成後收割，得 1–2 份苜蓿和 1–2 顆種子。", "Harvested from grown alfalfa: 1–2 alfalfa and 1–2 seeds."],
    ["乾草類飼料，可放飼槽或乾草架。", "Grass feed for the trough or hay rack."],
    ["鍘草機 1 份切成 3 份飼草；也是混合飼料、苜蓿草餅和獸藥的材料。", "The Chaff Cutter turns 1 into 3 forage; also goes into mixed feed, alfalfa cakes and medicine."],
  ],
  alfalfa_seeds: [
    ["破壞草叢有 12.5% 機率掉落。", "Breaking grass has a 12.5% chance to drop them."],
    ["種在耕地上長成苜蓿，肥料可以催熟。", "Plant on farmland to grow alfalfa; fertilizer speeds it up."],
  ],
  forage: [
    ["工作台 3 小麥換 2 份；鍘草機更划算：1 小麥 → 2、1 苜蓿 → 3、1 乾草塊 → 12。", "3 wheat make 2 on a crafting table; the Chaff Cutter does better: 1 wheat → 2, 1 alfalfa → 3, 1 hay bale → 12."],
    ["乾草類飼料；也能拿來引誘、繁殖牛、羊、山羊、水牛、氂牛和兔。", "Grass feed; also tempts and breeds cows, sheep, goats, buffalo, yaks and rabbits."],
    ["4 份放進青貯桶 3 天變青貯料；也是混合飼料的材料。", "4 seal into silage in 3 days in a Silage Barrel; also goes into mixed feed."],
  ],
  mixed_feed: [
    ["飼料攪拌桶：2 飼草、1 苜蓿，加小麥種子、胡蘿蔔、馬鈴薯、甜菜根或廚餘其中一樣，得 4 份。", "Feed Mixer: 2 forage, 1 alfalfa and one of wheat seeds, carrot, potato, beetroot or food scraps, for 4."],
    ["所有動物都吃，也能用來繁殖哺乳類。", "Every animal eats it, and it breeds the mammals."],
  ],
  concentrate_feed: [
    ["飼料攪拌桶：2 混合飼料、2 小麥、1 骨粉，得 4 份。", "Feed Mixer: 2 mixed feed, 2 wheat and 1 bone meal, for 4."],
    ["所有動物都吃。加鈣粉可做成鈣質飼料。", "Every animal eats it. With calcium powder it makes calcium feed."],
  ],
  calcium_feed: [
    ["飼料攪拌桶：1 精飼料、1 鈣粉，得 2 份。", "Feed Mixer: 1 concentrate and 1 calcium powder, for 2."],
    ["只有雞、鴨、鵝吃。母禽當天吃了，下蛋時有 30% 機率多下一顆。", "Only chickens, ducks and geese eat it. A hen that ate it that day has a 30% chance to lay an extra egg."],
  ],
  silage: [
    ["青貯桶：4 份飼草密封 3 天，得 4 份。", "Silage Barrel: 4 forage sealed for 3 days make 4."],
    [`只有${RUMINANTS[0]}吃。`, `Only ${RUMINANTS[1]} eat it.`],
  ],
  alfalfa_cake: [
    ["2 苜蓿、1 糖合成 2 個。", "2 alfalfa and 1 sugar make 2."],
    [`${RUMINANTS[0]}最愛的零食：拿著對牠使用，每隻每天吃 1 個，好感度 +½ 心。`, `The favorite treat of ${RUMINANTS[1]}: use it on one, once a day each, for half a heart.`],
  ],
  grain_cake: [
    ["2 小麥種子、1 小麥合成 2 個。", "2 wheat seeds and 1 wheat make 2."],
    ["雞、鴨、鵝最愛的零食：拿著對牠使用，每隻每天吃 1 個，好感度 +½ 心。", "The favorite treat of chickens, ducks and geese: use it on one, once a day each, for half a heart."],
  ],
  beet_sugar_cube: [
    ["1 甜菜根、1 糖合成 2 個。", "1 beetroot and 1 sugar make 2."],
    ["豬最愛的零食：拿著對牠使用，每隻每天吃 1 個，好感度 +½ 心。", "Pigs' favorite treat: use it on one, once a day each, for half a heart."],
  ],
  carrot_chips: [
    ["1 胡蘿蔔、1 糖合成 2 個。", "1 carrot and 1 sugar make 2."],
    ["兔子最愛的零食：拿著對牠使用，每隻每天吃 1 個，好感度 +½ 心。", "Rabbits' favorite treat: use it on one, once a day each, for half a heart."],
  ],

  // --- Milk ------------------------------------------------------------------------------------
  cow_milk: [
    ["用擠奶桶或擠奶架從成年母牛擠出，每隻每天一次，每次用掉一個空玻璃瓶。", "Milked from an adult female cow with a Milking Pail or Milking Rack, once a day; each milking uses an empty glass bottle."],
    ["可以直接喝，喝完留下玻璃瓶。樂牧的奶類料理都能用。", "Drink it and keep the bottle. Any Ranching dish that takes milk takes it."],
    ["攪乳桶做奶油或鮮奶油，乳酪壓模做新鮮乳酪，發酵罐做優格。", "Churn it into butter or cream, press it into Fresh Cheese, ferment it into yogurt."],
    ["空桶加 3 瓶做成桶裝鮮奶，給酒館釀奶酒。", "A bucket and 3 bottles make a Bucket of Fresh Milk for Tavern milk wine."],
  ],
  goat_milk: [
    ["用擠奶桶或擠奶架從成年母山羊擠出，每隻每天一次，每次用掉一個空玻璃瓶。", "Milked from an adult female goat with a Milking Pail or Milking Rack, once a day; each milking uses an empty glass bottle."],
    ["可以直接喝，喝完留下玻璃瓶。樂牧的奶類料理都能用。", "Drink it and keep the bottle. Any Ranching dish that takes milk takes it."],
    ["攪乳桶做奶油或鮮奶油，乳酪壓模做山羊乳酪，發酵罐做優格。", "Churn it into butter or cream, press it into Goat Cheese, ferment it into yogurt."],
  ],
  buffalo_milk: [
    ["用擠奶桶或擠奶架從成年母水牛擠出，每隻每天一次，每次用掉一個空玻璃瓶。", "Milked from an adult female buffalo with a Milking Pail or Milking Rack, once a day; each milking uses an empty glass bottle."],
    ["可以直接喝，喝完留下玻璃瓶。樂牧的奶類料理都能用。", "Drink it and keep the bottle. Any Ranching dish that takes milk takes it."],
    ["攪乳桶做奶油或鮮奶油，乳酪壓模做莫札瑞拉，發酵罐做優格。", "Churn it into butter or cream, press it into Mozzarella, ferment it into yogurt."],
  ],
  yak_milk: [
    ["用擠奶桶或擠奶架從成年母氂牛擠出，每隻每天一次，每次用掉一個空玻璃瓶。", "Milked from an adult female yak with a Milking Pail or Milking Rack, once a day; each milking uses an empty glass bottle."],
    ["可以直接喝，喝完留下玻璃瓶。樂牧的奶類料理都能用。", "Drink it and keep the bottle. Any Ranching dish that takes milk takes it."],
    ["攪乳桶只做酥油（2 瓶），乳酪壓模做曲拉，發酵罐做優格。", "The churn makes only Ghee from it (2 bottles); press it into Chhurpi, ferment it into yogurt."],
    ["空桶加 3 瓶做成桶裝氂牛奶，給酒館釀氂牛奶酒。", "A bucket and 3 bottles make a Bucket of Yak Milk for Tavern yak milk wine."],
  ],

  // --- Eggs ------------------------------------------------------------------------------------
  duck_egg: [
    ["成年母鴨每天在 8 格內的巢箱下 1 顆。", "An adult duck lays one a day into a Nest Box within 8 blocks."],
    ["醃製缸：4 顆加黏土球做鹹鴨蛋，再加木炭做皮蛋。", "Pickling Vat: 4 with a clay ball make salted duck eggs; add charcoal for century eggs."],
    ["番茄炒鴨蛋要用；也能代替雞蛋做生蛋液。", "Used in Tomato and Duck Egg Stir-fry, and instead of a hen's egg in Egg Custard Mix."],
  ],
  goose_egg: [
    ["成年母鵝每天在 8 格內的巢箱下 1 顆。", "An adult goose lays one a day into a Nest Box within 8 blocks."],
    ["工作台拆成 2 顆原版雞蛋；也能直接做生蛋液。", "Crafts into 2 vanilla eggs, or goes into Egg Custard Mix as it is."],
  ],
  fertilized_chicken_egg: [
    ["巢箱 8 格內有成年公雞時，母雞的蛋依好感度有 10% 到 75% 機率受精。", "With an adult rooster within 8 blocks of the nest, a hen's egg has a 10% to 75% chance, by her affection, to be fertilized."],
    ["手持點巢箱放回去孵（4 格內要有母雞），或放進有熱源的孵化器；2 天孵出小雞，留下蛋殼。", "Brood it in a nest box (with a hen within 4 blocks) or a heated incubator; a chick hatches in 2 days and leaves an eggshell."],
  ],
  fertilized_duck_egg: [
    ["巢箱 8 格內有成年公鴨時，母鴨的蛋依好感度有 10% 到 75% 機率受精。", "With an adult drake within 8 blocks of the nest, a duck's egg has a 10% to 75% chance, by her affection, to be fertilized."],
    ["手持點巢箱放回去孵（4 格內要有母鴨），或放進有熱源的孵化器；2 天孵出小鴨，留下蛋殼。", "Brood it in a nest box (with a duck within 4 blocks) or a heated incubator; a duckling hatches in 2 days and leaves an eggshell."],
  ],
  fertilized_goose_egg: [
    ["巢箱 8 格內有成年公鵝時，母鵝的蛋依好感度有 10% 到 75% 機率受精。", "With an adult gander within 8 blocks of the nest, a goose's egg has a 10% to 75% chance, by her affection, to be fertilized."],
    ["手持點巢箱放回去孵（4 格內要有母鵝），或放進有熱源的孵化器；2 天孵出小鵝，留下蛋殼。", "Brood it in a nest box (with a goose within 4 blocks) or a heated incubator; a gosling hatches in 2 days and leaves an eggshell."],
  ],
  salted_duck_egg: [
    ["醃製缸：4 顆鴨蛋、1 顆黏土球放 2 天，得 4 顆。背包裡有木炭時會改做皮蛋。", "Pickling Vat: 4 duck eggs and 1 clay ball for 2 days make 4. With charcoal in your inventory it makes century eggs instead."],
    ["可以直接吃；也用來做鹹蛋黃炒菜。", "Eat it as it is, or cook Salted Egg Yolk Greens."],
  ],
  century_egg: [
    ["醃製缸：4 顆鴨蛋、1 塊木炭、1 顆黏土球放 3 天，得 4 顆。", "Pickling Vat: 4 duck eggs, 1 charcoal and 1 clay ball for 3 days make 4."],
    ["可以直接吃；也用來做皮蛋瘦肉粥。", "Eat it as it is, or cook Century Egg and Pork Congee."],
  ],

  // --- Dairy -----------------------------------------------------------------------------------
  butter: [
    ["攪乳桶：2 瓶牛奶、山羊奶或水牛奶，30 秒。", "Butter Churn: 2 cow, goat or buffalo milk, 30 seconds."],
    ["用來做奶油煎牛排；加鵝肝在攪乳桶做鵝肝醬。", "Goes into Butter-seared Steak, and with a goose liver into pâté at the churn."],
  ],
  cream: [
    ["攪乳桶：背包裡牛奶、山羊奶、水牛奶加起來不到 2 瓶時，1 瓶做 1 份（15 秒）；2 瓶以上會做成奶油。", "Butter Churn: with fewer than 2 cow, goat or buffalo milk in your inventory, 1 makes cream (15 s); 2 or more make butter."],
    ["奶油分離器：1 瓶任何奶 → 鮮奶油加脫脂奶。", "Cream Separator: 1 milk of any kind → cream and skim milk."],
    ["可以吃。奶油燉菜、焗烤生料、冰淇淋的材料；裝了酒館可以放進調酒器。", "Edible. Goes into Cream Stew, gratin and ice cream, and into the Tavern shaker if installed."],
  ],
  ghee: [
    ["攪乳桶：2 瓶氂牛奶，30 秒。", "Butter Churn: 2 yak milk, 30 seconds."],
    ["用來做酥油飯、曲拉酥油茶。", "Goes into Ghee Rice and Chhurpi Butter Tea."],
  ],
  yogurt: [
    ["發酵罐：1 瓶任何奶放 1 個遊戲日。", "Fermenting Jar: 1 milk of any kind for one game day."],
    ["可以吃，也能做莓果優格。裝了酒館：優格莓果飲的材料，也是釀奶酒的酒引。", "Edible, and makes Berry Yogurt. With Tavern it goes into the berry drink and starts milk wine."],
  ],
  fresh_cheese: [
    ["乳酪壓模：3 瓶牛奶壓半個遊戲日，另得 1 份乳清。", "Cheese Press: 3 cow milk for half a game day, with 1 whey."],
    ["可以吃。4 塊放上熟成架 3 天變熟成乳酪輪。", "Edible. 4 on the Aging Rack for 3 days make an Aged Cheese Wheel."],
  ],
  aged_cheese_wheel: [
    ["熟成架：4 塊新鮮乳酪放 3 天；超過 7 天才取出會變陳年乳酪輪。", "Aging Rack: 4 fresh cheese for 3 days; left 7 days or more it becomes a Vintage Cheese Wheel."],
    ["對著方塊使用會放在地上，再用菜刀、劍或斧切，一次一塊，共 4 塊乳酪塊。", "Use it on a block to set it down, then cut it with a knife, sword or axe, one Cheese Slice at a time, 4 in all."],
    ["也能在工作台拆成 4 塊，或放在廚房的砧板上切。", "It also crafts into 4 slices, or cuts on Cookery's chopping board."],
  ],
  cheese_slice: [
    ["從熟成乳酪輪切下或拆出，一輪 4 塊。", "Cut or crafted from an Aged Cheese Wheel, 4 a wheel."],
    ["可以吃。乳酪吐司、焗烤生料、松露焗烤生料的材料；裝了漁歌可以當魚餌。", "Edible. Goes into Cheese Toast and both gratins; Fishing Voyage takes it as bait."],
  ],
  foie_gras_pate: [
    ["攪乳桶：1 鵝肝、1 奶油，30 秒。", "Butter Churn: 1 goose liver and 1 butter, 30 seconds."],
    ["可以吃；也用來做鵝肝醬吐司。", "Edible, and makes Pâté Toast."],
  ],
  skim_milk: [
    ["奶油分離器分出鮮奶油後剩下的。", "What the Cream Separator leaves after taking the cream."],
    ["可以喝。奶瓶餵幼體時會先用脫脂奶。", "Drinkable. The Nursing Bottle uses skim milk first."],
    ["3 瓶在乳酪壓模壓成 2 塊奶豆腐與 1 份乳清。", "3 in the Cheese Press make 2 Milk Tofu and 1 whey."],
  ],
  vanilla_ice_cream: [
    ["冰淇淋桶：鮮奶油、糖、冰各 1 份，點一下得 2 份。", "Ice Cream Churn: one each of cream, sugar and ice make 2 at once."],
    ["裝了酒館可以放進調酒器。", "Goes into the Tavern shaker if installed."],
  ],
  berry_ice_cream: [
    ["冰淇淋桶：鮮奶油、糖、冰之外，背包裡有甜莓時多用 1 個，得 2 份。", "Ice Cream Churn: cream, sugar and ice with sweet berries in your inventory make 2."],
  ],
  chocolate_ice_cream: [
    ["冰淇淋桶：鮮奶油、糖、冰之外，背包裡有可可豆（沒有甜莓）時多用 1 個，得 2 份。", "Ice Cream Churn: cream, sugar and ice with cocoa beans (and no berries) in your inventory make 2."],
  ],
  custard: [
    ["攪乳桶：手拿雞蛋點，2 顆雞蛋、1 瓶任何奶、1 份糖，15 秒得 2 份。", "Butter Churn, holding an egg: 2 eggs, 1 milk of any kind and 1 sugar make 2 in 15 seconds."],
    ["放進廚房的蒸籠蒸成雞蛋布丁；加生麵團做蛋塔生料。", "Steams into Egg Pudding in Cookery's steamer; with raw dough it makes an unbaked egg tart."],
  ],
  goat_cheese: [
    ["乳酪壓模：3 瓶山羊奶壓半個遊戲日，另得 1 份乳清。", "Cheese Press: 3 goat milk for half a game day, with 1 whey."],
    ["可以吃。2 塊放上熟成架 3 天變熟成山羊乳酪。", "Edible. 2 on the Aging Rack for 3 days make Aged Goat Cheese."],
  ],
  aged_goat_cheese: [
    ["熟成架：2 塊山羊乳酪放 3 天。", "Aging Rack: 2 goat cheese for 3 days."],
    ["可以吃；也用來做山羊乳酪沙拉。", "Edible, and makes Goat Cheese Salad."],
  ],
  mozzarella: [
    ["乳酪壓模：3 瓶水牛奶壓半個遊戲日，另得 1 份乳清。", "Cheese Press: 3 buffalo milk for half a game day, with 1 whey."],
    ["可以吃；也是披薩生料的材料。", "Edible, and goes into an unbaked pizza."],
  ],
  chhurpi: [
    ["乳酪壓模：3 瓶氂牛奶壓半個遊戲日，另得 1 份乳清。", "Cheese Press: 3 yak milk for half a game day, with 1 whey."],
    ["可以吃。2 塊放上熟成架風乾 2 天，得 2 份曲拉塊。", "Edible. 2 dry on the Aging Rack for 2 days into 2 Dried Chhurpi."],
  ],
  chhurpi_block: [
    ["熟成架：2 塊曲拉風乾 2 天，得 2 份。", "Aging Rack: 2 chhurpi dried for 2 days make 2."],
    ["可以吃；也用來做曲拉酥油茶。", "Edible, and goes into Chhurpi Butter Tea."],
  ],
  vintage_cheese_wheel: [
    ["熟成架：4 塊新鮮乳酪放滿 7 天才取出。", "Aging Rack: 4 fresh cheese left 7 days or more."],
    ["對著方塊使用會放在地上，用菜刀、劍或斧切成 4 片；在工作台拆則是 5 片陳年乳酪片。", "Set it down and cut it with a knife, sword or axe into 4 slices, or craft it into 5 Vintage Cheese Slices."],
    ["熟成架下方有點燃的營火時，會變成煙燻乳酪輪。", "Over a lit campfire under the rack it comes out smoked instead."],
  ],
  vintage_cheese_slice: [
    ["陳年乳酪輪切下或拆出。", "Cut or crafted from a Vintage Cheese Wheel."],
    ["可以吃；2 片用來煮起司火鍋。", "Edible; 2 go into Cheese Fondue."],
  ],
  smoked_cheese_wheel: [
    ["熟成架正下方有點燃的營火時，取出的乳酪輪就是煙燻的。", "Any cheese wheel taken from an Aging Rack over a lit campfire comes out smoked."],
    ["對著方塊使用會放在地上，用菜刀、劍或斧切成 4 片；也能在工作台拆成 4 片。", "Set it down and cut it with a knife, sword or axe into 4 slices, or craft it into 4."],
  ],
  smoked_cheese_slice: [
    ["煙燻乳酪輪切下或拆出。", "Cut or crafted from a Smoked Cheese Wheel."],
    ["可以吃；也用來做煙燻起司三明治。", "Edible, and makes a Smoked Cheese Sandwich."],
  ],
  ricotta: [
    ["乳酪壓模：3 份乳清壓四分之一個遊戲日。", "Cheese Press: 3 whey for a quarter of a game day."],
    ["可以吃；也用來做瑞可塔鬆餅。", "Edible, and makes Ricotta Pancakes."],
  ],
  milk_tofu: [
    ["乳酪壓模：3 瓶脫脂奶壓半個遊戲日，得 2 塊，另得 1 份乳清。", "Cheese Press: 3 skim milk for half a game day make 2, with 1 whey."],
    ["可以吃。", "Edible."],
  ],
  cream_cocoa: [
    [`${TAVERN[0]}在酒館的調酒器用鮮奶油、可可豆、糖調成。`, `${TAVERN[1]} Shaken in the Tavern shaker from cream, cocoa beans and sugar.`],
    ["喝完留下玻璃瓶。", "The glass bottle is left when you drink it."],
  ],
  yogurt_berry_drink: [
    [`${TAVERN[0]}在酒館的調酒器用優格、甜莓，加煉乳或糖調成。`, `${TAVERN[1]} Shaken in the Tavern shaker from yogurt, sweet berries and condensed milk or sugar.`],
    ["喝完留下玻璃瓶。", "The glass bottle is left when you drink it."],
  ],
  fresh_milk_bucket: [
    ["原版牛奶桶在工作台直接換，或空桶加 3 瓶牛奶、山羊奶或水牛奶。", "Craft a vanilla milk bucket into it, or a bucket and 3 cow, goat or buffalo milk."],
    [`${TAVERN[0]}在酒館的酒桶加優格、糖或蜂蜜瓶，發酵成奶酒。`, `${TAVERN[1]} In a Tavern barrel with yogurt and sugar or honey it ferments into Milk Wine.`],
  ],
  yak_milk_bucket: [
    ["空桶加 3 瓶氂牛奶。", "A bucket and 3 yak milk."],
    [`${TAVERN[0]}在酒館的酒桶加優格、小麥，發酵成氂牛奶酒。`, `${TAVERN[1]} In a Tavern barrel with yogurt and wheat it ferments into Yak Milk Wine.`],
  ],
  milk_wine: [
    [`${TAVERN[0]}桶裝鮮奶、優格、糖或蜂蜜瓶在酒館的酒桶發酵。`, `${TAVERN[1]} Fresh milk, yogurt and sugar or honey ferment in a Tavern barrel.`],
    ["用角杯從酒桶裝出，喝完角杯留下。", "Pour it out with a Horn Cup; the cup is left when you drink it."],
  ],
  yak_milk_wine: [
    [`${TAVERN[0]}桶裝氂牛奶、優格、小麥在酒館的酒桶發酵。`, `${TAVERN[1]} Yak milk, yogurt and wheat ferment in a Tavern barrel.`],
    ["用角杯從酒桶裝出，喝完角杯留下。", "Pour it out with a Horn Cup; the cup is left when you drink it."],
  ],

  // --- Meat ------------------------------------------------------------------------------------
  buffalo_meat: [
    ["分切水牛屠體取得，公水牛多 1 份。", "Cut from a Buffalo Carcass; a bull gives one more."],
    ["熔爐、煙燻爐或營火烤熟；也能在廚房的炒鍋直接煎熟。", "Cook it in a furnace, smoker or campfire, or straight in Cookery's wok."],
    ["絞肉機絞成牛絞肉。", "The Meat Grinder turns it into Ground Beef."],
  ],
  cooked_buffalo_meat: [["生水牛肉烤熟或在炒鍋煎熟。可以吃，8 點飢餓值。", "Raw buffalo cooked in a furnace or the wok. 8 hunger."]],
  yak_meat: [
    ["分切氂牛屠體取得，公氂牛多 1 份。", "Cut from a Yak Carcass; a bull gives one more."],
    ["熔爐、煙燻爐或營火烤熟；也能在廚房的炒鍋直接煎熟。", "Cook it in a furnace, smoker or campfire, or straight in Cookery's wok."],
    ["用來做氂牛肉燉菜；絞肉機絞成牛絞肉。", "Goes into Yak Meat Stew; the Meat Grinder turns it into Ground Beef."],
  ],
  cooked_yak_meat: [["生氂牛肉烤熟或在炒鍋煎熟。可以吃，8 點飢餓值。", "Raw yak cooked in a furnace or the wok. 8 hunger."]],
  quail_egg: [
    ["成年母鵪鶉每天在 8 格內的巢箱下 2 顆。", "An adult quail lays two a day into a Nest Box within 8 blocks."],
    ["工作台：4 顆換 1 顆雞蛋。", "Crafting table: 4 make one egg."],
  ],
  fertilized_quail_egg: [
    ["巢箱 8 格內有成年公鵪鶉時，母鵪鶉的蛋依好感度有機會受精。", "With an adult cock within 8 blocks of the nest, a quail's egg may be fertilized, more often the happier she is."],
    ["手持點巢箱放回去孵，或放進有熱源的孵化器；1 天孵出小鵪鶉，留下蛋殼。", "Brood it in a nest box or a heated incubator; a chick hatches in 1 day and leaves an eggshell."],
  ],
  turkey_egg: [
    ["成年母火雞每 2 天在 8 格內的巢箱下 1 顆。", "An adult turkey lays one every two days into a Nest Box within 8 blocks."],
    ["工作台：1 顆換 2 顆雞蛋。", "Crafting table: one makes two eggs."],
  ],
  fertilized_turkey_egg: [
    ["巢箱 8 格內有成年公火雞時，母火雞的蛋依好感度有機會受精。", "With an adult tom within 8 blocks of the nest, a turkey's egg may be fertilized, more often the happier she is."],
    ["手持點巢箱放回去孵，或放進有熱源的孵化器；2 天孵出小火雞，留下蛋殼。", "Brood it in a nest box or a heated incubator; a poult hatches in 2 days and leaves an eggshell."],
  ],
  quail_meat: [
    ["分切鵪鶉屠體取得。", "Cut from a Quail Carcass."],
    ["熔爐、煙燻爐或營火烤熟；也能在廚房的炒鍋直接煎熟。", "Cook it in a furnace, smoker or campfire, or straight in Cookery's wok."],
  ],
  cooked_quail_meat: [["生鵪鶉肉烤熟或在炒鍋煎熟。可以吃，8 點飢餓值。", "Raw quail cooked in a furnace or the wok. 8 hunger."]],
  turkey_meat: [
    ["分切火雞屠體取得。", "Cut from a Turkey Carcass."],
    ["熔爐、煙燻爐或營火烤熟；也能在廚房的炒鍋直接煎熟。", "Cook it in a furnace, smoker or campfire, or straight in Cookery's wok."],
  ],
  cooked_turkey_meat: [["生火雞肉烤熟或在炒鍋煎熟。可以吃，8 點飢餓值。", "Raw turkey cooked in a furnace or the wok. 8 hunger."]],
  turkey_leg: [["分切火雞屠體取得，一具 2 隻。", "Cut from a Turkey Carcass, 2 each."]],
  turkey_breast: [
    ["分切火雞屠體取得，一具 1 塊。", "Cut from a Turkey Carcass, 1 each."],
    ["熔爐、煙燻爐或營火烤成熟火雞胸；也能在炒鍋直接煎熟。", "Cook it into Cooked Turkey Breast in a furnace, smoker or campfire, or in the wok."],
  ],
  whole_turkey: [
    ["火雞拔完毛（第一刀）、還沒切其他部位時，蹲下空手點屠宰掛架，就能把整隻取下。", "Once a turkey is plucked (the first stroke) and nothing else is cut, sneak and use the Butcher Rack with an empty hand to take it down whole."],
    ["放進熔爐或煙燻爐烤成烤全火雞。", "Roast it into a Roast Turkey in a furnace or smoker."],
  ],
  cooked_turkey_breast: [["火雞胸烤熟或在炒鍋煎熟。可以吃，8 點飢餓值。", "Turkey breast cooked in a furnace or the wok. 8 hunger."]],
  alpaca_meat: [
    ["分切羊駝屠體取得，公的多一份。", "Cut from an Alpaca Carcass; a male gives one more."],
    ["熔爐、煙燻爐或營火烤熟；也能在廚房的炒鍋直接煎熟。", "Cook it in a furnace, smoker or campfire, or straight in Cookery's wok."],
  ],
  cooked_alpaca_meat: [["生羊駝肉烤熟或在炒鍋煎熟。可以吃，8 點飢餓值。", "Raw alpaca cooked in a furnace or the wok. 8 hunger."]],
  alpaca_wool: [
    ["用剪刀剪羊駝取得，一次 1 到 2 份；刷毛也有 30% 機率掉落，分切沒剪過毛的羊駝屠體得 2 份。", "Shear an alpaca for 1 or 2; brushing drops one 30% of the time, and an unshorn Alpaca Carcass gives 2."],
    ["紡車：2 份紡成 2 份絨線。", "Spinning Wheel: 2 spin into 2 fine yarn."],
  ],
  alpaca_hide: [
    ["分切羊駝屠體時剝下。", "Skinned from an Alpaca Carcass."],
    ["鞣皮架放 1 天變成皮革。", "A day on the Tanning Rack turns it into leather."],
  ],
  duck_meat: [
    ["分切鴨屠體取得。", "Cut from a Duck Carcass."],
    ["熔爐、煙燻爐或營火烤熟；也能在廚房的炒鍋直接煎熟。", "Cook it in a furnace, smoker or campfire, or straight in Cookery's wok."],
    ["用來做老鴨湯。", "Goes into Old Duck Soup."],
  ],
  cooked_duck_meat: [["生鴨肉烤熟或在炒鍋煎熟。可以吃，8 點飢餓值。", "Raw duck cooked in a furnace or the wok. 8 hunger."]],
  goose_meat: [
    ["分切鵝屠體取得。", "Cut from a Goose Carcass."],
    ["熔爐、煙燻爐或營火烤熟；也能在廚房的炒鍋直接煎熟。", "Cook it in a furnace, smoker or campfire, or straight in Cookery's wok."],
    ["用來做鐵鍋燉大鵝。", "Goes into Iron Pot Goose Stew."],
  ],
  cooked_goose_meat: [["生鵝肉烤熟或在炒鍋煎熟。可以吃，8 點飢餓值。", "Raw goose cooked in a furnace or the wok. 8 hunger."]],
  beef_brisket: [
    ["分切牛、水牛、氂牛屠體取得。", "Cut from cow, buffalo and yak carcasses."],
    ["燉牛腩要 2 份；也能代替肉做奶油燉菜。", "2 make Braised Beef Brisket; it can stand in for the meat in Cream Stew."],
  ],
  beef_shank: [
    ["分切牛、水牛、氂牛屠體取得。", "Cut from cow, buffalo and yak carcasses."],
    ["掛在空的屠宰掛架風乾 3 天，變成牛肉乾。", "Air-dried for 3 days on an empty Butcher Rack it becomes Beef Jerky."],
  ],
  beef_sirloin: [
    ["分切牛屠體取得，公牛多 1 份。", "Cut from a Cow Carcass; a bull gives one more."],
    ["加奶油在炒鍋做奶油煎牛排。", "With butter in the wok it becomes Butter-seared Steak."],
  ],
  pork_belly: [
    ["分切豬屠體取得，公豬多 1 份。", "Cut from a Pig Carcass; a boar gives one more."],
    ["紅燒五花肉、皮蛋瘦肉粥的材料。", "Goes into Braised Pork Belly and Century Egg Congee."],
    ["掛在空的屠宰掛架風乾 3 天，變成臘肉。", "Air-dried for 3 days on an empty Butcher Rack it becomes Cured Pork Belly."],
  ],
  pork_ribs: [
    ["分切豬屠體取得。", "Cut from a Pig Carcass."],
    ["2 份加糖、番茄在炒鍋做糖醋排骨。", "2 with sugar and a tomato in the wok make Sweet and Sour Spare Ribs."],
  ],
  pork_trotter: [
    ["分切豬屠體取得，一具 2 到 4 隻。", "Cut from a Pig Carcass, 2 to 4 each."],
    ["2 隻加大骨做豬蹄湯。", "2 with a large bone make Pork Trotter Soup."],
  ],
  lamb_chop: [
    ["分切羊、山羊屠體取得。", "Cut from sheep and goat carcasses."],
    ["2 份加紅辣椒在炒鍋做孜然羊排。", "2 with a red chili in the wok make Spiced Lamb Chops."],
  ],
  lamb_leg: [
    ["分切羊、山羊屠體取得。", "Cut from sheep and goat carcasses."],
    ["加紅辣椒在工作台做成醃羊腿，再烤成孜然烤羊腿。", "With a red chili it crafts into a Seasoned Lamb Leg, which roasts into Spiced Roast Lamb Leg."],
  ],
  chicken_leg: [
    ["分切雞屠體取得，一具 2 隻。", "Cut from a Chicken Carcass, 2 each."],
    ["辣子雞腿要 2 隻；也能代替肉做奶油燉菜。", "2 make Spicy Chicken Legs; it can stand in for the meat in Cream Stew."],
  ],
  chicken_wing: [
    ["分切雞屠體取得，一具 2 隻。", "Cut from a Chicken Carcass, 2 each."],
    ["2 隻加糖在炒鍋做蜜汁雞翅。", "2 with sugar in the wok make Honey-glazed Chicken Wings."],
  ],
  duck_leg: [
    ["分切鴨屠體取得，一具 2 隻。", "Cut from a Duck Carcass, 2 each."],
    ["可代替鴨肉燉老鴨湯。掛在空的屠宰掛架風乾 3 天變成臘鴨腿。", "Stands in for duck in Old Duck Soup. Air-dried for 3 days on an empty Butcher Rack it becomes a Cured Duck Leg."],
  ],
  goose_leg: [
    ["分切鵝屠體取得，一具 2 隻。", "Cut from a Goose Carcass, 2 each."],
    ["可代替鵝肉做鐵鍋燉大鵝。", "Stands in for goose in Iron Pot Goose Stew."],
  ],
  rabbit_leg: [
    ["分切兔屠體取得，一具 2 隻。", "Cut from a Rabbit Carcass, 2 each."],
    ["2 隻加胡蘿蔔、糖在湯鍋做紅燒兔腿。", "2 with a carrot and sugar in the stockpot make Braised Rabbit Legs."],
  ],
  pork_mince: [
    ["絞肉機：手持生豬肉點一下。", "Meat Grinder: use it holding a raw porkchop."],
    ["2 份用來做紅燒獅子頭；任兩份絞肉加腸衣做生香腸。裝了漁歌可以當魚餌。", "2 make Braised Lion's Head Meatballs; any 2 mince and a casing make sausages. Fishing Voyage takes it as bait."],
  ],
  beef_mince: [
    ["絞肉機：手持生牛肉、生水牛肉或生氂牛肉點一下。", "Meat Grinder: use it holding raw beef, buffalo or yak."],
    ["2 份加麵包做漢堡排；任兩份絞肉加腸衣做生香腸。裝了漁歌可以當魚餌。", "2 with bread make Hamburg Steak; any 2 mince and a casing make sausages. Fishing Voyage takes it as bait."],
  ],
  mutton_mince: [
    ["絞肉機：手持生羊肉點一下。", "Meat Grinder: use it holding raw mutton."],
    ["2 份加胡蘿蔔做羊肉丸湯；任兩份絞肉加腸衣做生香腸。裝了漁歌可以當魚餌。", "2 with a carrot make Lamb Meatball Soup; any 2 mince and a casing make sausages. Fishing Voyage takes it as bait."],
  ],
  raw_sausage: [
    ["絞肉機：手持絞肉點，任兩份絞肉加 1 份腸衣，得 2 條。", "Meat Grinder, holding mince: any 2 mince and 1 casing make 2."],
    ["2 條在炒鍋做香煎香腸；掛在空的屠宰掛架風乾 3 天變成臘腸。", "2 in the wok make Pan-fried Sausages; air-dried for 3 days on an empty Butcher Rack it becomes Cured Sausage."],
  ],
  cured_sausage: [
    ["生香腸掛在空的屠宰掛架風乾 3 天。", "Raw sausage air-dried for 3 days on an empty Butcher Rack."],
    ["可以吃；也用來做臘味煲仔飯。", "Edible, and goes into Cured Meat Claypot Rice."],
  ],
  cured_pork_belly: [
    ["五花肉掛在空的屠宰掛架風乾 3 天。", "Pork belly air-dried for 3 days on an empty Butcher Rack."],
    ["可以吃；也用來做臘味煲仔飯、臘肉炒青椒。", "Edible, and goes into Claypot Rice and Cured Pork with Peppers."],
  ],
  cured_duck_leg: [
    ["鴨腿掛在空的屠宰掛架風乾 3 天。", "A duck leg air-dried for 3 days on an empty Butcher Rack."],
    ["可以吃；也用來做臘鴨腿飯。", "Edible, and goes into Cured Duck Leg Rice."],
  ],
  beef_jerky: [
    ["牛腱掛在空的屠宰掛架風乾 3 天。", "Beef shank air-dried for 3 days on an empty Butcher Rack."],
    ["可以吃。", "Edible."],
  ],
  pork_liver: [
    ["分切豬屠體時剝皮後的那一刀取得。", "Cut from a Pig Carcass right after the skin."],
    ["豬肝湯、麻油豬肝的材料；裝了漁歌可以當魚餌。", "Goes into Pork Liver Soup and Sesame Oil Pork Liver; Fishing Voyage takes it as bait."],
    OFFAL_FEED,
  ],
  pig_intestine: [
    ["分切豬屠體取得，一具 1 到 2 份。", "Cut from a Pig Carcass, 1 or 2 each."],
    ["手持點有水的水槽，用掉 1 格水，洗成洗淨的大腸。", "Use it on a water trough with water to wash it into a Cleaned Intestine, using one level."],
    OFFAL_FEED,
  ],
  chicken_gizzard: [
    ["分切雞屠體時剝完毛後的那一刀取得。", "Cut from a Chicken Carcass right after the feathers."],
    ["2 份用來做滷雞胗；裝了漁歌可以當魚餌。", "2 make Braised Chicken Gizzards; Fishing Voyage takes it as bait."],
    OFFAL_FEED,
  ],
  duck_blood: [
    ["分切鴨屠體時取得。", "Cut from a Duck Carcass."],
    ["用來做鴨血粉絲湯。", "Goes into Duck Blood Vermicelli Soup."],
    OFFAL_FEED,
  ],
  goose_liver: [
    ["分切鵝屠體時取得。", "Cut from a Goose Carcass."],
    ["加 1 份奶油在攪乳桶做鵝肝醬。", "With a butter at the Butter Churn it makes Goose Liver Pâté."],
    OFFAL_FEED,
  ],
  beef_tripe: [
    ["分切牛、水牛、氂牛屠體時取得。", "Cut from cow, buffalo and yak carcasses."],
    ["手持點有水的水槽，用掉 1 格水，洗成洗淨的牛肚。", "Use it on a water trough with water to wash it into Cleaned Tripe, using one level."],
    OFFAL_FEED,
  ],
  cleaned_intestine: [
    ["手持豬腸點有水的水槽洗出來。", "Wash a Pig Intestine at a water trough."],
    ["2 份加糖滷大腸；在工作台 1 份做 2 份腸衣。", "2 with sugar make Braised Pork Intestine; 1 crafts into 2 sausage casings."],
    OFFAL_FEED,
  ],
  cleaned_tripe: [
    ["手持牛肚點有水的水槽洗出來。", "Wash a Beef Tripe at a water trough."],
    ["加紅辣椒、青辣椒在炒鍋做麻辣牛肚。", "With red and green chili in the wok it makes Spicy Beef Tripe."],
    OFFAL_FEED,
  ],

  // --- Cloth and leather ----------------------------------------------------------------------
  oiled_leather: [
    ["鞣皮架：1 張皮革加 1 份牛脂或羊脂，放 1 天。", "Tanning Rack: 1 leather and 1 beef or mutton tallow for a day."],
    ["做皮圍裙、套索、挽具、皮手套和馱袋。", "Makes the Leather Apron, Lasso, Harness, Leather Gloves and Pack Bag."],
  ],
  yarn: [
    ["紡車：1 塊羊毛（任何顏色）→ 2 份；2 份氂牛毛 → 2 份。", "Spinning Wheel: 1 wool of any color → 2; 2 yak hair → 2."],
    ["4 份在工作台壓成 2 張毛氈；織布機 2 份織成毛呢布；1 份可換回 1 條線。", "4 craft into 2 felt; 2 weave into wool cloth on the loom; 1 crafts back into string."],
  ],
  fine_yarn: [
    ["紡車：2 份山羊絨或兔毛 → 2 份。", "Spinning Wheel: 2 goat cashmere or rabbit fur → 2."],
    ["織布機 2 份織成絨布。", "2 weave into plush cloth on the loom."],
  ],
  felt: [
    ["工作台：4 份毛線壓成 2 張。", "Crafting table: 4 yarn make 2."],
    ["做羽絨枕和馱袋。", "Makes the Down Pillow and Pack Bag."],
  ],
  wool_cloth: [
    ["織布機：2 份毛線，半個遊戲日。", "Weaving Loom: 2 yarn, half a game day."],
    ["做毛帽和圍巾。", "Makes the Wool Hat and Wool Scarf."],
  ],
  plush_cloth: [
    ["織布機：2 份絨線，半個遊戲日。", "Weaving Loom: 2 fine yarn, half a game day."],
    ["做地毯（2 張做 2 塊）、羽絨被和動物披毯（3 張）。", "Makes rugs (2 for 2), the Down Quilt and the Animal Blanket (3)."],
  ],

  // --- By-products ------------------------------------------------------------------------------
  whey: [
    ["乳酪壓模做乳酪時附帶的。", "Comes with every cheese from the Cheese Press."],
    ["可以喝。倒進飼槽算混合飼料（1 份算 2 份），所有動物都吃。", "Drinkable. Poured into a trough it counts as 2 units of mixed feed that every animal eats."],
    ["3 份在乳酪壓模壓成瑞可塔。", "3 in the Cheese Press make Ricotta."],
  ],
  food_waste: [
    ["從廚餘桶取出，每份食物換 1 個。", "Taken from a Food Scrap Bin, one per portion of food."],
    ["蔬菜類飼料，豬和兔會吃；也能做混合飼料。", "Vegetable feed for pigs and rabbits, and an ingredient of mixed feed."],
  ],
  truffle: [
    ["好感度 5 心的成年豬站在草地或灰壤上、4 格內有原木時，每天有 25% 機率拱出一顆。", "A five-heart adult pig on grass or podzol with a log within 4 blocks has a 25% chance a day to root one up."],
    ["松露炒蛋、松露焗烤生料的材料。", "Goes into Truffle Scrambled Eggs and the truffle gratin."],
  ],
  sausage_casing: [
    ["工作台：1 份洗淨的大腸做 2 份。", "Crafting table: 1 cleaned intestine makes 2."],
    ["絞肉機：任兩份絞肉加 1 份腸衣做 2 條生香腸。", "Meat Grinder: any 2 mince and 1 casing make 2 raw sausages."],
  ],
  goat_cashmere: [
    ["用毛刷刷山羊，有 30% 機率掉落。", "Brushing a goat has a 30% chance to give it."],
    ["紡車：2 份紡成 2 份絨線。", "Spinning Wheel: 2 spin into 2 fine yarn."],
  ],
  rabbit_fur: [
    ["用毛刷刷兔子，有 30% 機率掉落。", "Brushing a rabbit has a 30% chance to give it."],
    ["紡車：2 份紡成 2 份絨線。", "Spinning Wheel: 2 spin into 2 fine yarn."],
  ],
  eggshell: [
    ["受精蛋孵化後留下。", "Left behind when a fertilized egg hatches."],
    ["4 個在工作台磨成 1 份鈣粉。", "4 craft into 1 calcium powder."],
  ],
  calcium_powder: [
    ["工作台：4 個蛋殼。裝了漁歌時，絞肉機 2 份魚骨也能做 1 份。", "Crafting table: 4 eggshells. With Fishing Voyage, the Meat Grinder makes 1 from 2 fish bones."],
    ["加精飼料在飼料攪拌桶做 2 份鈣質飼料。", "With concentrate in the Feed Mixer it makes 2 calcium feed."],
  ],
  large_bone: [
    ["分切牛、水牛、氂牛、豬、羊、山羊屠體取得。", "Cut from cow, buffalo, yak, pig, sheep and goat carcasses."],
    ["大骨高湯、豬蹄湯、鴨血粉絲湯的材料。", "Goes into Bone Broth, Pork Trotter Soup and Duck Blood Vermicelli Soup."],
  ],
  chicken_frame: [
    ["分切雞屠體取得。", "Cut from a Chicken Carcass."],
    ["可代替大骨熬大骨高湯、鴨血粉絲湯；在工作台換 2 份骨粉。", "Stands in for a large bone in Bone Broth and Duck Blood Soup, or crafts into 2 bone meal."],
  ],
  raw_hide: [
    ["分切牛、水牛、氂牛屠體時剝下。", "Skinned from cow, buffalo and yak carcasses."],
    ["鞣皮架放 1 天變成皮革。樂牧取代了原版的牛，皮革主要從這裡來。", "A day on the Tanning Rack turns it into leather. Ranching replaces the vanilla cow, so leather comes from here."],
  ],
  sheep_skin: [
    ["分切羊、山羊屠體時剝下。", "Skinned from sheep and goat carcasses."],
    ["鞣皮架放 1 天，得 1 張皮革和 1 塊白色羊毛。", "A day on the Tanning Rack gives 1 leather and 1 white wool."],
  ],
  pig_skin: [
    ["分切豬屠體時剝下。", "Skinned from a Pig Carcass."],
    ["鞣皮架放 1 天變成皮革。", "A day on the Tanning Rack turns it into leather."],
  ],
  beef_tallow: [
    ["分切牛屠體取得。", "Cut from a Cow Carcass."],
    ["鞣皮架上加皮革做油鞣皮革；也能做肥皂，或加 1 條線做蠟燭。", "With leather on the Tanning Rack it makes oiled leather; also makes soap, or a candle with a string."],
  ],
  mutton_tallow: [
    ["分切羊屠體取得。", "Cut from a Sheep Carcass."],
    ["鞣皮架上加皮革做油鞣皮革；也能做肥皂，或加 1 條線做蠟燭。", "With leather on the Tanning Rack it makes oiled leather; also makes soap, or a candle with a string."],
  ],
  pork_fat: [
    ["分切豬屠體取得。", "Cut from a Pig Carcass."],
    ["放進熔爐煉成豬油。", "Render it into lard in a furnace."],
  ],
  lard: [
    ["豬板油放進熔爐煉成。", "Pork fat rendered in a furnace."],
    ["廚房炒鍋的用油：一份用 16 次，用完留下碗。所以不能堆疊。", "Cooking oil for Cookery's wok: 16 uses, then a bowl is left. That is why it does not stack."],
  ],
  cattle_horn: [
    ["分切公牛屠體或水牛屠體取得，一次 2 支。", "Cut from a bull's carcass or any buffalo carcass, 2 at a time."],
    ["做牧笛、角製掛飾或角杯；在工作台 2 根換 6 份骨粉。", "Makes a Herding Horn, a Horn Decoration or a Horn Cup, or two craft into 6 bone meal."],
  ],
  billy_goat_horn: [
    ["分切公山羊屠體取得，一次 2 支。", "Cut from a billy goat's carcass, 2 at a time."],
    ["做牧笛或角製掛飾；在工作台換成原版的山羊角。", "Makes a Herding Horn or a Horn Decoration, or crafts into a vanilla goat horn."],
  ],
  down: [
    ["分切鴨、鵝屠體取得；好感度 4 心以上的成年鴨、鵝每天也有 20% 機率掉一根。", "Cut from duck and goose carcasses; adult ducks and geese with four hearts also molt one a day at a 20% chance."],
    ["做羽絨枕（3 根）和羽絨被（4 根）；4 根換 1 塊白色羊毛。", "Makes the Down Pillow (3) and Down Quilt (4); 4 craft into a white wool."],
  ],
  yak_hair: [
    ["分切氂牛屠體時剝下，一具 2 到 3 份。", "Skinned from a Yak Carcass, 2 or 3 each."],
    ["紡車：2 份紡成 2 份毛線；在工作台 4 份換 1 塊棕色羊毛。", "Spinning Wheel: 2 spin into 2 yarn; 4 craft into a brown wool."],
  ],
  pig_bristle: [
    ["用毛刷刷豬，有 35% 機率掉落。", "Brushing a pig has a 35% chance to give one."],
    ["加 1 根木棍做毛刷。", "With a stick it makes a Brush."],
  ],
  manure_item: [
    ["動物每天約有一半機率在地上留下一坨糞便；用糞叉清理得到。", "Each animal leaves a pile on the ground about every other day; clear it with a Manure Fork."],
    ["畜欄裡的糞便太多，清潔需求就不滿足。4 份放進堆肥槽，加 1 份小麥發酵成肥料。", "Too many piles make the pen dirty. 4 in a Compost Bin with 1 wheat ferment into fertilizer."],
  ],
  dried_yak_dung: [
    ["氂牛的糞便留在地上超過一天，再用糞叉清理就是乾氂牛糞。", "Yak dung left over a day on the ground comes up dry when cleared with a Manure Fork."],
    ["是燃料，可以燒 30 秒，大約熔煉 3 個物品。", "A fuel that burns 30 seconds, about 3 items."],
  ],
  fertilizer: [
    ["堆肥槽：4 份糞便加 1 份小麥，發酵 1 個遊戲日得 4 份。", "Compost Bin: 4 manure and 1 wheat ferment for a game day into 4."],
    ["對作物使用，一次長 2 個階段；原版、廚房和樂牧的作物都可以。", "Use it on a crop to grow it two stages; works on vanilla, Cookery and Ranching crops."],
  ],

  // --- Dish preparations (crafting table) ---------------------------------------------------
  egg_custard: [
    ["工作台：1 顆蛋（雞蛋、鴨蛋或鵝蛋）、1 瓶任何奶、1 個碗。", "Crafting table: 1 egg (hen, duck or goose), 1 milk of any kind and a bowl."],
    ["放進廚房的蒸籠蒸成蒸蛋。", "Steams into Steamed Egg Custard in Cookery's steamer."],
  ],
  raw_cheese_gratin: [
    ["工作台：馬鈴薯、乳酪塊、鮮奶油、碗。", "Crafting table: potato, cheese slice, cream and a bowl."],
    ["放進熔爐或煙燻爐烤成乳酪焗烤。", "Bakes into Cheese Gratin in a furnace or smoker."],
  ],
  raw_shumai: [
    ["工作台：1 顆鵪鶉蛋、1 份豬絞肉、1 份生麵團（廚房）。", "Crafting table: 1 quail egg, 1 pork mince and 1 raw dough (Cookery)."],
    ["放進廚房的蒸籠蒸成鵪鶉蛋燒賣。", "Steam it in Cookery's steamer into Quail Egg Shumai."],
  ],
  raw_egg_tart: [
    ["工作台：卡士達醬加廚房的生麵團。", "Crafting table: custard and Cookery's raw dough."],
    ["放進熔爐或煙燻爐烤成蛋塔。", "Bakes into an Egg Tart in a furnace or smoker."],
  ],
  raw_pizza: [
    ["工作台：廚房的生麵團、番茄、莫札瑞拉。", "Crafting table: Cookery's raw dough, a tomato and mozzarella."],
    ["放進熔爐或煙燻爐烤成瑪格麗特披薩。", "Bakes into Margherita Pizza in a furnace or smoker."],
  ],
  seasoned_lamb_leg: [
    ["工作台：1 隻羊腿加 1 根廚房的紅辣椒。", "Crafting table: 1 lamb leg and 1 Cookery red chili."],
    ["放進熔爐或煙燻爐烤成孜然烤羊腿。", "Bakes into Spiced Roast Lamb Leg in a furnace or smoker."],
  ],
  raw_truffle_gratin: [
    ["工作台：松露、乳酪塊、馬鈴薯、碗。", "Crafting table: truffle, cheese slice, potato and a bowl."],
    ["放進熔爐或煙燻爐烤成松露乳酪焗烤。", "Bakes into Truffle Cheese Gratin in a furnace or smoker."],
  ],
};

// --- Lines written from tables ----------------------------------------------------------------

const range = ([min, max]) => (min === max ? `${min}` : `${min}–${max}`);
const PLACED = new Map(PLACED_FOODS.map((food) => [food.item, food]));

/** Carcass lines from data/butcher.js, so they follow the butchering table. */
function carcassLines(animal) {
  const [zh, en] = ANIMAL_NAME.get(animal.id);
  const cuts = BUTCHER_TABLE[animal.carcass]?.cuts ?? [];
  const named = (cut) => {
    const [cz, ce] = guideName(cut.item);
    const chance = cut.chance ? [`（${Math.round(cut.chance * 100)}% 機率）`, ` (${Math.round(cut.chance * 100)}% chance)`] : ["", ""];
    return [`${cz} ${range(cut.count)}${chance[0]}`, `${ce} ${range(cut.count)}${chance[1]}`];
  };
  const listed = cuts.filter((cut) => !cut.maleOnly && !cut.ifUnshorn).map(named);
  const lines = [
    animal.largeCarcass
      ? [`成年${zh}死亡時掉落，幼體不掉。不能堆疊，會記住公母。`, `Dropped by an adult ${en.toLowerCase()} when it dies (a baby drops nothing). It does not stack and remembers the animal's sex.`]
      : [`成年${zh}死亡時掉落，幼體不掉。最多疊 16 個。`, `Dropped by an adult ${en.toLowerCase()} when it dies (a baby drops nothing). Stacks to 16.`],
    [
      `掛上屠宰掛架，用菜刀、劍或斧依序切出：${listed.map((n) => n[0]).join("、")}。`,
      `Hang it on a Butcher Rack and cut it with a knife, sword or axe, in order: ${listed.map((n) => n[1]).join(", ")}.`,
    ],
  ];
  const bonus = animal.largeCarcass ? cuts.filter((cut) => cut.maleBonus).map((cut) => guideName(cut.item)) : [];
  const maleOnly = cuts.filter((cut) => cut.maleOnly).map((cut) => [named(cut), guideName(cut.item)]);
  if (bonus.length || maleOnly.length) {
    const zhParts = [];
    const enParts = [];
    if (bonus.length) {
      zhParts.push(`${bonus.map((n) => n[0]).join("、")}${bonus.length > 1 ? "各" : ""}多 1 份`);
      enParts.push(`one more ${enList(bonus.map((n) => n[1]))}`);
    }
    if (maleOnly.length) {
      zhParts.push(`另有${maleOnly.map(([n]) => n[0]).join("、")}`);
      enParts.push(maleOnly.map(([n]) => n[1]).join(", "));
    }
    lines.push([`公${zh}：${zhParts.join("，")}。`, `A male gives ${enParts.join(", plus ")}.`]);
  }
  if (cuts.some((cut) => cut.ifUnshorn)) lines.push(["沒剪過毛的羊，第一刀先切下 1 塊同色的羊毛。", "An unshorn sheep first gives one wool of its own color."]);
  return lines;
}

const DISH_STATION = {
  stockpot: ["在廚房的湯鍋煮", "Cook it in Cookery's stockpot"],
  wok: ["在廚房的炒鍋炒", "Cook it in Cookery's wok"],
  steamer: ["在廚房的蒸籠蒸", "Steam it in Cookery's steamer"],
};
const CARRIER = {
  "minecraft:bowl": ["拿碗盛出", "take it out with a bowl"],
  "minecraft:glass_bottle": ["拿玻璃瓶盛出", "take it out with a glass bottle"],
  "": ["空手取出", "take it out by hand"],
};
const RETURNS = {
  "minecraft:bowl": ["吃完還碗。", "The bowl comes back when you eat it."],
  "minecraft:glass_bottle": ["喝完留下玻璃瓶。", "The glass bottle comes back when you drink it."],
};

/** Dish lines from data/dishes.js and data/placedFoods.js. */
function dishLines(dish) {
  const lines = [];
  const back = RETURNS[dish.carrier] ?? ["", ""];
  if (DISH_STATION[dish.station]) {
    const [sz, se] = DISH_STATION[dish.station];
    const [cz, ce] = CARRIER[dish.carrier];
    const first = dish.station === "steamer" ? guideName(dish.input) : null;
    lines.push([
      `${first ? `${first[0]}放進廚房的蒸籠蒸` : sz}，${cz}。${back[0]}`,
      `${first ? `Steam the ${first[1]} in Cookery's steamer` : se}; ${ce}. ${back[1]}`.trim(),
    ]);
  } else if (dish.station === "furnace") {
    const [iz, ie] = guideName(dish.input);
    lines.push([`把${iz}放進熔爐或煙燻爐烤熟。${back[0]}`, `Bake the ${ie} in a furnace or smoker. ${back[1]}`.trim()]);
  } else {
    lines.push([`在工作台合成。${back[0]}`, `Made on a crafting table. ${back[1]}`.trim()]);
  }
  const swaps = [...new Map((dish.slots ?? []).filter((slot) => slot.length > 1).map((slot) => [slot.join(), slot])).values()];
  if (swaps.length) {
    const parts = swaps.map((slot) => {
      const [head, ...rest] = slot.map(guideName);
      return [`${head[0]}可換成${zhOr(rest.map((n) => n[0]))}`, `${head[1]} can be ${enOr(rest.map((n) => n[1]))}`];
    });
    lines.push([`${parts.map((p) => p[0]).join("；")}。`, `${parts.map((p) => p[1]).join("; ")}.`]);
  }
  return lines;
}

const CONTAINER = {
  "minecraft:bowl": ["碗", "bowl"],
  "minecraft:glass_bottle": ["玻璃瓶", "glass bottle"],
  "kaleidoscope_ranching:horn_cup": ["角杯", "horn cup"],
  // 1.1 追加: the roast turkey leaves its bones
  "kaleidoscope_ranching:large_bone": ["大骨", "large bone"],
};

/** The line for food that can be set down and eaten in place (data/placedFoods.js), or null. */
function placedLine(placed) {
  if (!placed?.eat) return null;
  const [cz, ce] = placed.gives ? CONTAINER[placed.gives] : ["", ""];
  if (placed.portions === 1) {
    // One serving in its own cup or crock, taken in one go.
    const [vz, ve] = placed.drink ? ["一口喝完", "drink it in one go"] : ["一次吃完", "eat it in one go"];
    return [
      `對著方塊使用會放在地上，再對它使用就${vz}${cz ? `，留下${cz}` : ""}。`,
      `Use it on a block to set it down, then use it to ${ve}${ce ? `; the ${ce} is left` : ""}.`,
    ];
  }
  return [
    `對著方塊使用會放在地上，分 ${placed.portions} 份，每份 ${placed.eat} 點飢餓值，誰都能吃${cz ? `；吃完最後一份還${cz}` : ""}。對空中使用則直接吃。`,
    `Use it on a block to set it down: ${placed.portions} portions of ${placed.eat} hunger anyone can eat${ce ? `, the ${ce} back with the last` : ""}. Use it in the air to eat it whole.`,
  ];
}

/**
 * What every keeper must know, the same for each animal apart from the cold:
 * affection (data/care_config.js CARE) and sleep (systems/sleep.js, data/gear.js).
 */
function keeperLines(animal) {
  const blanket = GEAR.find((gear) => gear.id === "blanket").animals.includes(animal.id);
  const cold =
    animal.id === "yak"
      ? ["牠不怕冷。", "Yaks never feel the cold."]
      : blanket
        ? ["披上動物披毯就不會受寒。", "An Animal Blanket keeps the cold off."]
        : ["", ""];
  return [
    [
      "好感度：四項需求都滿足的隔天 +1 心，最愛的零食每天 +½ 心，鹽磚範圍內每天 +¼ 心；受傷 −½ 心，連續 2 天沒吃到飼料 −1 心。",
      "Affection: +1 heart the day after all four needs are met, +½ for its favorite treat once a day, +¼ near a salt lick; −½ when hurt, −1 after two days unfed.",
    ],
    [
      `晚上會睡覺。入睡時頭上 8 格內有遮蔽、4 格內有乾草架或地毯，好感度 +4 點（20 點 = 1 心）；露天又靠近雪或冰會受寒，−4 點。${cold[0]}`,
      `It sleeps at night. Falling asleep with a roof within 8 blocks and a hay rack or rug within 4: +4 affection points (20 = a heart); in the open near snow or ice it gets cold: −4. ${cold[1]}`.trim(),
    ],
    [
      "受傷、被牽、10 格內有敵對生物、被推擠、搖牧鈴、吹牧笛、沒戴皮手套擠奶都會吵醒牠；走近、撫摸、用奶瓶餵不會。被拴住的動物不睡覺。",
      "Being hurt, put on a lead, a hostile mob within 10 blocks, being pushed, a cowbell, a herding horn or milking without gloves wakes it; walking up, petting and bottle-feeding do not. Tied animals do not sleep.",
    ],
  ];
}

// --- Entries ------------------------------------------------------------------------------------

const GROUP_OF = new Map(CATALOG_GROUPS.flatMap((group) => group.from.map((from) => [from, group.id])));
const SUB_BY = (key) => new Map(GUIDE_CATEGORIES.filter((c) => c[key]).flatMap((c) => c[key].map((value) => [value, c.id])));
const SUB_ITEM = SUB_BY("items");
const SUB_BLOCK = SUB_BY("blocks");
const SUB_STATION = SUB_BY("stations");
const DISH_BY_ID = new Map(DISHES.map((dish) => [dish.id, dish]));

function itemCategory(item) {
  if (item.category === "dish") return SUB_STATION.get(DISH_BY_ID.get(item.id).station);
  if (item.category === "prep") return SUB_STATION.get("prep");
  return SUB_ITEM.get(item.category) ?? GROUP_OF.get(item.category);
}

const pairsToLocales = (pairs) => {
  const zh = pairs.map(([z]) => z);
  return { en_US: pairs.map(([, e]) => e), zh_TW: zh, zh_CN: zh.map(toSimplified) };
};

function handWritten(id) {
  const pairs = GUIDE_TEXT[id];
  if (!pairs) throw new Error(`guidebook: no lines for ${id} (add them to GUIDE_TEXT in data/guidebook.js)`);
  return pairs;
}

/**
 * Every entry of the chapter, in order: animals, items (registry order), blocks.
 * { id, kind: "animal" | "item" | "block", category, categories, icon, lines: { en_US, zh_TW, zh_CN }, dish?, placeable }
 */
export function guideEntries() {
  const entries = [];
  const add = (id, kind, category, icon, pairs, extra = {}) =>
    entries.push({ id, kind, category, categories: [category, ...(GUIDE_ALSO[id] ?? [])], icon: iconPath(icon), lines: pairsToLocales(pairs), ...extra });

  for (const animal of ANIMALS) add(animal.id, "animal", "animals", ANIMAL_ICONS[animal.id], [...handWritten(animal.id), ...keeperLines(animal)]);
  for (const item of ITEMS) {
    const category = itemCategory(item);
    if (!category) throw new Error(`guidebook: no category for item ${item.id} (${item.category})`);
    const dish = DISH_BY_ID.get(item.id);
    const animal = ANIMALS.find((a) => a.carcass === item.id);
    const placed = placedLine(PLACED.get(item.id));
    const pairs = [...(dish ? dishLines(dish) : animal ? carcassLines(animal) : handWritten(item.id)), ...(placed ? [placed] : [])];
    add(item.id, "item", category, item.id, pairs, { dish, placeable: PLACED.has(item.id) });
  }
  for (const block of BLOCKS) {
    if (GUIDE_SKIP[block.id] || ITEM_BY_ID.has(block.id)) continue;
    const category = SUB_BLOCK.get(block.group);
    if (!category) throw new Error(`guidebook: no category for block ${block.id} (${block.group})`);
    add(block.id, "block", category, BLOCK_ICONS[block.id] ? block.id : GUIDE_CATEGORIES.find((c) => c.id === category).icon, handWritten(block.id));
  }
  return entries;
}

/** Category rows with zh_CN labels and icon paths. */
export function guideCategories() {
  return GUIDE_CATEGORIES.map(({ id, parent, zh, en, icon }) => ({ id, parent, labels: { en_US: en, zh_TW: zh, zh_CN: toSimplified(zh) }, icon: iconPath(icon) }));
}
