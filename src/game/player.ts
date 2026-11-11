// 選手の生成・評価・成長

import { Rng, clamp } from './rng'
import { POSITIONS, velocityScore } from './constants'
import { SKILLS, conflicts } from './skills'
import type {
  AlumniRecord,
  BatSide,
  FaceParts,
  GrowthType,
  Hand,
  PitchArsenal,
  PitchType,
  Player,
  PlayerStats,
  Position,
  PracticeMenu,
  SchoolKind,
} from './types'
import { GIVEN_NAMES, SURNAMES } from './names'

export interface GenerateOptions {
  id: string
  schoolId: string
  grade: number
  year: number
  /** 学校の強さ 0-100（新入部員の質に影響） */
  strength: number
  kind: SchoolKind
  position?: Position
  father?: AlumniRecord
  helper?: boolean
  managerExperience: number
}

const PITCH_TYPES: PitchType[] = ['slider', 'curve', 'fork', 'changeup', 'shoot', 'sinker', 'cutter', 'splitter']

/** 学年ごとの能力の平均（練習による伸びを含まない入部時点の水準＋在籍年数分） */
const GRADE_BASE = [0, 30, 38, 45]

function emptyStats(): PlayerStats {
  return {
    batting: { games: 0, atBats: 0, hits: 0, homeRuns: 0, rbi: 0, steals: 0 },
    pitching: { games: 0, outs: 0, earnedRuns: 0, strikeouts: 0, walks: 0, wins: 0, losses: 0 },
  }
}

export function newStats(): PlayerStats {
  return emptyStats()
}

function stat(rng: Rng, mean: number, sd = 7): number {
  return Math.round(clamp(rng.normal(mean, sd), 1, 99))
}

function randomFace(rng: Rng): FaceParts {
  return {
    outline: rng.int(0, 3),
    skin: rng.int(0, 3),
    hair: rng.int(0, 7),
    hairColor: rng.int(0, 2),
    brows: rng.int(0, 6),
    eyes: rng.int(0, 9),
    mouth: rng.int(0, 7),
    nose: rng.int(0, 3),
    extra: rng.weighted([
      { value: 0, weight: 62 },
      { value: 1, weight: 9 },
      { value: 2, weight: 6 },
      { value: 3, weight: 6 },
      { value: 4, weight: 6 },
      { value: 5, weight: 9 },
      { value: 6, weight: 2 },
    ]),
  }
}

function randomPosition(rng: Rng): Position {
  return rng.weighted<Position>([
    { value: 'P', weight: 25 },
    { value: 'C', weight: 10 },
    { value: '1B', weight: 8 },
    { value: '2B', weight: 10 },
    { value: '3B', weight: 9 },
    { value: 'SS', weight: 11 },
    { value: 'LF', weight: 9 },
    { value: 'CF', weight: 9 },
    { value: 'RF', weight: 9 },
  ])
}

function randomGrowthType(rng: Rng): GrowthType {
  return rng.weighted<GrowthType>([
    { value: 'early', weight: 25 },
    { value: 'normal', weight: 50 },
    { value: 'late', weight: 25 },
  ])
}

function pickPitches(rng: Rng, count: number, maxLevel: number): PitchArsenal[] {
  const types = rng.shuffle([...PITCH_TYPES]).slice(0, count)
  return types.map((type) => ({ type, level: rng.int(1, maxLevel) }))
}

/** 守備位置の近さ（適性の初期値に使う） */
const OUTFIELD: Position[] = ['LF', 'CF', 'RF']

const NEIGHBORS: Record<Position, Position[]> = {
  P: [],
  C: ['1B'],
  '1B': ['3B', 'LF'],
  '2B': ['SS', '3B'],
  '3B': ['1B', 'SS', '2B'],
  SS: ['2B', '3B', 'CF'],
  LF: ['1B'],
  CF: ['1B', 'SS'],
  RF: ['1B'],
}

