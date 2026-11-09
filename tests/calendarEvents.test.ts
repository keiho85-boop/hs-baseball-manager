// 季節の行事・レアイベントのテスト：3年間進めて、行事が起き、効果を反映しても壊れないか確かめる
import { describe, expect, it } from 'vitest'
import { createNewGame } from '../src/game/world'
import { advanceWeek } from '../src/game/season'
import { ensureSugoroku } from '../src/game/sugoroku'
import { setupStoryWorld } from '../src/game/story/setup'
import { applyOps, players } from '../src/game/events'
import { __test } from '../src/game/calendarEvents'
import { Rng } from '../src/game/rng'
import { startMatch } from '../src/game/match/session'
import { absWeek } from '../src/game/modifiers'
import type { SaveData } from '../src/game/types'

function newGame(seed: number, story: boolean): SaveData {
  const save = createNewGame({
    slot: 1,
    managerName: 'テスト',
    prefCode: 27,
    kind: 'public',
    schoolName: 'テスト高校',
    settings: { injury: 'normal', luck: 'normal', cutin: true, gameSpeed: 2, lightMode: false },
    seed,
  })
  if (story) setupStoryWorld(save)
  ensureSugoroku(save)
  return save
}

/** 週を進め、積まれた出来事を選択肢を順に選びながら片付ける */
function run(save: SaveData, weeks: number, rng: Rng): string[] {
  const titles: string[] = []
  for (let i = 0; i < weeks; i++) {
    advanceWeek(save)
    while (save.eventQueue?.length) {
      const ev = save.eventQueue.shift()!
      titles.push(ev.title)
      const c = ev.choices[rng.int(0, ev.choices.length - 1)]!
      expect(c.result.length).toBeGreaterThan(0)
      applyOps(save, c.ops)
    }
  }
  return titles
}

describe('季節の行事', () => {
  it('3年間で、毎年の行事が起きる（ストーリーあり・なし）', { timeout: 120000 }, () => {
    for (const story of [true, false]) {
      const save = newGame(7, story)
      const titles = run(save, 52 * 3, new Rng([1, 2, 3, 4]))
      // ストーリーあり（サクセス）は、勧誘は自分で行い、初詣はおみくじになる
      const list = story ? ['体育祭', '文化祭', 'クリスマス', 'OB戦', 'バレンタイン'] : ['新入部員の勧誘', '体育祭', '文化祭', 'クリスマス', '初詣', 'OB戦', 'バレンタイン', '引退の日', '合宿：夕食はカレー']
      for (const t of list) {
        expect(titles, `${story ? 'ストーリーあり' : 'なし'}：${t}`).toContain(t)
      }
      if (story) {
        expect(titles.some((t) => t.startsWith('初詣のおみくじ'))).toBe(true)
        expect(titles).not.toContain('新入部員の勧誘')
      }
      if (!story) expect(titles).toContain('卒業式')
      // 同じ行事は年に1回まで
      const per = titles.filter((t) => t === '初詣').length
      expect(per).toBeLessThanOrEqual(3)
    }
  })

  it('ストーリーでは、大会前に源造の差し入れが届く', { timeout: 120000 }, () => {
    const save = newGame(8, true)
    save.story!.seen.push('c1_shoutenkai')
    const titles = run(save, 30, new Rng([5, 6, 7, 8]))
    expect(titles).toContain('大会前の差し入れ')
  })
})

describe('レアイベント', () => {
  it('合宿のレアイベントは、どの種類も選択肢の効果を反映できる', () => {
    const save = newGame(9, true)
    const rng = new Rng([9, 9, 9, 9])
    const seen = new Set<string>()
    for (let i = 0; i < 80; i++) {
      const ev = __test.campRareEvent(save, rng, players(save))
      if (!ev) continue
      seen.add(ev.title)
      for (const c of ev.choices) applyOps(save, c.ops)
    }
    expect(seen.size).toBeGreaterThanOrEqual(4)
  })

  it('転校生を誘うと、2年生が1人増える', () => {
    const save = newGame(10, true)
    const before = save.schools[save.playerSchoolId]!.playerIds.length
    const ev = __test.transferEvent(save, new Rng([1, 1, 1, 1]))
    applyOps(save, ev.choices[0]!.ops)
    const own = save.schools[save.playerSchoolId]!
    expect(own.playerIds.length).toBe(before + 1)
    expect(save.players[own.playerIds[own.playerIds.length - 1]!]!.grade).toBe(2)
  })

  it('台風の座学は、次の1試合だけ作戦が決まりやすくなる', () => {
    const save = newGame(11, false)
    applyOps(save, __test.typhoonEvent(save).choices[0]!.ops)
    expect(save.modifiers?.length).toBe(1)
    const opp = Object.values(save.schools).find((s) => s.id !== save.playerSchoolId && s.prefCode === 27 && s.detailed)!
    const m1 = startMatch(save, opp.id, new Rng([1, 2, 3, 4]))
    expect(m1.options.tacticBonus).toBeGreaterThan(0)
    const m2 = startMatch(save, opp.id, new Rng([1, 2, 3, 4]))
    expect(m2.options.tacticBonus ?? 0).toBe(0)
  })

  it('OB戦に負けると、1か月練習の効果が上がる', () => {
    const save = newGame(12, false)
    const rng = new Rng([12, 34, 56, 78])
    for (let i = 0; i < 20; i++) {
      const ev = __test.obGameEvent(save, rng)
      if (ev.choices[0]!.ops.some((o) => o.op === 'modifier')) {
        applyOps(save, ev.choices[0]!.ops)
        expect(save.modifiers![0]!.until).toBe(absWeek(save) + 4)
        return
      }
    }
    throw new Error('負けの結果が出なかった')
  })
})
