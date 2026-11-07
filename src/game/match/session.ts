// 自校の試合の準備と後片付け（ストアから使う）

import { Rng } from '../rng'
import { activeMembers } from '../season'
import { fullName } from '../player'
import { newId } from '../world'
import type { LineupConfig, SaveData } from '../types'
import { autoLineup, lineupValid } from './lineup'
import { createMatch, defaultOptions, score, type MatchContext } from './engine'
import { applyMatchResults } from './results'
import type { MatchOptions, MatchState } from './types'
import { TACTIC_BONUS, consumeOnce, hasModifier } from '../modifiers'

/** 自校のオーダー。保存したものが使えなければ、自動で組み直す */
export function ownLineup(save: SaveData): LineupConfig {
  const school = save.schools[save.playerSchoolId]!
  const saved = save.lineup
  if (saved && lineupValid(saved, save.players)) return saved
  return autoLineup(activeMembers(save, school), saved?.useDH ?? true)
}

export function startMatch(save: SaveData, opponentId: string, rng: Rng, partial: Partial<MatchOptions> = {}): MatchState {
  const own = save.schools[save.playerSchoolId]!
  const opp = save.schools[opponentId]!
  const ctx: MatchContext = { players: save.players, rng }
  const ownLine = ownLineup(save)
  // 座学などの効果：作戦が決まりやすい（「次の1試合だけ」のものは、ここで使い切る）
  const tacticBonus = hasModifier(save, 'tactic') ? TACTIC_BONUS : 0
  consumeOnce(save, 'tactic')
  const oppLine = autoLineup(activeMembers(save, opp), ownLine.useDH)
  // 練習試合は自校が後攻か先攻かをランダムに
  const ownHome = rng.chance(0.5)
  const ownInput = { schoolId: own.id, name: own.name, lineup: ownLine }
  const oppInput = { schoolId: opp.id, name: opp.name, lineup: oppLine }
  return createMatch(
    ctx,
    ownHome ? oppInput : ownInput,
    ownHome ? ownInput : oppInput,
    defaultOptions({ luck: 'normal', userSchoolId: own.id, tacticBonus, ...partial }),
    newId(save, 'm'),
  )
}

export interface FinishResult {
  messages: string[]
  won: boolean | null
  text: string
}

/** 試合後：成績を反映し、記録に残す */
export function finishMatch(save: SaveData, m: MatchState, rng: Rng): FinishResult {
  const { messages } = applyMatchResults(save, m, rng)
  const ownIsHome = m.home.schoolId === save.playerSchoolId
  const [a, h] = score(m)
  const own = ownIsHome ? h : a
  const opp = ownIsHome ? a : h
  const oppName = ownIsHome ? m.away.name : m.home.name
  const won = m.winner === null ? null : (m.winner === 'home') === ownIsHome
  const result = won === null ? '引き分け' : won ? '勝利' : '敗戦'
  const inn = m.inning < m.options.innings ? `（${m.inning}回コールド）` : m.inning > m.options.innings ? `（延長${m.inning}回）` : ''
  const text = `${m.options.label}：${oppName}に ${own}-${opp} で${result}${inn}`
  save.log.push({ year: save.calendar.year, week: save.calendar.week, text })
  // 活躍した選手を記録に残す
  const ownTeam = ownIsHome ? m.home : m.away
  const hero = ownTeam.lineup
    .map((s) => ({ id: s.playerId, b: m.batting[s.playerId] }))
    .filter((x) => x.b)
    .sort((x, y) => y.b!.rbi * 2 + y.b!.h - (x.b!.rbi * 2 + x.b!.h))[0]
  if (hero && hero.b && hero.b.h >= 2) {
    const p = save.players[hero.id]
    if (p) messages.unshift(`${fullName(p)}が${hero.b.h}安打${hero.b.rbi}打点の活躍！`)
  }
  return { messages, won, text }
}
