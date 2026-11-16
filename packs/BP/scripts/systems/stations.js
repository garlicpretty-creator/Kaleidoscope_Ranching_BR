// M3: one engine for every processing block (butter churn, cheese press,
// aging rack, fermenting jar, pickling vat). Recipes come from
// data/processing.js; a block uses the recipes whose `station` is its id.
//
// Use a station while holding an ingredient: if the player carries every input
// of a recipe that takes that ingredient, the inputs are taken and the station
// starts. Using it again once the time is up gives the outputs. Nothing ticks
// while it works: the start time is stored and compared on the next use.
//
// 1.1 additions:
// - When several recipes take the held item, those it leads (first input) are
//   tried first, then the one with the most inputs (berry ice cream before
//   plain); a churn used with milk in hand still makes butter, not custard.
// - `aged`: collected after `aged.ticks` instead of `ticks`, the recipe gives
//   `aged.outputs` (熟成架: 3 days a wheel, 7 days a vintage wheel).
// - On an aging rack over a lit campfire, outputs listed in SMOKING come out
//   smoked (煙燻乳酪).
// - Automated stations (AUTO_STATIONS) also run on the ranch clock: they take
//   inputs from the container above and put outputs into the container below.

import { AUTO_STATIONS, SMOKING } from "../data/processing.js";
import { recipeById, recipesForStation } from "../core/content.js";
import { getBlockData, setBlockData, takeBlockData } from "../core/blockStore.js";
import { rid, shortId } from "../core/ids.js";
import { countItems, dropItems, give, mainHand, takeItems } from "../core/inventory.js";
import { nowTick } from "../core/time.js";
import { showActionBar } from "../core/actionBar.js";
import { containerOf, countIn, putInto, takeFrom } from "../core/containers.js";
import { clockBlockEvents, defineClockBlock } from "../core/blockClock.js";

// ## The duration is stored with the running batch. A recipe another add-on
// ## registered is unknown again after a world reload until that add-on
// ## re-registers it; the batch must not finish early (or never) because of that.
const ticksOf = (data) => data.ticks ?? recipeById(data.recipe)?.ticks ?? 0;

const BUSY_STATE = "kaleidoscope_ranching:busy";
const TICKS_PER_MINUTE = 1200;

function tell(player, key, values) {
  showActionBar(player, { translate: `kaleidoscope_ranching.message.station.${key}`, with: values });
}

function setBusy(block, busy) {
  block.setPermutation(block.permutation.withState(BUSY_STATE, busy));
}

// ## Recipes come from core/content.js: data/processing.js plus recipes other
// ## add-ons registered this session (kaleidoscope_ranching:register_recipe).

const inputIds = (input) => (input.anyOf ?? [input.item]).map(rid);

/** Takes a recipe's inputs and returns { taken }, or null if something is missing. */
function takeInputs(player, recipe, heldId) {
  for (const input of recipe.inputs) {
    if (countItems(player, inputIds(input)) < input.count) return null;
  }
  const taken = [];
  for (const input of recipe.inputs) {
    // Prefer the item in hand when an input accepts several.
    const order = [...inputIds(input)].sort((a, b) => (a === heldId ? -1 : b === heldId ? 1 : 0));
    taken.push(...takeItems(player, order, input.count));
  }
  return { taken };
}

function outputsFor(recipe, outputs = recipe.outputs) {
  return outputs.map((output) => ({ item: rid(output.item), count: output.count }));
}

/** The running batch as stored in block data. */
function batchFor(recipe, result) {
  const data = { recipe: recipe.id, start: nowTick(), ticks: recipe.ticks, outputs: outputsFor(recipe), refund: result.taken };
  if (recipe.aged) data.aged = { ticks: recipe.aged.ticks, outputs: outputsFor(recipe, recipe.aged.outputs) };
  return data;
}

const LIT_FIRES = ["minecraft:campfire", "minecraft:soul_campfire"];

function overLitFire(block) {
  try {
    const below = block.below();
    return LIT_FIRES.includes(below?.typeId) && below.permutation.getState("extinguished") !== true;
  } catch {
    return false;
  }
}

/** What a finished batch gives now: aged if it stayed long enough, smoked over a fire. */
function finalOutputs(block, data) {
  let outputs = data.outputs;
  if (data.aged && nowTick() >= data.start + data.aged.ticks) outputs = data.aged.outputs;
  if (shortId(block.typeId) === "aging_rack" && overLitFire(block)) {
    outputs = outputs.map((output) => {
      const smoked = SMOKING[shortId(output.item)];
      return smoked ? { item: rid(smoked), count: output.count } : output;
    });
  }
  return outputs;
}

