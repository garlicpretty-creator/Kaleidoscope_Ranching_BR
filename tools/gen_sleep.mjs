// 1.1 動物作息: the sleeping pose for every Ranching animal (企劃書 1.1 十一).
//
// For each client entity (tools/gen_art.py writes the M1 animals, the M4 ones
// are hand made) this writes animation.kaleidoscope_ranching.<id>.sleep,
// played while the synced `sleeping` property is true, stops walk and look_at_target
// while asleep, and adds closed eyelids shown only while asleep.
//
// Poses, as the proposal describes them, posed per species from the model's
// own bones (adult and baby rigs each):
// - lie   cow, buffalo, yak, sheep, goat: drop onto the belly, front legs folded
//         back under the chest and hind legs forward under the belly, head
//         lowered (as far as its muzzle, beard and horns clear the ground) and
//         turned a little to the side; the udder is flattened under the body.
// - side  pig: rolled onto its side, legs stretched out. The body bone's pivot
//         is moved to the torso's middle so the roll keeps the pig in place.
// - roost chicken, duck, goose: settled on the ground with the legs hidden,
//         head turned back and tucked onto the back.
// - curl  rabbit: crouched low, ears laid flat along the back, head down.
// Every pose breathes slowly (the torso swells and settles).
//
// Eyelids: the eyes are the dark pixels painted on the head's front face
// (art_src/m4_scripts/boxuv.py plain_eyes). Each eye pixel, and the white
// beside it, gets a flat lid cube in front of it textured with the skin pixel
// just above, in bones lids_a / lids_b under the adult / baby head. The render
// controller shows them only while the animal sleeps. Nothing is painted:
// the lids reuse the animal's own texture, whichever variant it wears.
//
// Run after gen_art.py and before carcass_icons.py (npm run generate does);
// it is idempotent on the hand-made M4 geometry it patches.

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { PNG } from "./png.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const { ANIMALS } = await import(pathToFileURL(join(root, "packs/BP/scripts/data/animals.js")).href);
const NS = "kaleidoscope_ranching";
const ASLEEP = `q.property('${NS}:sleeping')`;
const BREATH = "1 + math.sin(q.life_time * 90) * 0.025";
const RP = join(root, "packs/RP");

const POSE = {
  cow: "lie", buffalo: "lie", yak: "lie", sheep: "lie", goat: "lie",
  pig: "side",
  chicken: "roost", duck: "roost", goose: "roost",
  rabbit: "curl",
};

const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));
const writeJson = (path, data) => writeFileSync(path, JSON.stringify(data, null, 2) + "\n");
const round = (n) => Math.round(n * 100) / 100;

// --- Reading the model ---------------------------------------------------------

function rig(bones, prefix) {
  const named = (name) => bones.find((b) => b.name === name);
  const cubesOf = (bone) => bone?.cubes ?? [];
  const legs = bones.filter((b) => b.name.startsWith(`${prefix}_leg`));
  const legLen = Math.max(0, ...legs.flatMap((b) => cubesOf(b).map((c) => c.origin[1] + c.size[1])));
  const legThick = Math.max(1, ...legs.flatMap((b) => cubesOf(b).map((c) => Math.min(c.size[0], c.size[2]))));
  const torso = named(`${prefix}_torso`);
  const ys = cubesOf(torso).flatMap((c) => [c.origin[1], c.origin[1] + c.size[1]]);
  const xs = cubesOf(torso).flatMap((c) => [c.origin[0], c.origin[0] + c.size[0]]);
  return {
    legs,
    legLen,
    legThick,
    torsoBottom: ys.length ? Math.min(...ys) : legLen,
    torsoCenter: ys.length ? (Math.min(...ys) + Math.max(...ys)) / 2 : legLen,
    torsoHalfWidth: xs.length ? (Math.max(...xs) - Math.min(...xs)) / 2 : 3,
  };
}

/** The bone holding a rig's head: "head" for adults (and babies parented to it), else b_head. */
function headBone(bones, prefix) {
  if (prefix === "a") return bones.find((b) => b.name === "head") ? "head" : "a_head";
  const baby = bones.find((b) => b.name === "b_head");
  return baby?.parent === "head" ? null : "b_head"; // a baby head under `head` turns with it
}

// --- Poses -----------------------------------------------------------------------

const pick = (adult, baby) => (adult === baby ? round(adult) : `q.is_baby ? ${round(baby)} : ${round(adult)}`);
const sideOf = (name) => (/(_fl|_bl|_left)$/.test(name) ? 1 : -1);
const front = (name) => /_f[lr]$/.test(name);

/** Every bone hanging from `name`, itself included. */
function subtree(bones, name) {
  const out = bones.filter((b) => b.name === name);
  for (const child of bones.filter((b) => b.parent === name)) out.push(...subtree(bones, child.name));
  return out;
}

