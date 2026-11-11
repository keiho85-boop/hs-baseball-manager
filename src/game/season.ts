// 週の進行と、年度の節目（引退・卒業・入部）

import { Rng, clamp } from './rng'
import { MIN_ROSTER, SEASON_WEEKS, WEEKS_PER_YEAR, weekToDate } from './constants'
import { applyOwnWeek, refreshBoard } from './sugoroku'
import { estimateTalent, fullName, generatePlayer, growWeekly, newStats, playerRating, strengthsOf } from './player'
import { computeOverall, newId, schoolStrength } from './world'
import { armRestNeeded } from './match/results'
import type { AlumniRecord, Player, SaveData, School, WeekPlan } from './types'
import { DRAFT_WEEK, SCOUT_DECISION_WEEK, SCOUT_MONTHLY, addScoutPoints, decideProspects, enrollProspects, ensureScout, runDraft } from './scout'
import { currentTournament, ensureTournament, findTournament, kindAtWeek, monthlyFunds, ownAlive, progress } from './tournament'
import { hasModifier, pruneModifiers } from './modifiers'
import { queueWeeklyEvents } from './calendarEvents'
import { campPlaceName, campStartWeek, rosterCount, successFreshmen, successOf } from './success/state'
import { autoJoin, rollClubs } from './success/clubs'
import { rollAttach } from './success/board'

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

function members(save: SaveData, school: School): Player[] {
  return activeMembers(save, school)
}

/** 季節の行事（合宿・テスト・文化祭） */
function seasonalEvents(save: SaveData, rng: Rng, list: Player[], messages: string[]): void {
  const week = save.calendar.week
  const national = findTournament(save, save.calendar.year, 'summerNational')
  // サクセス：合宿は県大会と全国大会の間の2週間（1年目でも人数がそろっていれば行う。全国に出ていても行う）
  if (successOf(save)) {
    // 3年目は夏の大会の前（6月）に合宿をする（大会のあとは、もう練習がないため）
    const campWeek = campStartWeek(save)
    if (week === campWeek && save.sugoroku && rosterCount(save) >= MIN_ROSTER) {
      save.sugoroku.campWeeks = 2
      log(save, `${campPlaceName(save)}での夏合宿が始まった！（2週間、練習の効果と疲れが大きくなる）`, messages)
    }
    void list
    return
  }
  if (week === 19 && save.sugoroku && national && ownAlive(save, national)) {
    log(save, '全国大会に出場中のため、今年の夏合宿は行わない。', messages)
  } else if (week === 19 && save.sugoroku) {
    save.sugoroku.campWeeks = 2
    log(save, '夏合宿が始まった！（2週間、練習の効果と疲れが大きくなる）', messages)
  }
  // テスト期間・文化祭などの行事は、週の初めの出来事（calendarEvents）で起きる
  void list
}

/** 練習の濃さ。設備が整っているほど伸びやすい */
function practiceIntensity(school: School): number {
  const f = school.facilities
  const avg = (f.batting + f.pitching + f.fielding + f.running + f.fitness) / 5
  return 0.85 + avg * 0.06
}

/** 1週間進める。plan は自校のその週の過ごし方（すごろくのマス、練習試合など） */
export function advanceWeek(save: SaveData, plan: WeekPlan | null = null): WeekResult {
  const rng = new Rng(save.rngState)
  const messages: string[] = []
  let newYear = false
  let backupPrompt = false
  const own = save.schools[save.playerSchoolId]!

  // 1. 練習による成長と、体調の回復
  for (const school of Object.values(save.schools)) {
    if (!school.detailed) continue
    const intensity = practiceIntensity(school)
    const members = activeMembers(save, school)
    if (school.id === own.id) {
      // 自校：すごろくのマスとカードで練習の効果・疲れ・ケガが決まる
      applyOwnWeek(save, rng, plan, members, intensity, messages)
      // ストーリーあり：養護教諭の蓮見先生がいるので、ケガが少し早く治る（合宿に同伴しているときは、さらに早い）
      const nurse = save.story?.enabled ? ((save.sugoroku?.campWeeks ?? 0) > 0 ? 5 : 1) : 0
      for (const p of members) weeklyCondition(rng, p, messages, school.facilities.medical + nurse)
    } else {
      for (const p of members) {
        weeklyCondition(rng, p, null, school.facilities.medical)
        growWeekly(rng, p, intensity)
      }
    }
  }
  seasonalEvents(save, rng, members(save, own), messages)
  // お守りの効果など：夏の大会の間、自校の選手の調子が上がる
  if (hasModifier(save, 'form') && (kindAtWeek(save.calendar.week) === 'summerPref' || kindAtWeek(save.calendar.week) === 'summerNational')) {
    for (const p of members(save, own)) p.condition.form = clamp(p.condition.form + 1, 1, 5)
  }
  if (save.sugoroku) {
    if (save.sugoroku.campWeeks > 0) save.sugoroku.campWeeks -= 1
    save.sugoroku.pending = null
  }

  // 2. 大会：この週に予定されていた回戦を最後まで進める（他校同士の試合は総合力で決める）
  const running = currentTournament(save)
  if (running) messages.push(...progress(save, rng, running, true))

  // 3. 節目の処理
  const week = save.calendar.week
  const monthBefore = weekToDate(week).month
  if (week === SCOUT_DECISION_WEEK) messages.push(...decideProspects(save, rng))
  if (week === DRAFT_WEEK) messages.push(...runDraft(save, rng))
  if (week === SEASON_WEEKS.thirdYearRetire) retireThirdYears(save, messages)
  if (week === SEASON_WEEKS.graduation) graduate(save, rng, messages)

  // 4. 週を進める
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

  // 5. 部員不足の確認（助っ人）。サクセスでは助っ人は来ない（勧誘で集める）。評判が高いと自分から入部してくる
  const success = successOf(save)
  if (success) {
    if (plan?.kind !== 'recruit') success.recruitStreak = 0
    autoJoin(save, rng, messages)
  } else ensureMinimumRoster(save, rng, own, messages)
  // 6. 月が変わったら部費の収入
  if (weekToDate(save.calendar.week).month !== monthBefore) {
    const income = monthlyFunds(save)
    // スカウトの季節（5〜12月の月初めに補充。4月はリストを作るときに補充する）
    const m = weekToDate(save.calendar.week).month
    if (m >= 5 && m <= 12) addScoutPoints(save, SCOUT_MONTHLY)
    save.log.push({ year: save.calendar.year, week: save.calendar.week, text: `今月の部費として${income}万円が入った。` })
  }
  // 7. スカウトのリスト（年度ごとに作る）
  ensureScout(save, rng)
  // 8. 大会の開幕
  const opened = ensureTournament(save, rng)
  if (opened && opened.current === 0 && opened.weeks[0] === save.calendar.week && !messages.some((m) => m.includes(opened.name))) {
    messages.push(`${opened.name}が開幕！`)
  }
  // 9. 月が変わったら、すごろくの盤面を作り直す
  if (save.sugoroku && refreshBoard(save, rng)) messages.push(`${weekToDate(save.calendar.week).month}月になり、練習の盤面が新しくなった。`)
  // 10. 期限の切れた補正を片付け、今週の行事やレアイベントを積む（すごろくで遊ぶときだけ）
  pruneModifiers(save)
  if (save.sugoroku) queueWeeklyEvents(save, rng)
  // 11. サクセス：今週、各部活にいる人と、練習マスに付く人物を決める
  if (success) {
    rollClubs(save, rng)
    rollAttach(save, rng)
  }

  save.rngState = rng.getState()
  save.updatedAt = new Date().toISOString()
  return { messages, newYear, backupPrompt }
}

