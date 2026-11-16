// Block containers (hoppers, chests, barrels) next to Ranching blocks.
//
// ## Bedrock hoppers cannot push into or pull from custom blocks, so automated
// ## Ranching blocks (1.1: cream separator, milking rack, silage barrel, spinning
// ## wheel, loom) reach into the container above them for inputs and put their
// ## outputs into the container below, on the ranch clock.

import { ItemStack } from "@minecraft/server";

/** The container of a block, or undefined if it has none. */
export function containerOf(block) {
  try {
    return block?.getComponent("minecraft:inventory")?.container ?? undefined;
  } catch {
    return undefined;
  }
}

/** How many of the given item ids the container holds. */
export function countIn(container, ids) {
  let total = 0;
  for (let i = 0; i < container.size; i++) {
    const stack = container.getItem(i);
    if (stack && ids.includes(stack.typeId)) total += stack.amount;
  }
  return total;
}

/** Removes `amount` items among `ids` (earlier ids first); returns the ids removed, one per item. */
export function takeFrom(container, ids, amount) {
  const removed = [];
  for (const id of ids) {
    for (let i = 0; i < container.size && removed.length < amount; i++) {
      const stack = container.getItem(i);
      if (!stack || stack.typeId !== id) continue;
      const n = Math.min(stack.amount, amount - removed.length);
      for (let k = 0; k < n; k++) removed.push(id);
      if (stack.amount > n) {
        stack.amount -= n;
        container.setItem(i, stack);
      } else container.setItem(i, undefined);
    }
  }
  return removed;
}

/** Adds items; returns how many did not fit. */
export function putInto(container, typeId, amount) {
  let left = amount;
  while (left > 0) {
    const stack = new ItemStack(typeId, 1);
    const size = Math.min(left, stack.maxAmount);
    stack.amount = size;
    const rest = container.addItem(stack);
    const notPlaced = rest?.amount ?? 0;
    left -= size - notPlaced;
    if (notPlaced) break;
  }
  return left;
}
