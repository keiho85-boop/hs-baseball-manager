# 第1章（サクセス版）で足りない絵のプロンプト（見本を1枚添付する版）

Geminiに、見本の画像を1枚添付してから、下のプロンプトを貼り付けてください。
見本はすべて、このリポジトリの `public/chara/` と `public/bg/` にある画像です。
加工（白背景の切り抜き、胸から上の切り出し、webp化）はこちらで行います。

## 進め方

- **人物**
  - 見本を添付して、まず通常の顔（normal）を1枚作ります。
  - 2枚目以降は、できた通常の顔の画像を添付して、表情だけを変えるように頼みます。

    ```
    Same character, same outfit, same hairstyle, same art style, same framing. Change only the facial expression to: [smiling / serious / surprised].
    ```
- **背景**
  - 見本を添付して、そのまま作ります。
  - 縦長（2:3）で作ってください。
- **見本は画風だけに使う**
  - どのプロンプトにも「見本は画風だけに使い、人物や場所はまねしない」と書いてあります。
  - それでも見本の人物に似てしまう場合は、見本を別の人物の画像に替えてください。

---

## 人物（今回の分：10人）

保存するファイル名は `public/chara/<ファイル名の前半>full_<表情>` です。表情は normal・smile・serious・surprise の4枚です（蓮見先生の浴衣だけは smile・tease の2枚）。

### 岩城 剛（陸上部のエース。のちの先発投手）
- **ファイル名の前半：** `iwaki_hs_track_`
- **添付する見本：** `daichi_hs_practice_full_normal.webp`

```
Use the attached image only as an art-style reference: match its line art, coloring, shading, lighting, level of detail and proportions exactly. Do NOT copy the person in the reference; draw a completely different character.
Character: a tall, broad-shouldered Japanese high school boy (age 16), short spiky black hair, calm serious eyes, wearing a navy school track jacket over a white T-shirt and track pants, a towel around his neck.
Full-body standing pose, facing slightly to the side, neutral expression, plain pure white background, no text, no logos.
```

### 塩見 豪太（相撲部のエース。パワーのある一塁手）
- **ファイル名の前半：** `shiomi_hs_sumo_`
- **添付する見本：** `daichi_hs_practice_full_normal.webp`

```
Use the attached image only as an art-style reference: match its line art, coloring, shading, lighting, level of detail and proportions exactly. Do NOT copy the person in the reference; draw a completely different character.
Character: a big, sturdy, round-faced Japanese high school boy (age 16) with a short buzz cut, gentle sleepy eyes, wearing a plain white school gym T-shirt and navy gym shorts, holding a rice bowl and chopsticks.
Full-body standing pose, facing slightly to the side, neutral expression, plain pure white background, no text, no logos.
```

### 天羽 翔（サッカー部のエース。足の速い中堅手。女子に人気）
- **ファイル名の前半：** `amou_hs_soccer_`
- **添付する見本：** `daichi_hs_practice_full_normal.webp`

```
Use the attached image only as an art-style reference: match its line art, coloring, shading, lighting, level of detail and proportions exactly. Do NOT copy the person in the reference; draw a completely different character.
Character: a handsome, slim Japanese high school boy (age 16) with light brown wavy hair, bright confident eyes, wearing a plain blue soccer practice jersey and shorts with no team logo, a soccer ball under one arm.
Full-body standing pose, facing slightly to the side, neutral expression, plain pure white background, no text, no logos.
```

### 久遠 遼（テニス部のエース。ミートのうまい遊撃手）
- **ファイル名の前半：** `kuon_hs_tennis_`
- **添付する見本：** `daichi_hs_practice_full_normal.webp`

```
Use the attached image only as an art-style reference: match its line art, coloring, shading, lighting, level of detail and proportions exactly. Do NOT copy the person in the reference; draw a completely different character.
Character: a cool, composed Japanese high school boy (age 16) with neat dark hair and sharp eyes, wearing a plain white tennis polo shirt and shorts with no brand logo, holding a tennis racket over his shoulder.
Full-body standing pose, facing slightly to the side, neutral expression, plain pure white background, no text, no logos.
```

### 小早川 俊（卓球部のエース。反射神経の良い二塁手）
- **ファイル名の前半：** `kobayakawa_hs_tabletennis_`
- **添付する見本：** `daichi_hs_practice_full_normal.webp`

