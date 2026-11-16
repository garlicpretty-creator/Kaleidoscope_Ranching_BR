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
// drink:    drunk rather than eaten (the item's drink animation): the drinking sound
// shape:    which boxes the block uses: wheel, pizza, pot, claypot, dish, and the drinks' cup, glass,
//           bottle, bowl; every dish and drink has its own model
//           (tools/gen_blocks.mjs; art_src/m4_scripts/placed_food.py)
//
// Plain data: no @minecraft imports (scripts/ARCHITECTURE.md).

export const PORTIONS = 4;

/** Hearty dishes served from a shared pot or baking dish: four portions of 3 hunger, the bowl comes back. */
const shared = (item, shape) => ({ item, block: `placed_${item}`, shape, portions: PORTIONS, eat: 3, gives: "minecraft:bowl" });

/** A drink in its cup: one serving of `eat` hunger, drunk (or with drink: false, eaten) in one go. */
const drink = (item, shape, eat, { gives, drink = true } = {}) =>
  ({ item, block: `placed_${item}`, shape, portions: 1, eat, drink, ...(gives ? { gives } : {}) });

export const PLACED_FOODS = [
  { item: "aged_cheese_wheel", block: "cheese_wheel", shape: "wheel", portions: PORTIONS, cut: "cheese_slice" },
  { item: "vintage_cheese_wheel", block: "vintage_cheese_wheel", shape: "wheel", portions: PORTIONS, cut: "vintage_cheese_slice" },
  { item: "smoked_cheese_wheel", block: "smoked_cheese_wheel", shape: "wheel", portions: PORTIONS, cut: "smoked_cheese_slice" },
  // 12 hunger as an item; four slices of 3.
  { item: "margherita_pizza", block: "placed_pizza", shape: "pizza", portions: PORTIONS, eat: 3 },
  // 11 hunger as an item; four dips of 3, so sharing the pot is worth one point more.
  { item: "cheese_fondue", block: "placed_fondue", shape: "pot", portions: PORTIONS, eat: 3, gives: "minecraft:bowl" },
  // The big stews (10 to 12 hunger as an item), each in its own pot; the rice in a wide clay pot.
  shared("old_duck_soup", "pot"),
  shared("braised_brisket", "pot"),
  shared("yak_stew", "pot"),
  shared("goose_stew", "pot"),
  shared("lion_head_meatballs", "pot"),
  shared("claypot_rice", "claypot"),
  // Baked in a dish and cut into four.
  shared("cheese_gratin", "dish"),
  shared("truffle_gratin", "dish"),
  // Drinks put down in their cup, glass or bottle: one serving, drunk in one go for the item's own
  // hunger, and the item's container comes back (tools/test/run.mjs checks both against the item).
  drink("milk_wine", "cup", 3, { gives: "kaleidoscope_ranching:horn_cup" }),
  drink("yak_milk_wine", "cup", 4, { gives: "kaleidoscope_ranching:horn_cup" }),
  drink("cream_cocoa", "glass", 4, { gives: "minecraft:glass_bottle" }),
  drink("yogurt_berry_drink", "bottle", 4, { gives: "minecraft:glass_bottle" }),
  drink("milk_tea", "bowl", 4, { gives: "minecraft:glass_bottle" }),
  drink("milk_skin_tea", "bowl", 5, { gives: "minecraft:glass_bottle" }),
  // Yogurt is eaten with a spoon from its crock, as from the hand.
  drink("yogurt", "cup", 4, { drink: false }),
];
