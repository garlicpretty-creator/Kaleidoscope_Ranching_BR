# 里程碑之間的介面

M1、M3 與 M2 由不同的人開發。這份文件說明誰擁有什麼，以及彼此只能透過哪些介面溝通，讓各自的分支能獨立合併。

## 分工

| 里程碑 | 負責 | 擁有的程式 |
| --- | --- | --- |
| M1 自有動物與性別 | Claude | `scripts/systems/conversion.js`、`scripts/systems/breeding.js`、動物實體與美術 |
| M2 照顧核心 | 另一位開發者（Claude 整合） | `scripts/care_init.js`、`care/`、`custom_components/`、`events/`、`ui/`、`utils/`、`data/care_config.js`、`data/feeds.js`、`data/species.js`、`data/m1_contract.js`、`tools/m2/gen_content.py`；交接說明在 `docs/M2_交接.md` |
| M3 屠宰與乳蛋加工 | Claude | `scripts/systems/carcass.js`、`butcherRack.js`、`milking.js`、`nursing.js`、`nest.js`、`stations.js`，以及對應方塊與物品 |
| M5 對外 API | Claude | `scripts/api/ranchingApi.js`、`scripts/core/content.js`、`scripts/core/events.js`、`examples/api-example/`；規格在 `docs/API.md` |

`scripts/core/` 是共用層，三方都可以讀；修改時請在合併請求裡標明，因為會影響其他人。

## 1. 照顧資料：`core/husbandry.js`

M1 和 M3 需要知道「這隻動物今天照顧得好不好」，但這是 M2 的範圍。所以 M1、M3 只透過 `core/husbandry.js` 詢問。M2 的實作由 `systems/careBridge.js` 掛上，它把 M2 的 `care/state.js` 轉成下面的契約：

| 契約 | M2 的實作 |
| --- | --- |
| `getAffection` | `getHearts`（M2 以點數儲存，20 點 1 心） |
| `canBreed` | `needsMetToday`：四項需求今天都滿足 |
| `production` | 一律有產出（產物不分品質） |
| `onBorn` | `setAffection(baby, 繼承心數 × 20)` |

契約本身的寫法（給日後其他實作參考）：

```js
import { registerHusbandryProvider } from "./core/husbandry.js";

registerHusbandryProvider({
  getAffection(entity) { /* 回傳 0..5 */ },
  canBreed(entity) { /* 今天四項需求都滿足了嗎 */ },
  production(entity, day) { /* { produces: true/false } */ },
  onMated(mother, father) {},
  onBorn(baby, mother, inheritedAffection) { /* 把起始好感度寫進幼體 */ },
  onCared(entity, player, kind) { /* kind 例如 "nursing_bottle" */ },
});
```

每個函式都可以省略。M2 還沒接上之前的預設行為是：好感度 0、隨時可以繁殖、每天都有產出。所以 M1、M3 不必等 M2 完成就能測試。

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

多個系統都會對「玩家拿某樣東西點動物」作反應。新程式請不要直接訂閱 `world.beforeEvents.playerInteractWithEntity`，改用路由：

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
| `m3:milking` | 50 | 手持擠奶桶點會產奶的動物 |
| `m3:nursing` | 50 | 手持奶瓶點哺乳類幼體 |
| `m1:dye_sheep` | 60 | 手持染料點羊 |
| `m1:shear_sheep` | 60 | 手持剪刀點未剪毛的成年羊 |
| `m2:care` | 100 | 蹲下空手、毛刷、記事本、耳標、該物種的零食 |

M2 另外保留一個備援：若點擊沒有經過路由（實體沒有互動元件時可能發生），用毛刷、記事本、耳標、零食時會以視線找動物；同一下點擊只會處理一次。

## 3. 動物資訊：`core/animal.js`

`speciesOf(entity)`、`sexOf(entity)`、`isBaby(entity)`、`isAdultFemale(entity)`、`nearbySameSpecies(entity, radius)`。性別存在實體屬性 `kaleidoscope_ranching:sex`（`female` 或 `male`），資源包也用它切換外觀，請不要改用動態屬性。

每種樂牧動物的實體都提供這些事件，可用 `entity.triggerEvent(...)` 呼叫：

| 事件 | 作用 |
| --- | --- |
| `kaleidoscope_ranching:make_persistent` | 讓動物不再自然消失 |
| `kaleidoscope_ranching:add_ear_tag` | 同上，M2 的耳標使用 |
| `kaleidoscope_ranching:sated` | 移除 `seeking` 元件組（走向飼槽與水槽）；照顧核心在動物當天吃過也喝過時觸發 |
| `kaleidoscope_ranching:hungry` | 加回 `seeking`；照顧核心在結算到新的一天時觸發 |
| `kaleidoscope_ranching:become_baby` / `grow_up` | 變成幼體 / 長大 |
| `kaleidoscope_ranching:set_female` / `set_male` | 指定性別 |

