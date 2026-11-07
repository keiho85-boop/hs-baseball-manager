// 季節の行事とレアイベント（週の初めに、順番に出す）
// 構想書19節「共通イベントの追加」「レアイベント」を、第1章の時代（ナギがマネージャー）に合わせたもの。
// ストーリーなしで遊ぶときは、マネージャーや部員の台詞で同じ出来事が起きる。
// 結果は作る時点で決めておく（乱数を先に使うので、やり直しても同じ結果になる）。

import { Rng } from './rng'
import { SEASON_WEEKS } from './constants'
import { findTournament, type Tournament, type TournamentKind } from './tournament'
import { playerRating } from './player'
import { ABILITY_LABEL, eid, learnable, mainKeys, players, skillName, story } from './events'
import { SKILLS } from './skills'
import { absWeek } from './modifiers'
import type { EffectOp, EventInstance, Player, SaveData, Speaker } from './types'

// ---------------------------------------------------------------- 話し手

/** マネージャー（ストーリーありならナギ） */
function mgr(save: SaveData): Speaker {
  return story(save) ? { kind: 'manager', name: 'ナギ', portrait: 'nagi' } : { kind: 'manager', name: 'マネージャー' }
}
const NARR: Speaker = { kind: 'narration', name: '' }
const GENZO: Speaker = { kind: 'local', name: '日向源造（商店会長）', portrait: 'genzo' }
function playerSpeaker(p: Player): Speaker {
  return { kind: 'player', playerId: p.id }
}

// ---------------------------------------------------------------- 小さな道具

function flags(save: SaveData): Record<string, string | number | boolean> {
  return (save.flags ??= {})
}
/** 今年まだ起きていなければ印を付けて true */
function onceThisYear(save: SaveData, key: string): boolean {
  const k = `ev:${key}:${save.calendar.year}`
  if (flags(save)[k] !== undefined) return false
  flags(save)[k] = true
  return true
}
function onceEver(save: SaveData, key: string): boolean {
  const k = `ev:${key}`
  if (flags(save)[k] !== undefined) return false
  flags(save)[k] = true
  return true
}
function members(save: SaveData): Player[] {
  return players(save)
}
function captainOf(save: SaveData, list: Player[]): Player | undefined {
  const id = save.story?.captainId
  const c = id ? list.find((p) => p.id === id) : undefined
  return c ?? [...list].sort((a, b) => b.grade - a.grade || playerRating(b) - playerRating(a))[0]
}
function abilityOps(p: Player, keys: string[], delta: number): EffectOp[] {
  return keys.map((key) => ({ op: 'ability' as const, playerId: p.id, key, delta: key === 'pitching.velocity' ? Math.max(1, Math.round(delta / 2)) : delta }))
}
const STRENGTH_KEY: Record<string, string> = {
  velocity: 'pitching.velocity',
  control: 'pitching.control',
  stamina: 'pitching.stamina',
  contact: 'batting.contact',
  power: 'batting.power',
  speed: 'running.speed',
  arm: 'fielding.arm',
  range: 'fielding.range',
}

// ---------------------------------------------------------------- 年中行事

/** 新入部員の勧誘（4月第2週、2年目以降） */
function recruitEvent(save: SaveData, rng: Rng): EventInstance {
  const success = rng.chance(0.5)
  return {
    id: eid('recruit'),
    title: '新入部員の勧誘',
    speaker: mgr(save),
    lines: story(save)
      ? ['新入部員の勧誘の季節です。', 'ビラを配りますか？　それとも、グラウンドで実際に練習を見てもらいますか？']
      : ['監督、新入部員の勧誘の季節です。', 'どうやって、部の良さを伝えましょうか？'],
    choices: [
      {
        label: 'ビラを配る',
        result: 'ビラを見た1年生が、もう1人入部した！',
        ops: [{ op: 'recruit', grade: 1, boost: 0, motivation: 60, note: '勧誘のビラを見て入部した。' }],
      },
      {
        label: 'グラウンドで実演する',
        result: success ? '練習を見て目を輝かせた、筋のいい1年生が入部した！' : '見学は多かったが、入部にはつながらなかった。（部員たちは張り切った）',
        ops: success
          ? [{ op: 'recruit', grade: 1, boost: 14, motivation: 70, note: '練習の実演を見て入部した。' }]
          : [{ op: 'condition', playerId: 'all', key: 'motivation', delta: 3 }],
      },
    ],
  }
}

