// 選手育成モード：通常週のイベント（決まった行事・大会・合宿のない週に、約7割の確率で起きる）。11月19日に40種へ
// ・日常や人間関係の小さな出来事。よく起きるものほど重みが大きい
// ・同じイベントは1年に2回まで
// ・イベントマス（狙って踏む）の出来事とは別のもの

import type { Rng } from '../rng'
import { ABILITY_LABEL, eid, mainKeys } from '../events'
import type { EffectOp, EventInstance, Player, SaveData } from '../types'
import { focusPlayer, successOf } from './state'

/** 通常週にイベントが起きる確率 */
export const WEEK_EVENT_RATE = 0.7
/** 同じイベントが1年に起きる回数の上限 */
const PER_YEAR = 2
/** 同じ通常週イベントは、前に起きてからこの週数のあいだは起きない */
const GAP_WEEKS = 12

const NAGI = { kind: 'manager', name: 'ナギ', portrait: 'nagi' } as const
const DAICHI = { kind: 'coach', name: '日向大地', portrait: 'daichi' } as const
const GENZO = { kind: 'local', name: '日向源造（商店会長）', portrait: 'genzo' } as const
const HASUMI = { kind: 'coach', name: '蓮見先生（養護教諭）', portrait: 'hasumi' } as const
const MAKABE = { kind: 'coach', name: '真壁先生', portrait: 'makabe' } as const
const MIKI = { kind: 'local', name: '三木（新聞部）', portrait: 'miki' } as const
const NARR = { kind: 'narration', name: '' } as const

function ev(key: string, delta: number): EffectOp {
  return { op: 'eval', key, delta }
}
function stamina(p: Player | 'all', delta: number): EffectOp {
  return { op: 'condition', playerId: p === 'all' ? 'all' : p.id, key: 'stamina', delta }
}
function grow(p: Player, key: string, delta: number): EffectOp {
  return { op: 'ability', playerId: p.id, key, delta: key === 'pitching.velocity' ? Math.max(1, Math.round(delta / 2)) : delta }
}

interface WeekEvent {
  id: string
  /** 起きやすさ（よく起きる10・ときどき6・たまに3） */
  weight: number
  make: (f: Player, rng: Rng) => EventInstance
}

type SimpleChoice = [label: string, result: string, ops: EffectOp[]]
type Sp = typeof NARR | typeof NAGI | typeof DAICHI | typeof GENZO | typeof HASUMI | typeof MAKABE | typeof MIKI
/** 2択の短いイベントを作る */
function simple(id: string, weight: number, title: string, speaker: Sp, bg: string, cast: { char: string; face?: string }[], lines: string[], choices: (f: Player, rng: Rng) => SimpleChoice[]): WeekEvent {
  return {
    id,
    weight,
    make: (f, rng) => ({
      id: eid(id),
      title,
      speaker: { ...speaker },
      relatedPlayerIds: [f.id],
      bg,
      cast,
      lines,
      choices: choices(f, rng).map(([label, result, ops]) => ({ label, result, ops })),
    }),
  }
}

