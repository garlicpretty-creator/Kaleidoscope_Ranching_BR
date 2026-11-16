# 可放置食物精修 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 13 個可放置食物的模型從「同一個形狀換顏色」做成各有辨識度的立體料理。

**Architecture:** 只改 `art_src/m4_scripts/` 的兩支模型腳本，輸出到 `art/blocks/`，再由 `npm run generate` 安裝進資源包。行為包程式不動；`tools/validate.mjs` 加一段結構檢查當作測試。

**Tech Stack:** Python 3 + Pillow（模型與貼圖腳本）、Node.js（生成、驗證、測試）。

**Spec:** `docs/superpowers/specs/2026-11-16-1.1-art-wrapup-design.md`（第 1 塊）

## Global Constraints

- 分支 `art/placed-food-polish`，從 `main` 開，不直接推 `main`。
- 每個方塊保留骨骼 `piece_1`～`piece_4`，`piece_4` 最先被吃掉；每根骨骼至少一個方塊。
- 只用軸對齊、box-UV 的方塊（`preview.py` 與 `bbmodel.py` 只支援這種）。
- 貼圖是正方形；模型不超出一格（x、z 在 -8～8，y 在 0～16）。
- 生成的檔案（`packs/RP/…`）不手改，一律改腳本後重跑。
- 全部原創，不複製廚房、酒館、原版的資源檔。
- 模型外形改變時，同步改 `tools/gen_blocks.mjs` 的 `PLACED_SHAPES` 碰撞與選取框。

## Review Focus

- 吃到一半的每個狀態（隱藏 `piece_4`、再 `piece_3`…）都不能露出空洞或貼圖沒畫到的面：切面要上色。預覽圖每種形狀加一格「吃掉兩份」的狀態。
- 上下層配料共面會閃爍：同一道菜的配料在每一層用同樣的 x、z 位置，下層的頂面必須被上層蓋住；跑 `tools/fix_zfight.py` 後 `git diff` 不應再動這些檔。
- 光影材質：`tools/gen_pbr.py` 的 `RULES` 依貼圖檔名分類，新增的配料顏色不能被當成金屬（`METAL_ACCENTS`）；跑完看 `*_mer.png` 的配料區不是金屬。
- 重跑 `npm run generate` 兩次，第二次不能有差異（PNG 位元組穩定）。
- 砂鍋與鐵鍋外形不同後，碰撞框要各自對得上，不然玩家點不到或卡住。

---

### Task 1: 結構檢查（先寫、先失敗）

**Files:**
- Modify: `tools/validate.mjs`（加在既有的方塊模型檢查之後）

**Interfaces:**
- Produces: 驗證錯誤訊息 `placed food <block>: …`，後面每個任務以 `npm run validate` 通過為準。

- [ ] **Step 1:** 在 `tools/validate.mjs` 讀 `PLACED_FOODS`，對每列檢查 `packs/RP/models/blocks/kaleidoscope_ranching.<block>.geo.json`：
  - 有 `piece_1`…`piece_<portions>`，每根至少一個方塊；
  - 所有方塊在 x、z ∈ [-8, 8]、y ∈ [0, 16] 之內；
  - `shape` 是 `pot` 或 `dish` 的方塊，兩兩之間的方塊清單（origin、size）不得完全相同。
- [ ] **Step 2:** `npm run validate`，預期失敗：六道燉菜彼此幾何相同、兩道焗烤彼此相同。
- [ ] **Step 3:** Commit `test: placed food models must differ per dish`。

### Task 2: 乳酪輪變圓

**Files:**
- Modify: `art_src/m4_scripts/cheese_wheel.py`
- Output: `art/blocks/{cheese_wheel,vintage_cheese_wheel,smoked_cheese_wheel}.{geo.json,png}`

- [ ] **Step 1:** `quarter()` 每個四分之一改用三個方塊疊出八邊形輪廓（半徑 6：6×4、5×5、4×6 的交疊），高度 `H = 5`；頂面外圈內縮 1 像素做出倒角（上層 1 像素高、半徑 5）。UV 改用 `blocks_m3.autouv` 排版，不再手寫座標。
- [ ] **Step 2:** 貼圖：頂面中央畫一圈烙印（深一階的圓環）；側面腰帶；切面沿用孔洞紋，陳年款加淺色結晶點、煙燻款外皮往內 1 像素畫煙燻色邊。
- [ ] **Step 3:** `python art_src/m4_scripts/cheese_wheel.py`，再跑預覽（Task 6 的指令）看完整與吃掉兩份的狀態。
- [ ] **Step 4:** Commit `art: round cheese wheels`。

### Task 3: 披薩

**Files:**
- Modify: `art_src/m4_scripts/placed_food.py`（`PIZZA`、`pizza_quarter`、`pizza_paint`、`pizza_paints`）

