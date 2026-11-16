// Every Ranching action-bar message goes through showActionBar.
//
// ## Only messages that say why something did not work are shown (wrong item,
// ## missing bottle, needs a heat source...). How-to hints and status read-outs
// ## (fill counts, progress, "it looks happy") are not: the player asked for no
// ## hint text on screen. Their language keys stay, so a key can be brought back
// ## by taking it out of QUIET.

const NS = "kaleidoscope_ranching";

const QUIET = new Set(
  [
    // How-to hints
    "message.food_waste_bin.empty",
    "message.hitching_post.empty",
    "message.station.empty",
    "message.rack.empty",
    "ui.compost.filling",
    // Status read-outs
    "message.nest.empty",
    "message.incubator.empty",
    "message.nursing.grew",
    "message.station.working",
    "message.hay_rack.status",
    "message.hitching_post.tied",
    "message.hitching_post.untied",
    "message.cowbell.called",
    "message.food_waste_bin.added",
    "ui.trough.status",
    "ui.water.status",
    "ui.waterer.ok",
    "ui.compost.started",
    "ui.compost.progress",
    "ui.bag.status",
    "ui.care.petted",
    "ui.care.brushed",
    "ui.care.ear_tagged",
    // 1.1
    "message.milking_rack.empty",
    "message.milking_rack.tied",
    "message.milking_rack.untied",
    "message.rack.drying_hung",
    "message.rack.drying_left",
    "message.wash.done",
    // (The candling lamp's read-out stays: showing hatching progress is what the tool is for.)
  ].map((key) => `${NS}.${key}`)
);

/** True when the message with this language key is not shown. */
export function isQuiet(key) {
  return QUIET.has(key);
}

/** Shows rawtext on the player's action bar unless it is a hint or status message. */
export function showActionBar(player, rawtext) {
  if (rawtext && typeof rawtext === "object" && isQuiet(rawtext.translate)) return;
  try {
    player.onScreenDisplay.setActionBar(rawtext);
  } catch {}
}
