// 1.1 擠奶架 (milking rack): automated milking.
//
// Use the rack while leading a milkable adult female: she is tied to it (one
// animal per rack). Use it again with nothing on a lead: she is handed back.
// Once per game day, on the ranch clock, the rack milks her (no quality
// grades), taking an empty glass bottle from the container above
// and putting the milk into the container below (or on top of the rack when
// there is none). It shares the pail's once-a-day stamp, so a cow milked by
// hand is not milked again by the rack, and the other way round.
//
// ## The animal is tied with the same invisible hitch knot as the hitching
// ## post (systems/hitchingPost.js).

import { system } from "@minecraft/server";
import { isBaby, isFemale, speciesOf } from "../core/animal.js";
import { clockBlockEvents, defineClockBlock } from "../core/blockClock.js";
import { containerOf, putInto, takeFrom } from "../core/containers.js";
import { emitRanchEvent } from "../core/events.js";
import { production } from "../core/husbandry.js";
import { rid } from "../core/ids.js";
import { dropItems } from "../core/inventory.js";
import { today } from "../core/time.js";
import { ensureKnot, findKnot, free, leash, ledBy } from "./hitchingPost.js";
import { LAST_MILKED_DAY, milkOf } from "./milking.js";
import { cue, refuse } from "../core/feedback.js";

export const MILKING_RACK = rid("milking_rack");


export const isMilkable = (animal) =>
  speciesOf(animal)?.dailyProduct?.via === "milking_pail" && !isBaby(animal) && isFemale(animal);

/** The animal tied to this rack, or undefined. */
export function rackAnimal(block) {
  const knot = findKnot(block);
  return knot ? ledBy(knot, block.dimension, block.location)[0] : undefined;
}

/** Ties the milkable female the player leads to this rack, or hands the tied one back.
 *  (1.5: the milking stall, systems/facilities.js, is tied the same way.) */
export function tieOrUntie(block, player) {
  const led = ledBy(player, block.dimension, block.location);
  if (led.length) {
    if (rackAnimal(block)) return refuse(player); // one animal per rack
    const cow = led.find(isMilkable);
    if (!cow) return refuse(player, led[0]); // not a milkable adult female
    leash(cow).leashTo(ensureKnot(block));
    block.dimension.playSound("leashknot.place", block.location);
    return;
  }
  const tied = rackAnimal(block);
  if (!tied) return refuse(player); // nobody tied here
  leash(tied).leashTo(player);
  cue(block, "leashknot.break");
}

/** Milks the tied animal if she has not been milked today. Returns the bottle id, or undefined. */
export function tickMilkingRack(block) {
  return milkInto(rackAnimal(block), block, containerOf(block.above()), containerOf(block.below()));
}

/** Milks `animal` at `block` if she is ready today: an empty bottle from `above`, her milk into
 *  `below` (or on top of the block when there is none). Returns the bottle id, or undefined. */
export function milkInto(animal, block, above, below) {
  if (!animal || !isMilkable(animal)) return undefined;
  const day = today();
  if (animal.getDynamicProperty(LAST_MILKED_DAY) === day) return undefined;
  const { produces } = production(animal, day);
  if (!produces) return undefined;
  if (!above || !takeFrom(above, ["minecraft:glass_bottle"], 1).length) return undefined;

  animal.setDynamicProperty(LAST_MILKED_DAY, day);
  const bottle = milkOf(speciesOf(animal));
  if (!below || putInto(below, bottle, 1)) {
    const { x, y, z } = block.location;
    dropItems(block.dimension, bottle, 1, { x: x + 0.5, y: y + 1.2, z: z + 0.5 });
  }
  emitRanchEvent("harvested", { animal: animal.typeId, entity: animal.id, product: "milk", items: { [bottle]: 1 } });
  block.dimension.playSound("mob.cow.milk", block.location);
  return bottle;
}

const brokenType = (event) => event.brokenBlockPermutation?.type?.id;

export const milkingRackComponent = clockBlockEvents({
  onPlayerInteract({ block, player }) {
    if (player) system.run(() => tieOrUntie(block, player));
  },
  onPlayerBreak(event) {
    free(event.dimension ?? event.block.dimension, event.block.location, brokenType(event));
  },
  onBreak(event) {
    free(event.dimension ?? event.block.dimension, event.block.location, brokenType(event));
  },
});

export function startMilkingRacks() {
  defineClockBlock(MILKING_RACK, "milking_racks", tickMilkingRack);
}
