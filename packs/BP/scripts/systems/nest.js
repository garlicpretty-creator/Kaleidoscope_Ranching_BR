// M3: nest box and incubator.
//
// Nest box
// - Adult females of laying species within NEST_RADIUS lay into the box, one
//   egg per game day each, settled lazily (up to MAX_BACKLOG_DAYS at once).
// - With a male of her species within MALE_RADIUS, a hen lays a fertilized egg
//   with M2's affection-based chance; otherwise a plain/fine/superb egg.
// - A hopper under the box receives the eggs.
// - Placing a fertilized egg in the box sets it to hatch after INCUBATION_DAYS,
//   provided a hen of that species is nearby to brood it when it is due.
// - Using the box with anything else collects the stored eggs.
//
// Incubator
// - Holds up to four fertilized eggs and hatches them without a hen, but only
//   while a heat source touches it; without heat the countdown pauses.
//
// ## Both blocks keep their contents in the block store and are visited by the
// ## ranch clock through a bounded registry, so eggs are laid, pushed into
// ## hoppers and hatched without a player standing next to the box.

import { ItemStack, world } from "@minecraft/server";
import { ANIMALS, INCUBATION_DAYS } from "../data/animals.js";
import { tierIds } from "../data/items.js";
import { animalsNear, isAdultFemale, isBaby, sexOf } from "../core/animal.js";
import { blockKey, getBlockData, setBlockData, takeBlockData } from "../core/blockStore.js";
import { CLOCK_INTERVAL, createRegistry, registerClockTask } from "../core/clock.js";
import { fertilizedChance, inheritedAffection, notifyBorn, production } from "../core/husbandry.js";
import { dp, rid } from "../core/ids.js";
import { consumeMainHand, give, mainHand } from "../core/inventory.js";
import { TICKS_PER_DAY, nowTick, today } from "../core/time.js";

export const NEST_RADIUS = 8;
export const MALE_RADIUS = 8;
export const BROOD_RADIUS = 4;
export const NEST_CAPACITY = 16;
export const HATCH_SLOTS = 4;
export const MAX_BACKLOG_DAYS = 3;

const LAST_LAID_DAY = dp("last_laid_day");
const EGGS_STATE = "kaleidoscope_ranching:eggs";
const BUSY_STATE = "kaleidoscope_ranching:busy";

const LAYERS = ANIMALS.filter((animal) => animal.reproduction === "egg" && animal.dailyProduct?.via === "nest_box");
/** fertilized egg item (full id) -> species id */
const SPECIES_BY_FERTILIZED = new Map(LAYERS.map((animal) => [rid(animal.fertilizedEgg), animal.id]));

const HEAT = new Set([
  "minecraft:campfire", "minecraft:soul_campfire", "minecraft:magma", "minecraft:lava", "minecraft:flowing_lava",
  "minecraft:fire", "minecraft:soul_fire", "minecraft:lit_furnace", "minecraft:lit_smoker", "minecraft:lit_blast_furnace",
]);

const nests = createRegistry("nest_boxes");
const incubators = createRegistry("incubators");

function tell(player, key) {
  player.onScreenDisplay.setActionBar({ translate: `kaleidoscope_ranching.message.${key}` });
}

function center(block) {
  const { x, y, z } = block.location;
  return { x: x + 0.5, y: y + 0.5, z: z + 0.5 };
}

function setStates(block, states) {
  let permutation = block.permutation;
  for (const [name, value] of Object.entries(states)) permutation = permutation.withState(name, value);
  block.setPermutation(permutation);
}

function eggForQuality(species, quality) {
  const product = species.dailyProduct;
  const tiers = (product.tierItems ?? tierIds(product.item)).map(rid);
  return tiers[{ plain: 0, fine: 1, superb: 2 }[quality] ?? 0];
}

function hatch(dimension, location, speciesId, mother) {
  let baby;
  try {
    baby = dimension.spawnEntity(rid(speciesId), location);
  } catch {
    return false; // species not in the pack yet (e.g. M4 birds before M4)
  }
  baby.triggerEvent("kaleidoscope_ranching:become_baby");
  baby.triggerEvent("kaleidoscope_ranching:make_persistent");
  notifyBorn(baby, mother, inheritedAffection(mother));
  return true;
}

