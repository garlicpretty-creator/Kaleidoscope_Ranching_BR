// Runs every generator in order (npm run generate).
// Python is found by trying each candidate with --version, because on Windows `python3` is often
// the Microsoft Store shortcut, which exists on PATH but only opens the Store.
import { spawnSync } from "node:child_process";

const PYFIX = [new URL("./pyfix", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"), process.env.PYTHONPATH].filter(Boolean).join(process.platform === "win32" ? ";" : ":");

const STEPS = [
  ["py", "tools/png_snapshot.py", "save"],
  ["py", "tools/gen_art.py"],
  ["py", "tools/m2/gen_content.py"],
  ["py", "tools/gen_m3_art.py"],
  ["node", "tools/gen_entities.mjs"],
  ["node", "tools/gen_sleep.mjs"],
  // 1.1 美術: gear layered on the animals (fitted to the models as they are now), worn items.
  ["py", "art_src/m4_scripts/gear.py"],
  ["py", "art_src/m4_scripts/wearables.py"],
  ["node", "tools/gen_items.mjs"],
  ["node", "tools/gen_blocks.mjs"],
  ["node", "tools/gen_catalog.mjs"],
  ["node", "tools/gen_shared.mjs"],
  ["py", "tools/art/rd_icons.py", "apply"],
  ["py", "tools/art/carcass_icons.py"],
  ["py", "tools/fix_zfight.py"],
  ["py", "tools/square_block_textures.py"],
  ["py", "tools/gen_pbr.py"],
  ["py", "tools/png_snapshot.py", "restore"],
];

const CANDIDATES = process.platform === "win32"
  ? [["py", "-3"], ["python"], ["python3"]]
  : [["python3"], ["python"]];

function findPython() {
  if (process.env.PYTHON) return [process.env.PYTHON];
  for (const cmd of CANDIDATES) {
    const r = spawnSync(cmd[0], [...cmd.slice(1), "--version"], { encoding: "utf8" });
    if (r.status === 0 && /Python 3\./.test(`${r.stdout}${r.stderr}`)) return cmd;
  }
  return null;
}

const python = findPython();
if (!python) {
  console.error("generate: no working Python 3 found (tried " + CANDIDATES.map((c) => c.join(" ")).join(", ") +
    "). Install Python 3, or set PYTHON to its path.");
  process.exit(1);
}

for (const [kind, script, ...args] of STEPS) {
  const cmd = kind === "py" ? [...python, script, ...args] : [process.execPath, script, ...args];
  // tools/pyfix/sitecustomize.py: file writes wait out a virus scanner on Windows.
  const r = spawnSync(cmd[0], cmd.slice(1), { stdio: "inherit", env: { ...process.env, PYTHONUTF8: "1", PYTHONPATH: PYFIX } });
  if (r.status !== 0) {
    console.error(`generate: ${script} failed` + (r.error ? ` (${r.error.message})` : ""));
    process.exit(r.status || 1);
  }
}
