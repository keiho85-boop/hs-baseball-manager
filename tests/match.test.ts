import { describe, expect, it } from 'vitest'
import { Rng } from '../src/game/rng'
import { createNewGame } from '../src/game/world'
import { activeMembers, advanceWeek } from '../src/game/season'
import { autoLineup, lineupValid } from '../src/game/match/lineup'
import {
  createMatch,
  defaultOptions,
  score,
  simulatePlateAppearance,
  simulateToEnd,
  type MatchContext,
} from '../src/game/match/engine'
import { applyMatchResults } from '../src/game/match/results'
import { runBalance } from '../src/game/match/balance'
import type { MatchState } from '../src/game/match/types'
import type { SaveData, School } from '../src/game/types'

function world(seed = 1): SaveData {
  const save = createNewGame({
    slot: 1,
    managerName: 'テスト',
    prefCode: 13,
    kind: 'private',
    schoolName: 'テスト学園',
    settings: { injury: 'normal', luck: 'normal', cutin: true, gameSpeed: 2, lightMode: false },
    seed,
  })
  for (let i = 0; i < 10; i++) advanceWeek(save)
  return save
}

function twoSchools(save: SaveData): [School, School] {
  const list = Object.values(save.schools).filter((s) => s.detailed && s.prefCode === 13)
  return [list[0]!, list[1]!]
}

function newMatch(save: SaveData, rngSeed: number): { m: MatchState; ctx: MatchContext } {
  const [a, b] = twoSchools(save)
  const ctx: MatchContext = { players: save.players, rng: Rng.fromSeed(rngSeed) }
  const m = createMatch(
    ctx,
    { schoolId: a.id, name: a.name, lineup: autoLineup(activeMembers(save, a), false) },
    { schoolId: b.id, name: b.name, lineup: autoLineup(activeMembers(save, b), true) },
    defaultOptions({ userSchoolId: a.id }),
    'm1',
  )
  return { m, ctx }
}

describe('オーダーの自動編成', () => {
  const save = world()
  const school = save.schools[save.playerSchoolId]!
  it('9人の打順と全ポジションがそろう（DHあり・なし）', () => {
    for (const dh of [true, false]) {
      const l = autoLineup(activeMembers(save, school), dh)
      expect(l.batters).toHaveLength(9)
      expect(lineupValid(l, save.players)).toBe(true)
    }
  })
})

describe('試合エンジン', () => {
  it('試合が最後まで進み、スコアと記録が合う', () => {
    const save = world(2)
    for (let seed = 1; seed <= 30; seed++) {
      const { m, ctx } = newMatch(save, seed)
      simulateToEnd(m, ctx)
      expect(m.finished).toBe(true)
      const [a, h] = score(m)
      if (m.winner === 'away') expect(a).toBeGreaterThan(h)
      if (m.winner === 'home') expect(h).toBeGreaterThan(a)
      // 打者の得点の合計と、スコアが一致する
      const runs = Object.values(m.batting).reduce((s, b) => s + b.r, 0)
      expect(runs).toBe(a + h)
      // 9回以上行われている（コールドなし）
      expect(m.inning).toBeGreaterThanOrEqual(9)
      // 回ごとの得点の枠：先攻は行った回の数、後攻は同じか1つ少ない
      expect(m.away.runsByInning.length).toBe(m.inning)
      expect(m.home.runsByInning.length).toBeGreaterThanOrEqual(m.inning - 1)
      expect(m.home.runsByInning.length).toBeLessThanOrEqual(m.inning)
    }
  })

  it('同じ乱数なら同じ結果になる（やり直し防止）', () => {
    const save = world(3)
    const r1 = newMatch(save, 99)
    const r2 = newMatch(save, 99)
    simulateToEnd(r1.m, r1.ctx)
    simulateToEnd(r2.m, r2.ctx)
    expect(score(r1.m)).toEqual(score(r2.m))
  })

  it('途中で保存して再開しても、続けた場合と同じ結果になる', () => {
    const save = world(4)
    const a = newMatch(save, 7)
    for (let i = 0; i < 25; i++) simulatePlateAppearance(a.m, a.ctx)
    // 試合の状態と乱数の状態を保存して読み込み直す
    const saved = JSON.parse(JSON.stringify(a.m)) as MatchState
    const rngState = a.ctx.rng.getState()
    simulateToEnd(a.m, a.ctx)
    const ctx2: MatchContext = { players: save.players, rng: new Rng(rngState) }
    simulateToEnd(saved, ctx2)
    expect(score(saved)).toEqual(score(a.m))
  })

  it('コールドゲームが成立する', () => {
    const save = world(5)
    const list = Object.values(save.schools).filter((s) => s.detailed && s.prefCode === 13).sort((x, y) => y.overall - x.overall)
    const strong = list[0]!
    const weak = list[list.length - 1]!
    let mercy = 0
    for (let seed = 1; seed <= 20; seed++) {
      const ctx: MatchContext = { players: save.players, rng: Rng.fromSeed(seed) }
      const m = createMatch(
        ctx,
        { schoolId: weak.id, name: weak.name, lineup: autoLineup(activeMembers(save, weak), true) },
        { schoolId: strong.id, name: strong.name, lineup: autoLineup(activeMembers(save, strong), true) },
        defaultOptions({ mercy: [[5, 10], [7, 7]] }),
        'mc',
      )
      simulateToEnd(m, ctx)
      if (m.inning < 9) mercy++
    }
    expect(mercy).toBeGreaterThan(0)
  })

  it('試合の結果が選手の成績と球数に反映される', () => {
    const save = world(6)
    const { m, ctx } = newMatch(save, 3)
    simulateToEnd(m, ctx)
    applyMatchResults(save, m, ctx.rng)
    const starter = save.players[m.away.pitchersUsed[0]!]!
    expect(starter.weeklyPitches).toBeGreaterThan(0)
    expect(starter.seasonStats?.pitching.games).toBe(1)
    const batter = save.players[m.away.lineup[0]!.playerId]!
    expect(batter.seasonStats?.batting.games).toBe(1)
  })
})

describe('試合のバランス', () => {
  it('高校野球らしい成績の範囲に収まる', { timeout: 60000 }, () => {
    const save = world(8)
    const r = runBalance(save, 400, 3)
    expect(r.runsPerTeam).toBeGreaterThan(2.5)
    expect(r.runsPerTeam).toBeLessThan(6.5)
    expect(r.avg).toBeGreaterThan(0.23)
    expect(r.avg).toBeLessThan(0.32)
    expect(r.hrPerGame).toBeLessThan(1.5)
    expect(r.kRate).toBeGreaterThan(0.08)
    expect(r.kRate).toBeLessThan(0.25)
    expect(r.bbRate).toBeGreaterThan(0.04)
  })
})
