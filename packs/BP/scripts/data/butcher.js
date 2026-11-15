// Butchering table for 1.0.0.
//
// An animal drops only its carcass. A carcass hung on the butcher rack is cut
// one stroke at a time; each stroke removes the next entry of `cuts` in order.
//
// - count:     [min, max] items for that stroke.
// - maleBonus: extra items added when a large carcass came from a male.
// - maleOnly:  the stroke is skipped for a female carcass.
// - chance:    probability the stroke yields anything (default 1).
// - ifUnshorn: only when the sheep still had its wool.
//
// Every carcass yields vanilla raw meat where a vanilla meat exists, so
// Cookery's existing recipes keep working. Identifiers without a namespace
// belong to `kaleidoscope_ranching:`.

/** Item tag accepted as a butchering knife, shared with Cookery. */
export const KNIFE_TAG = "kaleidoscope_cookery:kitchen_knife";

/** Vanilla tool families that can also cut, matched by item tag. */
export const VANILLA_BLADE_TAGS = ["minecraft:is_sword", "minecraft:is_axe"];

/** Durability spent per stroke. */
export const DURABILITY_PER_STROKE = 1;

export const BUTCHER_TABLE = {
  cow_carcass: {
    cuts: [
      { item: "raw_hide", count: [1, 2] },
      { item: "minecraft:beef", count: [2, 3], maleBonus: 1 },
      { item: "beef_sirloin", count: [1, 2], maleBonus: 1 },
      { item: "beef_brisket", count: [1, 2] },
      { item: "beef_shank", count: [1, 2] },
      { item: "beef_tallow", count: [1, 1] },
      { item: "large_bone", count: [2, 3] },
      { item: "cattle_horn", count: [2, 2], maleOnly: true },
    ],
  },
  buffalo_carcass: {
    cuts: [
      { item: "raw_hide", count: [1, 2] },
      { item: "buffalo_meat", count: [3, 4], maleBonus: 1 },
      { item: "beef_brisket", count: [1, 2] },
      { item: "beef_shank", count: [1, 2] },
      { item: "large_bone", count: [2, 3] },
      { item: "cattle_horn", count: [2, 2] },
    ],
  },
  yak_carcass: {
    cuts: [
      { item: "yak_hair", count: [2, 3] },
      { item: "raw_hide", count: [1, 2] },
      { item: "yak_meat", count: [3, 4], maleBonus: 1 },
      { item: "beef_brisket", count: [1, 2] },
      { item: "beef_shank", count: [1, 2] },
      { item: "large_bone", count: [2, 3] },
    ],
  },
  pig_carcass: {
    cuts: [
      { item: "pig_skin", count: [1, 2] },
      { item: "minecraft:porkchop", count: [2, 3], maleBonus: 1 },
      { item: "pork_belly", count: [1, 2], maleBonus: 1 },
      { item: "pork_ribs", count: [1, 2] },
      { item: "pork_trotter", count: [2, 4] },
      { item: "pork_fat", count: [1, 2] },
      { item: "large_bone", count: [1, 2] },
    ],
  },
  sheep_carcass: {
    cuts: [
      { item: "minecraft:white_wool", count: [1, 1], ifUnshorn: true, note: "uses the sheep's own wool colour" },
      { item: "sheep_skin", count: [1, 1] },
      { item: "minecraft:mutton", count: [1, 2], maleBonus: 1 },
      { item: "lamb_chop", count: [1, 2] },
      { item: "lamb_leg", count: [1, 2] },
      { item: "mutton_tallow", count: [1, 1] },
      { item: "large_bone", count: [1, 2] },
    ],
  },
  goat_carcass: {
    cuts: [
      { item: "sheep_skin", count: [1, 1] },
      { item: "minecraft:mutton", count: [1, 2], maleBonus: 1 },
      { item: "lamb_chop", count: [1, 2] },
      { item: "lamb_leg", count: [1, 2] },
      { item: "large_bone", count: [1, 2] },
      { item: "billy_goat_horn", count: [2, 2], maleOnly: true },
    ],
  },
  chicken_carcass: {
    cuts: [
      { item: "minecraft:feather", count: [1, 3] },
      { item: "minecraft:chicken", count: [1, 1] },
      { item: "chicken_leg", count: [2, 2] },
      { item: "chicken_wing", count: [2, 2] },
      { item: "chicken_frame", count: [1, 1] },
    ],
  },
  duck_carcass: {
    cuts: [
      { item: "down", count: [1, 2] },
      { item: "minecraft:feather", count: [1, 2] },
      { item: "duck_meat", count: [1, 2] },
      { item: "duck_leg", count: [2, 2] },
    ],
  },
  goose_carcass: {
    cuts: [
      { item: "down", count: [2, 3] },
      { item: "minecraft:feather", count: [1, 2] },
      { item: "goose_meat", count: [2, 2] },
      { item: "goose_leg", count: [2, 2] },
    ],
  },
  rabbit_carcass: {
    cuts: [
      { item: "minecraft:rabbit_hide", count: [1, 1] },
      { item: "minecraft:rabbit", count: [1, 1] },
      { item: "rabbit_leg", count: [2, 2] },
      { item: "minecraft:rabbit_foot", count: [1, 1], chance: 0.1 },
    ],
  },
};
