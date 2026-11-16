// Optional integration with Kaleidoscope Fishing Voyage (森羅物語：漁歌).
//
// ## Fishing Voyage has its own v1 Script Event API, like Cookery's: anyone
// ## may send kaleidoscope_fishing:api_ping (the message is the sender's
// ## namespace) and Fishing answers with kaleidoscope_fishing:api_ready. It
// ## also sends api_ready by itself ~10 ticks after load. When it is there,
// ## Ranching adds Fishing's fish offal and fish bones to the trough feed
// ## table as poultry feed (data/feeds.js FISHING_FEEDS). When it is not,
// ## nothing happens and nothing is logged: Fishing is optional (企劃書).
//
// 1.1 handshake (企劃書 1.1 對外 API 與系列握手):
// - register_bait: chicken gizzard, pork liver, the three minces and cheese
//   slices become baits (biteFactor 0.7–0.85; Fishing's own best is 0.5).
// - Fishing's fish bones grind into calcium powder on the meat grinder.
// - Fishing's sea salt cures duck eggs in place of clay, and hung with meat on
//   the butcher rack it cuts air-drying from three days to two (butcherRack.js).
//
// Registrations live for the world session; handling api_ready twice is safe.

import { system } from "@minecraft/server";
import { FISHING_FEEDS, registerFeed } from "../data/feeds.js";
import { addRecipe } from "../core/content.js";

const API_PING = "kaleidoscope_fishing:api_ping";
const API_READY = "kaleidoscope_fishing:api_ready";

let fishingInfo = null;

const R = (id) => `kaleidoscope_ranching:${id}`;
export const SEA_SALT = "kaleidoscope_fishing:sea_salt";
export const FISH_BONES = "kaleidoscope_fishing:fish_bones";

/** Ranching items offered to Fishing as bait: [item, biteFactor]. */
export const BAITS = [
  ["chicken_gizzard", 0.75], ["pork_liver", 0.75],
  ["pork_mince", 0.8], ["beef_mince", 0.8], ["mutton_mince", 0.8],
  ["cheese_slice", 0.85],
];

/** Recipes that use Fishing's items; added only once Fishing answers (its items exist then). */
export const FISHING_RECIPES = [
  { id: R("grind/fish_bones"), station: "meat_grinder", inputs: [{ item: FISH_BONES, count: 2 }], outputs: [{ item: R("calcium_powder"), count: 1 }], ticks: 0 },
  { id: R("pickle/salted_duck_egg_sea_salt"), station: "pickling_vat", inputs: [{ item: R("duck_egg"), count: 4 }, { item: SEA_SALT, count: 1 }], outputs: [{ item: R("salted_duck_egg"), count: 4 }], ticks: 24000 * 2 },
];

function sendBaits() {
  const message = JSON.stringify({ api: 1, source: "kaleidoscope_ranching", baits: BAITS.map(([id, biteFactor]) => ({ id: R(id), biteFactor })) });
  try {
    system.sendScriptEvent("kaleidoscope_fishing:register_bait", message);
  } catch {}
}

/** Fishing Voyage's api_ready payload ({ api, version, capabilities }), or null if it has not answered. */
export function fishingVoyage() {
  return fishingInfo;
}

/** Handles Fishing's api_ready (exported for tests). */
export function onFishingReady(message) {
  let payload;
  try {
    payload = JSON.parse(String(message ?? "{}"));
  } catch {
    return false;
  }
  if (Number(payload.api) !== 1) return false;
  const first = fishingInfo === null;
  fishingInfo = payload;
  for (const [item, { kind, units }] of Object.entries(FISHING_FEEDS)) registerFeed(item, kind, units);
  for (const recipe of FISHING_RECIPES) addRecipe(recipe);
  sendBaits();
  if (first) console.info(`[kaleidoscope_ranching] Fishing Voyage ${payload.version ?? "?"} found: fish offal and fish bones are poultry feed`);
  return true;
}

export function connectToFishing() {
  system.afterEvents.scriptEventReceive.subscribe(
    (event) => {
      if (event.id === API_READY) onFishingReady(event.message);
    },
    { namespaces: ["kaleidoscope_fishing"] }
  );
  system.runTimeout(pingFishing, 20);
}

/** Asks Fishing Voyage to (re)send api_ready; harmless when it is not installed. */
export function pingFishing() {
  try {
    system.sendScriptEvent(API_PING, "kaleidoscope_ranching");
  } catch {}
}
