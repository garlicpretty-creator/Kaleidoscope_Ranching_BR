// Translatable UI text. All player-facing strings live in the .lang files
// under kaleidoscope_ranching.ui.*, so zh_TW / zh_CN / en_US all work.

export function T(key, args) {
  const msg = { translate: `kaleidoscope_ranching.ui.${key}` };
  if (args && args.length) {
    msg.with = args.some((a) => typeof a !== "string")
      ? { rawtext: args.map((a) => (typeof a === "string" ? { text: a } : a)) }
      : args;
  }
  return msg;
}

/** Raw translate of any lang key (e.g. entity names). */
export function L(key) {
  return { translate: key };
}

/** Join several messages with newlines. */
export function lines(...parts) {
  const rawtext = [];
  parts.forEach((p, i) => {
    if (i) rawtext.push({ text: "\n" });
    rawtext.push(typeof p === "string" ? { text: p } : p);
  });
  return { rawtext };
}

export function heartBar(h) {
  return "§c" + "❤".repeat(h) + "§7" + "❤".repeat(Math.max(0, 5 - h)) + "§r";
}
