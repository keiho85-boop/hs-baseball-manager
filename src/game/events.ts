// イベント：マスに止まったときや、季節の節目に起きる出来事
// 結果は作る時点で決めておく（乱数を先に使うので、やり直しても同じ結果になる）

import { Rng, clamp } from './rng'
import { POSITION_NAME } from './constants'
import { defaultPracticeMenu, fullName } from './player'
import { computeOverall, generateGrade, schoolStrength } from './world'
import { SKILLS, conflicts } from './skills'
import type { EffectOp, EventInstance, Player, Position, SaveData, SquareType } from './types'
import { addEval, successOf } from './success/state'
import type { EvalKey } from './success/types'
import { attachEvent, attachedAt, successRandomEvent, withFocusEval } from './success/board'

export const ABILITY_LABEL: Record<string, string> = {
  'batting.contact': 'ミート',
  'batting.power': 'パワー',
  'batting.eye': '選球眼',
  'running.speed': '走力',
  'fielding.arm': '肩力',
  'fielding.range': '守備範囲',
  'pitching.velocity': '球速',
  'pitching.control': 'コントロール',
  'pitching.stamina': 'スタミナ',
  'pitching.kire': 'キレ',
}

export function mainKeys(p: Player): string[] {
  return p.mainPosition === 'P'
    ? ['pitching.velocity', 'pitching.control', 'pitching.stamina', 'pitching.kire']
    : ['batting.contact', 'batting.power', 'running.speed', 'fielding.range', 'fielding.arm']
}

export function learnable(rng: Rng, p: Player): string | null {
  const isPitcher = p.mainPosition === 'P'
  const options = SKILLS.filter(
    (s) => s.good && !p.skills.includes(s.id) && (s.target === 'all' || (s.target === 'pitcher') === isPitcher) && !p.skills.some((o) => conflicts(o, s.id)),
  )
  return options.length ? rng.pick(options).id : null
}

export function skillName(id: string): string {
  return SKILLS.find((s) => s.id === id)?.name ?? ''
}

export function players(save: SaveData): Player[] {
  const school = save.schools[save.playerSchoolId]!
  return school.playerIds.map((id) => save.players[id]).filter((p): p is Player => !!p && !p.retired && !p.helper)
}

/** ストーリーありのゲームか */
export function story(save: SaveData): boolean {
  return !!save.story?.enabled
}

/** ストーリーありのときの話し手（顔を丸い枠に出す） */
const NAGI = { kind: 'manager', name: 'ナギ', portrait: 'nagi' } as const
/** 合宿の浜辺のナギ（浜辺の練習着の絵ができるまでは制服の絵） */
const NAGI_BEACH = { kind: 'manager', name: 'ナギ', portrait: 'nagi_beach' } as const
/** 養護教諭・蓮見しずく */
const HASUMI = { kind: 'coach', name: '蓮見先生（養護教諭）', portrait: 'hasumi' } as const
const HASUMI_BEACH = { kind: 'coach', name: '蓮見先生（養護教諭）', portrait: 'hasumi_beach' } as const
const GENZO_LOCAL = { kind: 'local', name: '日向源造（商店会長）', portrait: 'genzo' } as const
const GENZO_OB = { kind: 'ob', name: '日向源造（OB会長）', portrait: 'genzo' } as const

let seq = 0
export const eid = (name: string) => `${name}-${Date.now().toString(36)}-${seq++}`

// ---------------------------------------------------------------- 各イベント

function managerEvent(save: SaveData, rng: Rng): EventInstance {
  const st = story(save)
  const roll = rng.next()
  if (roll < 0.4) {
    return {
      id: eid('snack'),
      title: 'マネージャーの差し入れ',
      speaker: st ? { ...NAGI } : { kind: 'manager', name: 'マネージャー' },
      lines: st
        ? ['みなさん、お疲れさまです！', 'おにぎりとスポーツドリンク、用意しておきました。しっかり食べて、また頑張りましょう！']
        : ['みんな、お疲れさま！', '今日はおにぎりとスポーツドリンクを用意したよ。しっかり食べて、また頑張ろうね！'],
      choices: [
        {
          label: 'ありがたくいただこう',
          result: '部員たちは元気を取り戻した！（全員の体力とやる気が上がった）',
          ops: [
            { op: 'condition', playerId: 'all', key: 'stamina', delta: 12 },
            { op: 'condition', playerId: 'all', key: 'motivation', delta: 5 },
          ],
        },
      ],
    }
  }
  const list = players(save)
  if (roll < 0.72) return massageEvent(save, rng, list)
  const p = rng.pick(list)
  return {
    id: eid('note'),
    title: 'マネージャーのノート',
    speaker: st ? { ...NAGI } : { kind: 'manager', name: 'マネージャー' },
    relatedPlayerIds: [p.id],
    lines: st
      ? [`${p.surname}くんのフォーム、毎日記録してみたんです。`, 'いいときと悪いときの違いが、少し見えてきました。']
      : [`監督、${p.surname}くんのフォームを毎日記録してみたんです。`, '最近いい時と悪い時の違いが、少し分かってきました。'],
    choices: [
      {
        label: `${p.surname}に伝えてあげよう`,
        result: `${p.surname}は感激して、調子を上げた！`,
        ops: [
          { op: 'condition', playerId: p.id, key: 'form', delta: 1 },
          { op: 'condition', playerId: p.id, key: 'motivation', delta: 10 },
        ],
      },
      {
        label: 'チーム全体で共有しよう',
        result: '部員たちの意識が少し高まった。',
        ops: [{ op: 'condition', playerId: 'all', key: 'motivation', delta: 4 }],
      },
    ],
  }
}

