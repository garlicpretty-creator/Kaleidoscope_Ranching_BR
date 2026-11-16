// M3: nest box and incubator.
//
// Nest box
// - Adult females of laying species within NEST_RADIUS lay into the box, one
//   egg per game day each, settled lazily (up to MAX_BACKLOG_DAYS at once).
// - With a male of her species within MALE_RADIUS, a hen lays a fertilized egg
//   with M2's affection-based chance; otherwise its ordinary egg.
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
// - The eggs show how far along they are, each by its own progress: plain,
//   small cracks, big cracks just before hatching. The incubator's lamp is lit
//   while it is warm and incubating, dark while it is cold and paused.
// - The egg candler (照蛋燈) lights the eggs being brooded for a few seconds:
//   the shell glows and shows the chick inside, bigger the nearer it is to
//   hatching. Nothing is written on screen. (See "How the eggs look" below.)
//
// ## Both blocks keep their contents in the block store and are visited by the
// ## ranch clock through a bounded registry, so eggs are laid, pushed into
// ## hoppers and hatched without a player standing next to the box.

import { ItemStack, system } from "@minecraft/server";
import { INCUBATION_DAYS } from "../data/animals.js";
import { allAnimals, animalByFertilizedEgg } from "../core/content.js";
import { animalsNear, isAdultFemale, isBaby, sexOf } from "../core/animal.js";
import { getBlockData, setBlockData, takeBlockData } from "../core/blockStore.js";
import { CLOCK_INTERVAL } from "../core/clock.js";
import { defineClockBlock, startBlockClock, trackBlock, untrackBlock } from "../core/blockClock.js";
import { fertilizedChance, inheritedAffection, notifyBorn, production } from "../core/husbandry.js";
import { dp, rid } from "../core/ids.js";
import { consumeMainHand, dropItems, give, mainHand, stacksOf } from "../core/inventory.js";
import { TICKS_PER_DAY, nowTick, today } from "../core/time.js";
import { emitRanchEvent } from "../core/events.js";
import { KIND } from "../data/feeds.js";
import { isMarkedToday } from "../care/state.js";
import { showActionBar } from "../core/actionBar.js";

export const NEST_RADIUS = 8;
export const MALE_RADIUS = 8;
export const BROOD_RADIUS = 4;
export const NEST_CAPACITY = 16;
export const HATCH_SLOTS = 4;
export const MAX_BACKLOG_DAYS = 3;

const LAST_LAID_DAY = dp("last_laid_day");
const EGGS_STATE = "kaleidoscope_ranching:eggs";
const BUSY_STATE = "kaleidoscope_ranching:busy";
const CRACKS_STATE = "kaleidoscope_ranching:cracks";
const READY_STATE = "kaleidoscope_ranching:ready";
const CANDLED_STATE = "kaleidoscope_ranching:candled";
/** Eggs a block can show (bones egg_1..egg_4, tools/gen_blocks.mjs). */
export const EGG_SLOTS = 4;

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
  showActionBar(player, { translate: `kaleidoscope_ranching.message.${key}` });
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

// --- How the eggs look ----------------------------------------------------
//
// ## Each egg looks as far along as it is: plain, small cracks from
// ## SMALL_CRACKS_AT of its incubation, big cracks from BIG_CRACKS_AT (and while
// ## a due egg waits for a hen to brood it). Progress is read from the egg's own
// ## `due` and its species' incubation time, so eggs put in at different times
// ## look different, a cold incubator's eggs (whose `due` is pushed back) stay
// ## as they are, and eggs saved before the stages existed show theirs on the
// ## next clock pass.
// ##
// ## Block states (tools/gen_blocks.mjs), filling the slots egg_1..egg_4 with the
// ## most advanced egg first:
// ##   eggs    0..4  eggs shown
// ##   cracks  0..4  the first `cracks` of them have cracks (small or big)
// ##   ready   0..4  the first `ready` of those have big cracks
// ##                 (ready <= cracks <= eggs)
// ##   candled       the candler's glow: in the nest box 0..4, how many of the
// ##                 first eggs are lit (the brooded ones, which come before the
// ##                 stored eggs; stored eggs do not develop and are not lit); in
// ##                 the incubator a bool, since every egg in it is brooded.
// ## Counting stages instead of keeping one per slot keeps the permutations
// ## small: nest box 5·5·5·5 = 625, incubator 5·5·5·2·2 (busy) = 500, times
// ## four facings.
// ##
// ## The glow is stamped in the block data with the tick it started and shown
// ## only while 0 <= now - stamp < CANDLE_GLOW_TICKS. A timeout redraws the
// ## block when it ends; if the chunk unloaded first, the next clock pass (or
// ## use) redraws it from its data and the stale glow goes.

export const SMALL_CRACKS_AT = 0.5;
export const BIG_CRACKS_AT = 0.85;
export const CANDLE_GLOW_TICKS = 100; // five seconds

