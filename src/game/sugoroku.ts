// すごろく形式の練習：盤面・手札・マスの効果

import { Rng, clamp } from './rng'
import { PRACTICE_BONUS, activeModifiers } from './modifiers'
import { campMultiplier, focusGrowthMult, successOf } from './success/state'
import { rollAttach, successBoard } from './success/board'
import { rollClubs } from './success/clubs'
import { POSITION_NAME, weekToDate } from './constants'
import { fullName, growWeekly } from './player'
import { SKILLS, conflicts } from './skills'
import type { Card, CardEffect, Facilities, Player, PracticeMenu, SaveData, SquareType, SugorokuState, WeekPlan } from './types'

export const BOARD_SIZE = 20
export const HAND_SIZE = 5

export interface SquareInfo {
  label: string
  short: string
  color: string
  description: string
  /** 練習マス：対応する練習メニュー */
  menus?: PracticeMenu[]
}

export const SQUARES: Record<SquareType, SquareInfo> = {
  batting: { label: '打撃', short: '打', color: '#ff7a2e', description: 'ミート・パワー・選球眼が伸びる', menus: ['batting'] },
  power: { label: '長打', short: '長', color: '#e5484d', description: 'パワー・弾道が伸びる', menus: ['power'] },
  pitching: { label: '投球', short: '投', color: '#2f6fe0', description: '球速・制球・キレが伸びる', menus: ['pitching'] },
  fitness: { label: '体力', short: '体', color: '#8a5cd6', description: 'スタミナ・回復・ケガしにくさが伸びる', menus: ['fitness'] },
  fielding: { label: '守備', short: '守', color: '#14a7a0', description: '守備・捕球・肩が伸びる', menus: ['fielding'] },
  running: { label: '走塁', short: '走', color: '#36a843', description: '走力・盗塁・走塁が伸びる', menus: ['running'] },
  practical: { label: '実戦', short: '実', color: '#d99400', description: '試合形式。勝負強さが伸び、特殊能力を覚えやすい' },
  rest: { label: '休養', short: '休', color: '#3aa8f0', description: '体力が大きく回復し、調子が整う' },
  special: { label: '特訓', short: '特', color: '#c2185b', description: '選手を1人選んで、大きく伸ばす（選手育成モードでは育成選手）' },
  event: { label: 'イベント', short: '!', color: '#ff5fa2', description: '何かが起きる' },
  manager: { label: 'マネージャー', short: 'マ', color: '#ff8fb1', description: '調子が上がる' },
  funds: { label: '部費', short: '¥', color: '#e9a400', description: '部費が増える' },
  scout: { label: 'スカウト', short: 'ス', color: '#5f6f86', description: '中学生を視察できる' },
  rain: { label: '雨', short: '雨', color: '#7e8ca0', description: '練習の効果は半分。ケガもしにくい' },
  school: { label: '校内行事', short: '校', color: '#9aa7b6', description: '練習は休み。学校の行事がある' },
}

/**
 * 選手育成モード：練習マスごとに伸びる能力と、その重み（表示どおりに伸びる）。
 * 長打マスはパワーに集中（打撃マスよりパワーが大きく伸び、弾道も上がりやすい）
 */
export const SQUARE_STATS: Partial<Record<SquareType, Readonly<Record<string, number>>>> = {
  batting: { contact: 1, eye: 0.8, power: 0.35 },
  power: { power: 1.4 },
  pitching: { velocity: 1, control: 1, kire: 1 },
  running: { speed: 1, steal: 1, baserunning: 0.8 },
  fielding: { range: 1, catching: 1, arm: 1 },
  fitness: { stamina: 1, recovery: 1, durability: 0.8 },
}

const PRACTICE_TYPES: SquareType[] = ['batting', 'power', 'pitching', 'fitness', 'fielding', 'running']

export const CARD_EFFECT_NAME: Record<CardEffect, string> = {
  none: '',
  hot: '熱血',
  light: '軽め',
  all: '全体',
}

