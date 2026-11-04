import { describe, expect, it } from 'vitest'
import { Rng } from '../src/game/rng'
import { createNewGame } from '../src/game/world'
import { activeMembers, advanceWeek } from '../src/game/season'
import { BOARD_SIZE, HAND_SIZE, ensureSugoroku, playCard } from '../src/game/sugoroku'
import { applyOps, buildEvent } from '../src/game/events'
import { playerRating } from '../src/game/player'
import type { SaveData } from '../src/game/types'

function newGame(seed: number): SaveData {
  const save = createNewGame({
    slot: 1,
    managerName: 'テスト',
    prefCode: 27,
    kind: 'public',
    schoolName: 'テスト高校',
    settings: { injury: 'normal', luck: 'normal', cutin: true, gameSpeed: 2, lightMode: false },
    seed,
  })
  ensureSugoroku(save)
  return save
}

/** すごろくで1週間を過ごす（カードは状況に応じて簡単なルールで選ぶ） */
function playWeek(save: SaveData): { injuries: number } {
  const s = save.sugoroku!
  const rng = new Rng(save.rngState)
  const own = save.schools[save.playerSchoolId]!
  const members = activeMembers(save, own)
  const avgStamina = members.reduce((a, p) => a + p.condition.stamina, 0) / Math.max(1, members.length)
  // 疲れていたら休養マスを狙い、そうでなければ練習マスを狙う
  let best = 0
  let bestScore = -Infinity
  s.hand.forEach((c, i) => {
    const sq = s.board[(s.position + c.value) % BOARD_SIZE]!
    const score = avgStamina < 45 ? (sq === 'rest' ? 10 : 0) : ['batting', 'power', 'pitching', 'fitness', 'fielding', 'running', 'practical', 'special'].includes(sq) ? 5 + (c.effect === 'hot' ? 2 : 0) : 0
    if (score > bestScore) {
      best = i
      bestScore = score
    }
  })
  const { square } = playCard(save, rng, best)
  const ev = buildEvent(save, rng, square)
  save.rngState = rng.getState()
  if (ev) applyOps(save, ev.choices[0]!.ops)
  const top = [...members].sort((a, b) => b.hidden.potential - a.hidden.potential)[0]
  const before = members.filter((p) => p.condition.injury).length
  advanceWeek(save, { kind: 'square', square, card: s.pending!.card, specialPlayerId: top?.id })
  const after = activeMembers(save, own).filter((p) => p.condition.injury).length
  return { injuries: Math.max(0, after - before) }
}

describe('すごろく', () => {
  it('盤面は20マス、手札は5枚で、カードを使うと補充される', () => {
    const save = newGame(1)
    const s = save.sugoroku!
    expect(s.board).toHaveLength(BOARD_SIZE)
    expect(s.hand).toHaveLength(HAND_SIZE)
    const rng = new Rng(save.rngState)
    const value = s.hand[0]!.value
    const r = playCard(save, rng, 0)
    expect(r.path).toHaveLength(value)
    expect(s.position).toBe(value % BOARD_SIZE)
    expect(s.hand).toHaveLength(HAND_SIZE)
    expect(s.pending?.square).toBe(r.square)
  })

  it('すごろくで1年過ごすと、通常の練習と同じくらい成長する', { timeout: 60000 }, () => {
    const a = newGame(5)
    const b = newGame(5)
    const ownA = a.schools[a.playerSchoolId]!
    const ownB = b.schools[b.playerSchoolId]!
    const ids = activeMembers(a, ownA).filter((p) => p.grade <= 2).map((p) => p.id)
    const start = ids.map((id) => playerRating(a.players[id]!))
    let injuries = 0
    for (let i = 0; i < 40; i++) {
      injuries += playWeek(a).injuries
      advanceWeek(b)
    }
    const gainA = ids.reduce((s, id, i) => s + playerRating(a.players[id]!) - start[i]!, 0) / ids.length
    const gainB = ids.reduce((s, id, i) => s + playerRating(b.players[id]!) - start[i]!, 0) / ids.length
    void ownB
    expect(gainA).toBeGreaterThan(gainB * 0.75)
    expect(gainA).toBeLessThan(gainB * 1.6)
    // ケガは起きるが、多すぎない
    expect(injuries).toBeLessThan(25)
  })

  it('月が変わると盤面が作り直される', () => {
    const save = newGame(2)
    const first = [...save.sugoroku!.board]
    for (let i = 0; i < 5; i++) advanceWeek(save)
    expect(save.sugoroku!.boardMonth).toBe(5)
    expect(save.sugoroku!.board).not.toEqual(first)
  })
})

describe('イベント', () => {
  it('イベントマスでは選択肢つきのイベントが起き、効果が反映される', () => {
    const save = newGame(3)
    const rng = new Rng(save.rngState)
    for (let i = 0; i < 30; i++) {
      const ev = buildEvent(save, rng, 'event')
      expect(ev).not.toBeNull()
      expect(ev!.choices.length).toBeGreaterThan(0)
      applyOps(save, ev!.choices[ev!.choices.length - 1]!.ops)
    }
    expect(buildEvent(save, rng, 'batting')).toBeNull()
    const funds = save.schools[save.playerSchoolId]!.funds
    const ev = buildEvent(save, rng, 'funds')!
    applyOps(save, ev.choices[0]!.ops)
    expect(save.schools[save.playerSchoolId]!.funds).toBeGreaterThan(funds)
  })
})
