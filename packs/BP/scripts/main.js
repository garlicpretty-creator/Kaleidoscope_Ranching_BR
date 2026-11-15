// Kaleidoscope Ranching entry point.
// Keep this file small: bootstrap integrations, components and events only.

import { connectToCookery } from "./api/cookery.js";
import { ANIMALS } from "./data/animals.js";
import { startBreeding } from "./systems/breeding.js";
import { startConversion } from "./systems/conversion.js";
import { startVanillaParity } from "./systems/vanillaParity.js";
import "./care_init.js";
import { connectCareCore } from "./systems/careBridge.js";

connectToCookery();

// M1: own animals, sex, breeding
startConversion();
startBreeding(ANIMALS);
startVanillaParity();

// M2: care core (registers its own components and events on import)
connectCareCore();
