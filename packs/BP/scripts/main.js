// Kaleidoscope Ranching entry point.
// Keep this file small: bootstrap integrations, components and events only.

import { connectToCookery } from "./api/cookery.js";

connectToCookery();
