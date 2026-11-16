// Runtime side of the tag contract (data/tags.js).
//
// ## A recipe input may be { tag: "offal", count } instead of item ids. It
// ## accepts Ranching's own tagged items plus any other add-on's item carrying
// ## kaleidoscope_ranching:<tag>, found once after the world loads by asking
// ## every item type for its tags. Discovered offal also becomes pig feed.

import { ItemStack, ItemTypes } from "@minecraft/server";
import { TAGGED, TAG_NAMES, tagId } from "../data/tags.js";
import { KIND, registerFeed } from "../data/feeds.js";
import { rid } from "./ids.js";

const found = Object.fromEntries(TAG_NAMES.map((name) => [name, new Set(TAGGED[name].map(rid))]));

/** Every item id carrying the tag (short name, e.g. "hide"). */
export function taggedItems(name) {
  return [...(found[name] ?? [])];
}

/** Adds an item to a tag (also used by tests). Offal becomes pig feed. */
export function addTagged(name, itemId) {
  if (!found[name] || found[name].has(itemId)) return false;
  found[name].add(itemId);
  if (name === "offal") registerFeed(itemId, KIND.VEG, 1);
  return true;
}

/** Looks through every item type once for the contract's tags. Returns how many items were added. */
export function discoverTaggedItems() {
  let added = 0;
  let types = [];
  try {
    types = ItemTypes.getAll();
  } catch {
    return 0;
  }
  for (const type of types) {
    if (type.id.startsWith("kaleidoscope_ranching:") || type.id.startsWith("minecraft:")) continue;
    let stack;
    try {
      stack = new ItemStack(type.id, 1);
    } catch {
      continue;
    }
    for (const name of TAG_NAMES) {
      try {
        if (stack.hasTag(tagId(name)) && addTagged(name, type.id)) added++;
      } catch {}
    }
  }
  return added;
}