export function generatePlayer(rng: Rng, opt: GenerateOptions): Player {
  const father = opt.father
  const position: Position = opt.position ?? father?.mainPosition ?? randomPosition(rng)
  const isPitcher = position === 'P'
  const shift = (opt.strength - 50) * 0.3 + (opt.helper ? -12 : 0)
  const base = (GRADE_BASE[opt.grade] ?? 30) + shift
  const strong = new Set(father?.strengths ?? [])
  const boost = (key: string) => (strong.has(key) ? 8 : 0)

  const throws: Hand = father ? father.throws : rng.chance(0.2) ? 'L' : 'R'
  const bats: BatSide = father ? father.bats : rng.weighted<BatSide>([
    { value: 'R', weight: 67 },
    { value: 'L', weight: 30 },
    { value: 'S', weight: 3 },
  ])

  // 投手は投手能力が高め・野手能力が低め、野手はその逆
  const batBase = isPitcher ? base - 8 : base
  const contact = stat(rng, batBase + boost('contact') + (position === '2B' || position === 'SS' ? 2 : 0))
  const power = stat(rng, batBase + boost('power') + (['1B', 'LF', 'RF', '3B'].includes(position) ? 4 : -2))
  const trajectory = power >= 65 ? rng.int(3, 4) : power >= 45 ? rng.int(2, 3) : rng.int(1, 2)

  const zone = Array.from({ length: 9 }, () =>
    rng.weighted<number>([
      { value: -2, weight: 3 },
      { value: -1, weight: 14 },
      { value: 0, weight: 66 },
      { value: 1, weight: 14 },
      { value: 2, weight: 3 },
    ]),
  )

  const fieldBase = isPitcher ? base - 6 : base
  const arm = stat(rng, fieldBase + boost('arm') + (position === 'C' || position === 'RF' || position === 'SS' ? 4 : 0))
  const range = stat(rng, fieldBase + boost('range') + (position === 'SS' || position === 'CF' || position === '2B' ? 4 : -2))
  const catching = stat(rng, fieldBase + (position === 'C' ? 4 : 0))
  const throwing = stat(rng, fieldBase)
  const speed = stat(rng, batBase + boost('speed') + (position === 'CF' || position === 'SS' ? 5 : position === 'C' ? -6 : 0))

  // 守備適性：本職だけが基本。まれに最初からサブポジションが1つある（外野は左・中・右をまとめて扱う）
  const aptitude = Object.fromEntries(POSITIONS.map((p) => [p, 0])) as Record<Position, number>
  const setApt = (pos: Position, v: number) => {
    for (const x of OUTFIELD.includes(pos) ? OUTFIELD : [pos]) aptitude[x] = Math.max(aptitude[x], v)
  }
  setApt(position, 3)
  if (rng.chance(isPitcher ? 0.08 : 0.2)) {
    const sub = isPitcher ? rng.pick(['1B', 'LF'] as Position[]) : rng.pick(NEIGHBORS[position])
    setApt(sub, rng.chance(0.35) ? 2 : 1)
  }
  if (!isPitcher && rng.chance(0.04)) aptitude.P = 1

  const gradeVelo = [0, 118, 123, 128][opt.grade] ?? 118
  const velocity = Math.round(
    clamp(
      isPitcher
        ? rng.normal(gradeVelo + shift * 0.4 + boost('velocity') * 0.6, 5)
        : rng.normal(gradeVelo - 8 + shift * 0.3, 5),
      95,
      158,
    ),
  )
  const pitchBase = isPitcher ? base : base - 15
  const pitching = {
    velocity,
    control: stat(rng, pitchBase + boost('control')),
    stamina: stat(rng, pitchBase + boost('stamina')),
    pitches: isPitcher
      ? pickPitches(rng, rng.int(1, opt.grade >= 2 ? 3 : 2), opt.grade >= 3 ? 4 : 3)
      : rng.chance(0.3)
        ? pickPitches(rng, 1, 1)
        : [],
    kire: stat(rng, pitchBase),
    vsLeft: stat(rng, 50, 8),
    quick: stat(rng, pitchBase),
    pinch: stat(rng, 50, 10),
  }

  const potentialMean = 60 + shift * 0.5 + (father ? 10 : 0)
  const hidden = {
    growthType: randomGrowthType(rng),
    potential: Math.round(clamp(rng.normal(potentialMean, 13), 30, 99)),
  }

  const player: Player = {
    id: opt.id,
    schoolId: opt.schoolId,
    surname: father ? father.surname : rng.pick(SURNAMES),
    givenName: rng.pick(GIVEN_NAMES),
    grade: opt.grade,
    enrolledYear: opt.year - (opt.grade - 1),
    retired: false,
    helper: opt.helper ?? false,
    bats,
    throws,
    mainPosition: position,
    face: randomFace(rng),
    batting: { contact, power, trajectory, eye: stat(rng, batBase), vsLeft: stat(rng, 50, 8), zone },
    running: { speed, steal: stat(rng, batBase - 3), baserunning: stat(rng, batBase) },
    fielding: { arm, range, catching, throwing, aptitude },
    pitching,
    common: {
      clutch: stat(rng, 50, 10),
      stability: stat(rng, 50, 10),
      durability: stat(rng, 50, 10),
      recovery: stat(rng, 50, 10),
    },
    hidden,
    estimate: '',
    skills: opt.helper ? [] : rollInitialSkills(rng, isPitcher),
    condition: { stamina: rng.int(80, 100), form: 3, motivation: 60, injury: null, armIssue: null },
    practiceMenu: defaultPracticeMenu(position, power, speed),
    weeklyPitches: 0,
    seasonStats: null,
    careerStats: null,
    fatherAlumniId: father?.id ?? null,
  }
  player.estimate = estimateTalent(rng, player, opt.managerExperience)
  return player
}

