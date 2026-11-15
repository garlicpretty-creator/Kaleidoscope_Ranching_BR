// Kaleidoscope Ranching entry point.
// Keep this file small: bootstrap integrations, components and events only.

import { connectToCookery } from "./api/cookery.js";
import { startRanchingApi } from "./api/ranchingApi.js";
import { ANIMALS } from "./data/animals.js";
import { startBreeding } from "./systems/breeding.js";
import { startConversion } from "./systems/conversion.js";
import { startVanillaParity } from "./systems/vanillaParity.js";
import "./care_init.js";
import { connectCareCore } from "./systems/careBridge.js";
import { startM3 } from "./systems/m3.js";
import { startM4 } from "./systems/m4.js";

connectToCookery();

// M5: Ranching's own public API for other add-ons (docs/API.md)
startRanchingApi();

// M1: own animals, sex, breeding
startConversion();
startBreeding(ANIMALS);
startVanillaParity();

// M2: care core (registers its own components and events on import)
connectCareCore();

// M3: carcasses, butcher rack, milking, nests, processing
startM3();
startM4();