- [ ] **Step 1:** 餅邊比餡面高 1 像素（外圈方塊 y 高 2、內圈高 1 再加餡）；每個四分之一加莫札瑞拉 2×1×2 兩塊、羅勒 1×1×2 一片，突出餡面 1 像素；木板加把手 3×1×4。
- [ ] **Step 2:** 配料方塊各自上色（乳酪帶融邊、羅勒深淺兩色）；切面仍是「上乳酪、下餅體」。
- [ ] **Step 3:** 重跑腳本與預覽；Commit `art: pizza with raised crust and toppings`。

### Task 4: 鍋類七道

**Files:**
- Modify: `art_src/m4_scripts/placed_food.py`（`FONDUE`、`POTS`、`pot_paints`、`main`）
- Modify: `tools/gen_blocks.mjs`（`PLACED_SHAPES`：砂鍋外形不同時新增 `claypot`）；`packs/BP/scripts/data/placedFoods.js` 的 `shape` 註解與 `claypot_rice` 那一列

**Interfaces:**
- Produces: `pot_model(vessel: str, toppings: list) -> bones`，`vessel` 為 `"iron" | "clay" | "fondue"`；`toppings` 是 `(name, x, z, w, d, rise, colour)` 的清單，每一層在同樣的 x、z 放一份。

- [ ] **Step 1:** 鐵鍋：四角削 1 像素變八角，鍋緣外翻 1 像素，兩側鐵耳取代木柄；保留爐腳與火。砂鍋：較寬較淺（12×5）、無爐腳、陶色、旁邊靠一個鍋蓋。起司火鍋：保留原鍋與火，加兩支叉著麵包丁的長叉。
- [ ] **Step 2:** 各道配料（每層同位置，高出湯面 1 像素）：
  - 老鴨湯：鴨腿 3×2、筍片 2×1 兩片、枸杞 1×1 三點
  - 紅燒牛腩：牛腩 2×2 三塊、紅蘿蔔 2×1 兩塊、馬鈴薯 2×2 一塊
  - 氂牛燉肉：肉 3×2 兩塊、蘿蔔 2×2、馬鈴薯 2×2
  - 燉鵝：鵝塊 3×2 兩塊、辣椒 1×2 兩條、馬鈴薯 2×2
  - 獅子頭：四顆 3×3×3 丸子，每層一顆（`piece_n` 帶第 n 顆），青菜 2×1 墊邊
  - 煲仔飯：不分層，改四個四分之一（像焗烤）；米飯高 2，臘腸斜片 2×1 三片、青菜 1×3、中央半熟蛋 2×2
  - 起司火鍋：乳酪液面，無配料
- [ ] **Step 3:** 砂鍋若換碰撞框，`placedFoods.js` 把 `claypot_rice` 的 `shape` 改成 `claypot`，`gen_blocks.mjs` 加 `claypot: both(-7, 0, -7, 14, 6, 14)`；`tools/gen_m3_art.py:43` 與 `tools/gen_pbr.py:80` 的名單照舊適用（檔名沒變）。
- [ ] **Step 4:** 重跑腳本與預覽；`npm test`（`tools/test/run.mjs:707` 之後的共食測試）仍通過；Commit `art: each shared pot has its own vessel and toppings`。

### Task 5: 焗烤兩道

**Files:**
- Modify: `art_src/m4_scripts/placed_food.py`（`GRATIN`、`DISHES`、`gratin_piece`）

- [ ] **Step 1:** 每個四分之一加隆起的焦皮 2 塊（1 像素高，位置兩道不同）；烤盤耳朵加寬成 1×1×4。
- [ ] **Step 2:** 起司焗烤：焦斑較多、邊緣有溢出的乳酪 1×1 兩點；松露焗烤：頂面 1×1 黑松露片四片（方塊，不只是貼圖）。切面露出白醬與馬鈴薯分層。
- [ ] **Step 3:** 重跑腳本與預覽；Commit `art: gratins with a raised crust`。

### Task 6: 生成、驗證、預覽

**Files:**
- Output: `packs/RP/**`（生成）、`art_src/blockbench/*.bbmodel`、`docs/art/placed_food_preview.png`

- [ ] **Step 1:** `python art_src/m4_scripts/bbmodel.py <13 個方塊 id>` 更新 Blockbench 檔。
- [ ] **Step 2:** `npm run generate`；再跑一次，`git status` 第二次沒有新差異。
- [ ] **Step 3:** `npm run validate`（Task 1 的檢查現在通過）、`npm test`（全數通過）。
- [ ] **Step 4:** `python art_src/m4_scripts/preview.py docs/art/placed_food_preview.png <13 個 id>`，每種形狀另加一格吃掉兩份的狀態（`preview.py` 的 `hidden` 支援以參數隱藏 `piece_3`、`piece_4`；沒有的話在 `render()` 加 `-bone` 語法）。
- [ ] **Step 5:** 看預覽圖逐一檢查 Review Focus 的五項；Commit `art: placed food polish, regenerated`，推分支並開 PR。