/**
 * The steepest pitch up to `want` (degrees, nose down) at which nothing on the head, turned `yaw`
 * to either side, dips under the ground once the body has dropped by `drop`: a long muzzle, a
 * beard or a pair of horns reaches further down than the skull does. Each corner is tried with
 * the turn applied before the pitch and after it, so the bound holds whichever order the
 * game composes the two in.
 */
function headPitch(bones, name, drop, want, yaw) {
  const head = bones.find((b) => b.name === name);
  if (!head) return want;
  const [, py, pz] = head.pivot;
  const [sin, cos] = [Math.sin((yaw * Math.PI) / 180), Math.cos((yaw * Math.PI) / 180)];
  const corners = subtree(bones, name)
    .filter((b) => !b.name.startsWith("lids_"))
    .flatMap((b) => b.cubes ?? [])
    .flatMap(({ origin: [x, y, z], size: [w, h, d] }) => [x, x + w].flatMap((cx) => [y, y + h].flatMap((cy) => [z, z + d].map((cz) => [cx - head.pivot[0], cy - py, cz - pz]))));
  for (let pitch = want; pitch > 0; pitch -= 2) {
    const [ps, pc] = [Math.sin((pitch * Math.PI) / 180), Math.cos((pitch * Math.PI) / 180)];
    const lowest = Math.min(...corners.flatMap(([x, y, z]) => [py + y * pc + z * ps, ...[1, -1].map((turn) => py + y * pc + (z * cos + turn * x * sin) * ps)]));
    if (lowest - drop >= 0.25) return pitch;
  }
  return 0;
}

function lie(bones, A, B, anim) {
  // Belly on the ground: the folded legs (legThick thick) lie flat under it.
  const drop = { a: A.legLen - A.legThick / 2, b: B.legLen - B.legThick / 2 };
  anim.body = { position: [0, pick(-drop.a, -drop.b), 0] };
  for (const R of [A, B]) {
    for (const leg of R.legs) {
      anim[leg.name] = { rotation: [front(leg.name) ? 90 : -90, 0, 8 * sideOf(leg.name)] };
      // Anything worn round a leg and thicker than it (a sheep's wool cuffs) is pressed to a
      // hair thicker than the leg, then lifted by that hair so it rests on the ground with the
      // leg instead of sinking under it. The folded leg's own z axis points up (front legs,
      // turned +90°) or down (hind legs, -90°), so the lift goes along it.
      for (const cuff of bones.filter((b) => b.parent === leg.name && !b.name.startsWith("lids_"))) {
        const thick = Math.max(...(cuff.cubes ?? []).map((c) => Math.min(c.size[0], c.size[2])), 0);
        if (thick <= R.legThick) continue;
        const k = round((R.legThick + 0.4) / thick);
        anim[cuff.name] = { scale: [k, 1, k], position: [0, 0, front(leg.name) ? 0.25 : -0.25] };
      }
    }
  }
  // Whatever hangs below the belly (an udder, a yak's hair skirt) would be pushed into the
  // ground: lying on it flattens it against the body instead.
  const limbs = new Set([...A.legs, ...B.legs, headBone(bones, "a"), headBone(bones, "b")].flatMap((b) => subtree(bones, b?.name ?? b)).map((b) => b.name));
  const isBaby = (b) => !!b && (b.name.startsWith("b_") || isBaby(bones.find((p) => p.name === b.parent)));
  for (const bone of bones) {
    if (limbs.has(bone.name) || bone.name.startsWith("lids_") || !bone.cubes?.length) continue;
    const down = isBaby(bone) ? drop.b : drop.a;
    const lowest = Math.min(...bone.cubes.map((c) => c.origin[1]));
    const top = bone.pivot[1];
    if (lowest < down + 0.2 && top > down + 0.2) anim[bone.name] = { scale: [1, round((top - down - 0.2) / (top - lowest)), 1] };
  }
  anim[headBone(bones, "a")] = { rotation: [headPitch(bones, headBone(bones, "a"), drop.a, 32, 18), 18, 0] };
  const baby = headBone(bones, "b");
  if (baby) anim[baby] = { rotation: [headPitch(bones, baby, drop.b, 28, 18), 18, 0] };
  for (const tail of ["a_tail", "b_tail"]) if (bones.some((b) => b.name === tail)) anim[tail] = { rotation: [-20, 0, 25] };
}

