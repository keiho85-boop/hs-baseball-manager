# 画像プロンプト（選手育成モード・第1章の追加分）

どれも「見本を1枚添付」して使います。見本の画像名は各項目に書いてあります。
①の育成選手と、③の大地のアイコンは受け取り済みです。残りは②③④⑤です。

---

## ① 育成選手の固定絵（パワプロ君にあたる「いつもの主人公」）

- **ファイル名の前半：** `focus_hs_practice_`
- **添付する見本：** `daichi_hs_practice_full_normal.webp`（画風だけ合わせる）
- **表情：** normal / smile / serious / surprise / frustrated / joy の6枚

1枚目（normal）：

```
Use the attached image only as an art-style reference: match its line art, coloring, shading, lighting, level of detail and proportions exactly. Do NOT copy the person in the reference; draw a completely different character.
Character: the standard hero of a high school baseball game, a Japanese first-year high school boy (age 15). Friendly, earnest and slightly plain so that any player can project themselves onto him: short neat black hair, clear brown eyes, average height and build. He wears a clean plain white baseball practice uniform with a navy undershirt, navy belt and a plain navy cap with no logo, no number, no letters. He holds a brown baseball glove under his left arm.
Full-body standing pose, facing slightly to the side, neutral expression, plain pure white background, no text, no logos.
```

2枚目以降は、1枚目を添付して次のように頼みます（表情の言葉だけ入れ替え）。

```
Use the attached image as the reference for BOTH the character and the art style: same boy, same face, same hair, same uniform, same pose and framing. Change only his facial expression to: [EXPRESSION].
Plain pure white background, no text, no logos.
```

| 表情 | [EXPRESSION] に入れる言葉 |
|---|---|
| smile | a warm, confident smile |
| serious | a determined, focused look with tight lips |
| surprise | wide eyes and a slightly open mouth, surprised |
| frustrated | gritted teeth and furrowed brows, frustrated after a loss |
| joy | a big open-mouthed grin, eyes squeezed shut with joy |

---

## ② タイトル画面の1枚絵（第1章）

- **タイトル：** 転生名将ナギ（略称：テンナギ）
- **ファイル名：** `title_ch1.webp`
- **サイズ：** 縦長 9:16（スマホの画面いっぱいに出すため）
- **添付する見本：** `REF_title_cast.png`（上段：ナギ・大地・育成選手、下段：各部のエース6人）
- タイトルの文字は絵に入れず、ゲーム側でロゴを重ねます（画像生成は漢字の文字が崩れやすいため）。
- 参考にいただいた他社タイトルの絵は、生成ツールに添付しないでください。構図の考え方だけを言葉で指定しています。

### 案A：みんなでこちらへ駆けてくる（勢い重視）

```
Use the attached reference sheet for the characters and the art style: keep every character's face, hair, skin tone and outfit exactly as shown, and match the line art and coloring.
Vertical 9:16 key visual for a high school baseball game. A low camera angle on bright green baseball outfield grass under a vivid blue summer sky with big white clouds. The whole cast runs straight toward the viewer with energy and big smiles, motion streaks and grass blades flying.
In the front center, the manager girl with the brown ponytail and red ribbon runs toward the camera, one hand reaching forward, holding her sticky-note notebook in the other, eyes shining. Just behind her on the left, the catcher boy with his cap on backwards runs with his catcher's mitt raised. On the right, the boy in the clean white practice uniform runs with a baseball in his hand and a determined face.
Behind them, smaller and layered toward the horizon, the other club aces run along: the big muscular boy in a navy track jacket, the round sumo boy in a white tank top and navy gym shorts, the soccer boy with a ball, the tennis boy with his racket, the red-haired table tennis boy, and the glasses boy in a black school uniform holding a shogi piece.
Leave the top fifth of the image as open sky for a title logo, and keep the bottom tenth as simple grass for a "tap to start" line.
No text, no letters, no numbers, no logos anywhere.
```

### 案B：主役3人を大きく重ねる（キャラ重視）

