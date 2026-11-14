// サクセス第1章：部員集め（勧誘）
// ・行き先の部活を選ぶ。選ぶ前に、その週に各部活に誰がいるか分かる
// ・固定キャラ（他の部活のエース格）はいつもいるとは限らず、いても話しかけられるとは限らない
// ・成功率は相手の能力で変わる。評判は確率を少し上げるだけ（加入条件に最低評判は入れない）
// 構想書18節「勧誘の確率（裏設定）」

import { Rng, clamp } from '../rng'
import { GIVEN_NAMES, SURNAMES } from '../names'
import { POSITION_NAME } from '../constants'
import { defaultPracticeMenu, fullName, generatePlayer } from '../player'
import { computeOverall, newId } from '../world'
import type { Player, Position, SaveData } from '../types'
import type { CharId } from '../story/types'
import type { ClubId, ClubMember, ClubRoster, EvalKey, FixedId } from './types'
import { addEval, evalStars, successOf } from './state'

export interface ClubInfo {
  id: ClubId
  name: string
  /** この部活にいる固定キャラ */
  fixed?: FixedId
  /** 普通の部員（モブ）の強さの範囲 */
  strength: [number, number]
  /** モブの人数 */
  mobs: number
}

export const CLUBS: ClubInfo[] = [
  { id: 'kitaku', name: '帰宅部', strength: [15, 40], mobs: 3 },
  { id: 'rikujo', name: '陸上部', fixed: 'rikujo', strength: [30, 55], mobs: 2 },
  { id: 'sumo', name: '相撲部', fixed: 'sumo', strength: [30, 50], mobs: 2 },
  { id: 'soccer', name: 'サッカー部', fixed: 'soccer', strength: [30, 55], mobs: 2 },
  { id: 'tennis', name: 'テニス部', fixed: 'tennis', strength: [30, 55], mobs: 2 },
  { id: 'takkyu', name: '卓球部', fixed: 'takkyu', strength: [25, 50], mobs: 2 },
  { id: 'shogi', name: '将棋部', fixed: 'shogi', strength: [10, 30], mobs: 2 },
  { id: 'seitokai', name: '生徒会', fixed: 'seitokai', strength: [15, 35], mobs: 1 },
  { id: 'shinbun', name: '新聞部', fixed: 'shinbun', strength: [15, 35], mobs: 1 },
]

/** 加入の判定に使う、部の状況 */
export interface JoinContext {
  /** 部の評判（0〜100） */
  rep: number
  /** 練習試合か公式戦で、一度でも勝ったことがあるか */
  win: boolean
  /** 公式戦で勝ったことがあるか */
  officialWin: boolean
  /** 評価の段階（★1〜5） */
  stars: (key: EvalKey) => number
}

export interface FixedInfo {
  id: FixedId
  club: ClubId
  surname: string
  givenName: string
  char: CharId
  /** 一覧に出す肩書き */
  title: string
  position: Position
  /**
   * 加入の判定（talks：これまでに話しかけた回数）。
   * 話しかけるたびに入ってくれやすくなる。人それぞれの「裏設定」（評判・勝利・周りの評価）でも上がる
   */
  chance: (talks: number, x: JoinContext) => number
}

