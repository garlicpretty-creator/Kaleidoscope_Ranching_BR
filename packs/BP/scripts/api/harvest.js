// Optional integration with Kaleidoscope Harvest (森羅物語：豐收): its corn goes in the silage barrel.
//
// ## Harvest already registers its crops as trough feed with us (it calls register_feed). This is
// ## the other way round: a Ranching recipe that uses a Harvest item, added only when Harvest is
// ## there, like the Fishing recipes in api/fishing.js.
//
// ## How we know Harvest is there: from Harvest's own API, kaleidoscope_harvest:api_ready
// ## (answering our api_ping, or announced by itself after load). Harvest 1.0.0 has no API of its
// ## own, so 2 seconds after load we also look for its corn item. Either one adds the recipe;
// ## adding it twice is safe (addRecipe replaces by id).

import { ItemTypes, system } from "@minecraft/server";
import { addRecipe } from "../core/content.js";
import { HARVEST_CORN } from "../data/partners.js";

const R = (id) => `kaleidoscope_ranching:${id}`;
const API_PING = "kaleidoscope_harvest:api_ping";
const API_READY = "kaleidoscope_harvest:api_ready";
const DAY = 24000;

let harvestInfo = null;
let found = false;

/** Recipes that use Harvest's items. */
export const HARVEST_RECIPES = [
  { id: R("silage/harvest_corn"), station: "silage_barrel", inputs: [{ item: HARVEST_CORN, count: 4 }], outputs: [{ item: R("silage"), count: 4 }], ticks: DAY * 3 },
];

function addHarvestRecipes(how) {
  for (const recipe of HARVEST_RECIPES) addRecipe(recipe);
  if (!found) console.info(`[kaleidoscope_ranching] Kaleidoscope Harvest found (${how}): its corn makes silage`);
  found = true;
}

/** Harvest's api_ready payload ({ api, version, capabilities }), or null if it has not answered. */
export function harvest() {
  return harvestInfo;
}

/** Handles Harvest's api_ready (exported for tests); true when it was API 1. */
export function onHarvestReady(raw) {
  let payload;
  try {
    payload = JSON.parse(String(raw ?? "{}"));
  } catch {
    return false;
  }
  if (Number(payload?.api) !== 1) return false;
  harvestInfo = payload;
  addHarvestRecipes(`version ${payload.version ?? "?"}`);
  return true;
}

/** Harvest 1.0.0 answers nothing: look for its corn instead (exported for tests). */
export function lookForHarvestItems(itemTypes = ItemTypes) {
  let present = false;
  try {
    present = !!itemTypes.get(HARVEST_CORN);
  } catch {}
  if (present) addHarvestRecipes("by its items");
  return present;
}

export function connectToHarvest() {
  system.afterEvents.scriptEventReceive.subscribe(
    (event) => {
      if (event.id === API_READY) onHarvestReady(event.message);
    },
    { namespaces: ["kaleidoscope_harvest"] }
  );
  system.runTimeout(pingHarvest, 20);
  system.runTimeout(() => {
    if (!found) lookForHarvestItems();
  }, 40);
}

/** Asks Harvest to (re)send api_ready; harmless when it is not installed. */
export function pingHarvest() {
  try {
    system.sendScriptEvent(API_PING, "kaleidoscope_ranching");
  } catch {}
}
