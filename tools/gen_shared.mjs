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
    [`${NAMESPACE}.message.breed.same_sex`]: "Breeding needs one male and one female.",
    [`${NAMESPACE}.message.breed.pregnant`]: "She is already expecting.",
    [`${NAMESPACE}.message.breed.resting`]: "This animal bred recently and needs to rest.",
    [`${NAMESPACE}.message.breed.not_cared`]: "This animal has not been cared for today and will not breed.",
    [`${NAMESPACE}.message.rack.empty`]: "Hang a carcass on the rack, or something to air-dry.",
    [`${NAMESPACE}.message.rack.occupied`]: "A carcass is already hanging here.",
    [`${NAMESPACE}.message.rack.need_blade`]: "Cut it with a kitchen knife, a sword or an axe.",
    [`${NAMESPACE}.message.lasso.missed`]: "No animal in reach of the lasso.",
    [`${NAMESPACE}.message.candler.none`]: "No eggs are hatching here.",
    [`${NAMESPACE}.message.candler.status`]: "%s egg(s) hatching: the next in about %s minute(s).",
    [`${NAMESPACE}.message.candler.paused`]: "%s egg(s), paused: the incubator needs heat (next in about %s minute(s) once warm).",
    [`${NAMESPACE}.message.milking_rack.tied`]: "Tied to the milking rack. Put empty bottles in a container above; the milk goes to the one below.",
    [`${NAMESPACE}.message.milking_rack.untied`]: "Untied from the milking rack.",
    [`${NAMESPACE}.message.milking_rack.occupied`]: "An animal is already on this milking rack.",
    [`${NAMESPACE}.message.milking_rack.not_milkable`]: "Only an adult cow, goat, buffalo or yak can go on the milking rack.",
    [`${NAMESPACE}.message.milking_rack.empty`]: "Lead a milkable animal here to tie her to the rack.",
    [`${NAMESPACE}.message.rack.drying_hung`]: "Hung up to dry (%s/%s). Take it down in 3 days.",
    [`${NAMESPACE}.message.rack.drying_full`]: "The rack is full: it dries %s pieces at a time.",
    [`${NAMESPACE}.message.rack.drying_left`]: "%s piece(s) still drying: the next is done in about %s minute(s).",
    [`${NAMESPACE}.message.rack.drying_busy`]: "Take down what is drying before hanging a carcass.",
    [`${NAMESPACE}.message.wash.done`]: "Washed. Water trough: %s/%s.",
    [`${NAMESPACE}.message.wash.no_water`]: "The water trough is empty. Fill it with a water bucket first.",
    [`${NAMESPACE}.message.food_waste_bin.added`]: "Scraps in the bin: %s / %s",
    [`${NAMESPACE}.message.food_waste_bin.full`]: "The bin is full. Take the scraps out first.",
    [`${NAMESPACE}.message.food_waste_bin.empty`]: "Put leftover food in to make scraps for pigs and rabbits.",
    [`${NAMESPACE}.message.milking.not_female`]: "Only adult females can be milked.",
    [`${NAMESPACE}.message.milking.milked_today`]: "Already milked today.",
    [`${NAMESPACE}.message.milking.no_milk`]: "No milk today.",
    [`${NAMESPACE}.message.milking.need_bottle`]: "You need an empty glass bottle.",
    [`${NAMESPACE}.message.nursing.need_milk`]: "You need a bottle of milk.",
    [`${NAMESPACE}.message.nursing.grew`]: "It has grown up!",
    [`${NAMESPACE}.message.nest.full`]: "The nest is already brooding four eggs.",
    [`${NAMESPACE}.message.nest.empty`]: "No eggs yet.",
    [`${NAMESPACE}.message.incubator.full`]: "The incubator is full.",
    [`${NAMESPACE}.message.incubator.empty`]: "The incubator is empty.",
    [`${NAMESPACE}.message.incubator.cold`]: "The incubator needs a heat source next to it.",
    [`${NAMESPACE}.message.station.empty`]: "Hold an ingredient to start.",
    [`${NAMESPACE}.message.station.wrong_item`]: "This station cannot use that.",
    [`${NAMESPACE}.message.station.missing`]: "You are missing some ingredients.",
    [`${NAMESPACE}.message.station.working`]: "Still working: about %s more minute(s).",
    [`${NAMESPACE}.message.hay_rack.status`]: "Hay rack: %s/%s units of hay.",
    [`${NAMESPACE}.message.hay_rack.only_grass`]: "The hay rack only takes hay, wheat, forage and alfalfa.",
    [`${NAMESPACE}.message.hay_rack.full`]: "The hay rack is full.",
    [`${NAMESPACE}.message.crate.leashed`]: "Take the lead off before crating it.",
    [`${NAMESPACE}.message.crate.ridden`]: "Someone is riding it.",
    [`${NAMESPACE}.message.crate.no_room`]: "No room to let it out here.",
    [`${NAMESPACE}.message.crate.missing`]: "The add-on that adds %s is not loaded.",
    [`${NAMESPACE}.message.hitching_post.tied`]: "Tied %s animal(s) to the post.",
    [`${NAMESPACE}.message.hitching_post.untied`]: "Took %s animal(s) off the post.",
    [`${NAMESPACE}.message.hitching_post.empty`]: "Lead animals here to tie them to the post.",
    [`${NAMESPACE}.message.cowbell.called`]: "%s animal(s) answer the bell.",
    [`${NAMESPACE}.message.cowbell.nobody`]: "No animal that trusts you (3 hearts) is in earshot.",
    [`${NAMESPACE}.message.cookery_missing`]: "§e[Kaleidoscope Ranching]§r Kaleidoscope Cookery did not respond. Check that Cookery 1.6.6 or newer is active and loaded above Ranching.",
  },
  zh_TW: {
    "pack.name": "森羅物語：樂牧",
    "pack.description": "非官方的森羅物語擴充：飼養會回報細心照顧的動物。需要《森羅物語：廚房》。",
    [`${NAMESPACE}.message.breed.same_sex`]: "繁殖需要一公一母。",
    [`${NAMESPACE}.message.breed.pregnant`]: "牠已經懷孕了。",
    [`${NAMESPACE}.message.breed.resting`]: "牠剛繁殖過，需要休息一下。",
    [`${NAMESPACE}.message.breed.not_cared`]: "牠今天還沒被照顧好，不會繁殖。",
    [`${NAMESPACE}.message.rack.empty`]: "先把屠體掛上掛架，或掛上要風乾的肉。",
    [`${NAMESPACE}.message.rack.occupied`]: "掛架上已經有屠體了。",
    [`${NAMESPACE}.message.rack.need_blade`]: "請用菜刀、劍或斧分切。",
    [`${NAMESPACE}.message.lasso.missed`]: "套索範圍內沒有動物。",
    [`${NAMESPACE}.message.candler.none`]: "這裡沒有正在孵的蛋。",
    [`${NAMESPACE}.message.candler.status`]: "%s 顆蛋在孵，下一顆大約再 %s 分鐘。",
    [`${NAMESPACE}.message.candler.paused`]: "%s 顆蛋暫停了：孵化器需要熱源（加熱後下一顆大約 %s 分鐘）。",
    [`${NAMESPACE}.message.milking_rack.tied`]: "綁上擠奶架了。上方容器放空瓶，奶會送到下方的容器。",
    [`${NAMESPACE}.message.milking_rack.untied`]: "從擠奶架解下來了。",
    [`${NAMESPACE}.message.milking_rack.occupied`]: "這個擠奶架上已經有動物了。",
    [`${NAMESPACE}.message.milking_rack.not_milkable`]: "只有成年的母牛、山羊、水牛、氂牛能上擠奶架。",
    [`${NAMESPACE}.message.milking_rack.empty`]: "牽著可擠奶的動物來，才能綁上擠奶架。",
    [`${NAMESPACE}.message.rack.drying_hung`]: "掛上風乾（%s/%s），3 天後取下。",
    [`${NAMESPACE}.message.rack.drying_full`]: "掛架滿了，一次只能風乾 %s 件。",
    [`${NAMESPACE}.message.rack.drying_left`]: "還有 %s 件在風乾，下一件大約再 %s 分鐘。",
    [`${NAMESPACE}.message.rack.drying_busy`]: "先把風乾的東西取下，才能掛屠體。",
    [`${NAMESPACE}.message.wash.done`]: "洗好了。水槽：%s/%s。",
    [`${NAMESPACE}.message.wash.no_water`]: "水槽沒水了，先用水桶加水。",
    [`${NAMESPACE}.message.food_waste_bin.added`]: "桶裡的廚餘：%s / %s",
    [`${NAMESPACE}.message.food_waste_bin.full`]: "廚餘桶滿了，先把廚餘取出來。",
    [`${NAMESPACE}.message.food_waste_bin.empty`]: "把吃剩的食物丟進來，變成豬和兔子吃的廚餘。",
    [`${NAMESPACE}.message.milking.not_female`]: "只有成年母畜能擠奶。",
    [`${NAMESPACE}.message.milking.milked_today`]: "今天已經擠過奶了。",
    [`${NAMESPACE}.message.milking.no_milk`]: "今天沒有奶。",
    [`${NAMESPACE}.message.milking.need_bottle`]: "需要一個空玻璃瓶。",
    [`${NAMESPACE}.message.nursing.need_milk`]: "需要一瓶奶。",
    [`${NAMESPACE}.message.nursing.grew`]: "牠長大了！",
    [`${NAMESPACE}.message.nest.full`]: "巢箱已經在孵四顆蛋了。",
    [`${NAMESPACE}.message.nest.empty`]: "還沒有蛋。",
    [`${NAMESPACE}.message.incubator.full`]: "孵化器滿了。",
    [`${NAMESPACE}.message.incubator.empty`]: "孵化器是空的。",
    [`${NAMESPACE}.message.incubator.cold`]: "孵化器旁邊需要熱源。",
    [`${NAMESPACE}.message.station.empty`]: "手持材料才能開始。",
    [`${NAMESPACE}.message.station.wrong_item`]: "這個設備用不到這樣東西。",
    [`${NAMESPACE}.message.station.missing`]: "材料不夠。",
    [`${NAMESPACE}.message.station.working`]: "還在加工，大約還要 %s 分鐘。",
    [`${NAMESPACE}.message.hay_rack.status`]: "乾草架：乾草 %s/%s 份。",
    [`${NAMESPACE}.message.hay_rack.only_grass`]: "乾草架只能放乾草、小麥、飼草和苜蓿。",
    [`${NAMESPACE}.message.hay_rack.full`]: "乾草架滿了。",
    [`${NAMESPACE}.message.crate.leashed`]: "先解開牽繩才能裝籠。",
    [`${NAMESPACE}.message.crate.ridden`]: "有人正騎著牠。",
    [`${NAMESPACE}.message.crate.no_room`]: "這裡沒有空間放出來。",
    [`${NAMESPACE}.message.crate.missing`]: "加入 %s 的附加包沒有載入。",
    [`${NAMESPACE}.message.hitching_post.tied`]: "把 %s 隻動物拴在樁上。",
    [`${NAMESPACE}.message.hitching_post.untied`]: "從樁上牽回 %s 隻動物。",
    [`${NAMESPACE}.message.hitching_post.empty`]: "牽著動物來點擊，就能拴在樁上。",
    [`${NAMESPACE}.message.cowbell.called`]: "%s 隻動物聽到鈴聲過來了。",
    [`${NAMESPACE}.message.cowbell.nobody`]: "附近沒有信任你（3 顆心以上）的動物。",
    [`${NAMESPACE}.message.cookery_missing`]: "§e[森羅物語：樂牧]§r 沒有收到《森羅物語：廚房》的回應。請確認已啟用 1.6.6 以上的廚房，且載入順序在樂牧之上。",
  },
  zh_CN: {
    "pack.name": "森罗物语：乐牧",
    "pack.description": "非官方的森罗物语扩展：饲养会回报细心照顾的动物。需要《森罗物语：厨房》。",
    [`${NAMESPACE}.message.breed.same_sex`]: "繁殖需要一公一母。",
    [`${NAMESPACE}.message.breed.pregnant`]: "它已经怀孕了。",
    [`${NAMESPACE}.message.breed.resting`]: "它刚繁殖过，需要休息一下。",
    [`${NAMESPACE}.message.breed.not_cared`]: "它今天还没被照顾好，不会繁殖。",
    [`${NAMESPACE}.message.rack.empty`]: "先把屠体挂上挂架，或挂上要风干的肉。",
    [`${NAMESPACE}.message.rack.occupied`]: "挂架上已经有屠体了。",
    [`${NAMESPACE}.message.rack.need_blade`]: "请用菜刀、剑或斧分切。",
    [`${NAMESPACE}.message.lasso.missed`]: "套索范围内没有动物。",
    [`${NAMESPACE}.message.candler.none`]: "这里没有正在孵的蛋。",
    [`${NAMESPACE}.message.candler.status`]: "%s 颗蛋在孵，下一颗大约再 %s 分钟。",
    [`${NAMESPACE}.message.candler.paused`]: "%s 颗蛋暂停了：孵化器需要热源（加热后下一颗大约 %s 分钟）。",
    [`${NAMESPACE}.message.milking_rack.tied`]: "绑上挤奶架了。上方容器放空瓶，奶会送到下方的容器。",
    [`${NAMESPACE}.message.milking_rack.untied`]: "从挤奶架解下来了。",
    [`${NAMESPACE}.message.milking_rack.occupied`]: "这个挤奶架上已经有动物了。",
    [`${NAMESPACE}.message.milking_rack.not_milkable`]: "只有成年的母牛、山羊、水牛、牦牛能上挤奶架。",
    [`${NAMESPACE}.message.milking_rack.empty`]: "牵着可挤奶的动物来，才能绑上挤奶架。",
    [`${NAMESPACE}.message.rack.drying_hung`]: "挂上风干（%s/%s），3 天后取下。",
    [`${NAMESPACE}.message.rack.drying_full`]: "挂架满了，一次只能风干 %s 件。",
    [`${NAMESPACE}.message.rack.drying_left`]: "还有 %s 件在风干，下一件大约再 %s 分钟。",
    [`${NAMESPACE}.message.rack.drying_busy`]: "先把风干的东西取下，才能挂屠体。",
    [`${NAMESPACE}.message.wash.done`]: "洗好了。水槽：%s/%s。",
    [`${NAMESPACE}.message.wash.no_water`]: "水槽没水了，先用水桶加水。",
    [`${NAMESPACE}.message.food_waste_bin.added`]: "桶里的厨余：%s / %s",
    [`${NAMESPACE}.message.food_waste_bin.full`]: "厨余桶满了，先把厨余取出来。",
    [`${NAMESPACE}.message.food_waste_bin.empty`]: "把吃剩的食物丢进来，变成猪和兔子吃的厨余。",
    [`${NAMESPACE}.message.milking.not_female`]: "只有成年母畜能挤奶。",
    [`${NAMESPACE}.message.milking.milked_today`]: "今天已经挤过奶了。",
    [`${NAMESPACE}.message.milking.no_milk`]: "今天没有奶。",
    [`${NAMESPACE}.message.milking.need_bottle`]: "需要一个空玻璃瓶。",
    [`${NAMESPACE}.message.nursing.need_milk`]: "需要一瓶奶。",
    [`${NAMESPACE}.message.nursing.grew`]: "它长大了！",
    [`${NAMESPACE}.message.nest.full`]: "巢箱已经在孵四颗蛋了。",
    [`${NAMESPACE}.message.nest.empty`]: "还没有蛋。",
    [`${NAMESPACE}.message.incubator.full`]: "孵化器满了。",
    [`${NAMESPACE}.message.incubator.empty`]: "孵化器是空的。",
    [`${NAMESPACE}.message.incubator.cold`]: "孵化器旁边需要热源。",
    [`${NAMESPACE}.message.station.empty`]: "手持材料才能开始。",
    [`${NAMESPACE}.message.station.wrong_item`]: "这个设备用不到这样东西。",
    [`${NAMESPACE}.message.station.missing`]: "材料不够。",
    [`${NAMESPACE}.message.station.working`]: "还在加工，大约还要 %s 分钟。",
    [`${NAMESPACE}.message.hay_rack.status`]: "干草架：干草 %s/%s 份。",
    [`${NAMESPACE}.message.hay_rack.only_grass`]: "干草架只能放干草、小麦、饲草和苜蓿。",
    [`${NAMESPACE}.message.hay_rack.full`]: "干草架满了。",
    [`${NAMESPACE}.message.crate.leashed`]: "先解开拴绳才能装笼。",
    [`${NAMESPACE}.message.crate.ridden`]: "有人正骑着它。",
    [`${NAMESPACE}.message.crate.no_room`]: "这里没有空间放出来。",
    [`${NAMESPACE}.message.crate.missing`]: "加入 %s 的附加包没有加载。",
    [`${NAMESPACE}.message.hitching_post.tied`]: "把 %s 只动物拴在桩上。",
    [`${NAMESPACE}.message.hitching_post.untied`]: "从桩上牵回 %s 只动物。",
    [`${NAMESPACE}.message.hitching_post.empty`]: "牵着动物来点击，就能拴在桩上。",
    [`${NAMESPACE}.message.cowbell.called`]: "%s 只动物听到铃声过来了。",
    [`${NAMESPACE}.message.cowbell.nobody`]: "附近没有信任你（3 颗心以上）的动物。",
    [`${NAMESPACE}.message.cookery_missing`]: "§e[森罗物语：乐牧]§r 没有收到《森罗物语：厨房》的回应。请确认已启用 1.6.6 以上的厨房，且加载顺序在乐牧之上。",
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
      lines.push(`${key}=${value}`);
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
