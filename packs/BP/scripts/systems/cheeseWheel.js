// The aged cheese wheel placed as a block (企劃書: 熟成乳酪輪 可放置、可切塊).
//
// Use a knife (Cookery's kitchen-knife tag), sword or axe on it: one cheese
// slice per cut, one durability per cut; the fourth cut finishes the wheel.
// Four slices in all, the same as cutting it on Cookery's chopping board.
// Breaking it drops the wheel when uncut, or the slices left (loot tables
// per state, written by tools/gen_blocks.mjs).

import { ItemStack } from "@minecraft/server";
import { rid } from "../core/ids.js";
import { damageMainHand, mainHand } from "../core/inventory.js";
import { isBlade } from "./butcherRack.js";

const SLICES = rid("slices");
const PER_WHEEL = 4;

function tell(player, key) {
  try {
    player.onScreenDisplay.setActionBar({ translate: `kaleidoscope_ranching.message.cheese_wheel.${key}` });
  } catch {}
}

export function cutCheeseWheel(block, player) {
  if (!isBlade(mainHand(player)?.getItem())) return tell(player, "needs_blade");
  const cut = (block.permutation.getState(SLICES) ?? 0) + 1;
  const { x, y, z } = block.location;
  block.dimension.spawnItem(new ItemStack(rid("cheese_slice"), 1), { x: x + 0.5, y: y + 0.5, z: z + 0.5 });
  damageMainHand(player, 1);
  block.dimension.playSound("block.cake.add_candle", block.location);
  if (cut >= PER_WHEEL) block.setType("minecraft:air");
  else block.setPermutation(block.permutation.withState(SLICES, cut));
}

export const cheeseWheelComponent = {
  onPlayerInteract({ block, player }) {
    if (player) cutCheeseWheel(block, player);
  },
};
