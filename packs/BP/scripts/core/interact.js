// One router for "player uses something on an animal".
//
// ## Several milestones react to player interactions (M1 breeding, M2 petting
// ## and brushing, M3 milking and bottle feeding). Bedrock gives every
// ## subscriber the same event, so without a router two systems could both
// ## act on one click. Handlers register here; the first whose `match` returns
// ## true consumes the interaction and the vanilla interaction is cancelled.

import { system, world } from "@minecraft/server";

/**
 * @typedef {object} EntityInteraction
 * @property {string} id                 For logs.
 * @property {number} [priority]         Lower runs first. Default 100.
 * @property {(ctx: InteractContext) => boolean} match   Read-only check; runs in a before-event.
 * @property {(ctx: InteractContext) => void} handle     Runs one tick later with full write access.
 *
 * @typedef {object} InteractContext
 * @property {import("@minecraft/server").Player} player
 * @property {import("@minecraft/server").Entity} entity
 * @property {import("@minecraft/server").ItemStack | undefined} item   Main-hand item at click time.
 */

const handlers = [];
let started = false;

/** @param {EntityInteraction} handler */
export function registerEntityInteraction(handler) {
  handlers.push({ priority: 100, ...handler });
  handlers.sort((a, b) => a.priority - b.priority);
  start();
}

function start() {
  if (started) return;
  started = true;
  world.beforeEvents.playerInteractWithEntity.subscribe((event) => {
    const ctx = { player: event.player, entity: event.target, item: event.itemStack };
    for (const handler of handlers) {
      let matched = false;
      try {
        matched = handler.match(ctx);
      } catch (error) {
        console.warn(`[kaleidoscope_ranching] interaction ${handler.id} match failed: ${error}`);
      }
      if (!matched) continue;
      event.cancel = true;
      system.run(() => {
        if (!ctx.entity.isValid || !ctx.player.isValid) return;
        try {
          handler.handle(ctx);
        } catch (error) {
          console.warn(`[kaleidoscope_ranching] interaction ${handler.id} failed: ${error}`);
        }
      });
      return;
    }
  });
}
