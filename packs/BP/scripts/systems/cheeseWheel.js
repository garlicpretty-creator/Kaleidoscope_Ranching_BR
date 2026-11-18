// Placed cheese wheels (aged, vintage, smoked): the wheel item places the
// block, and a blade cuts it like a cake, one slice per use, four in all. The
// `cut` state hides one quarter (piece_4 first); the fourth cut takes the
// last quarter and leaves air. Breaking it gives back what is left: the
// whole wheel if it is uncut, otherwise the remaining slices.
// Which wheel gives which slice is in data/placedFoods.js.

import { ItemStack } from "@minecraft/server";
import { rid } from "../core/ids.js";
import { damageMainHand, give, mainHand } from "../core/inventory.js";
import { isBlade } from "./butcherRack.js";
import { refuse } from "../core/feedback.js";
import { PLACED_FOODS, PORTIONS } from "../data/placedFoods.js";

export const STATE_CUT = rid("cut");
export const SLICES = PORTIONS;
const AGED = rid("cheese_wheel");
/** {block id: {wheel, slice}} */
const WHEELS = Object.fromEntries(
  PLACED_FOODS.filter((food) => food.cut).map((food) => [rid(food.block), { wheel: rid(food.item), slice: rid(food.cut) }])
);

const cutOf = (permutation) => Number(permutation?.getState(STATE_CUT) ?? 0);


/** What a broken wheel gives back, given how many slices were already cut. */
export function leftovers(cut, blockId = AGED) {
  const { wheel, slice } = WHEELS[blockId] ?? WHEELS[AGED];
  if (cut <= 0) return { typeId: wheel, amount: 1 };
  return { typeId: slice, amount: Math.max(0, SLICES - cut) };
}

export const cheeseWheelComponent = {
  onPlayerInteract({ block, player }) {
    if (!player) return;
    if (!isBlade(mainHand(player)?.getItem())) return refuse(player); // needs a blade
    const cut = cutOf(block.permutation) + 1;
    give(player, (WHEELS[block.typeId] ?? WHEELS[AGED]).slice, 1);
    damageMainHand(player, 1);
    block.dimension.playSound("dig.cloth", block.location);
    if (cut >= SLICES) block.setType("minecraft:air");
    else block.setPermutation(block.permutation.withState(STATE_CUT, cut));
  },

  // onBreak fires for every way the block goes (player, explosion), so this drops exactly once.
  onBreak({ block, dimension, brokenBlockPermutation }) {
    const { typeId, amount } = leftovers(cutOf(brokenBlockPermutation), brokenBlockPermutation?.type?.id);
    if (amount <= 0) return;
    const at = { x: block.location.x + 0.5, y: block.location.y + 0.3, z: block.location.z + 0.5 };
    (dimension ?? block.dimension).spawnItem(new ItemStack(typeId, amount), at);
  },
};