function side(bones, A, B, anim) {
  // Rolled 90° about the torso's middle (the body pivot, set in patchGeometry),
  // then lowered until the flank rests on the ground.
  anim.body = { rotation: [0, 0, 90], position: [0, pick(-(A.torsoCenter - A.torsoHalfWidth), -(A.torsoCenter - B.torsoHalfWidth)), 0] };
  for (const R of [A, B]) {
    for (const leg of R.legs) anim[leg.name] = { rotation: [front(leg.name) ? -20 : 20, 0, 0] };
  }
  anim[headBone(bones, "a")] = { rotation: [-10, 0, 0] };
}

function roost(bones, A, B, anim) {
  // Sitting on the belly: legs folded away, head turned back onto the back.
  anim.body = { position: [0, pick(-(A.torsoBottom - 0.5), -(B.torsoBottom - 0.5)), 0] };
  for (const R of [A, B]) for (const leg of R.legs) anim[leg.name] = { scale: [1, 0.05, 1] };
  // A long neck (the goose's head bone stands taller than the torso) folds back
  // along the back; a short one turns round and rests the head on the back. Combs and
  // wattles are not neck: a rooster's comb must not make him fold like a goose.
  const head = bones.find((b) => b.name === headBone(bones, "a"));
  const neckBones = bones.filter((b) => (b.parent === head?.name || b.name === head?.name) && !/comb|wattle|lids_/.test(b.name));
  const top = Math.max(...neckBones.flatMap((b) => (b.cubes ?? []).map((c) => c.origin[1] + c.size[1])));
  const long = top - (head?.pivot?.[1] ?? 0) > 6;
  anim[head.name] = long ? { rotation: [-105, 0, 0], position: [0, -1, 0] } : { rotation: [0, 155, 0], position: [0, -2.5, 0] };
  const baby = headBone(bones, "b");
  if (baby) anim[baby] = { rotation: [0, 155, 0], position: [0, -1.5, 0] };
  for (const wing of bones.filter((b) => /wing/.test(b.name))) anim[wing.name] = { rotation: [0, 0, 0] };
}

function curl(bones, A, B, anim) {
  anim.body = { position: [0, pick(-(A.torsoBottom - 0.5), -(B.torsoBottom - 0.5)), 0] };
  // Legs squashed to 0.3 about their own pivots, then moved so their soles rest on the ground
  // again (the body sinks by torsoBottom - 0.5; a pivot high in the haunch would otherwise
  // leave the foot hanging inside the body).
  const SQUASH = 0.3;
  for (const R of [A, B]) {
    for (const leg of R.legs) {
      const sole = Math.min(...(leg.cubes ?? []).map((c) => c.origin[1]));
      const lift = R.torsoBottom - 0.5 - (leg.pivot[1] + (sole - leg.pivot[1]) * SQUASH);
      anim[leg.name] = { scale: [1, SQUASH, 1], ...(Math.abs(lift) > 0.01 ? { position: [0, round(lift), 0] } : {}) };
    }
  }
  anim[headBone(bones, "a")] = { rotation: [16, 0, 0], position: [0, -0.5, 0] };
  if (bones.some((b) => b.name === "a_ears")) anim.a_ears = { rotation: [70, 0, 0] };
  const baby = headBone(bones, "b");
  if (baby) anim[baby] = { rotation: [14, 0, 0] };
}

const POSES = { lie, side, roost, curl };

function sleepAnimation(id, bones) {
  const A = rig(bones, "a");
  const B = rig(bones, "b");
  const anim = {};
  POSES[POSE[id] ?? "lie"](bones, A, B, anim);
  for (const torso of ["a_torso", "b_torso"]) {
    if (bones.some((b) => b.name === torso)) anim[torso] = { ...(anim[torso] ?? {}), scale: [1, BREATH, 1] };
  }
  return { format_version: "1.8.0", animations: { [`animation.${NS}.${id}.sleep`]: { loop: true, bones: anim } } };
}

// --- Eyelids ---------------------------------------------------------------------

/** {face: [u, v, uw, uh]} for a box-UV or per-face-UV cube. */
function faceRects(cube) {
  if (!Array.isArray(cube.uv)) return Object.fromEntries(Object.entries(cube.uv).map(([f, d]) => [f, [...d.uv, ...d.uv_size]]));
  const [u, v] = cube.uv;
  const [w, h, d] = cube.size.map((s) => Math.max(1, Math.round(s)));
  return { north: [u + d, v + d, w, h] };
}

// plain_eyes (art_src/m4_scripts/boxuv.py) paints this eye and, on wide faces, a white beside it.
const near = ([r, g, b, a], [R, G, B], tol) => a > 0 && Math.abs(r - R) <= tol && Math.abs(g - G) <= tol && Math.abs(b - B) <= tol;
const isPupil = (px) => near(px, [26, 22, 26], 10);
const isWhite = (px) => near(px, [238, 236, 232], 6);
const isEye = (px) => isPupil(px) || isWhite(px);