```
Use the attached reference sheet for the characters and the art style: keep the faces, hair, skin tones and outfits exactly as shown, and match the line art and coloring.
Vertical 9:16 key visual for a high school baseball game, a layered character collage. Bright stadium scene behind: a scoreboard, light towers, green trees and a blue sky with sunlight flares.
Large in the center, the boy in the clean white practice uniform swings a bat with full power, eyes fierce. Lower right, the catcher boy with his cap on backwards catches a ball in his mitt toward the viewer. Lower left in front, the manager girl with the brown ponytail hugs her sticky-note notebook and smiles at the viewer with a confident wink.
Upper left and upper right, smaller busts of the other club aces overlap the sky: the big boy in the navy track jacket, the tennis boy with his racket on his shoulder, the red-haired table tennis boy, the soccer boy, the round sumo boy in a white tank top, and the glasses boy holding a shogi piece.
Leave the top fifth for a title logo and the bottom tenth simple for a "tap to start" line.
No text, no letters, no numbers, no logos anywhere.
```

### 案C：大きな球場を見上げる後ろ姿（物語重視）

```
Use the attached reference sheet for the characters and the art style: keep the hair, skin tones and outfits exactly as shown, and match the line art and coloring.
Vertical 9:16 key visual for a high school baseball game. Seen from behind, a small line of students stands on a worn dirt infield at sunrise, looking up at a huge, shining baseball stadium floating far away above a sea of glowing clouds, their dream stage. The ground under their feet reflects the sky like a thin layer of water.
From left to right: the big boy in the navy track jacket, the soccer boy with a ball under his arm, the catcher boy with his cap on backwards and a mitt, the manager girl with the brown ponytail and red ribbon in the center, the boy in the clean white practice uniform holding a bat over his shoulder, the tennis boy with his racket, and the red-haired table tennis boy. The manager girl turns her face slightly back toward the viewer with a smile.
Leave the top fifth as sky for a title logo and the bottom tenth simple for a "tap to start" line.
No text, no letters, no numbers, no logos anywhere.
```

---

## ③ 名前の横に出す顔アイコン（デフォルメ）

立ち絵そのままではなく、小さくまとまったアニメ調のデフォルメ顔にします。

### 最初の1枚（大地）

- **ファイル名：** `icon_daichi.webp`
- **添付する見本：** `daichi_hs_practice_bust_smile.webp`

```
Make a chibi (super-deformed) face icon of the character in the attached image. Keep the same hair, eye color, skin tone, outfit colors and accessories.
Head and shoulders only, big round head, very simple cute anime style, thick clean dark outline, flat cel shading with one soft highlight, slight three-quarter turn, gentle smile. Centered with an even margin on a plain pure white background, square 1:1 image.
No text, no logos.
```

### 2枚目以降

人物ごとに、立ち絵（左）と大地のアイコン（右）を並べた見本 `REF_icon_〇〇.png` を用意しました。下の一覧の人物の見本を添付してください。プロンプトは共通です。

```
The attached sheet has two images. Use the LEFT image for the character: same hair, eye color, skin tone, outfit colors and accessories. Use the RIGHT image for the icon style only: match its chibi proportions, line weight, flat coloring, framing and margin exactly. Do not copy the right character.
Head and shoulders only, gentle smile, plain pure white background, square 1:1 image.
No text, no logos.
```

### 作るアイコンの一覧

| ファイル名 | 人物 | 添付する見本 |
|---|---|---|
| icon_focus | 育成選手 | REF_icon_focus.png |
| icon_mob | モブ選手（全員共通） | REF_icon_mob.png |
| icon_nagi | ナギ | REF_icon_nagi.png |
| icon_makabe | 真壁先生 | REF_icon_makabe.png |
| icon_hasumi | 蓮見先生 | REF_icon_hasumi.png |
| icon_genzo | 源造 | REF_icon_genzo.png |
| icon_scout | スカウト | REF_icon_scout.png |
| icon_iwaki | 岩城（陸上） | REF_icon_iwaki.png |
| icon_shiomi | 塩見（相撲） | REF_icon_shiomi.png |
| icon_amou | 天羽（サッカー） | REF_icon_amou.png |
| icon_kuon | 久遠（テニス） | REF_icon_kuon.png |
| icon_kobayakawa | 小早川（卓球） | REF_icon_kobayakawa.png |
| icon_senju | 千手（将棋） | REF_icon_senju.png |
| icon_shinonome | 東雲（生徒会長） | REF_icon_shinonome.png |
| icon_miki | 三木（新聞部） | REF_icon_miki.png |


