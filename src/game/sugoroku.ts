// すごろく形式の練習：盤面・手札・マスの効果

import { Rng, clamp } from './rng'
import { PRACTICE_BONUS, activeModifiers } from './modifiers'
import { campMultiplier, focusGrowthMult, focusPlayer, successOf } from './success/state'
import { rollAttach } from './success/board'
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
  velo: { label: '球威', short: '威', color: '#1f5fcf', description: '球速・スタミナが伸びる', menus: ['pitching'] },
  control: { label: '制球', short: '制', color: '#3b7fe8', description: '制球・キレが伸びる', menus: ['pitching'] },
  breaking: { label: '変化球', short: '変', color: '#6a4fd8', description: '変化量が上がり、新しい球種を覚えることもある', menus: ['pitching'] },
  fitness: { label: '体力', short: '体', color: '#b05cd6', description: 'スタミナ・回復・ケガしにくさが伸びる', menus: ['fitness'] },
  fielding: { label: '守備', short: '守', color: '#14a7a0', description: '守備・捕球・肩が伸びる', menus: ['fielding'] },
  running: { label: '走塁', short: '走', color: '#36a843', description: '走力・盗塁・走塁が伸びる', menus: ['running'] },
  practical: { label: '実戦', short: '実', color: '#d99400', description: '試合形式。勝負強さが伸び、特殊能力を覚えやすい' },
  rest: { label: '休養', short: '休', color: '#3aa8f0', description: '体力が回復し、調子が整う（よく休めることも、あまり休めないこともある）' },
  special: { label: '特訓', short: '特', color: '#c2185b', description: '選手を1人選んで、大きく伸ばす' },
  event: { label: 'イベント', short: '!', color: '#ff5fa2', description: '何かが起きる' },
  manager: { label: 'マネージャー', short: 'マ', color: '#ff8fb1', description: '調子が上がる' },
  funds: { label: '部費', short: '¥', color: '#e9a400', description: '部費が増える' },
  scout: { label: 'スカウト', short: 'ス', color: '#5f6f86', description: '中学生を視察できる' },
  rain: { label: '雨', short: '雨', color: '#7e8ca0', description: '練習の効果は半分。ケガもしにくい' },
  school: { label: '校内行事', short: '校', color: '#9aa7b6', description: '練習は休み。学校の行事がある' },
}

/**
 * 選手育成モード：練習マスごとに伸びる能力と、その重み（表示どおりに伸びる）。
 * 盤面は育成選手に合わせて投手用・野手用があり、チームメイトは自分の役割に読み替えて練習する。
 * 例：投手の盤面の「球威」の週は、野手は長打と肩の練習をする
 */
const FIELDER_STATS: Partial<Record<SquareType, Readonly<Record<string, number>>>> = {
  batting: { contact: 1, eye: 0.8, power: 0.35 },
  power: { power: 1.4 },
  running: { speed: 1, steal: 1, baserunning: 0.8 },
  fielding: { range: 1, catching: 1, arm: 1 },
  fitness: { stamina: 0.5, recovery: 1, durability: 0.8 },
  pitching: { contact: 0.6, eye: 0.6 },
  velo: { power: 0.9, arm: 0.6 },
  control: { contact: 1, eye: 0.8 },
  breaking: { contact: 0.7, eye: 0.7 },
}
const PITCHER_STATS: Partial<Record<SquareType, Readonly<Record<string, number>>>> = {
  velo: { velocity: 1, stamina: 0.6 },
  control: { control: 1, kire: 0.8 },
  breaking: { pitches: 1.6, kire: 0.5 },
  pitching: { velocity: 1, control: 1, kire: 1 },
  fitness: { stamina: 1, recovery: 1, durability: 0.8 },
  fielding: { quick: 1, range: 0.5 },
  batting: { control: 0.8, kire: 0.5 },
  power: { velocity: 0.8, stamina: 0.6 },
  running: { stamina: 0.8, recovery: 0.6 },
}
/** 能力の名前（マスの説明・特訓の選択肢に出す） */
const KEY_LABEL: Record<string, string> = {
  contact: 'ミート', eye: '選球眼', power: 'パワー', speed: '走力', steal: '盗塁', baserunning: '走塁',
  range: '守備範囲', catching: '捕球', arm: '肩力', throwing: '送球',
  velocity: '球速', control: 'コントロール', stamina: 'スタミナ', kire: 'キレ', quick: 'クイック', pitches: '変化球',
  recovery: '回復', durability: 'ケガしにくさ',
}
/** 選手育成モード：育成選手から見た、このマスの説明（投手と野手で伸びる能力が違う） */
export function squareDescription(sq: SquareType, p: Pick<Player, 'mainPosition'> | null): string {
  const keys = p ? practiceKeys(sq, p) : undefined
  if (!keys || !SQUARES[sq].menus) return sq === 'special' && p ? '伸ばす能力を1つ選んで、大きく伸ばす。特殊能力に挑戦することもできる' : SQUARES[sq].description
  const names = Object.keys(keys).map((k) => KEY_LABEL[k] ?? k)
  return `${names.join('・')}が伸びる${keys.pitches !== undefined ? '（新しい球種を覚えることもある）' : ''}`
}
/** 選手育成モードの特訓で、特殊能力に挑戦したときに身につく確率（熱血カードなら1.5倍） */
export const SPECIAL_SKILL_RATE = 0.45
/** 選手育成モードの特訓マスで選べる能力（最後は特殊能力への挑戦） */
export function specialOptions(p: Pick<Player, 'mainPosition'>): { key: string; label: string }[] {
  const keys = p.mainPosition === 'P' ? ['velocity', 'control', 'stamina', 'kire', 'pitches'] : ['contact', 'power', 'eye', 'speed', 'arm', 'range', 'catching']
  return [...keys.map((key) => ({ key, label: KEY_LABEL[key]! })), { key: 'skill', label: '特殊能力を取得する' }]
}