/** テスト期間（7月・12月） */
function testEvent(save: SaveData, rng: Rng, list: Player[]): EventInstance {
  const p = rng.pick(list)
  const pass = rng.chance(0.5)
  return {
    id: eid('test'),
    title: 'テスト期間',
    speaker: playerSpeaker(p),
    relatedPlayerIds: [p.id],
    lines: ['…数学、赤点かもしれません。', 'テストが終わるまで、練習どころじゃなくて…'],
    choices: [
      {
        label: '練習を休ませて勉強させる',
        result: `${p.surname}はしっかり勉強して、赤点を免れた。（体力は回復したが、少し練習不足）`,
        ops: [
          { op: 'condition', playerId: p.id, key: 'stamina', delta: 20 },
          { op: 'condition', playerId: p.id, key: 'motivation', delta: -3 },
        ],
      },
      {
        label: story(save) ? '練習の後に、ナギが勉強を見る' : '練習の後に、勉強を見てあげる',
        result: pass
          ? `${p.surname}は赤点を回避した！（やる気が上がった）${story(save) ? '　ナギ（心）：…連立方程式なら、今は得意だ' : ''}`
          : `健闘むなしく赤点…。${p.surname}は1週間、補習で練習に出られない。`,
        ops: pass ? [{ op: 'condition', playerId: p.id, key: 'motivation', delta: 5 }] : [{ op: 'injury', playerId: p.id, name: '補習', weeks: 1 }],
      },
    ],
  }
}

/** 体育祭（9月）：部活対抗リレー */
function sportsDayEvent(save: SaveData, rng: Rng, list: Player[]): EventInstance {
  const win = rng.chance(0.55)
  return {
    id: eid('sports'),
    title: '体育祭',
    speaker: NARR,
    lines: ['体育祭の部活対抗リレー。野球部は、陸上部に勝負を挑んだ。', '「野球部の足、見せてやりましょう！」'],
    choices: [
      {
        label: story(save) ? 'ぶっちぎってください！' : '全力で走れ！',
        result: win ? '最後の直線で抜き去り、野球部が勝った！（全員の走力が少し上がった）' : 'わずかに届かず、陸上部の勝ち…。（全員のやる気が少し下がった）',
        ops: win
          ? list.map((p) => ({ op: 'ability' as const, playerId: p.id, key: 'running.speed', delta: 1 }))
          : [{ op: 'condition', playerId: 'all', key: 'motivation', delta: -3 }],
      },
    ],
  }
}

/** 台風（9月、抽選） */
function typhoonEvent(save: SaveData): EventInstance {
  const now = absWeek(save)
  return {
    id: eid('typhoon'),
    title: '台風',
    speaker: mgr(save),
    lines: ['台風が近づいていて、今日はグラウンドが使えません。', story(save) ? '部室で、去年の試合の映像を見ましょうか？' : 'どうしましょうか、監督。'],
    choices: [
      {
        label: '室内で座学をする',
        result: 'サインと作戦の確認をみっちり行った。（次の試合、作戦が決まりやすい）',
        ops: [{ op: 'modifier', modifier: { key: 'tactic', until: now + 8, once: true, label: '台風の日の座学' } }],
      },
      {
        label: '全員帰す',
        result: '部員たちは家でゆっくり休んだ。（全員の体力が回復した）',
        ops: [{ op: 'condition', playerId: 'all', key: 'stamina', delta: 15 }],
      },
    ],
  }
}

/** 文化祭（10月） */
function festivalEvent(save: SaveData, rng: Rng, list: Player[]): EventInstance {
  const p = rng.pick(list)
  return {
    id: eid('festival'),
    title: '文化祭',
    speaker: playerSpeaker(p),
    relatedPlayerIds: [p.id],
    lines: [
      '野球部の出し物は、ストラックアウトです！',
      story(save) ? 'マネージャーもやります？　…え、全部抜いた！？' : '監督もやります？',
    ],
    choices: [
      {
        label: '大いに盛り上げよう',
        result: '野球部のストラックアウトは大盛況だった。（評判が少し上がり、全員のやる気が上がった）',
        ops: [
          { op: 'school', key: 'reputation', delta: 1 },
          { op: 'condition', playerId: 'all', key: 'motivation', delta: 6 },
        ],
      },
    ],
  }
}

/** 修学旅行（11月、2年生） */
function schoolTripEvent(save: SaveData, rng: Rng, second: Player[]): EventInstance {
  const p = rng.pick(second)
  return {
    id: eid('trip'),
    title: '修学旅行',
    speaker: playerSpeaker(p),
    relatedPlayerIds: [p.id],
    lines: [story(save) ? 'マネージャー、お土産です。…木刀です。' : '監督、お土産です。…木刀です。', '素振りに使えるかなって。'],
    choices: [
      {
        label: '…なんで木刀？',
        result: '2年生は旅行を楽しんで、元気に帰ってきた。（2年生のやる気と体力が上がった）',
        ops: second.flatMap((x) => [
          { op: 'condition' as const, playerId: x.id, key: 'motivation' as const, delta: 5 },
          { op: 'condition' as const, playerId: x.id, key: 'stamina' as const, delta: 15 },
        ]),
      },
    ],
  }
}

