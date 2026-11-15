// 耳標名冊: one world dynamic property per tagged animal, kr:roster:<n>.

import { world } from "@minecraft/server";

const PREFIX = "kr:roster:";
const SEQ = "kr:ear_tag_seq";

export function nextTagNumber() {
  const n = (world.getDynamicProperty(SEQ) ?? 0) + 1;
  world.setDynamicProperty(SEQ, n);
  return n;
}

export function updateRoster(e) {
  const tag = e.getDynamicProperty("kr:ear_tag");
  if (tag === undefined) return;
  const entry = {
    tag,
    id: e.id,
    type: e.typeId,
    name: e.nameTag ?? "",
    dim: e.dimension.id,
    x: Math.floor(e.location.x),
    y: Math.floor(e.location.y),
    z: Math.floor(e.location.z),
  };
  world.setDynamicProperty(PREFIX + tag, JSON.stringify(entry));
}

export function removeFromRoster(tag) {
  world.setDynamicProperty(PREFIX + tag, undefined);
}

export function rosterEntries() {
  const out = [];
  for (const id of world.getDynamicPropertyIds()) {
    if (!id.startsWith(PREFIX)) continue;
    try {
      out.push(JSON.parse(world.getDynamicProperty(id)));
    } catch {}
  }
  return out.sort((a, b) => a.tag - b.tag);
}
