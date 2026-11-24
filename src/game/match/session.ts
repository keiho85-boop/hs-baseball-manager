// 自校の試合の準備と後片付け（ストアから使う）

import { Rng } from '../rng'
import { activeMembers } from '../season'
import { fullName } from '../player'
import { computeOverall, newId } from '../world'
import type { LineupConfig, SaveData } from '../types'
import { autoLineup, available, lineupValid } from './lineup'
import { createMatch, defaultOptions, score, type MatchContext } from './engine'
import { applyMatchResults } from './results'
import type { MatchOptions, MatchState } from './types'
import { TACTIC_BONUS, absWeek, consumeOnce, hasModifier } from '../modifiers'
import { focusPlayer } from '../success/state'

/** 自校のオーダー。保存したものが使えなければ、自動で組み直す */
export function ownLineup(save: SaveData): LineupConfig {
  const school = save.schools[save.playerSchoolId]!
  const saved = save.lineup
  const focus = focusPlayer(save)
  // 選手育成モード：出られる育成選手が入っていない古いオーダーは使わない
  const focusMissing = !!focus && !!save.story?.success && available(focus) && !focus.retired
    && !!saved && !saved.batters.some((b) => b.playerId === focus.id) && saved.startingPitcherId !== focus.id
  if (saved && !focusMissing && lineupValid(saved, save.players)) {
    // 控え：出られない選手（ケガ・引退）は外す。選手育成モードでは、スタメン以外の全員が控え
    const starting = new Set([...saved.batters.map((b) => b.playerId), saved.startingPitcherId])
    const ok = (id: string): boolean => {
      const p = save.players[id]
      return !!p && !p.retired && p.schoolId === school.id && available(p) && !starting.has(id)
    }
    const bench = saved.bench.filter(ok)
    if (save.story?.enabled) for (const p of activeMembers(save, school)) if (ok(p.id) && !bench.includes(p.id)) bench.push(p.id)
    return { ...saved, bench }
  }
  return autoLineup(activeMembers(save, school), saved?.useDH ?? true, focus)
}

/** 選手育成モードの全国大会の相手の上乗せ（調整用。打撃・投球の能力に足される）。11月24日：相手の総合を龍ヶ峰基準の目安に合わせるようにしたので 0 */
export const NATIONAL_FORM = { base: 0, yearly: 0 }

/**
 * 選手育成モードの大会（11月24日）：総合で上回る相手には最低9割勝てる。
 * 龍ヶ峰戦と全国大会の準決勝以降は対象外。対象の試合の rate の割合は相手の調子を form だけ下げ、ほぼ勝てる試合にする
 * （残りの1割は普段どおりの試合で、作戦などの差はここに出る）
 */
export const FAVORED = { rate: 0.9, form: -20 }

/** 総合で上回っていれば最低9割勝てる試合か */
export function favoredMatch(save: SaveData, tournamentId: string, round: number, opponentId: string): boolean {
  if (!save.story?.success || opponentId === save.story.rivalId) return false
  const t = save.tournaments?.find((x) => x.id === tournamentId)
  if (!t) return false
  if (t.prefCode === null && round >= t.rounds.length - 2) return false
  const own = save.schools[save.playerSchoolId]
  const opp = save.schools[opponentId]
  if (!own || !opp) return false
  return computeOverall(own, save.players) > computeOverall(opp, save.players)
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
  // 選手育成モード：全国大会の相手は、各地の代表にふさわしい手ごわさにする（年を追うごとに強く）
  const tour = partial.tournament ? save.tournaments?.find((x) => x.id === partial.tournament!.id) : undefined
  const tk = tour?.kind
  // 「大舞台の鬼」：県大会の準決勝以降
  const lateRound = !!tour && !!partial.tournament && tour.prefCode !== null && partial.tournament.round >= tour.rounds.length - 2
  // 「下剋上」：学校の総合の比較
  const ratings = { [own.id]: own.overall, [opp.id]: opp.overall }
  // 選手育成モード：龍ヶ峰のエース（投手で制球とキレが一番の選手）は、キレに弱点がある
  const weakAce =
    save.story?.success && opp.id === save.story.rivalId
      ? activeMembers(save, opp)
          .filter((p) => p.mainPosition === 'P')
          .sort((a, b) => b.pitching.control + b.pitching.kire - a.pitching.control - a.pitching.kire)[0]?.id
      : undefined
  const favored = !!partial.tournament && favoredMatch(save, partial.tournament.id, partial.tournament.round, opp.id) && rng.chance(FAVORED.rate)
  const oppForm =
    (save.story?.success && (tk === 'summerNational' || tk === 'springNational') ? NATIONAL_FORM.base + (save.calendar.year - 1) * NATIONAL_FORM.yearly : 0) +
    (favored ? FAVORED.form : 0)
  const ownInput = { schoolId: own.id, name: own.name, lineup: ownLine }
  const oppInput = { schoolId: opp.id, name: opp.name, lineup: oppLine }
  return createMatch(
    ctx,
    ownHome ? oppInput : ownInput,
    ownHome ? ownInput : oppInput,
    defaultOptions({ luck: 'normal', userSchoolId: own.id, tacticBonus, ignoreCondition: !!save.story?.success, oppForm, lateRound, ratings, weakAce, ...partial }),
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
  // 「負けず嫌い」：負けたら次の練習の伸びが良い（試合に出た自校の選手）
  {
    const [aa, hh] = score(m)
    const ownHome = m.home.schoolId === save.playerSchoolId
    const lost = ownHome ? hh < aa : aa < hh
    const own = ownHome ? m.home : m.away
    for (const id of [...own.lineup.map((x) => x.playerId), ...own.pitchersUsed]) {
      const p = save.players[id]
      if (p) p.condition.lostLastGame = lost
    }
    // 大地の続きの話（2話）：自校より総合の高い相手と戦った週に印を付ける
    const oppId = ownHome ? m.away.schoolId : m.home.schoolId
    const r = m.options.ratings
    if (r && (r[oppId] ?? 0) > (r[save.playerSchoolId] ?? 0)) (save.flags ??= {}).strongFought = absWeek(save)
  }
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
    if (p) messages.unshift(`${fullName(p)}が${hero.b.h}安打${hero.b.rbi > 0 ? `${hero.b.rbi}打点` : ''}の活躍！`)
  }
  return { messages, won, text }
}
