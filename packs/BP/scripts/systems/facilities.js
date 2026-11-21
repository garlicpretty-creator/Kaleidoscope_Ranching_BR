// 1.5 便利企劃 第三階段: four facilities that take a daily chore off the keeper.
//
// 抓癢柱 scratching post   Animals within POST_RADIUS that have not been groomed today rub
//                          against it on the ranch clock: their groom need is met, loose fur
//                          falls at the post. Fed and watered animals still itchy walk to it
//                          (entity group `itchy`, tools/gen_entities.mjs; care/state.js).
// 幼獸飲水槽 nursing trough Filled with milk (bottles or a milk bucket). On each clock pass every
//                          nursing baby within NURSING_RADIUS drinks one portion; each drink
//                          counts as one nursing-bottle feed (systems/milking.js), so three make
//                          it grow up. The `fill` state shows the level.
// 屠體掛勾架 hook rack      Hangs up to HOOKS carcasses. Use with a carcass to hang one, with an
//                          empty hand to take the last one down; a blade cuts the first one a
//                          stroke, sneaking with a blade cuts them all, one stroke after
//                          another (like the butcher rack's sneak run, systems/butcherRack.js).
// 多欄擠奶架 milking stall  A milking rack (systems/milkingRack.js) to stand side by side. Each
//                          stall milks, once a day, the female tied to it or standing in it;
//                          stalls in a row share their containers: the bottles come from a
//                          container above any stall of the row, the milk goes into a
//                          container below any stall of the row.
//
// ## Why a row of stalls and not one three-wide block: a Bedrock block's model must fit in
// ## 30 x 30 x 30 pixels and its collision and selection boxes in one block, so a 48-pixel
// ## stall cannot be one block. Joining single stalls by their shared containers gives the
// ## same three (or more) stalls with one container to empty.
//
// No text on screen: every outcome is a sound, a particle, the animal's action or the model.
// Script cost: the post, the trough and the stalls are clock blocks (core/blockClock.js);
// the hook rack runs only when used.

import { system, world } from "@minecraft/server";
import { playAction } from "../core/actions.js";
import { clockBlockEvents, defineClockBlock, startBlockClock } from "../core/blockClock.js";
import { getBlockData, setBlockData, takeBlockData } from "../core/blockStore.js";
import { containerOf } from "../core/containers.js";
import { butcherEntry } from "../core/content.js";
import { emitRanchEvent } from "../core/events.js";
import { cue, levelPitch, refuse } from "../core/feedback.js";
import { isBaby, speciesOf } from "../core/animal.js";
import { notifyCared } from "../core/husbandry.js";
import { rid } from "../core/ids.js";
import { consumeMainHand, give, giveStack, mainHand } from "../core/inventory.js";
import { isMarkedToday, mark } from "../care/state.js";
import { NURSING_FEEDS_TO_GROW } from "../data/animals.js";
import { SPECIES } from "../data/species.js";
import { animalsNear } from "../utils/world_util.js";
import { MILK_FOR_FEEDING, NURSING_FEEDS } from "./milking.js";
import { isGrowthPaused, startGrowthPause } from "./growth.js";
import { isMilkable, milkInto, rackAnimal, tieOrUntie } from "./milkingRack.js";
import { free } from "./hitchingPost.js";
import {
  STROKE_GAP, carcassData, carcassStack, isBlade, isLargeCarcass, isUncut, spillCuts, strokeOnce,
} from "./butcherRack.js";

export const SCRATCHING_POST = rid("scratching_post");
export const NURSING_TROUGH = rid("nursing_trough");
export const HOOK_RACK = rid("carcass_hook_rack");
export const MILKING_STALL = rid("milking_stall");

const brokenType = (event) => event.brokenBlockPermutation?.type?.id;
const dimensionOf = (event) => event.dimension ?? event.block.dimension;
const middle = ({ x, y, z }) => ({ x: x + 0.5, y: y + 0.5, z: z + 0.5 });

// --- 抓癢柱 scratching post ------------------------------------------------------

/** Blocks from the post within which animals rub against it. */
export const POST_RADIUS = 4;

