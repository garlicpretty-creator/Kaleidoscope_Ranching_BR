// Ranching's groups, in the order players meet them: the creative inventory
// groups (tools/gen_catalog.mjs) and the chapters of the Cookery guidebook
// (data/guidebook.js) both come from this list, so the two never disagree.
//
// - from: item registry categories (data/items.js); "blocks" means every block
//         placeable from the creative inventory (data/blocks.js).
// - icon: an item or block id without the namespace.
//
// Plain data: no @minecraft imports (scripts/ARCHITECTURE.md).

export const CATALOG_GROUPS = [
  { id: "facilities", from: ["blocks", "facility"], icon: "trough", zh: "牧場設施", en: "Ranch Facilities" },
  { id: "tools", from: ["tool"], icon: "brush", zh: "牧場工具", en: "Ranch Tools" },
  { id: "feed", from: ["feed", "treat"], icon: "mixed_feed", zh: "飼料與零食", en: "Feed and Treats" },
  { id: "milk", from: ["milk"], icon: "cow_milk", zh: "乳品", en: "Milk" },
  { id: "eggs", from: ["egg", "fertilized_egg", "preserved"], icon: "duck_egg", zh: "蛋", en: "Eggs" },
  { id: "dairy", from: ["dairy", "drink"], icon: "butter", zh: "乳製品", en: "Dairy" },
  { id: "carcasses", from: ["carcass"], icon: "cow_carcass", zh: "屠體", en: "Carcasses" },
  { id: "meat", from: ["meat", "cut", "mince", "cured", "offal"], icon: "beef_brisket", zh: "肉品", en: "Meat" },
  { id: "materials", from: ["material"], icon: "wool_cloth", zh: "布料與皮革", en: "Cloth and Leather" },
  { id: "byproducts", from: ["byproduct"], icon: "large_bone", zh: "副產物", en: "By-products" },
];
