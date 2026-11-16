// Care state on the entity, plus the public functions M1/M3 call.
//
//   ensureSettled(e)        run the lazy daily settlement if a day has passed
//   mark(e, need, extra)    record a need as met today ("fed"|"water"|"groom"|"clean"|"salt")
//   getHearts(e)            0–5
//   getAffection / setAffection (points 0–100; M1 uses it for inheritance)
//   needsMetToday(e)        M1 breeding check: both parents' needs met today
//   feedTierToday(e)        M3 quality: tier of today's feed (0 if unfed)
//   lastDayTier(e)          M3 quality: tier the animal ate on its last settled day

import { world } from "@minecraft/server";
import { CARE, CFG_CLEAN_NEED } from "../data/care_config.js";
import { settle, needsOn, hearts, clampPoints } from "./rules.js";
import { today } from "../utils/world_util.js";
import { placeManureNear } from "../custom_components/manure.js";
import { updateRoster } from "../ui/roster.js";

const FIELDS = [
  "aff", "care_day", "fed_day", "fed_tier", "water_day", "groom_day", "clean_day",
  "salt_day", "treat_day", "hungry", "prev_day", "prev_all", "prev_tier",
];

export function cleanNeedEnabled() {
  return world.getDynamicProperty(CFG_CLEAN_NEED) !== false;
}

export function readRecord(e) {
  const r = {};
  for (const f of FIELDS) {
    const v = e.getDynamicProperty(`kr:${f}`);
    if (v !== undefined) r[f] = v;
  }
  return r;
}
function writeRecord(e, r) {
  for (const f of FIELDS) {
    if (r[f] !== undefined) e.setDynamicProperty(`kr:${f}`, r[f]);
  }
}

// ## Animals walk to troughs and water troughs while they still need feed or
// ## water today (entity group `seeking`, tools/gen_entities.mjs). Animals
// ## from other add-ons may not define these events; that is fine.
function tryEvent(e, name) {
  try {
    e.triggerEvent(`kaleidoscope_ranching:${name}`);
  } catch {}
}

export function ensureSettled(e, day = today()) {
  if (!e?.isValid) return readRecord(e);
  const before = e.getDynamicProperty("kr:care_day");
  const { rec, changed, manure } = settle(readRecord(e), day, cleanNeedEnabled());
  if (changed) {
    writeRecord(e, rec);
    updateRoster(e); // keeps the ear-tag roster's last-seen location fresh, once a day
    if (before !== undefined && rec.care_day !== before) tryEvent(e, "hungry"); // a new day: look for feed again
  }
  if (manure) placeManureNear(e);
  return rec;
}

/** Mark a need as satisfied today. Returns false if it already was. */
export function mark(e, need, extra = {}) {
  const day = today();
  const rec = ensureSettled(e, day);
  const key = `${need}_day`;
  if (rec[key] === day) return false;
  e.setDynamicProperty(`kr:${key}`, day);
  for (const [k, v] of Object.entries(extra)) e.setDynamicProperty(`kr:${k}`, v);
  if (need === "fed" || need === "water") {
    playEat(e);
    // Go on to whichever of feed and water is still missing; stop looking once both are met.
    const fed = isMarkedToday(e, "fed");
    const watered = isMarkedToday(e, "water");
    tryEvent(e, fed && watered ? "sated" : fed ? "seek_water" : "seek_feed");
  }
  return true;
}

const waiting = new Map(); // `${entity id}:${need}` -> clock passes spent in range but not beside the block
let waitingDay = -1;

/**
 * Whether an animal in range of a trough, rack or waterer should be served on this clock pass.
 * It is served as soon as it stands beside the block, so that eating and drinking happen at
 * the trough. One that stays away is served anyway after CARE.EAT_WAIT_PASSES passes.
 */
export function readyAt(e, block, need) {
  const day = today();
  if (day !== waitingDay) {
    waiting.clear();
    waitingDay = day;
  }
  const key = `${e.id}:${need}`;
  const dx = e.location.x - (block.location.x + 0.5);
  const dz = e.location.z - (block.location.z + 0.5);
  if (dx * dx + dz * dz <= CARE.EAT_RADIUS * CARE.EAT_RADIUS) {
    waiting.delete(key);
    return true;
  }
  const passes = (waiting.get(key) ?? 0) + 1;
  if (passes > CARE.EAT_WAIT_PASSES) {
    waiting.delete(key);
    return true;
  }
  waiting.set(key, passes);
  return false;
}

/**
 * Shows the animal eating or drinking: it stands still for three seconds and plays its
 * `eat` animation (tools/gen_art.py). Animals registered by other add-ons have no such
 * animation, so only Ranching's own are touched.
 */
function playEat(e) {
  const [namespace, id] = e.typeId.split(":");
  if (namespace !== "kaleidoscope_ranching") return;
  try {
    e.addEffect("slowness", 60, { amplifier: 10, showParticles: false });
    e.playAnimation(`animation.kaleidoscope_ranching.${id}.eat`);
  } catch {
    // unloaded or removed in the same tick: nothing to show
  }
}
export function isMarkedToday(e, need) {
  return e.getDynamicProperty(`kr:${need}_day`) === today();
}

export function getAffection(e) {
  return e.getDynamicProperty("kr:aff") ?? CARE.START_POINTS;
}
export function setAffection(e, points) {
  e.setDynamicProperty("kr:aff", clampPoints(points));
}
export function addAffection(e, delta) {
  ensureSettled(e);
  setAffection(e, getAffection(e) + delta);
}
export function getHearts(e) {
  return hearts(getAffection(e));
}

export function needsToday(e) {
  const day = today();
  return needsOn(ensureSettled(e, day), day, cleanNeedEnabled());
}
export function needsMetToday(e) {
  return needsToday(e).all;
}
export function feedTierToday(e) {
  return isMarkedToday(e, "fed") ? e.getDynamicProperty("kr:fed_tier") ?? 0 : 0;
}
export function lastDayTier(e) {
  return e.getDynamicProperty("kr:prev_tier") ?? 0;
}