/** クリスマス（12月） */
function christmasEvent(save: SaveData): EventInstance {
  return {
    id: eid('christmas'),
    title: 'クリスマス',
    speaker: mgr(save),
    lines: story(save)
      ? ['今日の練習の後は、部室でささやかなクリスマス会です。', 'ケーキを焼いてきました。…形は、少し崩れましたけど。']
      : ['今日の練習の後は、部室でクリスマス会です！', 'ケーキも用意しましたよ。'],
    choices: [
      {
        label: 'みんなで食べよう',
        result: '部員たちはケーキを分け合って、すっかり元気になった。（全員の体力が回復した）',
        ops: [{ op: 'condition', playerId: 'all', key: 'stamina', delta: 15 }],
      },
    ],
  }
}

/** 初詣（1月第1週、必ず起きる）。まれに、お守りが光る */
function hatsumodeEvent(save: SaveData, rng: Rng): EventInstance {
  const glow = rng.chance(0.03)
  const y = save.calendar.year + 1
  const ops: EffectOp[] = [{ op: 'condition', playerId: 'all', key: 'motivation', delta: 3 }]
  if (glow) ops.push({ op: 'modifier', modifier: { key: 'form', from: absWeek(save, y, 15), until: absWeek(save, y, 21), label: '光るお守り' } })
  return {
    id: eid('hatsumode'),
    title: '初詣',
    speaker: NARR,
    lines: ['部員みんなで、商店街の奥の小さな神社「白球稲荷」へ初詣に行った。', '拝殿の横には、奉納された古いボールが山のように積まれている。'],
    choices: [
      {
        label: '今年の必勝を祈る',
        result: glow
          ? `お守り袋の中で、小さな球が一瞬、白く光った…。（夏の大会の間、部員全員の調子が上がる）${story(save) ? '　ナギ（心）：…まさか、また入れ替わったりせんじゃろうな' : ''}`
          : '部員たちは、気持ちを新たにした。（全員のやる気が上がった）',
        ops,
      },
    ],
  }
}

/** OB戦（1月） */
function obGameEvent(save: SaveData, rng: Rng): EventInstance {
  const win = rng.chance(0.5)
  const now = absWeek(save)
  return {
    id: eid('obgame'),
    title: 'OB戦',
    speaker: story(save) ? GENZO : NARR,
    lines: story(save)
      ? ['今年もOB戦の季節だ！　現役には負けんぞ。', '捕手はこのわしがやる。手加減はせんからな！']
      : ['新年恒例のOB戦。卒業生たちがグラウンドに集まった。', '「現役には、まだまだ負けないぞ」'],
    choices: [
      {
        label: '胸を借りよう',
        result: win
          ? '現役チームがOBに勝った！（全員のやる気が上がった）'
          : 'OBチームの意地に押し切られた…。悔しさで、部員たちの練習に熱が入っている。（1か月、練習の効果が上がる）',
        ops: win
          ? [{ op: 'condition', playerId: 'all', key: 'motivation', delta: 5 }]
          : [{ op: 'modifier', modifier: { key: 'practice', until: now + 4, label: 'OB戦の悔しさ' } }],
      },
    ],
  }
}

/** 春の全国大会の発表（1月）。秋季大会で決勝まで進んだときだけ */
function selectionEvent(save: SaveData, autumn: Tournament): EventInstance {
  const own = save.playerSchoolId
  const won = autumn.championId === own
  return {
    id: eid('selection'),
    title: '春の全国大会の発表',
    speaker: mgr(save),
    lines: ['部室で、みんなで連絡を待っています。', '…電話、鳴りました！'],
    choices: [
      {
        label: '結果を聞く',
        result: won
          ? '秋季大会の優勝校として、春の全国大会への出場が決まった！（全員のやる気が大きく上がった）'
          : `今年は選ばれなかった。${story(save) ? 'ナギ「悔しいなら、夏に取り返しましょう」' : '悔しさを、夏にぶつけよう。'}（全員のやる気が少し上がった）`,
        ops: [{ op: 'condition', playerId: 'all', key: 'motivation', delta: won ? 10 : 3 }],
      },
    ],
  }
}

/** バレンタイン（2月） */
function valentineEvent(save: SaveData): EventInstance {
  return {
    id: eid('valentine'),
    title: 'バレンタイン',
    speaker: mgr(save),
    lines: story(save)
      ? ['みなさん、お疲れさまです。今日はチョコです。', '一つずつ、名前を書いておきました。…義理ですよ？　全員分、平等です。']
      : ['今日はバレンタインなので、全員分のチョコを用意しました！', '…義理ですからね？'],
    choices: [
      {
        label: 'ありがたくいただこう',
        result: '部員たちは大喜びだった。（全員のやる気が上がった）',
        ops: [{ op: 'condition', playerId: 'all', key: 'motivation', delta: 3 }],
      },
    ],
  }
}

