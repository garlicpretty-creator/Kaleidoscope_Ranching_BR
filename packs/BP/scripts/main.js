// Kaleidoscope Ranching entry point.
// Keep this file small: bootstrap integrations, components and events only.

import { connectToCookery } from "./api/cookery.js";
import { ANIMALS } from "./data/animals.js";
import { startBreeding } from "./systems/breeding.js";
import { startConversion } from "./systems/conversion.js";
import { startVanillaParity } from "./systems/vanillaParity.js";

connectToCookery();

// M1: own animals, sex, breeding
startConversion();
startBreeding(ANIMALS);
startVanillaParity();
