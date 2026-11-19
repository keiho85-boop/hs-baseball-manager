// ストーリーを始めるときの世界の準備
//
// 第1章「ナギ現役編」はサクセス（1人の選手を3年間育てる）。構想書18節
// ・廃部寸前：部員は3年の主将1人、日向大地（1年生の捕手）、フォーカス選手（大地の幼馴染）の3人から始まる
// ・残りは勧誘で集める（9人そろうと練習試合と大会に出られる）
// ・県内で一番強い学校を、ライバル校「龍ヶ峰学園」にする

import { GUIDE_ORDER } from './guides'
import { Rng, clamp } from '../rng'
import { defaultPracticeMenu, generatePlayer, playerRating } from '../player'
import { computeOverall, generateGrade, newId, schoolStrength } from '../world'
import { newSuccessState } from '../success/state'
import type { Player, Position, SaveData } from '../types'
import type { StoryState } from './types'
import { grantJoinSkill } from '../success/charSkills'
import { grantSkill, randomGoodPool } from '../skills'

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
export function setupStoryWorld(save: SaveData, opts: { focusName?: { surname: string; givenName: string }; position?: Position; tutorial?: boolean } = {}): void {
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
  const f = makeFocus(save, rng, opts.position ?? 'SS')
  // 育成選手が捕手なら、大地は投手にする（バッテリーを組む）
  if (f.mainPosition === 'C') makeDaichiPitcher(d, rng)
  // 大地は、守備位置に合う「その人の能力」を最初から持っている
  grantJoinSkill('daichi', d)
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

  // 操作の説明なし：説明はすべて済んだ扱いにする。最初の勧誘だけは、週を使わずに必ず行う
  if (opts.tutorial === false) {
    for (const id of GUIDE_ORDER) st.flags[`guide:${id}`] = 'done'
    st.flags.firstRecruit = 'todo'
  }
  save.story = st
  save.managerName = '朝比奈 ナギ'
  save.log = [{ year: 1, week: 1, text: `${own.name}の野球部に、マネージャーとして入部した。` }]
  save.rngState = rng.getState()
}

/** 大地を投手にする（育成選手が捕手のとき） */
function makeDaichiPitcher(d: Player, rng: Rng): void {
  d.mainPosition = 'P'
  d.fielding.aptitude.P = 3
  d.fielding.aptitude.C = 1
  d.pitching.velocity = Math.max(d.pitching.velocity, 128 + rng.int(0, 6))
  d.pitching.control = clamp(Math.max(d.pitching.control, 45), 1, 99)
  d.pitching.stamina = clamp(Math.max(d.pitching.stamina, 55), 1, 99)
  if (d.pitching.pitches.length === 0) d.pitching.pitches = [{ type: 'slider', level: 2 }]
}

/** 育成選手が入部時に「伸び盛り」か「大器晩成」を持っている確率 */
export const FOCUS_GROWTH_SKILL_RATE = 0.1
/** 育成選手が入部時に、ほかの良い能力を持っている確率 */
export const FOCUS_OTHER_SKILL_RATE = 0.05

/** 育成選手の入部時の強さ（11月16日：前半に勝負になるよう、入部時を高めにして伸びをなだらかに） */
export const FOCUS_START_STRENGTH = 52
/** 入部時の能力の上乗せ（投手だけ。主な能力に足す。球速は半分のkm/h）。野手は上乗せしない */
export let FOCUS_START_BOOST = 18
export function setFocusStart(v: number): void {
  FOCUS_START_BOOST = v
}
const START_KEYS_P = ['pitching.control', 'pitching.stamina', 'pitching.kire', 'pitching.quick']

/** フォーカス選手を作る。才能の当たり外れは小さめ（ごくまれに少し伸びやすい） */
function makeFocus(save: SaveData, rng: Rng, position: Position, keep?: Player): Player {
  const own = save.schools[save.playerSchoolId]!
  const f = generatePlayer(rng, {
    id: keep?.id ?? newId(save, 'p'),
    schoolId: own.id,
    grade: 1,
    year: save.calendar.year,
    strength: FOCUS_START_STRENGTH,
    kind: own.kind,
    position,
    managerExperience: save.managerExperience,
  })
  if (keep) {
    f.surname = keep.surname
    f.givenName = keep.givenName
    f.face = keep.face
  }
  // 才能：当たり外れの幅は小さく（ふつうは66前後、まれに少し伸びやすい）。成長の型はふつうに固定（早熟・晩成で差がつきすぎないように）
  f.hidden.potential = rng.chance(0.06) ? rng.int(72, 76) : 66 + rng.int(-2, 2)
  f.hidden.growthType = 'normal'
  if (FOCUS_START_BOOST > 0 && position === 'P') {
    for (const key of START_KEYS_P) {
      const [g, k] = key.split('.') as [string, string]
      const obj = (f as unknown as Record<string, Record<string, number>>)[g]!
      obj[k] = clamp(obj[k]! + FOCUS_START_BOOST, 1, 99)
    }
    if (position === 'P') f.pitching.velocity = clamp(f.pitching.velocity + Math.round(FOCUS_START_BOOST / 2), 95, 163)
  }
  f.condition.motivation = clamp(Math.max(f.condition.motivation, 65), 0, 100)
  // 入部時の特殊能力：10%で「伸び盛り」か「大器晩成」、5%でほかの良い能力（弱点は持たない）
  f.skills = []
  if (rng.chance(FOCUS_GROWTH_SKILL_RATE)) f.skills.push(rng.chance(0.5) ? 'nobizakari' : 'taiki')
  if (rng.chance(FOCUS_OTHER_SKILL_RATE)) {
    const pool = randomGoodPool(f)
    if (pool.length) grantSkill(f, rng.weighted(pool.map((x) => ({ value: x.id, weight: x.weight }))))
  }
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