/** 卒業式（3月、必ず起きる）。ストーリーの3年目は章の場面があるので起きない */
function graduationEvent(save: SaveData, seniors: Player[]): EventInstance | null {
  const p = [...seniors].sort((a, b) => playerRating(b) - playerRating(a))[0]
  if (!p) return null
  return {
    id: eid('graduation'),
    title: '卒業式',
    speaker: playerSpeaker(p),
    relatedPlayerIds: [p.id],
    lines: story(save)
      ? ['朝比奈。…3年間、この部にいてよかったよ。', 'あとは、こいつらを頼む。']
      : ['監督。…この部に入って、よかったです。', '後輩たちを、よろしくお願いします。'],
    choices: [
      {
        label: '卒業、おめでとう',
        result: '3年生が、グラウンドに一礼して去っていった。（1・2年生のやる気が上がった）',
        ops: [{ op: 'condition', playerId: 'all', key: 'motivation', delta: 3 }],
      },
    ],
  }
}

/** 引退の日（3年生が引退した週）：後輩に特殊能力を受け継ぐことがある */
function retireDayEvent(save: SaveData, rng: Rng, retired: Player[], juniors: Player[]): EventInstance | null {
  if (retired.length === 0 || juniors.length === 0) return null
  const cap = [...retired].sort((a, b) => playerRating(b) - playerRating(a))[0]!
  const goodSkills = cap.skills.filter((id) => SKILLS.find((s) => s.id === id)?.good)
  const ops: EffectOp[] = [{ op: 'condition', playerId: 'all', key: 'motivation', delta: 5 }]
  let text = '1・2年生は、先輩の言葉を胸に刻んだ。（全員のやる気が上がった）'
  if (goodSkills.length && rng.chance(0.3)) {
    const skill = rng.pick(goodSkills)
    const def = SKILLS.find((s) => s.id === skill)!
    const heirs = juniors.filter((p) => !p.skills.includes(skill) && (def.target === 'all' || (def.target === 'pitcher') === (p.mainPosition === 'P')))
    if (heirs.length) {
      const heir = rng.pick(heirs)
      ops.push({ op: 'skill', playerId: heir.id, add: skill })
      text = `${heir.surname}は、${cap.surname}から「${skillName(skill)}」を受け継いだ！`
    }
  }
  return {
    id: eid('retire'),
    title: '引退の日',
    speaker: playerSpeaker(cap),
    relatedPlayerIds: [cap.id],
    lines: ['3年生が一人ずつ、後輩に言葉を残していく。', 'お前らなら、俺たちの行けなかった場所まで行ける。…頼んだぞ。'],
    choices: [{ label: '先輩の思いを受け取る', result: text, ops }],
  }
}

// ---------------------------------------------------------------- 合宿

/** 合宿の初日：カレー */
function campCurryEvent(save: SaveData): EventInstance {
  return {
    id: eid('curry'),
    title: '合宿：夕食はカレー',
    speaker: mgr(save),
    lines: story(save)
      ? ['合宿の夕食は、カレーです！　おかわりもたくさんあります。', '食べるのも練習です。…って、祖父がよく言っていたので。']
      : ['合宿の夕食は、カレーです！', 'たくさん食べて、明日に備えましょう。'],
    choices: [
      {
        label: 'しっかり食べろ',
        result: '部員たちは、山盛りのカレーを平らげた。（全員の体力が回復した）',
        ops: [{ op: 'condition', playerId: 'all', key: 'stamina', delta: 8 }],
      },
    ],
  }
}

