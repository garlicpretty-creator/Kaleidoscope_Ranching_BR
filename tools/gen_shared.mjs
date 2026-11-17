// Builds the files every milestone contributes to, so no generator ever
// overwrites another's entries:
//
//   packs/{BP,RP}/texts/*.lang          names and messages
//   packs/RP/textures/item_texture.json item icon atlas
//   packs/RP/textures/terrain_texture.json block texture atlas
//   packs/RP/blocks.json                block sounds
//
// Sources:
//   - the registries in packs/BP/scripts/data/ (items and blocks whose owner is
//     not "m2", animal names) plus the static strings below;
//   - every fragment folder under tools/fragments/<milestone>/, written by that
//     milestone's own generator: texts/<lang>.lang, item_texture.json,
//     terrain_texture.json, blocks.json.
//
// A key defined twice is an error, so two milestones cannot silently fight
// over one name. Run with: node tools/gen_shared.mjs

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const load = (name) => import(pathToFileURL(join(root, "packs", "BP", "scripts", "data", name)).href);
const { ITEMS, NAMESPACE, ANIMAL_NAMES } = await load("items.js");
const { BLOCKS } = await load("blocks.js");
const { toSimplified } = await load("zh_cn.js");

const LANGUAGES = ["en_US", "zh_TW", "zh_CN"];
const fragmentsDir = join(root, "tools", "fragments");
const fragments = existsSync(fragmentsDir)
  ? readdirSync(fragmentsDir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort()
  : [];

const errors = [];

// --- Language files -------------------------------------------------------

// Strings that do not come from a registry. Registry names in zh_CN are made
// from the zh_TW names by data/zh_cn.js.
const STATIC = {
  en_US: {
    "pack.name": "Kaleidoscope Ranching",
    "pack.description": "Unofficial Kaleidoscope add-on: raise animals that reward good care. Requires Kaleidoscope Cookery.",
    [`${NAMESPACE}.ui.pack_bag.title`]: "Pack Bag",
    [`${NAMESPACE}.ui.pack_bag.body`]: "Pick a stack to take it out.",
    [`${NAMESPACE}.ui.pack_bag.empty`]: "The bag is empty. Sneak and use an item on the animal to store it.",
    [`${NAMESPACE}.ui.pack_bag.take_off`]: "Take the pack bag off",
    [`${NAMESPACE}.ui.observe.who`]: "%s · %s · %s",
    [`${NAMESPACE}.ui.observe.age.baby`]: "young",
    [`${NAMESPACE}.ui.observe.age.adult`]: "adult",
    [`${NAMESPACE}.ui.observe.hearts`]: "Affection %s (%s/%s)",
    [`${NAMESPACE}.ui.observe.section.today`]: "Today",
    [`${NAMESPACE}.ui.observe.needs.all`]: "§aAll cared for today: affection rises tonight.§r",
    [`${NAMESPACE}.ui.observe.needs.some`]: "§6Not all cared for yet today.§r",
    [`${NAMESPACE}.ui.observe.section.health`]: "Health",
    [`${NAMESPACE}.ui.observe.health.well`]: "§aHealthy.§r",
    [`${NAMESPACE}.ui.observe.health.sick`]: "§cSick: gives nothing and will not breed. Cure it with veterinary medicine.§r",
    [`${NAMESPACE}.ui.observe.health.risk_thirst`]: "§6No water for two days: it may fall ill.§r",
    [`${NAMESPACE}.ui.observe.health.risk_dirt`]: "§6Not cleaned for two days: it may fall ill. Soap helps.§r",
    [`${NAMESPACE}.ui.observe.section.rest`]: "Rest",
    [`${NAMESPACE}.ui.observe.rest.asleep`]: "Asleep.",
    [`${NAMESPACE}.ui.observe.rest.awake`]: "Awake.",
    [`${NAMESPACE}.ui.observe.rest.night_slept_well`]: "§aSlept well last night (shelter and bedding nearby).§r",
    [`${NAMESPACE}.ui.observe.rest.night_cold`]: "§cWas cold last night: no shelter in the snow.§r",
    [`${NAMESPACE}.ui.observe.rest.night_plain`]: "Slept an ordinary night.",
    [`${NAMESPACE}.ui.observe.rest.sheltered`]: "Has a roof over it.",
    [`${NAMESPACE}.ui.observe.rest.open_sky`]: "Under the open sky.",
    [`${NAMESPACE}.ui.observe.rest.blanket`]: "Wears an animal blanket.",
    [`${NAMESPACE}.ui.observe.section.produce`]: "Produce",
    [`${NAMESPACE}.ui.observe.produce.milked`]: "Already milked today.",
    [`${NAMESPACE}.ui.observe.produce.milk_ready`]: "§aReady to milk today.§r",
    [`${NAMESPACE}.ui.observe.produce.no_milk`]: "§6No milk today: not cared for or sick.§r",
    [`${NAMESPACE}.ui.observe.produce.lays`]: "§aWill lay in a nest box today.§r",
    [`${NAMESPACE}.ui.observe.produce.no_eggs`]: "§6Will not lay today: not cared for or sick.§r",
    [`${NAMESPACE}.ui.observe.produce.moults`]: "Happy enough to molt down.",
    [`${NAMESPACE}.ui.observe.produce.moult_shy`]: "Molts down at %s hearts or more.",
    [`${NAMESPACE}.ui.observe.produce.forages`]: "Happy enough to root for truffles in a forest.",
    [`${NAMESPACE}.ui.observe.produce.forage_shy`]: "Roots for truffles at %s hearts.",
    [`${NAMESPACE}.ui.observe.section.family`]: "Family",
    [`${NAMESPACE}.ui.observe.family.nursed`]: "Bottle-fed %s of %s times to grow up.",
    [`${NAMESPACE}.ui.observe.family.growing`]: "Still growing.",
    [`${NAMESPACE}.ui.observe.family.pregnant`]: "§dExpecting: about %s day(s) to go.§r",
    [`${NAMESPACE}.ui.observe.family.resting`]: "Resting after mating.",
    [`${NAMESPACE}.ui.observe.family.ready`]: "§aReady to breed.§r",
    [`${NAMESPACE}.ui.observe.family.not_ready`]: "Will not breed today: care for it first.",
    [`${NAMESPACE}.ui.observe.section.gear`]: "Gear",
    [`${NAMESPACE}.ui.observe.gear.harness`]: "Harnessed.",
    [`${NAMESPACE}.ui.observe.gear.plough`]: "Harnessed and pulling a plow.",
    [`${NAMESPACE}.ui.observe.gear.pack_bag`]: "Pack bag: %s of %s slots used.",
  },
  zh_TW: {
    "pack.name": "森羅物語：樂牧",
    "pack.description": "非官方的森羅物語擴充：飼養會回報細心照顧的動物。需要《森羅物語：廚房》。",
    [`${NAMESPACE}.ui.pack_bag.title`]: "馱袋",
    [`${NAMESPACE}.ui.pack_bag.body`]: "選一組物品取出。",
    [`${NAMESPACE}.ui.pack_bag.empty`]: "馱袋是空的。蹲下對動物使用物品可以放進去。",
    [`${NAMESPACE}.ui.pack_bag.take_off`]: "取下馱袋",
    [`${NAMESPACE}.ui.observe.who`]: "%s・%s・%s",
    [`${NAMESPACE}.ui.observe.age.baby`]: "幼崽",
    [`${NAMESPACE}.ui.observe.age.adult`]: "成年",
    [`${NAMESPACE}.ui.observe.hearts`]: "好感度 %s（%s/%s）",
    [`${NAMESPACE}.ui.observe.section.today`]: "今天",
    [`${NAMESPACE}.ui.observe.needs.all`]: "§a今天都照顧好了，今晚好感度會上升。§r",
    [`${NAMESPACE}.ui.observe.needs.some`]: "§6今天還沒照顧齊全。§r",
    [`${NAMESPACE}.ui.observe.section.health`]: "健康",
    [`${NAMESPACE}.ui.observe.health.well`]: "§a健康。§r",
    [`${NAMESPACE}.ui.observe.health.sick`]: "§c生病了：停產、不繁殖，用獸藥治療。§r",
    [`${NAMESPACE}.ui.observe.health.risk_thirst`]: "§6兩天沒喝水，可能會生病。§r",
    [`${NAMESPACE}.ui.observe.health.risk_dirt`]: "§6兩天沒清理，可能會生病；可以用肥皂。§r",
    [`${NAMESPACE}.ui.observe.section.rest`]: "作息",
    [`${NAMESPACE}.ui.observe.rest.asleep`]: "睡著了。",
    [`${NAMESPACE}.ui.observe.rest.awake`]: "醒著。",
    [`${NAMESPACE}.ui.observe.rest.night_slept_well`]: "§a昨晚睡得好（有遮蔽，附近有乾草架或地毯）。§r",
    [`${NAMESPACE}.ui.observe.rest.night_cold`]: "§c昨晚受凍了：在雪地露宿。§r",
    [`${NAMESPACE}.ui.observe.rest.night_plain`]: "昨晚睡得普通。",
    [`${NAMESPACE}.ui.observe.rest.sheltered`]: "頭上有遮蔽。",
    [`${NAMESPACE}.ui.observe.rest.open_sky`]: "在露天的地方。",
    [`${NAMESPACE}.ui.observe.rest.blanket`]: "披著動物披毯。",
    [`${NAMESPACE}.ui.observe.section.produce`]: "產出",
    [`${NAMESPACE}.ui.observe.produce.milked`]: "今天擠過奶了。",
    [`${NAMESPACE}.ui.observe.produce.milk_ready`]: "§a今天可以擠奶。§r",
    [`${NAMESPACE}.ui.observe.produce.no_milk`]: "§6今天不產奶：照顧不足或生病。§r",
    [`${NAMESPACE}.ui.observe.produce.lays`]: "§a今天會在巢箱下蛋。§r",
    [`${NAMESPACE}.ui.observe.produce.no_eggs`]: "§6今天不下蛋：照顧不足或生病。§r",
    [`${NAMESPACE}.ui.observe.produce.moults`]: "心情好，會掉羽絨。",
    [`${NAMESPACE}.ui.observe.produce.moult_shy`]: "好感度 %s 心以上才會掉羽絨。",
    [`${NAMESPACE}.ui.observe.produce.forages`]: "心情好，在森林裡會拱松露。",
    [`${NAMESPACE}.ui.observe.produce.forage_shy`]: "好感度 %s 心才會拱松露。",
    [`${NAMESPACE}.ui.observe.section.family`]: "繁殖",
    [`${NAMESPACE}.ui.observe.family.nursed`]: "奶瓶餵了 %s／%s 次，餵滿就長大。",
    [`${NAMESPACE}.ui.observe.family.growing`]: "還在長大。",
    [`${NAMESPACE}.ui.observe.family.pregnant`]: "§d懷孕中，大約還有 %s 天。§r",
    [`${NAMESPACE}.ui.observe.family.resting`]: "剛繁殖過，正在休息。",
    [`${NAMESPACE}.ui.observe.family.ready`]: "§a可以繁殖。§r",
    [`${NAMESPACE}.ui.observe.family.not_ready`]: "今天不肯繁殖：先把牠照顧好。",
    [`${NAMESPACE}.ui.observe.section.gear`]: "裝備",
    [`${NAMESPACE}.ui.observe.gear.harness`]: "裝著挽具。",
    [`${NAMESPACE}.ui.observe.gear.plough`]: "裝著挽具，拉著犁。",
    [`${NAMESPACE}.ui.observe.gear.pack_bag`]: "馱袋：用了 %s／%s 格。",
  },
  zh_CN: {
    "pack.name": "森罗物语：乐牧",
    "pack.description": "非官方的森罗物语扩展：饲养会回报细心照顾的动物。需要《森罗物语：厨房》。",
    [`${NAMESPACE}.ui.pack_bag.title`]: "驮袋",
    [`${NAMESPACE}.ui.pack_bag.body`]: "选一组物品取出。",
    [`${NAMESPACE}.ui.pack_bag.empty`]: "驮袋是空的。蹲下对动物使用物品可以放进去。",
    [`${NAMESPACE}.ui.pack_bag.take_off`]: "取下驮袋",
    [`${NAMESPACE}.ui.observe.who`]: "%s・%s・%s",
    [`${NAMESPACE}.ui.observe.age.baby`]: "幼崽",
    [`${NAMESPACE}.ui.observe.age.adult`]: "成年",
    [`${NAMESPACE}.ui.observe.hearts`]: "好感度 %s（%s/%s）",
    [`${NAMESPACE}.ui.observe.section.today`]: "今天",
    [`${NAMESPACE}.ui.observe.needs.all`]: "§a今天都照顾好了，今晚好感度会上升。§r",
    [`${NAMESPACE}.ui.observe.needs.some`]: "§6今天还没照顾齐全。§r",
    [`${NAMESPACE}.ui.observe.section.health`]: "健康",
    [`${NAMESPACE}.ui.observe.health.well`]: "§a健康。§r",
    [`${NAMESPACE}.ui.observe.health.sick`]: "§c生病了：停产、不繁殖，用兽药治疗。§r",
    [`${NAMESPACE}.ui.observe.health.risk_thirst`]: "§6两天没喝水，可能会生病。§r",
    [`${NAMESPACE}.ui.observe.health.risk_dirt`]: "§6两天没清理，可能会生病；可以用肥皂。§r",
    [`${NAMESPACE}.ui.observe.section.rest`]: "作息",
    [`${NAMESPACE}.ui.observe.rest.asleep`]: "睡着了。",
    [`${NAMESPACE}.ui.observe.rest.awake`]: "醒着。",
    [`${NAMESPACE}.ui.observe.rest.night_slept_well`]: "§a昨晚睡得好（有遮蔽，附近有干草架或地毯）。§r",
    [`${NAMESPACE}.ui.observe.rest.night_cold`]: "§c昨晚受冻了：在雪地露宿。§r",
    [`${NAMESPACE}.ui.observe.rest.night_plain`]: "昨晚睡得普通。",
    [`${NAMESPACE}.ui.observe.rest.sheltered`]: "头上有遮蔽。",
    [`${NAMESPACE}.ui.observe.rest.open_sky`]: "在露天的地方。",
    [`${NAMESPACE}.ui.observe.rest.blanket`]: "披着动物披毯。",
    [`${NAMESPACE}.ui.observe.section.produce`]: "产出",
    [`${NAMESPACE}.ui.observe.produce.milked`]: "今天挤过奶了。",
    [`${NAMESPACE}.ui.observe.produce.milk_ready`]: "§a今天可以挤奶。§r",
    [`${NAMESPACE}.ui.observe.produce.no_milk`]: "§6今天不产奶：照顾不足或生病。§r",
    [`${NAMESPACE}.ui.observe.produce.lays`]: "§a今天会在巢箱下蛋。§r",
    [`${NAMESPACE}.ui.observe.produce.no_eggs`]: "§6今天不下蛋：照顾不足或生病。§r",
    [`${NAMESPACE}.ui.observe.produce.moults`]: "心情好，会掉羽绒。",
    [`${NAMESPACE}.ui.observe.produce.moult_shy`]: "好感度 %s 心以上才会掉羽绒。",
    [`${NAMESPACE}.ui.observe.produce.forages`]: "心情好，在森林里会拱松露。",
    [`${NAMESPACE}.ui.observe.produce.forage_shy`]: "好感度 %s 心才会拱松露。",
    [`${NAMESPACE}.ui.observe.section.family`]: "繁殖",
    [`${NAMESPACE}.ui.observe.family.nursed`]: "奶瓶喂了 %s／%s 次，喂满就长大。",
    [`${NAMESPACE}.ui.observe.family.growing`]: "还在长大。",
    [`${NAMESPACE}.ui.observe.family.pregnant`]: "§d怀孕中，大约还有 %s 天。§r",
    [`${NAMESPACE}.ui.observe.family.resting`]: "刚繁殖过，正在休息。",
    [`${NAMESPACE}.ui.observe.family.ready`]: "§a可以繁殖。§r",
    [`${NAMESPACE}.ui.observe.family.not_ready`]: "今天不肯繁殖：先把它照顾好。",
    [`${NAMESPACE}.ui.observe.section.gear`]: "装备",
    [`${NAMESPACE}.ui.observe.gear.harness`]: "装着挽具。",
    [`${NAMESPACE}.ui.observe.gear.plough`]: "装着挽具，拉着犁。",
    [`${NAMESPACE}.ui.observe.gear.pack_bag`]: "驮袋：用了 %s／%s 格。",
  },
};

function registryEntries(language) {
  const column = language === "en_US" ? "en" : "zh";
  const eggWord = { en_US: " Spawn Egg", zh_TW: "生怪蛋", zh_CN: "刷怪蛋" }[language];
  const localize = language === "zh_CN" ? toSimplified : (text) => text;
  const entries = Object.entries(STATIC[language]);
  for (const [id, zh, en] of ANIMAL_NAMES) {
    const name = column === "en" ? en : localize(zh);
    entries.push([`entity.${NAMESPACE}:${id}.name`, name]);
    entries.push([`item.spawn_egg.entity.${NAMESPACE}:${id}.name`, name + eggWord]);
  }
  for (const item of ITEMS) if (item.owner !== "m2") entries.push([`item.${NAMESPACE}:${item.id}.name`, localize(item[column])]);
  for (const block of BLOCKS) if (block.owner !== "m2") entries.push([`tile.${NAMESPACE}:${block.id}.name`, localize(block[column])]);
  return entries;
}

function parseLang(text) {
  return text
    .split(/\r?\n/)
    .filter((line) => line.trim() && !line.startsWith("#"))
    .map((line) => {
      const at = line.indexOf("=");
      return [line.slice(0, at), line.slice(at + 1)];
    });
}

// --- Tooltip lines under item and block names --------------------------------

// ## Like Cookery: under every Ranching item or block name, the add-on's name in
// ## blue, and for food or drink that places a block, "placeable food/drink" in purple. Bedrock
// ## shows the name's \n as a new line in the tooltip.
const TOOLTIP = {
  mod: { en_US: "Kaleidoscope Ranching", zh_TW: "森羅物語樂牧", zh_CN: "森罗物语乐牧" },
  food: { en_US: "Placeable food", zh_TW: "可放置的食物", zh_CN: "可放置的食物" },
  drink: { en_US: "Placeable drink", zh_TW: "可放置的飲品", zh_CN: "可放置的饮品" },
};

// Registry categories that are food even when not eaten as they are (the cheese wheel is cut first).
const FOOD_CATEGORIES = new Set(["dairy", "dish", "prep", "meat", "cut", "mince", "cured", "offal", "egg", "preserved"]);
const CATEGORY = new Map(ITEMS.map((item) => [`${NAMESPACE}:${item.id}`, item.category]));

/** {item id: "food" | "drink"} for food and drink that place a block (minecraft:block_placer). Nothing else is labelled. */
function placeableItems() {
  const out = {};
  const dir = join(root, "packs", "BP", "items");
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".json"))) {
    const item = JSON.parse(readFileSync(join(dir, file), "utf8"))["minecraft:item"];
    const components = item?.components ?? {};
    if (!components["minecraft:block_placer"]) continue;
    const id = item.description.identifier;
    const category = CATEGORY.get(id);
    if (components["minecraft:use_animation"] === "drink" || category === "milk") out[id] = "drink";
    else if (components["minecraft:food"] || FOOD_CATEGORIES.has(category)) out[id] = "food";
  }
  return out;
}
const PLACEABLE = placeableItems();

