// The ranch clock: Ranching's only recurring task.
//
// ## Most timers are lazy (compared when a player interacts). A few things must
// ## happen on their own: a pregnant cow gives birth, an egg hatches, a nest box
// ## pushes eggs into a hopper. Those systems keep a bounded registry of what
// ## they are waiting on and register a task here. The clock never scans the
// ## world; each task only visits its own registry, and anything in an unloaded
// ## chunk is skipped until it loads again.

import { system, world } from "@minecraft/server";
import { dp } from "./ids.js";

/** Interval between clock runs, in ticks (30 seconds). */
export const CLOCK_INTERVAL = 600;

/** Upper bound for any registry, so a broken world cannot grow it forever. */
export const REGISTRY_LIMIT = 512;

const tasks = [];
let started = false;

/** Registers `run()` to be called every CLOCK_INTERVAL ticks. */
export function registerClockTask(id, run) {
  tasks.push({ id, run });
  if (started) return;
  started = true;
  system.runInterval(() => {
    for (const task of tasks) {
      try {
        task.run();
      } catch (error) {
        console.warn(`[kaleidoscope_ranching] clock task ${task.id} failed: ${error}`);
      }
    }
  }, CLOCK_INTERVAL);
}

/**
 * A persisted list of string keys (entity ids or block keys).
 * Adding beyond REGISTRY_LIMIT drops the oldest entry.
 */
export function createRegistry(name) {
  const property = dp(`registry:${name}`);
  const read = () => {
    const raw = world.getDynamicProperty(property);
    if (typeof raw !== "string") return [];
    try {
      const list = JSON.parse(raw);
      return Array.isArray(list) ? list : [];
    } catch {
      return [];
    }
  };
  const write = (list) => world.setDynamicProperty(property, JSON.stringify(list));
  return {
    all: read,
    add(key) {
      const list = read().filter((entry) => entry !== key);
      list.push(key);
      write(list.slice(-REGISTRY_LIMIT));
    },
    remove(key) {
      const list = read();
      const next = list.filter((entry) => entry !== key);
      if (next.length !== list.length) write(next);
    },
  };
}
