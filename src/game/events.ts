// イベント：マスに止まったときや、季節の節目に起きる出来事
// 結果は作る時点で決めておく（乱数を先に使うので、やり直しても同じ結果になる）

import { Rng, clamp } from './rng'
import { POSITION_NAME } from './constants'
import { defaultPracticeMenu } from './player'
import { SKILLS, conflicts } from './skills'
import type { EffectOp, EventInstance, Player, Position, SaveData, SquareType } from './types'

const ABILITY_LABEL: Record<string, string> = {
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

function mainKeys(p: Player): string[] {
  return p.mainPosition === 'P'
    ? ['pitching.velocity', 'pitching.control', 'pitching.stamina', 'pitching.kire']
    : ['batting.contact', 'batting.power', 'running.speed', 'fielding.range', 'fielding.arm']
}

function learnable(rng: Rng, p: Player): string | null {
  const isPitcher = p.mainPosition === 'P'
  const options = SKILLS.filter(
    (s) => s.good && !p.skills.includes(s.id) && (s.target === 'all' || (s.target === 'pitcher') === isPitcher) && !p.skills.some((o) => conflicts(o, s.id)),
  )
  return options.length ? rng.pick(options).id : null
}

function skillName(id: string): string {
  return SKILLS.find((s) => s.id === id)?.name ?? ''
}

function players(save: SaveData): Player[] {
  const school = save.schools[save.playerSchoolId]!
  return school.playerIds.map((id) => save.players[id]).filter((p): p is Player => !!p && !p.retired && !p.helper)
}

let seq = 0
const eid = (name: string) => `${name}-${Date.now().toString(36)}-${seq++}`

// ---------------------------------------------------------------- 各イベント

function managerEvent(save: SaveData, rng: Rng): EventInstance {
  if (rng.chance(0.6)) {
    return {
      id: eid('snack'),
      title: 'マネージャーの差し入れ',
      speaker: { kind: 'manager', name: 'マネージャー' },
      lines: ['みんな、お疲れさま！', '今日はおにぎりとスポーツドリンクを用意したよ。しっかり食べて、また頑張ろうね！'],
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
  const p = rng.pick(list)
  return {
    id: eid('note'),
    title: 'マネージャーのノート',
    speaker: { kind: 'manager', name: 'マネージャー' },
    relatedPlayerIds: [p.id],
    lines: [`監督、${p.surname}くんのフォームを毎日記録してみたんです。`, '最近いい時と悪い時の違いが、少し分かってきました。'],
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

function fundsEvent(save: SaveData, rng: Rng): EventInstance {
  const school = save.schools[save.playerSchoolId]!
  if (school.kind === 'public' && rng.chance(0.5)) {
    const amount = rng.int(15, 30)
    return {
      id: eid('local'),
      title: '地元の応援',
      speaker: { kind: 'local', name: '商店街の会長' },
      lines: ['いつも頑張ってるねえ。町のみんなで少しずつ集めたんだ。', '甲子園……いや、全国を目指して頑張っておくれよ！'],
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
    speaker: { kind: 'ob', name: 'OB会長' },
    lines: ['監督、OB会で少しばかり集まりましてな。', '後輩たちのために使ってやってください。'],
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
  const toPitcher = list.filter((p) => p.mainPosition !== 'P' && !p.pitchingRetired && p.fielding.arm >= 45)
  const toField = list.filter((p) => p.mainPosition === 'P' && p.batting.contact + p.batting.power >= 80)
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
  return {
    id: eid('secret'),
    title: '居残り練習',
    speaker: { kind: 'narration', name: '' },
    relatedPlayerIds: [p.id],
    lines: [`夜のグラウンドに、${p.surname}の姿があった。`, '誰もいなくなった後も、黙々とバットを振り、ボールを追っている。'],
    choices: [
      {
        label: 'その努力を褒める',
        result: `${p.surname}の${ABILITY_LABEL[key]}が伸び、やる気も上がった！`,
        ops: [
          { op: 'ability', playerId: p.id, key, delta: 2 },
          { op: 'condition', playerId: p.id, key: 'motivation', delta: 10 },
          { op: 'condition', playerId: p.id, key: 'stamina', delta: -10 },
        ],
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
  const tired = [...list].sort((a, b) => a.condition.stamina - b.condition.stamina)
  const p = tired[0] ?? rng.pick(list)
  const getsHurt = rng.chance(0.35)
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

/** 止まったマスに応じてイベントを作る（イベントがなければ null） */
export function buildEvent(save: SaveData, rng: Rng, square: SquareType): EventInstance | null {
  const list = players(save)
  if (list.length === 0) return null
  if (square === 'manager') return managerEvent(save, rng)
  if (square === 'funds') return fundsEvent(save, rng)
  if (square === 'school') return schoolEvent(save, rng)
  if (square !== 'event') return null
  const makers = [
    () => slumpEvent(rng, list),
    () => awakeningEvent(rng, list),
    () => rivalEvent(rng, list),
    () => convertEvent(rng, list),
    () => secretPracticeEvent(rng, list),
    () => painEvent(rng, list),
    () => teamMeetingEvent(rng, list),
  ]
  const weights = [16, 10, 14, 8, 18, 12, 14]
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
        else p.condition[op.key] = clamp(p.condition[op.key] + op.delta, 0, 100)
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
      const max = op.key === 'pitching.velocity' ? 163 : 99
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
    }
  }
}