/** その選手が、このマスの週に伸ばす能力（重み） */
export function practiceKeys(sq: SquareType, p: Pick<Player, 'mainPosition'>): Readonly<Record<string, number>> | undefined {
  return (p.mainPosition === 'P' ? PITCHER_STATS : FIELDER_STATS)[sq]
}
/** 表示用：育成選手から見た、このマスで伸びる能力 */
export const SQUARE_STATS = FIELDER_STATS

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

/**
 * 選手育成モードの盤面（育成選手が投手か野手かで、練習マスが変わる）。
 * 投手：球威4・制球4・変化球2・体力3・守備1　野手：打撃4・長打2・走塁3・守備4・体力1
 * どちらも実戦・特訓・休養2・イベント2。季節で一部の練習マスが雨・行事・体力に替わる
 */
export function buildFocusBoard(rng: Rng, month: number, pitcher: boolean): SquareType[] {
  const practice: SquareType[] = pitcher
    ? ['velo', 'velo', 'velo', 'velo', 'control', 'control', 'control', 'control', 'breaking', 'breaking', 'fitness', 'fitness', 'fitness', 'fielding']
    : ['batting', 'batting', 'batting', 'batting', 'power', 'power', 'running', 'running', 'running', 'fielding', 'fielding', 'fielding', 'fielding', 'fitness']
  const n = practice.length
  const squares: SquareType[] = [...practice, 'practical', 'special', 'rest', 'rest', 'event', 'event']
  if (month === 6) {
    squares[rng.int(0, n - 1)] = 'rain'
    squares[rng.int(0, n - 1)] = 'rain'
  }
  if (month === 7 || month === 12 || month === 3 || month === 10) squares[rng.int(0, n - 1)] = 'school'
  if (month === 12 || month === 1 || month === 2) squares[rng.int(0, n - 1)] = 'fitness'
  return rng.shuffle(squares)
}

/** その遊び方の盤面（選手育成モードは育成選手に合わせた盤面） */
function boardFor(save: SaveData, rng: Rng, month: number): SquareType[] {
  if (successOf(save)) return buildFocusBoard(rng, month, focusPlayer(save)?.mainPosition === 'P')
  return buildBoard(rng, month)
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
  s.pending = { square, card, event: null, needsPlayer: square === 'special' && !focus, needsChoice: square === 'special' && !!focus }
  return { square, path }
}

// ---------------------------------------------------------------- 練習の効果

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
  // 選手育成モードのチームメイトは、ケガをしにくい（ケガの知らせが多くなりすぎないように。育成選手はそのまま）
  const mate = successOf(save) && p.storyCast !== 'focus' ? 0.25 : 1
  const risk = tired * injuryMult * mate * (1.5 - p.common.durability / 100)
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

