// 自動餵食器: sits on top of a trough. Pulls feed from the chest / hopper /
// barrel directly above it and tops the trough up.

import { FEEDS } from "../data/feeds.js";
import { TROUGH, addToTrough, itemsThatFit } from "./trough.js";

const MAX_ITEMS_PER_TICK = 4;

function tick(block) {
  const trough = block.below();
  if (trough?.typeId !== TROUGH) return;
  const container = block.above()?.getComponent("minecraft:inventory")?.container;
  if (!container) return;
  let moved = 0;
  for (let i = 0; i < container.size && moved < MAX_ITEMS_PER_TICK; i++) {
    const stack = container.getItem(i);
    const feed = stack && FEEDS[stack.typeId];
    if (!feed) continue;
    const n = Math.min(itemsThatFit(trough, feed, stack.amount), MAX_ITEMS_PER_TICK - moved);
    if (n <= 0) continue;
    addToTrough(trough, feed.kind, n * feed.units);
    if (stack.amount > n) {
      stack.amount -= n;
      container.setItem(i, stack);
    } else container.setItem(i, undefined);
    moved += n;
  }
}

export const autoFeederComponent = {
  onTick({ block }) {
    tick(block);
  },
};