export const CARD_EFFECT_DESC: Record<CardEffect, string> = {
  none: '',
  hot: '練習の効果1.5倍。そのぶん疲れる',
  light: '練習の効果は控えめ。疲れは半分',
  all: '練習メニューに関係なく、全員が最大の効果を受ける',
}

/** 手札の数字は偏らないように：手札にまだない数字が出やすい */
function drawCard(rng: Rng, hand: Card[] = [], playerMode = false): Card {
  // 選手育成モードには「全体」のカードはない（練習メニューを選ばないため）
  const effect = rng.weighted<CardEffect>([
    { value: 'none', weight: 70 },
    { value: 'hot', weight: 12 },
    { value: 'light', weight: 10 },
    { value: 'all', weight: playerMode ? 0 : 8 },
  ])
  const have = hand.map((c) => c.value)
  const value = rng.weighted([1, 2, 3, 4, 5, 6].map((v) => ({ value: v, weight: have.includes(v) ? (have.filter((x) => x === v).length >= 2 ? 0 : 0.6) : 6 })))
  return { value, effect }
}

function dealHand(rng: Rng, playerMode = false): Card[] {
  const hand: Card[] = []
  while (hand.length < HAND_SIZE) hand.push(drawCard(rng, hand, playerMode))
  return hand
}

/** その月の盤面を作る。季節で一部のマスが入れ替わる */
export function buildBoard(rng: Rng, month: number): SquareType[] {
  const squares: SquareType[] = [...PRACTICE_TYPES, ...PRACTICE_TYPES, 'practical', 'rest', 'rest', 'special', 'event', 'event', 'manager', 'funds']
  // 梅雨は雨のマスが増える
  if (month === 6) {
    squares[rng.int(0, 11)] = 'rain'
    squares[rng.int(0, 11)] = 'rain'
  }
  // 定期テストや行事のある月
  if (month === 7 || month === 12 || month === 3 || month === 10) squares[rng.int(0, 11)] = 'school'
  // スカウトの季節（4月〜12月）：練習マスの1つがスカウトマスになる
  if (month >= 4) squares[rng.int(6, 11)] = 'scout'
  // 冬は体づくりが中心
  if (month === 12 || month === 1 || month === 2) squares[rng.int(0, 5)] = 'fitness'
  return rng.shuffle(squares)
}

/** その遊び方の盤面（サクセスでは、マネージャー・部費・スカウトは練習マスに付く人物になる） */
function boardFor(save: SaveData, rng: Rng, month: number): SquareType[] {
  const b = buildBoard(rng, month)
  return successOf(save) ? successBoard(b) : b
}

export function ensureSugoroku(save: SaveData): SugorokuState {
  const month = weekToDate(save.calendar.week).month
  if (!save.sugoroku) {
    const rng = new Rng(save.rngState)
    save.sugoroku = {
      board: boardFor(save, rng, month),
      position: 0,
      hand: dealHand(rng, !!successOf(save)),
      boardMonth: month,
      pending: null,
      campWeeks: 0,
    }
    save.rngState = rng.getState()
  }
  // サクセス：始めた週（や以前の版のデータ）は、部活にいる人と練習マスの人物がまだ決まっていない
  const sc = successOf(save)
  // 以前の版で配られた「全体」のカードは、ふつうの練習カードにする
  if (sc) for (const c of save.sugoroku.hand) if (c.effect === 'all') c.effect = 'none'
  if (sc && !sc.ended && (!save.sugoroku.attach || sc.clubs.length === 0)) {
    const rng = new Rng(save.rngState)
    if (sc.clubs.length === 0) rollClubs(save, rng)
    if (!save.sugoroku.attach) rollAttach(save, rng)
    save.rngState = rng.getState()
  }
  return save.sugoroku
}