```
Use the attached image only as an art-style reference: match its line art, coloring, shading, lighting, level of detail and proportions exactly. Do NOT copy the person in the reference; draw a completely different character.
Character: a small, quick-looking Japanese high school boy (age 16) with messy short hair and sharp focused eyes, wearing a plain red table tennis game shirt and black shorts, holding a table tennis paddle.
Full-body standing pose, facing slightly to the side, neutral expression, plain pure white background, no text, no logos.
```

### 千手 静馬（将棋部のエース。1イニングだけの火消し役）
- **ファイル名の前半：** `senju_hs_shogi_`
- **添付する見本：** `makabe_20s_teacher_full_normal.webp`

```
Use the attached image only as an art-style reference: match its line art, coloring, shading, lighting, level of detail and proportions exactly. Do NOT copy the person in the reference; draw a completely different character.
Character: a pale, slender Japanese high school boy (age 16) with thin glasses and neat black hair, calm intelligent eyes, wearing a dark navy school blazer uniform with a tie, holding a shogi piece between two fingers.
Full-body standing pose, facing slightly to the side, neutral expression, plain pure white background, no text, no logos.
```

### 東雲 学（生徒会長）
- **ファイル名の前半：** `shinonome_hs_council_`
- **添付する見本：** `makabe_20s_teacher_full_normal.webp`

```
Use the attached image only as an art-style reference: match its line art, coloring, shading, lighting, level of detail and proportions exactly. Do NOT copy the person in the reference; draw a completely different character.
Character: a neat, serious Japanese high school boy (age 17) with short side-parted hair and rimless glasses, wearing a dark navy school blazer uniform with a "student council" style armband (no readable text), holding a clipboard.
Full-body standing pose, facing slightly to the side, neutral expression, plain pure white background, no text, no logos.
```

### 三木 文太（新聞部）
- **ファイル名の前半：** `miki_hs_newspaper_`
- **添付する見本：** `daichi_hs_practice_full_normal.webp`

```
Use the attached image only as an art-style reference: match its line art, coloring, shading, lighting, level of detail and proportions exactly. Do NOT copy the person in the reference; draw a completely different character.
Character: a cheerful Japanese high school boy (age 16) with slightly messy hair, wearing a white school shirt with rolled-up sleeves and dark uniform trousers, a camera hanging from his neck, holding a small notebook and a pen.
Full-body standing pose, facing slightly to the side, neutral expression, plain pure white background, no text, no logos.
```

### プロのスカウト
- **ファイル名の前半：** `pro_scout_40s_`
- **添付する見本：** `kuga_30s_coach_full_normal.webp`

```
Use the attached image only as an art-style reference: match its line art, coloring, shading, lighting, level of detail and proportions exactly. Do NOT copy the person in the reference; draw a completely different character.
Character: a Japanese man in his late 40s, plain dark baseball cap pulled low, dark windbreaker over a polo shirt, slacks, a radar speed gun in one hand, friendly but sharp eyes, light stubble.
Full-body standing pose, facing slightly to the side, neutral expression, plain pure white background, no text, no logos.
```

### 蓮見しずく（養護教諭・大人）の浴衣
- **ファイル名の前半：** `hasumi_yukata_`
- **添付する見本：** `hasumi_nurse_bust_smile.webp`（この人物と同じ顔で作ります）
- **表情：** smile と tease の2枚

```
Use the attached image as the reference for BOTH the character and the art style: same woman, same face, same hairstyle and hair color, same line art and coloring.
Change only the outfit: she now wears a modest navy summer yukata with a white flower pattern and a light-colored obi, holding a round paper fan, gentle smile.
Full-body standing pose, facing slightly to the side, plain pure white background, no text, no logos.
```

---

## 人物（前回からまだの分：4つ）

### 1年目の3年生の主将（帽子を深くかぶり、目が見えない）
- **ファイル名の前半：** `mob_captain_practice_`
- **添付する見本：** `daichi_hs_practice_full_normal.webp`
- **表情：** normal と frustrated の2枚

```
Use the attached image only as an art-style reference: match its line art, coloring, shading, lighting, level of detail and proportions exactly. Do NOT copy the person in the reference; draw a completely different character.
Character: a Japanese high school baseball player (age 17), wearing a plain white practice uniform with dirt stains and a plain navy baseball cap pulled down very low so that his eyes are hidden in the shadow of the brim, only his nose, mouth and jaw are visible. Average build.
Full-body standing pose, facing slightly to the side, mouth calm, plain pure white background, no text, no logos.
```

frustrated の2枚目は、1枚目を添付して次のように頼みます。

