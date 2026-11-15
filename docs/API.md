# 樂牧對外擴充 API（v1）

其他附加包不用修改樂牧，就能透過這套 API 加入動物、飼料、加工配方與屠宰分切，也能收到出生、孵化、收成等事件。做法和《森羅物語：廚房》的 v1 API 相同：用腳本事件（Script Event）傳 JSON，**不要 import 樂牧的腳本檔**。

範例附加包在 `examples/api-example/`，示範一隻羊駝的完整註冊。`bash tools/build.sh` 會另外打包出 `dist/Kaleidoscope-Ranching-API-example.mcaddon`。

## 握手

1. 世界載入後，送出 `kaleidoscope_ranching:api_ping`，訊息內容不拘。
2. 樂牧會回 `kaleidoscope_ranching:api_ready`：

```json
{ "api": 1, "version": "0.5.0", "capabilities": ["register_animal", "register_feed", "register_recipe", "register_butcher", "animal_event", "api_result", "query_animal", "care_events"] }
```

樂牧在世界載入約 1 秒後也會主動送一次 `api_ready`，所以只監聽不 ping 也收得到。收到 `api_ready` 之後再送出註冊，送之前先確認 `capabilities` 裡有你要用的項目。

`query_animal`（查詢動物）與 `care_events`（`mated`、`cared` 兩種事件）是 v1 後來加入的能力，較舊的樂牧沒有，使用前請先檢查。

## 規則

- **只在當次世界載入有效**：每次載入都要重新註冊。重複註冊是安全的，同一個識別碼再註冊一次會更新內容。
- **只能註冊自己命名空間的識別碼**：動物、飼料物品、屠體、配方 id 都不能是 `minecraft:` 或 `kaleidoscope_ranching:`。拿來當材料或分切產物的物品可以是任何命名空間。
- **內建內容優先**：樂牧自己的動物、飼料、配方、屠體都不能被覆蓋。
- **一則訊息上限約 2048 字元**：這是基岩版腳本事件的限制，每則訊息只放一筆註冊。
- **數量上限**：每次世界載入最多 64 種動物、256 種飼料、256 條配方、64 種屠體。
- v1 的事件名稱與欄位會保持相容；有破壞性變更時會改用新的 `api` 版本號。

每一筆 `register_*` 都會收到一則 `kaleidoscope_ranching:api_result`：

```json
{ "event": "register_feed", "id": "my_pack:oats", "ok": false, "error": "item must use your own namespace, not minecraft:" }
```

這則結果會廣播給所有附加包，請只處理 `id` 屬於自己命名空間的那些。

## register_animal

讓你的動物加入樂牧的性別、好感度、每日需求、繁殖、產物與屠體系統。

```json
{
  "id": "my_pack:alpaca",
  "reproduction": "gestation",
  "days": 3,
  "breedItems": ["my_pack:hay_cube", "kaleidoscope_ranching:mixed_feed"],
  "carcass": "my_pack:alpaca_carcass",
  "largeCarcass": true,
  "dailyProduct": { "via": "milking_pail", "items": ["my_pack:alpaca_milk", "my_pack:alpaca_milk_fine", "my_pack:alpaca_milk_superb"] },
  "care": { "eats": ["grass", "mixed", "concentrate"], "treat": "kaleidoscope_ranching:alfalfa_cake", "brushDrops": [["minecraft:white_wool", 0.2]] }
}
```

| 欄位 | 必要 | 說明 |
| --- | --- | --- |
| `id` | 是 | 實體識別碼 |
| `reproduction` | 是 | `"gestation"`（懷孕生產）或 `"egg"`（生蛋孵化） |
| `days` | 否 | 懷孕或孵化天數（1–30），預設 3 或 2；在配種或放入受精蛋的當下決定 |
| `breedItems` | 懷孕型必要 | 餵這些物品會進入發情 |
| `carcass` | 否 | 死亡時掉落的屠體物品；沒有的話死亡不掉落任何東西 |
| `largeCarcass` | 否 | `true` 時屠體會記住公母、公的多切一份；屠體物品必須 `max_stack_size: 1` |
| `dailyProduct` | 否 | `via` 為 `"milking_pail"`（只限懷孕型）或 `"nest_box"`（只限生蛋型）；`items` 依序是普通、優良、極品三個物品 |
| `fertilizedEgg` | 生蛋型必要 | 受精蛋物品，在巢箱或孵化器孵出這種動物 |
| `care.eats` | 否 | 飼槽裡吃哪些飼料：`grass`、`grain`、`veg`、`mixed`、`concentrate`；預設 `mixed`、`concentrate` |
| `care.treat` | 否 | 最愛的零食，每天可餵一次，加半顆心 |
| `care.brushDrops` | 否 | 刷毛時的掉落 `[物品, 機率]` |

**你的實體檔需要提供：**

- **族群**：`ranching_livestock`，加上 `ranching_female` 或 `ranching_male` 二選一。樂牧靠族群判斷性別，所以出生時就要隨機指定公母。
- **事件**：`kaleidoscope_ranching:become_baby`、`kaleidoscope_ranching:grow_up`、`kaleidoscope_ranching:make_persistent`、`kaleidoscope_ranching:add_ear_tag`。少了某個事件只會讓對應功能失效，不會出錯。
- **幼體**：幼體要有 `minecraft:is_baby`。
- **互動元件**：建議加一個 `minecraft:interact`，讓玩家的點擊確實送到腳本。
- **掉落表**：設成空的，屠體由樂牧產生。

