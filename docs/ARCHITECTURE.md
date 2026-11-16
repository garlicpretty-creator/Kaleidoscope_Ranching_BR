# 森羅物語：樂牧 架構說明

給接手的開發者或 AI 代理：先讀這份，再讀 `docs/INTERFACES.md`（共用介面的規則）。腳本層的寫作規則（資料表不得匯入 `@minecraft/*`、註解慣例等）在 `packs/BP/scripts/ARCHITECTURE.md`，比照廚房的格式。玩法看 `docs/PROPOSAL.zh-TW.md`；對外 API 看 `docs/API.md`。

## 一句話

行為包的腳本只讀 `scripts/data/` 的資料表與 `scripts/core/` 的共用層；方塊、物品、實體、模型、貼圖、語言檔全部由 `tools/` 的生成器從同一批資料表產出，不手寫。

## 資料夾

| 路徑 | 內容 |
| --- | --- |
| `packs/BP/scripts/data/` | 唯一的資料來源：物品（`items.js`）、方塊（`blocks.js`）、動物（`animals.js`）、屠宰分切（`butcher.js`）、加工配方（`processing.js`）；M2 的飼料（`feeds.js`）、物種照顧表（`species.js`）、照顧數值（`care_config.js`） |
| `packs/BP/scripts/core/` | 各里程碑共用的小模組，規則見 `docs/INTERFACES.md` |
| `packs/BP/scripts/systems/` | M1、M3 的玩法系統，每個檔案一件事 |
| `packs/BP/scripts/care/`、`custom_components/`、`events/`、`ui/`、`utils/`、`care_init.js` | M2 照顧核心（另一位開發者的程式，交接見 `docs/M2_交接.md`） |
| `packs/BP/scripts/api/` | 對外的兩個介面：和廚房握手（`cookery.js`）、樂牧自己的對外 API（`ranchingApi.js`） |
| `packs/BP/{entities,items,blocks,recipes,loot_tables,texts}` | 生成的檔案 |
| `packs/RP/` | 生成的資源包：模型、動畫、渲染控制器、貼圖、索引、語言檔 |
| `tools/` | 生成器、驗證、測試、打包 |
| `tools/fragments/<來源>/` | 各生成器的貼圖索引與 `blocks.json` 片段，由 `gen_shared.mjs` 合併 |
| `art/icons/` | 選定的 RetroDiffusion 物品圖示（有的話覆蓋程式畫的圖示） |
| `examples/` | 使用對外 API 的範例附加包 |
| `docs/` | 企劃書、介面規則、各里程碑說明、美術預覽 |

## 腳本怎麼啟動

`scripts/main.js` 只負責按順序啟動：

1. 和廚房握手（`api/cookery.js`），兩百刻內沒回應就提示玩家。
2. 對外 API（`api/ranchingApi.js`），開始接收其他附加包的註冊。
3. M1：原版動物轉換、繁殖與懷孕、原版行為（剪毛、染色、鞍）。
4. M2：`care_init.js` 在匯入時註冊自己的方塊元件與事件；`systems/careBridge.js` 把 M2 的心數與需求接到 `core/husbandry.js`。
5. M3：`systems/m3.js` 註冊屠宰掛架、巢箱、孵化器、加工方塊、乾草架的元件，啟動屠體掉落、擠奶、巢箱時鐘。

方塊元件都在 `system.beforeEvents.startup` 註冊；其他事件在匯入或啟動函式裡訂閱。

## 幾個核心做法

- **不掃世界**：會自己動的東西（懷孕、飼槽、巢箱、孵化器、乾草架）都登錄在 `core/clock.js` 的登錄表裡，一個每 30 秒跑一次的牧場時鐘依序走訪；方塊類用 `core/blockClock.js`，放置或使用時加入、打掉時移除，未載入的區塊跳過。
- **延遲結算**：時間一律用 `world.getAbsoluteTime()`。加工、懷孕、孵化只記開始或到期的時間，玩家回來時再比較，離線期間不需要任何計算。
- **方塊資料**：存在世界動態屬性，鍵是維度加座標（`core/blockStore.js`），並記錄寫入的方塊種類，方塊被替換後不會讀到舊資料。
- **點擊動物**：所有「手拿某物點動物」的玩法都經 `core/interact.js` 的路由，依優先度只處理一次，避免同一下點擊同時觸發繁殖和照顧。
- **照顧資料**：M1、M3 不直接讀 M2 的資料，只透過 `core/husbandry.js` 取得心數、能否繁殖、當天是否產出；M2 換實作不影響其他系統。
- **執行期內容表**：物種、分切表、加工配方在 `core/content.js` 合併內建與外部附加包註冊的內容，系統每次使用時查詢，不在啟動時自建對照表。
- **動物裝備的外觀**：穿戴狀態仍存在動態屬性，`core/gear.js` 把它同步到實體屬性 `kaleidoscope_ranching:gear_<種類>`，資源包用這個屬性顯示裝備；裝備是疊在動物上的另一個模型，不改動物自己的模型。
- **性別**：存在實體列舉屬性 `kaleidoscope_ranching:sex`，資源包用同一個屬性切換外觀與骨骼顯示。
- **屠體資料**：大型屠體不可堆疊，才能在物品動態屬性上記住公母與羊毛顏色。

