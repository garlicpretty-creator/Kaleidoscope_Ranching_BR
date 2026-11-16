// Care state on the entity, plus the public functions M1/M3 call.
//
//   ensureSettled(e)        run the lazy daily settlement if a day has passed
//   mark(e, need, extra)    record a need as met today ("fed"|"water"|"groom"|"clean"|"salt")
//   getHearts(e)            0–5
//   getAffection / setAffection (points 0–100; M1 uses it for inheritance)
//   needsMetToday(e)        M1 breeding check: both parents' needs met today
//   feedTierToday(e)        tier of today's feed (0 if unfed)
//   lastDayTier(e)          tier the animal ate on its last settled day

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
  const prior = readRecord(e);
  const { rec, changed, manure } = settle({ ...prior }, day, cleanNeedEnabled());
  // 1.1 疾病: a sick animal's affection does not rise (systems/disease.js).
  if (isSick(e) && typeof prior.aff === "number" && rec.aff > prior.aff) rec.aff = prior.aff;
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
  if ((need === "fed" || need === "water") && isMarkedToday(e, "fed") && isMarkedToday(e, "water")) tryEvent(e, "sated");
  return true;
}
export function isMarkedToday(e, need) {
  return e.getDynamicProperty(`kr:${need}_day`) === today();
}

export function getAffection(e) {
  return e.getDynamicProperty("kr:aff") ?? CARE.START_POINTS;
}
export function setAffection(e, points) {
  // 1.1 疾病: no affection gained while sick (losing it still counts).
  if (isSick(e) && points > getAffection(e)) return;
  e.setDynamicProperty("kr:aff", clampPoints(points));
}
function isSick(e) {
  try {
    return e.getDynamicProperty("kaleidoscope_ranching:sick") === true;
  } catch {
    return false;
  }
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
