// 廚餘桶 (food waste bin): leftover food becomes pig and rabbit feed.
//
// Use the bin holding any food to scrape one into it (sneak to tip in the whole
// stack). Each food becomes one portion of 廚餘 (food_waste), a vegetable-kind
// feed (data/feeds.js). Use it with anything else, or an empty hand, to take
// all the scraps out. Breaking the bin drops what is inside. The bin holds 32
// portions; its `fill` state (0..4) shows how full it is.

import { ItemStack } from "@minecraft/server";
import { clearBlockData, getBlockData, setBlockData, takeBlockData } from "../core/blockStore.js";
import { rid } from "../core/ids.js";
import { consumeMainHand, give, mainHand } from "../core/inventory.js";
import { showActionBar } from "../core/actionBar.js";

export const CAPACITY = 32;
export const STATE_FILL = rid("fill");
export const FOOD_WASTE = rid("food_waste");

function tell(player, key, values = []) {
  showActionBar(player, { translate: `kaleidoscope_ranching.message.food_waste_bin.${key}`, with: values });
}

/** Whether an item can go in the bin: anything edible except the scraps themselves. */
export function isScrapable(item) {
  if (!item || item.typeId === FOOD_WASTE) return false;
  return Boolean(item.getComponent("minecraft:food")) || item.hasTag("minecraft:is_food");
}

/** 0..4 by how full the bin is; any scraps at all show at least the first level. */
export function fillLevel(count) {
  return count <= 0 ? 0 : Math.min(4, Math.ceil((count / CAPACITY) * 4));
}

const countOf = (block) => Number(getBlockData(block, {})?.count ?? 0);

function store(block, count) {
  if (count > 0) setBlockData(block, { count });
  else clearBlockData(block.dimension, block.location);
  block.setPermutation(block.permutation.withState(STATE_FILL, fillLevel(count)));
}

export const foodWasteBinComponent = {
  onPlayerInteract({ block, player }) {
    if (!player) return;
    const item = mainHand(player)?.getItem();
    const count = countOf(block);
    if (isScrapable(item)) {
      if (count >= CAPACITY) return tell(player, "full");
      const amount = Math.min(player.isSneaking ? item.amount : 1, CAPACITY - count);
      consumeMainHand(player, amount);
      store(block, count + amount);
      block.dimension.playSound("block.composter.fill", block.location);
      return tell(player, "added", [`${count + amount}`, `${CAPACITY}`]);
    }
    if (count <= 0) return tell(player, "empty");
    give(player, FOOD_WASTE, count);
    store(block, 0);
    block.dimension.playSound("block.composter.empty", block.location);
  },

  onBreak({ block, dimension, brokenBlockPermutation }) {
    const where = dimension ?? block.dimension;
    const data = takeBlockData(where, block.location, null, brokenBlockPermutation?.type?.id);
    const count = Number(data?.count ?? 0);
    if (count <= 0) return;
    const at = { x: block.location.x + 0.5, y: block.location.y + 0.5, z: block.location.z + 0.5 };
    for (let left = count; left > 0; left -= 64) where.spawnItem(new ItemStack(FOOD_WASTE, Math.min(64, left)), at);
  },
};