function rollInitialSkills(rng: Rng, isPitcher: boolean): string[] {
  const result: string[] = []
  for (const s of rng.shuffle([...SKILLS])) {
    if (result.length >= 3) break
    if (s.target === 'pitcher' && !isPitcher) continue
    if (s.target === 'batter' && isPitcher && s.id !== 'highlight_defense') continue
    if (result.some((r) => conflicts(r, s.id))) continue
    if (rng.chance(s.initialRate)) result.push(s.id)
  }
  return result
}

export function defaultPracticeMenu(position: Position, power: number, speed: number): PracticeMenu {
  if (position === 'P') return 'pitching'
  if (position === 'C') return 'fielding'
  if (speed >= power + 8) return 'running'
  if (power >= 55) return 'power'
  return 'batting'
}

/** 野手としての総合力 */
export function fielderRating(p: Player): number {
  const b = p.batting
  const f = p.fielding
  return Math.round(
    b.contact * 0.24 +
      b.power * 0.2 +
      b.eye * 0.08 +
      p.running.speed * 0.13 +
      f.arm * 0.1 +
      f.range * 0.12 +
      f.catching * 0.08 +
      f.throwing * 0.05,
  )
}

/** 投手としての総合力 */
export function pitcherRating(p: Player): number {
  const pt = p.pitching
  const breaking = Math.min(100, 25 + pt.pitches.reduce((s, x) => s + x.level, 0) * 7)
  return Math.round(
    velocityScore(pt.velocity) * 0.28 + pt.control * 0.24 + pt.stamina * 0.18 + pt.kire * 0.12 + breaking * 0.18,
  )
}

export function playerRating(p: Player): number {
  return p.mainPosition === 'P' ? pitcherRating(p) : fielderRating(p)
}

/** 監督の見立て。経験が浅いほど外れやすい */
export function estimateTalent(rng: Rng, p: Player, managerExperience: number): string {
  const accuracy = clamp(0.55 + managerExperience * 0.02, 0.55, 0.95)
  if (!rng.chance(accuracy)) {
    return rng.chance(0.5) ? '未知数' : rng.pick(['伸びしろ十分', '堅実に伸びそう', '早くから活躍しそう', '遅咲きの予感'])
  }
  const { potential, growthType } = p.hidden
  if (potential >= 85) return '大器の予感'
  if (potential >= 72) return growthType === 'late' ? '遅咲きの大器' : '伸びしろ十分'
  if (growthType === 'early') return '早くから活躍しそう'
  if (growthType === 'late') return '遅咲きの予感'
  if (potential >= 55) return '堅実に伸びそう'
  return '地道な努力が必要'
}

// ---------- 成長 ----------