/** Recipes that take `typeId`: those whose first input is the held item first, then the most specific. */
function candidatesFor(station, typeId) {
  const leads = (recipe) => (inputIds(recipe.inputs[0]).includes(typeId) ? 1 : 0);
  return recipesForStation(station)
    .filter((recipe) => recipe.inputs.some((input) => inputIds(input).includes(typeId)))
    .sort((a, b) => leads(b) - leads(a) || b.inputs.length - a.inputs.length);
}

function collect(block, player, data) {
  for (const output of finalOutputs(block, data)) give(player, output.item, output.count);
  takeBlockData(block.dimension, block.location, null, block.typeId);
  setBusy(block, false);
  block.dimension.playSound("random.pop", block.location);
}

function start(block, player) {
  const station = shortId(block.typeId);
  const held = mainHand(player)?.getItem();
  if (!held) return tell(player, "empty");
  const candidates = candidatesFor(station, held.typeId);
  if (!candidates.length) return tell(player, "wrong_item");

  for (const recipe of candidates) {
    const result = takeInputs(player, recipe, held.typeId);
    if (!result) continue;
    const outputs = outputsFor(recipe);
    if (recipe.ticks <= 0) {
      for (const output of outputs) give(player, output.item, output.count);
      block.dimension.playSound("block.grindstone.use", block.location);
      return;
    }
    setBlockData(block, batchFor(recipe, result));
    setBusy(block, true);
    block.dimension.playSound("bucket.fill_water", block.location);
    return;
  }
  tell(player, "missing");
}

function spill(dimension, location, typeId) {
  const data = takeBlockData(dimension, location, null, typeId);
  if (!data) return;
  const done = nowTick() >= data.start + ticksOf(data);
  const at = { x: location.x + 0.5, y: location.y + 0.5, z: location.z + 0.5 };
  if (done) {
    // The block is gone, so no fire bonus; aging still counts.
    const outputs = data.aged && nowTick() >= data.start + data.aged.ticks ? data.aged.outputs : data.outputs;
    for (const output of outputs) dropItems(dimension, output.item, output.count, at);
  } else {
    // Unfinished work gives the ingredients back.
    const counts = new Map();
    for (const id of data.refund ?? []) counts.set(id, (counts.get(id) ?? 0) + 1);
    for (const [id, count] of counts) dropItems(dimension, id, count, at);
  }
}

export const stationComponent = {
  onPlayerInteract({ block, player }) {
    if (!player) return;
    const data = getBlockData(block);
    if (!data) return start(block, player);
    const left = data.start + ticksOf(data) - nowTick();
    if (left <= 0) return collect(block, player, data);
    tell(player, "working", [String(Math.ceil(left / TICKS_PER_MINUTE))]);
  },

  onPlayerBreak({ block, dimension, brokenBlockPermutation }) {
    spill(dimension ?? block.dimension, block.location, brokenBlockPermutation?.type?.id);
  },

  onBreak({ block, dimension, brokenBlockPermutation }) {
    spill(dimension ?? block.dimension, block.location, brokenBlockPermutation?.type?.id);
  },
};

// --- 1.1 automated stations ------------------------------------------------------

/** Takes a recipe's inputs from a container: { taken }, or null if something is missing. */
function takeInputsFrom(container, recipe) {
  for (const input of recipe.inputs) if (countIn(container, inputIds(input)) < input.count) return null;
  const taken = [];
  for (const input of recipe.inputs) taken.push(...takeFrom(container, inputIds(input), input.count));
  return { taken };
}

/** One clock pass of an automated station: unload a finished batch below, then load a new one from above. */
export function tickAutoStation(block) {
  let data = getBlockData(block);
  if (data && nowTick() >= data.start + ticksOf(data)) {
    const below = containerOf(block.below());
    if (!below) return;
    const left = [];
    for (const output of finalOutputs(block, data)) {
      const rest = putInto(below, output.item, output.count);
      if (rest) left.push({ item: output.item, count: rest });
    }
    if (left.length) {
      setBlockData(block, { ...data, outputs: left, aged: undefined });
      return;
    }
    takeBlockData(block.dimension, block.location, null, block.typeId);
    setBusy(block, false);
    data = null;
  }
  if (data) return;
  const above = containerOf(block.above());
  if (!above) return;
  const recipes = [...recipesForStation(shortId(block.typeId))].filter((r) => r.ticks > 0).sort((a, b) => b.inputs.length - a.inputs.length);
  for (const recipe of recipes) {
    const result = takeInputsFrom(above, recipe);
    if (!result) continue;
    setBlockData(block, batchFor(recipe, result));
    setBusy(block, true);
    return;
  }
}

/** The station component, also tracked on the ranch clock. */
export const autoStationComponent = clockBlockEvents(stationComponent);

export function startAutoStations() {
  for (const id of AUTO_STATIONS) defineClockBlock(rid(id), `auto_${id}`, tickAutoStation);
}