/** 合宿のレアイベント（1回の合宿で最大1つ） */
function campRareEvent(save: SaveData, rng: Rng, list: Player[]): EventInstance | null {
  const tired = list.filter((p) => p.condition.stamina < 35 && !p.storyCast)
  const pros = save.alumni.filter((a) => a.career === 'pro')
  const kinds = ['swing', 'study', 'mvp', 'ghost', ...(tired.length ? ['limit'] : []), ...(pros.length ? ['pro'] : [])]
  // 川向こうの球場は5%
  const kind = rng.chance(0.05) ? 'river' : rng.pick(kinds)
  if (kind === 'swing') {
    const p = rng.pick(list.filter((x) => x.mainPosition !== 'P').length ? list.filter((x) => x.mainPosition !== 'P') : list)
    return {
      id: eid('camp-swing'),
      title: '合宿：夜の素振り',
      speaker: NARR,
      relatedPlayerIds: [p.id],
      lines: [`消灯の後、宿舎の裏で${p.surname}が一人で素振りをしている。`, '空を切る音が、いつまでも続いている。'],
      choices: [
        {
          label: '付き合う',
          result: `夜遅くまでバットを振り込んだ。${p.surname}の打撃が大きく伸びた！（体力は大きく減った）`,
          ops: [
            { op: 'ability', playerId: p.id, key: 'batting.contact', delta: 3 },
            { op: 'ability', playerId: p.id, key: 'batting.power', delta: 3 },
            { op: 'condition', playerId: p.id, key: 'stamina', delta: -25 },
          ],
        },
        {
          label: '寝かせる',
          result: `${p.surname}は素直に布団に入った。（体力が回復し、やる気が上がった）`,
          ops: [
            { op: 'condition', playerId: p.id, key: 'stamina', delta: 15 },
            { op: 'condition', playerId: p.id, key: 'motivation', delta: 3 },
          ],
        },
      ],
    }
  }
  if (kind === 'study') {
    return {
      id: eid('camp-study'),
      title: '合宿：大雨の座学',
      speaker: mgr(save),
      lines: ['合宿の二日目は大雨です。', '全員で、去年の決勝の映像を見ましょう。一球ごとに、狙いを考えるんです。'],
      choices: [
        {
          label: 'みっちりやろう',
          result: '作戦の意図が、部員全員に染み込んだ。（秋季大会が終わるまで、作戦が決まりやすい）',
          ops: [{ op: 'modifier', modifier: { key: 'tactic', until: absWeek(save, save.calendar.year, 30), label: '大雨の座学' } }],
        },
      ],
    }
  }
  if (kind === 'mvp') {
    const cands = rng.shuffle([...list]).slice(0, 3)
    return {
      id: eid('camp-mvp'),
      title: '合宿：紅白戦のMVP',
      speaker: mgr(save),
      relatedPlayerIds: cands.map((p) => p.id),
      lines: ['合宿の締めくくりの紅白戦が終わりました。', 'MVPは、誰にしますか？'],
      choices: cands.map((p) => ({
        label: `${p.surname}（${p.grade}年）`,
        result: `MVPは${p.surname}！　能力が全体的に伸びた。（選ばれなかった二人は、悔しさでやる気が上がった）`,
        ops: [
          ...abilityOps(p, mainKeys(p), 2),
          ...cands.filter((x) => x.id !== p.id).map((x) => ({ op: 'condition' as const, playerId: x.id, key: 'motivation' as const, delta: 3 })),
        ],
      })),
    }
  }
  if (kind === 'ghost') {
    return {
      id: eid('camp-ghost'),
      title: '合宿：怪談大会',
      speaker: NARR,
      lines: ['夜の宿舎で、怪談大会が始まった。', '最後の話は「白球稲荷に出る、下駄の老人」。…誰かが悲鳴を上げた。'],
      choices: [
        {
          label: '早く寝なさい',
          result: '翌朝、全員が寝不足だった。でも、なぜか一体感が増した。（体力が少し減り、全員のやる気が上がった）',
          ops: [
            { op: 'condition', playerId: 'all', key: 'stamina', delta: -5 },
            { op: 'condition', playerId: 'all', key: 'motivation', delta: 5 },
          ],
        },
      ],
    }
  }
  if (kind === 'limit') {
    const p = rng.pick(tired)
    const awaken = rng.chance(0.5)
    const skill = awaken ? learnable(rng, p) : null
    return {
      id: eid('camp-limit'),
      title: '合宿：限界の先',
      speaker: playerSpeaker(p),
      relatedPlayerIds: [p.id],
      lines: ['…まだ、やれます。', 'ここで止まったら、夏の自分に負ける気がするんです。'],
      choices: [
        {
          label: 'やらせる',
          result: awaken
            ? `${p.surname}は限界の先で、何かをつかんだ！　能力がまとめて伸びた。${skill ? `さらに「${skillName(skill)}」を身につけた！` : ''}`
            : `${p.surname}は足を痛めてしまった…（全治3週）`,
          ops: awaken
            ? [...abilityOps(p, mainKeys(p), 4), ...(skill ? [{ op: 'skill' as const, playerId: p.id, add: skill }] : [])]
            : [{ op: 'injury', playerId: p.id, name: '肉離れ', weeks: 3 }],
        },
        {
          label: '止める',
          result: `${p.surname}は少し不満そうだが、しっかり休んだ。（体力が回復した）`,
          ops: [
            { op: 'condition', playerId: p.id, key: 'motivation', delta: -3 },
            { op: 'condition', playerId: p.id, key: 'stamina', delta: 20 },
          ],
        },
      ],
    }
  }
  if (kind === 'pro') {
    const ob = rng.pick(pros)
    const key = STRENGTH_KEY[ob.strengths[0] ?? ''] ?? 'batting.contact'
    const cands = rng.shuffle([...list]).slice(0, 3)
    return {
      id: eid('camp-pro'),
      title: '合宿：OBのプロ選手',
      speaker: NARR,
      relatedPlayerIds: cands.map((p) => p.id),
      lines: [`プロに進んだOBの${ob.surname}が、合宿所にやって来た。`, '「後輩に、一つだけ教えに来ました。誰に教えましょうか」'],
      choices: cands.map((p) => ({
        label: `${p.surname}（${p.grade}年）`,
        result: `${p.surname}は${ob.surname}から直接教わり、${ABILITY_LABEL[key] ?? '能力'}が大きく伸びた！`,
        ops: [{ op: 'ability' as const, playerId: p.id, key, delta: key === 'pitching.velocity' ? 3 : 5 }],
      })),
    }
  }
  // 川向こうの球場：遠征中の強豪校と偶然の練習試合
  const win = rng.chance(0.4)
  const played = rng.shuffle([...list]).slice(0, Math.min(9, list.length))
  return {
    id: eid('camp-river'),
    title: '合宿：川向こうの球場',
    speaker: NARR,
    relatedPlayerIds: played.map((p) => p.id),
    lines: ['合宿所の近くの古い球場で、遠征中の強豪校と鉢合わせた。', '「せっかくだから、一試合やりませんか」'],
    choices: [
      {
        label: '受けて立つ',
        result: win ? '強豪校を相手に、まさかの勝利！（全員の能力が少し上がった）' : '力の差を見せつけられた。それでも、出場した選手は多くを学んだ。（試合に出た選手の能力が少し上がった）',
        ops: (win ? list : played).flatMap((p) => abilityOps(p, [rng.pick(mainKeys(p))], 1)),
      },
    ],
  }
}

