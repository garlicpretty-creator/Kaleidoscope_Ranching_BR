// M3: one engine for every processing block (butter churn, cheese press,
// aging rack, fermenting jar, pickling vat). Recipes come from
// data/processing.js; a block uses the recipes whose `station` is its id.
//
// Use a station while holding an ingredient: if the player carries every input
// of a recipe that takes that ingredient, the inputs are taken and the station
// starts. Using it again once the time is up gives the outputs. Nothing ticks
// while it works: the start time is stored and compared on the next use.

import { recipeById, recipesForStation } from "../core/content.js";
import { getBlockData, setBlockData, takeBlockData } from "../core/blockStore.js";
import { rid, shortId } from "../core/ids.js";
import { countItems, dropItems, give, mainHand, takeItems } from "../core/inventory.js";
import { nowTick } from "../core/time.js";
import { showActionBar } from "../core/actionBar.js";

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

function outputsFor(recipe) {
  return recipe.outputs.map((output) => ({ item: rid(output.item), count: output.count }));
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
    const outputs = outputsFor(recipe);
    if (recipe.ticks <= 0) {
      for (const output of outputs) give(player, output.item, output.count);
      return;
    }
    setBlockData(block, { recipe: recipe.id, start: nowTick(), ticks: recipe.ticks, outputs, refund: result.taken });
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
    for (const output of data.outputs) dropItems(dimension, output.item, output.count, at);
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
