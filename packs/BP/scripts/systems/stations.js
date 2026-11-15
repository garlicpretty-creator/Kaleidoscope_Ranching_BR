// M3: one engine for every processing block (butter churn, cheese press,
// aging rack, fermenting jar, pickling vat). Recipes come from
// data/processing.js; a block uses the recipes whose `station` is its id.
//
// Use a station while holding an ingredient: if the player carries every input
// of a recipe that takes that ingredient, the inputs are taken and the station
// starts. Using it again once the time is up gives the outputs. Nothing ticks
// while it works: the start time is stored and compared on the next use.
//
// Quality: the lowest tier among the milk or eggs used scales the output count
// (QUALITY_YIELD), rounded down, at least 1.

import { ItemStack } from "@minecraft/server";
import { QUALITY_YIELD } from "../data/processing.js";
import { recipeById, recipesForStation } from "../core/content.js";
import { getBlockData, setBlockData, takeBlockData } from "../core/blockStore.js";
import { rid, shortId } from "../core/ids.js";
import { countItems, give, mainHand, takeItems } from "../core/inventory.js";
import { nowTick } from "../core/time.js";

const BUSY_STATE = "kaleidoscope_ranching:busy";
const TICKS_PER_MINUTE = 1200;
const TIER_NAMES = ["plain", "fine", "superb"];

const tierOf = (typeId) => (typeId.endsWith("_superb") ? 2 : typeId.endsWith("_fine") ? 1 : 0);
/** Input ids that come in quality tiers (anything with a _fine sibling in the same list). */
const isTiered = (ids) => ids.some((id) => id.endsWith("_fine"));

function tell(player, key, values) {
  player.onScreenDisplay.setActionBar({ translate: `kaleidoscope_ranching.message.station.${key}`, with: values });
}

function setBusy(block, busy) {
  block.setPermutation(block.permutation.withState(BUSY_STATE, busy));
}

// ## Recipes come from core/content.js: data/processing.js plus recipes other
// ## add-ons registered this session (kaleidoscope_ranching:register_recipe).

const inputIds = (input) => (input.anyOf ?? [input.item]).map(rid);

/** Takes a recipe's inputs and returns { taken, tier }, or null if something is missing. */
function takeInputs(player, recipe, heldId) {
  for (const input of recipe.inputs) {
    if (countItems(player, inputIds(input)) < input.count) return null;
  }
  const taken = [];
  let tier = 2;
  let tiered = false;
  for (const input of recipe.inputs) {
    const ids = inputIds(input);
    // Prefer the held item, then the lowest quality, so players keep their best milk.
    const order = [...ids].sort((a, b) => (a === heldId ? -1 : b === heldId ? 1 : tierOf(a) - tierOf(b)));
    const removed = takeItems(player, order, input.count);
    taken.push(...removed);
    if (isTiered(ids)) {
      tiered = true;
      for (const id of removed) tier = Math.min(tier, tierOf(id));
    }
  }
  return { taken, tier: tiered ? tier : 0 };
}

function outputsFor(recipe, tier) {
  const factor = QUALITY_YIELD[TIER_NAMES[tier]];
  return recipe.outputs.map((output) => ({ item: rid(output.item), count: Math.max(1, Math.floor(output.count * factor)) }));
}

function collect(block, player, data) {
  for (const output of data.outputs) give(player, output.item, output.count);
  takeBlockData(block.dimension, block.location, null, block.typeId);
  setBusy(block, false);
  block.dimension.playSound("random.pop", block.location);
}

function start(block, player) {
  const station = shortId(block.typeId);
  const held = mainHand(player)?.getItem();
  if (!held) return tell(player, "empty");
  const candidates = recipesForStation(station).filter((recipe) =>
    recipe.inputs.some((input) => inputIds(input).includes(held.typeId))
  );
  if (!candidates.length) return tell(player, "wrong_item");

  for (const recipe of candidates) {
    const result = takeInputs(player, recipe, held.typeId);
    if (!result) continue;
    const outputs = outputsFor(recipe, result.tier);
    if (recipe.ticks <= 0) {
      for (const output of outputs) give(player, output.item, output.count);
      return;
    }
    setBlockData(block, { recipe: recipe.id, start: nowTick(), outputs, refund: result.taken });
    setBusy(block, true);
    block.dimension.playSound("bucket.fill_water", block.location);
    return;
  }
  tell(player, "missing");
}

function spill(dimension, location, typeId) {
  const data = takeBlockData(dimension, location, null, typeId);
  if (!data) return;
  const recipe = recipeById(data.recipe);
  const done = recipe && nowTick() >= data.start + recipe.ticks;
  const at = { x: location.x + 0.5, y: location.y + 0.5, z: location.z + 0.5 };
  if (done) {
    for (const output of data.outputs) dimension.spawnItem(new ItemStack(output.item, output.count), at);
  } else {
    // Unfinished work gives the ingredients back.
    const counts = new Map();
    for (const id of data.refund ?? []) counts.set(id, (counts.get(id) ?? 0) + 1);
    for (const [id, count] of counts) dimension.spawnItem(new ItemStack(id, count), at);
  }
}

export const stationComponent = {
  onPlayerInteract({ block, player }) {
    if (!player) return;
    const data = getBlockData(block);
    if (!data) return start(block, player);
    const recipe = recipeById(data.recipe);
    const left = recipe ? data.start + recipe.ticks - nowTick() : 0;
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
