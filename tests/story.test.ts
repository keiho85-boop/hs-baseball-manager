// ストーリー（第1章）のテスト：3年間を進めて、場面が順に流れ、章が終わるか確かめる
import { describe, expect, it } from 'vitest'
import type { Position } from '../src/game/types'
import { ensureTournament, progress } from '../src/game/tournament'
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
import { chapterGoal, teamName } from '../src/game/story/engine'
import { buildEvent } from '../src/game/events'
import { setFocusPosition } from '../src/game/story/setup'
import { addFriendsOfDaichi, recruit, FIXED } from '../src/game/success/clubs'
import { rosterCount, successOf, focusPlayer, evalAfterMatch, mustForfeit } from '../src/game/success/state'
import { rollAttach } from '../src/game/success/board'

function newGame(seed: number, position?: Position): SaveData {
  const save = createNewGame({
    slot: 1,
    managerName: '朝比奈 ナギ',
    prefCode: 27,
    kind: 'public',
    schoolName: 'テスト高校',
    settings: { injury: 'normal', luck: 'normal', cutin: true, gameSpeed: 2, lightMode: false },
    seed,
  })
  setupStoryWorld(save, { position })
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
    expect(text).not.toMatch(/\{(学校名|主将|相手校|部員数|新入生|ライバル|フォーカス|フォーカス名|球団)\}/)
    completeScene(save, sc, steps, [0, 0, 0])
    played.push(sc.id)
  }
  return played
}


/** 部員を9人にする（勧誘の代わりに、大地の友人を足す） */
function fill9(save: SaveData): void {
  const rng = new Rng([5, 6, 7, 8])
  while (rosterCount(save) < 9) addFriendsOfDaichi(save, rng, 1)
}

