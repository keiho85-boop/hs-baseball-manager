// 大会（春・夏・秋の県大会、夏・春の全国大会）
//
// ・組み合わせはトーナメント表。参加校が2のべき乗に満たないときは、上位シードが不戦勝になる
// ・各回戦を行う週が決まっていて、1週に2回戦まで進む
// ・自校の試合はプレイヤーが采配する。それ以外の試合は総合力で勝敗と点数を決める
// ・他県の県大会は組み合わせ表を残さず、全国大会の出場校を決めるときにまとめて計算する

import { Rng, clamp } from './rng'
import { PREFECTURES, prefName, wk } from './constants'
import { computeOverall, newId, populateSchool } from './world'
import type { Player, SaveData, School } from './types'

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
  /**
   * 選手育成モード：全国大会の相手に合わせるため一時的に能力を上げ下げした、選手を持つ学校（大会が終わったら元に戻す）。
   * 学校ごとに、元の総合と選手の元の能力
   */
  tempBoost?: Record<string, { overall: number; players: Record<string, Pick<Player, 'batting' | 'fielding' | 'running' | 'pitching'>> }>
}

interface Spec {
  season: string
  national: boolean
  weeks: number[]
  /** 評判の上がり方の重み */
  weight: number
  summer: boolean
}

const two = (a: number, b: number): number[] => [a, a, b, b]

/** 県大会は16校・4戦（1・2回戦の週、準決勝・決勝の週）。全国大会は6戦で3週 */
export const TOURNAMENT_SPECS: Record<TournamentKind, Spec> = {
  springPref: { season: '春', national: false, weeks: two(wk(4, 3), wk(4, 4)), weight: 0.6, summer: false },
  summerPref: { season: '夏', national: false, weeks: two(wk(6, 4), wk(7, 1)), weight: 1, summer: true },
  summerNational: { season: '夏', national: true, weeks: [wk(8, 2), wk(8, 2), wk(8, 3), wk(8, 3), wk(8, 4), wk(8, 4)], weight: 1, summer: true },
  autumnPref: { season: '秋', national: false, weeks: two(wk(10, 3), wk(10, 4)), weight: 0.8, summer: false },
  springNational: { season: '春', national: true, weeks: [wk(3, 2), wk(3, 2), wk(3, 3), wk(3, 3), wk(3, 4), wk(3, 4)], weight: 0.9, summer: false },
}

/** 県大会に出る学校の数 */
export const PREF_ENTRANTS = 16