// --- Nest box -------------------------------------------------------------

function emptyNest() {
  return { eggs: {}, hatching: [] };
}

function storedCount(data) {
  return Object.values(data.eggs).reduce((sum, n) => sum + n, 0);
}

function lay(block, data) {
  const day = today();
  const at = center(block);
  for (const species of LAYERS) {
    const birds = animalsNear(block.dimension, at, species.id, Math.max(NEST_RADIUS, MALE_RADIUS));
    for (const hen of birds) {
      if (!isAdultFemale(hen)) continue;
      const dx = hen.location.x - at.x;
      const dz = hen.location.z - at.z;
      if (dx * dx + dz * dz > NEST_RADIUS * NEST_RADIUS) continue;

      let last = hen.getDynamicProperty(LAST_LAID_DAY);
      if (typeof last !== "number") last = day - 1; // first visit: she can lay today
      const days = Math.min(day - last, MAX_BACKLOG_DAYS);
      if (days <= 0) continue;
      hen.setDynamicProperty(LAST_LAID_DAY, day);

      const hasMale = animalsNear(hen.dimension, hen.location, species.id, MALE_RADIUS).some(
        (bird) => !isBaby(bird) && sexOf(bird) === "male"
      );
      for (let d = day - days + 1; d <= day; d++) {
        const { produces, quality } = production(hen, d);
        if (!produces) continue;
        const egg = hasMale && Math.random() < fertilizedChance(hen) ? rid(species.fertilizedEgg) : eggForQuality(species, quality);
        if (storedCount(data) < NEST_CAPACITY) data.eggs[egg] = (data.eggs[egg] ?? 0) + 1;
        else block.dimension.spawnItem(new ItemStack(egg, 1), at);
      }
    }
  }
}

function hatchInNest(block, data) {
  const now = nowTick();
  data.hatching = data.hatching.filter((egg) => {
    if (egg.due > now) return true;
    const hen = animalsNear(block.dimension, center(block), egg.species, BROOD_RADIUS).find(isAdultFemale);
    if (!hen) return true; // waits until a hen sits on it
    const location = { ...center(block), y: block.location.y + 1 };
    return !hatch(block.dimension, location, egg.species, hen);
  });
}

function pushToHopper(block, data) {
  const below = block.below();
  if (below?.typeId !== "minecraft:hopper") return;
  const container = below.getComponent("minecraft:inventory")?.container;
  if (!container) return;
  for (const [egg, count] of Object.entries(data.eggs)) {
    const rest = container.addItem(new ItemStack(egg, count));
    if (rest) data.eggs[egg] = rest.amount;
    else delete data.eggs[egg];
  }
}

function showNest(block, data) {
  setStates(block, { [EGGS_STATE]: Math.min(4, storedCount(data) + data.hatching.length) });
}

export function settleNest(block) {
  const data = getBlockData(block, emptyNest());
  lay(block, data);
  hatchInNest(block, data);
  pushToHopper(block, data);
  setBlockData(block, data);
  showNest(block, data);
  return data;
}

function dropNest(dimension, location, data) {
  if (!data) return;
  const at = { x: location.x + 0.5, y: location.y + 0.5, z: location.z + 0.5 };
  for (const [egg, count] of Object.entries(data.eggs ?? {})) dimension.spawnItem(new ItemStack(egg, count), at);
  for (const egg of data.hatching ?? []) dimension.spawnItem(new ItemStack(egg.egg, 1), at);
}

export const nestBoxComponent = {
  onPlace({ block }) {
    nests.add(blockKey(block));
  },

  onPlayerInteract({ block, player }) {
    if (!player) return;
    nests.add(blockKey(block));
    const data = settleNest(block);
    const item = mainHand(player)?.getItem();
    const species = item && SPECIES_BY_FERTILIZED.get(item.typeId);
    if (species) {
      if (data.hatching.length >= HATCH_SLOTS) return tell(player, "nest.full");
      data.hatching.push({ egg: item.typeId, species, due: nowTick() + INCUBATION_DAYS * TICKS_PER_DAY });
      consumeMainHand(player);
    } else {
      if (!storedCount(data)) return tell(player, "nest.empty");
      for (const [egg, count] of Object.entries(data.eggs)) give(player, egg, count);
      data.eggs = {};
    }
    setBlockData(block, data);
    showNest(block, data);
  },

  onPlayerBreak({ block, dimension, brokenBlockPermutation }) {
    const dim = dimension ?? block.dimension;
    nests.remove(blockKey(block));
    dropNest(dim, block.location, takeBlockData(dim, block.location, null, brokenBlockPermutation?.type?.id));
  },

  onBreak(event) {
    nestBoxComponent.onPlayerBreak(event);
  },
};

