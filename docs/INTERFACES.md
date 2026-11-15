# 里程碑之間的介面

M1、M3 與 M2 由不同的人開發。這份文件說明誰擁有什麼，以及彼此只能透過哪些介面溝通，讓各自的分支能獨立合併。

## 分工

| 里程碑 | 負責 | 擁有的程式 |
| --- | --- | --- |
| M1 自有動物與性別 | Claude | `scripts/systems/conversion.js`、`scripts/systems/breeding.js`、動物實體與美術 |
| M2 照顧核心 | 另一位開發者 | 好感度、四項每日需求、每日結算、飼槽、水槽、餵食器、飲水器、鍘草機、飼料攪拌桶、苜蓿、毛刷、記事本、耳標、糞叉、堆肥槽、鹽磚、零食、飼料袋 |
| M3 屠宰與乳蛋加工 | Claude | `scripts/systems/carcass.js`、`butcherRack.js`、`milking.js`、`nursing.js`、`nest.js`、`stations.js`，以及對應方塊與物品 |

`scripts/core/` 是共用層，三方都可以讀；修改時請在合併請求裡標明，因為會影響其他人。

## 1. 照顧資料：`core/husbandry.js`

M1 和 M3 需要知道「這隻動物今天照顧得好不好」，但這是 M2 的範圍。所以 M1、M3 只透過 `core/husbandry.js` 詢問，由 M2 用一行程式掛上自己的實作：

```js
import { registerHusbandryProvider } from "./core/husbandry.js";

registerHusbandryProvider({
  getAffection(entity) { /* 回傳 0..5 */ },
  canBreed(entity) { /* 今天四項需求都滿足了嗎 */ },
  production(entity, day) { /* { produces: true/false, quality: "plain" | "fine" | "superb" } */ },
  onMated(mother, father) {},
  onBorn(baby, mother, inheritedAffection) { /* 把起始好感度寫進幼體 */ },
  onCared(entity, player, kind) { /* kind 例如 "nursing_bottle" */ },
});
```

每個函式都可以省略。M2 還沒接上之前的預設行為是：好感度 0、隨時可以繁殖、每天都有產出且品質為普通。所以 M1、M3 不必等 M2 完成就能測試。

各函式的呼叫時機：

| 函式 | 誰呼叫 | 何時 |
| --- | --- | --- |
| `getAffection` | M3 巢箱 | 決定受精蛋機率（`data/animals.js` 的 `FERTILIZED_CHANCE_BY_AFFECTION`） |
| `canBreed` | M1 繁殖 | 玩家餵繁殖食物時，雙方都要回傳 true |
| `production` | M3 擠奶、巢箱 | 每隻母畜、母禽每經過一天呼叫一次，最多回補 3 天 |
| `onMated` | M1 繁殖 | 配種成功 |
| `onBorn` | M1 分娩、M3 孵化 | 幼體出生；`inheritedAffection` 已依親代平均乘上 `AFFECTION.inheritedShare` 算好 |
| `onCared` | M3 奶瓶 | 玩家用樂牧工具照顧動物 |

好感度要存在哪裡、怎麼結算，完全由 M2 決定。

## 2. 玩家對動物互動：`core/interact.js`

多個系統都會對「玩家拿某樣東西點動物」作反應。請不要直接訂閱 `world.beforeEvents.playerInteractWithEntity`，改用：

```js
import { registerEntityInteraction } from "./core/interact.js";

registerEntityInteraction({
  id: "m2:brush",
  priority: 100,               // 越小越先；預設 100
  match: ({ player, entity, item }) => item?.typeId === "kaleidoscope_ranching:brush",
  handle: ({ player, entity, item }) => { /* 下一刻執行，可寫入 */ },
});
```

第一個 `match` 成立的處理者會接手，原版互動隨即取消。目前已註冊：

| id | 優先度 | 條件 |
| --- | --- | --- |
| `m1:breeding` | 50 | 手持該物種的繁殖食物點成年動物 |
| `m3:milking` | 50 | 手持擠奶桶點成年母畜 |
| `m3:nursing` | 50 | 手持奶瓶點幼體 |
| `m1:dye_sheep` | 60 | 手持染料點羊 |
| `m1:shear_sheep` | 60 | 手持剪刀點未剪毛的成年羊 |

空手撫摸、毛刷、零食都留給 M2。

## 3. 動物資訊：`core/animal.js`

`speciesOf(entity)`、`sexOf(entity)`、`isBaby(entity)`、`isAdultFemale(entity)`、`nearbySameSpecies(entity, radius)`。性別存在實體屬性 `kaleidoscope_ranching:sex`（`female` 或 `male`），資源包也用它切換外觀，請不要改用動態屬性。

## 4. 時間與排程：`core/time.js`、`core/clock.js`

- 一律用 `nowTick()`（世界建立以來的刻數）與 `today()` 比較時間，不要自己開計時器。
- 需要「時間到了自動發生」的事，請用 `createRegistry(name)` 記下要追蹤的對象，再用 `registerClockTask(id, run)` 掛到牧場時鐘（每 30 秒一次）。不要掃描整個世界。

## 5. 方塊資料：`core/blockStore.js`

自訂方塊沒有方塊實體。需要存比方塊狀態更多的資料時，用 `getBlockData` / `setBlockData`，方塊被破壞時務必 `takeBlockData` 或 `clearBlockData`。

## 6. 加工站引擎：`systems/stations.js`（M3 提供）

M3 的五個加工方塊共用一個加工站引擎，配方來自 `data/processing.js`。M2 的鍘草機、飼料攪拌桶、堆肥槽的配方已經寫在同一張表裡；M2 可以直接重用：方塊 JSON 加上 `"kaleidoscope_ranching:station": {}` 自訂元件即可，不需要另寫程式。

## 7. 資料表

`scripts/data/` 是所有識別碼的唯一來源。新增物品或方塊時先登錄到 `items.js`、`blocks.js`，然後執行 `node tools/validate.mjs`；驗證不過的合併請求不要合併。物品 JSON、圖示與語言檔由 `tools/` 下的生成器產出，請不要手改生成的檔案。