/** マネージャーのマッサージ：疲れた選手の体をほぐす。まれにケガをしにくくなったり、弾道が上がったりする */
function massageEvent(save: SaveData, rng: Rng, list: Player[]): EventInstance {
  const st = story(save)
  const tired = [...list].sort((a, b) => a.condition.stamina - b.condition.stamina)
  const p = tired[rng.int(0, Math.min(2, tired.length - 1))] ?? rng.pick(list)
  const ops: EffectOp[] = [
    { op: 'condition', playerId: p.id, key: 'stamina', delta: 25 },
    { op: 'condition', playerId: p.id, key: 'motivation', delta: 5 },
  ]
  let extra = ''
  const r = rng.next()
  if (r < 0.1) {
    ops.push({ op: 'ability', playerId: p.id, key: 'common.durability', delta: 6 })
    extra = '体の使い方がよくなり、ケガをしにくくなった！'
  } else if (r < 0.16 && p.batting.trajectory < 4) {
    ops.push({ op: 'ability', playerId: p.id, key: 'batting.trajectory', delta: 1 })
    extra = '体のキレが増し、弾道が上がった！'
  }
  return {
    id: eid('massage'),
    title: 'マネージャーのマッサージ',
    speaker: st ? { ...NAGI } : { kind: 'manager', name: 'マネージャー' },
    relatedPlayerIds: [p.id],
    lines: st
      ? [`${p.surname}くん、肩も脚もがちがちですね。`, '少し時間をください。ストレッチとマッサージで、しっかりほぐしておきます。']
      : [`監督、${p.surname}くんの体がかなり張っているみたいです。`, 'ストレッチとマッサージで、しっかりほぐしておきますね。'],
    choices: [
      {
        label: 'しっかりケアしてもらおう',
        result: `${p.surname}の疲れが取れた！${extra}`,
        ops,
      },
      {
        label: 'みんなにもやり方を教えてあげて',
        result: '部員たちがお互いの体をほぐし合った。（全員の体力が少し回復した）',
        ops: [{ op: 'condition', playerId: 'all', key: 'stamina', delta: 6 }],
      },
    ],
  }
}

function fundsEvent(save: SaveData, rng: Rng): EventInstance {
  const school = save.schools[save.playerSchoolId]!
  if (school.kind === 'public' && rng.chance(0.5)) {
    const amount = rng.int(15, 30)
    return {
      id: eid('local'),
      title: '地元の応援',
      speaker: story(save) ? { ...GENZO_LOCAL } : { kind: 'local', name: '商店街の会長' },
      lines: story(save)
        ? ['おう、マネージャー！　商店街のみんなで少しずつ集めたんだ。', '全国を目指すんだろう？　遠慮せずに使ってくれ！']
        : ['いつも頑張ってるねえ。町のみんなで少しずつ集めたんだ。', '全国を目指して頑張っておくれよ！'],
      choices: [
        {
          label: 'ありがとうございます！',
          result: `部費が${amount}万円増え、部員たちのやる気も上がった！`,
          ops: [
            { op: 'school', key: 'funds', delta: amount },
            { op: 'condition', playerId: 'all', key: 'motivation', delta: 5 },
          ],
        },
      ],
    }
  }
  const amount = rng.int(30, 60)
  return {
    id: eid('ob'),
    title: 'OB会からの寄付',
    speaker: story(save) ? { ...GENZO_OB } : { kind: 'ob', name: 'OB会長' },
    lines: story(save)
      ? ['OB会で、少しばかり集まってな。', '後輩たちのために使ってやってくれ。…勝てよ！']
      : ['監督、OB会で少しばかり集まりましてな。', '後輩たちのために使ってやってください。'],
    choices: [
      {
        label: 'ありがたく受け取る',
        result: `部費が${amount}万円増えた。`,
        ops: [{ op: 'school', key: 'funds', delta: amount }],
      },
      {
        label: '選手たちに直接お礼を言わせる',
        result: `部費が${amount - 10}万円増え、OB会の評判も上がった。`,
        ops: [
          { op: 'school', key: 'funds', delta: amount - 10 },
          { op: 'school', key: 'reputation', delta: 1 },
        ],
      },
    ],
  }
}

