// Facts about a Ranching animal entity that every milestone can read.

import { animalByType } from "./content.js";
import { SEX_PROPERTY, rid, shortId } from "./ids.js";

/**
 * The animal row for a Ranching animal entity, or undefined. Includes
 * animals other add-ons registered through the public API (core/content.js).
 */
export function speciesOf(entity) {
  return animalByType(entity?.typeId);
}

export function isRanchAnimal(entity) {
  return animalByType(entity?.typeId) !== undefined;
}

/**
 * "female" | "male". Ranching's own animals use the sex entity property;
 * animals from other add-ons say it with the ranching_male / ranching_female
 * families instead (企劃書 標籤契約).
 */
export function sexOf(entity) {
  let value;
  try {
    value = entity.getProperty(SEX_PROPERTY);
  } catch {}
  if (value === undefined) {
    try {
      return entity.matches({ families: ["ranching_male"] }) ? "male" : "female";
    } catch {
      return "female";
    }
  }
  return value === "male" ? "male" : "female";
}

export function isFemale(entity) {
  return sexOf(entity) === "female";
}

export function isBaby(entity) {
  return entity.hasComponent("minecraft:is_baby");
}

export function isAdultFemale(entity) {
  return isRanchAnimal(entity) && !isBaby(entity) && isFemale(entity);
}

/** Animals of the same species near `entity`, excluding itself. */
export function nearbySameSpecies(entity, radius) {
  return entity.dimension
    .getEntities({ type: entity.typeId, location: entity.location, maxDistance: radius })
    .filter((other) => other.id !== entity.id);
}

/** Ranching animals of `species` (short id) within `radius` of a location. */
export function animalsNear(dimension, location, species, radius) {
  return dimension.getEntities({ type: rid(species), location, maxDistance: radius });
}

export { shortId };
