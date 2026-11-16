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
// 1.1 孵化與飼料線
// - Every egg that hatches leaves an eggshell: in the nest box it joins the
//   stored eggs (collected by hand or by the hopper); the incubator keeps its
//   shells until it is used or a hopper sits under it.
// - The egg candler (照蛋燈) shows how long the eggs in either block still need.
//
// ## Both blocks keep their contents in the block store and are visited by the
// ## ranch clock through a bounded registry, so eggs are laid, pushed into
// ## hoppers and hatched without a player standing next to the box.

import { ItemStack } from "@minecraft/server";
import { INCUBATION_DAYS } from "../data/animals.js";
import { allAnimals, animalByFertilizedEgg } from "../core/content.js";
import { tierIds } from "../data/items.js";
import { animalsNear, isAdultFemale, isBaby, sexOf } from "../core/animal.js";
import { getBlockData, setBlockData, takeBlockData } from "../core/blockStore.js";
import { CLOCK_INTERVAL } from "../core/clock.js";
import { defineClockBlock, startBlockClock, trackBlock, untrackBlock } from "../core/blockClock.js";
import { fertilizedChance, inheritedAffection, notifyBorn, production } from "../core/husbandry.js";
import { dp, rid } from "../core/ids.js";
import { consumeMainHand, dropItems, give, mainHand, stacksOf } from "../core/inventory.js";
import { TICKS_PER_DAY, nowTick, today } from "../core/time.js";
import { emitRanchEvent } from "../core/events.js";

export const NEST_RADIUS = 8;
export const MALE_RADIUS = 8;
export const BROOD_RADIUS = 4;
export const NEST_CAPACITY = 16;
export const HATCH_SLOTS = 4;
export const MAX_BACKLOG_DAYS = 3;

const LAST_LAID_DAY = dp("last_laid_day");
const EGGS_STATE = "kaleidoscope_ranching:eggs";
const BUSY_STATE = "kaleidoscope_ranching:busy";

/** Laying species, built-in and registered (core/content.js), read each time. */
const layers = () => allAnimals().filter((animal) => animal.reproduction === "egg" && animal.dailyProduct?.via === "nest_box");
/** Species id that hatches from a fertilized egg item (full id), or undefined. */
const speciesForEgg = (itemId) => {
  const animal = animalByFertilizedEgg(itemId);
  return animal?.reproduction === "egg" ? animal.id : undefined;
};

/** Ticks a fertilized egg (full item id) takes to hatch: its species' `days`. */
const hatchTicks = (itemId) => (animalByFertilizedEgg(itemId)?.days ?? INCUBATION_DAYS) * TICKS_PER_DAY;

