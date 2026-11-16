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
  "dailyProduct": { "via": "milking_pail", "items": ["my_pack:alpaca_milk"] },
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
| `dailyProduct` | 否 | `via` 為 `"milking_pail"`（只限懷孕型）或 `"nest_box"`（只限生蛋型）；`items` 是產物的物品 id（產物不分品質；舊版傳入三個 id 仍可接受，只用第一個） |
| `fertilizedEgg` | 生蛋型必要 | 受精蛋物品，在巢箱或孵化器孵出這種動物 |
| `care.eats` | 否 | 飼槽裡吃哪些飼料：`grass`、`grain`、`veg`、`mixed`、`concentrate`；預設 `mixed`、`concentrate` |
| `care.treat` | 否 | 最愛的零食，每天可餵一次，加半顆心 |
| `care.brushDrops` | 否 | 刷毛時的掉落 `[物品, 機率]` |

**你的實體檔需要提供：**

- **族群**：`ranching_livestock`，加上 `ranching_female` 或 `ranching_male` 二選一。樂牧靠族群判斷性別，所以出生時就要隨機指定公母。
- **事件**：`kaleidoscope_ranching:become_baby`、`kaleidoscope_ranching:grow_up`、`kaleidoscope_ranching:make_persistent`、`kaleidoscope_ranching:add_ear_tag`；想讓動物自己走去飼槽，再加 `kaleidoscope_ranching:sated`（吃飽喝足時移除找飼槽的行為）與 `kaleidoscope_ranching:hungry`（新的一天加回來）。少了某個事件只會讓對應功能失效，不會出錯。
- **幼體**：幼體要有 `minecraft:is_baby`。
- **互動元件**：建議加一個 `minecraft:interact`，讓玩家的點擊確實送到腳本。
- **掉落表**：設成空的，屠體由樂牧產生。

## register_feed

```json
{ "item": "my_pack:hay_cube", "kind": "grass", "units": 2 }
```

`kind` 決定哪些動物會吃，以及飼料等級：`grass`、`grain`、`veg` 是 1 級，`mixed` 是 2 級，`concentrate` 是 3 級。`units` 是一個物品在飼槽裡算幾份，範圍 1–9。

## register_recipe

在樂牧的六個加工方塊之一加入配方：`butter_churn`、`cheese_press`、`aging_rack`、`fermenting_jar`、`pickling_vat`、`tanning_rack`。

```json
{
  "id": "my_pack:alpaca_yogurt",
  "station": "fermenting_jar",
  "inputs": [{ "item": "my_pack:alpaca_milk", "count": 1 }],
  "outputs": [{ "item": "my_pack:alpaca_yogurt", "count": 1 }],
  "ticks": 24000
}
```

- `inputs` 每格是 `{ item, count }` 或 `{ anyOf, count }`。
- `ticks` 是加工時間（24000 等於一個遊戲日，最多 7 天）。
- 成品數量固定是 `outputs` 寫的數量（產物不分品質）。

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

1.1 起（能力 `tag_contract`）：在**你自己的物品**掛上這些標籤，就會直接進樂牧的流程，不用送任何事件。樂牧在世界載入約 2 秒後掃描一次所有物品的標籤。

| 標籤 | 效果 |
| --- | --- |
| `kaleidoscope_ranching:offal` | 算蔬菜類飼料，可以放進飼槽餵豬 |
| `kaleidoscope_ranching:mince` | 兩份加一份腸衣，在絞肉機做成 2 條生香腸 |
| `kaleidoscope_ranching:fleece` | 兩份在紡車紡成 2 份毛線 |
| `kaleidoscope_ranching:fine_fleece` | 兩份在紡車紡成 2 份絨線 |
| `kaleidoscope_ranching:hide` | 一張在鞣皮架一天換 1 張皮革 |
| `kaleidoscope_ranching:tallow` | 和皮革一起在鞣皮架做油鞣皮革；在工作台和木炭、水桶做肥皂 |

## 1.1 新增

先確認 `api_ready` 的能力清單裡有對應的名稱再使用；沒有的能力，舊版樂牧會照 v1 規則回 `api_result` 錯誤，不會出事。

| 能力 | 內容 |
| --- | --- |
| `recipes_1_1` | `register_recipe` 的 `station` 可以是 1.1 的方塊：`meat_grinder`、`cream_separator`、`ice_cream_churn`、`spinning_wheel`、`weaving_loom`、`silage_barrel`。`ticks` 為 0 時，使用一次就立刻產出（例如絞肉機）。奶油分離器、紡車、織布機、青貯桶會自己從上方容器拿料、把成品放進下方容器，註冊的配方也一樣 |
| `butcher_offal` | `register_butcher` 的分切可以標 `skin: true`（剝皮的刀，掛架顯示去皮的時機）與 `offal: true`（內臟那一刀） |
| `animal_1_1` | `register_animal` 多了五個選填欄位，見下表 |
| `feed_1_1` | `register_feed` 與 `care.eats` 多了 `"ruminant"`（只有反芻動物吃，像青貯料）與 `"calcium"`（只有家禽吃，吃了的母禽隔天有 30% 機率多下一顆蛋） |
| `remedy` | 新事件 `kaleidoscope_ranching:register_remedy`，`{ "item": "你的命名空間:物品" }`：拿它點生病的動物就會痊癒，用掉一個 |
| `events_1_1` | `animal_event` 多了 `fell_asleep`、`woke`（附 `reason`）、`slept_well`、`fell_ill`（附 `cause`：`thirst` 或 `dirt`）、`cured`、`moulted`、`foraged`、`herded`（附 `player`） |
| `query_1_1` | `animal_info` 多了 `sleeping`、`sick`、`blanket`、`harness`、`packBag`（都是布林值） |
| `tag_contract` | 見上方「標籤契約」 |

`register_animal` 的 1.1 欄位：

| 欄位 | 內容 |
| --- | --- |
| `sleep` | `"lie"`、`"side"`、`"roost"`、`"curl"` 之一。你的動物要定義 `kaleidoscope_ranching:fall_asleep` 與 `kaleidoscope_ranching:wake_up` 兩個事件（設定一個同步屬性並讓牠停下），樂牧在夜裡觸發它們；沒有這兩個事件的動物不睡覺 |
| `moult` | `[物品, 機率]`：好感 4 心以上的成年動物，每天以這個機率掉一個 |
| `harness` | `true`：可以裝挽具、拉犁，像水牛 |
| `packBag` | `true`：可以背馱袋，像氂牛。實體要自己有 `minecraft:inventory`（常駐，或由 `kaleidoscope_ranching:put_on_pack_bag` 事件加入） |
| `coldHardy` | `true`：不怕冷，像氂牛 |
| `forage` | `{ "item": ..., "chance": 0.25, "minHearts": 5 }`：好感夠的成年動物，在森林的草地或灰化土上每天有機率拱出這個物品，像豬拱松露 |

## 伺服器設定指令

這不是給附加包用的註冊介面，而是管理員可以在聊天欄或指令方塊下的指令：

```
/scriptevent kaleidoscope_ranching:config clean_need off
```

關閉（`off`）或開啟（`on`）「清潔」這項每日需求。管理員也可以在牧場記事本的名冊畫面裡切換。

1.1 起另有：

```
/scriptevent kaleidoscope_ranching:config sleep off
```

關閉或開啟動物作息（晚上睡覺）。牧場記事本的設定頁也能切換。

```
/scriptevent kaleidoscope_ranching:config disease off
```

關閉或開啟疾病。關閉後不會再有動物生病，已經生病的會在下一次每日檢查時痊癒。牧場記事本的設定頁也能切換。