```
Same character, same outfit, same cap covering the eyes, same art style. Change only the expression: lips pressed together, head slightly lowered, fists clenched, frustrated.
```

### 病衣の祖父（病室の場面）
- **ファイル名の前半：** `grandpa_70s_hospital_`
- **添付する見本：** `grandpa_70s_fan_full_smile.webp`（同じ人物で作ります）
- **表情：** smile の1枚

```
Use the attached image as the reference for BOTH the character and the art style: same elderly man, same face, same hairstyle, same line art and coloring.
Change only the outfit: he now wears a light blue hospital gown with a cardigan over his shoulders, sitting slightly upright as if on a hospital bed (draw only him, no bed), warm smile.
Plain pure white background, no text, no logos.
```

### 合宿の浜辺のナギ（練習着）
- **ファイル名の前半：** `nagi_beach_`
- **添付する見本：** `nagi_hs_uniform_bust_smile.webp`（同じ人物で作ります）
- **表情：** smile の1枚
- **服装：** 浜辺での練習の場面なので、露出のない運動着にしています

```
Use the attached image as the reference for BOTH the character and the art style: same girl, same face, same hairstyle and hair color, same line art and coloring.
Change only the outfit: she wears a long-sleeved navy athletic rash guard with a high neck, loose knee-length board shorts, a baseball team cap, and holds a clipboard, for outdoor practice at the beach during a training camp. Modest sporty outfit.
Full-body standing pose, facing slightly to the side, cheerful smile, plain pure white background, no text, no logos.
```

### 合宿の浜辺のレイカ（練習着）
- **ファイル名の前半：** `reika_beach_`
- **添付する見本：** `reika_hs_uniform_bust_normal.webp`（同じ人物で作ります）
- **表情：** normal の1枚

```
Use the attached image as the reference for BOTH the character and the art style: same girl, same face, same hairstyle and hair color, same line art and coloring.
Change only the outfit: she wears a long-sleeved white athletic rash guard with a high neck, loose knee-length dark board shorts, and a wide-brimmed sun hat, holding a beach volleyball, at a training camp. Modest sporty outfit.
Full-body standing pose, facing slightly to the side, confident expression, plain pure white background, no text, no logos.
```

---

## 背景（今回の分：12枚）

保存するファイル名は `public/bg/<ファイル名>.webp` です。どのプロンプトにも「人物を入れない」「縦長」が含まれています。

### bg_track_field（陸上部のグラウンド）
- **添付する見本：** `bg_ground_day.webp`

```
Use the attached image only as an art-style reference: match its painting style, line work, color palette, lighting and level of detail exactly. Draw a different place.
Scene: a Japanese high school athletics field in the afternoon, a shot put circle with white chalk lines in the foreground, a red running track and the school building behind, warm sunlight.
No people, no text, no logos, vertical 2:3 composition.
```

### bg_sumo_room（相撲部の土俵）
- **添付する見本：** `bg_clubroom_day.webp`

```
Use the attached image only as an art-style reference: match its painting style, line work, color palette, lighting and level of detail exactly. Draw a different place.
Scene: inside a small Japanese high school sumo club dojo, a clay sumo ring outlined with straw bales, wooden walls, a large cooking pot on a low table at the side, soft daylight from high windows.
No people, no text, no logos, vertical 2:3 composition.
```

### bg_soccer_field（サッカー部のグラウンド）
- **添付する見本：** `bg_ground_day.webp`

```
Use the attached image only as an art-style reference: match its painting style, line work, color palette, lighting and level of detail exactly. Draw a different place.
Scene: a Japanese high school soccer field after school, a goal with a net on the left, a chain-link fence with a few school bags hanging on it, golden afternoon light.
No people, no text, no logos, vertical 2:3 composition.
```

### bg_tennis_court（テニスコート）
- **添付する見本：** `bg_ground_day.webp`

```
Use the attached image only as an art-style reference: match its painting style, line work, color palette, lighting and level of detail exactly. Draw a different place.
Scene: a Japanese high school outdoor tennis court with a green hard court surface and a net, a bulletin board with paper notices near the fence (no readable text), clear sky.
No people, no text, no logos, vertical 2:3 composition.
```

### bg_gym_table_tennis（体育館の卓球台）
- **添付する見本：** `bg_entrance_ceremony.webp`