/** 月が変わっていたら盤面を作り直す（週を進めた後に呼ぶ） */
export function refreshBoard(save: SaveData, rng: Rng): boolean {
  const s = ensureSugoroku(save)
  const month = weekToDate(save.calendar.week).month
  if (s.boardMonth === month) return false
  s.board = boardFor(save, rng, month)
  s.boardMonth = month
  s.position = 0
  return true
}

/** カードを使ってコマを進める。止まったマスを返す */
export function playCard(save: SaveData, rng: Rng, cardIndex: number): { square: SquareType; path: number[] } {
  const s = ensureSugoroku(save)
  const card = s.hand[cardIndex]
  if (!card || s.pending) throw new Error('今はカードを使えません')
  const path: number[] = []
  for (let i = 1; i <= card.value; i++) path.push((s.position + i) % BOARD_SIZE)
  s.position = path[path.length - 1]!
  s.hand.splice(cardIndex, 1)
  s.hand.push(drawCard(rng, s.hand, !!successOf(save)))
  const square = s.board[s.position]!
  // 選手育成モード：特訓は必ず育成選手（選ぶ画面は出さない）
  const focus = successOf(save)?.focusId ?? null
  s.pending = { square, card, event: null, needsPlayer: square === 'special' && !focus }
  return { square, path }
}

// ---------------------------------------------------------------- 練習の効果

const INJURY_FACTOR = { easy: 0.5, normal: 1, hard: 1.7 } as const

const INJURIES = [
  { name: '軽い捻挫', weeks: [1, 2] },
  { name: '打撲', weeks: [1, 2] },
  { name: '肉離れ', weeks: [3, 5] },
  { name: '腰痛', weeks: [2, 4] },
  { name: '疲労骨折', weeks: [6, 10] },
] as const

/** 練習で体力が減り、疲れているとケガをしやすい */
function practiceLoad(rng: Rng, save: SaveData, p: Player, cost: number, injuryMult: number, messages: string[]): void {
  const c = p.condition
  c.stamina = clamp(Math.round(c.stamina - cost), 0, 100)
  // ストーリーの主要人物（日向大地）はケガをしない
  if (cost <= 0 || c.injury || p.storyCast === 'daichi') return
  const tired = c.stamina < 20 ? 0.07 : c.stamina < 40 ? 0.022 : 0.002
  const risk = tired * injuryMult * INJURY_FACTOR[save.settings.injury] * (1.5 - p.common.durability / 100)
  if (rng.chance(clamp(risk, 0, 0.4))) {
    const kind = rng.weighted(INJURIES.map((x, i) => ({ value: x, weight: [30, 30, 18, 15, 7][i]! })))
    const weeks = rng.int(kind.weeks[0], kind.weeks[1])
    c.injury = { name: kind.name, weeksLeft: weeks }
    messages.push(`${fullName(p)}が練習中に${kind.name}…（全治${weeks}週）`)
  }
}

/** 特殊能力を覚える／弱点を克服する */
export function trySkill(rng: Rng, p: Player, learnRate: number, cureRate: number, messages: string[]): void {
  const bad = p.skills.filter((id) => !SKILLS.find((s) => s.id === id)?.good)
  if (bad.length > 0 && rng.chance(cureRate)) {
    const id = rng.pick(bad)
    p.skills = p.skills.filter((x) => x !== id)
    messages.push(`${fullName(p)}が弱点「${SKILLS.find((s) => s.id === id)?.name}」を克服した！`)
    return
  }
  if (p.skills.filter((id) => SKILLS.find((s) => s.id === id)?.good).length >= 5) return
  if (!rng.chance(learnRate)) return
  const isPitcher = p.mainPosition === 'P'
  const options = SKILLS.filter(
    (s) =>
      s.good &&
      !p.skills.includes(s.id) &&
      (s.target === 'all' || (s.target === 'pitcher') === isPitcher) &&
      !p.skills.some((o) => conflicts(o, s.id)),
  )
  if (options.length === 0) return
  const skill = rng.pick(options)
  p.skills.push(skill.id)
  messages.push(`${fullName(p)}が特殊能力「${skill.name}」を身につけた！`)
}