function schoolEvent(save: SaveData, rng: Rng): EventInstance {
  void save
  void rng
  return {
    id: eid('school'),
    title: '校内行事',
    speaker: { kind: 'principal', name: '校長先生' },
    lines: ['今週は学校の行事があるので、部活動はお休みです。', '野球部の皆さんの活躍、先生方も楽しみにしていますよ。'],
    choices: [
      {
        label: '行事も全力で楽しもう',
        result: '部員たちは気分転換できた。（体力とやる気が少し回復）',
        ops: [{ op: 'condition', playerId: 'all', key: 'motivation', delta: 4 }],
      },
    ],
  }
}

function slumpEvent(rng: Rng, list: Player[]): EventInstance {
  const low = list.filter((p) => p.condition.form <= 2)
  const p = low.length ? rng.pick(low) : rng.pick(list)
  const skill = rng.chance(0.25) ? learnable(rng, p) : null
  const ops: EffectOp[] = [
    { op: 'condition', playerId: p.id, key: 'form', delta: 2 },
    { op: 'condition', playerId: p.id, key: 'stamina', delta: -15 },
  ]
  if (skill) ops.push({ op: 'skill', playerId: p.id, add: skill })
  return {
    id: eid('slump'),
    title: 'スランプ',
    speaker: { kind: 'player', playerId: p.id },
    relatedPlayerIds: [p.id],
    lines: ['監督……最近、何をやってもうまくいかないんです。', '自分のどこが悪いのか、分からなくなってしまって。'],
    choices: [
      {
        label: 'つきっきりで特訓しよう',
        result: `${p.surname}は特訓でコツをつかみ、調子を取り戻した！${skill ? `さらに特殊能力「${skillName(skill)}」を身につけた！` : ''}`,
        ops,
      },
      {
        label: '少し野球から離れてみよう',
        result: `${p.surname}は気分転換して、少し前向きになった。`,
        ops: [
          { op: 'condition', playerId: p.id, key: 'form', delta: 1 },
          { op: 'condition', playerId: p.id, key: 'motivation', delta: 12 },
          { op: 'condition', playerId: p.id, key: 'stamina', delta: 15 },
        ],
      },
    ],
  }
}

function awakeningEvent(rng: Rng, list: Player[]): EventInstance {
  const sorted = [...list].sort((a, b) => b.hidden.potential - a.hidden.potential)
  const p = rng.chance(0.7) ? sorted[rng.int(0, Math.min(4, sorted.length - 1))]! : rng.pick(list)
  const keys = rng.shuffle(mainKeys(p)).slice(0, 2)
  const ops: EffectOp[] = keys.map((key) => ({ op: 'ability', playerId: p.id, key, delta: key === 'pitching.velocity' ? rng.int(2, 4) : rng.int(3, 5) }))
  const text = keys.map((k) => ABILITY_LABEL[k]).join('と')
  return {
    id: eid('awake'),
    title: '覚醒の予感',
    speaker: { kind: 'player', playerId: p.id },
    relatedPlayerIds: [p.id],
    lines: ['監督、今日の練習で……何かがつかめた気がします！', '体が勝手に動くというか、ボールがよく見えるんです！'],
    choices: [{ label: 'その感覚を忘れるな！', result: `${p.surname}の${text}が大きく伸びた！`, ops }],
  }
}