// ---------------------------------------------------------------- その他のレアイベント

/** 古道具屋のグラブ（1年に5%、一度だけ） */
function oldGloveEvent(save: SaveData, list: Player[]): EventInstance | null {
  const fielders = list.filter((p) => p.mainPosition !== 'P')
  const p = [...fielders].sort((a, b) => b.fielding.range + b.fielding.catching - a.fielding.range - a.fielding.catching)[0]
  if (!p) return null
  return {
    id: eid('glove'),
    title: '古道具屋のグラブ',
    speaker: NARR,
    relatedPlayerIds: [p.id],
    lines: [
      '日向酒店の隣の古道具屋に、使い込まれた古いグラブが置いてある。',
      story(save)
        ? '縫い目に、消えかけた「T.K」の文字。　ナギ（心）：…わしが現役のときのグラブじゃ。売った覚えはないがのう'
        : '縫い目に、消えかけた「T.K」の文字。持ち主は誰だったのだろう。',
    ],
    choices: [
      {
        label: `${p.surname}に使わせる`,
        result: `古いグラブは、${p.surname}の手に驚くほどなじんだ。（守備が上がった）`,
        ops: [
          { op: 'ability', playerId: p.id, key: 'fielding.range', delta: 4 },
          { op: 'ability', playerId: p.id, key: 'fielding.catching', delta: 4 },
          { op: 'flag', key: 'oldGlove', value: p.id },
        ],
      },
    ],
  }
}

/** 転校生（4〜9月、1年に2%） */
function transferEvent(save: SaveData, rng: Rng): EventInstance {
  const later = rng.chance(0.5)
  return {
    id: eid('transfer'),
    title: '転校生',
    speaker: mgr(save),
    lines: ['2年生のクラスに、転校生が来たそうです。前の学校では、野球部の中心選手だったとか。', 'でも、野球はもうやめたって…。何か、理由があるみたいです。'],
    choices: [
      {
        label: '理由を聞きに行く',
        result: 'じっくり話を聞くと、転校生はもう一度ボールを握ると決めた。やる気十分で入部した！',
        ops: [{ op: 'recruit', grade: 2, boost: 18, motivation: 85, note: '転校してきて、野球部に入部した。' }],
      },
      {
        label: '無理には誘わない',
        result: later ? '数週間後、転校生は自分からグラウンドにやって来て、入部した。' : '転校生は、結局野球部には来なかった。',
        ops: later ? [{ op: 'recruit', grade: 2, boost: 18, motivation: 60, note: '自分からグラウンドに来て、入部した。' }] : [],
      },
    ],
  }
}

// ---------------------------------------------------------------- ストーリーの小話

