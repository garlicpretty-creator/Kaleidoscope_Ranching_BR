// Generates the language files of both packs from the data registries, so a
// name is only ever written once (in data/items.js or data/blocks.js).
//
// Run with: node tools/gen_lang.mjs

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const load = (name) => import(pathToFileURL(join(root, "packs", "BP", "scripts", "data", name)).href);

const { ITEMS, NAMESPACE, ANIMAL_NAMES } = await load("items.js");
const { BLOCKS } = await load("blocks.js");

// Text that does not come from a registry. zh_CN is converted from zh_TW by
// hand here; registry names fall back to zh_TW until a zh_CN column is added.
const STATIC = {
  en_US: {
    "pack.name": "Kaleidoscope Ranching",
    "pack.description": "Unofficial Kaleidoscope add-on: raise animals that reward good care. Requires Kaleidoscope Cookery.",
    [`${NAMESPACE}.message.breed.same_sex`]: "Breeding needs one male and one female.",
    [`${NAMESPACE}.message.breed.pregnant`]: "She is already expecting.",
    [`${NAMESPACE}.message.breed.resting`]: "This animal bred recently and needs to rest.",
    [`${NAMESPACE}.message.breed.not_cared`]: "This animal has not been cared for today and will not breed.",
    [`${NAMESPACE}.message.cookery_missing`]: "§e[Kaleidoscope Ranching]§r Kaleidoscope Cookery did not respond. Check that Cookery 1.6.6 or newer is active and loaded above Ranching.",
  },
  zh_TW: {
    "pack.name": "森羅物語：樂牧",
    "pack.description": "非官方的森羅物語擴充：飼養會回報細心照顧的動物。需要《森羅物語：廚房》。",
    [`${NAMESPACE}.message.breed.same_sex`]: "繁殖需要一公一母。",
    [`${NAMESPACE}.message.breed.pregnant`]: "牠已經懷孕了。",
    [`${NAMESPACE}.message.breed.resting`]: "牠剛繁殖過，需要休息一下。",
    [`${NAMESPACE}.message.breed.not_cared`]: "牠今天還沒被照顧好，不會繁殖。",
    [`${NAMESPACE}.message.cookery_missing`]: "§e[森羅物語：樂牧]§r 沒有收到《森羅物語：廚房》的回應。請確認已啟用 1.6.6 以上的廚房，且載入順序在樂牧之上。",
  },
  zh_CN: {
    "pack.name": "森罗物语：乐牧",
    "pack.description": "非官方的森罗物语扩展：饲养会回报细心照顾的动物。需要《森罗物语：厨房》。",
    [`${NAMESPACE}.message.breed.same_sex`]: "繁殖需要一公一母。",
    [`${NAMESPACE}.message.breed.pregnant`]: "它已经怀孕了。",
    [`${NAMESPACE}.message.breed.resting`]: "它刚繁殖过，需要休息一下。",
    [`${NAMESPACE}.message.breed.not_cared`]: "它今天还没被照顾好，不会繁殖。",
    [`${NAMESPACE}.message.cookery_missing`]: "§e[森罗物语：乐牧]§r 没有收到《森罗物语：厨房》的回应。请确认已启用 1.6.6 以上的厨房，且加载顺序在乐牧之上。",
  },
};

const LANGUAGES = ["en_US", "zh_TW", "zh_CN"];
const nameColumn = { en_US: "en", zh_TW: "zh", zh_CN: "zh" };

function build(language) {
  const lines = Object.entries(STATIC[language]).map(([key, value]) => `${key}=${value}`);
  const column = nameColumn[language];
  const eggWord = { en_US: " Spawn Egg", zh_TW: "生怪蛋", zh_CN: "刷怪蛋" }[language];
  lines.push("");
  for (const [id, zh, en] of ANIMAL_NAMES) {
    const name = column === "en" ? en : zh;
    lines.push(`entity.${NAMESPACE}:${id}.name=${name}`);
    lines.push(`item.spawn_egg.entity.${NAMESPACE}:${id}.name=${name}${eggWord}`);
  }
  lines.push("");
  for (const item of ITEMS) lines.push(`item.${NAMESPACE}:${item.id}.name=${item[column]}`);
  lines.push("");
  for (const block of BLOCKS) lines.push(`tile.${NAMESPACE}:${block.id}.name=${block[column]}`);
  return lines.join("\n") + "\n";
}

for (const pack of ["BP", "RP"]) {
  const dir = join(root, "packs", pack, "texts");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "languages.json"), JSON.stringify(LANGUAGES, null, 2) + "\n");
  for (const language of LANGUAGES) writeFileSync(join(dir, `${language}.lang`), build(language));
}
console.log(`gen_lang: wrote ${LANGUAGES.length} languages for BP and RP`);
