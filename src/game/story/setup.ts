// ストーリーを始めるときの世界の準備
//
// ・自校の部員を8人に減らす（前の監督の不祥事で半分が辞めた）
// ・9人目として、日向大地（1年生の捕手）を入れる
// ・県内で一番強い学校を、ライバル校「龍ヶ峰学園」にする
// ・4月の終わりに、仮入部の1年生が加わる（場面の効果で呼ぶ）

import { Rng, clamp } from '../rng'
import { generatePlayer, playerRating } from '../player'
import { computeOverall, generateGrade, newId, schoolStrength } from '../world'
import type { Player, SaveData } from '../types'
import type { StoryState } from './types'

export const RIVAL_NAME = '龍ヶ峰学園'

export function newStoryState(): StoryState {
  return {
    enabled: true,
    chapter: 1,
    seen: [],
    flags: {},
    achievements: [],
    costumes: [],
    rivalId: null,
    daichiId: null,
    captainId: null,
  }
}

/** 新しいゲームをストーリーありで始めるときに呼ぶ */
export function setupStoryWorld(save: SaveData): void {
  const rng = new Rng(save.rngState)
  const st = newStoryState()
  const own = save.schools[save.playerSchoolId]!

  // 1. 自校の部員を8人にする（1年生は全員外し、2・3年生から投手を含めて8人残す）
  const members = own.playerIds.map((id) => save.players[id]).filter((p): p is Player => !!p)
  const upper = members.filter((p) => p.grade >= 2).sort((a, b) => playerRating(b) - playerRating(a))
  const keep: Player[] = []
  const pitcher = upper.find((p) => p.mainPosition === 'P')
  if (pitcher) keep.push(pitcher)
  for (const p of upper) {
    if (keep.length >= 8) break
    if (!keep.includes(p)) keep.push(p)
  }
  const keepIds = new Set(keep.map((p) => p.id))
  for (const p of members) if (!keepIds.has(p.id)) delete save.players[p.id]
  own.playerIds = own.playerIds.filter((id) => keepIds.has(id))

  // 2. 日向大地（1年生の捕手。肩が強い）
  const d = generatePlayer(rng, {
    id: newId(save, 'p'),
    schoolId: own.id,
    grade: 1,
    year: save.calendar.year,
    strength: schoolStrength(own),
    kind: own.kind,
    position: 'C',
    managerExperience: save.managerExperience,
  })
  d.surname = '日向'
  d.givenName = '大地'
  d.throws = 'R'
  d.fielding.arm = clamp(Math.max(d.fielding.arm, 62) + rng.int(0, 6), 1, 99)
  d.fielding.aptitude.C = 3
  d.batting.power = clamp(Math.max(d.batting.power, 45), 1, 99)
  d.condition.motivation = clamp(Math.max(d.condition.motivation, 60), 0, 100)
  d.hidden.potential = Math.max(d.hidden.potential, 70)
  save.players[d.id] = d
  own.playerIds.push(d.id)
  st.daichiId = d.id
  own.overall = computeOverall(own, save.players)

  // 3. ライバル校：県内で一番強い学校を龍ヶ峰学園にする
  const rival = Object.values(save.schools)
    .filter((s) => s.prefCode === save.prefCode && s.id !== own.id)
    .sort((a, b) => b.overall - a.overall)[0]
  if (rival) {
    rival.name = RIVAL_NAME
    rival.kind = 'private'
    st.rivalId = rival.id
  }

  save.story = st
  save.managerName = '朝比奈 ナギ'
  save.log = [{ year: 1, week: 1, text: `${own.name}の野球部に、マネージャーとして入部した。` }]
  save.rngState = rng.getState()
}

/** 4月の終わり：仮入部の1年生が加わる。加わった人数を返す */
export function addTrialMembers(save: SaveData, rng: Rng): number {
  const own = save.schools[save.playerSchoolId]!
  const count = rng.int(4, 6)
  const freshmen = generateGrade(rng, save, own, 1, count, schoolStrength(own))
  for (const p of freshmen) {
    save.players[p.id] = p
    own.playerIds.push(p.id)
  }
  own.overall = computeOverall(own, save.players)
  return freshmen.length
}