const EVENTS: WeekEvent[] = [
  // ---- よく起きる
  {
    id: 'souji',
    weight: 10,
    make: (f) => ({
      id: eid('souji'),
      title: '部室の掃除当番',
      speaker: { ...NARR },
      relatedPlayerIds: [f.id],
      bg: 'bg_clubroom_day',
      cast: [{ char: 'focus', face: 'normal' }],
      lines: ['部室の掃除当番が回ってきた。床には泥と、誰かの汗くさいタオル。', `${f.surname}の手には、ほうきが1本。`],
      choices: [
        { label: 'ピカピカにする', result: '見違えるほどきれいになった。（体力が少し減った。チームメイトの評価が上がった）', ops: [stamina(f, -5), ev('team', 3)] },
        {
          label: 'さっと済ませて練習へ',
          result: `${f.surname}は自主練に向かった。（${ABILITY_LABEL[f.mainPosition === 'P' ? 'pitching.control' : 'batting.contact']}が少し上がった。チームメイトの評価が少し下がった）`,
          ops: [grow(f, f.mainPosition === 'P' ? 'pitching.control' : 'batting.contact', 1), ev('team', -1)],
        },
      ],
    }),
  },
  {
    id: 'mikan',
    weight: 10,
    make: (f) => ({
      id: eid('mikan'),
      title: '差し入れのみかん',
      speaker: { ...NAGI },
      relatedPlayerIds: [f.id],
      bg: 'bg_clubroom_day',
      cast: [{ char: 'nagi', face: 'smile' }, { char: 'daichi', face: 'smile' }],
      lines: [`${f.surname}くん、みかんどうぞ。…あ、最後の1個です。`],
      choices: [
        { label: '半分こする', result: 'ナギは少しだけ笑った。（ナギの評価が上がった）', ops: [ev('nagi', 3)] },
        { label: '大地に譲る', result: '「お、悪いな」大地は一口で食べた。（大地の評価が上がった）', ops: [ev('daichi', 3)] },
      ],
    }),
  },
  {
    id: 'hirune',
    weight: 10,
    make: (f) => ({
      id: eid('hirune'),
      title: '昼休みの昼寝',
      speaker: { ...NARR },
      relatedPlayerIds: [f.id],
      bg: 'bg_classroom_day',
      cast: [{ char: 'focus', face: 'normal' }],
      lines: ['昼休み。日だまりの窓際で、まぶたが重くなってきた。', '…午後の授業まで、あと20分。'],
      choices: [
        { label: '少しだけ眠る', result: `${f.surname}は、チャイムの音で目を覚ました。（体力が回復した）`, ops: [stamina(f, 20)] },
        {
          label: f.mainPosition === 'P' ? 'シャドーピッチングをする' : '素振りをする',
          result: `${f.surname}は、昼休みも体を動かした。（${ABILITY_LABEL[f.mainPosition === 'P' ? 'pitching.control' : 'batting.contact']}が少し上がった。体力が少し減った）`,
          ops: [grow(f, f.mainPosition === 'P' ? 'pitching.control' : 'batting.contact', 1), stamina(f, -5)],
        },
      ],
    }),
  },
  {
    id: 'kenka',
    weight: 10,
    make: (f) => ({
      id: eid('kenka'),
      title: 'ベンチの口げんか',
      speaker: { ...NARR },
      relatedPlayerIds: [f.id],
      bg: 'bg_ground_day',
      cast: [{ char: 'daichi', face: 'serious' }],
      lines: ['練習中、守備の連係ミスで、二人の部員が言い合いを始めた。'],
      choices: [
        { label: `${f.surname}が間に入る`, result: `${f.surname}のひとことで、二人は笑って握手した。（チームメイトの評価が上がった）`, ops: [ev('team', 4)] },
        { label: '大地に任せる', result: '大地の大きな声で、場はすぐに収まった。（大地の評価が上がった）', ops: [ev('daichi', 2), ev('team', 1)] },
      ],
    }),
  },
  {
    id: 'ame',
    weight: 10,
    make: (f) => ({
      id: eid('ame'),
      title: '雨の日の室内練習',
      speaker: { ...NAGI },
      relatedPlayerIds: [f.id],
      bg: 'bg_gym_table_tennis',
      cast: [{ char: 'nagi', face: 'normal' }],
      lines: ['今日は雨なので、体育館の隅を借りました。', '体幹を鍛えるか、ビデオでフォームを見直すか。どちらにしますか？'],
      choices: [
        { label: '体幹トレーニング', result: `床に汗の水たまりができた。（${ABILITY_LABEL['common.durability']}が少し上がった。体力が減った）`, ops: [grow(f, 'common.durability', 2), stamina(f, -8)] },
        { label: 'フォームを見直す', result: 'ナギの解説つきで、自分のくせがよく分かった。（ナギの評価が上がった。体力が少し回復した）', ops: [ev('nagi', 3), stamina(f, 5)] },
      ],
    }),
  },
  {
    id: 'kaerimichi',
    weight: 10,
    make: (f) => ({
      id: eid('kaerimichi'),
      title: '大地との帰り道',
      speaker: { ...DAICHI },
      relatedPlayerIds: [f.id],
      bg: 'bg_street_sunset',
      cast: [{ char: 'daichi', face: 'smile' }],
      lines: [`なあ${f.surname}、腹減らねえ？　肉まん、半分ずつ食おうぜ`],
      choices: [
        { label: '寄り道する', result: '湯気の立つ肉まんを、二人で分けた。（大地の評価が上がった。体力が少し回復した）', ops: [ev('daichi', 3), stamina(f, 5)] },
        { label: 'まっすぐ帰って寝る', result: '「付き合い悪いなー」大地は笑って手を振った。（体力が回復した）', ops: [stamina(f, 12)] },
      ],
    }),
  },
  {
    id: 'pan',
    weight: 10,
    make: (f) => ({
      id: eid('pan'),
      title: '購買のパン争奪戦',
      speaker: { ...NARR },
      relatedPlayerIds: [f.id],
      bg: 'bg_classroom_day',
      cast: [{ char: 'focus', face: 'surprise' }, { char: 'daichi', face: 'smile' }],
      lines: ['4時間目の終わりのチャイム。購買の焼きそばパンは、毎日10個だけ。', '大地が、もう廊下を走り出している。'],
      choices: [
        { label: '全力で追いかける', result: `廊下の角で大地を抜き去った！（${ABILITY_LABEL['running.speed']}が少し上がった）`, ops: [grow(f, 'running.speed', 1)] },
        { label: '大地に任せる', result: '大地が二つ買ってきてくれた。（大地とチームメイトの評価が上がった）', ops: [ev('daichi', 2), ev('team', 1)] },
      ],
    }),
  },
  // ---- ときどき
  {
    id: 'kenshin',
    weight: 6,
    make: (f) => ({
      id: eid('kenshin'),
      title: '健康診断',
      speaker: { ...HASUMI },
      relatedPlayerIds: [f.id],
      bg: 'bg_infirmary_day',
      cast: [{ char: 'hasumi', face: 'smile' }],
      lines: ['はい、深呼吸して。…うん、心臓の音はとっても元気。', `${f.surname}くん、睡眠はちゃんととってる？`],
      choices: [
        { label: '正直に「寝不足です」と言う', result: '「正直でよろしい。今日は早く寝なさい」（体力が回復した。蓮見の評価が上がった）', ops: [stamina(f, 15), ev('hasumi', 3)] },
        { label: '「ばっちりです」と強がる', result: '「…目の下、くまができてるわよ？」（蓮見の評価が少し下がった）', ops: [ev('hasumi', -2)] },
      ],
    }),
  },
  {
    id: 'rule',
    weight: 6,
    make: (f) => ({
      id: eid('rule'),
      title: '真壁先生のルール勉強会',
      speaker: { ...MAKABE },
      bg: 'bg_clubroom_night',
      cast: [{ char: 'makabe', face: 'serious' }],
      lines: ['朝比奈さんに宿題を出されてね。インフィールドフライ、今日こそ理解したいんだ'],
      choices: [
        { label: '最後まで付き合う', result: '夜の9時。真壁先生はついにインフィールドフライを理解した。（真壁の評価が大きく上がった。体力が減った）', ops: [ev('makabe', 5), stamina(f, -8)] },
        { label: '途中で帰る', result: '真壁先生は一人で教本を読み続けた。（体力が少し回復した。真壁の評価が少し上がった）', ops: [stamina(f, 5), ev('makabe', 1)] },
      ],
    }),
  },
  {
    id: 'glove',
    weight: 6,
    make: (f) => ({
      id: eid('wasuremono'),
      title: '忘れ物のグラブ',
      speaker: { ...NAGI },
      relatedPlayerIds: [f.id],
      bg: 'bg_ground_sunset',
      cast: [{ char: 'nagi', face: 'angry' }],
      lines: [`${f.surname}くん。ベンチに、グラブが置きっぱなしでしたよ。`, '道具を大事にしない選手は、道具にも大事にされません。'],
      choices: [
        { label: 'その場で手入れする', result: `グラブにオイルを塗り込んだ。手に吸い付くようになった。（${ABILITY_LABEL['fielding.catching']}が少し上がった。ナギの評価が上がった）`, ops: [grow(f, 'fielding.catching', 1), ev('nagi', 2)] },
        { label: '「明日やります」', result: 'ナギは黙ってグラブを差し出した。（ナギの評価が少し下がった）', ops: [ev('nagi', -1)] },
      ],
    }),
  },
  {
    id: 'drink',
    weight: 6,
    make: () => ({
      id: eid('drink'),
      title: '真壁先生の差し入れ',
      speaker: { ...MAKABE },
      bg: 'bg_clubroom_day',
      cast: [{ char: 'makabe', face: 'smile' }],
      lines: ['みんな、スポーツドリンクを買ってきたよ！　…自分のお小遣いだから、内緒でね'],
      choices: [{ label: 'ありがたくいただく', result: '冷えたドリンクが、体にしみた。（全員の体力が回復した。真壁の評価が上がった）', ops: [stamina('all', 8), ev('makabe', 2)] }],
    }),
  },
  {
    id: 'shonen',
    weight: 6,
    make: (f) => ({
      id: eid('shonen'),
      title: '少年野球の子',
      speaker: { ...NARR },
      relatedPlayerIds: [f.id],
      bg: 'bg_street_sunset',
      cast: [{ char: 'focus', face: 'smile' }],
      lines: ['河川敷の帰り道。少年野球の子が、ボールを抱えて駆け寄ってきた。', '「お兄ちゃん、七海東の野球部でしょ！　キャッチボールして！」'],
      choices: [
        { label: '日が暮れるまで付き合う', result: '子どもたちの笑い声で、野球を始めたころの気持ちを思い出した。（調子が上がった。体力が少し減った）', ops: [{ op: 'condition', playerId: f.id, key: 'form', delta: 1 }, stamina(f, -5)] },
        { label: '帽子にサインを書いてあげる', result: '「すげー！　プロになったら自慢する！」（評判が少し上がった）', ops: [{ op: 'school', key: 'reputation', delta: 1 }] },
      ],
    }),
  },
  {
    id: 'batcen',
    weight: 6,
    make: (f, rng) => {
      const key = rng.pick(mainKeys(f))
      return {
        id: eid('batcen'),
        title: '夜のバッティングセンター',
        speaker: { ...DAICHI },
        relatedPlayerIds: [f.id],
        bg: 'bg_stadium_road_night',
        cast: [{ char: 'daichi', face: 'smile' }],
        lines: ['駅前のバッティングセンター、最速150キロのレーンができたんだってよ。', '行こうぜ。負けたほうがジュースな'],
        choices: [
          { label: '付き合う', result: `閉店まで、二人でボールを追いかけた。（${ABILITY_LABEL[key] ?? '能力'}が少し上がった。体力が減った。大地の評価が上がった）`, ops: [grow(f, key, 1), stamina(f, -8), ev('daichi', 2)] },
          { label: '今日は休む', result: '「じゃあ、また今度な」（体力が回復した）', ops: [stamina(f, 10)] },
        ],
      }
    },
  },
  // ---- たまに
  {
    id: 'sento',
    weight: 3,
    make: (f) => ({
      id: eid('sento'),
      title: '銭湯の招待券',
      speaker: { ...GENZO },
      relatedPlayerIds: [f.id],
      bg: 'bg_liquor_day',
      cast: [{ char: 'genzo', face: 'smile' }],
      lines: ['おう、商店街の福引で、銭湯の招待券が当たってな。わしは毎日入っとるから、お前らにやる！', '風呂上がりのコーヒー牛乳もつけてやるぞ。わっはっは！'],
      choices: [
        { label: '部員みんなで行く', result: '大きな湯船で、部員たちの疲れが溶けていった。（全員の体力が回復した。チームメイトの評価が上がった）', ops: [stamina('all', 15), ev('team', 2)] },
        { label: `${f.surname}がゆっくり浸かる`, result: `${f.surname}は、のぼせる寸前まで湯船に浸かった。（体力が大きく回復した。源造の評価が上がった）`, ops: [stamina(f, 30), ev('genzo', 2)] },
      ],
    }),
  },
  {
    id: 'kiji',
    weight: 3,
    make: (f) => ({
      id: eid('kiji'),
      title: '地元紙の小さな記事',
      speaker: { ...MIKI },
      relatedPlayerIds: [f.id],
      bg: 'bg_newspaper_room',
      cast: [{ char: 'miki', face: 'smile' }],
      lines: [`見て見て！　地元の新聞に、${f.surname}くんのことが載ってるよ。小さいけど、写真つき！`],
      choices: [{ label: '照れながら読む', result: '「七海東に注目の新星」——スカウトの目にも留まったらしい。（スカウトの評価が上がった。評判が少し上がった）', ops: [ev('scout', 3), { op: 'school', key: 'reputation', delta: 1 }] }],
    }),
  },
  {
    id: 'misaban',
    weight: 3,
    make: (f) => ({
      id: eid('misaban'),
      title: '源造の店番',
      speaker: { ...GENZO },
      relatedPlayerIds: [f.id],
      bg: 'bg_liquor_day',
      cast: [{ char: 'genzo', face: 'normal' }],
      lines: ['すまん、今日は寄り合いでな。一時間だけ、店番を頼めんか？', 'バイト代は出す。部費に回せばええ'],
      choices: [
        { label: '引き受ける', result: 'ビールケースを運び、近所のおばちゃんの話し相手もした。（部費が5万円増えた。源造の評価が上がった。体力が少し減った）', ops: [{ op: 'school', key: 'funds', delta: 5 }, ev('genzo', 4), stamina(f, -5)] },
        { label: '部活があるので断る', result: '「そうか、練習が一番じゃ」（調子が上がった）', ops: [{ op: 'condition', playerId: f.id, key: 'motivation', delta: 4 }] },
      ],
    }),
  },
  {
    id: 'kengaku',
    weight: 3,
    make: (f) => ({
      id: eid('kengaku'),
      title: '中学の後輩の見学',
      speaker: { ...NARR },
      relatedPlayerIds: [f.id],
      bg: 'bg_ground_day',
      cast: [{ char: 'focus', face: 'smile' }],
      lines: [`中学の野球部の後輩が、練習を見学に来た。`, `「${f.surname}先輩のいる高校に行きたくて…」`],
      choices: [
        { label: '丁寧に案内する', result: '後輩は目を輝かせて帰っていった。（評判が上がった。チームメイトの評価が上がった）', ops: [{ op: 'school', key: 'reputation', delta: 2 }, ev('team', 2)] },
        { label: '練習で背中を見せる', result: '後輩の視線を感じて、いつもより力が入った。（調子が上がった）', ops: [{ op: 'condition', playerId: f.id, key: 'form', delta: 1 }] },
      ],
    }),
  },

  // ---- 11月19日に追加（40種に）
  simple('gakushoku', 10, '学食の大盛り', NARR, 'bg_classroom_day', [{ char: 'focus', face: 'smile' }], ['学食のおばちゃんが「野球部？ 大盛りにしとくよ」と、ご飯を山のように盛ってくれた。'], (f) => [
    ['全部食べる', 'お腹いっぱいで、午後の練習も元気に動けた。（体力が回復した）', [stamina(f, 15)]],
    ['大地と半分に分ける', '大地「お、助かる！」（体力が少し回復した。大地の評価が上がった）', [stamina(f, 6), ev('daichi', 2)]],
  ]),
  simple('test', 10, 'テスト前の放課後', MAKABE, 'bg_classroom_day', [{ char: 'makabe', face: 'troubled' }], ['もうすぐ定期テスト。真壁先生が「赤点を取ったら、練習に出られないよ」と、こっそり教えてくれた。'], (f) => [
    ['今日は勉強する', '真壁先生が、苦手なところを見てくれた。（真壁の評価が上がった。体力が回復した）', [ev('makabe', 3), stamina(f, 8)]],
    ['練習のあとに勉強する', `${f.surname}は眠い目をこすって机に向かった。（${ABILITY_LABEL[mainKeys(f)[0]!]}が少し上がった。体力が減った）`, [grow(f, mainKeys(f)[0]!, 1), stamina(f, -8)]],
  ]),
  simple('seibi', 10, 'グラウンド整備', NARR, 'bg_ground_sunset', [{ char: 'focus', face: 'normal' }], ['練習のあと。グラウンドには、スパイクの跡がいっぱいだ。'], (f) => [
    ['最後まで丁寧にならす', '明日の朝、グラウンドはきれいに整っていた。（体力が少し減った。チームメイトの評価が上がった）', [stamina(f, -5), ev('team', 3)]],
    ['大地と競争でならす', '「俺のほうが速かっただろ！」（大地の評価が上がった。体力が少し減った）', [ev('daichi', 2), stamina(f, -4)]],
  ]),
  simple('yudachi', 10, '夕立', NARR, 'bg_street_sunset', [{ char: 'focus', face: 'surprise' }], ['帰り道、急に空が暗くなり、大粒の雨が降ってきた。'], (f) => [
    ['走って帰る', `ずぶぬれになったが、足腰はしっかり使えた。（${ABILITY_LABEL['common.durability']}が少し上がった。体力が少し減った）`, [grow(f, 'common.durability', 1), stamina(f, -5)]],
    ['軒先で雨宿りする', '雨が上がるまで、ぼんやり空を見ていた。（体力が少し回復した）', [stamina(f, 6)]],
  ]),
  simple('kouhai', 6, '後輩の相談', NARR, 'bg_ground_day', [{ char: 'mob_cap', face: 'normal' }], ['練習のあと、部員の一人が「バットの握り方を見てほしい」と声をかけてきた。'], (f) => [
    ['付きっきりで教える', '教えているうちに、自分の振りも見直せた。（チームメイトの評価が上がった。体力が少し減った）', [ev('team', 3), stamina(f, -4)]],
    ['自分で考えさせる', '「…やってみます」（チームメイトの評価が少し上がった。調子が上がった）', [ev('team', 1), { op: 'condition', playerId: f.id, key: 'motivation', delta: 3 }]],
  ]),
  simple('neko', 6, 'グラウンドの猫', NARR, 'bg_ground_day', [{ char: 'nagi', face: 'smile' }], ['一塁ベースの上で、白い猫が丸くなっている。ナギがそっと近づいた。'], (f) => [
    ['みんなで名前を考える', '名前は「ベース」に決まった。（チームメイトの評価が上がった）', [ev('team', 2)]],
    ['ナギにそっと任せる', 'ナギ「…この子、肩がいいですね」なぜか猫と見つめ合っている。（ナギの評価が上がった。調子が上がった）', [ev('nagi', 2), { op: 'condition', playerId: f.id, key: 'motivation', delta: 2 }]],
  ]),
  simple('video', 6, 'プロの試合の映像', NAGI, 'bg_clubroom_tv', [{ char: 'nagi', face: 'normal' }], ['部室のテレビで、プロ野球の試合の録画を流しています。', '…この選手の構え、よく見てください。'], (f) => {
    const k = f.mainPosition === 'P' ? 'pitching.control' : 'batting.eye'
    return [
      ['ナギの解説つきで見る', `ナギの話は、試合より長かった。（${ABILITY_LABEL[k]}が少し上がった。ナギの評価が上がった）`, [grow(f, k, 1), ev('nagi', 2)]],
      ['一人で何度も見返す', `同じ場面を、二十回は見返した。（${ABILITY_LABEL[k]}が少し上がった。体力が少し減った）`, [grow(f, k, 1), stamina(f, -3)]],
    ]
  }),
  simple('fukubiki', 6, '商店街の福引', GENZO, 'bg_liquor_day', [{ char: 'genzo', face: 'smile' }], ['おう、福引券が一枚余っとる。運だめしに引いていけ！'], (f, rng) => {
    const win = rng.chance(0.3)
    return [
      ['引いてみる', win ? '金色の玉が出た！ 商品券は部費に回した。（部費が3万円増えた）' : '白い玉。ポケットティッシュをもらった。（調子が少し上がった）', win ? [{ op: 'school', key: 'funds', delta: 3 }] : [{ op: 'condition', playerId: f.id, key: 'motivation', delta: 2 }]],
      ['源造に引いてもらう', '「わしは運がないんじゃ…」やっぱり白い玉だった。（源造の評価が上がった）', [ev('genzo', 2)]],
    ]
  }),
  simple('hokencha', 6, '保健室のお茶', HASUMI, 'bg_infirmary_day', [{ char: 'hasumi', face: 'smile' }], ['あら、顔色が少し悪いわね。温かいお茶でも飲んでいきなさい。'], (f) => [
    ['少し休んでいく', 'お茶を飲むと、体の芯から温まった。（体力が回復した。蓮見の評価が上がった）', [stamina(f, 10), ev('hasumi', 2)]],
    ['お礼を言って練習へ', '「ふふ、無理はしないこと」（調子が上がった。蓮見の評価が少し上がった）', [{ op: 'condition', playerId: f.id, key: 'motivation', delta: 3 }, ev('hasumi', 1)]],
  ]),
  simple('uwasa', 6, 'スカウトのうわさ', NARR, 'bg_classroom_day', [{ char: 'focus', face: 'surprise' }], ['「今週、プロのスカウトが練習を見に来るらしいぞ」教室でそんなうわさが流れている。'], (f) => [
    ['いつも通りにやる', '結局、スカウトは来なかった。でも、いい練習ができた。（調子が上がった）', [{ op: 'condition', playerId: f.id, key: 'motivation', delta: 3 }]],
    ['張り切って練習する', '実は一人だけ、遠くから見ていたらしい。（スカウトの評価が上がった。体力が減った）', [ev('scout', 2), stamina(f, -8)]],
  ]),
  simple('senbon', 6, '素振り千本', DAICHI, 'bg_ground_sunset', [{ char: 'daichi', face: 'serious' }], ['なあ、今日だけ素振り千本やってみないか。…昔、少年野球の監督に言われてたやつ。'], (f) => {
    const k = f.mainPosition === 'P' ? 'pitching.stamina' : 'batting.power'
    return [
      ['千本やり切る', `手の皮がむけたが、やり切った。（${ABILITY_LABEL[k]}が少し上がった。体力が大きく減った。大地の評価が上がった）`, [grow(f, k, 1), stamina(f, -12), ev('daichi', 2)]],
      ['三百本でやめる', '「…まあ、無理は禁物だよな」（調子が上がった。体力が少し減った）', [{ op: 'condition', playerId: f.id, key: 'motivation', delta: 2 }, stamina(f, -4)]],
    ]
  }),
  simple('denwa', 6, '家からの電話', NARR, 'bg_street_winter_night', [{ char: 'focus', face: 'smile' }], ['夜、家族から電話がかかってきた。「ちゃんと食べてる？ 試合はいつ？」'], (f) => [
    ['ゆっくり話す', '電話を切ると、なんだか肩が軽くなった。（調子が上がった）', [{ op: 'condition', playerId: f.id, key: 'motivation', delta: 4 }]],
    ['短く切って早く寝る', 'ぐっすり眠れた。（体力が回復した）', [stamina(f, 10)]],
  ]),
  simple('manga', 6, '部室の野球漫画', NARR, 'bg_clubroom_day', [{ char: 'daichi', face: 'smile' }], ['部室の棚に、誰かが持ってきた野球漫画の全巻がそろっている。'], (f) => [
    ['一気に読む', '最終巻で、少しだけ泣いた。（体力が回復した。調子が上がった）', [stamina(f, 6), { op: 'condition', playerId: f.id, key: 'motivation', delta: 2 }]],
    ['必殺技を大地と真似する', '二人とも、見事に空振りした。（大地の評価が上がった。体力が少し減った）', [ev('daichi', 2), stamina(f, -3)]],
  ]),
  simple('asajog', 6, '朝のジョギング', NARR, 'bg_riverside_field_day', [{ char: 'focus', face: 'normal' }], ['いつもより早く目が覚めた。窓の外は、まだ薄暗い。'], (f) => {
    const k = f.mainPosition === 'P' ? 'pitching.stamina' : 'running.speed'
    return [
      ['河川敷を走る', `朝の空気が気持ちよかった。（${ABILITY_LABEL[k]}が少し上がった。体力が少し減った）`, [grow(f, k, 1), stamina(f, -5)]],
      ['二度寝する', '気がつくと、遅刻ぎりぎりだった。（体力が回復した）', [stamina(f, 10)]],
    ]
  }),
  simple('score', 6, 'スコアブックの整理', NAGI, 'bg_clubroom_night', [{ char: 'nagi', face: 'normal' }], ['部室に残って、ナギがスコアブックを整理しています。', '…一人でも大丈夫です。慣れていますから。'], (f) => [
    ['手伝う', 'ナギは、少しだけうれしそうだった。（ナギの評価が上がった。体力が少し減った）', [ev('nagi', 3), stamina(f, -4)]],
    ['差し入れを置いて帰る', 'ナギ「…ありがとうございます」（ナギの評価が少し上がった。体力が少し回復した）', [ev('nagi', 1), stamina(f, 5)]],
  ]),
  simple('obvisit', 3, 'OBの訪問', MAKABE, 'bg_ground_day', [{ char: 'makabe', face: 'smile' }], ['今日は、昔この野球部にいたOBの方が来てくれたよ。練習を見てもらえるって！'], (f, rng) => {
    const k = rng.pick(mainKeys(f))
    return [
      ['練習を見てもらう', `細かいところまで、丁寧に教えてもらった。（${ABILITY_LABEL[k] ?? '能力'}が少し上がった。体力が少し減った）`, [grow(f, k, 1), stamina(f, -5)]],
      ['昔の話を聞く', '部員が三人しかいなかった時代の話だった。（チームメイトの評価が上がった。調子が上がった）', [ev('team', 2), { op: 'condition', playerId: f.id, key: 'motivation', delta: 2 }]],
    ]
  }),
  simple('volunteer', 3, '球場の清掃ボランティア', MAKABE, 'bg_stadium_day', [{ char: 'makabe', face: 'normal' }], ['県営球場の清掃ボランティアの募集が来ているんだけど…野球部で行ってみる？'], (f) => [
    ['部員みんなで参加する', '新聞の地域面に、小さく載った。（評判が上がった。全員の体力が少し減った）', [{ op: 'school', key: 'reputation', delta: 2 }, stamina('all', -4)]],
    ['練習を優先する', '真壁先生「そうだよね、練習が大事だよね」（調子が上がった）', [{ op: 'condition', playerId: f.id, key: 'motivation', delta: 3 }]],
  ]),
  simple('kabeate', 3, '公園の壁当て', NARR, 'bg_riverside_field_day', [{ char: 'focus', face: 'normal' }], ['休みの日。近所の公園に、ちょうどいいコンクリートの壁がある。'], (f) => {
    const k = f.mainPosition === 'P' ? 'pitching.control' : 'fielding.catching'
    return [
      ['日が暮れるまで壁当てする', `跳ね返る球を、ひたすら捕り続けた。（${ABILITY_LABEL[k]}が少し上がった。体力が少し減った）`, [grow(f, k, 1), stamina(f, -5)]],
      ['ベンチで昼寝する', '子どもの声を聞きながら、うとうとした。（体力が回復した）', [stamina(f, 10)]],
    ]
  }),
  simple('kaidashi', 3, '道具の買い出し', MAKABE, 'bg_sports_shop', [{ char: 'makabe', face: 'troubled' }], ['ボールとロジンを買いに行くんだけど…どれがいいのか、全然分からなくて。ついてきてくれる？'], (f) => [
    ['一緒に選ぶ', '真壁先生は、店員さんより熱心にメモを取った。（真壁の評価が上がった。体力が少し減った）', [ev('makabe', 3), stamina(f, -3)]],
    ['部員に選んでもらう', '部員たちが、あれこれ言い合いながら選んだ。（チームメイトの評価が上がった）', [ev('team', 2)]],
  ]),
  simple('yakyuban', 3, '野球盤', DAICHI, 'bg_clubroom_day', [{ char: 'daichi', face: 'smile' }], ['見ろよ、倉庫から古い野球盤が出てきた！ 一回勝負しようぜ'], (f) => [
    ['本気で勝負する', '九回裏、消える魔球で大地が勝った。（大地の評価が上がった）', [ev('daichi', 2)]],
    ['ナギを呼んでくる', 'ナギの采配の前に、大地は一点も取れなかった。（ナギの評価が上がった。大地の評価が少し上がった）', [ev('nagi', 2), ev('daichi', 1)]],
  ]),
  simple('spike', 3, 'スパイクのひも', NARR, 'bg_ground_day', [{ char: 'focus', face: 'frustrated' }], ['走り込みの途中で、スパイクのひもが、ぷつりと切れた。'], (f) => [
    ['予備のひもに替える', '新しいひもで、足元が引き締まった。（調子が上がった）', [{ op: 'condition', playerId: f.id, key: 'motivation', delta: 3 }]],
    ['結び直して走り続ける', `少し走りにくかったが、最後まで走り切った。（${ABILITY_LABEL[f.mainPosition === 'P' ? 'pitching.stamina' : 'running.speed']}が少し上がった。体力が少し減った）`, [grow(f, f.mainPosition === 'P' ? 'pitching.stamina' : 'running.speed', 1), stamina(f, -5)]],
  ]),
  simple('radio', 3, '夜のラジオ中継', NARR, 'bg_nagi_room_hs_night', [{ char: 'focus', face: 'normal' }], ['夜。ラジオから、プロ野球の延長戦の中継が流れてくる。'], (f) => [
    ['最後まで聞く', 'サヨナラ勝ちで、思わず声が出た。（調子が上がった。体力が少し減った）', [{ op: 'condition', playerId: f.id, key: 'motivation', delta: 4 }, stamina(f, -4)]],
    ['途中で寝る', '翌朝、結果は新聞で知った。（体力が回復した）', [stamina(f, 10)]],
  ]),
  simple('kasa', 3, '忘れた傘', DAICHI, 'bg_school_gate_sakura', [{ char: 'daichi', face: 'frustrated' }], ['下校時刻。昇降口で、大地が空を見上げて立ち尽くしている。「…傘、忘れた」'], (f) => [
    ['傘に入れてやる', '二人で一本の傘は、さすがに狭かった。（大地の評価が上がった）', [ev('daichi', 3)]],
    ['一緒に走って帰る', '日向酒店に着くころには、二人ともずぶぬれだった。（体力が少し減った。調子が上がった）', [stamina(f, -4), { op: 'condition', playerId: f.id, key: 'motivation', delta: 3 }]],
  ]),
]

/** 通常週のイベントを1つ選ぶ（同じものは1年に2回まで） */
export function weekEvent(save: SaveData, rng: Rng): EventInstance | null {
  const s = successOf(save)
  const f = focusPlayer(save)
  if (!s || !f || s.ended) return null
  const flags = save.story!.flags
  const y = save.calendar.year
  const count = (id: string): number => Number(flags[`wev_${y}_${id}`] ?? 0)
  const now = (y - 1) * 52 + save.calendar.week
  const last = (id: string): number => Number(flags[`wev_last_${id}`] ?? -999)
  const pool = EVENTS.filter((e) => count(e.id) < PER_YEAR && now - last(e.id) >= GAP_WEEKS)
  if (pool.length === 0) return null
  const pick = rng.weighted(pool.map((e) => ({ value: e, weight: e.weight })))
  flags[`wev_${y}_${pick.id}`] = count(pick.id) + 1
  flags[`wev_last_${pick.id}`] = now
  return pick.make(f, rng)
}