function rivalEvent(rng: Rng, list: Player[]): EventInstance | null {
  const byPos = new Map<Position, Player[]>()
  for (const p of list) byPos.set(p.mainPosition, [...(byPos.get(p.mainPosition) ?? []), p])
  const pairs = [...byPos.values()].filter((v) => v.length >= 2)
  if (pairs.length === 0) return null
  const [a, b] = rng.shuffle([...rng.pick(pairs)]).slice(0, 2) as [Player, Player]
  const key = mainKeys(a)[0]!
  return {
    id: eid('rival'),
    title: 'ライバル',
    speaker: { kind: 'player', playerId: a.id },
    relatedPlayerIds: [a.id, b.id],
    lines: [`${b.surname}には負けたくないんです。`, `${POSITION_NAME[a.mainPosition]}のレギュラーは、オレが取ります！`],
    choices: [
      {
        label: '競わせてみよう',
        result: `${a.surname}と${b.surname}は火花を散らして練習し、2人とも伸びた！ただ、${b.surname}は少し落ち込んでいる。`,
        ops: [
          { op: 'ability', playerId: a.id, key, delta: 2 },
          { op: 'ability', playerId: b.id, key, delta: 2 },
          { op: 'condition', playerId: b.id, key: 'motivation', delta: -10 },
        ],
      },
      {
        label: 'お互いを認め合え',
        result: `${a.surname}と${b.surname}は良きライバルになった。（2人のやる気が上がった）`,
        ops: [
          { op: 'condition', playerId: a.id, key: 'motivation', delta: 10 },
          { op: 'condition', playerId: b.id, key: 'motivation', delta: 10 },
        ],
      },
    ],
  }
}

function convertEvent(rng: Rng, list: Player[]): EventInstance | null {
  // ストーリーの主要人物（日向大地）は転向の対象にしない
  const toPitcher = list.filter((p) => !p.storyCast && p.mainPosition !== 'P' && !p.pitchingRetired && p.fielding.arm >= 45)
  const toField = list.filter((p) => !p.storyCast && p.mainPosition === 'P' && p.batting.contact + p.batting.power >= 80)
  const pool = [...toPitcher.map((p) => ({ p, pos: 'P' as Position })), ...toField.map((p) => ({ p, pos: rng.pick(['1B', 'LF', 'RF', 'CF'] as Position[]) }))]
  if (pool.length === 0) return null
  const { p, pos } = rng.pick(pool)
  return {
    id: eid('convert'),
    title: '転向の相談',
    speaker: { kind: 'player', playerId: p.id },
    relatedPlayerIds: [p.id],
    lines: [
      pos === 'P' ? '監督、オレ……ピッチャーをやってみたいんです！' : `監督、打撃で勝負したいんです。${POSITION_NAME[pos]}をやらせてください！`,
      '中途半端な気持ちじゃありません。お願いします！',
    ],
    choices: [
      {
        label: 'やってみろ！',
        result: `${p.surname}は${POSITION_NAME[pos]}に転向した。練習メニューも切り替えた。`,
        ops: [
          { op: 'position', playerId: p.id, position: pos },
          { op: 'condition', playerId: p.id, key: 'motivation', delta: 15 },
        ],
      },
      {
        label: '今のポジションで頑張ってほしい',
        result: `${p.surname}は少し残念そうだ…`,
        ops: [{ op: 'condition', playerId: p.id, key: 'motivation', delta: -10 }],
      },
    ],
  }
}

function secretPracticeEvent(rng: Rng, list: Player[]): EventInstance {
  const p = rng.pick(list)
  const key = rng.pick(mainKeys(p))
  // 努力を認めて頑張らせると、まれに特殊能力を身につける
  const skill = rng.chance(0.1) ? learnable(rng, p) : null
  const praiseOps: EffectOp[] = [
    { op: 'ability', playerId: p.id, key, delta: 2 },
    { op: 'condition', playerId: p.id, key: 'motivation', delta: 10 },
    { op: 'condition', playerId: p.id, key: 'stamina', delta: -10 },
  ]
  if (skill) praiseOps.push({ op: 'skill', playerId: p.id, add: skill })
  return {
    id: eid('secret'),
    title: '居残り練習',
    speaker: { kind: 'narration', name: '' },
    relatedPlayerIds: [p.id],
    lines: [`夜のグラウンドに、${p.surname}の姿があった。`, '誰もいなくなった後も、黙々とバットを振り、ボールを追っている。'],
    choices: [
      {
        label: 'その努力を褒める',
        result: `${p.surname}の${ABILITY_LABEL[key]}が伸び、やる気も上がった！${skill ? `さらに特殊能力「${skillName(skill)}」を身につけた！` : ''}`,
        ops: praiseOps,
      },
      {
        label: '体を休めるよう伝える',
        result: `${p.surname}はしっかり休んで、体力が回復した。`,
        ops: [{ op: 'condition', playerId: p.id, key: 'stamina', delta: 15 }],
      },
    ],
  }
}

