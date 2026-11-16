// Dishes put down to share (data/placedFoods.js rows with `eat`): the dish item
// places the block, and each use eats one portion, whoever uses it. The `cut`
// state hides one portion (piece_4 first); the last portion leaves air and
// hands back the dish's bowl, if it has one.
//
// ## A portion is eaten with a one-tick saturation effect: level n restores n
// ## hunger points (and 2n saturation), which is how the item's own food value
// ## is split across the portions without touching the hunger attribute.
//
// Breaking an untouched dish gives the item back. A started dish gives nothing
// but its bowl: the portions left cannot be picked up again.

import { ItemStack } from "@minecraft/server";
import { rid } from "../core/ids.js";
import { give } from "../core/inventory.js";
import { showActionBar } from "../core/actionBar.js";
import { PLACED_FOODS } from "../data/placedFoods.js";
import { STATE_CUT } from "./cheeseWheel.js";

/** {block id: row} for the dishes eaten in place. */
export const EATEN = Object.fromEntries(PLACED_FOODS.filter((food) => food.eat).map((food) => [rid(food.block), food]));

const eatenOf = (permutation) => Number(permutation?.getState(STATE_CUT) ?? 0);

/** True when the player's hunger bar is full; unknown (no hunger attribute) counts as hungry. */
function isFull(player) {
  const hunger = player.getComponent?.("minecraft:player.hunger");
  return hunger ? hunger.currentValue >= hunger.effectiveMax : false;
}

/** What breaking the dish gives back, given how many portions were already eaten. */
export function leftovers(eaten, blockId) {
  const food = EATEN[blockId];
  if (!food) return undefined;
  if (eaten <= 0) return rid(food.item);
  return food.gives;
}

export const placedFoodComponent = {
  onPlayerInteract({ block, player }) {
    const food = EATEN[block.typeId];
    if (!player || !food) return;
    if (isFull(player)) return showActionBar(player, { translate: "kaleidoscope_ranching.message.food.full" });
    player.addEffect("saturation", 1, { amplifier: food.eat - 1, showParticles: false });
    block.dimension.playSound("random.eat", block.location);
    const eaten = eatenOf(block.permutation) + 1;
    if (eaten < food.portions) return block.setPermutation(block.permutation.withState(STATE_CUT, eaten));
    block.setType("minecraft:air");
    if (food.gives) give(player, food.gives, 1);
  },

  // The last portion sets air directly, so this only runs when the dish is broken.
  onBreak({ block, dimension, brokenBlockPermutation }) {
    const typeId = leftovers(eatenOf(brokenBlockPermutation), brokenBlockPermutation?.type?.id);
    if (!typeId) return;
    const at = { x: block.location.x + 0.5, y: block.location.y + 0.3, z: block.location.z + 0.5 };
    (dimension ?? block.dimension).spawnItem(new ItemStack(typeId, 1), at);
  },
};
