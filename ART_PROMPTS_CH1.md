# 第1章（サクセス版）で足りない背景・立ち絵のプロンプト

Gemini無料版で作り、加工（切り抜き・トリミング・webp化）はClaudeが行う流れを想定しています。
英語のプロンプトをそのまま貼り付けてください。

## 共通の絵柄

すべての画像の最後に、次の一文を付けます。

- 背景用
  `Detailed anime-style background art for a mobile game visual novel, rich lighting, vivid but natural colors, high detail, no people, no text, no logos, vertical 2:3 composition.`
- 立ち絵用
  `Detailed anime-style character art like a modern mobile gacha game, polished cel shading with soft gradients, intricate details, waist-up portrait facing slightly to the side, plain pure white background, no text, no logos.`

立ち絵は、同じ人物で表情違い（normal・smile・serious・surprise）の4枚を作ります。
2枚目以降は、1枚目の画像を添えて「Same character, same outfit, same hairstyle. Change only the facial expression to: smiling」のように頼むと、顔がぶれにくくなります。

---

## 背景（12枚）

ファイル名は `public/bg/` に置くときの名前です。絵ができるまでは、すでにある背景で代わりに表示しています。

| ファイル名 | 使う場面 | プロンプト |
|---|---|---|
| bg_track_field | 陸上部のエースの入部 | A Japanese high school athletics field in the afternoon, a shot put circle with white chalk lines in the foreground, a red running track and a school building behind, warm sunlight. |
| bg_sumo_room | 相撲部のエースの入部 | The inside of a small Japanese high school sumo club dojo, a clay dohyo ring with straw bales, wooden walls, a large cooking pot on a table to the side, soft daylight from high windows. |
| bg_soccer_field | サッカー部のエースの入部 | A Japanese high school soccer field after school, goal net on the left, chain-link fence with a few school bags hanging on it, golden afternoon light. |
| bg_tennis_court | テニス部のエースの入部 | A Japanese high school outdoor tennis court with green hard court surface, net in the middle, a bulletin board with paper notices near the fence, clear sky. |
| bg_gym_table_tennis | 卓球部のエースの入部 | A Japanese high school gymnasium with several table tennis tables set up, green tables and low dividers, bright overhead lights, wooden floor. |
| bg_shogi_room | 将棋部のエースの入部 | A quiet Japanese high school clubroom for shogi, a wooden shogi board with pieces mid-game on a low table, tatami mats, a window with evening light. |
| bg_student_council | 生徒会長（勧誘の部活） | A Japanese high school student council room, long desks pushed together, stacks of documents, a whiteboard with schedules (no readable text), afternoon light. |
| bg_newspaper_room | 2年目「取材」 | A cramped Japanese high school newspaper club room, desks with laptops and printed school newspapers, cork board with photos (no readable text), a camera on a desk. |
| bg_summer_festival_night | 2年目「夏祭り」 | A Japanese summer festival at night on a shopping street, rows of food stalls with glowing paper lanterns, a shooting gallery stall, fireworks in the sky. |
| bg_street_winter_night | 1年目「冬の帰り道」 | A small Japanese shopping arcade street at night in late December, simple festive string lights, closed shutters on some shops, light breath-fog atmosphere, cold blue tones with warm lights. |
| bg_stadium_stands | 3年目「春の大会のスカウト」 | The seats behind home plate in a mid-sized Japanese baseball stadium during a spring high school tournament, sparse spectators' seats, green field visible below, cherry blossom petals in the air. |
| bg_clubroom_tv | 3年目「ドラフト会議」 | A Japanese high school baseball clubroom in the evening, an old TV on a shelf showing a bright blank screen, lockers, helmets and bats, team members' bags on the floor. |

---

## 立ち絵（10人）

ファイル名の前半は `public/chara/` に置くときの名前です。後ろに `normal`・`smile`・`serious`・`surprise` を付けます（例：`iwaki_hs_track_bust_normal.webp`）。
絵ができるまでは、名前だけを表示しています。
固定キャラは全員、ナギたちと同学年の高校生（15〜17歳）です。体格や服装の説明だけにとどめ、体型を強調する表現は入れません。

| ファイル名の前半 | 人物 | プロンプト |
|---|---|---|
| iwaki_hs_track_bust_ | 岩城 剛（陸上部・砲丸投げのエース。のちの先発投手） | A tall, broad-shouldered Japanese high school boy, short spiky black hair, serious calm eyes, wearing a navy school track jacket over a white T-shirt, a towel around his neck. |
| shiomi_hs_sumo_bust_ | 塩見 豪太（相撲部のエース。パワーのある一塁手） | A big, round-faced, gentle Japanese high school boy with a short buzz cut, wearing a white school gym T-shirt, sleepy friendly expression, holding a rice bowl. |
| amou_hs_soccer_bust_ | 天羽 翔（サッカー部のエース。足の速い中堅手。女子に人気） | A handsome, slim Japanese high school boy with light brown wavy hair, bright confident smile, wearing a blue soccer practice jersey, a soccer ball under one arm. |
| kuon_hs_tennis_bust_ | 久遠 遼（テニス部のエース。ミートのうまい遊撃手） | A cool, composed Japanese high school boy with neat dark hair and sharp eyes, wearing a white tennis polo shirt, holding a tennis racket on his shoulder. |
| kobayakawa_hs_tabletennis_bust_ | 小早川 俊（卓球部のエース。反射神経の良い二塁手） | A small, quick-looking Japanese high school boy with messy short hair and sharp focused eyes, wearing a red table tennis uniform shirt, holding a paddle. |
| senju_hs_shogi_bust_ | 千手 静馬（将棋部のエース。1イニングだけの火消し役） | A pale, slender Japanese high school boy with glasses and neat black hair, calm intelligent expression, wearing a school blazer uniform, holding a shogi piece between his fingers. |
| shinonome_hs_council_bust_ | 東雲 学（生徒会長） | A neat, serious Japanese high school boy with short side-parted hair and rimless glasses, wearing a school blazer with an armband, holding a clipboard. |
| miki_hs_newspaper_bust_ | 三木 文太（新聞部） | A cheerful Japanese high school boy with slightly messy hair, wearing a school uniform with rolled-up sleeves, a camera hanging from his neck, holding a notebook and pen. |
| pro_scout_40s_bust_ | プロのスカウト | A Japanese man in his late 40s, a baseball cap pulled low, a dark windbreaker, a speed gun in one hand, friendly but sharp eyes, slight stubble. |
| hasumi_yukata_bust_（smile・teaseの2枚） | 蓮見しずく（養護教諭、大人の女性）の浴衣 | Use the attached image of the same woman. Same face and hairstyle, now wearing a modest navy summer yukata with a white flower pattern and a light obi, holding a paper fan, at a summer festival mood, smiling gently. |

---

## まだ絵がない人物（前回からの持ち越し）

| ファイル名の前半 | 人物 |
|---|---|
| mob_captain_practice_bust_ | 1年目の3年生の主将（帽子を深くかぶり、目が見えない） |
| grandpa_70s_hospital_bust_ | 病衣の祖父 |
| （背景）bg_stadium_road_night | 球場からの帰り道（夜） |
| （背景）bg_infirmary_day | 保健室 |
