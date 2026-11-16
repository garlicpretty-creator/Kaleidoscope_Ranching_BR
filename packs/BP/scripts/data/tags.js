// 1.1 標籤契約 (企劃書 1.1 對外 API 與系列握手): item tags other add-ons can put on
// their own items to take part in Ranching's lines, no script needed.
//
//   kaleidoscope_ranching:offal        pig feed (trough, vegetable kind)
//   kaleidoscope_ranching:mince        two make sausages with a casing (meat grinder)
//   kaleidoscope_ranching:fleece       two spin into yarn (spinning wheel)
//   kaleidoscope_ranching:fine_fleece  two spin into fine yarn
//   kaleidoscope_ranching:hide         tans into leather (tanning rack)
//   kaleidoscope_ranching:tallow       oils leather (tanning rack) and makes soap
//
// TAGGED lists Ranching's own items with each tag (tools/gen_items.mjs writes the
// tags into their item files); core/tags.js adds other add-ons' items at runtime.

export const TAG_NAMES = ["offal", "mince", "fleece", "fine_fleece", "hide", "tallow"];

export const TAGGED = {
  offal: ["pork_liver", "pig_intestine", "chicken_gizzard", "duck_blood", "goose_liver", "beef_tripe", "cleaned_intestine", "cleaned_tripe"],
  mince: ["pork_mince", "beef_mince", "mutton_mince"],
  fleece: ["yak_hair"],
  fine_fleece: ["goat_cashmere", "rabbit_fur"],
  hide: ["raw_hide", "pig_skin"],
  tallow: ["beef_tallow", "mutton_tallow"],
};

export const tagId = (name) => `kaleidoscope_ranching:${name}`;
