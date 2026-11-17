// Integration layer for the Kaleidoscope Cookery host.
//
// ## Cookery exposes a Script Event bus instead of importable modules. We ping
// ## it after startup, wait for `api_ready`, then read its capability list.
// ## Cookery keeps registrations for the current world session only, so the
// ## handshake runs again on every world load.

import { system } from "@minecraft/server";

const API_PING = "kaleidoscope_cookery:api_ping";
const API_READY = "kaleidoscope_cookery:api_ready";

// How long to wait for Cookery before telling the player something is wrong.
const READY_TIMEOUT_TICKS = 200;

/** Capabilities reported by Cookery, or null until the handshake completes. */
let cookeryCapabilities = null;

const readyListeners = [];

/** Runs `listener(capabilities)` once Cookery is ready (immediately if it already is). */
export function onCookeryReady(listener) {
  if (cookeryCapabilities) listener(cookeryCapabilities);
  else readyListeners.push(listener);
}

/** True when Cookery reported the given capability during the handshake. */
export function cookeryHas(capability) {
  return cookeryCapabilities?.includes(capability) ?? false;
}

export function connectToCookery() {
  system.afterEvents.scriptEventReceive.subscribe((event) => {
    if (event.id !== API_READY || cookeryCapabilities) return;

    let payload;
    try {
      payload = JSON.parse(String(event.message ?? "{}"));
    } catch {
      return;
    }

    // ## Older v1 Cookery builds answer with only {api:1}; treat that as an
    // ## empty capability list rather than a failure.
    cookeryCapabilities = Array.isArray(payload.capabilities) ? payload.capabilities : [];
    for (const listener of readyListeners.splice(0)) listener(cookeryCapabilities);
  });

  system.run(() => system.sendScriptEvent(API_PING, ""));

  system.runTimeout(() => {
    if (cookeryCapabilities) return;
    // ## A setup problem, not a game event: it goes to the content log, never on screen.
    console.warn("[Kaleidoscope Ranching] Kaleidoscope Cookery did not respond. Check that Cookery 1.6.6 or newer is active and loaded above Ranching.");
  }, READY_TIMEOUT_TICKS);
}
