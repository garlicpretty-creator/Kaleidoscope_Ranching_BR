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
// - skin:      hide, wool, hair or feathers. The rack shows the animal as it
//              was until every skin stroke is done, then the skinned carcass.
// - offal:     the offal stroke (1.1 內臟線), taken right after the skin.
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
      { item: "raw_hide", count: [1, 2], skin: true },
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
      { item: "raw_hide", count: [1, 2], skin: true },
      { item: "buffalo_meat", count: [3, 4], maleBonus: 1 },
      { item: "beef_brisket", count: [1, 2] },
      { item: "beef_shank", count: [1, 2] },
      { item: "large_bone", count: [2, 3] },
      { item: "cattle_horn", count: [2, 2] },
    ],
  },
  yak_carcass: {
    cuts: [
      { item: "yak_hair", count: [2, 3], skin: true },
      { item: "raw_hide", count: [1, 2], skin: true },
      { item: "yak_meat", count: [3, 4], maleBonus: 1 },
      { item: "beef_brisket", count: [1, 2] },
      { item: "beef_shank", count: [1, 2] },
      { item: "large_bone", count: [2, 3] },
    ],
  },
  pig_carcass: {
    cuts: [
      { item: "pig_skin", count: [1, 2], skin: true },
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
      { item: "minecraft:white_wool", count: [1, 1], ifUnshorn: true, note: "uses the sheep's own wool colour", skin: true },
      { item: "sheep_skin", count: [1, 1], skin: true },
      { item: "minecraft:mutton", count: [1, 2], maleBonus: 1 },
      { item: "lamb_chop", count: [1, 2] },
      { item: "lamb_leg", count: [1, 2] },
      { item: "mutton_tallow", count: [1, 1] },
      { item: "large_bone", count: [1, 2] },
    ],
  },
  goat_carcass: {
    cuts: [
      { item: "sheep_skin", count: [1, 1], skin: true },
      { item: "minecraft:mutton", count: [1, 2], maleBonus: 1 },
      { item: "lamb_chop", count: [1, 2] },
      { item: "lamb_leg", count: [1, 2] },
      { item: "large_bone", count: [1, 2] },
      { item: "billy_goat_horn", count: [2, 2], maleOnly: true },
    ],
  },
  chicken_carcass: {
    cuts: [
      { item: "minecraft:feather", count: [1, 3], skin: true },
      { item: "minecraft:chicken", count: [1, 1] },
      { item: "chicken_leg", count: [2, 2] },
      { item: "chicken_wing", count: [2, 2] },
      { item: "chicken_frame", count: [1, 1] },
    ],
  },
  duck_carcass: {
    cuts: [
      { item: "down", count: [1, 2], skin: true },
      { item: "minecraft:feather", count: [1, 2], skin: true },
      { item: "duck_meat", count: [1, 2] },
      { item: "duck_leg", count: [2, 2] },
    ],
  },
  goose_carcass: {
    cuts: [
      { item: "down", count: [2, 3], skin: true },
      { item: "minecraft:feather", count: [1, 2], skin: true },
      { item: "goose_meat", count: [2, 2] },
      { item: "goose_leg", count: [2, 2] },
    ],
  },
  rabbit_carcass: {
    cuts: [
      { item: "minecraft:rabbit_hide", count: [1, 1], skin: true },
      { item: "minecraft:rabbit", count: [1, 1] },
      { item: "rabbit_leg", count: [2, 2] },
      { item: "minecraft:rabbit_foot", count: [1, 1], chance: 0.1 },
    ],
  },
};

// 1.1 內臟線: one offal stroke per animal, right after its skin strokes.
// Sheep, goats and rabbits give no offal (企劃書 1.1 二、內臟線).
export const OFFAL_CUTS = {
  cow_carcass: [{ item: "beef_tripe", count: [1, 1] }],
  buffalo_carcass: [{ item: "beef_tripe", count: [1, 1] }],
  yak_carcass: [{ item: "beef_tripe", count: [1, 1] }],
  pig_carcass: [{ item: "pork_liver", count: [1, 1] }, { item: "pig_intestine", count: [1, 2] }],
  chicken_carcass: [{ item: "chicken_gizzard", count: [1, 1] }],
  duck_carcass: [{ item: "duck_blood", count: [1, 1] }],
  goose_carcass: [{ item: "goose_liver", count: [1, 1] }],
};

for (const [carcass, offal] of Object.entries(OFFAL_CUTS)) {
  const cuts = BUTCHER_TABLE[carcass].cuts;
  let after = -1;
  cuts.forEach((cut, i) => { if (cut.skin) after = i; });
  cuts.splice(after + 1, 0, ...offal.map((cut) => ({ ...cut, offal: true })));
}