/** 選手育成モードの練習：体力の消費の倍率と、伸びの倍率（調整用） */
export const SUCCESS_PRACTICE_COST = 0.8
export const SUCCESS_PRACTICE_GAIN = 0.85

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
  // 選手育成モード：同じ練習マスに続けて止まると、練習がつながって効果が上がる（2連続で1.5倍、3連続から2倍）
  const comboMult = success ? updateCombo(save, plan, messages) : 1
  // 選手育成モードの休養：その週の休み方で、回復量が変わる（よく休めた・ふつう・あまり休めなかった）
  const restGain = success && plan?.kind === 'square' && plan.square === 'rest' ? rollRest(rng, messages) : 35
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
    let specialKeys: Record<string, number> | undefined
    if (info.menus) {
      // 選手育成モードは練習メニューを選ばないので、全員がそのマスの練習をする
      const match = success || plan.card.effect === 'all' || info.menus.includes(p.practiceMenu)
      // そのマスの練習に対応する設備が整っているほど、さらに伸びる（1段階につき4%）
      const fac = own ? own.facilities[FACILITY_OF[sq] ?? 'fitness'] : 0
      intensity = (match ? 1.8 : 0.95) * card.gain * (1 + fac * 0.04)
      // 選手育成モードは練習がきつい（休むタイミングが大事になる）
      cost = (success ? 27 : 17) * card.cost
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
      if (chosen && success && plan.specialKey === 'skill') {
        // 選手育成モード：特殊能力に挑戦する（能力はほとんど伸びない。確率で、ランダムな特殊能力を得るか弱点を克服する）
        intensity = 0.6 * card.gain
        const before = p.skills.join(',')
        trySkill(rng, p, SPECIAL_SKILL_RATE * card.gain, 0.3 * card.gain, messages)
        if (p.skills.join(',') === before) messages.push(`${fullName(p)}は特訓に打ち込んだが、特殊能力はつかめなかった…`)
      } else if (chosen && success && plan.specialKey) {
        // 選手育成モード：選んだ能力だけを、ふつうの練習マスよりも大きく伸ばす
        intensity = 1.8 * card.gain
        specialKeys = { [plan.specialKey]: 2.2 }
      } else if (chosen) trySkill(rng, p, 0.16 * card.gain, 0.15 * card.gain, messages)
    } else if (sq === 'rest') {
      intensity = 0.25
      cost = -restGain
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
    // 選手育成モード：練習の体力の消費を2割減らし、そのぶん練習の伸びを少し抑える（育成の結果は変えない）
    if (success && cost > 0) {
      cost *= SUCCESS_PRACTICE_COST
      intensity *= SUCCESS_PRACTICE_GAIN
    }
    // 調子が良いほど伸びる（絶不調0.8倍〜普通1.0倍〜絶好調1.2倍）
    const spirit = 0.8 + (p.condition.form - 1) * 0.1
    // サクセス：育てる選手（フォーカス選手）は大きく伸びる
    // 選手育成モード：盤面のマスを、自分の役割（投手・野手）に合わせて読み替えて練習する
    const keys = specialKeys ?? (success && plan.card.effect !== 'all' ? practiceKeys(sq, p) : undefined)
    // 疲れていると、練習の効率が落ちる（体力60未満で0.85倍、45未満で0.55倍、30未満で0.3倍）
    const tired = success ? (p.condition.stamina < 30 ? 0.3 : p.condition.stamina < 45 ? 0.55 : p.condition.stamina < 60 ? 0.85 : 1) : 1
    const combo = info.menus ? comboMult : 1
    growWeekly(rng, p, intensity * campMult * facilityIntensity * spirit * tired * combo * (success ? focusGrowthMult(save, p) : 1), keys)
    // 長打マス：弾道が上がりやすい
    if (success && sq === 'power' && p.mainPosition !== 'P' && p.batting.trajectory < 4 && rng.chance(0.06 * card.gain)) p.batting.trajectory += 1
    // 医務室が整っているほど、ケガをしにくい
    const medical = own ? 1.15 - own.facilities.medical * 0.07 : 1
    practiceLoad(rng, save, p, cost * (cost > 0 ? campMult : 1), injuryMult * (camp ? 1.2 : 1) * medical, messages)
  }
}

/**
 * 選手育成モードの休養マスの回復量。
 * 体力100から「練習・練習・練習・休養」の4週で、ふつうは90、よく休めると100、あまり休めないと80に戻るくらい
 * （練習1回で約22減り、毎週の自然な回復が約8）
 */
export const REST_GAIN = { good: 50, normal: 40, poor: 30 } as const
function rollRest(rng: Rng, messages: string[]): number {
  const r = rng.next()
  if (r < 0.2) {
    messages.push('休養：ぐっすり休めた！（いつもより体力が回復した）')
    return REST_GAIN.good
  }
  if (r < 0.4) {
    messages.push('休養：あまり休めなかった…（体力の回復が少なかった）')
    return REST_GAIN.poor
  }
  return REST_GAIN.normal
}

/** 練習のつながり：同じ練習マスが続いた回数を数え、倍率を返す（練習マス以外に止まると途切れる） */
export const COMBO_MULT = [1, 1, 1.5, 2]
function updateCombo(save: SaveData, plan: WeekPlan | null, messages: string[]): number {
  const sg = save.sugoroku
  if (!sg) return 1
  // 試合・勧誘・大会の週も、つながりは途切れる
  if (!plan || plan.kind !== 'square') {
    sg.combo = undefined
    return 1
  }
  const sq = plan.square
  if (!SQUARES[sq].menus) {
    sg.combo = undefined
    return 1
  }
  const count = sg.combo?.square === sq ? Math.min(3, sg.combo.count + 1) : 1
  sg.combo = { square: sq, count }
  const mult = COMBO_MULT[count] ?? 1
  if (count >= 2) messages.push(`${SQUARES[sq].label}の練習がつながった！（練習の効果×${mult.toFixed(1)}）`)
  return mult
}

/** 次に止まると、練習のつながりが何回目になるか（表示用。つながらなければ0） */
export function comboIfLanding(save: SaveData, sq: SquareType): number {
  const c = save.sugoroku?.combo
  if (!SQUARES[sq].menus || !c || c.square !== sq) return 0
  return Math.min(3, c.count + 1)
}

/** マスの種類ごとの、効き目に関わる設備 */
const FACILITY_OF: Partial<Record<SquareType, keyof Facilities>> = {
  batting: 'batting',
  power: 'batting',
  pitching: 'pitching',
  velo: 'pitching',
  control: 'pitching',
  breaking: 'pitching',
  fielding: 'fielding',
  running: 'running',
  fitness: 'fitness',
}