const HEAT = new Set([
  "minecraft:campfire", "minecraft:soul_campfire", "minecraft:magma", "minecraft:lava", "minecraft:flowing_lava",
  "minecraft:fire", "minecraft:soul_fire", "minecraft:lit_furnace", "minecraft:lit_smoker", "minecraft:lit_blast_furnace",
]);


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
  // ## Animals from other add-ons are asked to provide these events (see
  // ## docs/API.md); a missing one must not stop the hatch.
  for (const event of ["kaleidoscope_ranching:become_baby", "kaleidoscope_ranching:make_persistent"]) {
    try {
      baby.triggerEvent(event);
    } catch {}
  }
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
  for (const species of layers()) {
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

export const EGGSHELL = rid("eggshell");

function hatchInNest(block, data) {
  const now = nowTick();
  data.hatching = data.hatching.filter((egg) => {
    if (egg.due > now) return true;
    const hen = animalsNear(block.dimension, center(block), egg.species, BROOD_RADIUS).find(isAdultFemale);
    if (!hen) return true; // waits until a hen sits on it
    const location = { ...center(block), y: block.location.y + 1 };
    if (!hatch(block.dimension, location, egg.species, hen)) return true;
    data.eggs[EGGSHELL] = (data.eggs[EGGSHELL] ?? 0) + 1;
    return false;
  });
}

function pushToHopper(block, data) {
  const below = block.below();
  if (below?.typeId !== "minecraft:hopper") return;
  const container = below.getComponent("minecraft:inventory")?.container;
  if (!container) return;
  const moved = {};
  for (const [egg, count] of Object.entries(data.eggs)) {
    let left = 0;
    for (const stack of stacksOf(egg, count)) left += container.addItem(stack)?.amount ?? 0;
    if (left) data.eggs[egg] = left;
    else delete data.eggs[egg];
    const n = count - left;
    if (n > 0) moved[egg] = n;
  }
  if (Object.keys(moved).length) emitRanchEvent("harvested", { product: "egg", items: moved });
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
  for (const [egg, count] of Object.entries(data.eggs ?? {})) dropItems(dimension, egg, count, at);
  for (const egg of data.hatching ?? []) dimension.spawnItem(new ItemStack(egg.egg, 1), at);
}

export const nestBoxComponent = {
  onPlace({ block }) {
    trackBlock(block);
  },

  onPlayerInteract({ block, player }) {
    if (!player) return;
    trackBlock(block);
    const data = settleNest(block);
    const item = mainHand(player)?.getItem();
    const species = item && speciesForEgg(item.typeId);
    if (species) {
      if (data.hatching.length >= HATCH_SLOTS) return tell(player, "nest.full");
      data.hatching.push({ egg: item.typeId, species, due: nowTick() + hatchTicks(item.typeId) });
      consumeMainHand(player);
    } else {
      if (!storedCount(data)) return tell(player, "nest.empty");
      for (const [egg, count] of Object.entries(data.eggs)) give(player, egg, count);
      emitRanchEvent("harvested", { product: "egg", items: { ...data.eggs } });
      data.eggs = {};
    }
    setBlockData(block, data);
    showNest(block, data);
  },

  onPlayerBreak({ block, dimension, brokenBlockPermutation }) {
    const dim = dimension ?? block.dimension;
    untrackBlock(brokenBlockPermutation?.type?.id ?? rid("nest_box"), dim, block.location);
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

/** Moves the incubator's eggshells into a hopper under it. */
function pushShells(block, data) {
  if (!data.shells) return;
  const below = block.below();
  if (below?.typeId !== "minecraft:hopper") return;
  const container = below.getComponent("minecraft:inventory")?.container;
  if (!container) return;
  let left = 0;
  for (const stack of stacksOf(EGGSHELL, data.shells)) left += container.addItem(stack)?.amount ?? 0;
  data.shells = left || undefined;
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
    data.eggs = data.eggs.filter((egg) => {
      if (egg.due > now || !hatch(block.dimension, location, egg.species, undefined)) return true;
      data.shells = (data.shells ?? 0) + 1;
      return false;
    });
  }
  pushShells(block, data);
  setBlockData(block, data);
  showIncubator(block, data, heated);
  return data;
}

export const incubatorComponent = {
  onPlace({ block }) {
    trackBlock(block);
  },

  onPlayerInteract({ block, player }) {
    if (!player) return;
    trackBlock(block);
    const data = settleIncubator(block);
    const item = mainHand(player)?.getItem();
    const species = item && speciesForEgg(item.typeId);
    if (species) {
      if (data.eggs.length >= HATCH_SLOTS) return tell(player, "incubator.full");
      data.eggs.push({ egg: item.typeId, species, due: nowTick() + hatchTicks(item.typeId) });
      consumeMainHand(player);
      if (!isHeated(block)) tell(player, "incubator.cold");
    } else {
      if (!data.eggs.length && !data.shells) return tell(player, "incubator.empty");
      for (const egg of data.eggs) give(player, egg.egg, 1);
      if (data.shells) give(player, EGGSHELL, data.shells);
      data.eggs = [];
      data.shells = undefined;
    }
    setBlockData(block, data);
    showIncubator(block, data, isHeated(block));
  },

  onPlayerBreak({ block, dimension, brokenBlockPermutation }) {
    const dim = dimension ?? block.dimension;
    untrackBlock(brokenBlockPermutation?.type?.id ?? rid("incubator"), dim, block.location);
    const data = takeBlockData(dim, block.location, null, brokenBlockPermutation?.type?.id);
    const { x, y, z } = block.location;
    for (const egg of data?.eggs ?? []) dim.spawnItem(new ItemStack(egg.egg, 1), { x: x + 0.5, y: y + 0.5, z: z + 0.5 });
    if (data?.shells) dropItems(dim, EGGSHELL, data.shells, { x: x + 0.5, y: y + 0.5, z: z + 0.5 });
  },

  onBreak(event) {
    incubatorComponent.onPlayerBreak(event);
  },
};

// --- Clock ----------------------------------------------------------------

// ## Both blocks run on M2's shared block clock (core/blockClock.js): it keeps
// ## one bounded registry per block type and skips unloaded chunks.
export function startNests() {
  defineClockBlock(rid("nest_box"), "nest_boxes", (block) => settleNest(block));
  defineClockBlock(rid("incubator"), "incubators", (block) => settleIncubator(block, CLOCK_INTERVAL));
  startBlockClock();
}

// --- 1.1 照蛋燈 -----------------------------------------------------------------

const TICKS_PER_MINUTE = 1200;

/** What the candler reports for a nest box or incubator: { count, soonest (minutes), paused }, or null. */
export function candle(block) {
  let eggs;
  let paused = false;
  if (block.typeId === rid("nest_box")) eggs = settleNest(block).hatching;
  else if (block.typeId === rid("incubator")) {
    eggs = settleIncubator(block).eggs;
    paused = !isHeated(block);
  } else return null;
  const now = nowTick();
  const minutes = eggs.map((egg) => Math.max(0, Math.ceil((egg.due - now) / TICKS_PER_MINUTE)));
  return { count: eggs.length, soonest: minutes.length ? Math.min(...minutes) : 0, paused };
}

export const candlerItemComponent = {
  onUseOn({ source, block }) {
    if (source?.typeId !== "minecraft:player") return;
    const report = candle(block);
    if (!report) return;
    const key = !report.count ? "candler.none" : report.paused ? "candler.paused" : "candler.status";
    source.onScreenDisplay.setActionBar({ translate: `kaleidoscope_ranching.message.${key}`, with: [`${report.count}`, `${report.soonest}`] });
  },
};
