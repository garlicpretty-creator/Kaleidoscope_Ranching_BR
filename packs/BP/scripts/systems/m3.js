// M3 bootstrap: carcasses, butcher rack, milking, nests and processing.

import { system } from "@minecraft/server";
import { butcherRackComponent, startSavedDrying } from "./butcherRack.js";
import { startCarcassDrops } from "./carcass.js";
import { startMilking } from "./milking.js";
import { candlerItemComponent, incubatorComponent, nestBoxComponent, startNests } from "./nest.js";
import { autoStationComponent, startAutoStations, stationComponent } from "./stations.js";
import { milkingRackComponent, startMilkingRacks } from "./milkingRack.js";
import { startTruffles } from "./truffle.js";
import { startMoulting } from "./moult.js";
import { startSleep } from "./sleep.js";
import { startDisease } from "./disease.js";
import { startSpecialActions } from "./specialActions.js";
import { discoverTaggedItems } from "../core/tags.js";
import { world } from "@minecraft/server";
import { startPackBag } from "./packBag.js";
import { hornItemComponent, penGateComponent, penGateTopComponent, startWorkAnimals } from "./workAnimals.js";
import { featherDusterItemComponent, lassoItemComponent, rugComponent } from "./textiles.js";
import { hayRackComponent, startHayRacks } from "./hayRack.js";
import { pasturePostComponent, pastureSeedItemComponent, startPastures } from "./pasture.js";
import { startBlockFx } from "./blockFx.js";
import { cheeseWheelComponent } from "./cheeseWheel.js";
import { foodWasteBinComponent } from "./foodWasteBin.js";
import { placedFoodComponent } from "./placedFood.js";

export function startM3() {
  system.beforeEvents.startup.subscribe(({ blockComponentRegistry, itemComponentRegistry }) => {
    blockComponentRegistry.registerCustomComponent("kaleidoscope_ranching:butcher_rack", butcherRackComponent);
    blockComponentRegistry.registerCustomComponent("kaleidoscope_ranching:nest_box", nestBoxComponent);
    blockComponentRegistry.registerCustomComponent("kaleidoscope_ranching:incubator", incubatorComponent);
    blockComponentRegistry.registerCustomComponent("kaleidoscope_ranching:station", stationComponent);
    blockComponentRegistry.registerCustomComponent("kaleidoscope_ranching:hay_rack", hayRackComponent);
    // 1.1 追加 草場與放牧
    blockComponentRegistry.registerCustomComponent("kaleidoscope_ranching:pasture_post", pasturePostComponent);
    itemComponentRegistry.registerCustomComponent("kaleidoscope_ranching:pasture_seed", pastureSeedItemComponent);
    blockComponentRegistry.registerCustomComponent("kaleidoscope_ranching:cheese_wheel", cheeseWheelComponent);
    blockComponentRegistry.registerCustomComponent("kaleidoscope_ranching:food_waste_bin", foodWasteBinComponent);
    blockComponentRegistry.registerCustomComponent("kaleidoscope_ranching:placed_food", placedFoodComponent);
    // 1.1
    blockComponentRegistry.registerCustomComponent("kaleidoscope_ranching:auto_station", autoStationComponent);
    blockComponentRegistry.registerCustomComponent("kaleidoscope_ranching:milking_rack", milkingRackComponent);
    blockComponentRegistry.registerCustomComponent("kaleidoscope_ranching:rug", rugComponent);
    itemComponentRegistry.registerCustomComponent("kaleidoscope_ranching:lasso", lassoItemComponent);
    itemComponentRegistry.registerCustomComponent("kaleidoscope_ranching:feather_duster", featherDusterItemComponent);
    itemComponentRegistry.registerCustomComponent("kaleidoscope_ranching:egg_candler", candlerItemComponent);
    itemComponentRegistry.registerCustomComponent("kaleidoscope_ranching:herding_horn", hornItemComponent);
    blockComponentRegistry.registerCustomComponent("kaleidoscope_ranching:pen_gate", penGateComponent);
    blockComponentRegistry.registerCustomComponent("kaleidoscope_ranching:pen_gate_top", penGateTopComponent);
  });
  startCarcassDrops();
  startMilking();
  startNests();
  startHayRacks();
  startPastures(); // after the troughs and hay racks: better feed first
  startBlockFx();
  startAutoStations();
  startMilkingRacks();
  startTruffles();
  startMoulting();
  startSleep();
  startSpecialActions(); // 1.1 追加: the tom's display, the quail's dust bath, the alpaca's spit
  startDisease();
  // 1.1 標籤契約: other add-ons' tagged items join once the world has loaded.
  world.afterEvents.worldLoad?.subscribe(() => system.runTimeout(discoverTaggedItems, 40));
  startWorkAnimals();
  startSavedDrying();
  startPackBag();
}