## register_feed

```json
{ "item": "my_pack:hay_cube", "kind": "grass", "units": 2 }
```

`kind` 決定哪些動物會吃，以及飼料等級：`grass`、`grain`、`veg` 是 1 級，`mixed` 是 2 級，`concentrate` 是 3 級。`units` 是一個物品在飼槽裡算幾份，範圍 1–9。

## register_recipe

在樂牧的五個加工方塊之一加入配方：`butter_churn`、`cheese_press`、`aging_rack`、`fermenting_jar`、`pickling_vat`。

```json
{
  "id": "my_pack:alpaca_yogurt",
  "station": "fermenting_jar",
  "inputs": [{ "anyOf": ["my_pack:alpaca_milk", "my_pack:alpaca_milk_fine", "my_pack:alpaca_milk_superb"], "count": 1 }],
  "outputs": [{ "item": "my_pack:alpaca_yogurt", "count": 1 }],
  "ticks": 24000
}
```

- `inputs` 每格是 `{ item, count }` 或 `{ anyOf, count }`。
- `ticks` 是加工時間（24000 等於一個遊戲日，最多 7 天）。
- 成品數量會依投入材料中最低的品質放大，規則和內建配方相同。判斷品質的方式是物品 id 結尾的 `_fine`、`_superb`。

## register_butcher

```json
{
  "carcass": "my_pack:alpaca_carcass",
  "look": "sheep",
  "cuts": [
    { "item": "minecraft:white_wool", "count": [1, 2] },
    { "item": "minecraft:mutton", "count": [2, 3], "maleBonus": 1 },
    { "item": "minecraft:leather", "count": [1, 1], "chance": 0.5 }
  ]
}
```

- `cuts` 依序代表每一刀。
- `maleBonus`：公的屠體多切出的數量。
- `maleOnly`：只有公的屠體才有這一刀。
- `chance`：這一刀有產物的機率，範圍 0–1。
- `look`：掛在架上時借用哪種內建動物的外觀，可以是 `cow`、`sheep`、`goat`、`pig`、`chicken`、`rabbit`、`duck`、`goose`、`buffalo`、`yak`。

## animal_event（樂牧送出）

```json
{ "type": "born", "animal": "my_pack:alpaca", "entity": "-4294967295", "mother": "-4294967290" }
```

| `type` | 何時 | 其他欄位 |
| --- | --- | --- |
| `born` | 哺乳類出生 | `animal`、`entity`、`mother` |
| `hatched` | 蛋孵化（巢箱或孵化器） | `animal`、`entity`、`mother`（孵化器沒有） |
| `harvested` | 擠奶、從巢箱取蛋、巢箱把蛋送進漏斗 | `product`（`milk` 或 `egg`）、`items`（`{物品: 數量}`）；擠奶另有 `animal`、`entity` |
| `butchered` | 一具屠體切完 | `carcass` |
| `mated` | 母畜受孕（需要 `care_events`） | `animal`、`mother`、`father` |
| `cared` | 玩家照顧了動物（需要 `care_events`） | `animal`、`entity`、`player`（玩家的實體 id）、`kind` |

`cared` 的 `kind` 是 `pet`（撫摸）、`brush`（毛刷）、`treat`（零食）、`ear_tag`（耳標）或 `nursing_bottle`（奶瓶）。撫摸與毛刷每隻動物每天只在第一次生效時送出。

## query_animal（需要 `query_animal` 能力）

查詢一隻樂牧動物目前的狀態，內建動物和註冊進來的動物都可以查。送出：

```json
{ "entity": "-4294967295", "ref": "my_pack:quest_12" }
```

`entity` 是實體 id（腳本的 `entity.id`）。`ref` 可省略，最長 64 字元，會原樣放回答覆裡，方便你對上是哪一次查詢。樂牧會回一則 `kaleidoscope_ranching:animal_info`：

```json
{
  "entity": "-4294967295", "ref": "my_pack:quest_12", "found": true,
  "animal": "kaleidoscope_ranching:cow", "sex": "female", "baby": false,
  "hearts": 3,
  "needs": { "fed": true, "water": true, "groom": false, "clean": true, "all": false },
  "pregnant": true, "dueInDays": 2,
  "earTag": 7, "name": "小花"
}
```

- 找不到實體、實體所在區塊沒載入，或它不是樂牧的動物時，只會有 `entity`、`ref` 和 `"found": false`。
- `hearts` 是 0–5 的好感度；`needs` 是今天四項需求是否已滿足（關閉清潔需求時 `clean` 一律為 `true`）。
- `dueInDays` 只在懷孕時出現；`earTag`、`name` 只在有耳標、有名字時出現。
- 答覆和 `api_result` 一樣是廣播，請用 `ref` 或 `entity` 認出自己的那一則。
- 查詢會順便替那隻動物做一次每日結算，和玩家用記事本查看時相同。

## 標籤契約（不需要腳本）

- 物品標籤 `kaleidoscope_ranching:milk`、`kaleidoscope_ranching:fertilized_egg`、`kaleidoscope_ranching:feed`、`kaleidoscope_ranching:brush`：讓別的附加包認得這是奶、受精蛋、飼料或毛刷。擠奶和孵化實際用到哪些物品，以 `register_animal` 註冊的內容為準。
- 實體族群 `ranching_livestock`、`ranching_male`、`ranching_female`：可以用來篩選樂牧的動物，也是你的動物被樂牧認得的方式。