function lidCubes(cube, textures) {
  const rect = faceRects(cube).north;
  if (!rect) return [];
  const [u, v, uw, uh] = rect;
  if (uw <= 0 || uh <= 0) return [];
  const w = Math.round(uw);
  const h = Math.round(uh);
  const [x, y, z] = cube.origin;
  const [sw, sh] = cube.size;
  const lids = [];
  for (let j = 1; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const pixel = (png) => png.at(u + i, v + j);
      // An eye pixel in any variant (a rabbit's rimmed coats paint theirs
      // differently), lidded with the pixel just above it.
      const eye = (png) => isPupil(pixel(png)) || (isWhite(pixel(png)) && (isPupil(png.at(u + i - 1, v + j)) || isPupil(png.at(u + i + 1, v + j))));
      if (!textures.some(eye)) continue;
      if (textures.some((png) => isPupil(png.at(u + i, v + j - 1)))) continue;
      const px = sw / w;
      const py = sh / h;
      lids.push({
        // the north face's first texel column is at the cube's smallest x
        origin: [round(x + i * px), round(y + sh - (j + 1) * py), round(z - 0.05)],
        size: [round(px), round(py), 0],
        uv: { north: { uv: [u + i, v + j - 1], uv_size: [1, 1] } },
      });
    }
  }
  return lids;
}

function addLids(id, geo, entity) {
  geo.bones = geo.bones.filter((b) => !b.name.startsWith("lids_"));
  const entries = Object.entries(entity.textures);
  for (const [prefix, bone] of [["a", "a_head"], ["b", "b_head"]]) {
    const head = geo.bones.find((b) => b.name === bone);
    if (!head) continue;
    // The adult head is read on the adult skins, the baby's on the baby skins;
    // species without age-specific skins (rabbit coats) use them all.
    const own = entries.filter(([key]) => key.startsWith("baby") === (prefix === "b"));
    const textures = (own.length ? own : entries).map(([, path]) => PNG.read(join(RP, `${path}.png`)));
    const cubes = (head.cubes ?? []).flatMap((cube) => lidCubes(cube, textures));
    if (cubes.length) geo.bones.push({ name: `lids_${prefix}`, parent: bone, pivot: head.pivot, cubes });
  }
  return geo.bones.filter((b) => b.name.startsWith("lids_")).length;
}

function patchRenderController(id) {
  const path = join(RP, "render_controllers", `${id}.render_controllers.json`);
  const data = readJson(path);
  const controller = Object.values(data.render_controllers)[0];
  const vis = (controller.part_visibility ?? [{ "*": true }]).filter((entry) => !Object.keys(entry)[0].startsWith("lids_"));
  vis.push({ lids_a: `!q.is_baby && ${ASLEEP}` }, { lids_b: `q.is_baby && ${ASLEEP}` });
  controller.part_visibility = vis;
  writeJson(path, data);
}

// --- Wiring ------------------------------------------------------------------------

let patched = 0;
let lidded = 0;
for (const { id } of ANIMALS) {
  const entityPath = join(RP, "entity", `${id}.entity.json`);
  let entity;
  try {
    entity = readJson(entityPath);
  } catch {
    continue;
  }
  const description = entity["minecraft:client_entity"].description;
  const geoPath = join(RP, "models/entity", `${id}.geo.json`);
  const geoFile = readJson(geoPath);
  const geo = geoFile["minecraft:geometry"][0];

  // The pig rolls about its torso's middle; nothing else rotates the body bone.
  if (POSE[id] === "side") {
    const body = geo.bones.find((b) => b.name === "body");
    if (body) body.pivot = [0, rig(geo.bones, "a").torsoCenter, 0];
  }
  lidded += addLids(id, geo, description) ? 1 : 0;
  writeJson(geoPath, geoFile);
  patchRenderController(id);

  writeJson(join(RP, "animations", `${id}.sleep.animation.json`), sleepAnimation(id, geo.bones));
  description.animations.sleep = `animation.${NS}.${id}.sleep`;
  const animate = (description.scripts.animate ?? []).filter((entry) => {
    const key = typeof entry === "string" ? entry : Object.keys(entry)[0];
    return key !== "sleep" && key !== "look_at_target" && key !== "walk";
  });
  // The walk swing would add to the folded legs of the sleep pose.
  if (description.animations.walk) animate.unshift({ walk: `!${ASLEEP}` });
  if (description.animations.look_at_target) animate.push({ look_at_target: `!${ASLEEP}` });
  animate.push({ sleep: ASLEEP });
  description.scripts.animate = animate;
  writeJson(entityPath, entity);
  patched++;
}
console.log(`gen_sleep: ${patched} animals posed for sleep, ${lidded} with eyelids`);
