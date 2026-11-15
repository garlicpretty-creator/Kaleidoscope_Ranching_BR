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

const LANGUAGES = ["en_US", "zh_TW", "zh_CN"];
const fragmentsDir = join(root, "tools", "fragments");
const fragments = existsSync(fragmentsDir)
  ? readdirSync(fragmentsDir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort()
  : [];

const errors = [];

// --- Language files -------------------------------------------------------

// Strings that do not come from a registry. zh_CN registry names currently
// fall back to zh_TW until the registries gain a zh_CN column.
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

function registryEntries(language) {
  const column = language === "en_US" ? "en" : "zh";
  const eggWord = { en_US: " Spawn Egg", zh_TW: "生怪蛋", zh_CN: "刷怪蛋" }[language];
  const entries = Object.entries(STATIC[language]);
  for (const [id, zh, en] of ANIMAL_NAMES) {
    const name = column === "en" ? en : zh;
    entries.push([`entity.${NAMESPACE}:${id}.name`, name]);
    entries.push([`item.spawn_egg.entity.${NAMESPACE}:${id}.name`, name + eggWord]);
  }
  for (const item of ITEMS) if (item.owner !== "m2") entries.push([`item.${NAMESPACE}:${item.id}.name`, item[column]]);
  for (const block of BLOCKS) if (block.owner !== "m2") entries.push([`tile.${NAMESPACE}:${block.id}.name`, block[column]]);
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