/** 文字列からの簡易ハッシュ（能力ごとの天井のばらつきを、保存せずに決めるため） */
function hash(str: string): number {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** 能力ごとの伸びの天井 */
export function abilityCap(p: Player, key: string): number {
  const offset = (hash(p.id + key) % 21) - 10
  return clamp(p.hidden.potential + offset, 25, 99)
}

const GROWTH_BY_GRADE: Record<GrowthType, number[]> = {
  early: [0, 1.4, 1.0, 0.6],
  normal: [0, 1.0, 1.1, 1.0],
  late: [0, 0.6, 1.0, 1.5],
}

type NumKey = { group: 'batting' | 'running' | 'fielding' | 'pitching' | 'common'; key: string; menu: PracticeMenu[] }

const GROWABLE: NumKey[] = [
  { group: 'batting', key: 'contact', menu: ['batting'] },
  { group: 'batting', key: 'power', menu: ['power'] },
  { group: 'batting', key: 'eye', menu: ['batting'] },
  { group: 'running', key: 'speed', menu: ['running'] },
  { group: 'running', key: 'steal', menu: ['running'] },
  { group: 'running', key: 'baserunning', menu: ['running'] },
  { group: 'fielding', key: 'arm', menu: ['fielding'] },
  { group: 'fielding', key: 'range', menu: ['fielding'] },
  { group: 'fielding', key: 'catching', menu: ['fielding'] },
  { group: 'fielding', key: 'throwing', menu: ['fielding'] },
  { group: 'pitching', key: 'control', menu: ['pitching'] },
  { group: 'pitching', key: 'stamina', menu: ['pitching', 'fitness'] },
  { group: 'pitching', key: 'kire', menu: ['pitching'] },
  { group: 'pitching', key: 'quick', menu: ['pitching'] },
  { group: 'common', key: 'durability', menu: ['fitness'] },
  { group: 'common', key: 'recovery', menu: ['fitness'] },
]

/** 小数の伸びを確率で整数にする */
function roundByChance(rng: Rng, v: number): number {
  const base = Math.floor(v)
  return base + (rng.chance(v - base) ? 1 : 0)
}

/**
 * 1週間分の基本の成長（自主練習・通常の練習）。
 * すごろくの練習マスによる成長は、段階3でこれに上乗せする。
 * intensity: 練習の濃さ（設備や学校の方針で変わる。1.0が標準）
 */
export function growWeekly(rng: Rng, p: Player, intensity: number, focusKeys?: Readonly<Record<string, number>>): void {
  if (p.retired || p.condition.injury) return
  const typeFactor = GROWTH_BY_GRADE[p.hidden.growthType][p.grade] ?? 1
  const isPitcher = p.mainPosition === 'P'
  const skillFactor = p.skills.includes('hard_worker') ? 1.25 : p.skills.includes('lazy') ? 0.75 : 1

  for (const g of GROWABLE) {
    const obj = p[g.group] as unknown as Record<string, number>
    const value = obj[g.key]!
    const cap = abilityCap(p, g.key)
    if (value >= cap) continue
    // 投手は投手能力、野手は野手能力が伸びやすい
    const roleFactor =
      g.group === 'pitching' ? (isPitcher ? 1.0 : 0.25) : isPitcher && g.group !== 'common' ? 0.5 : 1.0
    // focusKeys（選手育成モードの練習マス：能力→重み）：そのマスの能力がはっきり伸び、ほかはわずか
    const menuFactor = focusKeys ? (focusKeys[g.key] !== undefined ? 2.6 * focusKeys[g.key]! : 0.3) : g.menu.includes(p.practiceMenu) ? 1.5 : 1.0
    const room = clamp((cap - value) / 30, 0.15, 1.3)
    const gain = 0.26 * typeFactor * intensity * roleFactor * menuFactor * room * skillFactor * (0.5 + rng.next())
    obj[g.key] = Math.min(cap, value + roundByChance(rng, gain))
  }

  // 球速（km/h）
  const veloCap = Math.round(122 + p.hidden.potential * 0.36 + (hash(p.id + 'velo') % 7) - 3)
  if (p.pitching.velocity < veloCap) {
    const roleFactor = isPitcher ? 1 : 0.3
    const menuFactor = focusKeys ? (focusKeys.velocity !== undefined ? 2.4 * focusKeys.velocity : 0.2) : p.practiceMenu === 'pitching' ? 1.4 : 1
    const gain = 0.14 * typeFactor * intensity * roleFactor * menuFactor * skillFactor * (0.5 + rng.next())
    p.pitching.velocity = Math.min(veloCap, p.pitching.velocity + roundByChance(rng, gain))
  }

  // パワーに合わせて弾道が上がることがある
  const b = p.batting
  const trajTarget = b.power >= 75 ? 4 : b.power >= 55 ? 3 : b.power >= 35 ? 2 : 1
  if (b.trajectory < trajTarget && rng.chance(0.03)) b.trajectory += 1
}

/** OBの得意だった能力（息子に受け継がれる傾向） */
export function strengthsOf(p: Player): string[] {
  const candidates: { key: string; v: number }[] =
    p.mainPosition === 'P'
      ? [
          { key: 'velocity', v: velocityScore(p.pitching.velocity) },
          { key: 'control', v: p.pitching.control },
          { key: 'stamina', v: p.pitching.stamina },
        ]
      : [
          { key: 'contact', v: p.batting.contact },
          { key: 'power', v: p.batting.power },
          { key: 'speed', v: p.running.speed },
          { key: 'arm', v: p.fielding.arm },
          { key: 'range', v: p.fielding.range },
        ]
  return candidates
    .sort((a, b) => b.v - a.v)
    .slice(0, 2)
    .map((c) => c.key)
}

export function fullName(p: { surname: string; givenName: string }): string {
  return `${p.surname} ${p.givenName}`
}
