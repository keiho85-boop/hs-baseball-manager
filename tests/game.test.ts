import { describe, expect, it } from 'vitest'
import { Rng } from '../src/game/rng'
import { createNewGame } from '../src/game/world'
import { activeMembers, advanceWeek, schoolMembers } from '../src/game/season'
import { packSave, unpackSave, exportToBlob, importFromBlob } from '../src/game/serialize'
import { playerRating } from '../src/game/player'
import { MIN_ROSTER, SEASON_WEEKS, rankOf } from '../src/game/constants'
import type { SaveData } from '../src/game/types'

function newGame(seed = 42): SaveData {
  return createNewGame({
    slot: 1,
    managerName: 'テスト監督',
    prefCode: 27,
    kind: 'public',
    schoolName: '白鷺テスト高校',
    settings: { injury: 'normal', luck: 'normal', cutin: true, gameSpeed: 2, lightMode: false },
    seed,
  })
}

describe('乱数', () => {
  it('同じ状態からは同じ結果になる（やり直し防止）', () => {
    const a = Rng.fromSeed(1)
    const state = a.getState()
    const first = [a.next(), a.next(), a.next()]
    const b = new Rng(state)
    expect([b.next(), b.next(), b.next()]).toEqual(first)
  })
})

describe('新しいゲーム', () => {
  const save = newGame()
  const own = save.schools[save.playerSchoolId]!

  it('47都道府県×32校が作られ、自校は選手を個別に持つ', () => {
    expect(Object.keys(save.schools).length).toBe(47 * 32)
    expect(own.detailed).toBe(true)
    expect(own.name).toBe('白鷺テスト高校')
  })

  it('選手の総数とデータ量が想定の範囲に収まる', () => {
    const count = Object.keys(save.players).length
    expect(count).toBeGreaterThan(4000)
    expect(count).toBeLessThan(9000)
    const bytes = JSON.stringify(save).length
    expect(bytes).toBeLessThan(8_000_000)
    console.log("players", count, "bytes", bytes)
  })

  it('自校の部員が9人以上いて、投手と捕手がいる', () => {
    const members = schoolMembers(save, own)
    expect(members.length).toBeGreaterThanOrEqual(MIN_ROSTER)
    expect(members.some((p) => p.mainPosition === 'P')).toBe(true)
    expect(members.some((p) => p.mainPosition === 'C')).toBe(true)
  })

  it('入部時の1年生はF〜E前後が中心', () => {
    const freshmen = Object.values(save.players).filter((p) => p.grade === 1)
    const avg = freshmen.reduce((s, p) => s + p.batting.contact, 0) / freshmen.length
    expect(['F', 'E', 'D']).toContain(rankOf(avg))
  })
})

describe('年度の進行', () => {
  it('1年進めると、引退・卒業・入部が起き、部員数が保たれる', () => {
    const save = newGame(7)
    const own = save.schools[save.playerSchoolId]!
    const firstThirdYears = schoolMembers(save, own).filter((p) => p.grade === 3).map((p) => p.id)
    let retiredSeen = false
    let newYearSeen = false
    for (let i = 0; i < 52; i++) {
      const r = advanceWeek(save)
      if (save.calendar.week === SEASON_WEEKS.thirdYearRetire + 1 && save.calendar.year === 1) {
        retiredSeen = firstThirdYears.every((id) => save.players[id]?.retired)
      }
      if (r.newYear) newYearSeen = true
      expect(activeMembers(save, own).length).toBeGreaterThanOrEqual(MIN_ROSTER)
    }
    expect(retiredSeen).toBe(true)
    expect(newYearSeen).toBe(true)
    expect(save.calendar).toEqual({ year: 2, week: 1 })
    // 卒業した3年生はOB名鑑に載り、選手データからは消える
    expect(save.alumni.length).toBe(firstThirdYears.filter((id) => !id.startsWith('helper')).length)
    for (const id of firstThirdYears) expect(save.players[id]).toBeUndefined()
    expect(schoolMembers(save, own).some((p) => p.grade === 1)).toBe(true)
  })

  it('選手は1年で成長し、3年夏には主力がC〜B前後に届く', { timeout: 60000 }, () => {
    const save = newGame(11)
    const before = new Map(Object.values(save.players).map((p) => [p.id, playerRating(p)]))
    for (let i = 0; i < 20; i++) advanceWeek(save)
    const grown = Object.values(save.players).filter((p) => (before.get(p.id) ?? 999) < playerRating(p))
    expect(grown.length).toBeGreaterThan(Object.keys(save.players).length * 0.5)

    // 3年目の夏まで進めて、1年目に入部した世代の上位を確認する
    const save2 = newGame(12)
    const own = save2.schools[save2.playerSchoolId]!
    while (save2.calendar.year < 3 || save2.calendar.week < 18) advanceWeek(save2)
    const thirds = schoolMembers(save2, own).filter((p) => p.grade === 3 && !p.helper)
    const best = Math.max(...thirds.map(playerRating))
    expect(best).toBeGreaterThanOrEqual(50)
    expect(best).toBeLessThanOrEqual(90)
  })

  it('何年進めても部員とデータ量が破綻しない', { timeout: 60000 }, () => {
    const save = newGame(3)
    for (let i = 0; i < 52 * 5; i++) advanceWeek(save)
    const count = Object.keys(save.players).length
    console.log('after5y', count, JSON.stringify(save).length)
    expect(count).toBeGreaterThan(4000)
    expect(count).toBeLessThan(9000)
  })
})

describe('セーブ', () => {
  it('保存して読み込むと同じ内容になる', () => {
    const save = newGame(5)
    const restored = unpackSave(packSave(save))
    expect(restored).toEqual(save)
  })

  it('壊れたデータは読み込まない（1つ前の世代から復旧するため）', () => {
    const packed = packSave(newGame(5))
    packed.json = packed.json.slice(0, -10)
    expect(unpackSave(packed)).toBeNull()
  })

  it('書き出したファイルを読み込める', async () => {
    const save = newGame(9)
    const blob = await exportToBlob(save)
    console.log('compressed', blob.size)
    expect(blob.size).toBeLessThan(JSON.stringify(save).length)
    const loaded = await importFromBlob(blob)
    expect(loaded).toEqual(save)
  })

  it('乱数の状態も保存され、読み込み後の結果が同じになる', () => {
    const save = newGame(21)
    const copy = unpackSave(packSave(save))!
    advanceWeek(save)
    advanceWeek(copy)
    expect(copy.rngState).toEqual(save.rngState)
    expect(JSON.stringify(copy.players)).toBe(JSON.stringify(save.players))
  })
})
