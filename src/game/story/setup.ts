// ストーリーを始めるときの世界の準備
//
// 第1章「ナギ現役編」はサクセス（1人の選手を3年間育てる）。構想書18節
// ・廃部寸前：部員は3年の主将1人、日向大地（1年生の捕手）、フォーカス選手（大地の幼馴染）の3人から始まる
// ・残りは勧誘で集める（9人そろうと練習試合と大会に出られる）
// ・県内で一番強い学校を、ライバル校「龍ヶ峰学園」にする

import { Rng, clamp } from '../rng'
import { defaultPracticeMenu, generatePlayer, playerRating } from '../player'
import { computeOverall, generateGrade, newId, schoolStrength } from '../world'
import { newSuccessState } from '../success/state'
import type { Player, Position, SaveData } from '../types'
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

/** 新しいゲームをストーリーありで始めるときに呼ぶ（第1章はサクセス：1人の選手を3年間育てる） */
export function setupStoryWorld(save: SaveData, opts: { focusName?: { surname: string; givenName: string } } = {}): void {
  const rng = new Rng(save.rngState)
  const st = newStoryState()
  st.success = newSuccessState()
  const own = save.schools[save.playerSchoolId]!

  // 1. 廃部寸前：部員は3年の主将1人だけ（前の監督の不祥事で、ほかは辞めた）
  const members = own.playerIds.map((id) => save.players[id]).filter((p): p is Player => !!p)
  const captain = members.filter((p) => p.grade === 3).sort((a, b) => playerRating(b) - playerRating(a))[0] ?? members[0]!
  for (const p of members) if (p.id !== captain.id) delete save.players[p.id]
  own.playerIds = [captain.id]
  captain.grade = 3
  own.reputation = 10

  // 2. 日向大地（1年生の捕手。肩が強い）
  const d = generatePlayer(rng, {
    id: newId(save, 'p'),
    schoolId: own.id,
    grade: 1,
    year: save.calendar.year,
    strength: 50,
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
  d.storyCast = 'daichi'
  save.players[d.id] = d
  own.playerIds.push(d.id)
  st.daichiId = d.id

  // 3. フォーカス選手（大地の幼馴染。守備位置は合格発表の場面で決める）
  const f = makeFocus(save, rng, 'SS')
  if (opts.focusName?.surname) f.surname = opts.focusName.surname
  if (opts.focusName?.givenName) f.givenName = opts.focusName.givenName
  st.success.focusId = f.id
  own.overall = computeOverall(own, save.players)

  // 4. ライバル校：県内で一番強い学校を龍ヶ峰学園にする
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

/** フォーカス選手を作る。才能はふつうB程度まで、ごくまれにA〜Sまで伸びる */
function makeFocus(save: SaveData, rng: Rng, position: Position, keep?: Player): Player {
  const own = save.schools[save.playerSchoolId]!
  const f = generatePlayer(rng, {
    id: keep?.id ?? newId(save, 'p'),
    schoolId: own.id,
    grade: 1,
    year: save.calendar.year,
    strength: 52,
    kind: own.kind,
    position,
    managerExperience: save.managerExperience,
  })
  if (keep) {
    f.surname = keep.surname
    f.givenName = keep.givenName
    f.face = keep.face
  }
  f.hidden.potential = rng.chance(0.06) ? rng.int(85, 93) : 72 + rng.int(-4, 4)
  f.condition.motivation = clamp(Math.max(f.condition.motivation, 65), 0, 100)
  f.storyCast = 'focus'
  save.players[f.id] = f
  if (!own.playerIds.includes(f.id)) own.playerIds.push(f.id)
  return f
}

/** 合格発表の場面：フォーカス選手の守備位置を決める（その守備位置向けに作り直す） */
export function setFocusPosition(save: SaveData, rng: Rng, position: Position): Player | null {
  const id = save.story?.success?.focusId
  const old = id ? save.players[id] : undefined
  if (!old) return null
  const f = makeFocus(save, rng, position, old)
  const own = save.schools[save.playerSchoolId]!
  own.overall = computeOverall(own, save.players)
  return f
}

/** 捕手以外の8つの守備位置に1人ずつ選ぶ。本職がいなければ、適性のある選手（いなければ一番うまい選手）を回す */
const STORY_POSITIONS: Position[] = ['P', 'SS', '2B', 'CF', '3B', 'RF', 'LF', '1B']
function pickByPosition(upper: Player[]): Player[] {
  const keep: Player[] = []
  const rest = () => upper.filter((p) => !keep.includes(p))
  for (const pos of STORY_POSITIONS) {
    let p = rest().find((x) => x.mainPosition === pos)
    if (!p && pos !== 'P') p = rest().filter((x) => x.mainPosition !== 'P').sort((a, b) => b.fielding.aptitude[pos] - a.fielding.aptitude[pos])[0]
    if (!p) p = rest()[0]
    if (!p) break
    if (p.mainPosition !== pos) {
      p.mainPosition = pos
      p.fielding.aptitude[pos] = Math.max(p.fielding.aptitude[pos], 2)
      if (pos === 'LF' || pos === 'CF' || pos === 'RF') for (const of of ['LF', 'CF', 'RF'] as const) p.fielding.aptitude[of] = Math.max(p.fielding.aptitude[of], 2)
      p.practiceMenu = defaultPracticeMenu(pos, p.batting.power, p.running.speed)
    }
    keep.push(p)
  }
  return keep
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
