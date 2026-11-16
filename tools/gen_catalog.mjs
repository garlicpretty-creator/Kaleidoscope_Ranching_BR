// Sorts Ranching's items and blocks into their own groups in the creative inventory.
//
// Without this every Ranching item sits loose at the end of its creative tab. The groups are
// declared in packs/BP/item_catalog/crafting_item_catalog.json (Bedrock 1.21.60+); each group
// stays in the tab (category) its items already declare, so the catalog never disagrees with
// the item files, and items that already name a group (the dishes, in Cookery's foods) keep it.
// Group names go to tools/fragments/catalog/texts/*.lang for gen_shared.mjs.
//
// Run after the item and block generators: node tools/gen_catalog.mjs

import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const { ITEMS, NAMESPACE } = await import(pathToFileURL(join(root, "packs/BP/scripts/data/items.js")).href);
const { BLOCKS } = await import(pathToFileURL(join(root, "packs/BP/scripts/data/blocks.js")).href);

const NS = NAMESPACE;

// Group order is the order shown in the tab. `from` lists registry categories; "blocks" means
// every placeable block in the registry.
const GROUPS = [
  { id: "facilities", from: ["blocks"], icon: "trough", zh: "牧場設施", en: "Ranch Facilities" },
  { id: "tools", from: ["tool"], icon: "brush", zh: "牧場工具", en: "Ranch Tools" },
  { id: "feed", from: ["feed", "treat"], icon: "mixed_feed", zh: "飼料與零食", en: "Feed and Treats" },
  { id: "milk", from: ["milk"], icon: "cow_milk", zh: "乳品", en: "Milk" },
  { id: "eggs", from: ["egg", "fertilized_egg", "preserved"], icon: "duck_egg", zh: "蛋", en: "Eggs" },
  { id: "dairy", from: ["dairy"], icon: "butter", zh: "乳製品", en: "Dairy" },
  { id: "carcasses", from: ["carcass"], icon: "cow_carcass", zh: "屠體", en: "Carcasses" },
  { id: "meat", from: ["meat", "cut"], icon: "beef_brisket", zh: "肉品", en: "Meat" },
  { id: "byproducts", from: ["byproduct"], icon: "large_bone", zh: "副產物", en: "By-products" },
];

// Simplified names for the zh_CN tab headers.
const ZH_CN = {
  牧場設施: "牧场设施", 牧場工具: "牧场工具", 飼料與零食: "饲料与零食", 乳品: "乳品", 蛋: "蛋",
  乳製品: "乳制品", 屠體: "屠体", 肉品: "肉品", 副產物: "副产物",
};

/** {identifier: creative category} read from the generated item and block files. */
function categories(folder, key) {
  const out = {};
  for (const file of readdirSync(join(root, "packs/BP", folder))) {
    if (!file.endsWith(".json")) continue;
    const data = JSON.parse(readFileSync(join(root, "packs/BP", folder, file), "utf8"))[key];
    const description = data?.description;
    if (!description?.identifier) continue;
    // An item that names its own group (the dishes join Cookery's foods) keeps it.
    out[description.identifier] = description.menu_category?.group ? "own" : description.menu_category?.category ?? "none";
  }
  return out;
}

const itemCategory = categories("items", "minecraft:item");
const blockCategory = categories("blocks", "minecraft:block");

const errors = [];
const tabs = new Map(); // category -> groups
const placed = new Set();
for (const group of GROUPS) {
  const ids = group.from.includes("blocks")
    ? BLOCKS.map((b) => `${NS}:${b.id}`).filter((id) => (blockCategory[id] ?? "none") !== "none")
    : ITEMS.filter((i) => group.from.includes(i.category)).map((i) => `${NS}:${i.id}`);
  const source = group.from.includes("blocks") ? blockCategory : itemCategory;
  for (const id of ids) {
    const category = source[id];
    if (!category) errors.push(`${id}: no item or block file`);
    if (!category || category === "none" || category === "own") continue;
    if (placed.has(id)) errors.push(`${id}: in two groups`);
    placed.add(id);
    if (!tabs.has(category)) tabs.set(category, new Map());
    const groups = tabs.get(category);
    const name = `${NS}:itemGroup.name.ranching_${group.id}`;
    if (!groups.has(name)) groups.set(name, { group, items: [] });
    groups.get(name).items.push(id);
  }
}
const loose = ITEMS.map((i) => `${NS}:${i.id}`).filter((id) => !placed.has(id) && !["none", "own"].includes(itemCategory[id] ?? "none"));
if (loose.length) errors.push(`not in any group (add its category to GROUPS): ${loose.join(", ")}`);
if (errors.length) {
  console.error("gen_catalog:\n  " + errors.join("\n  "));
  process.exit(1);
}

const catalog = {
  format_version: "1.21.60",
  "minecraft:crafting_items_catalog": {
    categories: [...tabs].map(([category, groups]) => ({
      category_name: category,
      groups: [...groups].map(([name, { group, items }]) => {
        const icon = `${NS}:${group.icon}`;
        return { group_identifier: { icon: items.includes(icon) ? icon : items[0], name }, items };
      }),
    })),
  },
};
mkdirSync(join(root, "packs/BP/item_catalog"), { recursive: true });
writeFileSync(join(root, "packs/BP/item_catalog/crafting_item_catalog.json"), JSON.stringify(catalog, null, 2) + "\n");

// The game looks the group header up by its name; vanilla's own groups drop the namespace
// (itemGroup.name.planks), so both spellings are given.
const texts = join(root, "tools/fragments/catalog/texts");
mkdirSync(texts, { recursive: true });
for (const [language, label] of [["en_US", (g) => g.en], ["zh_TW", (g) => g.zh], ["zh_CN", (g) => ZH_CN[g.zh] ?? g.zh]]) {
  const lines = GROUPS.flatMap((g) => [
    `${NS}:itemGroup.name.ranching_${g.id}=${label(g)}`,
    `itemGroup.name.ranching_${g.id}=${label(g)}`,
  ]);
  writeFileSync(join(texts, `${language}.lang`), lines.join("\n") + "\n");
}

const count = [...tabs.values()].reduce((n, groups) => n + groups.size, 0);
console.log(`gen_catalog: ${placed.size} items and blocks in ${count} creative groups`);
