#!/usr/bin/env bash
# Packs both packs into dist/Kaleidoscope-Ranching-v<version>.mcaddon.
# Run from anywhere: bash tools/build.sh
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
version="$(node -e 'const m = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")); console.log(m.header.version.join("."))' "$root/packs/BP/manifest.json")"
name="Kaleidoscope Ranching v$version"
stage="$(mktemp -d)"
trap 'rm -rf "$stage"' EXIT

cp -R "$root/packs/BP" "$stage/$name [BP]"
cp -R "$root/packs/RP" "$stage/$name [RP]"

mkdir -p "$root/dist"
out="$root/dist/Kaleidoscope-Ranching-v$version.mcaddon"
rm -f "$out"
(cd "$stage" && zip -q -r "$out" .)
echo "built ${out#"$root/"}"
