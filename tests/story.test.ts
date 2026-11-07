// ストーリー（第1章）のテスト：3年間を進めて、場面が順に流れ、章が終わるか確かめる
import { describe, expect, it } from 'vitest'
import { createNewGame } from '../src/game/world'
import { advanceWeek } from '../src/game/season'
import { ensureSugoroku } from '../src/game/sugoroku'
import { setupStoryWorld, RIVAL_NAME } from '../src/game/story/setup'
import { buildSteps, completeScene, nextScene, noteMatch, observeStory, markStory } from '../src/game/story/engine'
import type { SaveData } from '../src/game/types'
import { ownLineup, startMatch } from '../src/game/match/session'
import { simulateToEnd } from '../src/game/match/engine'
import { Rng } from '../src/game/rng'
import { BG_READY, resolveBg } from '../src/game/story/art'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { GUIDES } from '../src/game/story/guides'
import { teamName } from '../src/game/story/engine'
import { buildEvent } from '../src/game/events'
import { POSITIONS } from '../src/game/constants'

function newGame(seed: number): SaveData {
  const save = createNewGame({
    slot: 1,
    managerName: '朝比奈 ナギ',
    prefCode: 27,
    kind: 'public',
    schoolName: 'テスト高校',
    settings: { injury: 'normal', luck: 'normal', cutin: true, gameSpeed: 2, lightMode: false },
    seed,
  })
  setupStoryWorld(save)
  ensureSugoroku(save)
  return save
}

/** 流せる場面をすべて流す（選択は最初のもの）。流した場面のidを返す */
function playAll(save: SaveData): string[] {
  const played: string[] = []
  for (let guard = 0; guard < 50; guard++) {
    observeStory(save)
    const sc = nextScene(save)
    if (!sc) break
    const steps = buildSteps(save, sc)
    // 置き換え忘れがないこと
    const text = JSON.stringify(steps.map((s) => ('text' in s ? s.text : '')))
    expect(text).not.toMatch(/\{(学校名|主将|相手校|部員数|新入生|ライバル)\}/)
    completeScene(save, sc, steps, [0, 0, 0])
    played.push(sc.id)
  }
  return played
}

