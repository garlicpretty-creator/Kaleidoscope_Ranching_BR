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
// Registrations live for the world session; handling api_ready twice is safe.

import { system } from "@minecraft/server";
import { FISHING_FEEDS, registerFeed } from "../data/feeds.js";

const API_PING = "kaleidoscope_fishing:api_ping";
const API_READY = "kaleidoscope_fishing:api_ready";

let fishingInfo = null;

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
