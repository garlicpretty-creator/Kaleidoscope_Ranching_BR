// Optional integration with Kaleidoscope Herbal (森羅物語：草本 1.1, API 1).
//
// ## Herbal has a v1 Script Event API like Cookery's and Fishing's: anyone may
// ## send kaleidoscope_herbal:api_ping and Herbal answers with
// ## kaleidoscope_herbal:api_ready { api, source, version, capabilities, limits };
// ## it also announces api_ready by itself after load. With capability
// ## external_heat, Ranching registers the 寒熱 of its dishes (HERBAL_HEAT), so
// ## eating cumin lamb warms a player and ice cream cools them. Herbal only
// ## changes 寒熱; hunger and effects stay Ranching's. Without Herbal nothing is
// ## sent and nothing is logged.
//
//   → kaleidoscope_herbal:api_ping        message: our namespace
//   ← kaleidoscope_herbal:api_ready       script-sent only (sourceType "Server")
//   → kaleidoscope_herbal:heat_register   { api: 1, source, items: [{ id, heat }] }, ≤ itemsPerMessage per message
//   ← kaleidoscope_herbal:heat_ack        { to, ok, accepted, rejected, code? }: refusals go to the content log once
//
// Herbal keeps no outside registrations: every api_ready sends them again (Herbal docs/API.md: harmless).
// Herbal applies 寒熱 on itemCompleteUse, so a dish eaten from a placed plate does not count.

import { system } from "@minecraft/server";

const H = "kaleidoscope_herbal";
const SOURCE = "kaleidoscope_ranching";
const MAX_MESSAGE = 1800;
const R = (id) => `${SOURCE}:${id}`;

/**
 * −100 (cold) … +100 (hot). Herbal's own teas are ±35–40 and tonics +30–40;
 * everyday dishes stay within ±30. Only dishes whose nature is plain in 中醫
 * food lore are listed: [item, heat, why].
 */
export const HERBAL_HEAT = [
  ["cumin_lamb_chops", 20, "羊肉性溫，孜然辛熱"],
  ["roast_lamb_leg", 20, "烤羊腿，羊肉性溫"],
  ["lamb_meatball_soup", 15, "羊肉丸湯，溫中暖身"],
  ["yak_stew", 15, "氂牛肉性溫，高原的暖身燉菜"],
  ["chhurpi_butter_tea", 20, "酥油茶是高原驅寒的熱飲"],
  ["milk_wine", 15, "酒性溫熱"],
  ["yak_milk_wine", 15, "酒性溫熱"],
  ["cream_cocoa", 10, "熱可可，暖胃"],
  ["old_duck_soup", -15, "鴨肉性涼，老鴨湯滋陰清熱"],
  ["duck_blood_noodle_soup", -5, "鴨血性涼，熱湯只略涼"],
  ["yogurt", -5, "酸奶性平偏涼"],
  ["vanilla_ice_cream", -30, "冰品最涼"],
  ["chocolate_ice_cream", -30, "冰品最涼"],
  ["berry_ice_cream", -30, "冰品最涼"],
];

let herbalInfo = null;
const reported = new Set();

/** The heat_register messages for this api_ready payload (nothing without external_heat). */
export function herbalMessages(info = herbalInfo) {
  if (!info || !Array.isArray(info.capabilities) || !info.capabilities.includes("external_heat")) return [];
  const perMessage = Math.max(1, Math.min(32, Number(info.limits?.itemsPerMessage) || 32));
  const out = [];
  const message = (items) => JSON.stringify({ api: 1, source: SOURCE, items });
  let batch = [];
  for (const [id, heat] of HERBAL_HEAT) {
    const row = { id: R(id), heat };
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

/** Handles one Herbal script event (exported for tests). Returns true for an api_ready acted on. */
export function onHerbalEvent(event) {
  if (event.sourceType !== undefined && event.sourceType !== "Server") return false;
  let m;
  try {
    m = JSON.parse(String(event.message ?? "{}"));
  } catch {
    return false;
  }
  if (!m || Number(m.api) !== 1) return false;
  if (event.id === `${H}:api_ready`) {
    const first = herbalInfo === null;
    herbalInfo = m;
    for (const message of herbalMessages(m)) {
      try {
        system.sendScriptEvent(`${H}:heat_register`, message);
      } catch {}
    }
    if (first) console.info(`[kaleidoscope_ranching] Herbal ${m.version ?? "?"} found: Ranching dishes warm and cool`);
    return true;
  }
  if (event.id === `${H}:heat_ack` && m.to === SOURCE) {
    const problems = [...(m.code ? [m.code] : []), ...(Array.isArray(m.rejected) ? m.rejected : []).map((r) => `${r?.id} ${r?.code}`)];
    for (const problem of problems) {
      if (reported.has(problem)) continue;
      reported.add(problem);
      console.warn(`[kaleidoscope_ranching] Herbal refused heat value: ${problem}`);
    }
  }
  return false;
}

export function connectToHerbal() {
  system.afterEvents.scriptEventReceive.subscribe(onHerbalEvent, { namespaces: [H] });
  system.runTimeout(pingHerbal, 20);
}

/** Asks Herbal to (re)send api_ready; harmless when it is not installed. */
export function pingHerbal() {
  try {
    system.sendScriptEvent(`${H}:api_ping`, SOURCE);
  } catch {}
}

/** Test hook: forget the handshake. */
export function __resetHerbal() {
  herbalInfo = null;
  reported.clear();
}