export const FIXED: Record<FixedId, FixedInfo> = {
  rikujo: {
    id: 'rikujo', club: 'rikujo', surname: '岩城', givenName: '剛', char: 'iwaki', title: '陸上部のエース（砲丸投げ）', position: 'P',
    // 裏設定：強い相手と勝負したい。評判が高いほど乗ってくる
    chance: (t, x) => 0.25 + 0.17 * t + x.rep / 200,
  },
  sumo: {
    id: 'sumo', club: 'sumo', surname: '塩見', givenName: '豪太', char: 'shiomi', title: '相撲部のエース', position: '1B',
    // 裏設定：食べることが好き。商店会長（源造）の差し入れに弱い
    chance: (t, x) => 0.3 + 0.17 * t + (x.stars('genzo') - 1) * 0.05,
  },
  soccer: {
    id: 'soccer', club: 'soccer', surname: '天羽', givenName: '翔', char: 'amou', title: 'サッカー部のエース', position: 'CF',
    // 裏設定：勝てるチームにしか興味がない。評判と公式戦の勝利で動く
    chance: (t, x) => 0.15 + 0.15 * t + x.rep / 150 + (x.officialWin ? 0.12 : 0),
  },
  tennis: {
    id: 'tennis', club: 'tennis', surname: '久遠', givenName: '遼', char: 'kuon', title: 'テニス部のエース', position: 'SS',
    // 練習試合で1勝するまでは、話を聞いてくれない。裏設定：ナギの采配に興味がある
    chance: (t, x) => (x.win ? 0.3 + 0.17 * t + (x.stars('nagi') - 1) * 0.04 : 0),
  },
  takkyu: {
    id: 'takkyu', club: 'takkyu', surname: '小早川', givenName: '俊', char: 'kobayakawa', title: '卓球部のエース', position: '2B',
    // 裏設定：にぎやかな部が好き。チームメイトの評価（部の雰囲気）で動く
    chance: (t, x) => 0.3 + 0.17 * t + (x.stars('team') - 1) * 0.05,
  },
  shogi: {
    id: 'shogi', club: 'shogi', surname: '千手', givenName: '静馬', char: 'senju', title: '将棋部のエース', position: 'P',
    // 裏設定：作戦を考える人に興味がある。ナギの評価で動く
    chance: (t, x) => 0.25 + 0.15 * t + (x.stars('nagi') - 1) * 0.06,
  },
  seitokai: {
    id: 'seitokai', club: 'seitokai', surname: '東雲', givenName: '学', char: 'shinonome', title: '生徒会長', position: '3B',
    // 裏設定：先生の信頼がある部なら、と考えている。真壁先生の評価で動く
    chance: (t, x) => 0.3 + 0.15 * t + (x.stars('makabe') - 1) * 0.06,
  },
  shinbun: {
    id: 'shinbun', club: 'shinbun', surname: '三木', givenName: '文太', char: 'miki', title: '新聞部', position: 'LF',
    // 裏設定：記事になる部を探している。勝っている部ほど入りたがる
    chance: (t, x) => 0.35 + 0.15 * t + (x.win ? 0.1 : 0) + x.rep / 300,
  },
}

export function clubName(id: ClubId): string {
  return CLUBS.find((c) => c.id === id)?.name ?? ''
}