const CARD_MULT: Record<CardEffect, { gain: number; cost: number }> = {
  none: { gain: 1, cost: 1 },
  hot: { gain: 1.5, cost: 1.6 },
  light: { gain: 0.7, cost: 0.5 },
  all: { gain: 1, cost: 1 },
}

/** 自校のその週の練習（マスとカードで効果が変わる） */
/** 守備位置の練習（コンバート）：毎週、少しずつその位置の適性が上がる */
function convertPractice(rng: Rng, p: Player, plan: WeekPlan | null, fieldingFacility: number, messages: string[]): void {
  const pos = p.convertTo
  if (!pos || p.retired) return
  const apt = pos === 'LF' || pos === 'CF' || pos === 'RF' ? Math.min(p.fielding.aptitude.LF, p.fielding.aptitude.CF, p.fielding.aptitude.RF) : p.fielding.aptitude[pos]
  if (apt >= 3) {
    p.convertTo = null
    return
  }
  let chance = 0.16 + fieldingFacility * 0.02
  if (plan?.kind === 'square') {
    if (plan.square === 'fielding' || plan.square === 'practical') chance += 0.14
    chance *= CARD_MULT[plan.card.effect].gain
  } else if (plan) chance *= 0.5
  // ×から△へは早く、○から◎へはじっくり
  chance *= [1.4, 1.0, 0.6][apt] ?? 1
  if (!rng.chance(chance)) return
  const of = pos === 'LF' || pos === 'CF' || pos === 'RF'
  for (const x of of ? (['LF', 'CF', 'RF'] as const) : [pos]) p.fielding.aptitude[x] = Math.max(p.fielding.aptitude[x], apt + 1)
  const label = ['×', '△', '○', '◎'][apt + 1]
  messages.push(`${fullName(p)}の${of ? '外野手' : POSITION_NAME[pos]}の適性が${label}になった！`)
  if (apt + 1 >= 3) p.convertTo = null
}

