// Simplified Chinese names (M6), made from the Traditional Chinese names in
// the registries so every name has exactly one source.
//
// ## TERMS are words mainland players say differently (優格 is 酸奶 there);
// ## they apply first. CHARS converts the remaining Traditional characters.
// ## tools/validate.mjs fails if a converted name still contains a character
// ## listed in CHARS, and TRADITIONAL_HINTS catches common characters this map
// ## does not cover yet: add them to CHARS when a new name needs them.

export const TERMS = [
  ["鮮奶油", "淡奶油"],
  ["優格", "酸奶"],
  ["乳酪", "奶酪"],
  ["生怪蛋", "刷怪蛋"],
];

export const CHARS = Object.fromEntries(
  [
    "優优 極极 雞鸡 鴨鸭 鵝鹅 氂牦 鮮鲜 輪轮 塊块 鹹咸 體体 豬猪 絨绒 乾干 糞粪 擠挤 鈴铃 運运 籠笼 樁桩 掛挂 攪搅 壓压 發发 醃腌 製制",
    "燉炖 湯汤 鍋锅 紅红 燒烧 麵面 飯饭 腳脚 薑姜 鐵铁 鹽盐 醬酱 蔥葱 餅饼 魚鱼 蝦虾 蘿萝 蔔卜 東东 坡 雜杂 鬆松 滷卤 燜焖 熱热 濃浓 盤盘 碗 蓋盖 鹵卤 糰团 團团",
    "飼饲 料 槽 剷铲 叉 鍘铡 機机 攪搅 桿杆 鹽盐 磚砖 標标 記记 簿 冊册 錄录 袋 刷 零 嘴 糖 塊块 苜 蓿 餵喂 養养 牽牵 繩绳 鉤钩 刀 斧 劍剑 廚厨 屬属 號号 餘余 桶",
    "孵 蛋 營营 熱热 燈灯 溫温 濕湿 長长 夠够 隻只 個个 們们 這这 來来 頭头 樣样 種种 點点 時时 間间 開开 關关 裡里 後后 會会 過过 還还 讓让 說说 請请 將将 與与 對对 給给 從从 處处 動动 物 業业 製制 單单 雙双 歲岁 齡龄 遷迁 賣卖 買买 錢钱 價价",
    "飾饰 門门 欄栏 圍围 紡纺 線线 撣掸 氈毡 織织 殼壳 鈣钙 貯贮 車车 絞绞 腸肠 臘腊 淨净 獅狮 絲丝 脫脱 煉炼 達达 陳陈 燻熏 薩萨 瑪玛 麗丽 離离 蘋苹 葉叶 莖茎 穀谷 麥麦 豆 薯 筍笋 菜 瓜 菇 蘑 黃黄 綠绿 藍蓝 紫 黑 白 灰 棕 銀银 銅铜 金 寶宝 貝贝 兒儿 鳳凤 龍龙 漢汉 華华 國国 際际 傳传 統统 風风 鄉乡 雲云 陽阳 陰阴 豐丰 滿满 齊齐 鬍胡 羅罗 囉啰",
  ]
    .join(" ")
    .split(/\s+/)
    .filter((pair) => pair.length === 2)
    .map((pair) => [pair[0], pair[1]])
);

/** Common Traditional characters; a converted name must not contain any of them. */
export const TRADITIONAL_HINTS = "飾門欄圍紡線撣氈織殼鈣貯車絞腸臘淨獅絲脫煉達陳燻薩瑪麗離優極雞鴨鵝氂鮮輪塊鹹體豬絨乾糞擠鈴運籠樁掛攪壓發醃製燉湯鍋紅燒麵飯腳薑鐵鹽醬蔥餅魚蝦蘿蔔東雜鬆滷燜熱濃盤蓋飼鍘機磚標記冊錄餵養牽繩鉤劍廚屬號餘營燈溫濕長夠隻個們這來頭樣種點時間開關裡後會過還讓說請將與對給從處動業單雙歲齡賣買錢價蘋葉莖穀麥筍黃綠藍銀銅寶貝兒鳳龍漢華國際傳統風鄉雲陽陰豐滿齊鬍羅";

export function toSimplified(text) {
  let out = text;
  for (const [from, to] of TERMS) out = out.split(from).join(to);
  return [...out].map((ch) => CHARS[ch] ?? ch).join("");
}
