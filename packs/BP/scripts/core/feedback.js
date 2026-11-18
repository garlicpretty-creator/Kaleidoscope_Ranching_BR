// What the player hears and sees when they do something. Ranching puts no text on the
// screen (immersion, as in the rest of the series): every outcome is a sound, a
// particle, or the block's or animal's model.
//
//   cue(target, sound, options)  a sound (and particle) at a block or an animal: something happened
//   refuse(player, animal?)      a low note for that player only: "no"; an animal also shakes its head
//   levelPitch(n, max)           a pitch that rises with a fill level, so a fuller block sounds higher

import { system, world } from "@minecraft/server";

/** Ticks between two refusals heard by one player (one held click is one "no"). */
const HINT_GAP = 10;
const last = new Map(); // player id → tick of the last refusal

/** The ambient sound of each Ranching animal (packs/RP/sounds.json; tools/validate.mjs checks they match). */
export const AMBIENT = {
  "kaleidoscope_ranching:cow": "mob.cow.say",
  "kaleidoscope_ranching:sheep": "mob.sheep.say",
  "kaleidoscope_ranching:goat": "mob.goat.ambient",
  "kaleidoscope_ranching:pig": "mob.pig.say",
  "kaleidoscope_ranching:chicken": "mob.chicken.say",
  "kaleidoscope_ranching:rabbit": "mob.rabbit.idle",
  "kaleidoscope_ranching:duck": "mob.chicken.say",
  "kaleidoscope_ranching:goose": "mob.chicken.say",
  "kaleidoscope_ranching:buffalo": "mob.cow.say",
  "kaleidoscope_ranching:yak": "mob.cow.say",
  "kaleidoscope_ranching:quail": "mob.chicken.say",
  "kaleidoscope_ranching:turkey": "mob.chicken.say",
  "kaleidoscope_ranching:alpaca": "mob.llama.idle",
  "minecraft:wolf": "mob.wolf.growl",
};

/** Where a cue sits: a block's centre (plus `y`), or an animal's location plus `y` (its head by default). */
function spot(target, y) {
  const { x, y: ty, z } = target.location;
  if (target.permutation !== undefined) return { x: x + 0.5, y: ty + 0.5 + (y ?? 0), z: z + 0.5 };
  return { x, y: ty + (y ?? 1), z };
}

/** Plays `sound` (and spawns `particle`) at a block or an entity, for everyone near. */
export function cue(target, sound, { pitch, volume, particle, y } = {}) {
  if (!target?.dimension || !target.location) return;
  const at = spot(target, y);
  if (sound) {
    const options = {};
    if (pitch !== undefined) options.pitch = pitch;
    if (volume !== undefined) options.volume = volume;
    try {
      target.dimension.playSound(sound, at, options);
    } catch {}
  }
  if (particle) {
    try {
      target.dimension.spawnParticle(particle, at);
    } catch {}
  }
}

/** The animal's own voice and an angry puff over its head. */
export function grumble(animal) {
  const sound = AMBIENT[animal?.typeId];
  cue(animal, sound, { particle: "minecraft:villager_angry", y: 1.2, pitch: 0.8 });
}

/**
 * The action was refused: a low note heard only by this player, at most every HINT_GAP ticks.
 * With an animal it also grumbles (its own sound and an angry puff).
 */
export function refuse(player, animal) {
  if (!player) return;
  const now = system.currentTick;
  const prev = last.get(player.id);
  if (prev !== undefined && now - prev >= 0 && now - prev < HINT_GAP) return;
  last.set(player.id, now);
  try {
    player.playSound("note.bass", { pitch: 0.7, volume: 0.6 });
  } catch {}
  if (animal?.isValid !== false && animal?.location) grumble(animal);
}

/** A pitch from 0.7 (empty) to 1.3 (full) for a fill level n of max. */
export function levelPitch(n, max) {
  const ratio = max > 0 ? Math.max(0, Math.min(1, n / max)) : 0;
  return 0.7 + 0.6 * ratio;
}

world.afterEvents.playerLeave.subscribe((event) => last.delete(event.playerId));