/** 大会の前の週：源造の差し入れ（商店会長の場面の後） */
function genzoSnackEvent(): EventInstance {
  return {
    id: eid('genzo-snack'),
    title: '大会前の差し入れ',
    speaker: { ...GENZO },
    lines: ['おう、もうすぐ大会だろう！　差し入れだ、食え食え！', '腹が減っては戦はできんからな。わっはっは！'],
    choices: [
      {
        label: 'ありがとうございます！',
        result: '部員たちは差し入れをたいらげた。（全員の体力とやる気が上がった）',
        ops: [
          { op: 'condition', playerId: 'all', key: 'stamina', delta: 8 },
          { op: 'condition', playerId: 'all', key: 'motivation', delta: 3 },
        ],
      },
    ],
  }
}

/** 大会が終わった後：日向酒店でラムネ */
function ramuneEvent(won: boolean): EventInstance {
  return {
    id: eid('ramune'),
    title: '日向酒店でラムネ',
    speaker: { kind: 'local', name: '日向源造（商店会長）', portrait: 'genzo' },
    lines: won
      ? ['おう、マネージャー。…よく勝ち上がったな。', '（店先のビールケースに、ラムネを一本置く）']
      : ['……。', '（黙って、ラムネを二本置く。大地が隣に座って、一本を取った）'],
    choices: [
      {
        label: 'いただきます',
        result: won ? '冷えたラムネが、喉にしみた。（全員のやる気が上がった）' : 'ナギ（心）：…二本の日は、何も言わない日らしい。（落ち込んでいた部員たちのやる気が少し戻った）',
        ops: [{ op: 'condition', playerId: 'all', key: 'motivation', delta: won ? 4 : 6 }],
      },
    ],
  }
}

/** 教え子のプロ入り（ドラフトで指名されたとき） */
function draftEvent(save: SaveData, p: Player): EventInstance {
  const team = p.drafted?.team ?? 'プロ球団'
  return {
    id: eid('draft'),
    title: '教え子のプロ入り',
    speaker: playerSpeaker(p),
    relatedPlayerIds: [p.id],
    lines: [story(save) ? `朝比奈！　${team}に、指名されたぞ！` : `監督！　${team}に、指名されました！`, '…この部に来て、本当によかったです。'],
    choices: [
      {
        label: 'おめでとう。プロはここからが長いぞ',
        result: story(save)
          ? `部員たちが歓声を上げた。（評判が上がった）　ナギ（心）：…あいつは打てる。だが守備で苦労する。向こうの監督に、手紙を書いてやりたいところだ`
          : '部員たちが歓声を上げた。（評判が上がり、全員のやる気が上がった）',
        ops: [
          { op: 'school', key: 'reputation', delta: 2 },
          { op: 'condition', playerId: 'all', key: 'motivation', delta: 5 },
        ],
      },
    ],
  }
}

/** 公式戦で10点差以上で負けた後 */
function bigLossEvent(save: SaveData, cap: Player | undefined): EventInstance {
  return {
    id: eid('bigloss'),
    title: '大敗の後',
    speaker: cap ? playerSpeaker(cap) : NARR,
    relatedPlayerIds: cap ? [cap.id] : [],
    lines: ['…すみませんでした。', '何もできませんでした。'],
    choices: [
      {
        label: story(save) ? '今日の試合を、全部覚えておいてください' : '今日の悔しさを、全部覚えておけ',
        result: '部員たちは、うつむいていた顔を上げた。（落ち込んだやる気が少し戻った）',
        ops: [{ op: 'condition', playerId: 'all', key: 'motivation', delta: 6 }],
      },
    ],
  }
}

// ---------------------------------------------------------------- 週の初めに積む

const PREF_KINDS: TournamentKind[] = ['springPref', 'summerPref', 'autumnPref']

/** 大会で自校が敗退した（または大会が終わった）か。勝ち上がった回数も返す */
function ownFinished(save: SaveData, t: Tournament): { done: boolean; wins: number; bigLoss: boolean } {
  const own = save.playerSchoolId
  let wins = 0
  let lost = false
  let bigLoss = false
  let appeared = false
  for (const games of t.rounds) {
    for (const g of games) {
      if (g.a !== own && g.b !== own) continue
      appeared = true
      if (!g.winner || g.bye) continue
      if (g.winner === own) wins += 1
      else {
        lost = true
        if (g.score) {
          const [sa, sb] = g.score
          const diff = g.a === own ? sb - sa : sa - sb
          if (diff >= 10) bigLoss = true
        }
      }
    }
  }
  return { done: appeared && (lost || t.finished), wins, bigLoss }
}

