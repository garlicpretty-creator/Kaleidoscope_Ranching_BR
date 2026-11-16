// 1.1 皮革線、絨毛線、布料線: the hand tools and the dyed rug.
//
// - 套索 (lasso): use it while looking at a Ranching animal within LASSO_RANGE
//   blocks; it goes on a lead to you, as with a lead held next to it.
// - 羽毛撣 (feather duster): use it on cobweb or a snow layer to clear that block
//   and the same blocks around it in a 3 × 3 patch.
// - 毛毯 (rug): use a vanilla dye on it to dye it (16 colours).
// - 皮圍裙 (leather apron): worn in the chest slot, every butcher-rack stroke has
//   APRON_SAVE_CHANCE not to cost the blade durability (systems/butcherRack.js).

import { EquipmentSlot, system } from "@minecraft/server";
import { isRanchAnimal } from "../core/animal.js";
import { rid } from "../core/ids.js";
import { consumeMainHand, damageMainHand, isCreative, mainHand } from "../core/inventory.js";
import { showActionBar } from "../core/actionBar.js";

export const LASSO_RANGE = 8;
export const APRON_SAVE_CHANCE = 0.3;
const DUSTABLE = ["minecraft:web", "minecraft:cobweb", "minecraft:snow_layer"];

export const RUG_COLORS = [
  "white", "orange", "magenta", "light_blue", "yellow", "lime", "pink", "gray",
  "light_gray", "cyan", "purple", "blue", "brown", "green", "red", "black",
];
const COLOR_STATE = "kaleidoscope_ranching:color";

function tell(player, key, values) {
  showActionBar(player, { translate: `kaleidoscope_ranching.message.${key}`, with: values });
}

/** Whether the player wears `itemId` in `slot` ("Chest", "Head"…). */
export function wearing(player, slot, itemId) {
  try {
    return player.getComponent("minecraft:equippable")?.getEquipment(EquipmentSlot[slot] ?? slot)?.typeId === rid(itemId);
  } catch {
    return false;
  }
}

// --- Lasso ------------------------------------------------------------------------

/** Puts `animal` on the player's lead. Returns true on success. */
export function lassoAnimal(player, animal) {
  const leash = animal?.getComponent("minecraft:leashable");
  if (!leash || !isRanchAnimal(animal)) return false;
  leash.leashTo(player);
  damageMainHand(player);
  animal.dimension.playSound("leashknot.place", animal.location);
  return true;
}

function throwLasso(player) {
  let hits = [];
  try {
    hits = player.getEntitiesFromViewDirection({ maxDistance: LASSO_RANGE });
  } catch {}
  const target = hits.map((hit) => hit.entity).find((entity) => isRanchAnimal(entity));
  if (!target || !lassoAnimal(player, target)) tell(player, "lasso.missed");
}

export const lassoItemComponent = {
  onUse({ source }) {
    if (source?.typeId === "minecraft:player") system.run(() => throwLasso(source));
  },
};

// --- Feather duster -------------------------------------------------------------

/** Clears the dustable block and its like in the 3 × 3 patch around it. Returns how many went. */
export function dust(player, block) {
  if (!DUSTABLE.includes(block?.typeId)) return 0;
  const type = block.typeId;
  const { x, y, z } = block.location;
  let cleared = 0;
  for (let dx = -1; dx <= 1; dx++) {
    for (let dz = -1; dz <= 1; dz++) {
      try {
        const other = block.dimension.getBlock({ x: x + dx, y, z: z + dz });
        if (other?.typeId !== type) continue;
        other.setType("minecraft:air");
        cleared++;
      } catch {}
    }
  }
  if (cleared) {
    damageMainHand(player);
    block.dimension.playSound("dig.cloth", block.location);
  }
  return cleared;
}

export const featherDusterItemComponent = {
  onUseOn({ source, block }) {
    if (source?.typeId === "minecraft:player") system.run(() => dust(source, block));
  },
};

// --- Rug --------------------------------------------------------------------------

/** Dyes a rug with the held vanilla dye. Returns true if it changed colour. */
export function dyeRug(block, player) {
  const held = mainHand(player)?.getItem();
  const match = held?.typeId.match(/^minecraft:(\w+)_dye$/);
  const color = match && RUG_COLORS.includes(match[1]) ? match[1] : undefined;
  if (!color) return false;
  if (block.permutation.getState(COLOR_STATE) === color) return false;
  block.setPermutation(block.permutation.withState(COLOR_STATE, color));
  if (!isCreative(player)) consumeMainHand(player);
  block.dimension.playSound("dye.use", block.location);
  return true;
}

export const rugComponent = {
  onPlayerInteract({ block, player }) {
    if (player) dyeRug(block, player);
  },
};