describe('ストーリー 第1章', () => {
  it('始めると部員は9人（大地を含む）で、ライバル校ができる', () => {
    const save = newGame(1)
    const own = save.schools[save.playerSchoolId]!
    expect(own.playerIds.length).toBe(9)
    const d = save.players[save.story!.daichiId!]!
    expect(`${d.surname}${d.givenName}`).toBe('日向大地')
    expect(d.mainPosition).toBe('C')
    expect(save.schools[save.story!.rivalId!]!.name).toBe(RIVAL_NAME)
  })

  it('部員9人でも練習試合が最後までできる（DHは自動でなしになる）', () => {
    for (const seed of [11, 12, 13]) {
      const save = newGame(seed)
      const line = ownLineup(save)
      expect(line.batters.length).toBe(9)
      expect(line.useDH).toBe(false)
      const opp = Object.values(save.schools).find((s) => s.id !== save.playerSchoolId && s.prefCode === 27)!
      const rng = new Rng([seed, 7, 99, 1234])
      const m = startMatch(save, opp.id, rng)
      expect(m.home.lineup.length).toBe(9)
      expect(m.away.lineup.length).toBe(9)
      simulateToEnd(m, { players: save.players, rng })
      expect(m.finished).toBe(true)
    }
  })

  it('台本の背景は、すべて絵があるか代わりの絵に置き換わる', () => {
    const src = readFileSync('src/game/story/chapter1.ts', 'utf8')
    const names = [...src.matchAll(/bg\('([a-z0-9_]+)'/g)].map((m) => m[1]!)
    expect(names.length).toBeGreaterThan(10)
    for (const name of names) expect(existsSync(`public/bg/${resolveBg(name)}.webp`), name).toBe(true)
    for (const name of BG_READY) expect(existsSync(`public/bg/${name}.webp`), name).toBe(true)
  })

  it('始めたときの部員で、9つの守備位置がすべて埋まる', () => {
    for (const seed of [21, 22, 23, 24]) {
      const save = newGame(seed)
      const own = save.schools[save.playerSchoolId]!
      const mains = own.playerIds.map((id) => save.players[id]!.mainPosition)
      for (const pos of POSITIONS) expect(mains, `seed ${seed}`).toContain(pos)
    }
  })

  it('日向大地はケガをしない', () => {
    const save = newGame(31)
    const d = save.players[save.story!.daichiId!]!
    expect(d.storyCast).toBe('daichi')
    for (let i = 0; i < 30; i++) {
      d.condition.stamina = 5
      advanceWeek(save)
      expect(d.condition.injury).toBeNull()
    }
  })

  it('鬼頭の球団名は、選んだ都道府県の名前になる', () => {
    expect(teamName(27)).toBe('大阪スカイライツ')
    expect(teamName(13)).toBe('東京スカイライツ')
    expect(teamName(1)).toBe('北海道スカイライツ')
    expect(teamName(40)).toBe('福岡スカイライツ')
  })

  it('ストーリーありでは、マネージャーのイベントにナギの顔が出る', () => {
    const save = newGame(41)
    const rng = new Rng([41, 2, 3, 4])
    for (let i = 0; i < 10; i++) {
      const ev = buildEvent(save, rng, 'manager')!
      expect(ev.speaker.kind).toBe('manager')
      expect('portrait' in ev.speaker && ev.speaker.portrait).toBe('nagi')
    }
    const funds = buildEvent(save, rng, 'funds')!
    expect('portrait' in funds.speaker && funds.speaker.portrait).toBe('genzo')
  })

  it('チュートリアルで光らせる場所は、すべて画面にある', () => {
    const files: string[] = []
    const walk = (dir: string): void => {
      for (const f of readdirSync(dir)) {
        const full = join(dir, f)
        if (statSync(full).isDirectory()) walk(full)
        else if (f.endsWith('.vue')) files.push(readFileSync(full, 'utf8'))
      }
    }
    walk('src')
    const all = files.join('\n')
    for (const steps of Object.values(GUIDES)) {
      for (const st of steps) {
        if (!st.target) continue
        const found = all.includes(`data-tut="${st.target}"`) || (st.target.startsWith('tab-') && all.includes('`tab-${t.name}`'))
        expect(found, st.target).toBe(true)
      }
    }
  })

  it('序章は1年目の第1週に続けて流れる', () => {
    const save = newGame(2)
    const played = playAll(save)
    expect(played).toEqual(['c1_ano_yoru', 'c1_mezame', 'c1_jukensei', 'c1_haibu', 'c1_doukyuusei', 'c1_sakusen_note'])
  })

  it('3年間を進めると、第1章が終わる', { timeout: 120000 }, () => {
    for (const seed of [3, 4, 5]) {
      const save = newGame(seed)
      const all: string[] = []
      for (let i = 0; i < 52 * 3 + 2; i++) {
        all.push(...playAll(save))
        if (i === 3) noteMatch(save, { practice: true, won: true, opponentId: 'x' })
        if (i === 20) markStory(save, 'scoutOpened')
        advanceWeek(save)
      }
      all.push(...playAll(save))
      expect(all).toContain('c1_karinyubu')
      expect(all).toContain('c1_hokenshitsu')
      expect(all).toContain('c1_renshujiai_after')
      expect(all).toContain('c1_shin_team')
      expect(all).toContain('c1_zettai_ouja')
      expect(all).toContain('c1_y1_end')
      expect(all).toContain('c1_atarashii_nakama')
      expect(all).toContain('c1_daichi_ketsui')
      expect(all).toContain('c1_y2_end')
      expect(all).toContain('c1_saigo_no_ichinen')
      expect(all).toContain('c1_shinro')
      expect(all).toContain('c1_sotsugyou')
      expect(save.story!.chapter).toBe(2)
      // 同じ場面は二度流れない
      expect(new Set(all).size).toBe(all.length)
      // 仮入部で部員が増えている
      expect(all.indexOf('c1_karinyubu')).toBeGreaterThan(-1)
    }
  })
})
