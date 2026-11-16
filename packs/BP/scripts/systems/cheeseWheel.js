// Placed aged cheese wheel: the aged_cheese_wheel item places this block, and
// a blade cuts it like a cake, one cheese slice per use, four in all. The
// `cut` state hides one quarter (piece_4 first); the fourth cut takes the
// last quarter and leaves air. Breaking it gives back what is left: the
// whole wheel if it is uncut, otherwise the remaining slices.

import { ItemStack } from "@minecraft/server";
import { rid } from "../core/ids.js";
import { damageMainHand, give, mainHand } from "../core/inventory.js";
import { isBlade } from "./butcherRack.js";

export const STATE_CUT = rid("cut");
export const SLICES = 4;
const SLICE = rid("cheese_slice");
const WHEEL = rid("aged_cheese_wheel");

const cutOf = (permutation) => Number(permutation?.getState(STATE_CUT) ?? 0);

function tell(player, key) {
  player.onScreenDisplay.setActionBar({ translate: `kaleidoscope_ranching.message.${key}` });
}

/** What a broken wheel gives back, given how many slices were already cut. */
export function leftovers(cut) {
  if (cut <= 0) return { typeId: WHEEL, amount: 1 };
  return { typeId: SLICE, amount: Math.max(0, SLICES - cut) };
}

export const cheeseWheelComponent = {
  onPlayerInteract({ block, player }) {
    if (!player) return;
    if (!isBlade(mainHand(player)?.getItem())) return tell(player, "rack.need_blade");
    const cut = cutOf(block.permutation) + 1;
    give(player, SLICE, 1);
    damageMainHand(player, 1);
    block.dimension.playSound("dig.cloth", block.location);
    if (cut >= SLICES) block.setType("minecraft:air");
    else block.setPermutation(block.permutation.withState(STATE_CUT, cut));
  },

  // onBreak fires for every way the block goes (player, explosion), so this drops exactly once.
  onBreak({ block, dimension, brokenBlockPermutation }) {
    const { typeId, amount } = leftovers(cutOf(brokenBlockPermutation));
    if (amount <= 0) return;
    const at = { x: block.location.x + 0.5, y: block.location.y + 0.3, z: block.location.z + 0.5 };
    (dimension ?? block.dimension).spawnItem(new ItemStack(typeId, amount), at);
  },
};
