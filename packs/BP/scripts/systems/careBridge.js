// Connects M2's care core to the husbandry contract that M1 (breeding) and M3
// (milking, laying, hatching) call. See docs/INTERFACES.md.
//
// ## M2 stores affection as points (20 per heart) and records which feed tier
// ## an animal ate each day. Quality follows data/animals.js QUALITY_RULES:
// ## the first rule whose affection and feed tier are both reached wins.

import { QUALITY_RULES } from "../data/animals.js";
import { CARE } from "../data/care_config.js";
import { registerHusbandryProvider } from "../core/husbandry.js";
import { feedTierToday, getHearts, lastDayTier, needsMetToday, setAffection } from "../care/state.js";
import { today } from "../utils/world_util.js";

function qualityFor(hearts, feedTier) {
  const rule = QUALITY_RULES.find((r) => hearts >= r.minAffection && feedTier >= r.minFeedTier);
  return rule?.tier ?? "plain";
}

export function connectCareCore() {
  registerHusbandryProvider({
    getAffection: (entity) => getHearts(entity),

    canBreed: (entity) => needsMetToday(entity),

    // ## Milk and eggs are collected lazily, so `day` may be in the past. M2
    // ## only remembers today's feed and the last settled day's feed; older
    // ## days fall back to the last settled day. An unfed day still produces,
    // ## at plain quality (企劃書: neglected animals only drop to plain).
    production(entity, day) {
      const tier = day >= today() ? feedTierToday(entity) : lastDayTier(entity);
      return { produces: true, quality: qualityFor(getHearts(entity), tier) };
    },

    onBorn(baby, _mother, inheritedHearts) {
      setAffection(baby, inheritedHearts * CARE.POINTS_PER_HEART);
    },
  });
}
