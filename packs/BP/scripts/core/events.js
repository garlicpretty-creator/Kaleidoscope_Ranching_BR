// Ranch events inside the pack: births, hatchings, harvests, butchering.
//
// ## Systems report what happened here; listeners (today the public API,
// ## which rebroadcasts them as kaleidoscope_ranching:animal_event) decide
// ## what to do with it. Systems never need to know who is listening.

const listeners = [];

/** Subscribes to every ranch event: `listener(type, data)`. */
export function onRanchEvent(listener) {
  listeners.push(listener);
}

/**
 * Reports a ranch event. `type` is one of:
 *   "born"       a mammal was born          { animal, entity, mother? }
 *   "hatched"    a bird hatched             { animal, entity, mother? }
 *   "harvested"  milk or eggs were taken    { animal?, entity?, product, items: { itemId: count } }
 *   "butchered"  a carcass was fully cut    { carcass }
 *   "mated"      a female became pregnant   { animal, mother, father }
 *   "cared"      a player cared for it      { animal, entity, player, kind }
 *                kind: "pet" | "brush" | "treat" | "ear_tag" | "nursing_bottle"
 *   "foraged"    an animal dug something up { animal, entity, items: { itemId: count } } (1.1 松露)
 *   "moulted"    a duck or goose shed down  { animal, entity, items: { itemId: count } } (1.1 換羽)
 */
export function emitRanchEvent(type, data) {
  for (const listener of listeners) {
    try {
      listener(type, data);
    } catch (error) {
      console.warn(`[kaleidoscope_ranching] ranch event listener failed: ${error}`);
    }
  }
}
