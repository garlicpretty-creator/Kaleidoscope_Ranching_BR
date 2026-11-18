// Optional integration with Kaleidoscope Herbal (森羅物語：草本 1.1, API 1): 寒熱 for Ranching foods.
//
//   → kaleidoscope_herbal:api_ping        at startup (message: our namespace)
//   ← kaleidoscope_herbal:api_ready       { api, source, version, capabilities, limits }
//   → kaleidoscope_herbal:heat_register   { api, source, items: [{ id, heat }] }   needs external_heat
//   ← kaleidoscope_herbal:heat_ack        { to, ok, accepted, rejected, code?, more? }
//
// ## Script Events only, never Herbal's files (Herbal docs/API.md). Herbal keeps no outside
// ## registrations, so every api_ready (its own announcement and the answer to our ping) sends
// ## the values again; that is harmless. Herbal applies the value when the food is eaten; the
// ## food's own effects stay Ranching's. Without Herbal nothing answers and nothing is sent.

import { system } from "@minecraft/server";
import { HERBAL_HEAT } from "../data/partners.js";

const NS = "kaleidoscope_ranching";
const H = "kaleidoscope_herbal";
export const HERBAL_PING = `${H}:api_ping`;
export const HERBAL_READY = `${H}:api_ready`;
const HEAT_ACK = `${H}:heat_ack`;
/** Script events carry at most 2048 characters; stay well inside it. */
const MAX_MESSAGE = 1800;

let herbalInfo = null;
const reported = new Set();

/** The heat_register messages Herbal can take, given its api_ready payload (exported for tests). */
export function herbalMessages(info = herbalInfo) {
  if (!info || !Array.isArray(info.capabilities) || !info.capabilities.includes("external_heat")) return [];
  const perMessage = Math.max(1, Math.min(32, Number(info.limits?.itemsPerMessage) || 32));
  const message = (items) => JSON.stringify({ api: 1, source: NS, items });
  const out = [];
  let batch = [];
  for (const [item, heat] of Object.entries(HERBAL_HEAT)) {
    const row = { id: `${NS}:${item}`, heat: heat[0] };
    if (batch.length && (batch.length >= perMessage || message([...batch, row]).length > MAX_MESSAGE)) {
      out.push(message(batch));
      batch = [];
    }
    batch.push(row);
  }
  if (batch.length) out.push(message(batch));
  return out;
}

/** Herbal's api_ready payload, or null if it has not answered. */
export function herbal() {
  return herbalInfo;
}

/** Handles Herbal's api_ready (exported for tests); true when it was API 1. */
export function onHerbalReady(raw) {
  let payload;
  try {
    payload = JSON.parse(String(raw ?? "{}"));
  } catch {
    return false;
  }
  if (Number(payload?.api) !== 1) return false;
  const first = herbalInfo === null;
  herbalInfo = payload;
  for (const message of herbalMessages(payload)) {
    try {
      system.sendScriptEvent(`${H}:heat_register`, message);
    } catch {}
  }
  if (first) console.info(`[kaleidoscope_ranching] Herbal ${payload.version ?? "?"} found: Ranching foods warm or cool the body`);
  return true;
}

/** Logs Herbal's refusals of our values, each once (exported for tests). */
export function onHeatAck(raw) {
  let ack;
  try {
    ack = JSON.parse(String(raw ?? "{}"));
  } catch {
    return;
  }
  if (ack?.to !== NS) return;
  const problems = [...(ack.code ? [ack.code] : []), ...(Array.isArray(ack.rejected) ? ack.rejected : []).map((row) => `${row?.id} ${row?.code}`)];
  for (const problem of problems) {
    if (reported.has(problem)) continue;
    reported.add(problem);
    console.warn(`[kaleidoscope_ranching] Herbal refused a heat value: ${problem}`);
  }
}

export function connectToHerbal() {
  system.afterEvents.scriptEventReceive.subscribe(
    (event) => {
      if (event.id === HERBAL_READY) onHerbalReady(event.message);
      else if (event.id === HEAT_ACK) onHeatAck(event.message);
    },
    { namespaces: [H] }
  );
  system.runTimeout(pingHerbal, 20);
}

/** Asks Herbal to (re)send api_ready; harmless when it is not installed. */
export function pingHerbal() {
  try {
    system.sendScriptEvent(HERBAL_PING, NS);
  } catch {}
}

/** Test hook: forget the handshake. */
export function __resetHerbal() {
  herbalInfo = null;
  reported.clear();
}
