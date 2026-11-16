// 乾草架 (hay rack): a store of hay that doubles as a low-tier trough.
//
// It takes only grass-kind feed (hay bales, wheat, forage, alfalfa and grass
// feeds other add-ons register), holds much more than a trough and feeds every
// grass eater in range once a day at feed tier 1. It runs on the shared block
// clock after M2's troughs, so an animal with a trough in reach eats the better
// trough feed first.
//
// ## It reuses M2's care state (care/state.js) the same way a trough does, so a
// ## pen with only a hay rack still gets its daily settlement and cleanliness
// ## check. It does not change any M2 file.

import { ItemStack } from "@minecraft/server";
import { ensureSettled, isMarkedToday, mark, cleanNeedEnabled, readyAt } from "../care/state.js";
import { MANURE_BLOCK } from "../custom_components/manure.js";
import { CARE } from "../data/care_config.js";
import { FEEDS, KIND, KIND_TIER } from "../data/feeds.js";
import { SPECIES } from "../data/species.js";
import { clockBlockEvents, defineClockBlock, startBlockClock } from "../core/blockClock.js";
import { getBlockData, setBlockData, takeBlockData } from "../core/blockStore.js";
import { consumeMainHand, mainHand } from "../core/inventory.js";
import { rid } from "../core/ids.js";
import { today } from "../core/time.js";
import { animalsNear, countBlocksNear } from "../utils/world_util.js";

export const HAY_RACK = rid("hay_rack");
/** Feed units a hay rack holds: four hay bales. */
export const HAY_RACK_CAPACITY = 36;
const HAY_STATE = "kaleidoscope_ranching:hay";
const HAY_BALE = "minecraft:hay_block";
const HAY_BALE_UNITS = 9;

function tell(player, key, values) {
  player.onScreenDisplay.setActionBar({ translate: `kaleidoscope_ranching.message.hay_rack.${key}`, with: values });
}

const unitsOf = (block) => getBlockData(block, { units: 0 }).units ?? 0;

function store(block, units) {
  setBlockData(block, { ...getBlockData(block, {}), units });
  const stage = units <= 0 ? 0 : units <= 12 ? 1 : units <= 24 ? 2 : 3;
  block.setPermutation(block.permutation.withState(HAY_STATE, stage));
}

function showStatus(player, block) {
  tell(player, "status", [`${unitsOf(block)}`, `${HAY_RACK_CAPACITY}`]);
}

function fill(block, player) {
  const held = mainHand(player)?.getItem();
  const feed = held && FEEDS[held.typeId];
  if (!feed) return showStatus(player, block);
  if (feed.kind !== KIND.GRASS) return tell(player, "only_grass");
  const units = unitsOf(block);
  const room = Math.floor((HAY_RACK_CAPACITY - units) / feed.units);
  const count = Math.min(room, player.isSneaking ? held.amount : 1);
  if (count <= 0) return tell(player, "full");
  consumeMainHand(player, count);
  store(block, units + count * feed.units);
  block.dimension.playSound("block.composter.fill", block.location);
  showStatus(player, block);
}

function penIsClean(block, day) {
  const data = getBlockData(block, { units: 0 });
  if (data.clean_day === day) return data.clean_ok === true;
  const ok = countBlocksNear(block, MANURE_BLOCK) <= CARE.MANURE_DIRTY_THRESHOLD;
  setBlockData(block, { ...data, clean_day: day, clean_ok: ok });
  return ok;
}

/** One clock pass: feeds every grass eater in range that has not eaten today. */
export function tickHayRack(block) {
  const animals = animalsNear(block);
  if (!animals.length) return;
  const day = today();
  let units = unitsOf(block);
  const before = units;
  const checkClean = cleanNeedEnabled();
  let clean = null;
  for (const animal of animals) {
    const species = SPECIES[animal.typeId];
    if (!species) continue;
    ensureSettled(animal, day);
    if (checkClean && !isMarkedToday(animal, "clean")) {
      if (clean === null) clean = penIsClean(block, day);
      if (clean) mark(animal, "clean");
    }
    if (units > 0 && species.eats.includes(KIND.GRASS) && !isMarkedToday(animal, "fed") && readyAt(animal, block, "fed")) {
      mark(animal, "fed", { fed_tier: KIND_TIER[KIND.GRASS] ?? 1 });
      units--;
    }
  }
  if (units !== before) store(block, units);
}

/** Gives back what is stored: hay bales, the rest as wheat. */
function spill(dimension, location, typeId) {
  const data = takeBlockData(dimension, location, null, typeId);
  const units = data?.units ?? 0;
  if (units <= 0) return;
  const at = { x: location.x + 0.5, y: location.y + 0.5, z: location.z + 0.5 };
  const bales = Math.floor(units / HAY_BALE_UNITS);
  if (bales) dimension.spawnItem(new ItemStack(HAY_BALE, bales), at);
  if (units % HAY_BALE_UNITS) dimension.spawnItem(new ItemStack("minecraft:wheat", units % HAY_BALE_UNITS), at);
}

const brokenType = (event) => event.brokenBlockPermutation?.type?.id;

export const hayRackComponent = {
  ...clockBlockEvents({
    onPlayerInteract({ block, player }) {
      if (player) fill(block, player);
    },
    onPlayerBreak(event) {
      spill(event.dimension ?? event.block.dimension, event.block.location, brokenType(event));
    },
  }),
  onBreak(event) {
    spill(event.dimension ?? event.block.dimension, event.block.location, brokenType(event));
  },
};

export function startHayRacks() {
  defineClockBlock(HAY_RACK, "hay_racks", tickHayRack);
  startBlockClock();
}