function withTooltip(key, value, language) {
  const match = /^(item|tile)\.(kaleidoscope_ranching:[a-z0-9_]+)\.name$/.exec(key);
  if (!match) return value;
  let text = `${value}\\n§9§o${TOOLTIP.mod[language]}§r`;
  const placeable = match[1] === "item" && PLACEABLE[match[2]];
  if (placeable) text += `\\n§d${TOOLTIP[placeable][language]}§r`;
  return text;
}

for (const language of LANGUAGES) {
  const sections = [["registries", registryEntries(language)]];
  for (const name of fragments) {
    const path = join(fragmentsDir, name, "texts", `${language}.lang`);
    if (existsSync(path)) sections.push([name, parseLang(readFileSync(path, "utf8"))]);
  }
  const seen = new Map();
  const lines = [];
  for (const [source, entries] of sections) {
    lines.push(`## ${source}`);
    for (const [key, value] of entries) {
      if (seen.has(key)) errors.push(`${language}: "${key}" defined by both ${seen.get(key)} and ${source}`);
      seen.set(key, source);
      lines.push(`${key}=${withTooltip(key, value, language)}`);
    }
    lines.push("");
  }
  for (const pack of ["BP", "RP"]) {
    const dir = join(root, "packs", pack, "texts");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "languages.json"), JSON.stringify(LANGUAGES, null, 2) + "\n");
    writeFileSync(join(dir, `${language}.lang`), lines.join("\n"));
  }
}

