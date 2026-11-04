import { describe, expect, it } from 'vitest'
import { Rng } from '../src/game/rng'
import { createNewGame } from '../src/game/world'
import { advanceWeek } from '../src/game/season'
import { ensureDetailed, findTournament, pendingOwnGame, recordOwnResult, roundName } from '../src/game/tournament'
import type { SaveData } from '../src/game/types'

function world(seed = 3): SaveData {
  return createNewGame({
    slot: 1,
    managerName: 'テスト',
    prefCode: 27,
    kind: 'public',
    schoolName: 'テスト高校',
    settings: { injury: 'normal', luck: 'normal', cutin: true, gameSpeed: 2, lightMode: false },
    seed,
  })
}

describe('大会', () => {
  it('1年間で5つの大会が開かれ、優勝校が決まる', () => {
    const save = world()
    for (let i = 0; i < 52; i++) advanceWeek(save)
    const year1 = (save.tournaments ?? []).filter((t) => t.year === 1)
    expect(year1.map((t) => t.kind)).toEqual(['springPref', 'summerPref', 'summerNational', 'autumnPref', 'springNational'])
    for (const t of year1) {
      expect(t.finished).toBe(true)
      expect(t.championId).toBeTruthy()
    }
    const nat = year1.find((t) => t.kind === 'summerNational')!
    expect(nat.rounds[0]!.filter((g) => g.a).length + nat.rounds[0]!.filter((g) => g.b).length).toBe(47)
    // 大会の結果が学校の記録に残る
    const own = save.schools[save.playerSchoolId]!
    expect(own.history.find((h) => h.year === 1)?.results.length).toBeGreaterThanOrEqual(3)
  })

  it('自校の試合は結果を記録するまで止まり、勝てば次の相手が決まる', () => {
    const save = world(5)
    while (save.calendar.week < 15) advanceWeek(save)
    const t = findTournament(save, 1, 'summerPref')!
    const p1 = pendingOwnGame(save)
    expect(p1).not.toBeNull()
    expect(roundName(t, p1!.round)).toBe('1回戦')
    const rng = new Rng(save.rngState)
    recordOwnResult(save, rng, t, p1!.round, true, 5, 2, '')
    const p2 = pendingOwnGame(save)
    expect(p2?.round).toBe(1)
    expect(t.rounds[0]!.every((g) => g.winner)).toBe(true)
    recordOwnResult(save, rng, t, p2!.round, false, 1, 3, '')
    expect(pendingOwnGame(save)).toBeNull()
    // 同じ週の他の試合も終わっている
    expect(t.rounds[1]!.every((g) => g.winner)).toBe(true)
  })

  it('県大会で優勝すると全国大会に出られ、他県の相手は試合のときだけ選手が作られる', () => {
    const save = world(7)
    const winAll = () => {
      for (let guard = 0; guard < 10; guard++) {
        const p = pendingOwnGame(save)
        if (!p) return
        const rng = new Rng(save.rngState)
        ensureDetailed(save, rng, p.t, p.opponentId)
        recordOwnResult(save, rng, p.t, p.round, true, 6, 1, '')
        save.rngState = rng.getState()
      }
    }
    while (save.calendar.week < 22) {
      winAll()
      advanceWeek(save, { kind: 'tournament' })
    }
    const pref = findTournament(save, 1, 'summerPref')!
    const nat = findTournament(save, 1, 'summerNational')!
    expect(pref.championId).toBe(save.playerSchoolId)
    expect(nat.championId).toBe(save.playerSchoolId)
    // 一時的に作った他県の学校の選手は、大会後に消えている
    const temp = Object.values(save.schools).filter((s) => s.tempOverall !== undefined)
    expect(temp.length).toBe(0)
    const own = save.schools[save.playerSchoolId]!
    expect(own.history[0]!.results).toContain('夏 全国優勝')
  })
})
