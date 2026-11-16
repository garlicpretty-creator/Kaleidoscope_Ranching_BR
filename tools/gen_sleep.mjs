// 1.1 動物作息: the sleeping pose for every Ranching animal.
//
// For each client entity (written by tools/gen_art.py for the M1 animals, hand
// made for the M4 ones) this adds animation.kaleidoscope_ranching.<id>.sleep,
// played while the synced `sleeping` property is true, and stops look_at_target
// while asleep. The pose is generic and read from the model: the body drops by
// the leg length (adult or baby), the legs fold flat, the head droops, the
// torso breathes slowly. Hand-made poses can replace a species' animation later.
//
// Run after gen_art.py (npm run generate does).

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const { ANIMALS } = await import(pathToFileURL(join(root, "packs/BP/scripts/data/animals.js")).href);
const NS = "kaleidoscope_ranching";
const ASLEEP = `q.property('${NS}:sleeping')`;

const legHeight = (bones, prefix) =>
  Math.max(0, ...bones.filter((b) => b.name.startsWith(prefix)).flatMap((b) => (b.cubes ?? []).map((c) => c.size[1])));

function sleepAnimation(id) {
  const geo = JSON.parse(readFileSync(join(root, "packs/RP/models/entity", `${id}.geo.json`), "utf8"))["minecraft:geometry"][0];
  const bones = geo.bones;
  const has = (name) => bones.some((b) => b.name === name);
  const adultLeg = legHeight(bones, "a_leg");
  const babyLeg = legHeight(bones, "b_leg");
  const anim = {};
  if (has("body")) anim.body = { position: [0, `q.is_baby ? -${babyLeg} : -${adultLeg}`, 0] };
  for (const bone of bones) if (/^[ab]_leg/.test(bone.name)) anim[bone.name] = { scale: [1, 0.05, 1] };
  if (has("head")) anim.head = { rotation: [18, 0, 0] };
  for (const torso of ["a_torso", "b_torso"]) if (has(torso)) anim[torso] = { scale: [1, "1 + math.sin(q.life_time * 90) * 0.025", 1] };
  if (has("a_ears")) anim.a_ears = { rotation: [-40, 0, 0] };
  return {
    format_version: "1.8.0",
    animations: { [`animation.${NS}.${id}.sleep`]: { loop: true, bones: anim } },
  };
}

let patched = 0;
for (const { id } of ANIMALS) {
  const entityPath = join(root, "packs/RP/entity", `${id}.entity.json`);
  let entity;
  try {
    entity = JSON.parse(readFileSync(entityPath, "utf8"));
  } catch {
    continue;
  }
  writeFileSync(join(root, "packs/RP/animations", `${id}.sleep.animation.json`), JSON.stringify(sleepAnimation(id), null, 2) + "\n");
  const description = entity["minecraft:client_entity"].description;
  description.animations.sleep = `animation.${NS}.${id}.sleep`;
  const animate = (description.scripts.animate ?? []).filter((entry) => {
    const key = typeof entry === "string" ? entry : Object.keys(entry)[0];
    return key !== "sleep" && key !== "look_at_target";
  });
  if (description.animations.look_at_target) animate.push({ look_at_target: `!${ASLEEP}` });
  animate.push({ sleep: ASLEEP });
  description.scripts.animate = animate;
  writeFileSync(entityPath, JSON.stringify(entity, null, 2) + "\n");
  patched++;
}
console.log(`gen_sleep: ${patched} animals posed for sleep`);
