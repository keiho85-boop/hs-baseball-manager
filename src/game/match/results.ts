// 試合の結果を選手データに反映する（成績、疲れ、1週間の球数、肩・肘の不安）

import { Rng, clamp } from '../rng'
import { newStats, fullName } from '../player'
import type { Player, SaveData } from '../types'
import type { MatchState } from './types'

const INJURY_FACTOR = { easy: 0.5, normal: 1, hard: 1.7 } as const

export interface MatchSummary {
  messages: string[]
}

export function applyMatchResults(save: SaveData, s: MatchState, rng: Rng): MatchSummary {
  const messages: string[] = []
  const factor = INJURY_FACTOR[save.settings.injury]
  const ownId = save.playerSchoolId

  // 打撃成績
  for (const [id, b] of Object.entries(s.batting)) {
    const p = save.players[id]
    if (!p || b.pa === 0) continue
    for (const target of [(p.seasonStats ??= newStats()), (p.careerStats ??= newStats())]) {
      const t = target.batting
      t.games += 1
      t.atBats += b.ab
      t.hits += b.h
      t.doubles = (t.doubles ?? 0) + b.d
      t.triples = (t.triples ?? 0) + b.t
      t.homeRuns += b.hr
      t.rbi += b.rbi
      t.walks = (t.walks ?? 0) + b.bb
      t.strikeouts = (t.strikeouts ?? 0) + b.k
      t.steals += b.sb
    }
    p.condition.stamina = clamp(p.condition.stamina - 8, 0, 100)
  }

  // 投手成績と、肩・肘の不安
  for (const [id, pb] of Object.entries(s.pitching)) {
    const p = save.players[id]
    if (!p || pb.pitches === 0) continue
    for (const target of [(p.seasonStats ??= newStats()), (p.careerStats ??= newStats())]) {
      const t = target.pitching
      t.games += 1
      t.outs += pb.outs
      t.earnedRuns += pb.r
      t.hits = (t.hits ?? 0) + pb.h
      t.strikeouts += pb.k
      t.walks += pb.bb
      t.pitches = (t.pitches ?? 0) + pb.pitches
      if (s.winningPitcherId === id) t.wins += 1
      if (s.losingPitcherId === id) t.losses += 1
    }
    p.weeklyPitches += pb.pitches
    p.condition.stamina = clamp(Math.round(p.condition.stamina - pb.pitches * 0.45 - pb.fatigue * 15), 0, 100)
    const msg = armCheck(p, pb.pitches, pb.fatigue, factor, rng)
    if (msg && p.schoolId === ownId) messages.push(msg)
  }
  return { messages }
}

/** 投げ過ぎによる肩・肘の不安と、その悪化を判定する */
export function armCheck(p: Player, pitches: number, fatigue: number, factor: number, rng: Rng): string | null {
  const durability = 1.5 - p.common.durability / 100
  const iron = p.skills.includes('iron_arm') ? 0.5 : 1
  const load = factor * durability * iron
  const c = p.condition
  if (!c.armIssue) {
    const risk =
      (0.002 + Math.max(0, pitches - 100) * 0.0009 + Math.max(0, p.weeklyPitches - 500) * 0.0006 + fatigue * 0.012) * load
    if (rng.chance(clamp(risk, 0, 0.5))) {
      const part = rng.chance(0.5) ? 'shoulder' : 'elbow'
      c.armIssue = { part, severity: pitches > 140 || p.weeklyPitches > 600 ? 2 : 1, restWeeks: 0 }
      return `${fullName(p)}が${part === 'shoulder' ? '肩' : '肘'}に違和感を訴えている…（${part === 'shoulder' ? '肩' : '肘'}の不安）`
    }
    return null
  }
  // 不安を抱えたまま投げると、悪化することがある
  c.armIssue.restWeeks = 0
  const worsen = (0.05 + pitches * 0.0012 + c.armIssue.severity * 0.03) * load
  if (!rng.chance(clamp(worsen, 0, 0.7))) return null
  const part = c.armIssue.part === 'shoulder' ? '肩' : '肘'
  if (rng.chance(0.15)) {
    // まれに投手としては引退
    p.pitchingRetired = true
    c.armIssue = null
    if (p.mainPosition === 'P') p.practiceMenu = 'batting'
    return `${fullName(p)}の${part}の状態が悪化し、投手を続けられなくなった。野手としてはプレーできる。`
  }
  p.pitching.velocity = Math.max(95, p.pitching.velocity - rng.int(4, 9))
  p.pitching.control = Math.max(1, p.pitching.control - rng.int(6, 14))
  p.pitching.stamina = Math.max(1, p.pitching.stamina - rng.int(4, 10))
  c.armIssue.severity = Math.min(3, c.armIssue.severity + 1)
  return `${fullName(p)}の${part}の状態が悪化し、投手としての能力が大きく下がった…`
}

/** 肩・肘の不安が治るのに必要な休養（週） */
export function armRestNeeded(severity: number): number {
  return 6 + severity * 4
}
