// Player inventory helpers.

import { EquipmentSlot, GameMode, ItemStack } from "@minecraft/server";

export function isCreative(player) {
  return player.getGameMode() === GameMode.Creative;
}

export function mainHand(player) {
  return player.getComponent("minecraft:equippable")?.getEquipmentSlot(EquipmentSlot.Mainhand);
}

/** Gives items, dropping whatever does not fit at the player's feet. */
export function give(player, typeId, amount = 1) {
  let left = amount;
  while (left > 0) {
    const stack = new ItemStack(typeId, 1);
    const size = Math.min(left, stack.maxAmount);
    stack.amount = size;
    left -= size;
    const rest = player.getComponent("minecraft:inventory")?.container?.addItem(stack) ?? stack;
    if (rest) player.dimension.spawnItem(rest, player.location);
  }
}

/** Gives an already built stack (keeps dynamic properties). */
export function giveStack(player, stack) {
  const rest = player.getComponent("minecraft:inventory")?.container?.addItem(stack) ?? stack;
  if (rest) player.dimension.spawnItem(rest, player.location);
}

/** Removes `amount` from the main-hand stack. No-op in creative. */
export function consumeMainHand(player, amount = 1) {
  if (isCreative(player)) return;
  const slot = mainHand(player);
  const item = slot?.getItem();
  if (!item) return;
  if (item.amount > amount) {
    item.amount -= amount;
    slot.setItem(item);
  } else {
    slot.setItem(undefined);
  }
}

/** Counts items of any of the given types in the player's inventory. */
export function countItems(player, typeIds) {
  const wanted = new Set(typeIds);
  const container = player.getComponent("minecraft:inventory")?.container;
  let total = 0;
  for (let i = 0; i < (container?.size ?? 0); i++) {
    const item = container.getItem(i);
    if (item && wanted.has(item.typeId)) total += item.amount;
  }
  return total;
}

/**
 * Removes `amount` items chosen from `typeIds`, in the order given (so callers
 * can list the lowest quality first). Returns the type ids actually removed,
 * one entry per item, or null if the player does not have enough. In creative
 * nothing is removed but the would-be selection is still returned.
 */
export function takeItems(player, typeIds, amount) {
  const container = player.getComponent("minecraft:inventory")?.container;
  if (!container) return null;
  const plan = [];
  let left = amount;
  for (const typeId of typeIds) {
    for (let i = 0; i < container.size && left > 0; i++) {
      const item = container.getItem(i);
      if (!item || item.typeId !== typeId) continue;
      const take = Math.min(left, item.amount);
      plan.push({ slot: i, take, typeId });
      left -= take;
    }
  }
  if (left > 0) return null;
  if (!isCreative(player)) {
    for (const { slot, take } of plan) {
      const item = container.getItem(slot);
      if (item.amount > take) {
        item.amount -= take;
        container.setItem(slot, item);
      } else {
        container.setItem(slot, undefined);
      }
    }
  }
  return plan.flatMap(({ take, typeId }) => Array(take).fill(typeId));
}

/** Spends one point of durability on the main-hand tool, honouring Unbreaking. */
export function damageMainHand(player, amount = 1) {
  if (isCreative(player)) return;
  const slot = mainHand(player);
  const item = slot?.getItem();
  const durability = item?.getComponent("minecraft:durability");
  if (!durability) return;
  let unbreaking = 0;
  try {
    unbreaking = item.getComponent("minecraft:enchantable")?.getEnchantment("unbreaking")?.level ?? 0;
  } catch {}
  let chance = 1 / (unbreaking + 1);
  try {
    chance = durability.getDamageChance(unbreaking) / 100;
  } catch {}
  for (let i = 0; i < amount; i++) {
    if (Math.random() > chance) continue;
    if (durability.damage + 1 >= durability.maxDurability) {
      slot.setItem(undefined);
      player.playSound("random.break");
      return;
    }
    durability.damage += 1;
  }
  slot.setItem(item);
}
