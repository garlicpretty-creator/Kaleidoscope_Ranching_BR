// Husbandry provider contract.
//
// ## M2 (affection, daily needs, settlement) owns the answers to "is this animal
// ## well cared for today?" and "what quality does it produce?". M1 (breeding)
// ## and M3 (milking, laying, hatching) only ask. They ask through this module,
// ## so M2 can be developed separately and plugged in with one call:
// ##
// ##   import { registerHusbandryProvider } from "./core/husbandry.js";
// ##   registerHusbandryProvider({ getAffection, canBreed, production, ... });
// ##
// ## Every hook is optional. Missing hooks fall back to the defaults below,
// ## which describe an animal with no care system: 0 hearts, always able to
// ## breed, produces every day at plain quality.

import { AFFECTION, FERTILIZED_CHANCE_BY_AFFECTION } from "../data/animals.js";
import { speciesOf } from "./animal.js";
import { emitRanchEvent } from "./events.js";

/** @typedef {"plain" | "fine" | "superb"} Quality */

const DEFAULTS = {
  /** Affection in hearts, AFFECTION.min..AFFECTION.max. */
  getAffection(_entity) {
    return AFFECTION.min;
  },

  /** Whether the animal may mate now (M2: both animals' needs met today). */
  canBreed(_entity) {
    return true;
  },

  /**
   * Whether the animal yields its daily product on `day`, and at what quality.
   * Called once per animal per elapsed day when milk or eggs are collected.
   * @returns {{ produces: boolean, quality: Quality }}
   */
  production(_entity, _day) {
    return { produces: true, quality: "plain" };
  },

  /** Notification: two animals mated. `mother` is now pregnant (mammals only). */
  onMated(_mother, _father) {},

  /** Notification: a baby was born or hatched. `mother` may be undefined (incubator). */
  onBorn(_baby, _mother, _inheritedAffection) {},

  /** Notification: a player cared for the animal: "pet" | "brush" | "treat" | "ear_tag" | "nursing_bottle". */
  onCared(_entity, _player, _kind) {},
};

let provider = { ...DEFAULTS };

/** Installs the husbandry implementation. Hooks not given keep their default. */
export function registerHusbandryProvider(implementation) {
  provider = { ...DEFAULTS, ...implementation };
}

function safe(name, fallback, ...args) {
  try {
    return provider[name](...args);
  } catch (error) {
    console.warn(`[kaleidoscope_ranching] husbandry.${name} failed: ${error}`);
    return fallback;
  }
}

export function getAffection(entity) {
  const value = Number(safe("getAffection", AFFECTION.min, entity));
  return Math.max(AFFECTION.min, Math.min(AFFECTION.max, Number.isFinite(value) ? value : AFFECTION.min));
}

export function canBreed(entity) {
  return safe("canBreed", true, entity) !== false;
}

/** @returns {{ produces: boolean, quality: Quality }} */
export function production(entity, day) {
  const result = safe("production", null, entity, day);
  const quality = ["plain", "fine", "superb"].includes(result?.quality) ? result.quality : "plain";
  return { produces: result?.produces !== false, quality };
}

export function notifyMated(mother, father) {
  safe("onMated", undefined, mother, father);
  try {
    emitRanchEvent("mated", { animal: mother.typeId, mother: mother.id, father: father.id });
  } catch {}
}

export function notifyBorn(baby, mother, inheritedAffection) {
  safe("onBorn", undefined, baby, mother, inheritedAffection);
  // ## Every birth and hatching passes through here, so this is where the
  // ## ranch event is reported (core/events.js).
  try {
    const hatched = speciesOf(baby)?.reproduction === "egg";
    emitRanchEvent(hatched ? "hatched" : "born", { animal: baby.typeId, entity: baby.id, mother: mother?.id });
  } catch {}
}

export function notifyCared(entity, player, kind) {
  safe("onCared", undefined, entity, player, kind);
  try {
    emitRanchEvent("cared", { animal: entity.typeId, entity: entity.id, player: player?.id, kind });
  } catch {}
}

/** Chance that a hen lays a fertilized egg, given a male of her species is in range. */
export function fertilizedChance(hen) {
  return FERTILIZED_CHANCE_BY_AFFECTION[Math.round(getAffection(hen))] ?? FERTILIZED_CHANCE_BY_AFFECTION[0];
}

/** Affection a newborn starts with, from its parents' average. */
export function inheritedAffection(...parents) {
  const known = parents.filter(Boolean);
  if (!known.length) return AFFECTION.min;
  const average = known.reduce((sum, parent) => sum + getAffection(parent), 0) / known.length;
  return Math.floor(average * AFFECTION.inheritedShare);
}