---

## ④ 画面で使うアイコン（文字の代わり）

- **ファイル名：** `ui_icons_sheet.png`（受け取ったら、こちらで1つずつ切り出します）
- **添付する見本：** `REF_ui_style.png`（いまのホーム画面。色味を合わせるため）
- 画面では、アイコンの絵の下に短い文字（「勧誘」など）を添えて表示します。文字はゲーム側で付けるので、絵には文字を入れません。

```
Use the attached screenshot only as a color and mood reference: match its bright sky blue, grass green, sunny yellow and red, and its glossy casual mobile game look.
A sprite sheet of 16 game UI icons arranged in a 4 by 4 grid on a plain pure white background. Each icon sits centered in an equal square cell with a generous margin. No grid lines, no text, no letters, no numbers.
Style: chunky, rounded casual mobile game icons with a bold dark navy outline, bright saturated flat colors and one soft glossy highlight on top. All icons share the same size, outline weight and lighting.
Icons, left to right, top to bottom:
1 a megaphone, 2 a baseball with two crossed bats, 3 a clipboard with a small pennant, 4 a rolled newspaper,
5 a gold star badge with a small heart, 6 a gold trophy, 7 a small coin pouch, 8 a dumbbell,
9 a first-aid box, 10 a tear-off calendar page, 11 a lightning bolt, 12 a flame,
13 a gear, 14 a play button, 15 a fast-forward button, 16 a checkered finish flag.
```

| 番号 | 絵の下に添える文字 |
|---|---|
| 1 | 勧誘 |
| 2 | 練習試合 |
| 3 | 部の様子（設備・部費・オーダーもここ） |
| 4 | 出来事 |
| 5 | 評価（タップで7人の評価を開く） |
| 6 | 大会・組み合わせ |
| 7 | 部費 |
| 8 | 設備 |
| 9 | ケガ・保健室 |
| 10 | 週・日付 |
| 11 | 体力 |
| 12 | やる気 |
| 13 | 設定 |
| 14 | 試合：自動 |
| 15 | 試合：早送り |
| 16 | 試合：結果へ |

---

## ⑤ エンディング用の1枚絵（任意・華やかにするため）

添付する見本：`REF_trio.png`（ナギ・大地・育成選手を並べた見本）

### ドラフト指名（通常エンディング）

- **ファイル名：** `ev_c1_draft.webp`　横長 1536×1024

```
Use the attached reference sheet for the characters and the art style: keep the same faces, hair and outfits.
A joyful celebration on a high school baseball ground on a bright autumn afternoon. The teammates in practice uniforms toss the boy in the clean white practice uniform high into the air in celebration. The catcher boy laughs as he throws him up, and the manager girl in her school blazer stands in front with tears of joy, clapping. Paper confetti and a few caps fly in the air, warm sunlight, wide shot.
No text, no letters, no numbers, no logos.
```

### 卒業式・告白成功（特別エンディング）

- **ファイル名：** `ev_c1_confess.webp`　横長 1536×1024

```
Use the attached reference sheet for the characters and the art style: keep the same faces and hair.
Graduation day at a Japanese high school gate in full cherry blossom. The catcher boy, now in a neat school uniform with a graduation corsage, shyly holds out a baseball toward the manager girl, also in her school uniform with a corsage and a graduation certificate tube. She covers her mouth with one hand, surprised and happy, cheeks lightly flushed. Petals drift in soft spring light. A wholesome, heartwarming moment, both fully and modestly dressed.
No text, no letters, no numbers, no logos.
```