function painEvent(rng: Rng, list: Player[]): EventInstance {
  const cand = list.filter((x) => !x.storyCast)
  const pool = cand.length ? cand : list
  const tired = [...pool].sort((a, b) => a.condition.stamina - b.condition.stamina)
  const p = tired[0] ?? rng.pick(pool)
  const getsHurt = !p.storyCast && rng.chance(0.35)
  return {
    id: eid('pain'),
    title: '体の違和感',
    speaker: { kind: 'player', playerId: p.id },
    relatedPlayerIds: [p.id],
    lines: ['監督……実は昨日から、少し足に張りがあって。', 'でも、大丈夫です！練習、続けさせてください！'],
    choices: [
      {
        label: '大事をとって休ませる',
        result: `${p.surname}はしっかり休み、体力が回復した。`,
        ops: [
          { op: 'condition', playerId: p.id, key: 'stamina', delta: 30 },
          { op: 'condition', playerId: p.id, key: 'motivation', delta: -3 },
        ],
      },
      {
        label: '本人の意思を尊重する',
        result: getsHurt ? `${p.surname}は練習中に足を痛めてしまった…（全治2週）` : `${p.surname}は気合いで練習をやりきった！`,
        ops: getsHurt
          ? [{ op: 'condition', playerId: p.id, key: 'stamina', delta: -5 }, { op: 'ability', playerId: p.id, key: '__injury', delta: 2 }]
          : [
              { op: 'condition', playerId: p.id, key: 'motivation', delta: 8 },
              { op: 'ability', playerId: p.id, key: mainKeys(p)[0]!, delta: 1 },
            ],
      },
    ],
  }
}

/** 部員同士のけんか */
function quarrelEvent(save: SaveData, rng: Rng, list: Player[]): EventInstance | null {
  if (list.length < 2) return null
  const [a, b] = rng.shuffle([...list]).slice(0, 2) as [Player, Player]
  const makeUp = rng.chance(0.5)
  return {
    id: eid('quarrel'),
    title: '部員同士のけんか',
    speaker: story(save) ? { ...NAGI } : { kind: 'narration', name: '' },
    relatedPlayerIds: [a.id, b.id],
    lines: story(save)
      ? [`${a.surname}くんと${b.surname}くんが、練習中に言い合いになってしまって…。`, 'どうしましょう。'] 
      : [`練習中、${a.surname}と${b.surname}が言い合いになった。`, '周りの部員たちも、手を止めて見ている。'],
    choices: [
      {
        label: '二人で話をさせる',
        result: `${a.surname}と${b.surname}は、とことん話し合った。（二人のやる気が上がった）`,
        ops: [
          { op: 'condition', playerId: a.id, key: 'motivation', delta: 5 },
          { op: 'condition', playerId: b.id, key: 'motivation', delta: 5 },
        ],
      },
      {
        label: '放っておく',
        result: makeUp ? '翌日には、二人とも何事もなかったように練習していた。' : `二人の間に、気まずい空気が残っている…（${a.surname}と${b.surname}のやる気が下がった）`,
        ops: makeUp
          ? []
          : [
              { op: 'condition', playerId: a.id, key: 'motivation', delta: -5 },
              { op: 'condition', playerId: b.id, key: 'motivation', delta: -5 },
            ],
      },
    ],
  }
}

function teamMeetingEvent(rng: Rng, list: Player[]): EventInstance {
  const seniors = list.filter((p) => p.grade >= 2)
  const p = seniors.length ? rng.pick(seniors) : rng.pick(list)
  return {
    id: eid('meeting'),
    title: 'ミーティング',
    speaker: { kind: 'player', playerId: p.id },
    relatedPlayerIds: [p.id],
    lines: ['監督、部員だけでミーティングをさせてもらえませんか。', 'もっと一つになれると思うんです。'],
    choices: [
      {
        label: '任せた！',
        result: 'チームの雰囲気が良くなった！（全員のやる気が上がった）',
        ops: [{ op: 'condition', playerId: 'all', key: 'motivation', delta: 7 }],
      },
      {
        label: '監督も参加しよう',
        result: '監督の考えがチームに伝わった。（全員の調子が少し上向いた）',
        ops: [
          { op: 'condition', playerId: 'all', key: 'motivation', delta: 3 },
          { op: 'condition', playerId: p.id, key: 'form', delta: 1 },
        ],
      },
    ],
  }
}

// ---------------------------------------------------------------- 合宿（ストーリーあり）

