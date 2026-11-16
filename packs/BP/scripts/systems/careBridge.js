// Connects M2's care core to the husbandry contract that M1 (breeding) and M3
// (milking, laying, hatching) call. See docs/INTERFACES.md.
//
// ## M2 stores affection as points (20 per heart). Milk and eggs have no
// ## quality grades, so production does not depend on affection or feed.

import { CARE } from "../data/care_config.js";
import { registerHusbandryProvider } from "../core/husbandry.js";
import { getHearts, needsMetToday, setAffection } from "../care/state.js";

export function connectCareCore() {
  registerHusbandryProvider({
    getAffection: (entity) => getHearts(entity),

    canBreed: (entity) => needsMetToday(entity),

    // ## A neglected animal still produces (企劃書: neglect never stops production).
    production() {
      return { produces: true };
    },

    onBorn(baby, _mother, inheritedHearts) {
      setAffection(baby, inheritedHearts * CARE.POINTS_PER_HEART);
    },
  });
}
