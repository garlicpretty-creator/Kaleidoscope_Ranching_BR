// 自動餵食器: sits on top of a trough. Pulls feed from the chest / hopper /
// barrel directly above it and tops the trough up.

import { FEEDS } from "../data/feeds.js";
import { TROUGH, addToTrough, itemsThatFit } from "./trough.js";
import { clockBlockEvents } from "../core/blockClock.js";

// ## The clock runs every 30 s (40 times a game day), so 4 items a pass keeps
// ## up with far more animals than one trough can serve.
const MAX_ITEMS_PER_TICK = 4;

export function tickAutoFeeder(block) {
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

export const autoFeederComponent = clockBlockEvents();