/** 合宿：蓮見先生の見回り（水着にパーカー姿で浜辺に来る）。体力の回復か、泳ぎで足腰を鍛えるか */
function nurseBeachEvent(rng: Rng, list: Player[]): EventInstance {
  const swimmers = rng.shuffle([...list]).slice(0, 4)
  const swimOps: EffectOp[] = [{ op: 'condition', playerId: 'all', key: 'stamina', delta: -5 }]
  for (const p of swimmers) {
    swimOps.push({ op: 'ability', playerId: p.id, key: p.mainPosition === 'P' ? 'pitching.stamina' : 'running.speed', delta: 2 })
  }
  const names = swimmers.map((p) => p.surname).join('・')
  return {
    id: eid('nurse-beach'),
    title: '合宿：浜辺の保健の先生',
    speaker: { ...HASUMI_BEACH },
    relatedPlayerIds: swimmers.map((p) => p.id),
    lines: [
      'はーい、野球部のみなさん。日焼け止めはちゃんと塗った？　熱中症になったら、先生の出番よ。',
      '真壁先生も、その真っ白なお腹。明日は真っ赤になっても知らないわよ？',
    ],
    choices: [
      {
        label: 'みんなに水分補給と日陰の休憩を',
        result: '蓮見先生の指示で、部員たちはしっかり体を休めた。（全員の体力が回復した）',
        ops: [{ op: 'condition', playerId: 'all', key: 'stamina', delta: 15 }],
      },
      {
        label: '遠泳で足腰を鍛えよう',
        result: `${names}は、沖のブイまで何度も泳いだ。（走力や投手のスタミナが上がった）`,
        ops: swimOps,
      },
    ],
  }
}

/** 合宿の合間の海水浴：浜辺を走り回って足腰が鍛えられる（走力・投手のスタミナ・ケガのしにくさ）。ランダムで弾道も上がる */
function beachEvent(rng: Rng, list: Player[]): EventInstance {
  const ops: EffectOp[] = [
    { op: 'condition', playerId: 'all', key: 'motivation', delta: 8 },
    { op: 'condition', playerId: 'all', key: 'stamina', delta: -6 },
  ]
  for (const p of list) {
    if (rng.chance(0.6)) ops.push({ op: 'ability', playerId: p.id, key: 'running.speed', delta: 1 })
    if (p.mainPosition === 'P') ops.push({ op: 'ability', playerId: p.id, key: 'pitching.stamina', delta: rng.int(2, 3) })
    else if (rng.chance(0.4)) ops.push({ op: 'ability', playerId: p.id, key: 'common.durability', delta: 2 })
  }
  const batters = rng.shuffle(list.filter((p) => p.mainPosition !== 'P' && p.batting.trajectory < 4))
  const lucky = batters.filter(() => rng.chance(0.3)).slice(0, 2)
  for (const p of lucky) ops.push({ op: 'ability', playerId: p.id, key: 'batting.trajectory', delta: 1 })
  const names = lucky.map((p) => p.surname).join('と')
  return {
    id: eid('beach'),
    title: '合宿：海水浴',
    speaker: { ...NAGI_BEACH },
    relatedPlayerIds: lucky.map((p) => p.id),
    lines: ['今日の午後は練習をお休みして、みんなで海水浴です！', '砂浜を走り回るだけでも、足腰はしっかり鍛えられるんですよ。'],
    choices: [
      {
        label: 'みんなで思いきり遊ぼう',
        result: `部員たちは日が暮れるまで、浜辺を駆け回った。（走力や、投手のスタミナが上がった。全員のやる気も上がった）${names ? `${names}はビーチフラッグで踏ん張るうちに体の使い方をつかみ、弾道が上がった！` : ''}`,
        ops,
      },
      {
        label: '今日は体を休めるのを優先しよう',
        result: '部員たちは波の音を聞きながら、のんびり過ごした。（体力とやる気が回復した）',
        ops: [
          { op: 'condition', playerId: 'all', key: 'stamina', delta: 10 },
          { op: 'condition', playerId: 'all', key: 'motivation', delta: 4 },
        ],
      },
    ],
  }
}

