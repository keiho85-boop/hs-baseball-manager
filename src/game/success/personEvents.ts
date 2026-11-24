// 選手育成モード：練習マスに付いた人物のイベント（評価の段階で解放）
// ・評価が★1のときは1種類、★2で1種類増え…★5で5種類。解放済みの中からランダムに起きる
// ・段階の高いイベントほど効果が大きく、起きにくい（★1の重み5.0、★2は4.4…★5は2.6）
// ・★1のイベントは board.ts の attachEvent（これまでのもの）を使う

import type { Rng } from '../rng'
import { ABILITY_LABEL, eid, learnable, learnablePitcher, mainKeys, skillName } from '../events'
import { FOCUS_XP_MULT, FOCUS_XP_MULT_P } from '../player'
import { canHave, getSkill, upgradable } from '../skills'
import { absWeek } from '../modifiers'
import type { EffectOp, EventInstance, Player, SaveData } from '../types'
import { evalStars, focusPlayer, successOf } from './state'
import type { EvalKey } from './types'

export type Person = 'scout' | 'nagi' | 'genzo' | 'hasumi' | 'daichi' | 'makabe'

const NAGI = { kind: 'manager', name: 'ナギ', portrait: 'nagi' } as const
const DAICHI = { kind: 'coach', name: '日向大地', portrait: 'daichi' } as const
const GENZO = { kind: 'local', name: '日向源造（商店会長）', portrait: 'genzo' } as const
const HASUMI = { kind: 'coach', name: '蓮見先生（養護教諭）', portrait: 'hasumi' } as const
const MAKABE = { kind: 'coach', name: '真壁先生', portrait: 'makabe' } as const
const SCOUT = { kind: 'ob', name: 'プロのスカウト', portrait: 'pro_scout' } as const

function ev(key: EvalKey, delta: number): EffectOp {
  return { op: 'eval', key, delta }
}
function grow(p: Player, keys: string[], delta: number): EffectOp[] {
  // 球速は半分（下がるときも半分）
  return keys.map((key) => ({ op: 'ability' as const, playerId: p.id, key, delta: key === 'pitching.velocity' ? Math.sign(delta) * Math.max(1, Math.round(Math.abs(delta) / 2)) : delta }))
}
/**
 * 大地の投手専用イベントの伸び。育成選手が野手のときの同じ段階のイベントより、実際の伸びが約1.2倍になるようにする
 * （投手は経験点の倍率が低いので、そのぶんを戻してから1.2倍）
 */
export const DAICHI_PITCHER_BOOST = 1.2
export function pitcherDelta(fielderDelta: number): number {
  return fielderDelta * DAICHI_PITCHER_BOOST * (FOCUS_XP_MULT / FOCUS_XP_MULT_P)
}
function skillOp(f: Player, skill: string | null): EffectOp[] {
  return skill ? [{ op: 'skill', playerId: f.id, add: skill }] : []
}
function skillText(skills: (string | null)[]): string {
  const got = skills.filter((x): x is string => !!x)
  return got.length ? `特殊能力「${got.map(skillName).join('」「')}」を身につけた！` : ''
}
/** ★ごとの、決まった特殊能力を身につける確率（設計の文書 11月19日） */
export const FIXED_SKILL_RATE: Record<number, number> = { 2: 0.2, 3: 0.3, 4: 0.5, 5: 0.6 }
/**
 * 選択肢で決まった特殊能力を、確率で身につける。育成選手が投手か野手か（捕手）で変わる。
 * 取れないとき（確率・持てない能力）は何もつけない
 */
function fixed(f: Player, rng: Rng, rate: number, pitcherSkill: string | null, fielderSkill: string | null, catcherSkill?: string): { ops: EffectOp[]; text: string } {
  const id = f.mainPosition === 'P' ? pitcherSkill : f.mainPosition === 'C' && catcherSkill ? catcherSkill : fielderSkill
  const def = id ? getSkill(id) : undefined
  if (!id || !def || !canHave(f, def) || !rng.chance(rate)) return { ops: [], text: '' }
  return { ops: [{ op: 'skill', playerId: f.id, add: id }], text: `特殊能力「${def.name}」を身につけた！` }
}
/** 名将の目・スカウト★5：持っている下位の能力が、まれに上位に変わる */
function upgrade(f: Player, rng: Rng, rate = 0.1): { ops: EffectOp[]; text: string } {
  const ups = upgradable(f)
  if (ups.length === 0 || !rng.chance(rate)) return { ops: [], text: '' }
  const id = rng.pick(ups)
  const def = getSkill(id)!
  return { ops: [{ op: 'skill', playerId: f.id, add: id }], text: `「${getSkill(def.lower!)!.name}」が「${def.name}」に変わった！` }
}
function labels(keys: string[]): string {
  return keys.map((k) => ABILITY_LABEL[k] ?? k).join('・')
}
function stamina(p: Player | 'all', delta: number): EffectOp {
  return { op: 'condition', playerId: p === 'all' ? 'all' : p.id, key: 'stamina', delta }
}
function form(p: Player | 'all', delta: number): EffectOp {
  return { op: 'condition', playerId: p === 'all' ? 'all' : p.id, key: 'form', delta }
}
/** 能力の低い順に n 個（弱点を補う） */
function weakest(p: Player, n: number): string[] {
  const val = (k: string): number => {
    const [g, key] = k.split('.') as [string, string]
    return ((p as unknown as Record<string, Record<string, number>>)[g]?.[key] ?? 0) as number
  }
  return [...mainKeys(p)].sort((a, b) => val(a) - val(b)).slice(0, n)
}
function strongest(p: Player, n: number): string[] {
  return [...weakest(p, mainKeys(p).length)].reverse().slice(0, n)
}

