// Functional block registry for 1.0.0. Identifiers are written without the
// `kaleidoscope_ranching:` namespace. Each entry is [id, zh_TW, en_US, group].

export const BLOCKS = [
  // Husbandry and management
  ["feeding_trough", "飼槽", "Feeding Trough", "husbandry"],
  ["water_trough", "水槽", "Water Trough", "husbandry"],
  ["auto_feeder", "自動餵食器", "Auto Feeder", "husbandry"],
  ["auto_waterer", "自動飲水器", "Auto Waterer", "husbandry"],
  ["feed_mixer", "飼料攪拌桶", "Feed Mixer", "husbandry"],
  ["chaff_cutter", "鍘草機", "Chaff Cutter", "husbandry"],
  ["hay_rack", "乾草架", "Hay Rack", "husbandry"],
  ["nest_box", "巢箱", "Nest Box", "husbandry"],
  ["incubator", "孵化器", "Incubator", "husbandry"],
  ["salt_lick", "鹽磚", "Salt Lick", "husbandry"],
  ["hitching_post", "拴畜樁", "Hitching Post", "husbandry"],
  ["animal_crate", "運畜籠", "Animal Crate", "husbandry"],
  ["compost_bin", "堆肥槽", "Compost Bin", "husbandry"],
  // Processing
  ["butcher_rack", "屠宰掛架", "Butcher Rack", "processing"],
  ["butter_churn", "攪乳桶", "Butter Churn", "processing"],
  ["cheese_press", "乳酪壓模", "Cheese Press", "processing"],
  ["aging_rack", "熟成架", "Aging Rack", "processing"],
  ["fermenting_jar", "發酵罐", "Fermenting Jar", "processing"],
  ["pickling_vat", "醃製缸", "Pickling Vat", "processing"],
].map(([id, zh, en, group]) => ({ id, zh, en, group }));
