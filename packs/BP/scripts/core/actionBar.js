// Every Ranching action-bar message goes through showActionBar.
//
// ## Nothing is shown: the add-on is played without text on screen (immersion). What happened
// ## shows in the world instead (sounds, particles, the blocks' and animals' models; the eggs'
// ## cracks and the candler's glow, systems/nest.js). A key listed in SHOWN would be shown; none
// ## is. (The missing-Cookery warning is a setup error, sent as a chat message in api/cookery.js.)

const NS = "kaleidoscope_ranching";

/** Language keys still shown, written as "message.x" (the namespace is added): none. */
const SHOWN = new Set([].map((key) => `${NS}.${key}`));

/** True when the message with this language key is not shown. */
export function isQuiet(key) {
  return !SHOWN.has(key);
}

/** Shows rawtext on the player's action bar if its key is in SHOWN. */
export function showActionBar(player, rawtext) {
  if (!rawtext || typeof rawtext !== "object" || isQuiet(rawtext.translate)) return;
  try {
    player.onScreenDisplay.setActionBar(rawtext);
  } catch {}
}