/** One clock pass: grooms every Ranching animal in reach not groomed today. Returns how many. */
export function tickScratchingPost(block) {
  let groomed = 0;
  for (const animal of animalsNear(block, POST_RADIUS)) {
    if (!SPECIES[animal.typeId] || isMarkedToday(animal, "groom")) continue;
    if (!mark(animal, "groom")) continue;
    groomed++;
    playAction(animal, "petted"); // it leans into the post
    notifyCared(animal, undefined, "scratching_post");
  }
  if (groomed) {
    // Loose fur drifting down the post, and the rasp of a hide on wood.
    for (const y of [0.2, 0.5]) cue(block, undefined, { particle: "minecraft:falling_dust_sand_particle", y });
    cue(block, "dig.cloth", { pitch: 0.7, volume: 0.6 });
    cue(block, "hit.wood", { pitch: 0.8, volume: 0.4 });
  }
  return groomed;
}

export const scratchingPostComponent = clockBlockEvents({});

// --- 幼獸飲水槽 nursing trough ------------------------------------------------------

/** Portions the trough holds; a bottle is one, a milk bucket three. */
export const TROUGH_CAPACITY = 12;
export const BUCKET_PORTIONS = 3;
/** Blocks from the trough within which babies drink from it. */
export const NURSING_RADIUS = 6;
const FILL_STATE = "kaleidoscope_ranching:fill";
const MILK_BUCKET = "minecraft:milk_bucket";

const portionsOf = (block) => getBlockData(block, {})?.portions ?? 0;

/** The `fill` state shown for a number of portions: 0 empty, 1..3 a third each. */
export const troughLevel = (portions) => (portions <= 0 ? 0 : Math.min(3, Math.ceil((portions * 3) / TROUGH_CAPACITY)));

function storePortions(block, portions) {
  setBlockData(block, { ...(getBlockData(block, {}) ?? {}), portions });
  const level = troughLevel(portions);
  if (block.permutation.getState(FILL_STATE) !== level) block.setPermutation(block.permutation.withState(FILL_STATE, level));
}

function fillTrough(block, player) {
  const item = mainHand(player)?.getItem();
  if (!item) return refuse(player);
  const portions = portionsOf(block);
  if (item.typeId === MILK_BUCKET) {
    if (portions + BUCKET_PORTIONS > TROUGH_CAPACITY) return refuse(player); // no room for a bucket
    consumeMainHand(player);
    give(player, "minecraft:bucket");
    storePortions(block, portions + BUCKET_PORTIONS);
  } else if (MILK_FOR_FEEDING.includes(item.typeId)) {
    const count = Math.min(TROUGH_CAPACITY - portions, player.isSneaking ? item.amount : 1);
    if (count <= 0) return refuse(player); // full
    consumeMainHand(player, count);
    give(player, "minecraft:glass_bottle", count);
    storePortions(block, portions + count);
  } else return refuse(player); // milk only
  cue(block, "bucket.empty_water", { pitch: levelPitch(portionsOf(block), TROUGH_CAPACITY), volume: 0.6 });
}

// A baby kept small with a golden dandelion (systems/growth.js) does not drink.
const nursing = (entity) => speciesOf(entity)?.reproduction === "gestation" && isBaby(entity) && !isGrowthPaused(entity);

/** One clock pass: each nursing baby in reach drinks one portion. Returns how many drank. */
export function tickNursingTrough(block) {
  let portions = portionsOf(block);
  if (portions <= 0) return 0;
  let drank = 0;
  for (const baby of animalsNear(block, NURSING_RADIUS)) {
    if (portions <= 0) break;
    if (!nursing(baby)) continue;
    portions--;
    drank++;
    playAction(baby, "drink");
    const feeds = (baby.getDynamicProperty(NURSING_FEEDS) ?? 0) + 1;
    if (feeds >= NURSING_FEEDS_TO_GROW) {
      baby.setDynamicProperty(NURSING_FEEDS, undefined);
      baby.triggerEvent("kaleidoscope_ranching:grow_up");
      cue(baby, undefined, { particle: "minecraft:villager_happy", y: 1.2 });
    } else {
      baby.setDynamicProperty(NURSING_FEEDS, feeds);
      cue(baby, undefined, { particle: "minecraft:heart_particle", y: 0.6 });
    }
    notifyCared(baby, undefined, "nursing_trough");
  }
  if (drank) {
    storePortions(block, portions);
    cue(block, "random.drink", { volume: 0.5, pitch: 1.4 });
  }
  return drank;
}

