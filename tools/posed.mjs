// Where a model's cubes end up under one frame of an animation, the way the game draws it
// (Blockbench's Bedrock convention: bone rotations x and y negated, applied Z·Y·X about the
// bone pivot, then the bone's position). Used by validate.mjs to keep sleep poses off the
// ground plane: a face lying in y = 0 fights the block below it and flickers.

const RAD = Math.PI / 180;

/** Molang as used in this pack's poses: q.is_baby, constants, math.sin/cos of the clock. */
export function molang(value, { baby }) {
  if (typeof value === "number") return value;
  const expr = String(value)
    .replace(/\bq(uery)?\.is_baby\b/g, baby ? "1" : "0")
    .replace(/math\.(sin|cos)\([^()]*\)/g, "0")
    .replace(/\bq(uery)?\.\w+(\([^()]*\))?/g, "0");
  if (!/^[\d\s.+\-*/()?:<>=!&|]*$/.test(expr)) throw new Error(`molang not understood: ${value}`);
  return Function(`return (${expr});`)();
}

const mul = (a, b) => a.map((row, i) => b[0].map((_, j) => row.reduce((s, _, k) => s + a[i][k] * b[k][j], 0)));
const apply = (m, [x, y, z]) => m.map((row) => row[0] * x + row[1] * y + row[2] * z);
const rotX = (t) => [[1, 0, 0], [0, Math.cos(t), -Math.sin(t)], [0, Math.sin(t), Math.cos(t)]];
const rotY = (t) => [[Math.cos(t), 0, Math.sin(t)], [0, 1, 0], [-Math.sin(t), 0, Math.cos(t)]];
const rotZ = (t) => [[Math.cos(t), -Math.sin(t), 0], [Math.sin(t), Math.cos(t), 0], [0, 0, 1]];
const euler = ([x, y, z]) => mul(rotZ(z * RAD), mul(rotY(-y * RAD), rotX(-x * RAD)));

/**
 * The lowest y of every visible cube's corners under `anim` (an animation's "bones" map),
 * with the bone that reaches it. `visible(bone)` picks the bones drawn (adult or baby).
 */
export function lowestPoint(bones, anim, { baby, visible }) {
  const byName = new Map(bones.map((b) => [b.name, b]));
  const chainOf = (bone) => (bone ? [...chainOf(byName.get(bone.parent)), bone] : []);
  let best = { y: Infinity, bone: null };
  for (const bone of bones) {
    if (!visible(bone) || !bone.cubes?.length) continue;
    const chain = chainOf(bone);
    if (chain.some((b) => !visible(b) && b.cubes?.length)) continue;
    for (const cube of bone.cubes) {
      const [ox, oy, oz] = cube.origin;
      const [sx, sy, sz] = cube.size;
      const inflate = cube.inflate ?? 0;
      for (const cx of [ox - inflate, ox + sx + inflate]) for (const cy of [oy - inflate, oy + sy + inflate]) for (const cz of [oz - inflate, oz + sz + inflate]) {
        let p = [cx, cy, cz];
        if (cube.rotation) {
          const pivot = cube.pivot ?? [0, 0, 0];
          p = apply(euler(cube.rotation), p.map((v, i) => v - pivot[i])).map((v, i) => v + pivot[i]);
        }
        // Innermost bone first: its own pose about its pivot, then its parent's, and so on.
        for (const b of [...chain].reverse()) {
          const frame = anim[b.name] ?? {};
          const pivot = b.pivot ?? [0, 0, 0];
          const scale = (frame.scale ?? [1, 1, 1]).map((v) => molang(v, { baby }));
          const rest = b.rotation ?? [0, 0, 0];
          const turn = (frame.rotation ?? [0, 0, 0]).map((v) => molang(v, { baby }));
          let q = p.map((v, i) => (v - pivot[i]) * scale[i]);
          q = apply(euler(turn.map((v, i) => v + rest[i])), q);
          const move = (frame.position ?? [0, 0, 0]).map((v) => molang(v, { baby }));
          p = q.map((v, i) => v + pivot[i] + move[i]);
        }
        if (p[1] < best.y) best = { y: p[1], bone: bone.name };
      }
    }
  }
  return best;
}

/** Bones drawn for an adult (baby false) or a young animal, by the a_/b_ prefix rules. */
export function drawnFor(bones, baby) {
  const byName = new Map(bones.map((b) => [b.name, b]));
  const under = (bone, prefixes) => {
    for (let b = bone; b; b = byName.get(b.parent)) if (prefixes.some((p) => b.name.startsWith(p))) return true;
    return false;
  };
  return (bone) =>
    bone.name !== "saddle" && // only while saddled; poking into the ground does not flicker
    (baby ? !under(bone, ["a_", "m_", "fa_", "wool_", "lids_a"]) : !under(bone, ["b_", "lids_b"]));
}