/** その年の大会の週（選手育成モード1年目の春だけ、5月1〜2週） */
export function weeksOf(kind: TournamentKind, year: number, story: boolean): number[] {
  if (kind === 'springPref' && story && year === 1) return two(wk(5, 1), wk(5, 2))
  return TOURNAMENT_SPECS[kind].weeks
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
export function kindAtWeek(week: number, year = 2, story = false): TournamentKind | null {
  for (const k of ORDER) {
    const w = weeksOf(k, year, story)
    if (week >= w[0]! && week <= w[w.length - 1]!) return k
  }
  return null
}

/** セーブデータの今の週に開催中の大会の種類 */
export function kindNow(save: SaveData): TournamentKind | null {
  return kindAtWeek(save.calendar.week, save.calendar.year, !!save.story?.enabled)
}

/** 次に始まる大会と、始まるまでの週数（自校が出られる大会だけ） */
export function nextTournament(save: SaveData): { kind: TournamentKind; name: string; weeks: number } | null {
  const week = save.calendar.week
  const story = !!save.story?.enabled
  for (let add = 0; add < 60; add++) {
    const w = ((week - 1 + add) % 52) + 1
    const year = save.calendar.year + (week - 1 + add >= 52 ? 1 : 0)
    for (const k of ORDER) {
      if (weeksOf(k, year, story)[0] !== w) continue
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

/**
 * ストーリー：ライバル校（龍ヶ峰）とは県大会の決勝でしか当たらないように、自校を反対の山へ移す。
 * 同じ山にいたら、反対の山の（不戦勝でない）学校と入れ替える
 */
function separateRival(rng: Rng, save: SaveData, slots: (string | null)[]): void {
  const rival = save.story?.rivalId
  const own = save.playerSchoolId
  if (!rival || slots.length < 4) return
  const io = slots.indexOf(own)
  const ir = slots.indexOf(rival)
  if (io < 0 || ir < 0) return
  const half = slots.length / 2
  if (Math.floor(io / half) !== Math.floor(ir / half)) return
  const start = io < half ? half : 0
  // 入れ替える相手：反対の山で、相手がいる（不戦勝の枠でない）学校。シード校はなるべく避ける
  const cand: number[] = []
  for (let j = start; j < start + half; j++) {
    const partner = slots[j % 2 === 0 ? j + 1 : j - 1]
    if (slots[j] && partner) cand.push(j)
  }
  const pool = cand.length ? cand : Array.from({ length: half }, (_, k) => start + k).filter((j) => slots[j])
  if (pool.length === 0) return
  const j = rng.pick(pool)
  ;[slots[io], slots[j]] = [slots[j]!, slots[io]!]
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
  separateRival(rng, save, slots)
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

/** 県大会に出る16校：自校と（ストーリーの）ライバル校は必ず、残りは強い順 */
function prefEntrants(save: SaveData): string[] {
  const all = prefSchools(save, save.prefCode)
  const must = [save.playerSchoolId, save.story?.rivalId].filter((x): x is string => !!x && all.includes(x))
  const rest = all.filter((id) => !must.includes(id)).sort((a, b) => (save.schools[b]?.overall ?? 0) - (save.schools[a]?.overall ?? 0))
  return [...must, ...rest].slice(0, PREF_ENTRANTS)
}

// ---------------------------------------------------------------- 大会の作成と進行

export function findTournament(save: SaveData, year: number, kind: TournamentKind): Tournament | null {
  return (save.tournaments ?? []).find((t) => t.year === year && t.kind === kind) ?? null
}

/** 開催期間中なのに大会がまだなければ作る（週が変わったときと、データを読み込んだときに呼ぶ） */
export function ensureTournament(save: SaveData, rng: Rng): Tournament | null {
  const week = save.calendar.week
  const kind = kindNow(save)
  if (!kind) return null
  const year = save.calendar.year
  const existing = findTournament(save, year, kind)
  if (existing) return existing
  const spec = TOURNAMENT_SPECS[kind]
  let entrants: string[]
  if (!spec.national) {
    entrants = prefEntrants(save)
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
    weeks: weeksOf(kind, year, !!save.story?.enabled),
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
  const kind = kindNow(save)
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
      // ストーリー：龍ヶ峰は県大会の決勝までは必ず勝ち上がる（自校と当たるのは決勝だけ）
      const rival = save.story?.rivalId
      if (rival && !isOwn && t.prefCode !== null && (g.a === rival || g.b === rival) && res.aWins !== (g.a === rival)) {
        res.aWins = g.a === rival
        res.score = [res.score[1], res.score[0]]
      }
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
  // 人数不足などで試合をせずに負けたときは「棄権」と残す
  if (lostAt >= 0 && t.rounds[lostAt]!.find((x) => x.a === schoolId || x.b === schoolId)?.note?.includes('棄権')) return { text: '棄権', wins, stage: lostAt }
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
  revertBoost(save, t)
  return messages
}

// ---------------------------------------------------------------- 他県の学校の選手

/** 総合力だけで管理している学校と対戦するときに、その場で選手を作る */
/**
 * 選手育成モード：全国大会の相手の総合の目安（11月24日）。
 * 龍ヶ峰（県のライバル）の総合を基準にして、準決勝の手前までは龍ヶ峰の前後、準決勝・決勝は龍ヶ峰より上にする。
 * 値は [下限, 上限]（龍ヶ峰との差）。どこに入るかは学校ごとに決まっていて、試合前の表示と試合の強さが一致する
 */
export const NATIONAL_TARGET = { early: [-7, 1], semi: [0, 3], final: [1, 4] } as const

function unitHash(key: string): number {
  let h = 2166136261
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619)
  return ((h >>> 0) % 10000) / 10000
}

/** 全国大会の相手の総合の目安（選手育成モード以外、県大会は null） */
export function nationalTarget(save: SaveData, t: Tournament, round: number, schoolId: string): number | null {
  if (!save.story?.success || t.prefCode !== null) return null
  const rival = save.story.rivalId ? save.schools[save.story.rivalId] : undefined
  if (!rival) return null
  const base = computeOverall(rival, save.players)
  const n = t.rounds.length
  const [lo, hi] = round >= n - 1 ? NATIONAL_TARGET.final : round === n - 2 ? NATIONAL_TARGET.semi : NATIONAL_TARGET.early
  return Math.round(base + lo + (hi - lo) * unitHash(`${t.id}:${schoolId}`))
}

/** 能力をまとめて上げ下げする（全国大会の相手を目安の総合に合わせる） */
function shiftAbilities(p: Player, d: number): void {
  const c = (v: number) => clamp(Math.round(v + d), 1, 100)
  const b = p.batting
  b.contact = c(b.contact)
  b.power = c(b.power)
  b.eye = c(b.eye)
  p.running.speed = c(p.running.speed)
  const f = p.fielding
  f.arm = c(f.arm)
  f.range = c(f.range)
  f.catching = c(f.catching)
  f.throwing = c(f.throwing)
  const pt = p.pitching
  pt.control = c(pt.control)
  pt.stamina = c(pt.stamina)
  pt.kire = c(pt.kire)
  pt.velocity = clamp(Math.round(pt.velocity + d * 0.6), 100, 165)
}

/** 学校の選手の能力を、総合が目安になるまで上げ下げする */
function fitToTarget(save: SaveData, school: School, target: number): void {
  const members = school.playerIds.map((id) => save.players[id]).filter((p): p is Player => !!p && !p.retired)
  for (let i = 0; i < 6; i++) {
    const d = target - computeOverall(school, save.players)
    if (Math.abs(d) < 0.5) break
    for (const p of members) shiftAbilities(p, d)
  }
  school.overall = computeOverall(school, save.players)
}

export function ensureDetailed(save: SaveData, rng: Rng, t: Tournament, schoolId: string): void {
  const school = save.schools[schoolId]
  if (!school) return
  const round = t.rounds.findIndex((games) => games.some((g) => !g.winner && (g.a === schoolId || g.b === schoolId)))
  const target = nationalTarget(save, t, round < 0 ? t.current : round, schoolId)
  if (school.detailed) {
    // 選手を持つ他県の強豪：大会の間だけ、目安の総合に合わせて能力を上げ下げする（大会が終わったら元に戻す）
    if (target === null || school.id === save.playerSchoolId || t.tempBoost?.[schoolId] || t.tempDetailed.includes(schoolId)) return
    const players: NonNullable<Tournament['tempBoost']>[string]['players'] = {}
    for (const id of school.playerIds) {
      const p = save.players[id]
      if (!p) continue
      players[id] = JSON.parse(JSON.stringify({ batting: p.batting, fielding: p.fielding, running: p.running, pitching: p.pitching }))
    }
    t.tempBoost = { ...(t.tempBoost ?? {}), [schoolId]: { overall: school.overall, players } }
    fitToTarget(save, school, target)
    return
  }
  const overall = school.overall
  school.detailed = true
  school.tempOverall = overall
  if (target !== null) {
    // 選手育成モードの全国大会：龍ヶ峰を基準にした目安の総合に合わせる（表示もその値）
    populateSchool(rng, save, school, clamp(target / 0.75, 10, 97), 0)
    fitToTarget(save, school, target)
  } else {
    populateSchool(rng, save, school, clamp(overall / 0.75, 10, 97), 0)
    school.overall = overall
  }
  t.tempDetailed.push(schoolId)
}

function revertBoost(save: SaveData, t: Tournament): void {
  for (const [schoolId, b] of Object.entries(t.tempBoost ?? {})) {
    for (const [id, a] of Object.entries(b.players)) {
      const p = save.players[id]
      if (p) Object.assign(p, a)
    }
    const school = save.schools[schoolId]
    if (school) school.overall = b.overall
  }
  t.tempBoost = {}
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
