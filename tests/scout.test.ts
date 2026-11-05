import { describe, expect, it } from 'vitest'
import { Rng } from '../src/game/rng'
import { createNewGame } from '../src/game/world'
import { advanceWeek } from '../src/game/season'
import { ensureScout, knownOf, scoutRecruit, scoutVisit } from '../src/game/scout'
import type { SaveData } from '../src/game/types'

function world(seed = 11): SaveData {
  return createNewGame({
    slot: 1,
    managerName: 'テスト',
    prefCode: 13,
    kind: 'private',
    schoolName: 'テスト学園',
    settings: { injury: 'normal', luck: 'normal', cutin: true, gameSpeed: 2, lightMode: false },
    seed,
  })
}

describe('スカウト', () => {
  it('視察と勧誘で情報と関心が上がり、熱心に誘った中学生は翌年度に入部する', () => {
    const save = world()
    const rng = new Rng(save.rngState)
    const s = ensureScout(save, rng)
    expect(s.prospects.length).toBe(10)
    const target = s.prospects[0]!
    save.schools[save.playerSchoolId]!.funds = 1000
    expect(scoutVisit(save, rng, target.id)).toBeTruthy()
    expect(target.level).toBe(1)
    for (let i = 0; i < 20; i++) scoutRecruit(save, rng, target.id)
    expect(target.interest).toBeGreaterThanOrEqual(90)
    save.rngState = rng.getState()
    while (!(save.calendar.year === 2 && save.calendar.week === 1)) advanceWeek(save)
    // 関心が高ければほぼ確実に入部している
    const own = save.schools[save.playerSchoolId]!
    expect(own.playerIds).toContain(target.id)
    expect(save.players[target.id]?.grade).toBe(1)
    // 新しい年度のリストができている
    expect(save.scout?.year).toBe(2)
  })
})

describe('ドラフト', () => {
  it('実力のある3年生は11月に指名され、卒業するとプロ入りのOBになる', () => {
    const save = world(21)
    const own = save.schools[save.playerSchoolId]!
    const star = own.playerIds.map((id) => save.players[id]!).find((p) => p.grade === 3 && p.mainPosition !== 'P')!
    star.batting.contact = 92
    star.batting.power = 90
    star.running.speed = 85
    star.fielding.arm = 85
    star.fielding.range = 88
    star.fielding.catching = 85
    star.fielding.throwing = 85
    star.batting.eye = 85
    while (save.calendar.week <= 31) advanceWeek(save)
    expect(star.drafted).toBeTruthy()
    while (save.calendar.week !== 52) advanceWeek(save)
    const ob = save.alumni.find((a) => a.playerId === star.id)!
    expect(ob.career).toBe('pro')
    expect(ob.achievements[0]).toContain('ドラフト')
  })
})

describe('視察で分かること', () => {
  it('1回目はランクか特殊能力の数だけ、回を重ねると数値や特殊能力の名前まで分かる', () => {
    const save = world(31)
    const rng = new Rng(save.rngState)
    const s = ensureScout(save, rng)
    save.schools[save.playerSchoolId]!.funds = 10000
    for (const pr of s.prospects) {
      const r = scoutVisit(save, rng, pr.id)!
      const k = knownOf(pr)
      expect(k.value.length).toBe(0)
      expect(k.skills.length).toBe(0)
      expect(k.rank.length + (k.skillCount ? 1 : 0)).toBe(1)
      expect(r.label).toBeTruthy()
      let guard = 0
      while (pr.level < 2 && guard++ < 30) scoutVisit(save, rng, pr.id)
      expect(pr.level).toBe(2)
      expect(knownOf(pr).value.length).toBe(4)
      expect(knownOf(pr).skills.length).toBe(pr.player.skills.length)
      expect(guard).toBe(8 + pr.player.skills.length)
    }
  })
})