// --- Atlases and block sounds ----------------------------------------------

function mergeJson(file, base, pick) {
  const merged = { ...base };
  const target = pick(merged);
  const owner = new Map();
  for (const name of fragments) {
    const path = join(fragmentsDir, name, file);
    if (!existsSync(path)) continue;
    for (const [key, value] of Object.entries(pick(JSON.parse(readFileSync(path, "utf8"))))) {
      if (key === "format_version") continue;
      if (owner.has(key)) errors.push(`${file}: "${key}" defined by both ${owner.get(key)} and ${name}`);
      owner.set(key, name);
      target[key] = value;
    }
  }
  return merged;
}

const textures = join(root, "packs", "RP", "textures");
mkdirSync(textures, { recursive: true });
const itemAtlas = mergeJson("item_texture.json", { resource_pack_name: NAMESPACE, texture_name: "atlas.items", texture_data: {} }, (d) => d.texture_data);
const terrainAtlas = mergeJson(
  "terrain_texture.json",
  { resource_pack_name: NAMESPACE, texture_name: "atlas.terrain", padding: 8, num_mip_levels: 4, texture_data: {} },
  (d) => d.texture_data
);
const blockSounds = mergeJson("blocks.json", { format_version: "1.21.40" }, (d) => d);

if (errors.length) {
  console.error(`gen_shared: ${errors.length} conflict(s)`);
  for (const message of errors) console.error("  - " + message);
  process.exit(1);
}

writeFileSync(join(textures, "item_texture.json"), JSON.stringify(itemAtlas, null, 2) + "\n");
writeFileSync(join(textures, "terrain_texture.json"), JSON.stringify(terrainAtlas, null, 2) + "\n");
writeFileSync(join(root, "packs", "RP", "blocks.json"), JSON.stringify(blockSounds, null, 2) + "\n");

console.log(
  `gen_shared: ${LANGUAGES.length} languages, ${Object.keys(itemAtlas.texture_data).length} item textures, ` +
    `${Object.keys(terrainAtlas.texture_data).length} block textures, fragments: ${fragments.join(", ") || "none"}`
);
