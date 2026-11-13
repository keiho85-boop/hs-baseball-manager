// サクセス第1章：練習マスに付く人物のイベントと、サクセス用のランダムイベント
// ・スカウト・マネージャー（ナギ）・源造（部費）などは、マスではなく練習マスに付く。止まると練習に加えてイベントが起きる
// ・スカウトは1〜3年目の通年で、毎週どこかの練習マスにいる（いることは見える）
// 構想書18節

import type { Rng } from '../rng'
import { ABILITY_LABEL, eid, learnable, mainKeys, skillName } from '../events'
import type { EffectOp, EventInstance, Player, SaveData, SquareType } from '../types'
import { focusPlayer, successOf } from './state'
import { levelEvent, PERSON_EVAL } from './personEvents'

export type Person = 'scout' | 'nagi' | 'genzo' | 'hasumi' | 'daichi' | 'makabe'

export const PERSON_BADGE: Record<Person, { short: string; label: string; color: string }> = {
  scout: { short: 'ス', label: 'スカウト', color: '#5f6f86' },
  nagi: { short: 'ナ', label: 'ナギ', color: '#ff8a3d' },
  genzo: { short: '源', label: '源造', color: '#c0392b' },
  hasumi: { short: '蓮', label: '蓮見', color: '#c2477a' },
  daichi: { short: '大', label: '大地', color: '#2f6fe0' },
  makabe: { short: '真', label: '真壁', color: '#4a7a3d' },
}

const PRACTICE: SquareType[] = ['batting', 'power', 'pitching', 'velo', 'control', 'breaking', 'fitness', 'fielding', 'running', 'practical']

/** サクセスの盤面：マネージャー・部費・スカウトのマスは、練習マスに付く人物に置き換える */
export function successBoard(board: SquareType[]): SquareType[] {
  const repl: SquareType[] = ['batting', 'fielding', 'running', 'power']
  let i = 0
  return board.map((sq) => (sq === 'manager' || sq === 'funds' || sq === 'scout' ? repl[i++ % repl.length]! : sq))
}

/** 今週、練習マスに付く人物を決める（毎週入れ替わる） */
export function rollAttach(save: SaveData, rng: Rng): void {
  const s = successOf(save)
  const sg = save.sugoroku
  if (!s || !sg || s.ended) return
  const flags = save.story!.flags
  const slots = rng.shuffle(sg.board.map((sq, i) => ({ sq, i })).filter((x) => PRACTICE.includes(x.sq)).map((x) => x.i))
  const people: Person[] = ['scout']
  const pool: Person[] = ['nagi', 'daichi', 'makabe']
  if (flags.join9 !== undefined) pool.push('genzo')
  if (save.story!.seen.includes('c1_hokenshitsu')) pool.push('hasumi')
  people.push(...rng.shuffle(pool).slice(0, 2))
  const attach: Record<number, string> = {}
  people.forEach((p, k) => {
    const i = slots[k]
    if (i !== undefined) attach[i] = p
  })
  sg.attach = attach
}

/** 止まったマスに付いている人物 */
export function attachedAt(save: SaveData, index: number): Person | null {
  return (save.sugoroku?.attach?.[index] as Person | undefined) ?? null
}

const NAGI = { kind: 'manager', name: 'ナギ', portrait: 'nagi' } as const
const DAICHI = { kind: 'coach', name: '日向大地', portrait: 'daichi' } as const
const GENZO = { kind: 'local', name: '日向源造（商店会長）', portrait: 'genzo' } as const
const HASUMI = { kind: 'coach', name: '蓮見先生（養護教諭）', portrait: 'hasumi' } as const
const MAKABE = { kind: 'coach', name: '真壁先生', portrait: 'makabe' } as const
const SCOUT = { kind: 'ob', name: 'プロのスカウト', portrait: 'pro_scout' } as const
const NARR = { kind: 'narration', name: '' } as const

function ev(key: string, delta: number): EffectOp {
  return { op: 'eval', key, delta }
}

function grow(p: Player, keys: string[], delta: number): EffectOp[] {
  return keys.map((key) => ({ op: 'ability' as const, playerId: p.id, key, delta: key === 'pitching.velocity' ? Math.max(1, Math.round(delta / 2)) : delta }))
}

/** 練習マスに付いた人物のイベント */
export function attachEvent(save: SaveData, rng: Rng, person: Person): EventInstance | null {
  const e = attachEventBase(save, rng, person)
  if (!e) return null
  // その人物の評価は、本人のイベントでよく上がる（★5のイベントにも手が届くように）
  const key = PERSON_EVAL[person]
  return {
    ...e,
    choices: e.choices.map((c) => ({ ...c, ops: c.ops.map((o) => (o.op === 'eval' && o.key === key && o.delta > 0 ? { ...o, delta: Math.round(o.delta * 1.6) } : o)) })),
  }
}