/** まれに：同じ浜で合宿・海水浴をしていた龍ヶ峰学園と、遊びの延長でビーチバレー対決。勝っても負けても能力が上がる */
function beachVolleyEvent(save: SaveData, rng: Rng, list: Player[]): EventInstance {
  const own = save.schools[save.playerSchoolId]!
  const win = rng.chance(0.45)
  const picked = rng.shuffle([...list]).slice(0, 4)
  const ops: EffectOp[] = []
  for (const p of picked) {
    const keys = rng.shuffle(mainKeys(p)).slice(0, 2)
    for (const key of keys) ops.push({ op: 'ability', playerId: p.id, key, delta: key === 'pitching.velocity' ? rng.int(1, 2) : win ? rng.int(3, 4) : rng.int(2, 3) })
  }
  ops.push({ op: 'condition', playerId: 'all', key: 'motivation', delta: win ? 12 : 6 })
  ops.push({ op: 'condition', playerId: 'all', key: 'stamina', delta: -8 })
  const names = picked.map((p) => p.surname).join('・')
  return {
    id: eid('volley'),
    title: '合宿：浜辺の対決',
    speaker: { kind: 'coach', name: '白鳥レイカ', portrait: 'reika_beach' },
    relatedPlayerIds: picked.map((p) => p.id),
    lines: [
      `あら、${own.name}も合宿？　奇遇ね。うちも、この浜で合宿中なの。今日は午後から海水浴よ。`,
      'せっかくだから遊びましょうか。ビーチバレーで勝負。負けたほうが、今夜の宿舎の掃除よ。',
    ],
    choices: [
      {
        label: '受けて立ちます！',
        result: win
          ? `激戦の末、${own.name}が勝った！　レイカは悔しそうに砂を払っている。（${names}の能力が上がり、全員のやる気が大きく上がった）`
          : `あと一歩で${own.name}が負けた。掃除はこちらの担当に……。それでも、王者の動きから学ぶことは多かった。（${names}の能力が上がった）`,
        ops,
      },
      {
        label: '今日は練習がありますので',
        result: 'レイカは「つまらないわね」と言って去っていった。',
        ops: [{ op: 'condition', playerId: 'all', key: 'stamina', delta: 4 }],
      },
    ],
  }
}

/** まれに：保健室の蓮見先生が、選手の体を整えてくれる。大きく伸びるが、ごくまれに力が入りすぎる */
function nurseEvent(rng: Rng, list: Player[]): EventInstance {
  const p = rng.pick(list)
  const keys = rng.shuffle(mainKeys(p)).slice(0, 2)
  const fail = rng.chance(0.12)
  const ops: EffectOp[] = fail
    ? [
        { op: 'condition', playerId: p.id, key: 'stamina', delta: -25 },
        { op: 'ability', playerId: p.id, key: keys[0]!, delta: -2 },
      ]
    : [
        ...keys.map((key) => ({ op: 'ability' as const, playerId: p.id, key, delta: key === 'pitching.velocity' ? rng.int(2, 3) : rng.int(4, 6) })),
        { op: 'condition', playerId: p.id, key: 'stamina', delta: 10 },
      ]
  // うまくいったときは、半分の確率で特殊能力も目を覚ます
  const skill = !fail && rng.chance(0.5) ? learnable(rng, p) : null
  if (skill) ops.push({ op: 'skill', playerId: p.id, add: skill })
  const text = keys.map((k) => ABILITY_LABEL[k]).join('と')
  return {
    id: eid('nurse'),
    title: '保健室の蓮見先生',
    speaker: { ...HASUMI },
    relatedPlayerIds: [p.id],
    lines: [`${p.surname}くん、ちょっと保健室にいらっしゃい。体のゆがみ、前から気になってたの。`, '少し整えてあげる。…ちょっとだけ、痛いわよ？'],
    choices: [
      {
        label: 'お願いします',
        result: fail
          ? `「あら…ちょっと力が入りすぎちゃったかしら」${p.surname}はしばらく動けなかった。（体力と${ABILITY_LABEL[keys[0]!]}が少し下がった）`
          : `${p.surname}の体が、驚くほど軽くなった！（${text}が大きく伸びた）${skill ? `さらに特殊能力「${skillName(skill)}」を身につけた！` : ''}`,
        ops,
      },
      {
        label: 'また今度にします',
        result: '「ふふ、いつでもどうぞ」蓮見先生は笑って見送った。',
        ops: [],
      },
    ],
  }
}

/** 止まったマスに応じてイベントを作る（イベントがなければ null）。position は止まったマスの番号（サクセスの人物イベントに使う） */
export function buildEvent(save: SaveData, rng: Rng, square: SquareType, position?: number): EventInstance | null {
  const list = players(save)
  if (list.length === 0) return null
  // サクセス：練習マスに人物が付いていれば、その人物のイベント
  if (successOf(save)) {
    const person = position !== undefined ? attachedAt(save, position) : null
    if (person) return attachEvent(save, rng, person)
    if (square === 'event' && !((save.sugoroku?.campWeeks ?? 0) > 0) && rng.chance(0.45)) return successRandomEvent(save, rng)
    if (square === 'event') return withFocusEval(save, buildEventBase(save, rng, square, list))
  }
  return buildEventBase(save, rng, square, list)
}