function spillTrough(dimension, location, typeId) {
  takeBlockData(dimension, location, null, typeId); // the milk soaks away; the trough drops itself
}

export const nursingTroughComponent = clockBlockEvents({
  onPlayerInteract({ block, player }) {
    if (player) fillTrough(block, player);
  },
  onPlayerBreak(event) {
    spillTrough(dimensionOf(event), event.block.location, brokenType(event));
  },
});
nursingTroughComponent.onBreak = (event) => spillTrough(dimensionOf(event), event.block.location, brokenType(event));

// --- 屠體掛勾架 carcass hook rack ----------------------------------------------------

export const HOOKS = 4;
const hookState = (n) => `kaleidoscope_ranching:hook_${n}`;
const hooksOf = (block) => getBlockData(block, {})?.hooks ?? [];

/** The look of each hook: 0 empty, 1 a large carcass, 2 a small one. */
export const hookLook = (hook) => (!hook ? 0 : isLargeCarcass(hook.carcass) ? 1 : 2);

function storeHooks(block, hooks) {
  if (hooks.length) setBlockData(block, { hooks });
  else takeBlockData(block.dimension, block.location, null, block.typeId);
  let permutation = block.permutation;
  for (let n = 1; n <= HOOKS; n++) permutation = permutation.withState(hookState(n), hookLook(hooks[n - 1]));
  block.setPermutation(permutation);
}

/** Gives a hook's carcass back whole, or what is left of it once cut into. */
function giveHook(player, hook) {
  if (isUncut(hook)) giveStack(player, carcassStack(hook));
  else spillCuts(player.dimension, hook, player.location);
}

/** One stroke on the first hook. Returns the hooks left. */
function strokeFirst(block, player, hooks) {
  const hook = hooks[0];
  const next = strokeOnce(player, hook);
  block.dimension.playSound("dig.cloth", block.location);
  if (next < 0) {
    hooks.shift();
    emitRanchEvent("butchered", { carcass: rid(hook.carcass) });
  } else hook.stroke = next;
  storeHooks(block, hooks);
  return hooks;
}

const runs = new Map(); // "dimension|x,y,z" → run token
let nextRun = 0;
const rackKey = (block) => `${block.dimension.id}|${block.location.x},${block.location.y},${block.location.z}`;

/** Sneak with a blade: every carcass on the rack, every stroke, STROKE_GAP ticks apart. */
function cutAll(block, player) {
  const key = rackKey(block);
  const dimensionId = block.dimension.id;
  const location = { ...block.location };
  const token = ++nextRun;
  runs.set(key, token);
  const end = () => runs.get(key) === token && runs.delete(key);
  const stroke = (current) => {
    const left = strokeFirst(current, player, hooksOf(current));
    if (!left.length) return end();
    system.runTimeout(() => {
      if (runs.get(key) !== token) return; // broken meanwhile
      let here;
      try {
        here = world.getDimension(dimensionId).getBlock(location);
      } catch {}
      if (here?.typeId !== HOOK_RACK || !hooksOf(here).length) return end();
      if (!player.isValid || !isBlade(mainHand(player)?.getItem())) return end();
      stroke(here);
    }, STROKE_GAP);
  };
  stroke(block);
}

function useHookRack(block, player) {
  if (runs.has(rackKey(block))) return; // being cut: the strokes are under way
  const item = mainHand(player)?.getItem();
  const hooks = hooksOf(block);
  if (item && butcherEntry(item.typeId)) {
    if (hooks.length >= HOOKS) return refuse(player); // every hook taken
    hooks.push(carcassData(item));
    consumeMainHand(player);
    storeHooks(block, hooks);
    block.dimension.playSound("block.itemframe.add_item", block.location);
    return;
  }
  if (!item) {
    if (!hooks.length) return refuse(player); // nothing hangs here
    giveHook(player, hooks.pop());
    storeHooks(block, hooks);
    block.dimension.playSound("block.itemframe.remove_item", block.location);
    return;
  }
  if (!isBlade(item) || !hooks.length) return refuse(player);
  if (player.isSneaking) return cutAll(block, player);
  strokeFirst(block, player, hooks);
}