/** 週を進めた後に呼ぶ：今週の行事やレアイベントを積む */
export function queueWeeklyEvents(save: SaveData, rng: Rng): void {
  const list = members(save)
  if (list.length === 0) return
  const q = (save.eventQueue ??= [])
  const push = (ev: EventInstance | null): void => {
    if (ev) q.push(ev)
  }
  const y = save.calendar.year
  const w = save.calendar.week
  const st = save.story?.enabled ? save.story : null
  // ストーリーの第1章の最終年度の卒業式は、章の場面で描く
  const storyFinale = !!st && st.chapter === 1 && y === 3

  // 年中行事
  if (w === 2 && y >= 2 && onceThisYear(save, 'recruit')) push(recruitEvent(save, rng))
  if ((w === 13 || w === 38) && rng.chance(0.7) && onceThisYear(save, `test${w}`)) push(testEvent(save, rng, list))
  if (w === 24 && onceThisYear(save, 'sports')) push(sportsDayEvent(save, rng, list))
  if (w === 25 && rng.chance(0.3) && onceThisYear(save, 'typhoon')) push(typhoonEvent(save))
  if (w === 29 && onceThisYear(save, 'festival')) push(festivalEvent(save, rng, list))
  if (w === 32) {
    const second = list.filter((p) => p.grade === 2)
    if (second.length && onceThisYear(save, 'trip')) push(schoolTripEvent(save, rng, second))
  }
  if (w === 39 && onceThisYear(save, 'christmas')) push(christmasEvent(save))
  if (w === 40 && onceThisYear(save, 'hatsumode')) push(hatsumodeEvent(save, rng))
  if (w === 41 && onceThisYear(save, 'obgame')) push(obGameEvent(save, rng))
  if (w === 43) {
    const autumn = findTournament(save, y, 'autumnPref')
    const final = autumn?.rounds[autumn.rounds.length - 1]?.[0]
    if (autumn && final && (final.a === save.playerSchoolId || final.b === save.playerSchoolId) && onceThisYear(save, 'selection')) push(selectionEvent(save, autumn))
  }
  if (w === 46 && onceThisYear(save, 'valentine')) push(valentineEvent(save))
  if (w === SEASON_WEEKS.graduation && !storyFinale && onceThisYear(save, 'graduation')) {
    push(graduationEvent(save, Object.values(save.players).filter((p) => p.schoolId === save.playerSchoolId && p.grade === 3 && !p.helper)))
  }
  if (w === SEASON_WEEKS.thirdYearRetire + 1 && onceThisYear(save, 'retire')) {
    const own = save.schools[save.playerSchoolId]!
    const retired = own.playerIds.map((id) => save.players[id]).filter((p): p is Player => !!p && p.retired && p.grade === 3)
    push(retireDayEvent(save, rng, retired, list.filter((p) => p.grade <= 2)))
  }

  // 合宿
  const camp = (save.sugoroku?.campWeeks ?? 0) > 0
  if (camp && onceThisYear(save, 'curry')) push(campCurryEvent(save))
  if (camp && rng.chance(0.3) && onceThisYear(save, 'campRare')) push(campRareEvent(save, rng, list))

  // その他のレアイベント
  if (rng.chance(0.05 / 52) && onceEver(save, 'glove')) push(oldGloveEvent(save, list))
  if (w <= 26 && rng.chance(0.02 / 26) && onceThisYear(save, 'transfer')) push(transferEvent(save, rng))

  // ドラフトで指名された教え子
  for (const p of Object.values(save.players)) {
    if (p.schoolId !== save.playerSchoolId || !p.drafted) continue
    if (onceEver(save, `draft:${p.id}`)) push(draftEvent(save, p))
  }

  // 大会の後
  for (const kind of PREF_KINDS) {
    const t = findTournament(save, y, kind)
    if (!t) continue
    const r = ownFinished(save, t)
    if (!r.done || flags(save)[`after:${t.id}`] !== undefined) continue
    flags(save)[`after:${t.id}`] = true
    if (r.bigLoss && rng.chance(0.6)) push(bigLossEvent(save, captainOf(save, list)))
    else if (st && y <= 3 && st.seen.includes('c1_shoutenkai') && rng.chance(0.4)) push(ramuneEvent(r.wins >= 2))
  }

  // ストーリー：大会の前の週に、源造の差し入れ
  if (st && st.chapter === 1 && st.seen.includes('c1_shoutenkai') && (w === 4 || w === 14 || w === 27) && onceThisYear(save, `snack${w}`)) push(genzoSnackEvent())

  // 積みすぎない（たまっているときは、新しいもの3つだけ残す）
  if (q.length > 3) q.splice(0, q.length - 3)
}

/** テスト用：個々のイベントを直接作る */
export const __test = { campRareEvent, oldGloveEvent, transferEvent, retireDayEvent, testEvent, typhoonEvent, obGameEvent, hatsumodeEvent }
