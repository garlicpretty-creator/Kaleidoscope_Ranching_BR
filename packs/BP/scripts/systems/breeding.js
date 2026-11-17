// M1: mating and pregnancy for mammals.
//
// Feeding an adult its breeding food puts it in love for 30 seconds. When a
// male and a female of the same species are in love within 8 blocks, the
// female becomes pregnant and gives birth three game days later. Two animals of
// the same sex never mate. Birds do not use this: they breed through fertilized
// eggs (systems/nest.js).

import { system, world } from "@minecraft/server";
import {
  BREED_COOLDOWN_TICKS,
  GESTATION_DAYS,
  LOVE_TICKS,
  MATE_RADIUS,
  AFFECTION,
} from "../data/animals.js";
import { isBaby, nearbySameSpecies, sexOf, speciesOf } from "../core/animal.js";
import { onAnimalAdded } from "../core/content.js";
import { createRegistry, registerClockTask } from "../core/clock.js";
import { canBreed, getAffection, notifyBorn, notifyMated } from "../core/husbandry.js";
import { dp, rid } from "../core/ids.js";
import { registerEntityInteraction } from "../core/interact.js";
import { consumeMainHand } from "../core/inventory.js";
import { TICKS_PER_DAY, nowTick } from "../core/time.js";
import { DP_PREGNANT_UNTIL_DAY } from "../data/m1_contract.js";
import { grumble, refuse } from "../core/feedback.js";

const LOVE_UNTIL = dp("love_until");
const COOLDOWN_UNTIL = dp("breed_cooldown_until");
const PREGNANT_DUE = dp("pregnant_due");
const MATE_AFFECTION = dp("mate_affection");
// Read by M2's notebook (data/m1_contract.js): the game day the birth is due.
const PREGNANT_UNTIL_DAY = DP_PREGNANT_UNTIL_DAY;

const pregnancies = createRegistry("pregnancies");

/** Entity type id -> set of breeding food ids. Filled by startBreeding. */
const BREED_ITEMS = new Map();

function numberProperty(entity, key) {
  const value = entity.getDynamicProperty(key);
  return typeof value === "number" ? value : 0;
}

export function isPregnant(entity) {
  return numberProperty(entity, PREGNANT_DUE) > 0;
}

/** Whole days until a pregnant mother gives birth (at least 1), or 0 when not pregnant. */
export function daysToBirth(entity, now = nowTick()) {
  const due = numberProperty(entity, PREGNANT_DUE);
  return due > 0 ? Math.max(1, Math.ceil((due - now) / TICKS_PER_DAY)) : 0;
}

/** True while an animal rests after mating. */
export function isResting(entity, now = nowTick()) {
  return resting(entity, now);
}

function inLove(entity, now) {
  return numberProperty(entity, LOVE_UNTIL) > now;
}

function resting(entity, now) {
  return numberProperty(entity, COOLDOWN_UNTIL) > now;
}


function hearts(entity) {
  const { x, y, z } = entity.location;
  for (let i = 0; i < 4; i++) {
    try {
      entity.dimension.spawnParticle("minecraft:heart_particle", {
        x: x + (Math.random() - 0.5),
        y: y + 0.8 + Math.random() * 0.5,
        z: z + (Math.random() - 0.5),
      });
    } catch {}
  }
}

function canMateNow(entity, now) {
  return !isBaby(entity) && inLove(entity, now) && !resting(entity, now) && !(sexOf(entity) === "female" && isPregnant(entity)) && canBreed(entity);
}

function conceive(mother, father, now) {
  // ## The species row decides the length, so a registered animal's `days` counts.
  const due = now + (speciesOf(mother)?.days ?? GESTATION_DAYS) * TICKS_PER_DAY;
  mother.setDynamicProperty(PREGNANT_DUE, due);
  mother.setDynamicProperty(PREGNANT_UNTIL_DAY, Math.floor(due / TICKS_PER_DAY));
  mother.setDynamicProperty(MATE_AFFECTION, getAffection(father));
  for (const parent of [mother, father]) {
    parent.setDynamicProperty(LOVE_UNTIL, undefined);
    parent.setDynamicProperty(COOLDOWN_UNTIL, now + BREED_COOLDOWN_TICKS);
    tryEvent(parent, "kaleidoscope_ranching:make_persistent");
    hearts(parent);
  }
  try {
    mother.dimension.spawnEntity("minecraft:xp_orb", mother.location);
  } catch {}
  pregnancies.add(mother.id);
  notifyMated(mother, father);
}