## 生成流程

`npm run generate` 依序執行，結果固定（重跑不會產生差異）：

| 步驟 | 產出 |
| --- | --- |
| `tools/gen_art.py` | M1 六種動物的模型、貼圖、動畫、渲染控制器、預覽圖（`tools/art/animals.py`、`model.py`） |
| `tools/m2/gen_content.py` | M2 的方塊、物品、配方、模型、貼圖，與 `fragments/m2` |
| `tools/gen_m3_art.py` | 物品圖示（`tools/art/icons.py`）、M3 方塊模型與貼圖（`tools/art/blocks.py`），與 `fragments/m3`。`art/blocks/` 裡有手做模型的方塊（由 `art_src/m4_scripts/blocks_m2.py`、`blocks_m3.py`、`blocks_m4.py`、`butcher_rack.py`、`cheese_wheel.py` 產生）直接安裝手做版；M2 的自動餵食器、鍘草機、飼料攪拌桶、堆肥槽有手做模型時，`gen_content.py` 也改用它 |
| `tools/gen_entities.mjs` | 動物的行為包實體檔 |
| `art_src/m4_scripts/gear.py`、`wearables.py` | 動物身上的裝備（挽具、犁、披毯、馱袋；依 `data/gear.js`，照當下的動物模型量身產生另一層模型、貼圖與渲染控制器）與玩家穿戴物（毛帽、圍巾、皮圍裙）的附件模型 |
| `tools/gen_items.mjs` | 物品檔與合成、熔爐配方 |
| `tools/gen_blocks.mjs` | M3 方塊的方塊檔 |
| `tools/gen_shared.mjs` | 合併語言檔、貼圖索引、`blocks.json`；同一個鍵出現兩次就報錯 |
| `tools/art/rd_icons.py apply` | 把 `art/icons/` 裡選定的圖示寫進資源包 |

模型用 `tools/art/model.py` 的方塊 UV 排版器：先描述骨骼與方塊，再依每個像素所屬的部位與面上色，所以模型與貼圖永遠對得上。

## 驗證與測試

- `npm run validate`：所有 JSON 能解析；資料表彼此一致（沒有未登錄的識別碼）；每個物品、方塊都有檔案、圖示、貼圖；模型裡有方塊檔用到的骨骼；範例附加包的 JSON 能解析、註冊的識別碼都有檔案；每個物品都有圖示提示詞。
- `npm test`：用 `tools/test/mock-server.mjs` 模擬 `@minecraft/server`，在 Node 裡跑真正的腳本。模擬環境會照實體 JSON 執行事件、讀物品檔的堆疊與耐久，測試寫在 `tools/test/run.mjs`。模擬只涵蓋一小部分 API，通過不代表遊戲裡正常，最終以工作包 A 的實測為準。
- `npm run build`：驗證、測試後打包成 `dist/Kaleidoscope-Ranching-v<版本>.mcaddon`，範例附加包另外打包。

## 要改東西時

- 加物品或方塊：先登錄到 `data/items.js`、`data/blocks.js`（填 `owner`），再改對應的生成器，跑 `npm run generate` 與 `npm run validate`。
- 加動物：`data/animals.js` 加一列，`tools/art/animals.py` 加模型，`tools/gen_entities.mjs` 的 `TUNING` 加一列；M2 的 `data/species.js` 加照顧設定。
- 加加工配方或分切：只改 `data/processing.js`、`data/butcher.js`。
- 加會自己動的方塊：用 `core/blockClock.js`，不要在方塊檔加 `minecraft:tick`。
- 加玩家訊息：`tools/gen_shared.mjs` 的訊息表，三種語言一起加。
- 不要手改生成的檔案；不要複製廚房的貼圖或模型（CC BY-NC-SA 4.0）。