```
Use the attached image only as an art-style reference: match its painting style, line work, color palette, lighting and level of detail exactly. Draw a different place.
Scene: a Japanese high school gymnasium with several table tennis tables set up in a row, green tables and low blue dividers, bright overhead lights, polished wooden floor.
No people, no text, no logos, vertical 2:3 composition.
```

### bg_shogi_room（将棋部の部室）
- **添付する見本：** `bg_classroom_day.webp`

```
Use the attached image only as an art-style reference: match its painting style, line work, color palette, lighting and level of detail exactly. Draw a different place.
Scene: a quiet Japanese high school clubroom for shogi, a wooden shogi board with pieces mid-game on a low table, tatami mats, a window with soft evening light.
No people, no text, no logos, vertical 2:3 composition.
```

### bg_student_council（生徒会室）
- **添付する見本：** `bg_classroom_day.webp`

```
Use the attached image only as an art-style reference: match its painting style, line work, color palette, lighting and level of detail exactly. Draw a different place.
Scene: a Japanese high school student council room, long desks pushed together, neat stacks of documents and folders, a whiteboard with schedules (no readable text), afternoon light.
No people, no text, no logos, vertical 2:3 composition.
```

### bg_newspaper_room（新聞部の部室）
- **添付する見本：** `bg_clubroom_day.webp`

```
Use the attached image only as an art-style reference: match its painting style, line work, color palette, lighting and level of detail exactly. Draw a different place.
Scene: a cramped Japanese high school newspaper club room, desks with laptops and printed school newspapers, a cork board covered with photos (no readable text), a camera on a desk.
No people, no text, no logos, vertical 2:3 composition.
```

### bg_summer_festival_night（夏祭り）
- **添付する見本：** `bg_street_sunset.webp`

```
Use the attached image only as an art-style reference: match its painting style, line work, color palette, lighting and level of detail exactly. Draw a different scene.
Scene: a Japanese summer festival at night on a small shopping street, rows of food stalls with glowing paper lanterns, a shooting gallery stall, fireworks blooming in the night sky.
No people, no text, no logos, vertical 2:3 composition.
```

### bg_street_winter_night（冬の帰り道）
- **添付する見本：** `bg_street_sunset.webp`

```
Use the attached image only as an art-style reference: match its painting style, line work, color palette, lighting and level of detail exactly. Draw a different scene.
Scene: the same kind of small Japanese shopping arcade street, but at night in late December, simple festive string lights, some shops with closed shutters, cold blue tones with warm light from the lamps.
No people, no text, no logos, vertical 2:3 composition.
```

### bg_stadium_stands（球場のバックネット裏）
- **添付する見本：** `bg_stadium_day.webp`

```
Use the attached image only as an art-style reference: match its painting style, line work, color palette, lighting and level of detail exactly. Draw a different view.
Scene: the seats behind home plate in a mid-sized Japanese baseball stadium during a spring high school tournament, mostly empty seats in the foreground, the green field visible beyond the backstop net, a few cherry blossom petals in the air.
No people, no text, no logos, vertical 2:3 composition.
```

### bg_clubroom_tv（部室のテレビ・ドラフト会議）
- **添付する見本：** `bg_clubroom_night.webp`

```
Use the attached image only as an art-style reference: match its painting style, line work, color palette, lighting and level of detail exactly. Draw a different view.
Scene: a Japanese high school baseball clubroom in the evening, an old TV on a shelf with a bright blank screen as the focal point, lockers, helmets and bats, sports bags on the floor.
No people, no text, no logos, vertical 2:3 composition.
```

---

## 背景（前回からまだの分：2枚）

### bg_stadium_road_night（球場からの帰り道・夜）
- **添付する見本：** `bg_prostadium_night.webp`

```
Use the attached image only as an art-style reference: match its painting style, line work, color palette, lighting and level of detail exactly. Draw a different scene.
Scene: a wide sidewalk leading away from a large professional baseball stadium at night after a championship game, the stadium lights glowing in the background, street lamps, a few scattered paper streamers on the ground, calm and quiet mood.
No people, no text, no logos, vertical 2:3 composition.
```

### bg_infirmary_day（保健室）
- **添付する見本：** `bg_classroom_day.webp`

```
Use the attached image only as an art-style reference: match its painting style, line work, color palette, lighting and level of detail exactly. Draw a different place.
Scene: a Japanese high school nurse's office in the daytime, a bed with white curtains, a medicine cabinet, a desk with a first-aid box, a height scale, soft sunlight through the window.
No people, no text, no logos, vertical 2:3 composition.
```