function feed(player, animal) {
  const now = nowTick();
  if (sexOf(animal) === "female" && isPregnant(animal)) return refuse(player, animal);
  if (resting(animal, now)) return refuse(player, animal);
  if (!canBreed(animal)) return refuse(player, animal); // not cared for enough

  consumeMainHand(player);
  animal.setDynamicProperty(LOVE_UNTIL, now + LOVE_TICKS);
  hearts(animal);

  const others = nearbySameSpecies(animal, MATE_RADIUS).filter((other) => canMateNow(other, now));
  const mate = others.find((other) => sexOf(other) !== sexOf(animal));
  if (mate) {
    const [mother, father] = sexOf(animal) === "female" ? [animal, mate] : [mate, animal];
    conceive(mother, father, now);
  } else if (others.length) {
    grumble(others[0]); // only the same sex near: no mate
  }
}

function giveBirth(mother) {
  const species = speciesOf(mother);
  if (!species) return;
  const mateAffection = numberProperty(mother, MATE_AFFECTION);
  mother.setDynamicProperty(PREGNANT_DUE, undefined);
  mother.setDynamicProperty(PREGNANT_UNTIL_DAY, undefined);
  mother.setDynamicProperty(MATE_AFFECTION, undefined);
  pregnancies.remove(mother.id);

  const baby = mother.dimension.spawnEntity(mother.typeId, mother.location);
  tryEvent(baby, "kaleidoscope_ranching:become_baby");
  tryEvent(baby, "kaleidoscope_ranching:make_persistent");
  if (species.id === "sheep") {
    const color = mother.getComponent("minecraft:color")?.value;
    if (Number.isInteger(color)) baby.triggerEvent(`kaleidoscope_ranching:set_color_${color & 15}`);
  }
  if (species.id === "rabbit") {
    const variant = mother.getComponent("minecraft:variant")?.value;
    if (Number.isInteger(variant)) baby.triggerEvent(`kaleidoscope_ranching:set_variant_${variant}`);
  }
  hearts(mother);
  const inherited = Math.floor(((getAffection(mother) + mateAffection) / 2) * AFFECTION.inheritedShare);
  notifyBorn(baby, mother, inherited);
}

/**
 * An animal that left the world and came back as a new entity (the animal
 * crate) keeps its pregnancy: track the new id instead of the old one.
 */
export function adoptPregnancy(oldId, entity) {
  pregnancies.remove(oldId);
  if (numberProperty(entity, PREGNANT_DUE) > 0) pregnancies.add(entity.id);
}

function checkPregnancy(entity) {
  if (!entity?.isValid) return;
  const due = numberProperty(entity, PREGNANT_DUE);
  if (due > 0 && due <= nowTick()) giveBirth(entity);
}

function indexBreedItems(animal) {
  if (animal.reproduction === "gestation") BREED_ITEMS.set(rid(animal.id), new Set((animal.breedItems ?? []).map(rid)));
}

/** Triggers an entity event that animals from other add-ons may not define. */
function tryEvent(entity, name) {
  try {
    entity.triggerEvent(name);
  } catch {}
}

export function startBreeding(animals) {
  animals.forEach(indexBreedItems);
  // Animals other add-ons register later breed the same way.
  onAnimalAdded(indexBreedItems);

  registerEntityInteraction({
    id: "m1:breeding",
    priority: 50,
    match: ({ entity, item }) => {
      const foods = BREED_ITEMS.get(entity.typeId);
      return Boolean(foods && item && foods.has(item.typeId) && !isBaby(entity));
    },
    handle: ({ player, entity }) => feed(player, entity),
  });

  registerClockTask("pregnancies", () => {
    for (const id of pregnancies.all()) {
      const entity = world.getEntity(id);
      if (entity) checkPregnancy(entity);
    }
  });

  world.afterEvents.entityLoad.subscribe(({ entity }) => {
    if (speciesOf(entity)) system.run(() => checkPregnancy(entity));
  });
  world.afterEvents.entityDie.subscribe(({ deadEntity }) => {
    try {
      if (speciesOf(deadEntity)) pregnancies.remove(deadEntity.id);
    } catch {}
  });
}
