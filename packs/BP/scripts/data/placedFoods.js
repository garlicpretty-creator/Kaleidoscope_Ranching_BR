// Food that can be put down as a block (the item carries minecraft:block_placer).
// One row per food; the block files (tools/gen_blocks.mjs), the items'
// block_placer (tools/gen_items.mjs) and the two block components
// (systems/cheeseWheel.js, systems/placedFood.js) all read this table.
//
// item:     the food item that places the block
// block:    the placed block; its `cut` state counts portions already taken
// portions: how many portions the block holds
// cut:      a blade takes one of this item per portion (cheese wheels)
// eat:      an empty-handed or any-handed use eats one portion: hunger points
//           per portion (the saturation effect gives twice that as saturation)
// gives:    handed back with the last portion (the dish's bowl)
//
// Plain data: no @minecraft imports (scripts/ARCHITECTURE.md).

export const PORTIONS = 4;

export const PLACED_FOODS = [
  { item: "aged_cheese_wheel", block: "cheese_wheel", portions: PORTIONS, cut: "cheese_slice" },
  { item: "vintage_cheese_wheel", block: "vintage_cheese_wheel", portions: PORTIONS, cut: "vintage_cheese_slice" },
  { item: "smoked_cheese_wheel", block: "smoked_cheese_wheel", portions: PORTIONS, cut: "smoked_cheese_slice" },
  // 12 hunger as an item; four slices of 3.
  { item: "margherita_pizza", block: "placed_pizza", portions: PORTIONS, eat: 3 },
  // 11 hunger as an item; four dips of 3, so sharing the pot is worth one point more.
  { item: "cheese_fondue", block: "placed_fondue", portions: PORTIONS, eat: 3, gives: "minecraft:bowl" },
];