export const PERSON_EVAL: Record<Person, EvalKey> = { scout: 'scout', nagi: 'nagi', genzo: 'genzo', hasumi: 'hasumi', daichi: 'daichi', makabe: 'makabe' }

/** その人物の評価から、起きるイベントの段階（1〜5）を選ぶ */
export function pickLevel(save: SaveData, rng: Rng, person: Person): number {
  const s = successOf(save)
  const stars = s ? evalStars(s.eval[PERSON_EVAL[person]]) : 1
  return rng.weighted(Array.from({ length: stars }, (_, i) => ({ value: i + 1, weight: 5 - i * 0.6 })))
}

type Maker = (save: SaveData, rng: Rng, f: Player) => EventInstance

/** ★2〜★5のイベント（添字0が★2） */
const EVENTS: Record<Person, Maker[]> = {
  // ---------------------------------------------------------------- スカウト
  scout: [
    (save, rng, f) => {
      const s = successOf(save)!
      const gain = s.scoutFocus ? 5 : 3
      const a = fixed(f, rng, FIXED_SKILL_RATE[2]!, 'scout_uke', 'scout_uke')
      const b = fixed(f, rng, FIXED_SKILL_RATE[2]!, null, 'miwame')
      return {
        id: eid('scout2'),
        title: 'スカウトの名刺',
        speaker: { ...SCOUT },
        relatedPlayerIds: [f.id],
        lines: [`練習の終わり、帽子の男が近づいてきた。「${f.surname}くん、だね」`, '差し出された名刺には、プロ球団の名前が印刷されている。'],
        choices: [
          { label: '帽子を取って、あいさつする', result: `「礼儀もいい。…覚えておくよ」（スカウトの評価が上がった。調子が上がった）${a.text}`, ops: [ev('scout', gain), form(f, 1), ...a.ops] },
          { label: '緊張して固まる', result: `「ははは、そんなに硬くならなくていい。…よく見ているね、君は」（スカウトの評価が少し上がった。体力が少し減った）${b.text}`, ops: [ev('scout', Math.round(gain / 2)), stamina(f, -3), ...b.ops] },
        ],
      }
    },
    (_save, rng, f) => {
      const keys = strongest(f, 2)
      const pitcher = f.mainPosition === 'P'
      const a = fixed(f, rng, FIXED_SKILL_RATE[3]!, 'groundball', 'hustle')
      const b = fixed(f, rng, FIXED_SKILL_RATE[3]!, 'groundball', 'highlight_defense')
      return {
        id: eid('scout3'),
        title: '見せ場をつくる',
        speaker: { ...SCOUT },
        relatedPlayerIds: [f.id],
        lines: ['今日は、スカウトが二人。ストップウォッチとスピードガンが並んでいる。', `ナギ「${f.surname}くん。得意なところを、思い切り見せてください」`],
        choices: [
          ...(pitcher
            ? [{ label: '得意な球を投げ込む', result: `${f.surname}の持ち味が光った。（${labels(keys)}が上がった。スカウトの評価が上がった）${a.text}`, ops: [...grow(f, keys, 2), ev('scout', 4), ...a.ops] }]
            : [
                { label: '打って走る姿を見せる', result: `${f.surname}は一塁まで全力で駆け抜けた。（${labels(keys)}が上がった。スカウトの評価が上がった）${a.text}`, ops: [...grow(f, keys, 2), ev('scout', 4), ...a.ops] },
                { label: '守備で見せる', result: `${f.surname}は難しい打球に飛びついた。（${labels(keys)}が上がった。スカウトの評価が上がった）${b.text}`, ops: [...grow(f, keys, 2), ev('scout', 4), ...b.ops] },
              ]),
        ],
      }
    },
    (_save, rng, f) => {
      const keys = weakest(f, 2)
      const bad = f.skills.find((id) => getSkill(id) && !getSkill(id)!.good)
      const a = fixed(f, rng, FIXED_SKILL_RATE[4]!, 'steel_heart', 'steel_heart')
      return {
        id: eid('scout4'),
        title: 'スカウトの助言',
        speaker: { ...SCOUT },
        relatedPlayerIds: [f.id],
        lines: ['「独り言だと思って聞いてくれ。プロで生き残るのは、長所が一つ突き抜けているやつか、穴がないやつだ」'],
        choices: [
          { label: '長所を伸ばす', result: `${f.surname}は、得意なことを磨き続けた。（${labels(strongest(f, 1))}が大きく上がった。スカウトの評価が上がった）${a.text}`, ops: [...grow(f, strongest(f, 1), 4), ev('scout', 4), ...a.ops] },
          {
            label: '穴をなくす',
            result: bad ? `${f.surname}は、苦手を一つずつつぶした。（弱点「${getSkill(bad)!.name}」を克服した。スカウトの評価が上がった）` : `${f.surname}は、苦手を一つずつつぶした。（${labels(keys)}が上がった。スカウトの評価が上がった）`,
            ops: [...(bad ? [{ op: 'skill' as const, playerId: f.id, remove: bad }] : grow(f, keys, 3)), ev('scout', 4)],
          },
        ],
      }
    },
    (_save, rng, f) => {
      const a = fixed(f, rng, FIXED_SKILL_RATE[5]!, 'omatsuri', 'omatsuri')
      const u = upgrade(f, rng)
      const keys = mainKeys(f)
      const ops: EffectOp[] = [...grow(f, keys, 2), ev('scout', 8), form(f, 2), ...a.ops, ...u.ops]
      return {
        id: eid('scout5'),
        title: '球団幹部の視察',
        speaker: { ...SCOUT },
        relatedPlayerIds: [f.id],
        lines: ['バックネット裏に、スーツ姿の男たちが並んだ。いつものスカウトが、その後ろで小さくうなずく。', '「部長、あれが例の…」'],
        choices: [
          {
            label: '全力で応える',
            result: `${f.surname}は、この日いちばんのプレーを見せた。（${labels(keys)}が上がった。スカウトの評価が大きく上がった）${a.text}${u.text}`,
            ops,
          },
        ],
      }
    },
  ],

  // ---------------------------------------------------------------- ナギ
  nagi: [
    (_save, rng, f) => {
      const keys = rng.shuffle(mainKeys(f)).slice(0, 2)
      const a = fixed(f, rng, FIXED_SKILL_RATE[2]!, 'full_throttle', 'first_ab')
      return {
        id: eid('nagi2'),
        title: 'ナギの分析データ',
        speaker: { ...NAGI },
        relatedPlayerIds: [f.id],
        lines: ['県内の主な投手と打者を、全部まとめておきました。', `${f.surname}くんに合わせた練習も、書いてあります`],
        choices: [{ label: 'ノートどおりに練習する', result: `（${labels(keys)}が上がった。ナギの評価が上がった）${a.text}`, ops: [...grow(f, keys, 2), ev('nagi', 3), ...a.ops] }],
      }
    },
    (_save, rng, f) => {
      const keys = rng.shuffle(mainKeys(f)).slice(0, 3)
      const a = fixed(f, rng, FIXED_SKILL_RATE[3]!, 'recover', 'breaking_eye')
      return {
        id: eid('nagi3'),
        title: 'ナギの特別メニュー',
        speaker: { ...NAGI },
        relatedPlayerIds: [f.id],
        lines: ['今日だけ、練習メニューを変えます。きついですよ', '…できないと思ったら、言ってください。止めますから'],
        choices: [
          { label: '最後までやり切る', result: `${f.surname}は、膝に手をつきながらもやり切った。（${labels(keys)}が上がった。体力が減った。ナギの評価が上がった）${a.text}`, ops: [...grow(f, keys, 2), stamina(f, -12), ev('nagi', 4), ...a.ops] },
          { label: '途中で止めてもらう', result: '「賢明です」（ナギの評価が少し上がった）', ops: [...grow(f, keys.slice(0, 1), 1), ev('nagi', 1)] },
        ],
      }
    },
    (_save, rng, f) => {
      // 名将の目：3つから選ぶ。選んだ能力を50%で。持っている下位の能力が10%で上位に変わる
      const opts: [string, string][] =
        f.mainPosition === 'P'
          ? [['finisher', '「追い込んでからの一球を磨きます」'], ['denka', '「一番の変化球を磨きます」'], ['pinch_ace', '「ピンチで投げ切る力を」']]
          : [['leadoff', '「先頭で出る力を」'], ['first_pitch', '「初球から振っていく力を」'], ['risp_hunter', '「チャンスで打つ力を」']]
      const u = upgrade(f, rng)
      return {
        id: eid('nagi4'),
        title: '名将の目',
        speaker: { ...NAGI },
        relatedPlayerIds: [f.id],
        lines: [`${f.surname}くん。…あなたは、ここぞの場面で力を出せる人です`, 'ナギ（心）：四十年見てきた。こういう目をした選手は、化ける', 'どこを伸ばしたいですか'],
        choices: opts.map(([id, label]) => {
          const a = fixed(f, rng, FIXED_SKILL_RATE[4]!, id, id)
          const keys = strongest(f, 2)
          return {
            label,
            result: `（${labels(keys)}が上がった。ナギの評価が上がった）${a.text}${u.text}`,
            ops: [...grow(f, keys, a.ops.length ? 1 : 3), ev('nagi', 4), ...a.ops, ...u.ops],
          }
        }),
      }
    },
    (_save, rng, f) => {
      const a = fixed(f, rng, FIXED_SKILL_RATE[5]!, 'hard_worker', 'hard_worker')
      const keys = mainKeys(f)
      const ops: EffectOp[] = [...grow(f, keys, 3), form(f, 2), ev('nagi', 6), ...a.ops]
      return {
        id: eid('nagi5'),
        title: '二人だけの居残り練習',
        speaker: { ...NAGI },
        relatedPlayerIds: [f.id],
        lines: ['日が暮れたグラウンド。ナギが、ノックバットを握っている。', '…今日は、私が直接見ます。最後まで、付いてきてください'],
        choices: [
          {
            label: 'はい！',
            result: `ナギのノックは、驚くほど正確だった。（${labels(keys)}が上がった。ナギの評価が大きく上がった）${a.text}`,
            ops,
          },
        ],
      }
    },
  ],

  // ---------------------------------------------------------------- 大地
  daichi: [
    // ★2：投手は「大地との投げ込み」、野手は「大地と素振り対決」
    (_save, rng, f) => {
      if (f.mainPosition === 'P') {
        const keys = ['pitching.velocity', 'pitching.stamina']
        const a = fixed(f, rng, FIXED_SKILL_RATE[2]!, 'k_momentum', null)
        return {
          id: eid('daichi2'),
          title: '大地との投げ込み',
          speaker: { ...DAICHI },
          relatedPlayerIds: [f.id],
          lines: ['あと50球！　…俺のミットが痛くなるまで投げてみろ', 'ミットの音が、だんだん重くなっていく。'],
          choices: [{ label: '受けて立つ', result: `（${labels(keys)}が上がった。体力が減った。大地の評価が上がった）${a.text}`, ops: [...grow(f, keys, pitcherDelta(2)), ...a.ops, stamina(f, -8), ev('daichi', 4)] }],
        }
      }
      const keys = ['batting.power', 'running.speed']
      const a = fixed(f, rng, FIXED_SKILL_RATE[2]!, null, 'momentum')
      return {
        id: eid('daichi2'),
        title: '大地と素振り対決',
        speaker: { ...DAICHI },
        relatedPlayerIds: [f.id],
        lines: ['どっちが先に500本振れるか、勝負な！'],
        choices: [{ label: '受けて立つ', result: `（${labels(keys)}が上がった。体力が減った。大地の評価が上がった）${a.text}`, ops: [...grow(f, keys, 2), stamina(f, -8), ev('daichi', 4), ...a.ops] }],
      }
    },
    // ★3：投手は「二人だけのサイン」、野手は「幼馴染の本音」
    (_save, rng, f) => {
      if (f.mainPosition === 'P') {
        const keys = ['pitching.control', 'pitching.pinch']
        const a = fixed(f, rng, FIXED_SKILL_RATE[3]!, 'tempo', null)
        return {
          id: eid('daichi3'),
          title: '二人だけのサイン',
          speaker: { ...DAICHI },
          relatedPlayerIds: [f.id],
          lines: ['帰り道。大地が、指を何本か立てて見せた。', `${f.surname}、これ、俺たちだけのサインな。…ピンチのときほど、俺を見ろ`],
          choices: [
            {
              label: '「お前のミットだけ見て投げる」',
              result: `「…へっ、言ったな」（${labels(keys)}が上がった。大地の評価が上がった）${a.text}`,
              ops: [...grow(f, keys, pitcherDelta(2)), ...a.ops, ev('daichi', 5), form(f, 1)],
            },
          ],
        }
      }
      const a = fixed(f, rng, FIXED_SKILL_RATE[3]!, null, 'jinbo', 'battery_mate')
      return {
        id: eid('daichi3'),
        title: '幼馴染の本音',
        speaker: { ...DAICHI },
        relatedPlayerIds: [f.id],
        lines: ['帰り道。大地が、ぽつりと言った。', `なあ${f.surname}。お前がプロに行ったらさ…俺、店番しながらテレビで応援するよ`],
        choices: [
          { label: '「お前も一緒に上を目指せよ」', result: `「…へっ、言ったな」（部員全員の調子が上がった。大地の評価が上がった。チームメイトの評価が上がった）${a.text}`, ops: [form('all', 1), ev('daichi', 5), ev('team', 2), ...a.ops] },
          { label: '「…ありがとな」', result: '二人とも、しばらく黙って歩いた。（大地の評価が上がった）', ops: [ev('daichi', 5), form(f, 1)] },
        ],
      }
    },
    // ★4：投手は「大地のリード論」、野手は「大地の配球読み」
    (_save, rng, f) => {
      if (f.mainPosition === 'P') {
        const keys = ['pitching.control', 'pitching.kire']
        const a = fixed(f, rng, FIXED_SKILL_RATE[4]!, 'sokojikara', null)
        return {
          id: eid('daichi4'),
          title: '大地のリード論',
          speaker: { ...DAICHI },
          relatedPlayerIds: [f.id],
          lines: ['いいか、困ったら外の低め。俺がそこに構える。…お前は、そこだけ信じて投げろ'],
          choices: [{ label: 'じっくり聞く', result: `（${labels(keys)}が大きく上がった。大地の評価が上がった）${a.text}`, ops: [...grow(f, keys, pitcherDelta(3)), ...a.ops, ev('daichi', 5)] }],
        }
      }
      const keys = ['batting.contact', 'batting.eye']
      const a = fixed(f, rng, FIXED_SKILL_RATE[4]!, null, 'fastball_killer')
      return {
        id: eid('daichi4'),
        title: '大地の配球読み',
        speaker: { ...DAICHI },
        relatedPlayerIds: [f.id],
        lines: ['捕手から見るとな、投手ってカウントごとに投げたい球が決まってるんだよ。教えてやる'],
        choices: [{ label: 'じっくり聞く', result: `（${labels(keys)}が大きく上がった。大地の評価が上がった）${a.text}`, ops: [...grow(f, keys, 3), ev('daichi', 5), ...a.ops] }],
      }
    },
    // ★5：投手は「最強のバッテリー」（特殊能力を1つ必ず、もう1つは半々）、野手は「最強のコンビ」
    (_save, rng, f) => {
      const pitcher = f.mainPosition === 'P'
      const keys = mainKeys(f).slice(0, 3)
      const a = fixed(f, rng, FIXED_SKILL_RATE[5]!, 'gear_change', 'gap_power')
      const ops: EffectOp[] = [...grow(f, keys, pitcher ? pitcherDelta(3) : 3), ...a.ops, ev('daichi', 7), ev('team', 3)]
      return {
        id: eid('daichi5'),
        title: pitcher ? '最強のバッテリー' : '最強のコンビ',
        speaker: { ...DAICHI },
        relatedPlayerIds: [f.id],
        lines: ['夕暮れのグラウンドに、二人きり。言葉はいらなかった。', '…なあ、俺たち、もっと上に行けるよな'],
        choices: [{ label: '「行こう。二人で」', result: `（${labels(keys)}が大きく上がった。大地の評価が大きく上がった）${a.text}`, ops }],
      }
    },
  ],

  // ---------------------------------------------------------------- 源造
  genzo: [
    (_save, rng, f) => {
      const amount = rng.int(15, 25)
      const a = fixed(f, rng, FIXED_SKILL_RATE[2]!, 'counterattack', 'counterattack')
      const b = fixed(f, rng, FIXED_SKILL_RATE[2]!, 'lefty_stopper', 'lefty_killer')
      return {
        id: eid('genzo2'),
        title: '商店街の応援団',
        speaker: { ...GENZO },
        lines: ['おう！　商店街で応援団を作ったぞ！　のぼりも作った！', '…ちょっと字が間違っとるが、気にするな！'],
        choices: [
          { label: 'ありがたく受け取る', result: `（部費 +${amount}万円。部員全員の調子が上がった。源造の評価が上がった）${a.text}`, ops: [{ op: 'school', key: 'funds', delta: amount }, form('all', 1), ev('genzo', 3), ...a.ops] },
          {
            label: '「左の相手の話を聞かせてください」',
            result: `源造は、昔苦手だった左腕の話を延々と続けた。（部費 +${Math.round(amount / 2)}万円。源造の評価が上がった。体力が少し減った）${b.text}`,
            ops: [{ op: 'school', key: 'funds', delta: Math.round(amount / 2) }, ev('genzo', 4), stamina(f, -4), ...b.ops],
          },
        ],
      }
    },
    (_save, rng) => {
      const amount = rng.int(30, 40)
      return {
        id: eid('genzo3'),
        title: 'OB会の寄付',
        speaker: { ...GENZO },
        lines: ['OB会で話をつけてきた。…昔の仲間がな、「あの部が戻ってきたなら」と言ってくれてな'],
        choices: [{ label: '深く頭を下げる', result: `（部費 +${amount}万円。源造の評価が上がった）`, ops: [{ op: 'school', key: 'funds', delta: amount }, ev('genzo', 4)] }],
      }
    },
    (_save, rng, f) => {
      const keys = strongest(f, 2)
      const a = fixed(f, rng, FIXED_SKILL_RATE[4]!, 'recover', 'walkoff')
      return {
        id: eid('genzo4'),
        title: '源造の昔話',
        speaker: { ...GENZO },
        relatedPlayerIds: [f.id],
        lines: ['わしもな、昔はこの部で4番を打っとった。…プロのテストも受けたんだ', `${f.surname}、お前にはわしが見られなかった景色を見てほしい`],
        choices: [{ label: '話を最後まで聞く', result: `${f.surname}は、源造の現役時代の練習法を教わった。（${labels(keys)}が上がった。源造の評価が上がった）${a.text}`, ops: [...grow(f, keys, 3), ev('genzo', 5), ...a.ops] }],
      }
    },
    (_save, rng, f) => {
      const amount = rng.int(55, 70)
      const a = fixed(f, rng, FIXED_SKILL_RATE[5]!, 'bench_sun', 'bench_sun')
      return {
        id: eid('genzo5'),
        title: '商店街総出の後援会',
        speaker: { ...GENZO },
        lines: ['商店街の全部の店が、後援会に入ってくれた！', '店先にポスターも貼った。…もう、町じゅうがお前らの味方だ！'],
        choices: [{ label: '部員全員でお礼を言う', result: `（部費 +${amount}万円。部員全員の調子が大きく上がった。源造の評価が大きく上がった。チームメイトの評価が上がった）${a.text}`, ops: [{ op: 'school', key: 'funds', delta: amount }, form('all', 2), ev('genzo', 6), ev('team', 2), ...a.ops] }],
      }
    },
  ],

  // ---------------------------------------------------------------- 蓮見
  hasumi: [
    (_save, rng, f) => {
      const a = fixed(f, rng, FIXED_SKILL_RATE[2]!, 'kaifuku', 'kaifuku')
      return {
        id: eid('hasumi2'),
        title: 'ストレッチ講座',
        speaker: { ...HASUMI },
        relatedPlayerIds: [f.id],
        lines: ['はい、全員集合。今日はケガをしない体の使い方を教えます'],
        choices: [{ label: 'みんなで受ける', result: `（部員全員の体力が回復した。体の強さと回復力が上がった。蓮見の評価が上がった）${a.text}`, ops: [stamina('all', 12), ...grow(f, ['common.durability', 'common.recovery'], 2), ev('hasumi', 3), ...a.ops] }],
      }
    },
    (_save, rng, f) => {
      const a = fixed(f, rng, FIXED_SKILL_RATE[3]!, 'kega_shirazu', 'kega_shirazu')
      return {
        id: eid('hasumi3'),
        title: '早めの手当て',
        speaker: { ...HASUMI },
        relatedPlayerIds: [f.id],
        lines: [`${f.surname}くん、歩き方が少し変ね。…ほら、やっぱり。ここ、痛いでしょう`],
        choices: [
          {
            label: '手当てしてもらう',
            result: `大事になる前に手当てができた。（体力が大きく回復した。ケガや違和感があれば治った。蓮見の評価が上がった）${a.text}`,
            ops: [stamina(f, 35), { op: 'flag', key: `heal:${f.id}`, value: true }, ev('hasumi', 4), ...a.ops],
          },
        ],
      }
    },
    (_save, rng, f) => {
      const a = fixed(f, rng, FIXED_SKILL_RATE[4]!, 'summer_child', 'summer_child')
      return {
        id: eid('hasumi4'),
        title: '蓮見先生の特製ドリンク',
        speaker: { ...HASUMI },
        relatedPlayerIds: [f.id],
        lines: ['はい、これ。わたしの特製ドリンク。…中身は秘密よ'],
        choices: [{ label: '一気に飲む', result: `（体力が全回復した。回復力が上がった。調子が上がった。蓮見の評価が上がった）${a.text}`, ops: [stamina(f, 100), ...grow(f, ['common.recovery'], 3), form(f, 1), ev('hasumi', 4), ...a.ops] }],
      }
    },
    (_save, rng, f) => {
      const bad = f.skills.find((id) => getSkill(id) && !getSkill(id)!.good)
      const a = fixed(f, rng, FIXED_SKILL_RATE[5]!, 'iron_arm', 'rocket_start')
      return {
        id: eid('hasumi5'),
        title: '蓮見先生のひみつ',
        speaker: { ...HASUMI },
        relatedPlayerIds: [f.id],
        lines: ['…昔ね、プロの選手の体を診ていたことがあるの。ずっと昔の話よ', `${f.surname}くんの体は、まだまだ強くなる。わたしが保証するわ`],
        choices: [
          {
            label: '体づくりを一から教わる',
            result: `（体の強さと回復力が大きく上がった。${bad ? `弱点「${getSkill(bad)!.name}」を克服した。` : ''}蓮見の評価が大きく上がった）${a.text}`,
            ops: [...grow(f, ['common.durability', 'common.recovery'], 4), ...(bad ? [{ op: 'skill' as const, playerId: f.id, remove: bad }] : []), stamina(f, 30), ev('hasumi', 6), ...a.ops],
          },
        ],
      }
    },
  ],

  // ---------------------------------------------------------------- 真壁
  makabe: [
    (_save, rng, f) => {
      const keys = f.mainPosition === 'P' ? ['pitching.control'] : ['batting.eye']
      const a = fixed(f, rng, FIXED_SKILL_RATE[2]!, 'no_steal', 'heads_up')
      const b = fixed(f, rng, FIXED_SKILL_RATE[2]!, 'no_steal', 'good_throw')
      return {
        id: eid('makabe2'),
        title: '真壁先生の理論書',
        speaker: { ...MAKABE },
        relatedPlayerIds: [f.id],
        lines: ['本屋で見つけたんだ。『野球の科学』。…半分くらいしか分からなかったけど、君なら役に立つかなって'],
        choices: [
          { label: '走塁の章を読む', result: `（${labels(keys)}が上がった。真壁の評価が上がった）${a.text}`, ops: [...grow(f, keys, 3), ev('makabe', 3), ...a.ops] },
          { label: '送球の章を読む', result: `（${labels(keys)}が上がった。真壁の評価が上がった。体力が少し減った）${b.text}`, ops: [...grow(f, keys, 2), ev('makabe', 3), stamina(f, -3), ...b.ops] },
        ],
      }
    },
    (_save, rng) => {
      const amount = rng.int(15, 25)
      return {
        id: eid('makabe3'),
        title: '職員会議での真壁先生',
        speaker: { ...MAKABE },
        lines: ['職員会議でね、野球部の予算をもう少し増やしてほしいって…言ってみたんだ', '…通ったよ！　僕、初めて会議で発言した！'],
        choices: [{ label: '拍手する', result: `（部費 +${amount}万円。真壁の評価が上がった）`, ops: [{ op: 'school', key: 'funds', delta: amount }, ev('makabe', 4)] }],
      }
    },
    (save, rng, f) => {
      const a = fixed(f, rng, FIXED_SKILL_RATE[4]!, null, 'bunt', 'shield_mitt')
      const lost = f.mainPosition === 'P' && f.skills.includes('sign_lost')
      return {
        id: eid('makabe4'),
        title: 'サインの特訓',
        speaker: { ...MAKABE },
        relatedPlayerIds: [f.id],
        lines: ['朝比奈さんに教わって、サインを全部覚えたんだ。…今日は、僕が出す', 'ええと、帽子、耳、ベルト…バント！'],
        choices: [
          {
            label: '全員でサイン練習をする',
            result: `真壁先生のサインは、意外なほど正確だった。（次の試合まで、作戦が決まりやすくなった。真壁の評価が上がった）${lost ? '弱点「サイン迷子」を克服した！' : ''}${a.text}`,
            ops: [
              { op: 'modifier', modifier: { key: 'tactic', until: absWeek(save) + 6, once: true, label: '真壁先生のサイン特訓' } },
              ev('makabe', 4),
              ev('team', 2),
              ...(lost ? [{ op: 'skill' as const, playerId: f.id, remove: 'sign_lost' }] : []),
              ...a.ops,
            ],
          },
        ],
      }
    },
    (save, rng, f) => ({
      ...makabe5(save, f, fixed(f, rng, FIXED_SKILL_RATE[5]!, 'makezugirai', 'makezugirai')),
    }),
  ],
}

