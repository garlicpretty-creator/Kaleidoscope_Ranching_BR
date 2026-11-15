// Runtime view of Ranching's content: the built-in tables in data/ plus
// whatever other add-ons registered this session through the public API
// (api/ranchingApi.js).
//
// ## Systems read animals, carcass cuts and processing recipes through here
// ## rather than from data/ directly, so an animal registered after startup
// ## is milked, lays, breeds and is butchered like a built-in one. Built-in
// ## entries always win: additions can never replace them. Registrations live
// ## in memory only and are gone on the next world load (企劃書 API 規則).

import { ANIMALS } from "../data/animals.js";
import { BUTCHER_TABLE } from "../data/butcher.js";
import { PROCESSING_RECIPES } from "../data/processing.js";
import { rid } from "./ids.js";

// --- animals -------------------------------------------------------------------

const BUILTIN_ANIMALS = new Map(ANIMALS.map((animal) => [rid(animal.id), animal]));
const extraAnimals = new Map();

/** The animal row for an entity type id (full id), or undefined. */
export function animalByType(typeId) {
  return BUILTIN_ANIMALS.get(typeId) ?? extraAnimals.get(typeId);
}

/** Every animal row: built-in first, then registered ones. */
export function allAnimals() {
  return [...BUILTIN_ANIMALS.values(), ...extraAnimals.values()];
}

/** Adds or replaces a registered animal. Returns false for a built-in id. */
export function addAnimal(row) {
  const typeId = rid(row.id);
  if (BUILTIN_ANIMALS.has(typeId)) return false;
  extraAnimals.set(typeId, row);
  for (const listener of animalListeners) listener(row);
  return true;
}

const animalListeners = [];
/** Calls `listener(row)` for every animal added from now on (systems that index animals). */
export function onAnimalAdded(listener) {
  animalListeners.push(listener);
}

/** Animal row that lays a given fertilized egg (full item id), or undefined. */
export function animalByFertilizedEgg(itemId) {
  return allAnimals().find((animal) => animal.fertilizedEgg && rid(animal.fertilizedEgg) === itemId);
}

/** Animal row whose carcass is a given item (full id), or undefined. */
export function animalByCarcass(itemId) {
  return allAnimals().find((animal) => rid(animal.carcass) === itemId);
}

// --- butchering ------------------------------------------------------------------

const BUILTIN_CUTS = new Map(Object.entries(BUTCHER_TABLE).map(([carcass, entry]) => [rid(carcass), entry]));
const extraCuts = new Map();

/** The butcher.js-style entry ({ cuts, look? }) for a carcass item id (full id). */
export function butcherEntry(carcassItemId) {
  return BUILTIN_CUTS.get(carcassItemId) ?? extraCuts.get(carcassItemId);
}

export function addButcherEntry(carcassItemId, entry) {
  if (BUILTIN_CUTS.has(carcassItemId)) return false;
  extraCuts.set(carcassItemId, entry);
  return true;
}

// --- processing recipes ----------------------------------------------------------

const BUILTIN_RECIPES = new Map(PROCESSING_RECIPES.map((recipe) => [recipe.id, recipe]));
const extraRecipes = new Map();

export function recipeById(id) {
  return BUILTIN_RECIPES.get(id) ?? extraRecipes.get(id);
}

/** Recipes of one station (short block id), built-in first. */
export function recipesForStation(station) {
  return [...BUILTIN_RECIPES.values(), ...extraRecipes.values()].filter((recipe) => recipe.station === station);
}

export function addRecipe(recipe) {
  if (BUILTIN_RECIPES.has(recipe.id)) return false;
  extraRecipes.set(recipe.id, recipe);
  return true;
}

/** Stations recipes may target (the blocks that run the processing engine). */
export const STATIONS = [...new Set(PROCESSING_RECIPES.map((recipe) => recipe.station))];