/** 体力・調子・ケガの1週間分の変化 */
function weeklyCondition(rng: Rng, p: Player, ownMessages: string[] | null, medicalLevel = 0): void {
  const c = p.condition
  // 体力の回復
  // 整数にそろえる（以前の版で小数になっていたデータもここで直る）
  c.stamina = clamp(Math.round(c.stamina + 8 + p.common.recovery / 10), 0, 100)
  c.motivation = clamp(Math.round(c.motivation), 0, 100)
  // 調子の変化（安定度が高いほど動きにくい）
  const moveChance = 0.35 - p.common.stability / 400
  if (rng.chance(moveChance)) {
    const towardNormal = c.form > 3 ? -1 : c.form < 3 ? 1 : 0
    const delta = rng.chance(0.55) && towardNormal !== 0 ? towardNormal : rng.chance(0.5) ? 1 : -1
    c.form = clamp(c.form + delta, 1, 5)
  }
  // ケガの回復（医務室が整っていると早く治ることがある）
  if (c.injury) {
    c.injury.weeksLeft -= 1 + (rng.chance(medicalLevel * 0.06) ? 1 : 0)
    if (c.injury.weeksLeft <= 0) {
      if (ownMessages) ownMessages.push(`${fullName(p)}のケガが治った。`)
      c.injury = null
    }
  }
  // 肩・肘の不安：投げずに休んだ週を数え、一定に達したら治る
  if (c.armIssue) {
    if (p.weeklyPitches === 0) c.armIssue.restWeeks += 1
    if (c.armIssue.restWeeks >= armRestNeeded(c.armIssue.severity)) {
      if (ownMessages) ownMessages.push(`${fullName(p)}の${c.armIssue.part === 'shoulder' ? '肩' : '肘'}の不安がなくなった。`)
      c.armIssue = null
    }
  }
  // 1週間の球数は毎週リセット
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
  const notable = rating >= 68 || !!p.drafted
  const career: AlumniRecord['career'] = p.drafted
    ? 'pro'
    : rating >= 60
      ? 'university'
      : rng.pick(['corporate', 'work', 'university'] as const)
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
    achievements: p.drafted ? [`ドラフト${p.drafted.round}位で${p.drafted.team}に入団`] : [],
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
    // 評判は少しずつ平均に戻る（大会で結果を出し続けないと保てない）
    school.reputation = clamp(Math.round((school.reputation + (40 - school.reputation) * 0.15) * 10) / 10, 0, 100)
    if (!school.detailed) {
      // 総合力だけで管理する学校：評判に引き寄せられながら上下する（強豪の衰退や新しい強豪の台頭）
      const target = school.reputation * 0.75
      school.overall = clamp(Math.round(school.overall + (target - school.overall) * 0.12 + rng.normal(0, 3)), 10, 90)
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
    // 自校：スカウトで入学を決めた中学生が入部する（そのぶん一般の入部は少なめ）
    const recruits = school.id === own.id ? enrollProspects(save, school, year) : []
    // サクセスの自校：新入部員の数は評判で決まる
    const count = school.id === own.id && successOf(save) ? successFreshmen(rng, school.reputation) : Math.max(2, freshmanCount(rng, school) - recruits.length)
    // 助っ人は、部員が足りていれば元の部に戻る
    const regulars = schoolMembers(save, school).filter((p) => !p.helper && !p.retired)
    if (regulars.length + count >= MIN_ROSTER || (school.id === own.id && successOf(save))) {
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
    if (isOwn) {
      const total = freshmen.length + recruits.length
      log(save, `新年度。${total}人の新入部員が入部した。${recruits.length ? `（スカウトした${recruits.map((p) => p.surname).join('・')}も入部！）` : ''}`, messages)
    }
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