function makabe5(save: SaveData, f: Player, a: { ops: EffectOp[]; text: string }): EventInstance {
  return {
      id: eid('makabe5'),
      title: '真壁先生の覚悟',
      speaker: { ...MAKABE },
      lines: ['…僕、ずっと「名前だけの監督」だった。でも、君たちを見ていて決めたんだ', 'この部の監督として、最後まで責任を持つ。だから、思い切りやってほしい'],
      choices: [
        {
          label: '「よろしくお願いします、監督」',
          result: `部員たちが、初めて真壁先生を「監督」と呼んだ。（4週間、チームの練習の効果が上がる。真壁の評価が大きく上がった。ナギの評価が上がった）${a.text}`,
          ops: [{ op: 'modifier', modifier: { key: 'practice', until: absWeek(save) + 4, label: '真壁監督の覚悟' } }, form('all', 1), ev('makabe', 6), ev('nagi', 2), ...a.ops],
        },
      ],
      relatedPlayerIds: [f.id],
  }
}

/**
 * 蓮見先生の秘密の施術（毎週0.4%の抽選・ゲーム中1回まで）。保健室の奥の秘密の扉の先、秘密の施術室で行われる。
 * 成功しやすさは蓮見の評価しだい（★1で45%〜★5で70%）。
 * 成功すれば第1章でもS・SSクラスが狙えるほど伸び、失敗すれば育成を投げ出したくなるほど落ちる
 */
