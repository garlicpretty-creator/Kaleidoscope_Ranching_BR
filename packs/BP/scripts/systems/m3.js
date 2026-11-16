// M3 bootstrap: carcasses, butcher rack, milking, nests and processing.

import { system } from "@minecraft/server";
import { butcherRackComponent } from "./butcherRack.js";
import { startCarcassDrops } from "./carcass.js";
import { startMilking } from "./milking.js";
import { incubatorComponent, nestBoxComponent, startNests } from "./nest.js";
import { stationComponent } from "./stations.js";
import { hayRackComponent, startHayRacks } from "./hayRack.js";

export function startM3() {
  system.beforeEvents.startup.subscribe(({ blockComponentRegistry }) => {
    blockComponentRegistry.registerCustomComponent("kaleidoscope_ranching:butcher_rack", butcherRackComponent);
    blockComponentRegistry.registerCustomComponent("kaleidoscope_ranching:nest_box", nestBoxComponent);
    blockComponentRegistry.registerCustomComponent("kaleidoscope_ranching:incubator", incubatorComponent);
    blockComponentRegistry.registerCustomComponent("kaleidoscope_ranching:station", stationComponent);
    blockComponentRegistry.registerCustomComponent("kaleidoscope_ranching:hay_rack", hayRackComponent);
  });
  startCarcassDrops();
  startMilking();
  startNests();
  startHayRacks();
}
