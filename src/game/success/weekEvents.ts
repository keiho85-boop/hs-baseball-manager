// 選手育成モード：通常週のイベント（決まった行事・大会・合宿のない週に、約7割の確率で起きる）
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
        { label: '途中で帰る', result: '真壁先生は一人で教本を読み続けた。（変化なし）', ops: [] },
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
        { label: '部活があるので断る', result: '「そうか、練習が一番じゃ」（変化なし）', ops: [] },
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
