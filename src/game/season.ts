// 週の進行と、年度の節目（引退・卒業・入部）

import { Rng, clamp } from './rng'
import { MIN_ROSTER, SEASON_WEEKS, WEEKS_PER_YEAR } from './constants'
import { estimateTalent, fullName, generatePlayer, growWeekly, newStats, playerRating, strengthsOf } from './player'
import { computeOverall, newId, schoolStrength } from './world'
import type { AlumniRecord, Player, SaveData, School } from './types'

export interface WeekResult {
  /** この週に起きた主な出来事（画面に出す） */
  messages: string[]
  /** 新しい年度が始まった */
  newYear: boolean
  /** バックアップを勧める */
  backupPrompt: boolean
}

function log(save: SaveData, text: string, messages: string[]): void {
  save.log.push({ year: save.calendar.year, week: save.calendar.week, text })
  if (save.log.length > 300) save.log.splice(0, save.log.length - 300)
  messages.push(text)
}

export function schoolMembers(save: SaveData, school: School): Player[] {
  return school.playerIds.map((id) => save.players[id]).filter((p): p is Player => !!p)
}

/** 試合に出られる部員（引退していない、ケガをしていない人は問わない） */
export function activeMembers(save: SaveData, school: School): Player[] {
  return schoolMembers(save, school).filter((p) => !p.retired)
}

/** 練習の濃さ。設備が整っているほど伸びやすい */
function practiceIntensity(school: School): number {
  const f = school.facilities
  const avg = (f.batting + f.pitching + f.fielding + f.running + f.fitness) / 5
  return 0.85 + avg * 0.06
}

/** 1週間進める */
export function advanceWeek(save: SaveData): WeekResult {
  const rng = new Rng(save.rngState)
  const messages: string[] = []
  let newYear = false
  let backupPrompt = false
  const own = save.schools[save.playerSchoolId]!

  // 1. 練習による成長と、体調の回復
  for (const school of Object.values(save.schools)) {
    if (!school.detailed) continue
    const intensity = practiceIntensity(school)
    for (const p of activeMembers(save, school)) {
      weeklyCondition(rng, p, school.id === own.id ? messages : null)
      growWeekly(rng, p, intensity)
    }
  }

  // 2. 節目の処理
  const week = save.calendar.week
  if (week === SEASON_WEEKS.thirdYearRetire) retireThirdYears(save, messages)
  if (week === SEASON_WEEKS.graduation) graduate(save, rng, messages)

  // 3. 週を進める
  save.calendar.week += 1
  if (save.calendar.week > WEEKS_PER_YEAR) {
    save.calendar.week = 1
    save.calendar.year += 1
    newYear = true
    startNewYear(save, rng, messages)
    if (save.calendar.year > save.lastBackupPromptYear) {
      save.lastBackupPromptYear = save.calendar.year
      backupPrompt = true
    }
  }

  // 4. 部員不足の確認（助っ人）
  ensureMinimumRoster(save, rng, own, messages)

  save.rngState = rng.getState()
  save.updatedAt = new Date().toISOString()
  return { messages, newYear, backupPrompt }
}

/** 体力・調子・ケガの1週間分の変化 */
function weeklyCondition(rng: Rng, p: Player, ownMessages: string[] | null): void {
  const c = p.condition
  // 体力の回復
  c.stamina = clamp(c.stamina + 8 + Math.round(p.common.recovery / 10), 0, 100)
  // 調子の変化（安定度が高いほど動きにくい）
  const moveChance = 0.35 - p.common.stability / 400
  if (rng.chance(moveChance)) {
    const towardNormal = c.form > 3 ? -1 : c.form < 3 ? 1 : 0
    const delta = rng.chance(0.55) && towardNormal !== 0 ? towardNormal : rng.chance(0.5) ? 1 : -1
    c.form = clamp(c.form + delta, 1, 5)
  }
  // ケガの回復
  if (c.injury) {
    c.injury.weeksLeft -= 1
    if (c.injury.weeksLeft <= 0) {
      if (ownMessages) ownMessages.push(`${fullName(p)}のケガが治った。`)
      c.injury = null
    }
  }
  // 1週間の球数は毎週リセット（試合の処理は段階2で追加）
  p.weeklyPitches = 0
}

/** 夏の全国大会の後、3年生が引退する */
function retireThirdYears(save: SaveData, messages: string[]): void {
  for (const school of Object.values(save.schools)) {
    if (!school.detailed) continue
    for (const p of schoolMembers(save, school)) {
      if (p.grade === 3) p.retired = true
    }
    school.overall = computeOverall(school, save.players)
  }
  log(save, '3年生が引退し、新チームが始動した。', messages)
}

/** OBとして記録する */
function toAlumni(save: SaveData, rng: Rng, p: Player): AlumniRecord {
  const rating = playerRating(p)
  const notable = rating >= 68
  const career: AlumniRecord['career'] =
    rating >= 78 && rng.chance(0.5) ? 'pro' : rating >= 60 ? 'university' : rng.pick(['corporate', 'work', 'university'] as const)
  // 活躍したOBのうち、低い確率で10〜15年後に息子が入部する
  const sonYear = notable && rng.chance(0.3) ? save.calendar.year + rng.int(10, 15) : null
  return {
    id: newId(save, 'ob'),
    playerId: p.id,
    surname: p.surname,
    givenName: p.givenName,
    enrolledYear: p.enrolledYear,
    graduatedYear: save.calendar.year,
    mainPosition: p.mainPosition,
    bats: p.bats,
    throws: p.throws,
    careerStats: p.careerStats ? structuredClone(p.careerStats) : newStats(),
    achievements: [],
    career,
    strengths: strengthsOf(p),
    notable,
    sonYear,
    sonEnrolled: false,
  }
}