export function applyOwnWeek(save: SaveData, rng: Rng, plan: WeekPlan | null, members: Player[], facilityIntensity: number, messages: string[]): void {
  if (plan?.kind === 'square' && plan.square === 'scout' && save.scout && !save.scout.decided) {
    save.scout.points = Math.min(12, save.scout.points + 1)
    messages.push('中学校の試合を見に行った。スカウト活動が1回分増えた。（学校画面のスカウトから）')
  }
  const fieldingFacility = save.schools[save.playerSchoolId]?.facilities.fielding ?? 0
  for (const p of members) convertPractice(rng, p, plan, fieldingFacility, messages)
  const camp = (save.sugoroku?.campWeeks ?? 0) > 0
  const own = save.schools[save.playerSchoolId]
  // OB戦の悔しさ・大地への相談など：練習の効果が上がる期間（重なると足し合わせる）
  const campMult = (camp ? campMultiplier(save) : 1) * (1 + PRACTICE_BONUS * activeModifiers(save, 'practice').length)
  const success = !!successOf(save)
  for (const p of members) {
    if (p.retired) continue
    if (!plan) {
      // 標準の練習（テストや、すごろくを使わない進め方）
      growWeekly(rng, p, facilityIntensity)
      practiceLoad(rng, save, p, 6, 0.5, messages)
      continue
    }
    if (plan.kind === 'match') {
      growWeekly(rng, p, facilityIntensity * 0.6 * (success ? focusGrowthMult(save, p) : 1))
      continue
    }
    if (plan.kind === 'tournament') {
      // 大会の週は調整が中心で、伸びは控えめ
      growWeekly(rng, p, facilityIntensity * 0.4 * focusGrowthMult(save, p))
      continue
    }
    if (plan.kind === 'recruit') {
      // 勧誘に行った週：残った部員で軽く練習
      growWeekly(rng, p, facilityIntensity * 0.45 * (success ? focusGrowthMult(save, p) : 1))
      practiceLoad(rng, save, p, 5, 0.4, messages)
      continue
    }
    const sq = plan.square
    const card = CARD_MULT[plan.card.effect]
    const info = SQUARES[sq]
    let intensity = 0.5
    let cost = 0
    let injuryMult = 1
    if (info.menus) {
      // 選手育成モードは練習メニューを選ばないので、全員がそのマスの練習をする
      const match = success || plan.card.effect === 'all' || info.menus.includes(p.practiceMenu)
      // そのマスの練習に対応する設備が整っているほど、さらに伸びる（1段階につき4%）
      const fac = own ? own.facilities[FACILITY_OF[sq] ?? 'fitness'] : 0
      intensity = (match ? 1.8 : 0.95) * card.gain * (1 + fac * 0.04)
      cost = 17 * card.cost
    } else if (sq === 'practical') {
      intensity = 1.0 * card.gain
      cost = 15 * card.cost
      // 勝負強さが伸びる
      if (rng.chance(0.35 * card.gain)) p.common.clutch = Math.min(99, p.common.clutch + 1)
      if (p.mainPosition === 'P' && rng.chance(0.35 * card.gain)) p.pitching.pinch = Math.min(99, p.pitching.pinch + 1)
      if (rng.chance(0.3 * card.gain)) p.batting.eye = Math.min(99, p.batting.eye + 1)
      trySkill(rng, p, 0.035 * card.gain, 0.04 * card.gain, messages)
    } else if (sq === 'special') {
      const chosen = plan.specialPlayerId === p.id
      intensity = (chosen ? 3.6 : 0.6) * card.gain
      cost = (chosen ? 28 : 8) * card.cost
      injuryMult = chosen ? 1.4 : 1
      if (chosen) trySkill(rng, p, 0.16 * card.gain, 0.15 * card.gain, messages)
    } else if (sq === 'rest') {
      intensity = 0.25
      cost = -35
      if (p.condition.form < 3 && rng.chance(0.6)) p.condition.form += 1
    } else if (sq === 'rain') {
      intensity = 0.5 * card.gain
      cost = 5
      injuryMult = 0.2
    } else if (sq === 'school') {
      intensity = 0.15
      cost = -10
    } else {
      // イベント・マネージャー・部費・スカウト：軽い練習
      intensity = 0.6 * card.gain
      cost = 8 * card.cost
    }
    // 調子が良いほど伸びる（絶不調0.8倍〜普通1.0倍〜絶好調1.2倍）
    const spirit = 0.8 + (p.condition.form - 1) * 0.1
    // サクセス：育てる選手（フォーカス選手）は大きく伸びる
    const keys = success && plan.card.effect !== 'all' ? SQUARE_STATS[sq] : undefined
    growWeekly(rng, p, intensity * campMult * facilityIntensity * spirit * (success ? focusGrowthMult(save, p) : 1), keys)
    // 長打マス：弾道が上がりやすい
    if (success && sq === 'power' && p.batting.trajectory < 4 && rng.chance(0.06 * card.gain)) p.batting.trajectory += 1
    // 医務室が整っているほど、ケガをしにくい
    const medical = own ? 1.15 - own.facilities.medical * 0.07 : 1
    practiceLoad(rng, save, p, cost * (cost > 0 ? campMult : 1), injuryMult * (camp ? 1.2 : 1) * medical, messages)
  }
}

/** マスの種類ごとの、効き目に関わる設備 */
const FACILITY_OF: Partial<Record<SquareType, keyof Facilities>> = {
  batting: 'batting',
  power: 'batting',
  pitching: 'pitching',
  fielding: 'fielding',
  running: 'running',
  fitness: 'fitness',
}