function spillHooks(dimension, location, typeId) {
  const hooks = takeBlockData(dimension, location, null, typeId)?.hooks ?? [];
  const at = middle(location);
  for (const hook of hooks) {
    if (isUncut(hook)) dimension.spawnItem(carcassStack(hook), at);
    else spillCuts(dimension, hook, at);
  }
}

export const hookRackComponent = {
  onPlayerInteract({ block, player }) {
    if (player) useHookRack(block, player);
  },
  onPlayerBreak(event) {
    runs.delete(rackKey(event.block));
    spillHooks(dimensionOf(event), event.block.location, brokenType(event));
  },
  onBreak(event) {
    runs.delete(rackKey(event.block));
    spillHooks(dimensionOf(event), event.block.location, brokenType(event));
  },
};

// --- 多欄擠奶架 milking stall ---------------------------------------------------------

/** Most stalls one row joins (a bound on the neighbour walk). */
export const ROW_LIMIT = 8;
const SIDES = [{ x: 1, z: 0 }, { x: -1, z: 0 }, { x: 0, z: 1 }, { x: 0, z: -1 }];

/** The stalls joined to this one side by side (itself included), nearest first. */
export function stallRow(block) {
  const row = [block];
  const seen = new Set([`${block.location.x},${block.location.z}`]);
  for (let i = 0; i < row.length && row.length < ROW_LIMIT; i++) {
    const { x, y, z } = row[i].location;
    for (const side of SIDES) {
      const key = `${x + side.x},${z + side.z}`;
      if (seen.has(key) || row.length >= ROW_LIMIT) continue;
      seen.add(key);
      let next;
      try {
        next = block.dimension.getBlock({ x: x + side.x, y, z: z + side.z });
      } catch {}
      if (next?.typeId === MILKING_STALL) row.push(next);
    }
  }
  return row;
}

/** The first container above (dy 1) or below (dy -1) any stall of the row. */
function rowContainer(row, dy) {
  for (const stall of row) {
    const { x, y, z } = stall.location;
    let container;
    try {
      container = containerOf(stall.dimension.getBlock({ x, y: y + dy, z }));
    } catch {}
    if (container) return container;
  }
  return undefined;
}

/** The female milked at this stall: the one tied to it, else a milkable one standing in it. */
export function stallAnimal(block) {
  const tied = rackAnimal(block);
  if (tied) return tied;
  return block.dimension.getEntities({ location: middle(block.location), maxDistance: 0.9 }).find(isMilkable);
}

/** One clock pass: milks this stall's female into the row's containers. Returns the bottle id. */
export function tickMilkingStall(block) {
  const animal = stallAnimal(block);
  if (!animal) return undefined;
  const row = stallRow(block);
  return milkInto(animal, block, rowContainer(row, 1), rowContainer(row, -1));
}

export const milkingStallComponent = clockBlockEvents({
  onPlayerInteract({ block, player }) {
    if (player) system.run(() => tieOrUntie(block, player));
  },
  onPlayerBreak(event) {
    free(dimensionOf(event), event.block.location, brokenType(event));
  },
});
milkingStallComponent.onBreak = (event) => free(dimensionOf(event), event.block.location, brokenType(event));

// --- start ------------------------------------------------------------------------

export const FACILITY_COMPONENTS = {
  scratching_post: scratchingPostComponent,
  nursing_trough: nursingTroughComponent,
  carcass_hook_rack: hookRackComponent,
  milking_stall: milkingStallComponent,
};

export function startFacilities() {
  startGrowthPause();
  system.beforeEvents.startup.subscribe(({ blockComponentRegistry }) => {
    for (const [id, component] of Object.entries(FACILITY_COMPONENTS)) {
      blockComponentRegistry.registerCustomComponent(rid(id), component);
    }
  });
  defineClockBlock(SCRATCHING_POST, "scratching_posts", tickScratchingPost);
  defineClockBlock(NURSING_TROUGH, "nursing_troughs", tickNursingTrough);
  defineClockBlock(MILKING_STALL, "milking_stalls", tickMilkingStall);
  startBlockClock();
}