/** 卒業式。自校の3年生はOB名鑑に載り、他校の卒業生は削除する */
function graduate(save: SaveData, rng: Rng, messages: string[]): void {
  let ownCount = 0
  for (const school of Object.values(save.schools)) {
    if (!school.detailed) continue
    const leaving = schoolMembers(save, school).filter((p) => p.grade === 3)
    for (const p of leaving) {
      if (school.id === save.playerSchoolId && !p.helper) {
        save.alumni.push(toAlumni(save, rng, p))
        ownCount += 1
      }
      delete save.players[p.id]
    }
    const leavingIds = new Set(leaving.map((p) => p.id))
    school.playerIds = school.playerIds.filter((id) => !leavingIds.has(id))
  }
  log(save, `卒業式。${ownCount}人の3年生が巣立っていった。`, messages)
}

/** 新年度：進級、新入部員の入部、他校の強さの変動 */
function startNewYear(save: SaveData, rng: Rng, messages: string[]): void {
  save.managerExperience += 1
  const year = save.calendar.year
  const own = save.schools[save.playerSchoolId]!

  for (const school of Object.values(save.schools)) {
    if (!school.detailed) {
      // 総合力だけで管理する学校：少しずつ平均に戻りながら上下する
      school.overall = clamp(Math.round(school.overall + rng.normal(0, 3) + (50 - school.overall) * 0.05), 10, 90)
      continue
    }
    // 進級
    for (const p of schoolMembers(save, school)) {
      p.grade += 1
      p.seasonStats = null
      // 監督の見立ては年に1回見直す（自校のみ、経験で精度が上がる）
      if (school.id === own.id) p.estimate = estimateTalent(rng, p, save.managerExperience)
    }
    const strength = schoolStrength(school)
    const count = freshmanCount(rng, school)
    // 助っ人は、部員が足りていれば元の部に戻る
    const regulars = schoolMembers(save, school).filter((p) => !p.helper && !p.retired)
    if (regulars.length + count >= MIN_ROSTER) {
      const helpers = new Set(schoolMembers(save, school).filter((p) => p.helper).map((p) => p.id))
      for (const id of helpers) delete save.players[id]
      school.playerIds = school.playerIds.filter((id) => !helpers.has(id))
    }
    // 新入部員
    const isOwn = school.id === own.id
    const freshmen: Player[] = []
    for (let i = 0; i < count; i++) {
      const p = generatePlayer(rng, {
        id: newId(save, 'p'),
        schoolId: school.id,
        grade: 1,
        year,
        strength,
        kind: school.kind,
        position: i < 2 ? (i === 0 ? 'P' : rng.pick(['P', 'C'] as const)) : undefined,
        managerExperience: save.managerExperience,
      })
      freshmen.push(p)
    }
    // 自校：OBの息子の入部
    if (isOwn) {
      for (const ob of save.alumni) {
        if (ob.sonYear === year && !ob.sonEnrolled) {
          const son = generatePlayer(rng, {
            id: newId(save, 'p'),
            schoolId: school.id,
            grade: 1,
            year,
            strength,
            kind: school.kind,
            father: ob,
            managerExperience: save.managerExperience,
          })
          ob.sonEnrolled = true
          freshmen.push(son)
          log(save, `OB・${ob.surname} ${ob.givenName}（${ob.graduatedYear}年目卒）の息子、${fullName(son)}が入部した！`, messages)
        }
      }
    }
    for (const p of freshmen) {
      save.players[p.id] = p
      school.playerIds.push(p.id)
    }
    school.overall = computeOverall(school, save.players)
    if (isOwn) log(save, `新年度。${freshmen.length}人の新入部員が入部した。`, messages)
  }
}

function freshmanCount(rng: Rng, school: School): number {
  // 初期の部員数（4 + 強さ/14 人/学年）と同じ水準にして、部員数が年々増え続けないようにする
  const base = 4 + schoolStrength(school) / 14
  return clamp(Math.round(base + rng.int(-1, 1)), 3, 12)
}

/** 試合に出られる部員が9人未満なら、助っ人を入れる */
export function ensureMinimumRoster(save: SaveData, rng: Rng, school: School, messages: string[]): void {
  const active = activeMembers(save, school)
  const shortage = MIN_ROSTER - active.length
  if (shortage <= 0) return
  for (let i = 0; i < shortage; i++) {
    const helper = generatePlayer(rng, {
      id: newId(save, 'p'),
      schoolId: school.id,
      grade: rng.int(1, 2),
      year: save.calendar.year,
      strength: 20,
      kind: school.kind,
      helper: true,
      managerExperience: save.managerExperience,
    })
    save.players[helper.id] = helper
    school.playerIds.push(helper.id)
  }
  log(save, `部員が足りないため、他の部から${shortage}人の助っ人が加わった。`, messages)
}
