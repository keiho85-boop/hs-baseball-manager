// 大会（春・夏・秋の県大会、夏・春の全国大会）
//
// ・組み合わせはトーナメント表。参加校が2のべき乗に満たないときは、上位シードが不戦勝になる
// ・各回戦を行う週が決まっていて、1週に2回戦まで進む
// ・自校の試合はプレイヤーが采配する。それ以外の試合は総合力で勝敗と点数を決める
// ・他県の県大会は組み合わせ表を残さず、全国大会の出場校を決めるときにまとめて計算する

import { Rng, clamp } from './rng'
import { PREFECTURES, prefName } from './constants'
import { newId, populateSchool } from './world'
import type { SaveData, School } from './types'

export type TournamentKind = 'springPref' | 'summerPref' | 'summerNational' | 'autumnPref' | 'springNational'

export interface TournamentGame {
  a: string | null
  b: string | null
  winner: string | null
  /** [a の得点, b の得点] */
  score?: [number, number]
  /** 不戦勝（相手がいない） */
  bye?: boolean
  /** 自校の試合で、コールド・延長などの補足 */
  note?: string
}

export interface Tournament {
  id: string
  kind: TournamentKind
  year: number
  /** 県大会なら都道府県、全国大会なら null */
  prefCode: number | null
  name: string
  rounds: TournamentGame[][]
  /** 各回戦を行う週 */
  weeks: number[]
  /** いま行っている回戦（0始まり） */
  current: number
  finished: boolean
  championId: string | null
  /** 選手を一時的に作った他県の学校（大会が終わったら元に戻す） */
  tempDetailed: string[]
}

interface Spec {
  season: string
  national: boolean
  weeks: number[]
  /** 評判の上がり方の重み */
  weight: number
  summer: boolean
}

export const TOURNAMENT_SPECS: Record<TournamentKind, Spec> = {
  springPref: { season: '春', national: false, weeks: [5, 5, 6, 6, 7], weight: 0.6, summer: false },
  summerPref: { season: '夏', national: false, weeks: [15, 15, 16, 16, 17], weight: 1, summer: true },
  summerNational: { season: '夏', national: true, weeks: [19, 19, 20, 20, 21, 21], weight: 1, summer: true },
  autumnPref: { season: '秋', national: false, weeks: [28, 28, 29, 29, 30], weight: 0.8, summer: false },
  springNational: { season: '春', national: true, weeks: [50, 50, 51, 51, 52, 52], weight: 0.9, summer: false },
}

const ORDER: TournamentKind[] = ['springPref', 'summerPref', 'summerNational', 'autumnPref', 'springNational']

/** 「大阪府」→「大阪」（北海道はそのまま） */
function prefShort(code: number): string {
  const n = prefName(code)
  return n === '北海道' ? n : n.replace(/[都府県]$/, '')
}

export function tournamentName(kind: TournamentKind, prefCode: number | null): string {
  switch (kind) {
    case 'springPref':
      return `春季${prefShort(prefCode!)}大会`
    case 'summerPref':
      return `夏の${prefShort(prefCode!)}大会`
    case 'autumnPref':
      return `秋季${prefShort(prefCode!)}大会`
    case 'summerNational':
      return '夏の全国大会'
    case 'springNational':
      return '春の全国大会'
  }
}

/** 回戦の呼び名（決勝・準決勝・準々決勝・〇回戦） */
export function roundName(t: Tournament, r: number): string {
  const n = t.rounds.length
  if (r === n - 1) return '決勝'
  if (r === n - 2) return '準決勝'
  if (r === n - 3) return '準々決勝'
  return `${r + 1}回戦`
}

/** 開催期間中の大会の種類（週から決める） */
export function kindAtWeek(week: number): TournamentKind | null {
  for (const k of ORDER) {
    const w = TOURNAMENT_SPECS[k].weeks
    if (week >= w[0]! && week <= w[w.length - 1]!) return k
  }
  return null
}

