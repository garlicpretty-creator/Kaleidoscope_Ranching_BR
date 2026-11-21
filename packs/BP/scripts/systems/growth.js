// 金蒲公英: a golden dandelion pauses a Ranching baby's growth, a second one lets it grow again,
// as with vanilla animals.
//
// ## The engine does the pausing and takes the flower (minecraft:ageable pause_growth_items and
// ## reset_growth_items, tools/gen_entities.mjs). The script API cannot read whether a baby's
// ## growth is paused, so the script keeps its own flag, flipped on each golden dandelion used on
// ## a Ranching baby, and Ranching's own ways of growing a baby up (the nursing bottle,
// ## systems/milking.js, and the nursing trough, systems/facilities.js) leave a paused baby alone.

import { system, world } from "@minecraft/server";
import { isBaby, isRanchAnimal } from "../core/animal.js";
import { dp } from "../core/ids.js";

export const GOLDEN_DANDELION = "minecraft:golden_dandelion";
export const GROWTH_PAUSED = dp("growth_paused");

/** Whether this baby's growth was paused with a golden dandelion. */
export const isGrowthPaused = (entity) => entity.getDynamicProperty(GROWTH_PAUSED) === true;

/** Flips the flag, as the engine flips the pause, when a golden dandelion is used on a baby. */
export function toggleGrowthPause(entity) {
  const paused = !isGrowthPaused(entity);
  entity.setDynamicProperty(GROWTH_PAUSED, paused ? true : undefined);
  return paused;
}

let started = false;
export function startGrowthPause() {
  if (started) return;
  started = true;
  // Not cancelled: the engine's ageable component still handles the click and uses up the flower.
  world.beforeEvents.playerInteractWithEntity.subscribe(({ target, itemStack }) => {
    if (itemStack?.typeId !== GOLDEN_DANDELION || !target || !isRanchAnimal(target) || !isBaby(target)) return;
    system.run(() => {
      if (target.isValid && isBaby(target)) toggleGrowthPause(target);
    });
  });
}
