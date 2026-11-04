// 学校・世界の生成と、学校の総合力の計算

import { Rng, clamp } from './rng'
import {
  DETAILED_SCHOOLS_OTHER_PREF,
  PREFECTURES,
  SAVE_VERSION,
  SCHOOLS_PER_PREF,
} from './constants'
import { PRIVATE_SUFFIXES, PUBLIC_SUFFIXES, SCHOOL_NAME_HEADS } from './names'
import { fielderRating, generatePlayer, pitcherRating } from './player'
import type { Facilities, Player, Position, SaveData, School, SchoolKind, Settings } from './types'

export interface NewGameInput {
  slot: number
  managerName: string
  prefCode: number
  kind: SchoolKind
  schoolName: string
  settings: Settings
  seed: number
}

export function newId(save: SaveData, prefix: string): string {
  save.nextId += 1
  return `${prefix}${save.nextId.toString(36)}`
}

function facilitiesFor(kind: SchoolKind, strength: number): Facilities {
  const lv = (bonus: number) => clamp(Math.round(strength / 25 + bonus), 0, 5)
  const b = kind === 'private' ? 1 : 0
  return {
    batting: lv(b),
    pitching: lv(b),
    fielding: lv(b - 0.5),
    running: lv(b - 0.5),
    fitness: lv(b - 0.5),
    medical: lv(b - 1),
  }
}

/** 学校の強さ（新入部員の質の基準）。評判・設備・公立私立から決まる */
export function schoolStrength(s: School): number {
  const f = s.facilities
  const facilityAvg = (f.batting + f.pitching + f.fielding + f.running + f.fitness + f.medical) / 6
  return clamp(s.reputation * 0.7 + facilityAvg * 5 + (s.kind === 'private' ? 6 : 0), 5, 95)
}

/** 学校の総合力（上位の野手8人と投手2人から計算） */
export function computeOverall(s: School, players: Record<string, Player>): number {
  const members = s.playerIds.map((id) => players[id]).filter((p): p is Player => !!p && !p.retired)
  if (members.length === 0) return s.overall
  const fielders = members.map(fielderRating).sort((a, b) => b - a).slice(0, 8)
  const pitchers = members.map(pitcherRating).sort((a, b) => b - a).slice(0, 2)
  const fAvg = fielders.reduce((a, b) => a + b, 0) / Math.max(1, fielders.length)
  const pAvg = pitchers.reduce((a, b) => a + b, 0) / Math.max(1, pitchers.length)
  return Math.round(fAvg * 0.6 + pAvg * 0.4)
}

function uniqueSchoolName(rng: Rng, kind: SchoolKind, used: Set<string>): string {
  for (let i = 0; i < 200; i++) {
    const name = rng.pick(SCHOOL_NAME_HEADS) + rng.pick(kind === 'private' ? PRIVATE_SUFFIXES : PUBLIC_SUFFIXES)
    if (!used.has(name)) {
      used.add(name)
      return name
    }
  }
  const fallback = `第${used.size + 1}高校`
  used.add(fallback)
  return fallback
}

/** 1学年分の部員を作る。投手と捕手が必ずいるようにする */
export function generateGrade(
  rng: Rng,
  save: SaveData,
  school: School,
  grade: number,
  count: number,
  strength: number,
): Player[] {
  const result: Player[] = []
  const forced: Position[] = ['P', 'P', 'C']
  for (let i = 0; i < count; i++) {
    const p = generatePlayer(rng, {
      id: newId(save, 'p'),
      schoolId: school.id,
      grade,
      year: save.calendar.year,
      strength,
      kind: school.kind,
      position: i < forced.length && count >= 5 ? forced[i] : undefined,
      managerExperience: save.managerExperience,
    })
    result.push(p)
  }
  return result
}

/** 選手を個別に持つ学校に、3学年分の部員を入れる */
function populateSchool(rng: Rng, save: SaveData, school: School, strength: number, sizeBonus: number): void {
  for (const grade of [1, 2, 3]) {
    const count = clamp(Math.round(4 + strength / 14 + sizeBonus + rng.int(-1, 1)), 5, 12)
    for (const p of generateGrade(rng, save, school, grade, count, strength)) {
      save.players[p.id] = p
      school.playerIds.push(p.id)
    }
  }
  school.overall = computeOverall(school, save.players)
}

/** 新しいゲームの世界を作る */
export function createNewGame(input: NewGameInput): SaveData {
  const rng = Rng.fromSeed(input.seed)
  const now = new Date().toISOString()
  const save: SaveData = {
    version: SAVE_VERSION,
    slot: input.slot,
    createdAt: now,
    updatedAt: now,
    managerName: input.managerName,
    managerExperience: 0,
    playerSchoolId: '',
    prefCode: input.prefCode,
    calendar: { year: 1, week: 1 },
    settings: input.settings,
    rngState: [],
    schools: {},
    players: {},
    alumni: [],
    log: [],
    lastBackupPromptYear: 1,
    nextId: 0,
  }

  for (const pref of PREFECTURES) {
    const used = new Set<string>()
    const isHome = pref.code === input.prefCode
    if (isHome) used.add(input.schoolName)

    // 強さの分布：一握りの強豪、中堅、多数の弱小
    const strengths = Array.from({ length: SCHOOLS_PER_PREF }, (_, i) => {
      if (i < 2) return rng.int(72, 85)
      if (i < 6) return rng.int(58, 72)
      if (i < 16) return rng.int(42, 58)
      return rng.int(20, 42)
    })

    const prefSchools: { school: School; strength: number }[] = []
    strengths.forEach((strength, i) => {
      // 強豪ほど私立の割合が高い
      const kind: SchoolKind = rng.chance(i < 6 ? 0.7 : 0.25) ? 'private' : 'public'
      const school: School = {
        id: newId(save, 's'),
        name: uniqueSchoolName(rng, kind, used),
        prefCode: pref.code,
        kind,
        detailed: false,
        overall: clamp(Math.round(strength * 0.75 + rng.int(-4, 4)), 10, 90),
        reputation: clamp(Math.round(strength + rng.int(-5, 5)), 5, 95),
        funds: kind === 'private' ? 150 : 60,
        facilities: facilitiesFor(kind, strength),
        playerIds: [],
        history: [],
      }
      prefSchools.push({ school, strength })
    })

    if (isHome) {
      // 一番弱い枠を自校に置き換える
      const own = prefSchools[prefSchools.length - 1]!
      own.school.name = input.schoolName
      own.school.kind = input.kind
      own.school.reputation = input.kind === 'private' ? 35 : 25
      own.school.funds = input.kind === 'private' ? 120 : 50
      own.school.facilities = facilitiesFor(input.kind, 25)
      own.strength = schoolStrength(own.school)
      save.playerSchoolId = own.school.id
    }

    prefSchools.forEach(({ school, strength }, i) => {
      save.schools[school.id] = school
      const detailed = isHome || i < DETAILED_SCHOOLS_OTHER_PREF
      if (detailed) {
        school.detailed = true
        const isOwn = school.id === save.playerSchoolId
        populateSchool(rng, save, school, strength, isOwn || !isHome ? 0 : strength >= 70 ? 1 : 0)
      }
    })
  }

  save.log.push({ year: 1, week: 1, text: `${input.schoolName}の監督に就任した。` })
  save.rngState = rng.getState()
  return save
}