/** 次に始まる大会と、始まるまでの週数（自校が出られる大会だけ） */
export function nextTournament(save: SaveData): { kind: TournamentKind; name: string; weeks: number } | null {
  const week = save.calendar.week
  for (let add = 0; add < 60; add++) {
    const w = ((week - 1 + add) % 52) + 1
    for (const k of ORDER) {
      if (TOURNAMENT_SPECS[k].weeks[0] !== w) continue
      if (TOURNAMENT_SPECS[k].national) continue
      return { kind: k, name: tournamentName(k, save.prefCode), weeks: add }
    }
  }
  return null
}

// ---------------------------------------------------------------- 組み合わせ

/** 標準的なシード順（1位と最下位、2位と…が当たる並び）。番号は1始まり */
function seedOrder(size: number): number[] {
  let order = [1]
  while (order.length < size) {
    const n = order.length * 2
    order = order.flatMap((s) => [s, n + 1 - s])
  }
  return order
}

/** 参加校から1回戦の組み合わせを作る。強い学校ほど上位シード（4校＋不戦勝の数だけ）になる */
function buildBracket(rng: Rng, save: SaveData, entrants: string[]): TournamentGame[][] {
  let size = 1
  while (size < entrants.length) size *= 2
  const byes = size - entrants.length
  const sorted = [...entrants].sort((a, b) => (save.schools[b]?.overall ?? 0) - (save.schools[a]?.overall ?? 0))
  const seeded = Math.min(sorted.length, Math.max(4, byes))
  const ranked = [...sorted.slice(0, seeded), ...rng.shuffle(sorted.slice(seeded))]
  const slots = seedOrder(size).map((seed) => ranked[seed - 1] ?? null)
  const first: TournamentGame[] = []
  for (let i = 0; i < size; i += 2) {
    const a = slots[i] ?? null
    const b = slots[i + 1] ?? null
    const g: TournamentGame = { a, b, winner: null }
    if (!a || !b) {
      g.winner = a ?? b
      g.bye = true
    }
    first.push(g)
  }
  const rounds: TournamentGame[][] = [first]
  let n = first.length
  while (n > 1) {
    n /= 2
    rounds.push(Array.from({ length: n }, () => ({ a: null, b: null, winner: null })))
  }
  return rounds
}

/** 勝者を次の回戦に送る */
function propagate(t: Tournament, r: number): void {
  const next = t.rounds[r + 1]
  if (!next) return
  t.rounds[r]!.forEach((g, i) => {
    const ng = next[Math.floor(i / 2)]!
    if (i % 2 === 0) ng.a = g.winner
    else ng.b = g.winner
  })
}

// ---------------------------------------------------------------- 総合力での試合

/** 総合力から勝敗と点数を決める（番狂わせも少し起きる） */
export function quickGame(rng: Rng, oa: number, ob: number): { aWins: boolean; score: [number, number] } {
  const p = 1 / (1 + Math.exp(-(oa - ob) / 8))
  const aWins = rng.chance(clamp(p, 0.04, 0.96))
  const gap = Math.abs(oa - ob)
  const winRuns = clamp(Math.round(rng.normal(4 + gap / 10, 2.2)), 1, 15)
  const loseRuns = clamp(Math.round(rng.normal(2, 1.6)), 0, winRuns - 1)
  return { aWins, score: aWins ? [winRuns, loseRuns] : [loseRuns, winRuns] }
}

/** 自校を含まない県大会を、組み合わせ表を残さずに計算して優勝校を返す */
function simulateQuick(rng: Rng, save: SaveData, entrants: string[]): string | null {
  let alive = rng.shuffle([...entrants])
  while (alive.length > 1) {
    const next: string[] = []
    for (let i = 0; i < alive.length; i += 2) {
      const a = alive[i]!
      const b = alive[i + 1]
      if (!b) {
        next.push(a)
        continue
      }
      const r = quickGame(rng, save.schools[a]?.overall ?? 30, save.schools[b]?.overall ?? 30)
      next.push(r.aWins ? a : b)
    }
    alive = next
  }
  return alive[0] ?? null
}

