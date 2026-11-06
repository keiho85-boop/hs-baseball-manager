// 場面の発生条件や台詞の置き換えに使う、ゲームの状態の読み取り

import { weekToDate } from '../constants'
import { playerRating } from '../player'
import { findTournament, ownAlive, pendingOwnGame, type Tournament, type TournamentKind } from '../tournament'
import type { Player, SaveData } from '../types'
import type { StoryState } from './types'

export function year(save: SaveData): number {
  return save.calendar.year
}

export function week(save: SaveData): number {
  return save.calendar.week
}

export function month(save: SaveData): number {
  return weekToDate(save.calendar.week).month
}

/** 自校の部員（引退していない、助っ人を含む） */
export function activeOwn(save: SaveData): Player[] {
  const own = save.schools[save.playerSchoolId]
  if (!own) return []
  return own.playerIds.map((id) => save.players[id]).filter((p): p is Player => !!p && !p.retired)
}

/** 自校の今週の大会の試合（まだ戦っていないもの） */
export function pendingGame(save: SaveData): { t: Tournament; round: number; opponentId: string } | null {
  const p = pendingOwnGame(save)
  return p ? { t: p.t, round: p.round, opponentId: p.opponentId } : null
}

/** 自校がその大会に出ていて、もう負けたか（または大会が終わったか） */
export function ownOut(save: SaveData, y: number, kind: TournamentKind): boolean {
  const t = findTournament(save, y, kind)
  if (!t) return false
  const own = save.playerSchoolId
  const entered = t.rounds[0]!.some((g) => g.a === own || g.b === own)
  if (!entered) return t.finished
  return !ownAlive(save, t)
}

/** その大会で自校が勝った試合の数（不戦勝を除く） */
export function ownWins(t: Tournament, ownId: string): number {
  let n = 0
  for (const games of t.rounds) for (const g of games) if (!g.bye && g.winner === ownId && g.a && g.b) n += 1
  return n
}

/** 自校がその大会で準決勝の舞台に立ったか（ベスト4） */
export function reachedBest4(t: Tournament, ownId: string): boolean {
  const r = t.rounds.length - 2
  if (r < 0) return false
  return t.rounds[r]!.some((g) => g.a === ownId || g.b === ownId)
}

/** 自校がその全国大会に出場したか */
export function inBracket(t: Tournament, ownId: string): boolean {
  return t.rounds[0]!.some((g) => g.a === ownId || g.b === ownId)
}

/** 主将：選んだ主将がまだ現役ならその選手、いなければ最上級生で一番実力のある選手 */
export function captain(save: SaveData, st: StoryState): Player | null {
  const list = activeOwn(save).filter((p) => !p.helper)
  if (st.captainId) {
    const c = list.find((p) => p.id === st.captainId)
    if (c) return c
  }
  if (!list.length) return null
  const top = Math.max(...list.map((p) => p.grade))
  return [...list].filter((p) => p.grade === top).sort((a, b) => playerRating(b) - playerRating(a))[0] ?? null
}

export function daichi(save: SaveData, st: StoryState): Player | null {
  return st.daichiId ? (save.players[st.daichiId] ?? null) : null
}

export function schoolName(save: SaveData, id: string | null | undefined): string {
  return (id && save.schools[id]?.name) || '相手校'
}

export function ownName(save: SaveData): string {
  return save.schools[save.playerSchoolId]?.name ?? '本校'
}