野生動物（自然生成後被轉換的）會像原版一樣在遠離玩家時消失；繁殖、孵化出來的，以及有名字、拴著繩、裝了鞍的動物不會。

## 4. 時間與排程：`core/time.js`、`core/clock.js`

- 一律用 `nowTick()`（世界建立以來的刻數）與 `today()` 比較時間，不要自己開計時器。
- 需要「時間到了自動發生」的事，請用 `createRegistry(name)` 記下要追蹤的對象，再用 `registerClockTask(id, run)` 掛到牧場時鐘（每 30 秒一次）。不要掃描整個世界。
- 自訂方塊要定時動作時，用 `core/blockClock.js`：`defineClockBlock(typeId, 登錄表名稱, tick)` 宣告方塊種類，元件用 `clockBlockEvents({...})` 包起來（放置與使用時加入登錄表、打掉時移除），最後呼叫 `startBlockClock()`。不要在方塊檔加 `minecraft:tick`。

## 5. 方塊資料：`core/blockStore.js`

自訂方塊沒有方塊實體。需要存比方塊狀態更多的資料時，用 `getBlockData` / `setBlockData`，方塊被破壞時務必 `takeBlockData` 或 `clearBlockData`。

## 6. 懷孕狀態

M1 在懷孕的母畜上寫兩個動態屬性：`kaleidoscope_ranching:pregnant_due`（預產的絕對刻數，M1 自己用）與 `kr:pregnant_until_day`（預產的遊戲日，給 M2 的記事本顯示）。

## 7. 共用檔案

語言檔、`item_texture.json`、`terrain_texture.json`、`blocks.json` 由 `node tools/gen_shared.mjs` 組成：登錄表裡非 M2 的物品與方塊名稱，加上 `tools/fragments/<里程碑>/` 下各里程碑生成器寫的片段。同一個鍵被兩處定義時會報錯。各里程碑的生成器只能寫自己的片段，不要直接寫最終檔。

## 8. M3 的方塊

M3 的方塊用四個自訂元件：`kaleidoscope_ranching:butcher_rack`、`nest_box`、`incubator`、`station`。`station` 是通用加工引擎，用方塊自己的識別碼到 `data/processing.js` 找配方；新的加工方塊只要登錄配方並在方塊 JSON 加上這個元件即可。玩法規則見 `docs/M3_說明.md`。

方塊資料（`core/blockStore.js`）會記錄寫入它的方塊種類，所以方塊被指令替換時，新方塊不會讀到舊資料。

## 9. 資料表

`scripts/data/` 是所有識別碼的唯一來源。新增物品或方塊時先登錄到 `items.js`、`blocks.js`，並填上 `owner`（由哪個里程碑的生成器產出檔案；省略代表樂牧主生成器），然後執行 `npm run validate`。驗證會比對登錄表、`packs/BP/items`、`packs/BP/blocks` 與貼圖索引；驗證不過的合併請求不要合併。生成的檔案請不要手改。

## 10. 執行期內容：`core/content.js`

其他附加包會透過對外 API（`docs/API.md`）在遊戲執行中加入動物、屠體分切與加工配方，所以系統**不要直接讀** `data/animals.js` 的 `ANIMALS`、`data/butcher.js` 的 `BUTCHER_TABLE`、`data/processing.js` 的 `PROCESSING_RECIPES`，改用：

| 函式 | 用途 |
| --- | --- |
| `animalByType(typeId)`、`allAnimals()` | 動物資料列（`core/animal.js` 的 `speciesOf` 已改用它） |
| `animalByFertilizedEgg(itemId)`、`animalByCarcass(itemId)` | 由受精蛋或屠體找到動物 |
| `onAnimalAdded(listener)` | 要建索引的系統（例如繁殖的飼料表）在動物加入時更新 |
| `butcherEntry(carcassItemId)` | 屠體的分切表，參數是完整 id |
| `recipesForStation(station)`、`recipeById(id)` | 加工配方 |

內建內容一律優先，外部註冊不能覆蓋。外部動物用族群 `ranching_male` / `ranching_female` 表示性別，`sexOf` 讀不到性別屬性時會改看族群。

## 11. 牧場事件：`core/events.js`

出生、孵化、收成、屠宰完成時，系統呼叫 `emitRanchEvent(type, data)` 回報；對外 API 會把它轉成 `kaleidoscope_ranching:animal_event` 廣播出去。新功能如果會產出動物或收成，也請在這裡回報，事件種類見 `core/events.js`。出生與孵化已在 `core/husbandry.js` 的 `notifyBorn` 統一回報，不需要另外呼叫。

