// 牧鈴 (cowbell): ring it and nearby animals that trust you follow you.
//
// Every Ranching animal within 32 blocks with at least BOND_HEARTS hearts is
// "called" for one minute: it follows a player holding the cowbell, like
// animals follow wheat, from much farther away (entity group `called`, made by
// tools/gen_entities.mjs, which also ends it on a timer).

import { system } from "@minecraft/server";
import { getAffection } from "../core/husbandry.js";
import { isRanchAnimal } from "../core/animal.js";
import { AMBIENT, cue } from "../core/feedback.js";
import { wakeNear } from "./sleep.js";

export const CALL_RADIUS = 32;
/** Hearts (0-5) an animal needs before it answers the bell. */
export const BOND_HEARTS = 3;


export function ring(player) {
  wakeNear(player.dimension, player.location, CALL_RADIUS, "cowbell");
  const animals = player.dimension
    .getEntities({ location: player.location, maxDistance: CALL_RADIUS })
    .filter((entity) => isRanchAnimal(entity) && getAffection(entity) >= BOND_HEARTS);
  let called = 0;
  for (const animal of animals) {
    try {
      animal.triggerEvent("kaleidoscope_ranching:called");
      called++;
      cue(animal, AMBIENT[animal.typeId]); // answers the bell
    } catch {}
  }
  player.dimension.playSound("block.bell.hit", player.location);
  // Nobody bonded in earshot: only the bell, no answer.
  return called;
}

export const cowbellItemComponent = {
  onUse({ source }) {
    if (source?.typeId === "minecraft:player") system.run(() => ring(source));
  },
};