function prefSchools(save: SaveData, code: number): string[] {
  return Object.values(save.schools)
    .filter((s) => s.prefCode === code)
    .map((s) => s.id)
}

// ---------------------------------------------------------------- 大会の作成と進行

export function findTournament(save: SaveData, year: number, kind: TournamentKind): Tournament | null {
  return (save.tournaments ?? []).find((t) => t.year === year && t.kind === kind) ?? null
}

/** 開催期間中なのに大会がまだなければ作る（週が変わったときと、データを読み込んだときに呼ぶ） */
export function ensureTournament(save: SaveData, rng: Rng): Tournament | null {
  const week = save.calendar.week
  const kind = kindAtWeek(week)
  if (!kind) return null
  const year = save.calendar.year
  const existing = findTournament(save, year, kind)
  if (existing) return existing
  const spec = TOURNAMENT_SPECS[kind]
  let entrants: string[]
  if (!spec.national) {
    entrants = prefSchools(save, save.prefCode)
  } else {
    // 各都道府県の代表校：自県は県大会の優勝校、他県はここでまとめて計算する
    const prefKind: TournamentKind = kind === 'summerNational' ? 'summerPref' : 'autumnPref'
    // 春の全国大会は、同じ年度の秋季大会の結果で決まる
    const own = findTournament(save, year, prefKind)
    entrants = []
    for (const pref of PREFECTURES) {
      if (pref.code === save.prefCode && own?.finished && own.championId) {
        entrants.push(own.championId)
        continue
      }
      const champ = simulateQuick(rng, save, prefSchools(save, pref.code))
      if (champ) entrants.push(champ)
    }
  }
  const t: Tournament = {
    id: newId(save, 't'),
    kind,
    year,
    prefCode: spec.national ? null : save.prefCode,
    name: tournamentName(kind, save.prefCode),
    rounds: buildBracket(rng, save, entrants),
    weeks: spec.weeks,
    current: 0,
    finished: false,
    championId: null,
    tempDetailed: [],
  }
  propagate(t, 0)
  ;(save.tournaments ??= []).push(t)
  // 古い大会の記録は前の年度の分まで残す
  save.tournaments = save.tournaments.filter((x) => x.year >= year - 1)
  save.log.push({ year, week, text: `${t.name}が開幕した。` })
  return t
}

/** いま行われている大会 */
export function currentTournament(save: SaveData): Tournament | null {
  const kind = kindAtWeek(save.calendar.week)
  return kind ? findTournament(save, save.calendar.year, kind) : null
}

/** 自校がまだ勝ち残っているか */
export function ownAlive(save: Pick<SaveData, 'playerSchoolId'>, t: Tournament): boolean {
  const own = save.playerSchoolId
  if (t.finished) return false
  const inBracket = t.rounds[0]!.some((g) => g.a === own || g.b === own)
  if (!inBracket) return false
  for (let r = 0; r < t.rounds.length; r++) {
    const g = t.rounds[r]!.find((x) => x.a === own || x.b === own)
    if (!g) return false
    if (g.winner && g.winner !== own) return false
    if (!g.winner) return true
  }
  return false
}

/** 自校がこの週に戦う、まだ終わっていない試合 */
export function pendingOwnGame(save: SaveData): { t: Tournament; round: number; game: TournamentGame; opponentId: string } | null {
  const t = currentTournament(save)
  if (!t || t.finished) return null
  const r = t.current
  if (t.weeks[r] !== save.calendar.week) return null
  const own = save.playerSchoolId
  const game = t.rounds[r]!.find((g) => (g.a === own || g.b === own) && !g.winner)
  if (!game || !game.a || !game.b) return null
  return { t, round: r, game, opponentId: game.a === own ? game.b : game.a }
}

/** 自校がこの週の大会の試合を戦い終えたか（終えたら、すごろくではなく「次の週へ」で進める） */
export function ownPlayedThisWeek(save: SaveData): boolean {
  const t = currentTournament(save)
  if (!t) return false
  const own = save.playerSchoolId
  return t.rounds.some((games, r) => t.weeks[r] === save.calendar.week && games.some((g) => !g.bye && g.winner && (g.a === own || g.b === own)))
}