function attachEventBase(save: SaveData, rng: Rng, person: Person): EventInstance | null {
  const f = focusPlayer(save)
  if (!f) return null
  // 評価が上がるほど、新しいイベントが解放される（解放済みの中からランダム。★1はこの下のもの）
  const higher = levelEvent(save, rng, person, f)
  if (higher) return higher
  const s = successOf(save)!
  const name = f.surname
  if (person === 'scout') {
    const gain = s.scoutFocus ? 4 : 2
    const good = rng.chance(0.7)
    return {
      id: eid('scout'),
      title: 'スカウトが見ている',
      speaker: { ...SCOUT },
      relatedPlayerIds: [f.id],
      lines: [`フェンスの向こうで、帽子を目深にかぶった男がメモを取っている。`, `視線の先にいるのは…${name}だ。`],
      choices: [
        {
          label: 'いつも通りの練習を見せる',
          result: `${name}は集中して練習を続けた。（スカウトの評価が上がった）`,
          ops: [ev('scout', gain), { op: 'condition', playerId: f.id, key: 'motivation', delta: 3 }],
        },
        {
          label: '一番いいところを見せる（張り切る）',
          result: good ? `${name}の全力のプレーに、男のペンが止まった。（スカウトの評価が大きく上がった。体力が減った）` : `力みすぎて、空回りしてしまった…。（体力が減った）`,
          ops: good ? [ev('scout', gain + 2), { op: 'condition', playerId: f.id, key: 'stamina', delta: -15 }] : [{ op: 'condition', playerId: f.id, key: 'stamina', delta: -15 }],
        },
      ],
    }
  }
  if (person === 'nagi') {
    const keys = rng.shuffle(mainKeys(f)).slice(0, 2)
    return {
      id: eid('nagi'),
      title: 'ナギのノート',
      speaker: { ...NAGI },
      relatedPlayerIds: [f.id],
      lines: [`${name}くん、少しいいですか。昨日の練習のフォーム、記録しておきました。`, 'ここ、いいときと悪いときで、ひじの高さが違うんです。'],
      choices: [
        {
          label: 'じっくり教えてもらう',
          result: `${name}はナギの指摘を、すぐに練習で試した。（${keys.map((k) => ABILITY_LABEL[k]).join('と')}が上がった。ナギの評価が上がった）`,
          ops: [...grow(f, keys, 1), ev('nagi', 2)],
        },
        {
          label: 'チームのみんなにも共有してもらう',
          result: '部員みんなが、ナギのノートをのぞき込んだ。（全員の調子が上がった。チームメイトの評価が上がった）',
          ops: [{ op: 'condition', playerId: 'all', key: 'motivation', delta: 5 }, ev('team', 2), ev('nagi', 1)],
        },
      ],
    }
  }
  if (person === 'daichi') {
    const pitcher = f.mainPosition === 'P'
    const keys = pitcher ? ['pitching.control', 'pitching.kire'] : ['batting.contact', 'batting.eye']
    const skill = rng.chance(0.06) ? learnable(rng, f) : null
    const ops = [...grow(f, keys, pitcher ? 2 : 1), ev('daichi', 3)]
    if (skill) ops.push({ op: 'skill', playerId: f.id, add: skill })
    return {
      id: eid('daichi'),
      title: pitcher ? '大地とのバッテリー練習' : '大地との居残り練習',
      speaker: { ...DAICHI },
      relatedPlayerIds: [f.id],
      lines: pitcher
        ? [`おい${name}、もう20球だけ投げていけよ。俺が受けてやる`, '…お前の球、昔より重くなったな']
        : [`${name}、ティー打撃付き合え。…昔から、お前のほうが打つのはうまかったよな`],
      choices: [
        {
          label: '付き合う',
          result: `幼馴染の二人の練習は、日が暮れるまで続いた。（${keys.map((k) => ABILITY_LABEL[k]).join('と')}が上がった。大地の評価が上がった）${skill ? `さらに特殊能力「${skillName(skill)}」を身につけた！` : ''}`,
          ops,
        },
        {
          label: '今日は早く帰って休む',
          result: '「…そっか。じゃあ、肉まん買って帰ろうぜ」（体力が回復した。大地の評価が少し上がった）',
          ops: [{ op: 'condition', playerId: f.id, key: 'stamina', delta: 20 }, ev('daichi', 1)],
        },
      ],
    }
  }
  if (person === 'genzo') {
    const amount = rng.int(8, 15)
    return {
      id: eid('genzo'),
      title: '商店会長の差し入れ',
      speaker: { ...GENZO },
      lines: ['おう、野球部！　精が出るな。店の余りもんだ、持っていけ！', `…${name}か。うちのバカ息子と、昔からよく遊んどったな`],
      choices: [
        {
          label: 'ありがたくいただく',
          result: `部費の足しにと、商店会からの寄付も置いていった。（部費 +${amount}万円。源造の評価が上がった）`,
          ops: [{ op: 'school', key: 'funds', delta: amount }, { op: 'condition', playerId: 'all', key: 'stamina', delta: 6 }, ev('genzo', 3)],
        },
        {
          label: `${name}が店の荷運びを手伝う`,
          result: `${name}は汗だくになって、酒のケースを運んだ。（体力が減った。源造の評価が大きく上がった）`,
          ops: [{ op: 'school', key: 'funds', delta: Math.round(amount / 2) }, { op: 'condition', playerId: f.id, key: 'stamina', delta: -12 }, ev('genzo', 6)],
        },
      ],
    }
  }
  if (person === 'hasumi') {
    return {
      id: eid('hasumi'),
      title: '保健室の蓮見先生',
      speaker: { ...HASUMI },
      relatedPlayerIds: [f.id],
      lines: [`${name}くん、ちょっといらっしゃい。…ほら、肩が張ってる。無理は禁物よ？`],
      choices: [
        {
          label: '体をほぐしてもらう',
          result: `${name}の体が軽くなった。（体力が回復した。ケガをしにくくなった。蓮見の評価が上がった）`,
          ops: [{ op: 'condition', playerId: f.id, key: 'stamina', delta: 25 }, ...grow(f, ['common.durability'], 2), ev('hasumi', 3)],
        },
        {
          label: '大丈夫です、と練習に戻る',
          result: '「ふふ、強がりね」蓮見先生は笑って見送った。（蓮見の評価が少し下がった）',
          ops: [ev('hasumi', -1)],
        },
      ],
    }
  }
  // makabe
  return {
    id: eid('makabe'),
    title: '真壁先生の質問',
    speaker: { ...MAKABE },
    relatedPlayerIds: [f.id],
    lines: [`${name}くん、ちょっと聞いてもいいかな。…「振り逃げ」って、どうして逃げていいの？`],
    choices: [
      {
        label: '丁寧に説明する',
        result: '真壁先生は熱心にメモを取った。（真壁の評価が上がった）',
        ops: [ev('makabe', 4)],
      },
      {
        label: '「朝比奈に聞いてください」',
        result: `真壁先生は、少し寂しそうにナギのほうへ歩いていった。（真壁の評価が少し下がった。ナギの評価が上がった）`,
        ops: [ev('makabe', -1), ev('nagi', 1)],
      },
    ],
  }
}

