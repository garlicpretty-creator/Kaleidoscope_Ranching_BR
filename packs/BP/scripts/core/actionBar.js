// Every Ranching action-bar message goes through showActionBar.
//
// ## Nothing is shown: the add-on is played without text on screen (immersion). What happened
// ## shows in the world instead (sounds, particles, the blocks' and animals' models). The only
// ## exceptions are listed in SHOWN, until what they say can be seen in the world as well.
// ## (The missing-Cookery warning is a setup error, sent as a chat message in api/cookery.js.)

const NS = "kaleidoscope_ranching";

const SHOWN = new Set(
  [
    // The candling lamp's read-out: until the eggs themselves show how far along they are.
    "message.candler.none",
    "message.candler.status",
    "message.candler.paused",
  ].map((key) => `${NS}.${key}`)
);

/** True when the message with this language key is not shown. */
export function isQuiet(key) {
  return !SHOWN.has(key);
}

/** Shows rawtext on the player's action bar if its key is one of the few still SHOWN. */
export function showActionBar(player, rawtext) {
  if (!rawtext || typeof rawtext !== "object" || isQuiet(rawtext.translate)) return;
  try {
    player.onScreenDisplay.setActionBar(rawtext);
  } catch {}
}