/** 自校の試合の結果を記録して、同じ回戦の残りの試合を進める */
export function recordOwnResult(save: SaveData, rng: Rng, t: Tournament, round: number, ownWon: boolean, ownRuns: number, oppRuns: number, note: string): string[] {
  const own = save.playerSchoolId
  const game = t.rounds[round]!.find((g) => g.a === own || g.b === own)
  if (!game || game.winner) return []
  const opp = game.a === own ? game.b : game.a
  game.winner = ownWon ? own : opp
  game.score = game.a === own ? [ownRuns, oppRuns] : [oppRuns, ownRuns]
  game.note = note
  return progress(save, rng, t)
}

/**
 * この週までに予定されている回戦を進める。
 * 自校の試合が残っていればそこで止まる（force なら自校の試合も総合力で決める）
 */
export function progress(save: SaveData, rng: Rng, t: Tournament, force = false): string[] {
  const messages: string[] = []
  const own = save.playerSchoolId
  while (!t.finished && t.current < t.rounds.length && t.weeks[t.current]! <= save.calendar.week) {
    const r = t.current
    let blocked = false
    for (const g of t.rounds[r]!) {
      if (g.winner || !g.a || !g.b) {
        if (!g.winner && (g.a || g.b) && !(g.a && g.b)) {
          g.winner = g.a ?? g.b
          g.bye = true
        }
        continue
      }
      const isOwn = g.a === own || g.b === own
      if (isOwn && !force) {
        blocked = true
        continue
      }
      const res = quickGame(rng, save.schools[g.a]?.overall ?? 30, save.schools[g.b]?.overall ?? 30)
      g.winner = res.aWins ? g.a : g.b
      g.score = res.score
      if (isOwn) {
        const won = g.winner === own
        messages.push(`${t.name} ${roundName(t, r)}：${save.schools[won ? (g.a === own ? g.b : g.a) : g.winner]?.name}に${won ? '勝利' : '敗戦'}（試合をしなかったため結果だけを計算）`)
      }
    }
    if (blocked) break
    propagate(t, r)
    t.current += 1
    if (t.current >= t.rounds.length) {
      const final = t.rounds[t.rounds.length - 1]![0]!
      t.finished = true
      t.championId = final.winner
      messages.push(...finishTournament(save, t))
    }
  }
  return messages
}

// ---------------------------------------------------------------- 大会の後

/** 学校ごとの成績（どこまで勝ち進んだか）を言葉にする */
function placeOf(t: Tournament, schoolId: string): { text: string; wins: number; stage: number } | null {
  let wins = 0
  let lostAt = -1
  let played = false
  for (let r = 0; r < t.rounds.length; r++) {
    const g = t.rounds[r]!.find((x) => x.a === schoolId || x.b === schoolId)
    if (!g) break
    played = true
    if (g.winner === schoolId) {
      if (!g.bye) wins += 1
      continue
    }
    lostAt = r
    break
  }
  if (!played) return null
  const n = t.rounds.length
  if (lostAt === -1) return { text: '優勝', wins, stage: n }
  if (lostAt === n - 1) return { text: '準優勝', wins, stage: lostAt }
  if (lostAt === n - 2) return { text: 'ベスト4', wins, stage: lostAt }
  if (lostAt === n - 3) return { text: 'ベスト8', wins, stage: lostAt }
  if (lostAt === n - 4) return { text: 'ベスト16', wins, stage: lostAt }
  return { text: wins === 0 ? '初戦敗退' : `${lostAt + 1}回戦敗退`, wins, stage: lostAt }
}

