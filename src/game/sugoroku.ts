// すごろく形式の練習：盤面・手札・マスの効果

import { Rng, clamp } from './rng'
import { weekToDate } from './constants'
import { fullName, growWeekly } from './player'
import { SKILLS, conflicts } from './skills'
import type { Card, CardEffect, Player, PracticeMenu, SaveData, SquareType, SugorokuState, WeekPlan } from './types'

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
  batting: { label: '打撃', short: '打', color: '#ff7a2e', description: 'ミート・選球眼などが伸びる', menus: ['batting'] },
  power: { label: '長打', short: '長', color: '#e5484d', description: 'パワー・弾道が伸びる', menus: ['power'] },
  pitching: { label: '投球', short: '投', color: '#2f6fe0', description: '球速・制球・変化球などが伸びる', menus: ['pitching'] },
  fitness: { label: '体力', short: '体', color: '#8a5cd6', description: 'スタミナ・回復力・ケガしにくさが伸びる', menus: ['fitness'] },
  fielding: { label: '守備', short: '守', color: '#14a7a0', description: '肩・守備範囲・捕球・送球が伸びる', menus: ['fielding'] },
  running: { label: '走塁', short: '走', color: '#36a843', description: '走力・盗塁・走塁判断が伸びる', menus: ['running'] },
  practical: { label: '実戦', short: '実', color: '#d99400', description: '試合形式。勝負強さが伸び、特殊能力を覚えやすい' },
  rest: { label: '休養', short: '休', color: '#3aa8f0', description: '体力が大きく回復し、調子が整う' },
  special: { label: '特訓', short: '特', color: '#c2185b', description: '選手を1人選んで、大きく伸ばす' },
  event: { label: 'イベント', short: '!', color: '#ff5fa2', description: '何かが起きる' },
  manager: { label: 'マネージャー', short: 'マ', color: '#ff8fb1', description: 'やる気と調子が上がる' },
  funds: { label: '部費', short: '¥', color: '#e9a400', description: '部費が増える' },
  scout: { label: 'スカウト', short: 'ス', color: '#5f6f86', description: '中学生を視察できる' },
  rain: { label: '雨', short: '雨', color: '#7e8ca0', description: '練習の効果は半分。ケガもしにくい' },
  school: { label: '校内行事', short: '校', color: '#9aa7b6', description: '練習は休み。学校の行事がある' },
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

function drawCard(rng: Rng): Card {
  const effect = rng.weighted<CardEffect>([
    { value: 'none', weight: 70 },
    { value: 'hot', weight: 12 },
    { value: 'light', weight: 10 },
    { value: 'all', weight: 8 },
  ])
  return { value: rng.int(1, 6), effect }
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
  // 冬は体づくりが中心
  if (month === 12 || month === 1 || month === 2) squares[rng.int(0, 5)] = 'fitness'
  return rng.shuffle(squares)
}

export function ensureSugoroku(save: SaveData): SugorokuState {
  const month = weekToDate(save.calendar.week).month
  if (!save.sugoroku) {
    const rng = new Rng(save.rngState)
    save.sugoroku = {
      board: buildBoard(rng, month),
      position: 0,
      hand: Array.from({ length: HAND_SIZE }, () => drawCard(rng)),
      boardMonth: month,
      pending: null,
      campWeeks: 0,
    }
    save.rngState = rng.getState()
  }
  return save.sugoroku
}

/** 月が変わっていたら盤面を作り直す（週を進めた後に呼ぶ） */
export function refreshBoard(save: SaveData, rng: Rng): boolean {
  const s = ensureSugoroku(save)
  const month = weekToDate(save.calendar.week).month
  if (s.boardMonth === month) return false
  s.board = buildBoard(rng, month)
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
  s.hand.push(drawCard(rng))
  const square = s.board[s.position]!
  s.pending = { square, card, event: null, needsPlayer: square === 'special' }
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
  c.stamina = clamp(c.stamina - cost, 0, 100)
  if (cost <= 0 || c.injury) return
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
export function applyOwnWeek(save: SaveData, rng: Rng, plan: WeekPlan | null, members: Player[], facilityIntensity: number, messages: string[]): void {
  const camp = (save.sugoroku?.campWeeks ?? 0) > 0
  const campMult = camp ? 1.35 : 1
  for (const p of members) {
    if (p.retired) continue
    if (!plan) {
      // 標準の練習（テストや、すごろくを使わない進め方）
      growWeekly(rng, p, facilityIntensity)
      practiceLoad(rng, save, p, 6, 0.5, messages)
      continue
    }
    if (plan.kind === 'match') {
      growWeekly(rng, p, facilityIntensity * 0.6)
      continue
    }
    const sq = plan.square
    const card = CARD_MULT[plan.card.effect]
    const info = SQUARES[sq]
    let intensity = 0.5
    let cost = 0
    let injuryMult = 1
    if (info.menus) {
      const match = plan.card.effect === 'all' || info.menus.includes(p.practiceMenu)
      intensity = (match ? 1.8 : 0.95) * card.gain
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
    // やる気と調子が高いほど伸びる
    const spirit = 0.85 + p.condition.motivation / 333 + (p.condition.form - 3) * 0.05
    growWeekly(rng, p, intensity * campMult * facilityIntensity * spirit)
    practiceLoad(rng, save, p, cost * (cost > 0 ? campMult : 1), injuryMult * (camp ? 1.2 : 1), messages)
  }
}
