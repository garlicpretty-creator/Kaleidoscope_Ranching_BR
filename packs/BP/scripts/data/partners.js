// What Ranching offers the optional sister packs that have no table of their own elsewhere.
// Sent by api/herbal.js and api/harvest.js once that pack answers; without it nothing is sent.
// (Fishing Voyage's feeds and baits live in data/feeds.js and api/fishing.js.)
// Plain data: no @minecraft imports.

// --- 草本 Herbal: 寒熱 of Ranching foods (kaleidoscope_herbal:heat_register) ------------------
//
// item (bare Ranching id) → [heat, why]. −100 (cold) … +100 (hot). Herbal's own teas are ±35–40
// and its tonics +30–40, so everyday food stays within ±30, like Harvest's list. Only foods whose
// nature is plain in 中醫 food lore are listed; Harvest's 孜然羊肉串 is +20, so the lamb is too.
export const HERBAL_HEAT = {
  yak_stew: [20, "氂牛肉性溫，高原上禦寒的燉肉"],
  cumin_lamb_chops: [20, "羊肉性溫，孜然辛熱"],
  roast_lamb_leg: [20, "羊肉性溫，孜然辛熱"],
  lamb_meatball_soup: [15, "羊肉性溫，煮成湯稍緩"],
  sesame_oil_pork_liver: [25, "麻油、薑、米酒，坐月子的熱補"],
  spicy_chicken_legs: [15, "辣椒辛熱"],
  spicy_tripe: [15, "麻辣，辛熱"],
  chhurpi_butter_tea: [15, "酥油茶，高原上暖身的茶"],
  old_duck_soup: [-10, "鴨肉性涼，老鴨湯是清補"],
  century_egg_congee: [-10, "皮蛋性寒，清熱"],
  yogurt: [-5, "優格性涼，只略涼"],
  berry_yogurt: [-5, "優格性涼，只略涼"],
  yogurt_berry_drink: [-5, "優格性涼，只略涼"],
  vanilla_ice_cream: [-30, "冰品最涼"],
  berry_ice_cream: [-30, "冰品最涼"],
  // ## Cocoa is warm in food lore: a little less cold than the other ice creams.
  chocolate_ice_cream: [-25, "冰品，可可性溫，稍緩"],
};

// --- 豐收 Harvest: its corn in the silage barrel ---------------------------------------------
//
// ## Corn is the classic silage crop. Same batch and time as forage (data/processing.js).
export const HARVEST_CORN = "kaleidoscope_harvest:corn";
