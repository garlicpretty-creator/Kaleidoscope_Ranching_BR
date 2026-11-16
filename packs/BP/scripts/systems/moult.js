// 1.1 換羽 (企劃書 1.1 六、絨毛線): well-kept ducks and geese shed down.
//
// ## On the ranch clock, each duck and goose within MOULT_RANGE of a player
// ## gets one try per game day: with MOULT_MIN_HEARTS or more, an adult leaves
// ## one down on the ground with MOULT_CHANCE, so down no longer needs a carcass.

import { world } from "@minecraft/server";
import { animalByType } from "../core/content.js";
import { isRanchAnimal } from "../core/animal.js";
import { isBaby } from "../core/animal.js";
import { registerClockTask } from "../core/clock.js";
import { emitRanchEvent } from "../core/events.js";
import { getAffection } from "../core/husbandry.js";
import { dp, rid } from "../core/ids.js";
import { dropItems } from "../core/inventory.js";
import { today } from "../core/time.js";

export const MOULT_MIN_HEARTS = 4;
export const MOULT_CHANCE = 0.2;
const MOULT_RANGE = 64;
const LAST_MOULT_DAY = dp("moult_day");
const BUILT_IN = { [rid("duck")]: [rid("down"), MOULT_CHANCE], [rid("goose")]: [rid("down"), MOULT_CHANCE] };
/** [item, chance] a type sheds, built-in or registered with `moult` (1.1 API). */
export const moultOf = (typeId) => BUILT_IN[typeId] ?? animalByType(typeId)?.moult;

/** One bird's daily try. Returns true when it shed a down. */
export function tryMoult(bird, roll = Math.random()) {
  const day = today();
  if (bird.getDynamicProperty(LAST_MOULT_DAY) === day) return false;
  bird.setDynamicProperty(LAST_MOULT_DAY, day);
  const [item, chance] = moultOf(bird.typeId) ?? [];
  if (!item || isBaby(bird) || getAffection(bird) < MOULT_MIN_HEARTS || roll >= chance) return false;
  const { x, y, z } = bird.location;
  dropItems(bird.dimension, item, 1, { x, y: y + 0.3, z });
  emitRanchEvent("moulted", { animal: bird.typeId, entity: bird.id, items: { [item]: 1 } });
  return true;
}

export function moultNearPlayers() {
  const seen = new Set();
  for (const player of world.getAllPlayers()) {
    let entities = [];
    try {
      entities = player.dimension.getEntities({ location: player.location, maxDistance: MOULT_RANGE });
    } catch {}
    for (const bird of entities) {
      if (seen.has(bird.id) || !isRanchAnimal(bird) || !moultOf(bird.typeId)) continue;
      seen.add(bird.id);
      tryMoult(bird);
    }
  }
}

export function startMoulting() {
  registerClockTask("moulting", moultNearPlayers);
}
