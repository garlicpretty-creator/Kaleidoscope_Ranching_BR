// Small helpers with no lifecycle responsibility.

import { system, GameMode, EquipmentSlot, BlockVolume } from "@minecraft/server";
import { CARE, TEST_WITH_VANILLA } from "../data/care_config.js";
import { SPECIES } from "../data/species.js";
import { FAMILY_LIVESTOCK } from "../data/m1_contract.js";
import { getBlockData, setBlockData, clearBlockData } from "../core/blockStore.js";
import { dropItems, stacksOf } from "../core/inventory.js";

/** Current game day and absolute tick, from the shared clock (core/time.js). */
export { today, nowTick as absTime } from "../core/time.js";

// ---- per-block storage (timestamps the 企劃書 calls 放入時記錄時間) ----
// Slots live in one object per block in core/blockStore.js.
export function blockGet(block, slot) {
  return getBlockData(block, {})[slot];
}
export function blockSet(block, slot, value) {
  setBlockData(block, { ...getBlockData(block, {}), [slot]: value });
}
export function blockClear(block, ...slots) {
  const data = { ...getBlockData(block, {}) };
  for (const s of slots) delete data[s];
  if (Object.keys(data).length) setBlockData(block, data);
  else clearBlockData(block.dimension, block.location);
}

// ---- block states ----
export function getState(block, name) {
  return block.permutation.getState(`kaleidoscope_ranching:${name}`);
}
export function setStates(block, states) {
  let p = block.permutation;
  for (const [k, v] of Object.entries(states)) p = p.withState(`kaleidoscope_ranching:${k}`, v);
  block.setPermutation(p);
}

// ---- player items ----
export function isCreative(player) {
  try {
    return player.getGameMode() === GameMode.Creative;
  } catch {
    return false;
  }
}
export function mainhand(player) {
  return player.getComponent("minecraft:equippable")?.getEquipment(EquipmentSlot.Mainhand);
}
export function setMainhand(player, stack) {
  player.getComponent("minecraft:equippable")?.setEquipment(EquipmentSlot.Mainhand, stack);
}
/** Consume `n` from the mainhand stack (not in creative). */
export function consumeMainhand(player, n = 1) {
  if (isCreative(player)) return;
  const s = mainhand(player);
  if (!s) return;
  if (s.amount > n) {
    s.amount -= n;
    setMainhand(player, s);
  } else setMainhand(player, undefined);
}
/** Damage the mainhand tool by 1; breaks it at max. */
export function damageMainhand(player) {
  if (isCreative(player)) return;
  const s = mainhand(player);
  const d = s?.getComponent("minecraft:durability");
  if (!d) return;
  if (d.damage + 1 >= d.maxDurability) {
    setMainhand(player, undefined);
    player.playSound("random.break");
  } else {
    d.damage += 1;
    setMainhand(player, s);
  }
}
export function give(player, itemId, amount = 1) {
  if (amount <= 0) return;
  const inv = player.getComponent("minecraft:inventory")?.container;
  for (const stack of stacksOf(itemId, amount)) {
    const left = inv ? inv.addItem(stack) : stack;
    if (left) player.dimension.spawnItem(left, player.location);
  }
}
export function dropAt(dimension, location, itemId, amount = 1) {
  if (amount > 0) dropItems(dimension, itemId, amount, location);
}

// ---- pen queries ----
export function center(block) {
  const { x, y, z } = block.location;
  return { x: x + 0.5, y: y + 0.5, z: z + 0.5 };
}
/** Ranching animals within the care radius of a block (capped). */
export function animalsNear(block, radius = CARE.RADIUS) {
  const query = { location: center(block), maxDistance: radius };
  if (!TEST_WITH_VANILLA) query.families = [FAMILY_LIVESTOCK];
  let list = block.dimension.getEntities(query);
  if (TEST_WITH_VANILLA) list = list.filter((e) => SPECIES[e.typeId]);
  return list.slice(0, CARE.MAX_ANIMALS_PER_TICK);
}
/** Count blocks of a type in the pen volume around a block. */
export function countBlocksNear(block, typeId, radius = CARE.RADIUS, half = CARE.PEN_HALF_HEIGHT) {
  const { x, y, z } = block.location;
  const from = { x: x - radius, y: y - half, z: z - radius };
  const to = { x: x + radius, y: y + half, z: z + radius };
  try {
    const list = block.dimension.getBlocks(new BlockVolume(from, to), { includeTypes: [typeId] }, false);
    let n = 0;
    for (const _ of list.getBlockLocationIterator()) n++;
    return n;
  } catch {
    // Fallback: manual scan (only if getBlocks is unavailable).
    let n = 0;
    for (let dx = -radius; dx <= radius; dx++)
      for (let dy = -half; dy <= half; dy++)
        for (let dz = -radius; dz <= radius; dz++) {
          try {
            if (block.dimension.getBlock({ x: x + dx, y: y + dy, z: z + dz })?.typeId === typeId) n++;
          } catch {}
        }
    return n;
  }
}

export function later(fn) {
  system.run(fn);
}
