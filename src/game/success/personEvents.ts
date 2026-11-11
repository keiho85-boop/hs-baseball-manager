// 選手育成モード：練習マスに付いた人物のイベント（評価の段階で解放）
// ・評価が★1のときは1種類、★2で1種類増え…★5で5種類。解放済みの中からランダムに起きる
// ・段階の高いイベントほど効果が大きく、起きにくい（★1の重み5、★2は4…★5は1）
// ・★1のイベントは board.ts の attachEvent（これまでのもの）を使う

import type { Rng } from '../rng'
import { ABILITY_LABEL, eid, learnable, mainKeys, skillName } from '../events'
import { getSkill } from '../skills'
import { absWeek } from '../modifiers'
import type { EffectOp, EventInstance, Player, SaveData } from '../types'
import { evalStars, successOf } from './state'
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
  return keys.map((key) => ({ op: 'ability' as const, playerId: p.id, key, delta: key === 'pitching.velocity' ? Math.max(1, Math.round(delta / 2)) : delta }))
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
  return rng.weighted(Array.from({ length: stars }, (_, i) => ({ value: i + 1, weight: 6 - (i + 1) })))
}

type Maker = (save: SaveData, rng: Rng, f: Player) => EventInstance

/** ★2〜★5のイベント（添字0が★2） */
const EVENTS: Record<Person, Maker[]> = {
  // ---------------------------------------------------------------- スカウト
  scout: [
    (save, _rng, f) => {
      const s = successOf(save)!
      const gain = s.scoutFocus ? 5 : 3
      return {
        id: eid('scout2'),
        title: 'スカウトの名刺',
        speaker: { ...SCOUT },
        relatedPlayerIds: [f.id],
        lines: [`練習の終わり、帽子の男が近づいてきた。「${f.surname}くん、だね」`, '差し出された名刺には、プロ球団の名前が印刷されている。'],
        choices: [
          { label: '帽子を取って、あいさつする', result: `「礼儀もいい。…覚えておくよ」（スカウトの評価が上がった。調子が上がった）`, ops: [ev('scout', gain), form(f, 1)] },
          { label: '緊張して固まる', result: '「ははは、そんなに硬くならなくていい」（スカウトの評価が少し上がった）', ops: [ev('scout', Math.round(gain / 2))] },
        ],
      }
    },
    (_save, _rng, f) => {
      const keys = strongest(f, 2)
      return {
        id: eid('scout3'),
        title: '見せ場をつくる',
        speaker: { ...SCOUT },
        relatedPlayerIds: [f.id],
        lines: ['今日は、スカウトが二人。ストップウォッチとスピードガンが並んでいる。', `ナギ「${f.surname}くん。得意なところを、思い切り見せてください」`],
        choices: [
          { label: '得意なプレーを見せる', result: `${f.surname}の持ち味が光った。（${labels(keys)}が上がった。スカウトの評価が上がった）`, ops: [...grow(f, keys, 2), ev('scout', 4)] },
        ],
      }
    },
    (_save, _rng, f) => {
      const keys = weakest(f, 2)
      const bad = f.skills.find((id) => getSkill(id) && !getSkill(id)!.good)
      return {
        id: eid('scout4'),
        title: 'スカウトの助言',
        speaker: { ...SCOUT },
        relatedPlayerIds: [f.id],
        lines: ['「独り言だと思って聞いてくれ。プロで生き残るのは、長所が一つ突き抜けているやつか、穴がないやつだ」'],
        choices: [
          { label: '長所を伸ばす', result: `${f.surname}は、得意なことを磨き続けた。（${labels(strongest(f, 1))}が大きく上がった。スカウトの評価が上がった）`, ops: [...grow(f, strongest(f, 1), 4), ev('scout', 4)] },
          {
            label: '穴をなくす',
            result: bad ? `${f.surname}は、苦手を一つずつつぶした。（弱点「${getSkill(bad)!.name}」を克服した。スカウトの評価が上がった）` : `${f.surname}は、苦手を一つずつつぶした。（${labels(keys)}が上がった。スカウトの評価が上がった）`,
            ops: [...(bad ? [{ op: 'skill' as const, playerId: f.id, remove: bad }] : grow(f, keys, 3)), ev('scout', 4)],
          },
        ],
      }
    },
    (_save, rng, f) => {
      const skill = rng.chance(0.6) ? learnable(rng, f) : null
      const keys = mainKeys(f)
      const ops: EffectOp[] = [...grow(f, keys, 2), ev('scout', 8), form(f, 2)]
      if (skill) ops.push({ op: 'skill', playerId: f.id, add: skill })
      return {
        id: eid('scout5'),
        title: '球団幹部の視察',
        speaker: { ...SCOUT },
        relatedPlayerIds: [f.id],
        lines: ['バックネット裏に、スーツ姿の男たちが並んだ。いつものスカウトが、その後ろで小さくうなずく。', '「部長、あれが例の…」'],
        choices: [
          {
            label: '全力で応える',
            result: `${f.surname}は、この日いちばんのプレーを見せた。（${labels(keys)}が上がった。スカウトの評価が大きく上がった）${skill ? `特殊能力「${skillName(skill)}」を身につけた！` : ''}`,
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
      return {
        id: eid('nagi2'),
        title: 'ナギの分析データ',
        speaker: { ...NAGI },
        relatedPlayerIds: [f.id],
        lines: ['県内の主な投手と打者を、全部まとめておきました。', `${f.surname}くんに合わせた練習も、書いてあります`],
        choices: [{ label: 'ノートどおりに練習する', result: `（${labels(keys)}が上がった。ナギの評価が上がった）`, ops: [...grow(f, keys, 2), ev('nagi', 3)] }],
      }
    },
    (_save, rng, f) => {
      const keys = rng.shuffle(mainKeys(f)).slice(0, 3)
      return {
        id: eid('nagi3'),
        title: 'ナギの特別メニュー',
        speaker: { ...NAGI },
        relatedPlayerIds: [f.id],
        lines: ['今日だけ、練習メニューを変えます。きついですよ', '…できないと思ったら、言ってください。止めますから'],
        choices: [
          { label: '最後までやり切る', result: `${f.surname}は、膝に手をつきながらもやり切った。（${labels(keys)}が上がった。体力が減った。ナギの評価が上がった）`, ops: [...grow(f, keys, 2), stamina(f, -12), ev('nagi', 4)] },
          { label: '途中で止めてもらう', result: '「賢明です」（ナギの評価が少し上がった）', ops: [...grow(f, keys.slice(0, 1), 1), ev('nagi', 1)] },
        ],
      }
    },
    (_save, rng, f) => {
      const skill = learnable(rng, f)
      return {
        id: eid('nagi4'),
        title: '名将の目',
        speaker: { ...NAGI },
        relatedPlayerIds: [f.id],
        lines: [`${f.surname}くん。…あなたは、ここぞの場面で力を出せる人です`, 'ナギ（心）：四十年見てきた。こういう目をした選手は、化ける'],
        choices: [
          {
            label: 'ナギの言葉を信じる',
            result: skill ? `（特殊能力「${skillName(skill)}」を身につけた！ナギの評価が上がった）` : `（${labels(strongest(f, 2))}が上がった。ナギの評価が上がった）`,
            ops: [...(skill ? [{ op: 'skill' as const, playerId: f.id, add: skill }] : grow(f, strongest(f, 2), 3)), ev('nagi', 4)],
          },
        ],
      }
    },
    (_save, rng, f) => {
      const skill = rng.chance(0.5) ? learnable(rng, f) : null
      const keys = mainKeys(f)
      const ops: EffectOp[] = [...grow(f, keys, 3), form(f, 2), ev('nagi', 6)]
      if (skill) ops.push({ op: 'skill', playerId: f.id, add: skill })
      return {
        id: eid('nagi5'),
        title: '二人だけの居残り練習',
        speaker: { ...NAGI },
        relatedPlayerIds: [f.id],
        lines: ['日が暮れたグラウンド。ナギが、ノックバットを握っている。', '…今日は、私が直接見ます。最後まで、付いてきてください'],
        choices: [
          {
            label: 'はい！',
            result: `ナギのノックは、驚くほど正確だった。（${labels(keys)}が上がった。ナギの評価が大きく上がった）${skill ? `特殊能力「${skillName(skill)}」を身につけた！` : ''}`,
            ops,
          },
        ],
      }
    },
  ],

  // ---------------------------------------------------------------- 大地
  daichi: [
    (_save, _rng, f) => {
      const keys = f.mainPosition === 'P' ? ['pitching.velocity', 'pitching.stamina'] : ['batting.power', 'running.speed']
      return {
        id: eid('daichi2'),
        title: f.mainPosition === 'P' ? '大地との投げ込み' : '大地と素振り対決',
        speaker: { ...DAICHI },
        relatedPlayerIds: [f.id],
        lines: f.mainPosition === 'P' ? ['あと50球！　…俺のミットが痛くなるまで投げてみろ'] : ['どっちが先に500本振れるか、勝負な！'],
        choices: [{ label: '受けて立つ', result: `（${labels(keys)}が上がった。体力が減った。大地の評価が上がった）`, ops: [...grow(f, keys, 2), stamina(f, -8), ev('daichi', 4)] }],
      }
    },
    (_save, _rng, f) => ({
      id: eid('daichi3'),
      title: '幼馴染の本音',
      speaker: { ...DAICHI },
      relatedPlayerIds: [f.id],
      lines: ['帰り道。大地が、ぽつりと言った。', `なあ${f.surname}。お前がプロに行ったらさ…俺、店番しながらテレビで応援するよ`],
      choices: [
        { label: '「お前も一緒に上を目指せよ」', result: '「…へっ、言ったな」（部員全員の調子が上がった。大地の評価が上がった。チームメイトの評価が上がった）', ops: [form('all', 1), ev('daichi', 5), ev('team', 2)] },
        { label: '「…ありがとな」', result: '二人とも、しばらく黙って歩いた。（大地の評価が上がった）', ops: [ev('daichi', 5), form(f, 1)] },
      ],
    }),
    (_save, _rng, f) => {
      const pitcher = f.mainPosition === 'P'
      const keys = pitcher ? ['pitching.control', 'pitching.kire'] : ['batting.contact', 'batting.eye']
      return {
        id: eid('daichi4'),
        title: pitcher ? '大地のリード論' : '大地の配球読み',
        speaker: { ...DAICHI },
        relatedPlayerIds: [f.id],
        lines: pitcher ? ['いいか、困ったら外の低め。俺がそこに構える。…お前は、そこだけ信じて投げろ'] : ['捕手から見るとな、投手ってカウントごとに投げたい球が決まってるんだよ。教えてやる'],
        choices: [{ label: 'じっくり聞く', result: `（${labels(keys)}が大きく上がった。大地の評価が上がった）`, ops: [...grow(f, keys, 3), ev('daichi', 5)] }],
      }
    },
    (_save, rng, f) => {
      const skill = learnable(rng, f)
      const keys = mainKeys(f).slice(0, 3)
      const ops: EffectOp[] = [...grow(f, keys, 3), ev('daichi', 7), ev('team', 3)]
      if (skill) ops.push({ op: 'skill', playerId: f.id, add: skill })
      return {
        id: eid('daichi5'),
        title: f.mainPosition === 'P' ? '最強のバッテリー' : '最強のコンビ',
        speaker: { ...DAICHI },
        relatedPlayerIds: [f.id],
        lines: ['夕暮れのグラウンドに、二人きり。言葉はいらなかった。', '…なあ、俺たち、もっと上に行けるよな'],
        choices: [
          {
            label: '「行こう。二人で」',
            result: `（${labels(keys)}が大きく上がった。大地の評価が大きく上がった）${skill ? `特殊能力「${skillName(skill)}」を身につけた！` : ''}`,
            ops,
          },
        ],
      }
    },
  ],

  // ---------------------------------------------------------------- 源造
  genzo: [
    (_save, rng) => {
      const amount = rng.int(15, 25)
      return {
        id: eid('genzo2'),
        title: '商店街の応援団',
        speaker: { ...GENZO },
        lines: ['おう！　商店街で応援団を作ったぞ！　のぼりも作った！', '…ちょっと字が間違っとるが、気にするな！'],
        choices: [{ label: 'ありがたく受け取る', result: `（部費 +${amount}万円。部員全員の調子が上がった。源造の評価が上がった）`, ops: [{ op: 'school', key: 'funds', delta: amount }, form('all', 1), ev('genzo', 3)] }],
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
    (_save, _rng, f) => {
      const keys = strongest(f, 2)
      return {
        id: eid('genzo4'),
        title: '源造の昔話',
        speaker: { ...GENZO },
        relatedPlayerIds: [f.id],
        lines: ['わしもな、昔はこの部で4番を打っとった。…プロのテストも受けたんだ', `${f.surname}、お前にはわしが見られなかった景色を見てほしい`],
        choices: [{ label: '話を最後まで聞く', result: `${f.surname}は、源造の現役時代の練習法を教わった。（${labels(keys)}が上がった。源造の評価が上がった）`, ops: [...grow(f, keys, 3), ev('genzo', 5)] }],
      }
    },
    (_save, rng) => {
      const amount = rng.int(55, 70)
      return {
        id: eid('genzo5'),
        title: '商店街総出の後援会',
        speaker: { ...GENZO },
        lines: ['商店街の全部の店が、後援会に入ってくれた！', '店先にポスターも貼った。…もう、町じゅうがお前らの味方だ！'],
        choices: [{ label: '部員全員でお礼を言う', result: `（部費 +${amount}万円。部員全員の調子が大きく上がった。源造の評価が大きく上がった。チームメイトの評価が上がった）`, ops: [{ op: 'school', key: 'funds', delta: amount }, form('all', 2), ev('genzo', 6), ev('team', 2)] }],
      }
    },
  ],

  // ---------------------------------------------------------------- 蓮見
  hasumi: [
    (_save, _rng, f) => ({
      id: eid('hasumi2'),
      title: 'ストレッチ講座',
      speaker: { ...HASUMI },
      relatedPlayerIds: [f.id],
      lines: ['はい、全員集合。今日はケガをしない体の使い方を教えます'],
      choices: [{ label: 'みんなで受ける', result: '（部員全員の体力が回復した。体の強さと回復力が上がった。蓮見の評価が上がった）', ops: [stamina('all', 12), ...grow(f, ['common.durability', 'common.recovery'], 2), ev('hasumi', 3)] }],
    }),
    (_save, _rng, f) => ({
      id: eid('hasumi3'),
      title: '早めの手当て',
      speaker: { ...HASUMI },
      relatedPlayerIds: [f.id],
      lines: [`${f.surname}くん、歩き方が少し変ね。…ほら、やっぱり。ここ、痛いでしょう`],
      choices: [
        {
          label: '手当てしてもらう',
          result: '大事になる前に手当てができた。（体力が大きく回復した。ケガや違和感があれば治った。蓮見の評価が上がった）',
          ops: [stamina(f, 35), { op: 'flag', key: `heal:${f.id}`, value: true }, ev('hasumi', 4)],
        },
      ],
    }),
    (_save, _rng, f) => ({
      id: eid('hasumi4'),
      title: '蓮見先生の特製ドリンク',
      speaker: { ...HASUMI },
      relatedPlayerIds: [f.id],
      lines: ['はい、これ。わたしの特製ドリンク。…中身は秘密よ'],
      choices: [{ label: '一気に飲む', result: '（体力が全回復した。回復力が上がった。調子が上がった。蓮見の評価が上がった）', ops: [stamina(f, 100), ...grow(f, ['common.recovery'], 3), form(f, 1), ev('hasumi', 4)] }],
    }),
    (_save, _rng, f) => {
      const bad = f.skills.find((id) => getSkill(id) && !getSkill(id)!.good)
      return {
        id: eid('hasumi5'),
        title: '蓮見先生のひみつ',
        speaker: { ...HASUMI },
        relatedPlayerIds: [f.id],
        lines: ['…昔ね、プロの選手の体を診ていたことがあるの。ずっと昔の話よ', `${f.surname}くんの体は、まだまだ強くなる。わたしが保証するわ`],
        choices: [
          {
            label: '体づくりを一から教わる',
            result: `（体の強さと回復力が大きく上がった。${bad ? `弱点「${getSkill(bad)!.name}」を克服した。` : ''}蓮見の評価が大きく上がった）`,
            ops: [...grow(f, ['common.durability', 'common.recovery'], 4), ...(bad ? [{ op: 'skill' as const, playerId: f.id, remove: bad }] : []), stamina(f, 30), ev('hasumi', 6)],
          },
        ],
      }
    },
  ],

  // ---------------------------------------------------------------- 真壁
  makabe: [
    (_save, _rng, f) => {
      const keys = f.mainPosition === 'P' ? ['pitching.control'] : ['batting.eye']
      return {
        id: eid('makabe2'),
        title: '真壁先生の理論書',
        speaker: { ...MAKABE },
        relatedPlayerIds: [f.id],
        lines: ['本屋で見つけたんだ。『野球の科学』。…半分くらいしか分からなかったけど、君なら役に立つかなって'],
        choices: [{ label: '読んでみる', result: `（${labels(keys)}が上がった。真壁の評価が上がった）`, ops: [...grow(f, keys, 3), ev('makabe', 3)] }],
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
    (save) => ({
      id: eid('makabe4'),
      title: 'サインの特訓',
      speaker: { ...MAKABE },
      lines: ['朝比奈さんに教わって、サインを全部覚えたんだ。…今日は、僕が出す', 'ええと、帽子、耳、ベルト…バント！'],
      choices: [
        {
          label: '全員でサイン練習をする',
          result: '真壁先生のサインは、意外なほど正確だった。（次の試合まで、作戦が決まりやすくなった。真壁の評価が上がった）',
          ops: [{ op: 'modifier', modifier: { key: 'tactic', until: absWeek(save) + 6, once: true, label: '真壁先生のサイン特訓' } }, ev('makabe', 4), ev('team', 2)],
        },
      ],
    }),
    (save) => ({
      id: eid('makabe5'),
      title: '真壁先生の覚悟',
      speaker: { ...MAKABE },
      lines: ['…僕、ずっと「名前だけの監督」だった。でも、君たちを見ていて決めたんだ', 'この部の監督として、最後まで責任を持つ。だから、思い切りやってほしい'],
      choices: [
        {
          label: '「よろしくお願いします、監督」',
          result: '部員たちが、初めて真壁先生を「監督」と呼んだ。（4週間、チームの練習の効果が上がる。真壁の評価が大きく上がった。ナギの評価が上がった）',
          ops: [{ op: 'modifier', modifier: { key: 'practice', until: absWeek(save) + 4, label: '真壁監督の覚悟' } }, form('all', 1), ev('makabe', 6), ev('nagi', 2)],
        },
      ],
    }),
  ],
}

/** ★2以上のイベント（★1なら null。呼んだ側で★1のイベントを出す） */
export function levelEvent(save: SaveData, rng: Rng, person: Person, f: Player): EventInstance | null {
  const lv = pickLevel(save, rng, person)
  if (lv <= 1) return null
  const make = EVENTS[person][lv - 2]
  const e = make ? make(save, rng, f) : null
  return e ? { ...e, title: `${e.title}（${'★'.repeat(lv)}）` } : null
}