/** 評判の変化（大会の成績から） */
function reputationGain(t: Tournament, place: { text: string; wins: number }): number {
  const spec = TOURNAMENT_SPECS[t.kind]
  if (spec.national) {
    let g = 4 + place.wins * 2
    if (place.text === '優勝') g += 6
    return g * spec.weight
  }
  const table: Record<string, number> = { 優勝: 6, 準優勝: 4, ベスト4: 2.5, ベスト8: 1.2, ベスト16: 0.4 }
  return (table[place.text] ?? -0.8) * spec.weight
}

/** 大会が終わったときの処理：評判・部費・記録 */
function finishTournament(save: SaveData, t: Tournament): string[] {
  const messages: string[] = []
  const spec = TOURNAMENT_SPECS[t.kind]
  const schoolIds = new Set<string>()
  for (const g of t.rounds[0]!) {
    if (g.a) schoolIds.add(g.a)
    if (g.b) schoolIds.add(g.b)
  }
  for (const id of schoolIds) {
    const school = save.schools[id]
    if (!school) continue
    const place = placeOf(t, id)
    if (!place) continue
    school.reputation = clamp(Math.round((school.reputation + reputationGain(t, place)) * 10) / 10, 0, 100)
    const label = `${spec.season}${spec.national ? ' 全国' : ' 県'}${place.text}`
    let rec = school.history.find((h) => h.year === t.year)
    if (!rec) school.history.push((rec = { year: t.year, results: [] }))
    rec.results.push(label)
    if (school.history.length > 30) school.history.splice(0, school.history.length - 30)
    if (id === save.playerSchoolId) {
      let bonus = 0
      if (spec.national) bonus = 60 + place.wins * 15
      else if (place.text === '優勝') bonus = 30
      else if (place.text === '準優勝' || place.text === 'ベスト4') bonus = 10
      school.funds += bonus
      const text = `${t.name}は${place.text}${spec.national ? '' : 'で終わった'}。${bonus > 0 ? `OB会から${bonus}万円の寄付が届いた。` : ''}`
      save.log.push({ year: save.calendar.year, week: save.calendar.week, text })
      messages.push(text)
    }
  }
  const champ = t.championId ? save.schools[t.championId] : null
  if (champ && champ.id !== save.playerSchoolId) {
    const text = `${t.name}は${champ.name}${spec.national ? `（${prefName(champ.prefCode)}）` : ''}が優勝した。`
    save.log.push({ year: save.calendar.year, week: save.calendar.week, text })
  }
  // 一時的に選手を作った他県の学校を元に戻す
  for (const id of t.tempDetailed) revertTemp(save, id)
  t.tempDetailed = []
  return messages
}

// ---------------------------------------------------------------- 他県の学校の選手

/** 総合力だけで管理している学校と対戦するときに、その場で選手を作る */
export function ensureDetailed(save: SaveData, rng: Rng, t: Tournament, schoolId: string): void {
  const school = save.schools[schoolId]
  if (!school || school.detailed) return
  const overall = school.overall
  school.detailed = true
  school.tempOverall = overall
  populateSchool(rng, save, school, clamp(overall / 0.75, 10, 95), 0)
  school.overall = overall
  t.tempDetailed.push(schoolId)
}

function revertTemp(save: SaveData, schoolId: string): void {
  const school = save.schools[schoolId]
  if (!school || school.tempOverall === undefined) return
  for (const id of school.playerIds) delete save.players[id]
  school.playerIds = []
  school.detailed = false
  school.overall = school.tempOverall
  delete school.tempOverall
}

/** 練習試合を組める相手か（評判が足りないと強豪には相手にしてもらえない） */
export function canRequestPractice(own: School, opp: School): boolean {
  return opp.overall <= Math.max(own.overall + 8, own.reputation + 30)
}

/** 毎月の部費の収入（評判が高いほど多い） */
export function monthlyFunds(save: SaveData): number {
  const own = save.schools[save.playerSchoolId]!
  const income = Math.round(4 + own.reputation / 6 + (own.kind === 'private' ? 4 : 0))
  own.funds += income
  return income
}

/** 設備の強化にかかる部費（万円） */
export function facilityCost(level: number): number {
  return 30 * (level + 1)
}
