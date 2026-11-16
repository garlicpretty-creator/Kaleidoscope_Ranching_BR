// M2 照顧核心 — bootstrap. M1's main.js only needs:
//
//   import "./care_init.js";
//
// Registers every M2 block / item custom component and event subscription.

import { system } from "@minecraft/server";
import { troughComponent, tickTrough } from "./custom_components/trough.js";
import {
  waterTroughComponent, autoWatererComponent, tickWaterTrough, tickAutoWaterer,
} from "./custom_components/water_trough.js";
import { autoFeederComponent, tickAutoFeeder } from "./custom_components/auto_feeder.js";
import { saltLickComponent, tickSaltLick } from "./custom_components/salt_lick.js";
import { defineClockBlock, startBlockClock } from "./core/blockClock.js";
import { compostBinComponent } from "./custom_components/compost_bin.js";
import { alfalfaCropComponent } from "./custom_components/alfalfa_crop.js";
import { feedBagComponent } from "./events/feed_bag.js";
import { fertilizerComponent, manureForkComponent } from "./events/tools.js";
import { registerCareInteractions } from "./events/care_interact.js";
import { registerWorldHooks } from "./events/world_hooks.js";

const NS = "kaleidoscope_ranching";

system.beforeEvents.startup.subscribe(({ blockComponentRegistry: blocks, itemComponentRegistry: items }) => {
  blocks.registerCustomComponent(`${NS}:trough`, troughComponent);
  blocks.registerCustomComponent(`${NS}:water_trough`, waterTroughComponent);
  blocks.registerCustomComponent(`${NS}:auto_waterer`, autoWatererComponent);
  blocks.registerCustomComponent(`${NS}:auto_feeder`, autoFeederComponent);
  blocks.registerCustomComponent(`${NS}:salt_lick`, saltLickComponent);
  blocks.registerCustomComponent(`${NS}:compost_bin`, compostBinComponent);
  blocks.registerCustomComponent(`${NS}:alfalfa_crop`, alfalfaCropComponent);

  items.registerCustomComponent(`${NS}:feed_bag`, feedBagComponent);
  items.registerCustomComponent(`${NS}:fertilizer`, fertilizerComponent);
  items.registerCustomComponent(`${NS}:manure_fork`, manureForkComponent);
});

// ## Order matters within one clock pass: feeders top troughs up before the
// ## troughs feed, so an automated pen never misses a day.
defineClockBlock(`${NS}:auto_feeder`, "m2_auto_feeders", tickAutoFeeder);
defineClockBlock(`${NS}:trough`, "m2_troughs", tickTrough);
defineClockBlock(`${NS}:water_trough`, "m2_water_troughs", tickWaterTrough);
defineClockBlock(`${NS}:auto_waterer`, "m2_auto_waterers", tickAutoWaterer);
defineClockBlock(`${NS}:salt_lick`, "m2_salt_licks", tickSaltLick);
startBlockClock();

registerCareInteractions();
registerWorldHooks();

// Public surface for M1 (breeding) and M3.
export {
  ensureSettled, getHearts, getAffection, setAffection, addAffection,
  needsMetToday, feedTierToday, lastDayTier,
} from "./care/state.js";
export { registerFeed } from "./data/feeds.js";
export { registerSpecies } from "./data/species.js";