describe('ストーリー 第1章（サクセス）', () => {
  it('始めると部員は3人（主将・大地・フォーカス選手）で、ライバル校ができる', () => {
    const save = newGame(1)
    const own = save.schools[save.playerSchoolId]!
    expect(own.playerIds.length).toBe(3)
    const d = save.players[save.story!.daichiId!]!
    expect(`${d.surname}${d.givenName}`).toBe('日向大地')
    expect(d.mainPosition).toBe('C')
    const f = focusPlayer(save)!
    expect(f).toBeTruthy()
    expect(f.storyCast).toBe('focus')
    expect(save.schools[save.story!.rivalId!]!.name).toBe(RIVAL_NAME)
  })

  it('フォーカス選手の守備位置を選べる（同じ選手のまま作り直す）', () => {
    const save = newGame(2)
    const before = focusPlayer(save)!
    const f = setFocusPosition(save, new Rng([1, 2, 3, 4]), 'P')!
    expect(f.id).toBe(before.id)
    expect(f.surname).toBe(before.surname)
    expect(f.mainPosition).toBe('P')
    expect(rosterCount(save)).toBe(3)
  })

  it('部員9人で練習試合が最後までできる', () => {
    for (const seed of [11, 12]) {
      const save = newGame(seed)
      fill9(save)
      const line = ownLineup(save)
      expect(line.batters.length).toBe(9)
      const opp = Object.values(save.schools).find((s) => s.id !== save.playerSchoolId && s.prefCode === 27)!
      const rng = new Rng([seed, 7, 99, 1234])
      const m = startMatch(save, opp.id, rng)
      simulateToEnd(m, { players: save.players, rng })
      expect(m.finished).toBe(true)
      // 試合の後、評価が動く
      const before = { ...successOf(save)!.eval }
      evalAfterMatch(save, m, false, m.winner === null ? null : true)
      expect(successOf(save)!.eval).not.toEqual(before)
    }
  })

  it('台本の背景は、すべて絵があるか代わりの絵に置き換わる', () => {
    const src = readFileSync('src/game/story/chapter1.ts', 'utf8')
    const names = [...src.matchAll(/bg\('([a-z0-9_]+)'/g), ...src.matchAll(/bgName: '([a-z0-9_]+)'/g)].map((m) => m[1]!)
    expect(names.length).toBeGreaterThan(10)
    for (const name of names) expect(existsSync(`public/bg/${resolveBg(name)}.webp`), name).toBe(true)
    for (const name of BG_READY) expect(existsSync(`public/bg/${name}.webp`), name).toBe(true)
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
  })

  it('ストーリーありでは、マネージャーのイベントにナギの顔が出る', () => {
    const save = newGame(41)
    const rng = new Rng([41, 2, 3, 4])
    for (let i = 0; i < 10; i++) {
      const ev = buildEvent(save, rng, 'manager')!
      expect('portrait' in ev.speaker && ev.speaker.portrait).toBe('nagi')
    }
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

  it('9人そろうまでの目安は、部員の人数', () => {
    const save = newGame(51)
    expect(chapterGoal(save)!.target).toContain('部員を9人に')
  })

  it('序章は1年目の第1週に続けて流れる', () => {
    const save = newGame(2)
    expect(playAll(save)).toEqual(['c1_ano_yoru', 'c1_mezame', 'c1_goukaku', 'c1_nyugaku'])
  })

  it('盤面にはマネージャー・部費・スカウトのマスがなく、毎週スカウトが練習マスに付く', () => {
    const save = newGame(61)
    const sg = save.sugoroku!
    expect(sg.board).not.toContain('manager')
    expect(sg.board).not.toContain('funds')
    expect(sg.board).not.toContain('scout')
    rollAttach(save, new Rng([1, 1, 1, 1]))
    expect(Object.values(sg.attach ?? {})).toContain('scout')
    const idx = Number(Object.keys(sg.attach!).find((k) => sg.attach![Number(k)] === 'scout'))
    const ev = buildEvent(save, new Rng([2, 2, 2, 2]), sg.board[idx]!, idx)!
    expect(ev.choices[0]!.ops.some((o) => o.op === 'eval' && o.key === 'scout')).toBe(true)
  })

  it('テニス部のエースは、練習試合で1勝するまで入部しない', () => {
    const save = newGame(71)
    const s = successOf(save)!
    const rng = new Rng([3, 3, 3, 3])
    for (let i = 0; i < 40; i++) {
      s.clubs = [{ club: 'tennis', members: [{ kind: 'fixed', id: 'tennis' }] }]
      recruit(save, rng, 'tennis')
    }
    expect(s.joined.tennis).toBeUndefined()
    noteMatch(save, { practice: true, won: true, opponentId: 'x' })
    for (let i = 0; i < 40 && !s.joined.tennis; i++) {
      s.clubs = [{ club: 'tennis', members: [{ kind: 'fixed', id: 'tennis' }] }]
      recruit(save, rng, 'tennis')
    }
    expect(s.joined.tennis).toBeTruthy()
    expect(save.players[s.joined.tennis!]!.surname).toBe(FIXED.tennis.surname)
  })

  it('将棋部のエースは、投手の能力が高くスタミナは1イニングぶん', () => {
    const save = newGame(72)
    const s = successOf(save)!
    const rng = new Rng([4, 4, 4, 4])
    for (let i = 0; i < 40 && !s.joined.shogi; i++) {
      s.clubs = [{ club: 'shogi', members: [{ kind: 'fixed', id: 'shogi' }] }]
      recruit(save, rng, 'shogi')
    }
    const p = save.players[s.joined.shogi!]!
    expect(p.mainPosition).toBe('P')
    expect(p.pitching.stamina).toBeLessThan(20)
    expect(p.pitching.control).toBeGreaterThan(80)
  })

  it('3年間を進めると、第1章が終わる', { timeout: 180000 }, () => {
    for (const seed of [3, 4]) {
      const save = newGame(seed)
      const all: string[] = []
      for (let i = 0; i < 52 * 3 + 2; i++) {
        all.push(...playAll(save))
        if (i === 6) fill9(save)
        if (i === 8) noteMatch(save, { practice: true, won: true, opponentId: 'x' })
        if (save.story!.success!.ended) break
        advanceWeek(save)
      }
      all.push(...playAll(save))
      for (const id of ['c1_kanyu', 'c1_hokenshitsu', 'c1_9nin', 'c1_ryugamine', 'c1_sofu', 'c1_fuyu', 'c1_y2_nakama', 'c1_hariai', 'c1_shuzai', 'c1_natsumatsuri', 'c1_mae_no_kantoku', 'c1_y2_end', 'c1_saigo_no_ichinen', 'c1_haru_scout', 'c1_soudan', 'c1_kouhai', 'c1_shinro', 'c1_draft', 'c1_sotsugyou']) {
        expect(all, `${seed} ${id}`).toContain(id)
      }
      expect(save.story!.chapter).toBe(2)
      expect(['pro', 'fail']).toContain(save.story!.success!.ended)
      expect(new Set(all).size).toBe(all.length)
    }
  })
})

describe('部員が9人未満のオーダー', () => {
  it('3人でもオーダーを作れて、エラーにならない', () => {
    const save = newGame(77)
    expect(rosterCount(save)).toBeLessThan(9)
    const line = ownLineup(save)
    expect(line.batters.length).toBeLessThan(9)
    expect(line.batters.every((b) => !!save.players[b.playerId])).toBe(true)
  })
})

describe('大地の帰宅部5人', () => {
  for (const pos of ['P', 'C', 'SS', 'CF'] as const) {
    it(`育成選手が${pos}のとき、守備位置がばらけて被らない`, () => {
      const save = newGame(7, pos)
      const ps = addFriendsOfDaichi(save, new Rng([7, 8, 9, 10])).map((p) => p.mainPosition)
      expect(new Set(ps).size).toBe(5)
      const focus = focusPlayer(save)!
      expect(focus.mainPosition).toBe(pos)
      if (pos !== 'CF') expect(ps).not.toContain(pos)
      const daichi = save.players[save.story!.daichiId!]!
      expect(ps).not.toContain(daichi.mainPosition)
      expect(daichi.mainPosition).toBe(pos === 'C' ? 'P' : 'C')
      if (pos === 'P' || pos === 'C') expect(ps).not.toContain('P')
      else expect(ps).toContain('P')
    })
  }
})

describe('1年目の春の県大会', () => {
  it('部員がそろっていても、ストーリーとして棄権になる', () => {
    const save = newGame(11)
    const rng = new Rng([1, 2, 3, 4])
    while (rosterCount(save) < 9) addFriendsOfDaichi(save, rng, 1)
    expect(mustForfeit(save, 'springPref')).toBe('story')
    expect(mustForfeit(save, 'summerPref')).toBeNull()
    save.calendar.year = 2
    expect(mustForfeit(save, 'springPref')).toBeNull()
  })
})

describe('龍ヶ峰との組み合わせ', () => {
  it('県大会では、龍ヶ峰と自校は反対の山（当たるのは決勝だけ）', () => {
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const save = newGame(seed)
      save.calendar.week = 5
      const t = ensureTournament(save, new Rng([seed, 9, 8, 7]))!
      expect(t).toBeTruthy()
      const slots = t.rounds[0]!.flatMap((g) => [g.a, g.b])
      const half = slots.length / 2
      const io = slots.indexOf(save.playerSchoolId)
      const ir = slots.indexOf(save.story!.rivalId!)
      expect(io).toBeGreaterThanOrEqual(0)
      expect(ir).toBeGreaterThanOrEqual(0)
      expect(Math.floor(io / half)).not.toBe(Math.floor(ir / half))
    }
  })
})

describe('龍ヶ峰は県大会決勝まで勝ち上がる', () => {
  it('どの組み合わせでも、決勝に龍ヶ峰がいる', () => {
    for (const seed of [11, 12, 13, 14, 15, 16]) {
      const save = newGame(seed)
      save.calendar.week = 5
      const rng = new Rng([seed, 3, 5, 7])
      const t = ensureTournament(save, rng)!
      save.calendar.week = 60
      progress(save, rng, t, true)
      const final = t.rounds[t.rounds.length - 1]![0]!
      expect([final.a, final.b]).toContain(save.story!.rivalId)
    }
  })
})

describe('試合の結果で特殊能力がつく・消える', () => {
  it('強振で三振を重ねると扇風機がつき、打てば消える', async () => {
    const { focusMatchGrowth } = await import('../src/game/success/matchGrowth')
    const save = newGame(21, 'SS')
    const f = focusPlayer(save)!
    const ev = (kind: string, order: string) => ({ inning: 1, top: true, batterId: f.id, pitcherId: 'x', kind, text: '', runs: 0, outsAfter: 1, basesAfter: [null, null, null], scoreAfter: [0, 0], order, chance: false })
    const box = (h: number, k: number) => ({ pa: 4, ab: 4, h, d: 0, t: 0, hr: 0, rbi: 0, bb: 0, k, sb: 0, r: 0 })
    let got = false
    for (let i = 0; i < 20 && !got; i++) {
      const m = { batting: { [f.id]: box(0, 4) }, pitching: {}, events: [0, 1, 2, 3].map(() => ev('strikeout', 'swing')) } as never
      focusMatchGrowth(save, m, new Rng([i + 1, 2, 3, 4]), true)
      got = f.skills.includes('fan')
    }
    expect(got).toBe(true)
    let gone = false
    for (let i = 0; i < 20 && !gone; i++) {
      const m = { batting: { [f.id]: box(3, 0) }, pitching: {}, events: [ev('single', 'auto'), ev('double', 'auto'), ev('single', 'auto'), ev('groundout', 'auto')] } as never
      const before = JSON.stringify(f.batting)
      focusMatchGrowth(save, m, new Rng([i + 7, 2, 3, 4]), true)
      gone = !f.skills.includes('fan')
      void before
    }
    expect(gone).toBe(true)
  })
})

describe('オーダーの保存', () => {
  it('控えにケガ人がいても、入れ替えたオーダーがそのまま使われる', () => {
    const save = newGame(31)
    const rng = new Rng([3, 1, 4, 1])
    while (rosterCount(save) < 11) addFriendsOfDaichi(save, rng, 1)
    const line = ownLineup(save)
    const swapped = structuredClone(line)
    ;[swapped.batters[0], swapped.batters[1]] = [swapped.batters[1]!, swapped.batters[0]!]
    const injured = swapped.bench[0]!
    save.players[injured]!.condition.injury = { name: '捻挫', weeksLeft: 2 }
    save.lineup = swapped
    const now = ownLineup(save)
    expect(now.batters[0]!.playerId).toBe(line.batters[1]!.playerId)
    expect(now.bench).not.toContain(injured)
  })
})