// --- Incubator ------------------------------------------------------------

export function isHeated(block) {
  const neighbours = [block.below(), block.below(2), block.north(), block.south(), block.east(), block.west()];
  return neighbours.some((other) => other && HEAT.has(other.typeId));
}

function showIncubator(block, data, heated) {
  setStates(block, { [EGGS_STATE]: data.eggs.length, [BUSY_STATE]: heated && data.eggs.length > 0 });
}

export function settleIncubator(block, elapsed = 0) {
  const data = getBlockData(block, { eggs: [] });
  const heated = isHeated(block);
  if (!heated) {
    // ## Without heat the countdown pauses: push every due time back by the
    // ## time that just passed.
    for (const egg of data.eggs) egg.due += elapsed;
  } else {
    const now = nowTick();
    const location = { ...center(block), y: block.location.y + 1 };
    data.eggs = data.eggs.filter((egg) => egg.due > now || !hatch(block.dimension, location, egg.species, undefined));
  }
  setBlockData(block, data);
  showIncubator(block, data, heated);
  return data;
}

export const incubatorComponent = {
  onPlace({ block }) {
    incubators.add(blockKey(block));
  },

  onPlayerInteract({ block, player }) {
    if (!player) return;
    incubators.add(blockKey(block));
    const data = settleIncubator(block);
    const item = mainHand(player)?.getItem();
    const species = item && SPECIES_BY_FERTILIZED.get(item.typeId);
    if (species) {
      if (data.eggs.length >= HATCH_SLOTS) return tell(player, "incubator.full");
      data.eggs.push({ egg: item.typeId, species, due: nowTick() + INCUBATION_DAYS * TICKS_PER_DAY });
      consumeMainHand(player);
      if (!isHeated(block)) tell(player, "incubator.cold");
    } else {
      if (!data.eggs.length) return tell(player, "incubator.empty");
      for (const egg of data.eggs) give(player, egg.egg, 1);
      data.eggs = [];
    }
    setBlockData(block, data);
    showIncubator(block, data, isHeated(block));
  },

  onPlayerBreak({ block, dimension, brokenBlockPermutation }) {
    const dim = dimension ?? block.dimension;
    incubators.remove(blockKey(block));
    const data = takeBlockData(dim, block.location, null, brokenBlockPermutation?.type?.id);
    const { x, y, z } = block.location;
    for (const egg of data?.eggs ?? []) dim.spawnItem(new ItemStack(egg.egg, 1), { x: x + 0.5, y: y + 0.5, z: z + 0.5 });
  },

  onBreak(event) {
    incubatorComponent.onPlayerBreak(event);
  },
};

// --- Clock ----------------------------------------------------------------

/** "kaleidoscope_ranching:block:<dimension>:<x>,<y>,<z>" -> loaded block, or undefined. */
function blockFromKey(key) {
  const match = /block:(.+):(-?\d+),(-?\d+),(-?\d+)$/.exec(key);
  if (!match) return undefined;
  try {
    return world.getDimension(match[1]).getBlock({ x: +match[2], y: +match[3], z: +match[4] });
  } catch {
    return undefined; // chunk not loaded
  }
}

export function startNests() {
  registerClockTask("nest_boxes", () => {
    for (const key of nests.all()) {
      const block = blockFromKey(key);
      if (!block) continue;
      if (block.typeId !== rid("nest_box")) nests.remove(key);
      else settleNest(block);
    }
  });
  registerClockTask("incubators", () => {
    for (const key of incubators.all()) {
      const block = blockFromKey(key);
      if (!block) continue;
      if (block.typeId !== rid("incubator")) incubators.remove(key);
      else settleIncubator(block, CLOCK_INTERVAL);
    }
  });
}