const POSITION_POOL: Position[] = ['P', 'P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'RF', 'LF']

/** その週に各部活にいる人を決める（週を進めたあとに呼ぶ） */
export function rollClubs(save: SaveData, rng: Rng): void {
  const s = successOf(save)
  if (!s) return
  const rosters: ClubRoster[] = []
  for (const c of CLUBS) {
    const members: ClubMember[] = []
    if (c.fixed && !s.joined[c.fixed] && rng.chance(0.5)) members.push({ kind: 'fixed', id: c.fixed })
    for (let i = 0; i < c.mobs; i++) {
      members.push({
        kind: 'mob',
        surname: rng.pick(SURNAMES),
        givenName: rng.pick(GIVEN_NAMES),
        grade: save.calendar.year >= 2 && rng.chance(0.3) ? 2 : 1,
        position: rng.pick(POSITION_POOL),
        strength: rng.int(c.strength[0], c.strength[1]),
      })
    }
    rosters.push({ club: c.id, members })
  }
  s.clubs = rosters
}

/** 強さの目安（一覧に出す） */
export function strengthLabel(v: number): string {
  return v >= 50 ? 'C' : v >= 38 ? 'D' : v >= 26 ? 'E' : 'F'
}

/** 部員を1人加える */
function addMember(save: SaveData, rng: Rng, opt: { grade: number; position: Position; strength: number; surname: string; givenName: string }): Player {
  const own = save.schools[save.playerSchoolId]!
  const p = generatePlayer(rng, {
    id: newId(save, 'p'),
    schoolId: own.id,
    grade: opt.grade,
    year: save.calendar.year - (opt.grade - 1),
    strength: opt.strength,
    kind: own.kind,
    position: opt.position,
    managerExperience: save.managerExperience,
  })
  p.surname = opt.surname
  p.givenName = opt.givenName
  save.players[p.id] = p
  own.playerIds.push(p.id)
  return p
}

function set(obj: Record<string, number>, key: string, v: number, max = 99): void {
  obj[key] = clamp(Math.round(v), 1, max)
}

/** 固定キャラの能力を、その人らしく整える */
function tailor(p: Player, id: FixedId, rng: Rng): void {
  const b = p.batting as unknown as Record<string, number>
  const r = p.running as unknown as Record<string, number>
  const f = p.fielding as unknown as Record<string, number>
  const pi = p.pitching as unknown as Record<string, number>
  const c = p.common as unknown as Record<string, number>
  p.storyCast = `fixed:${id}`
  p.hidden.potential = Math.max(p.hidden.potential, 72)
  if (id === 'rikujo') {
    set(pi, 'velocity', 141 + rng.int(0, 4), 163)
    set(pi, 'stamina', 74 + rng.int(0, 6))
    set(pi, 'control', 34 + rng.int(0, 6))
    set(b, 'power', 55)
  } else if (id === 'sumo') {
    set(b, 'power', 80 + rng.int(0, 5))
    b.trajectory = 4
    set(b, 'contact', 42 + rng.int(0, 6))
    set(f, 'range', 22)
    set(r, 'speed', 22)
  } else if (id === 'soccer') {
    set(r, 'speed', 84 + rng.int(0, 5))
    set(r, 'steal', 70)
    set(f, 'range', 74 + rng.int(0, 4))
    set(b, 'contact', 50)
    set(b, 'power', 36)
  } else if (id === 'tennis') {
    set(b, 'contact', 74 + rng.int(0, 5))
    set(f, 'range', 74 + rng.int(0, 5))
    set(f, 'arm', 56)
  } else if (id === 'takkyu') {
    set(f, 'catching', 80 + rng.int(0, 4))
    set(f, 'range', 70)
    set(f, 'throwing', 70)
    set(b, 'contact', 56)
    set(b, 'eye', 66)
  } else if (id === 'shogi') {
    // 文化部なので体力はないが、集中力が高い火消し役：投手の能力は高く、スタミナは1イニングぶん
    set(pi, 'control', 84 + rng.int(0, 5))
    set(pi, 'kire', 80 + rng.int(0, 5))
    set(pi, 'velocity', 137 + rng.int(0, 4), 163)
    set(pi, 'stamina', 14)
    set(pi, 'pinch', 85)
    set(c, 'clutch', 75)
    set(c, 'durability', 30)
    set(b, 'power', 15)
    set(b, 'contact', 18)
    // もう1つ決め球を持たせる（すでに持っている球種とは重ねない）
    if (p.pitching.pitches.length < 2) p.pitching.pitches.push({ type: p.pitching.pitches.some((x) => x.type === 'fork') ? 'slider' : 'fork', level: 4 })
    for (const x of p.pitching.pitches) x.level = Math.max(x.level, 4)
  }
  const pos = FIXED[id].position
  p.mainPosition = pos
  p.fielding.aptitude[pos] = 3
  p.practiceMenu = defaultPracticeMenu(pos, p.batting.power, p.running.speed)
}

export interface RecruitResult {
  title: string
  lines: string[]
  success: boolean
  /** 加入した固定キャラ */
  fixed?: FixedId
}

/** 勧誘に行く（1週分を使う）。結果の文を返す。週を進めるのは呼び出した側 */
/**
 * 勧誘する。target は声をかける相手（その部活にいる人の並び順）。
 * 省略したときは、エースがいればエースに、いなければ誰かに声をかける
 */
export function recruit(save: SaveData, rng: Rng, clubId: ClubId, target?: number): RecruitResult {
  const s = successOf(save)!
  const own = save.schools[save.playerSchoolId]!
  const club = CLUBS.find((c) => c.id === clubId)!
  const roster = s.clubs.find((r) => r.club === clubId)
  const visits = (s.visits[clubId] ?? 0) + 1
  s.visits[clubId] = visits
  s.recruitStreak += 1
  const rep = own.reputation
  const lines: string[] = []
  const evals: (string | null)[] = []
  const chosen = target !== undefined ? roster?.members[target] : undefined
  const fixedAll = roster?.members.find((m): m is Extract<ClubMember, { kind: 'fixed' }> => m.kind === 'fixed' && !s.joined[m.id])
  // モブを選んだときは、エースには声をかけない
  const fixedHere = chosen && chosen.kind === 'mob' ? undefined : fixedAll
  const mobsAll = (roster?.members ?? []).filter((m): m is Extract<ClubMember, { kind: 'mob' }> => m.kind === 'mob')
  // エースを選んだときは、ほかの人には声をかけない
  const mobs = chosen?.kind === 'fixed' ? [] : chosen?.kind === 'mob' ? [chosen] : mobsAll
  let success = false
  let fixed: FixedId | undefined
  // 固定キャラがいれば、必ず話しかけられる（入ってくれるかは、話した回数と裏設定しだい）
  if (fixedHere) {
    const info = FIXED[fixedHere.id]
    const talks = (s.talks[fixedHere.id] ?? 0) + 1
    s.talks[fixedHere.id] = talks
    const practiceWin = save.story?.flags.practiceWin !== undefined || hasAnyWin(save)
    const chance = clamp(
      info.chance(talks - 1, { rep, win: practiceWin, officialWin: hasOfficialWin(save), stars: (k) => evalStars(s.eval[k]) }),
      0,
      0.95,
    )
    lines.push(`${club.name}へ。${info.title}の${info.surname}に、思い切って声をかけた。`)
    if (rng.chance(chance)) {
      const p = addMember(save, rng, { grade: save.calendar.year === 1 ? 1 : 2, position: info.position, strength: 55, surname: info.surname, givenName: info.givenName })
      if (save.calendar.year >= 3) p.grade = 3
      tailor(p, fixedHere.id, rng)
      s.joined[fixedHere.id] = p.id
      // 入部したので、その部活の今週の顔ぶれから外す（週を進めない最初の勧誘でも、次の勧誘に出てこない）
      if (roster) roster.members = roster.members.filter((x) => x !== fixedHere)
      ;(save.story!.flags[`join_${fixedHere.id}`] = save.calendar.year)
      success = true
      fixed = fixedHere.id
      lines.push(`「…いいだろう。やってみる」${fullName(p)}が入部を決めた！`)
      evals.push(addEval(save, 'daichi', 3), addEval(save, 'team', 2), addEval(save, 'nagi', 2))
      if (fixedHere.id === 'soccer') own.reputation = clamp(own.reputation + 8, 0, 100)
      if (fixedHere.id === 'seitokai') {
        own.funds += 30
        lines.push('生徒会長が加わり、部費の予算が少し増えた（部費 +30万円）。')
      }
      if (fixedHere.id === 'shinbun') {
        own.reputation = clamp(own.reputation + 4, 0, 100)
        lines.push('さっそく校内新聞に野球部の記事が載った（評判が上がった）。')
      }
    } else {
      lines.push(
        fixedHere.id === 'tennis' && !practiceWin
          ? '「一度も勝ったことのない部に、興味はない」…取りつく島もなかった。'
          : talks >= 2
            ? '「…考えておく」少し、気持ちが動いているようだ。'
            : '「悪いけど、今は自分の部で手いっぱいだ」断られてしまった。',
      )
    }
  } else if (mobs.length > 0) {
    const m = rng.pick(mobs)
    lines.push(`${m.grade}年の${m.surname}（${POSITION_NAME[m.position as Position] ?? '野手'}向き）に声をかけた。`)
    // モブは声をかければ、わりと入ってくれる（能力が高いほど少し入りにくい）
    const base = clubId === 'kitaku' ? 0.85 : 0.68
    const chance = clamp(base - (m.strength - 30) / 160 + rep / 250 + (visits >= 2 ? 0.08 : 0), 0.35, 0.95)
    if (rng.chance(chance)) {
      const p = addMember(save, rng, { grade: m.grade, position: m.position as Position, strength: m.strength, surname: m.surname, givenName: m.givenName })
      success = true
      const yes = rng.pick([
        '「野球か…まあ、やってみてもいいかな」',
        '「ちょうど何かやりたいと思ってたんだ。よろしく」',
        '「試合に出られるなら、やるよ」',
        '「中学まで少しやってたんだ。また、やってみるか」',
        '「…そこまで言われたら、断れないな」',
        '「楽しそうだし、入ってみようかな」',
      ])
      lines.push(`${yes}${fullName(p)}が入部した！`)
      evals.push(addEval(save, 'nagi', 2), addEval(save, 'team', 1))
      roster!.members = roster!.members.filter((x) => x !== m)
    } else {
      lines.push(
        `${rng.pick(['「ごめん、野球はちょっと…」', '「今は自分の部が楽しいんだ。悪いね」', '「放課後はバイトがあって…ごめん」', '「うーん、考えておくよ」'])}断られてしまった。`,
      )
    }
  } else {
    lines.push(`${club.name}には、今日は誰もいなかった。`)
  }
  if (success) s.failStreak = 0
  else {
    s.failStreak += 1
    if (s.failStreak >= 3) evals.push(addEval(save, 'nagi', -1))
  }
  // 勧誘ばかりで練習が続かないと、大地とチームメイトの評価が下がる
  if (s.recruitStreak >= 3) evals.push(addEval(save, 'daichi', -1), addEval(save, 'team', -1))
  own.overall = computeOverall(own, save.players)
  const ev = evals.filter((x): x is string => !!x)
  if (ev.length) lines.push(`（${ev.join('。')}）`)
  save.log.push({ year: save.calendar.year, week: save.calendar.week, text: `勧誘（${club.name}）：${success ? '成功' : '失敗'}` })
  return { title: success ? '勧誘成功！' : '勧誘', lines, success, fixed }
}

/** 公式戦で、一度でも勝ったことがあるか */
function hasOfficialWin(save: SaveData): boolean {
  const own = save.playerSchoolId
  return (save.tournaments ?? []).some((t) => t.rounds.some((games) => games.some((g) => !g.bye && g.a && g.b && g.winner === own)))
}

/** 練習試合か公式戦で、一度でも勝ったことがあるか */
function hasAnyWin(save: SaveData): boolean {
  const own = save.playerSchoolId
  return (save.tournaments ?? []).some((t) => t.rounds.some((games) => games.some((g) => !g.bye && g.a && g.b && g.winner === own)))
}

/** 評判が高いと、自分から入部してくる部員がいる（毎週） */
export function autoJoin(save: SaveData, rng: Rng, messages: string[]): void {
  const s = successOf(save)
  if (!s || s.ended) return
  const own = save.schools[save.playerSchoolId]!
  const count = own.playerIds.filter((id) => save.players[id] && !save.players[id]!.retired).length
  if (count >= 20) return
  const bonus = s.joined.soccer ? 0.08 : 0
  if (!rng.chance(clamp(own.reputation / 250 + bonus, 0, 0.35))) return
  const p = addMember(save, rng, {
    grade: save.calendar.year >= 2 && rng.chance(0.3) ? 2 : 1,
    position: rng.pick(POSITION_POOL),
    strength: rng.int(25, 50),
    surname: rng.pick(SURNAMES),
    givenName: rng.pick(GIVEN_NAMES),
  })
  own.overall = computeOverall(own, save.players)
  const text = `${fullName(p)}が「野球部、楽しそうだから」と、自分から入部してきた！`
  save.log.push({ year: save.calendar.year, week: save.calendar.week, text })
  messages.push(text)
}

/**
 * 第1章の⑤：大地が帰宅部の友人を5人連れてくる（必ず入部する）
 * 守備位置はばらけさせる。投手が空いていれば必ず1人は投手。
 * 育成選手と大地の守備位置とは被らない（外野は3枠あるので、外野1人分だけ埋まる扱い）
 */
export function addFriendsOfDaichi(save: SaveData, rng: Rng, count = 5): Player[] {
  const s = successOf(save)
  const taken = new Set<Position>()
  const mark = (id: string | null | undefined): void => {
    const pl = id ? save.players[id] : undefined
    if (!pl) return
    const pos = pl.mainPosition
    // 外野はどこか1枠が埋まる
    if (pos === 'LF' || pos === 'CF' || pos === 'RF') taken.add(['CF', 'LF', 'RF'].find((x) => !taken.has(x as Position)) as Position)
    else taken.add(pos)
  }
  mark(s?.focusId)
  mark(save.story?.daichiId)
  const free = (['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'] as Position[]).filter((x) => !taken.has(x))
  const picks: Position[] = []
  if (free.includes('P')) picks.push('P')
  const rest = rng.shuffle(free.filter((x) => x !== 'P'))
  while (picks.length < count && rest.length) picks.push(rest.shift()!)
  while (picks.length < count) picks.push(rng.pick(['LF', 'CF', 'RF'] as Position[]))
  return picks.map((position) => addMember(save, rng, { grade: 1, position, strength: 32, surname: rng.pick(SURNAMES), givenName: rng.pick(GIVEN_NAMES) }))
}