/** 0 plain, 1 small cracks, 2 big cracks, for a brooded egg { egg, due } at tick `now`. */
export function eggStage(egg, now) {
  const total = hatchTicks(egg.egg);
  const progress = total > 0 ? 1 - (egg.due - now) / total : 1;
  return progress >= BIG_CRACKS_AT ? 2 : progress >= SMALL_CRACKS_AT ? 1 : 0;
}

function isGlowing(data, now) {
  if (typeof data.candled !== "number") return false;
  const age = now - data.candled;
  return age >= 0 && age < CANDLE_GLOW_TICKS;
}

function forgetStaleGlow(data, now) {
  if (data.candled !== undefined && !isGlowing(data, now)) delete data.candled;
}

/** States showing the brooded eggs, most advanced first, followed by `plain` more eggs. */
function eggStates(brooded, plain, now) {
  const stages = brooded.map((egg) => eggStage(egg, now)).sort((a, b) => b - a).slice(0, EGG_SLOTS);
  return {
    [EGGS_STATE]: Math.min(EGG_SLOTS, stages.length + plain),
    [CRACKS_STATE]: stages.filter((stage) => stage >= 1).length,
    [READY_STATE]: stages.filter((stage) => stage >= 2).length,
  };
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
        const { produces } = production(hen, d);
        if (!produces) continue;
        const egg = rid(hasMale && Math.random() < fertilizedChance(hen) ? species.fertilizedEgg : species.dailyProduct.item);
        // 1.1 鈣質飼料: a hen that ate calcium feed today may lay one more plain egg.
        const extra = d === day && ateCalciumToday(hen) && Math.random() < CALCIUM_EXTRA_EGG_CHANCE ? 1 : 0;
        for (const one of extra ? [egg, rid(species.dailyProduct.item)] : [egg]) {
          if (storedCount(data) < NEST_CAPACITY) data.eggs[one] = (data.eggs[one] ?? 0) + 1;
          else block.dimension.spawnItem(new ItemStack(one, 1), at);
        }
      }
    }
  }
}

/** 1.1: chance that a hen fed calcium feed today lays a second egg. */
export const CALCIUM_EXTRA_EGG_CHANCE = 0.3;
const ateCalciumToday = (hen) => isMarkedToday(hen, "fed") && hen.getDynamicProperty("kr:fed_kind") === KIND.CALCIUM;

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
  const now = nowTick();
  const lit = isGlowing(data, now) ? Math.min(EGG_SLOTS, data.hatching.length) : 0;
  setStates(block, { ...eggStates(data.hatching, storedCount(data), now), [CANDLED_STATE]: lit });
}

export function settleNest(block) {
  const data = getBlockData(block, emptyNest());
  lay(block, data);
  hatchInNest(block, data);
  pushToHopper(block, data);
  forgetStaleGlow(data, nowTick());
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

/** The lamp is lit while the incubator is warm and has eggs in it: dark means paused. */
function showIncubator(block, data, heated) {
  const now = nowTick();
  setStates(block, {
    ...eggStates(data.eggs, 0, now),
    [BUSY_STATE]: heated && data.eggs.length > 0,
    [CANDLED_STATE]: data.eggs.length > 0 && isGlowing(data, now),
  });
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
  forgetStaleGlow(data, nowTick());
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

// ## The candler shows nothing on screen: it lights the brooded eggs for
// ## CANDLE_GLOW_TICKS (see "How the eggs look").

/** For a nest box or incubator: how to settle it, redraw it and find its brooded eggs. */
function eggBlock(block) {
  if (block?.typeId === rid("nest_box")) return { settle: settleNest, show: showNest, brooded: (data) => data.hatching };
  if (block?.typeId === rid("incubator")) {
    return { settle: (b) => settleIncubator(b), show: (b, data) => showIncubator(b, data, isHeated(b)), brooded: (data) => data.eggs };
  }
  return undefined;
}

/** Redraws a candled block once its glow is over, if its chunk is still loaded. */
function endGlow(dimension, location, typeId) {
  let block;
  try {
    block = dimension.getBlock(location);
  } catch {
    return; // unloaded: the clock redraws it when it is back
  }
  if (block?.typeId === typeId) eggBlock(block)?.settle(block);
}

/** Lights the brooded eggs of a nest box or incubator. Returns how many glow, or null for any other block. */
export function candle(block) {
  const kind = eggBlock(block);
  if (!kind) return null;
  trackBlock(block);
  const data = kind.settle(block);
  const count = Math.min(EGG_SLOTS, kind.brooded(data).length);
  if (!count) return 0;
  data.candled = nowTick();
  setBlockData(block, data);
  kind.show(block, data);
  const { dimension, location, typeId } = block;
  system.runTimeout(() => endGlow(dimension, { ...location }, typeId), CANDLE_GLOW_TICKS + 1);
  return count;
}

export const candlerItemComponent = {
  onUseOn({ source, block }) {
    if (source?.typeId !== "minecraft:player") return;
    candle(block);
  },
};
