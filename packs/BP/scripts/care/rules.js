// Pure care rules — no Minecraft imports, so they can be unit-tested in Node.
// A "record" is the animal's care data (stored as entity dynamic properties).

import { CARE } from "../data/care_config.js";

export function clampPoints(p) {
  return Math.max(0, Math.min(CARE.MAX_POINTS, Math.round(p)));
}
export function hearts(points) {
  return Math.floor((points ?? 0) / CARE.POINTS_PER_HEART);
}

/** Needs met on day `d` according to the marks in `rec`. */
export function needsOn(rec, d, cleanNeed) {
  const fed = rec.fed_day === d;
  const water = rec.water_day === d;
  const groom = rec.groom_day === d;
  const clean = !cleanNeed || rec.clean_day === d;
  return { fed, water, groom, clean, all: fed && water && groom && clean };
}

/**
 * Lazy settlement (企劃書 延遲結算). Evaluates the recorded care day once the
 * game day has moved past it. Days the animal was not loaded count as neutral.
 * Returns { rec, changed, manure }.
 */
export function settle(rec, day, cleanNeed, rand = Math.random) {
  const r = { ...rec };
  if (r.care_day === undefined) {
    r.care_day = day;
    if (r.aff === undefined) r.aff = CARE.START_POINTS;
    r.hungry = r.hungry ?? 0;
    return { rec: r, changed: true, manure: false };
  }
  if (day <= r.care_day) return { rec: r, changed: false, manure: false };

  const d = r.care_day;
  const n = needsOn(r, d, cleanNeed);
  let aff = r.aff ?? CARE.START_POINTS;
  if (n.all) aff += CARE.FULL_CARE_GAIN;
  if (r.salt_day === d) aff += CARE.SALT_LICK_GAIN;
  if (n.fed) r.hungry = 0;
  else {
    r.hungry = (r.hungry ?? 0) + 1;
    if (r.hungry >= CARE.HUNGRY_STREAK_LIMIT) {
      aff -= CARE.HUNGRY_LOSS;
      r.hungry = 0;
    }
  }
  r.aff = clampPoints(aff);
  r.prev_day = d;
  r.prev_all = n.all;
  r.prev_tier = n.fed ? r.fed_tier ?? 0 : 0;
  r.care_day = day;
  const manure = cleanNeed && rand() < CARE.MANURE_CHANCE;
  return { rec: r, changed: true, manure };
}