/** サクセス用のランダムイベント（イベントマス）：選択肢で評価が上下する */
export function successRandomEvent(save: SaveData, rng: Rng): EventInstance | null {
  const f = focusPlayer(save)
  if (!f) return null
  const name = f.surname
  const list = [
    (): EventInstance => ({
      id: eid('souji'),
      title: '部室の掃除当番',
      speaker: { ...NARR },
      relatedPlayerIds: [f.id],
      lines: ['部室の掃除当番が回ってきた。床には泥と、誰かの汗くさいタオル。', `${name}の手には、ほうきが1本。`],
      choices: [
        { label: 'ピカピカにする', result: '見違えるほどきれいになった。（体力が少し減った。チームメイトの評価が上がった）', ops: [{ op: 'condition', playerId: f.id, key: 'stamina', delta: -5 }, ev('team', 3)] },
        { label: 'さっと済ませて練習へ', result: `${name}は自主練に向かった。（${ABILITY_LABEL['batting.contact']}が少し上がった。チームメイトの評価が少し下がった）`, ops: [...grow(f, [f.mainPosition === 'P' ? 'pitching.control' : 'batting.contact'], 1), ev('team', -1)] },
      ],
    }),
    (): EventInstance => ({
      id: eid('mikan'),
      title: '差し入れのみかん',
      speaker: { ...NAGI },
      relatedPlayerIds: [f.id],
      lines: [`${name}くん、みかんどうぞ。…あ、最後の1個です。`],
      choices: [
        { label: '半分こする', result: 'ナギは少しだけ笑った。（ナギの評価が上がった）', ops: [ev('nagi', 3)] },
        { label: '大地に譲る', result: '「お、悪いな」大地は一口で食べた。（大地の評価が上がった）', ops: [ev('daichi', 3)] },
      ],
    }),
    (): EventInstance => ({
      id: eid('kenshin'),
      title: '健康診断',
      speaker: { ...HASUMI },
      relatedPlayerIds: [f.id],
      lines: ['はい、深呼吸して。…うん、心臓の音はとっても元気。', `${name}くん、睡眠はちゃんととってる？`],
      choices: [
        { label: '正直に「寝不足です」と言う', result: '「正直でよろしい。今日は早く寝なさい」（体力が回復した。蓮見の評価が上がった）', ops: [{ op: 'condition', playerId: f.id, key: 'stamina', delta: 15 }, ev('hasumi', 3)] },
        { label: '「ばっちりです」と強がる', result: '「…目の下、くまができてるわよ？」（蓮見の評価が少し下がった）', ops: [ev('hasumi', -2)] },
      ],
    }),
    (): EventInstance => ({
      id: eid('rule'),
      title: '真壁先生のルール勉強会',
      speaker: { ...MAKABE },
      lines: ['朝比奈さんに宿題を出されてね。インフィールドフライ、今日こそ理解したいんだ'],
      choices: [
        { label: '最後まで付き合う', result: '夜の9時。真壁先生はついにインフィールドフライを理解した。（真壁の評価が大きく上がった。体力が減った）', ops: [ev('makabe', 5), { op: 'condition', playerId: f.id, key: 'stamina', delta: -8 }] },
        { label: '途中で帰る', result: '真壁先生は一人で教本を読み続けた。（変化なし）', ops: [] },
      ],
    }),
    (): EventInstance => ({
      id: eid('kenka'),
      title: 'ベンチの口げんか',
      speaker: { ...NARR },
      relatedPlayerIds: [f.id],
      lines: ['練習中、守備の連係ミスで、二人の部員が言い合いを始めた。'],
      choices: [
        { label: `${name}が間に入る`, result: `${name}のひとことで、二人は笑って握手した。（チームメイトの評価が上がった）`, ops: [ev('team', 4)] },
        { label: '大地に任せる', result: '大地の大きな声で、場はすぐに収まった。（大地の評価が上がった）', ops: [ev('daichi', 2), ev('team', 1)] },
      ],
    }),
  ]
  // 体を休める出来事（体力が回復する）
  list.push(
    (): EventInstance => ({
      id: eid('sento'),
      title: '銭湯の招待券',
      speaker: { ...GENZO },
      relatedPlayerIds: [f.id],
      lines: ['おう、商店街の福引で、銭湯の招待券が当たってな。わしは毎日入っとるから、お前らにやる！', '風呂上がりのコーヒー牛乳もつけてやるぞ。わっはっは！'],
      choices: [
        { label: '部員みんなで行く', result: '大きな湯船で、部員たちの疲れが溶けていった。（全員の体力が回復した。チームメイトの評価が上がった）', ops: [{ op: 'condition', playerId: 'all', key: 'stamina', delta: 15 }, ev('team', 2)] },
        { label: `${name}がゆっくり浸かる`, result: `${name}は、のぼせる寸前まで湯船に浸かった。（体力が大きく回復した。源造の評価が上がった）`, ops: [{ op: 'condition', playerId: f.id, key: 'stamina', delta: 30 }, ev('genzo', 2)] },
      ],
    }),
    (): EventInstance => ({
      id: eid('hirune'),
      title: '昼休みの昼寝',
      speaker: { ...NARR },
      relatedPlayerIds: [f.id],
      lines: ['昼休み。日だまりの屋上で、まぶたが重くなってきた。', '…午後の授業まで、あと20分。'],
      choices: [
        { label: '少しだけ眠る', result: `${name}は、チャイムの音で目を覚ました。（体力が回復した）`, ops: [{ op: 'condition', playerId: f.id, key: 'stamina', delta: 20 }] },
        { label: 'シャドーピッチング・素振りをする', result: `${name}は、昼休みも体を動かした。（${ABILITY_LABEL[f.mainPosition === 'P' ? 'pitching.control' : 'batting.contact']}が少し上がった。体力が少し減った）`, ops: [...grow(f, [f.mainPosition === 'P' ? 'pitching.control' : 'batting.contact'], 1), { op: 'condition', playerId: f.id, key: 'stamina', delta: -5 }] },
      ],
    }),
  )
  const make = rng.pick(list)
  return make()
}

/** フォーカス選手が関わるイベントなら、ナギの評価も少し動く（選択肢に関係なく） */
export function withFocusEval(save: SaveData, e: EventInstance | null): EventInstance | null {
  const f = focusPlayer(save)
  if (!e || !f || !e.relatedPlayerIds?.includes(f.id) || e.choices.some((c) => c.ops.some((o) => o.op === 'eval'))) return e
  return { ...e, choices: e.choices.map((c) => ({ ...c, ops: [...c.ops, ev('nagi', 1)] })) }
}