export function hasumiSecret(save: SaveData, rng: Rng): EventInstance | null {
  const f = focusPlayer(save)
  const s = successOf(save)
  if (!f || !s) return null
  const rate = 0.45 + (evalStars(s.eval.hasumi) - 1) * 0.0625
  const ok = rng.chance(rate)
  const keys = mainKeys(f)
  const direct = (key: string, lo: number, hi: number): EffectOp => {
    const v = rng.int(lo, hi)
    return { op: 'ability', playerId: f.id, key: `direct:${key}`, delta: key === 'pitching.velocity' ? Math.round(v / 2) : v }
  }
  const skills: string[] = []
  if (ok) {
    for (let i = 0; i < 2; i++) {
      const sk = learnable(rng, { ...f, skills: [...f.skills, ...skills] })
      if (sk) skills.push(sk)
    }
  }
  const weeks = rng.int(8, 12)
  const ops: EffectOp[] = ok
    ? [
        { op: 'flag', key: `potential:${f.id}:15`, value: true },
        ...keys.map((k) => direct(k, 15, 20)),
        ...skills.map((sk) => ({ op: 'skill' as const, playerId: f.id, add: sk })),
        ev('hasumi', 8),
      ]
    : [
        { op: 'flag', key: `potential:${f.id}:-15`, value: true },
        ...keys.map((k) => direct(k, -15, -10)),
        { op: 'injury', playerId: f.id, name: '施術の後遺症', weeks },
        ev('hasumi', 2),
      ]
  return {
    id: eid('hasumi_secret'),
    title: '蓮見先生の秘密の施術',
    speaker: { ...HASUMI },
    relatedPlayerIds: [f.id],
    bg: 'bg_secret_room',
    cast: [{ char: 'hasumi', face: 'tease' }],
    lines: [
      `放課後の保健室。蓮見先生が、薬品棚の奥の壁を押した。…音もなく、扉が開く。`,
      '扉の先は、古い器具と革の鞄が並ぶ小さな部屋。「ここは、秘密の施術室よ」',
      `…${f.surname}くん。昔、ある人に教わった施術があるの。うまくいけば、あなたの体は別物になる`,
      'でもね、合わない人もいる。失敗すれば、今までの努力が水の泡になるかもしれない。…どうする？　決めるのは、あなたよ',
    ],
    choices: [
      {
        label: '施術を受ける',
        result: ok
          ? `目を覚ますと、体の奥から信じられないほどの力がわいてくる。「…ふふ、大成功ね」（才能が大きく開花した！${labels(keys)}が大きく上がった。${skills.length ? `特殊能力「${skills.map(skillName).join('」「')}」を身につけた！` : ''}蓮見の評価が上がった）`
          : `目を覚ますと、体が鉛のように重い。「…ごめんなさい。合わなかったみたい」（${labels(keys)}が大きく下がった。体を痛めた（全治${weeks}週）。伸びしろが大きく減った）`,
        ops,
      },
      { label: 'やめておく', result: '「賢明ね。…このことは、誰にも内緒よ」（体力が回復した。蓮見の評価が少し上がった）', ops: [stamina(f, 10), ev('hasumi', 1)] },
    ],
  }
}

/** ★2以上のイベント（★1なら null。呼んだ側で★1のイベントを出す） */
/**
 * 大地のふだんの出来事は、他の固有キャラと同じく2つ（11月25日）：
 * 「居残り練習／バッテリー練習」（board.ts）と、この「幼馴染の本音／二人だけのサイン」。評価による★の段階は使わない
 */
export function daichiSecondEvent(save: SaveData, rng: Rng, f: Player): EventInstance | null {
  const make = EVENTS.daichi[1]
  return make ? make(save, rng, f) : null
}

export function levelEvent(save: SaveData, rng: Rng, person: Person, f: Player): EventInstance | null {
  const lv = pickLevel(save, rng, person)
  if (lv <= 1) return null
  const make = EVENTS[person][lv - 2]
  const e = make ? make(save, rng, f) : null
  return e ? { ...e, title: `${e.title}（${'★'.repeat(lv)}）` } : null
}
