// Facts about a Ranching animal entity that every milestone can read.

import { ANIMALS } from "../data/animals.js";
import { SEX_PROPERTY, rid, shortId } from "./ids.js";

const BY_TYPE = new Map(ANIMALS.map((animal) => [rid(animal.id), animal]));

/** The animals.js row for a Ranching animal entity, or undefined. */
export function speciesOf(entity) {
  return BY_TYPE.get(entity?.typeId);
}

export function isRanchAnimal(entity) {
  return BY_TYPE.has(entity?.typeId);
}

/** "female" | "male" */
export function sexOf(entity) {
  return entity.getProperty(SEX_PROPERTY) === "male" ? "male" : "female";
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