function buildEventBase(save: SaveData, rng: Rng, square: SquareType, list: Player[]): EventInstance | null {
  if (square === 'manager') return managerEvent(save, rng)
  if (square === 'funds') return fundsEvent(save, rng)
  if (square === 'school') return schoolEvent(save, rng)
  if (square !== 'event') return null
  // ストーリーありの合宿中は、合宿ならではの出来事が起きやすい
  if (story(save) && (save.sugoroku?.campWeeks ?? 0) > 0) {
    const st = save.story!
    const key = `volley_${save.calendar.year}`
    if (st.rivalId && st.flags[key] === undefined && rng.chance(0.25)) {
      st.flags[key] = true
      return beachVolleyEvent(save, rng, list)
    }
    const r = rng.next()
    if (r < 0.4) return beachEvent(rng, list)
    if (r < 0.6) return nurseBeachEvent(rng, list)
  }
  // ストーリーあり：まれに保健室の蓮見先生
  if (story(save) && rng.chance(0.06)) return nurseEvent(rng, list)
  const makers = [
    () => slumpEvent(rng, list),
    () => awakeningEvent(rng, list),
    () => rivalEvent(rng, list),
    () => convertEvent(rng, list),
    () => secretPracticeEvent(rng, list),
    () => painEvent(rng, list),
    () => teamMeetingEvent(rng, list),
    () => quarrelEvent(save, rng, list),
  ]
  const weights = [16, 10, 14, 8, 18, 12, 14, 8]
  for (let i = 0; i < 5; i++) {
    const idx = rng.weighted(makers.map((m, j) => ({ value: j, weight: weights[j]! })))
    const ev = makers[idx]!()
    if (ev) return ev
  }
  return secretPracticeEvent(rng, list)
}

/** 選んだ選択肢の効果を反映する */
export function applyOps(save: SaveData, ops: EffectOp[]): void {
  const school = save.schools[save.playerSchoolId]!
  const all = players(save)
  for (const op of ops) {
    if (op.op === 'school') {
      if (op.key === 'funds') school.funds = Math.max(0, school.funds + op.delta)
      else school.reputation = clamp(school.reputation + op.delta, 0, 100)
    } else if (op.op === 'condition') {
      const targets = op.playerId === 'all' ? all : [save.players[op.playerId]].filter((p): p is Player => !!p)
      for (const p of targets) {
        if (op.key === 'form') p.condition.form = clamp(p.condition.form + op.delta, 1, 5)
        else p.condition[op.key] = clamp(Math.round(p.condition[op.key] + op.delta), 0, 100)
      }
    } else if (op.op === 'ability') {
      const p = save.players[op.playerId]
      if (!p) continue
      if (op.key === '__injury') {
        p.condition.injury = { name: '足の故障', weeksLeft: op.delta }
        continue
      }
      const [group, key] = op.key.split('.') as [string, string]
      const obj = (p as unknown as Record<string, Record<string, number>>)[group]
      if (!obj || typeof obj[key] !== 'number') continue
      const max = op.key === 'pitching.velocity' ? 163 : op.key === 'batting.trajectory' ? 4 : 99
      obj[key] = clamp(obj[key] + op.delta, 1, max)
    } else if (op.op === 'skill') {
      const p = save.players[op.playerId]
      if (!p) continue
      if (op.add && !p.skills.includes(op.add)) p.skills.push(op.add)
      if (op.remove) p.skills = p.skills.filter((s) => s !== op.remove)
    } else if (op.op === 'position') {
      const p = save.players[op.playerId]
      if (!p) continue
      p.mainPosition = op.position
      p.fielding.aptitude[op.position] = Math.max(p.fielding.aptitude[op.position], 2)
      p.practiceMenu = defaultPracticeMenu(op.position, p.batting.power, p.running.speed)
    } else if (op.op === 'camp') {
      if (save.sugoroku) save.sugoroku.campWeeks = op.weeks
    } else if (op.op === 'injury') {
      const p = save.players[op.playerId]
      if (!p || p.storyCast === 'daichi') continue
      p.condition.injury = { name: op.name, weeksLeft: op.weeks }
    } else if (op.op === 'recruit') {
      const rng = new Rng(save.rngState)
      const [p] = generateGrade(rng, save, school, op.grade, 1, schoolStrength(school) + op.boost)
      if (p) {
        p.condition.motivation = clamp(Math.max(p.condition.motivation, op.motivation), 0, 100)
        save.players[p.id] = p
        school.playerIds.push(p.id)
        school.overall = computeOverall(school, save.players)
        save.log.push({ year: save.calendar.year, week: save.calendar.week, text: `${fullName(p)}（${op.grade}年）が${op.note}` })
      }
      save.rngState = rng.getState()
    } else if (op.op === 'modifier') {
      ;(save.modifiers ??= []).push({ ...op.modifier })
    } else if (op.op === 'flag') {
      ;(save.flags ??= {})[op.key] = op.value
    } else if (op.op === 'eval') {
      addEval(save, op.key as EvalKey, op.delta)
    }
  }
}

