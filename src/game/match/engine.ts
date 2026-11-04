// 試合エンジン：1球ごとに計算する
//
// 流れ（構想書「試合の計算ルール」）
//  1. 配球  2. 制球  3. 打者の判断  4. 当たり判定  5. 打球  6. 守備  7. 状態の更新

import { Rng, clamp } from '../rng'
import { POSITION_NAME, velocityScore } from '../constants'
import type { LineupConfig, Player, Position } from '../types'
import { canPitch } from './lineup'
import type {
  Bases,
  BattingOrder,
  BoxBatting,
  BoxPitching,
  FieldPos,
  MatchOptions,
  MatchState,
  PitchingOrder,
  PlayEvent,
  PlayKind,
  Situation,
  TeamState,
} from './types'

export interface MatchContext {
  players: Record<string, Player>
  rng: Rng
}

export interface TeamInput {
  schoolId: string
  name: string
  lineup: LineupConfig
}

// ---------------------------------------------------------------- 準備

export function defaultOptions(partial: Partial<MatchOptions> = {}): MatchOptions {
  return {
    innings: 9,
    tiebreakFrom: 10,
    mercy: [],
    bigStage: false,
    summer: false,
    luck: 'normal',
    userSchoolId: null,
    label: '練習試合',
    ...partial,
  }
}

function emptyBatting(): BoxBatting {
  return { pa: 0, ab: 0, h: 0, d: 0, t: 0, hr: 0, rbi: 0, bb: 0, k: 0, sb: 0, r: 0 }
}

function emptyPitching(): BoxPitching {
  return { outs: 0, h: 0, r: 0, bb: 0, k: 0, hr: 0, pitches: 0, fatigue: 0 }
}

function teamState(input: TeamInput): TeamState {
  return {
    schoolId: input.schoolId,
    name: input.name,
    lineup: input.lineup.batters.map((b) => ({ playerId: b.playerId, position: b.position })),
    pitcherId: input.lineup.startingPitcherId,
    bench: [...input.lineup.bench],
    used: [],
    battingIndex: 0,
    runsByInning: [],
    hits: 0,
    errors: 0,
    useDH: input.lineup.useDH,
    pitchersUsed: [input.lineup.startingPitcherId],
  }
}

export function createMatch(
  ctx: MatchContext,
  away: TeamInput,
  home: TeamInput,
  options: MatchOptions,
  id: string,
): MatchState {
  const state: MatchState = {
    version: 1,
    id,
    options,
    away: teamState(away),
    home: teamState(home),
    inning: 1,
    top: true,
    outs: 0,
    bases: [null, null, null],
    count: { balls: 0, strikes: 0 },
    finished: false,
    winner: null,
    batting: {},
    pitching: {},
    dayForm: {},
    events: [],
    lastPitch: '',
    leadChange: null,
    winningPitcherId: null,
    losingPitcherId: null,
    cutins: 0,
    pending: { batting: 'auto', pitching: 'auto', plan: 'auto', shift: 'normal' },
  }
  // その日の調子（運の要素）。高校野球らしく少し大きめのばらつき
  const sd = options.luck === 'easy' ? 3.5 : options.luck === 'hard' ? 9 : 6
  // チーム全体の「その日の出来」もばらつかせる（番狂わせの元）
  const teamSd = options.luck === 'easy' ? 2.5 : options.luck === 'hard' ? 8 : 5.5
  // 1回表の先攻の枠だけ用意する（後攻の枠は1回裏が始まるときに追加）
  state.away.runsByInning.push(0)
  for (const t of [state.away, state.home]) {
    const teamForm = ctx.rng.normal(0, teamSd)
    for (const id of [...t.lineup.map((s) => s.playerId), t.pitcherId, ...t.bench]) {
      const p = ctx.players[id]
      if (!p) continue
      state.dayForm[id] = Math.round(ctx.rng.normal((p.condition.form - 3) * 3, sd) + teamForm)
    }
    for (const s of t.lineup) state.batting[s.playerId] = emptyBatting()
    state.pitching[t.pitcherId] = emptyPitching()
  }
  return state
}

// ---------------------------------------------------------------- 参照用

export function battingTeam(s: MatchState): TeamState {
  return s.top ? s.away : s.home
}

export function fieldingTeam(s: MatchState): TeamState {
  return s.top ? s.home : s.away
}

export function currentBatterId(s: MatchState): string {
  const t = battingTeam(s)
  return t.lineup[t.battingIndex]!.playerId
}

export function score(s: MatchState): [number, number] {
  const sum = (t: TeamState) => t.runsByInning.reduce((a, b) => a + b, 0)
  return [sum(s.away), sum(s.home)]
}

function fielderAt(t: TeamState, pos: Position): string {
  if (pos === 'P') return t.pitcherId
  return t.lineup.find((x) => x.position === pos)?.playerId ?? t.pitcherId
}

function name(ctx: MatchContext, id: string): string {
  return ctx.players[id]?.surname ?? '？'
}

function has(p: Player | undefined, skill: string): boolean {
  return !!p && p.skills.includes(skill)
}

/** チャンス・ピンチの判定（カットインや采配の目安） */
export function situation(s: MatchState): Situation {
  const risp = s.bases[1] !== null || s.bases[2] !== null
  const [a, h] = score(s)
  const diff = s.top ? a - h : h - a // 攻撃側から見た点差
  const late = s.inning >= Math.max(7, s.options.innings - 2)
  const close = Math.abs(diff) <= 2
  if (!risp && !(late && close && s.bases[0] !== null)) return 'normal'
  if (s.outs >= 2 && !late && !(s.bases[2] !== null)) return 'normal'
  const user = s.options.userSchoolId
  if (!user) return 'chance'
  return battingTeam(s).schoolId === user ? 'chance' : 'pinch'
}

/**
 * いまの場面で効いている特殊能力（画面表示用）。
 * 試合の計算（pitcherNow / batterNow など）と同じ条件で判定する。
 */
export function activeSkills(s: MatchState, players: Record<string, Player>): { pitcher: string[]; batter: string[] } {
  const p = players[fieldingTeam(s).pitcherId]
  const b = s.finished ? undefined : players[currentBatterId(s)]
  const out = { pitcher: [] as string[], batter: [] as string[] }
  const [a, h] = score(s)
  const diff = s.top ? a - h : h - a
  const runner = s.bases.some((x) => x !== null)
  const on = (list: string[], who: Player | undefined, id: string, cond: boolean) => {
    if (cond && has(who, id)) list.push(id)
  }
  // 投手
  on(out.pitcher, p, 'full_throttle', s.inning === 1)
  on(out.pitcher, p, 'slow_starter', s.inning === 1)
  on(out.pitcher, p, 'gear_change', s.inning >= 6)
  on(out.pitcher, p, 'out_of_gas', s.inning >= 7)
  on(out.pitcher, p, 'steel_heart', !!s.options.bigStage)
  on(out.pitcher, p, 'nervous', !!s.options.bigStage)
  on(out.pitcher, p, 'glass_heart', recentHits(s) >= 2)
  on(out.pitcher, p, 'finisher', s.count.strikes === 2)
  on(out.pitcher, p, 'groundball', true)
  on(out.pitcher, p, 'tempo', true)
  on(out.pitcher, p, 'meatball', true)
  on(out.pitcher, p, 'no_steal', runner)
  // 打者
  const late = s.inning >= s.options.innings - 1
  const last = s.events[s.events.length - 1]
  on(out.batter, b, 'first_pitch', s.count.balls === 0 && s.count.strikes === 0)
  on(out.batter, b, 'persistent', s.count.strikes === 2)
  on(out.batter, b, 'late_hero', late && Math.abs(diff) <= 1)
  on(out.batter, b, 'leadoff', s.outs === 0 && !runner)
  on(out.batter, b, 'bases_loaded', s.bases.every((x) => x !== null))
  on(out.batter, b, 'walkoff', !s.top && s.inning >= s.options.innings && diff <= 0 && diff >= -3)
  on(
    out.batter,
    b,
    'momentum',
    !!last && last.top === s.top && last.inning === s.inning && ['single', 'double', 'triple'].includes(last.kind),
  )
  on(out.batter, b, 'counterattack', diff < 0)
  on(out.batter, b, 'steel_heart', !!s.options.bigStage)
  on(out.batter, b, 'nervous', !!s.options.bigStage)
  on(out.batter, b, 'heat_weak', !!s.options.summer)
  on(out.batter, b, 'summer_child', !!s.options.summer)
  on(out.batter, b, 'all_fields', true)
  on(out.batter, b, 'double_play', s.bases[0] !== null && s.outs < 2)
  on(out.batter, b, 'bunt', s.pending.batting === 'bunt')
  on(out.batter, b, 'sign_lost', s.pending.batting === 'bunt')
  return out
}

// ---------------------------------------------------------------- 能力の補正

interface PitcherNow {
  velo: number // 球速km/h
  stuff: number // 球威の評価
  control: number
  kire: number
  fatigue: number
}

function pitcherNow(s: MatchState, ctx: MatchContext, full: boolean): PitcherNow {
  const id = fieldingTeam(s).pitcherId
  const p = ctx.players[id]!
  const box = s.pitching[id]!
  const form = s.dayForm[id] ?? 0
  const f = box.fatigue
  let velo = p.pitching.velocity - f * 5 + (full ? 3 : 0)
  let control = p.pitching.control - f * 14 + form * 0.6
  let kire = p.pitching.kire - f * 10 + form * 0.6 + (full ? 5 : 0)
  if (p.condition.armIssue) {
    velo -= 3
    control -= 4
  }
  if (s.inning === 1) {
    if (has(p, 'full_throttle')) control += 10
    if (has(p, 'slow_starter')) control -= 12
  }
  if (s.inning >= 6 && has(p, 'gear_change')) {
    velo += 2
    kire += 6
  }
  if (s.inning >= 7 && has(p, 'out_of_gas')) {
    velo -= 3
    kire -= 7
  }
  if (s.options.bigStage) {
    if (has(p, 'steel_heart')) kire += 6
    if (has(p, 'nervous')) control -= 10
  }
  const risp = s.bases[1] !== null || s.bases[2] !== null
  if (risp) kire += (p.pitching.pinch - 50) / 5
  // 捕手の「名女房」
  const catcher = ctx.players[fielderAt(fieldingTeam(s), 'C')]
  if (has(catcher, 'battery_mate')) control += 6
  // 打たれると崩れる
  if (has(p, 'glass_heart') && recentHits(s) >= 2) control -= 10
  const stuff = velocityScore(velo) * 0.5 + kire * 0.4 + form * 0.5
  return { velo, stuff, control, kire, fatigue: f }
}

/** この回に続けて打たれた本数 */
function recentHits(s: MatchState): number {
  let n = 0
  for (let i = s.events.length - 1; i >= 0; i--) {
    const e = s.events[i]!
    if (e.inning !== s.inning || e.top !== s.top) break
    if (['single', 'double', 'triple', 'homerun'].includes(e.kind)) n++
    else if (!['steal', 'walk', 'hbp'].includes(e.kind)) break
  }
  return n
}

interface BatterNow {
  contact: number
  power: number
  eye: number
  speed: number
}

function batterNow(s: MatchState, ctx: MatchContext, order: BattingOrder): BatterNow {
  const id = currentBatterId(s)
  const p = ctx.players[id]!
  const pitcher = ctx.players[fieldingTeam(s).pitcherId]!
  const form = s.dayForm[id] ?? 0
  let contact = p.batting.contact + form
  let power = p.batting.power + form * 0.7
  let eye = p.batting.eye
  const [a, h] = score(s)
  const diff = s.top ? a - h : h - a
  // 投手でないのに打席に立つ投手は、そのまま（能力値が低い）
  if (pitcher.throws === 'L') contact += (p.batting.vsLeft - 50) / 4
  if (p.bats === 'L' || p.bats === 'S') contact += (pitcher.pitching.vsLeft < 50 ? (50 - pitcher.pitching.vsLeft) / 6 : 0)
  const risp = s.bases[1] !== null || s.bases[2] !== null
  if (risp) contact += (p.common.clutch - 50) / 4
  if (order === 'contact') {
    contact += 10
    power -= 12
  }
  if (order === 'swing') {
    contact -= 10
    power += 12
  }
  if (s.count.balls === 0 && s.count.strikes === 0 && has(p, 'first_pitch')) contact += 12
  if (s.count.strikes === 2 && has(p, 'persistent')) contact += 6
  const late = s.inning >= s.options.innings - 1
  if (late && Math.abs(diff) <= 1 && has(p, 'late_hero')) {
    contact += 10
    power += 8
  }
  if (s.outs === 0 && s.bases.every((b) => b === null) && has(p, 'leadoff')) {
    contact += 6
    eye += 10
  }
  if (s.bases.every((b) => b !== null) && has(p, 'bases_loaded')) power += 12
  if (!s.top && s.inning >= s.options.innings && diff <= 0 && diff >= -3 && has(p, 'walkoff')) {
    contact += 12
    power += 8
  }
  if (has(p, 'momentum')) {
    const last = s.events[s.events.length - 1]
    if (last && last.top === s.top && last.inning === s.inning && ['single', 'double', 'triple'].includes(last.kind))
      contact += 8
  }
  if (diff < 0 && has(p, 'counterattack')) contact += 6
  if (s.options.bigStage) {
    if (has(p, 'steel_heart')) contact += 8
    if (has(p, 'nervous')) contact -= 10
  }
  if (s.options.summer) {
    if (has(p, 'heat_weak')) contact -= 4
    if (has(p, 'summer_child')) contact += 3
  }
  if (p.condition.injury) contact -= 15
  return { contact, power, eye, speed: p.running.speed }
}

// ---------------------------------------------------------------- 打撃の作戦（CPU・おまかせ）

function aiBattingOrder(s: MatchState, ctx: MatchContext): BattingOrder {
  const rng = ctx.rng
  const p = ctx.players[currentBatterId(s)]!
  const [a, h] = score(s)
  const diff = s.top ? a - h : h - a
  const weak = p.batting.contact + p.batting.power < 85 || p.mainPosition === 'P'
  // 送りバント：無死一塁（一二塁）で接戦
  if (s.outs === 0 && s.bases[0] && !s.bases[2] && Math.abs(diff) <= 2 && weak && rng.chance(0.5)) return 'bunt'
  if (s.outs === 0 && s.bases[1] && !s.bases[0] && !s.bases[2] && Math.abs(diff) <= 1 && s.inning >= 7 && weak && rng.chance(0.4))
    return 'bunt'
  // 盗塁：一塁に俊足の走者
  const runner = s.bases[0] ? ctx.players[s.bases[0]] : undefined
  if (runner && !s.bases[1] && s.outs < 2 && runner.running.speed >= 50 && rng.chance(clamp(0.1 + (runner.running.speed - 50) / 90 + (runner.running.steal - 50) / 150, 0, 0.45))) return 'steal'
  // カウント次第で強振
  if ((s.count.balls === 3 && s.count.strikes <= 1) || (s.count.balls === 2 && s.count.strikes === 0)) {
    if (p.batting.power >= 55 && rng.chance(0.5)) return 'swing'
  }
  return 'auto'
}

function aiPitchingOrder(s: MatchState, ctx: MatchContext): PitchingOrder {
  // 敬遠：一塁が空いていて、終盤の接戦で強打者
  if (s.count.balls !== 0 || s.count.strikes !== 0) return 'auto'
  const p = ctx.players[currentBatterId(s)]!
  const [a, h] = score(s)
  const diff = Math.abs(a - h)
  if (!s.bases[0] && (s.bases[1] || s.bases[2]) && s.inning >= 7 && diff <= 1 && s.outs < 2) {
    if (p.batting.power + p.batting.contact >= 140 && ctx.rng.chance(0.4)) return 'walk'
  }
  return 'auto'
}

// ---------------------------------------------------------------- 継投（CPU・おまかせ）

export function shouldChangePitcher(s: MatchState, ctx: MatchContext): string | null {
  const t = fieldingTeam(s)
  const box = s.pitching[t.pitcherId]!
  const inningRuns = (battingTeam(s).runsByInning[battingTeam(s).runsByInning.length - 1] ?? 0)
  const tired = box.fatigue >= 0.9 || (box.fatigue >= 0.55 && situation(s) !== 'normal' && s.inning >= 6)
  const beaten = inningRuns >= 4 || box.r >= 7
  if (!tired && !beaten) return null
  return bestReliever(t, ctx)
}

export function bestReliever(t: TeamState, ctx: MatchContext): string | null {
  let best: string | null = null
  let bestScore = -Infinity
  for (const id of t.bench) {
    const p = ctx.players[id]
    if (!p || !canPitch(p) || t.used.includes(id)) continue
    const sc = p.pitching.control + velocityScore(p.pitching.velocity) + p.pitching.stamina * 0.3 + (p.mainPosition === 'P' ? 25 : -20) - p.weeklyPitches * 0.08
    if (sc > bestScore) {
      best = id
      bestScore = sc
    }
  }
  return best
}

/** 投手交代。DHなしなら打順の投手の位置に入る */
export function changePitcher(s: MatchState, team: TeamState, newId: string): void {
  const old = team.pitcherId
  if (old === newId) return
  team.used.push(old)
  team.bench = team.bench.filter((id) => id !== newId)
  team.pitcherId = newId
  team.pitchersUsed.push(newId)
  const slot = team.lineup.find((x) => x.playerId === old && x.position === 'P')
  if (slot) {
    slot.playerId = newId
    s.batting[newId] ??= emptyBatting()
  }
  s.pitching[newId] ??= emptyPitching()
}

/** 代打・代走・守備交代（控えの選手と入れ替える） */
export function substitute(s: MatchState, team: TeamState, outId: string, inId: string): void {
  const slot = team.lineup.find((x) => x.playerId === outId)
  if (!slot || !team.bench.includes(inId)) return
  slot.playerId = inId
  team.used.push(outId)
  team.bench = team.bench.filter((id) => id !== inId)
  s.batting[inId] ??= emptyBatting()
  // 走者を入れ替える（代走）
  s.bases = s.bases.map((b) => (b === outId ? inId : b)) as Bases
  if (slot.position === 'P') {
    team.pitcherId = inId
    team.pitchersUsed.push(inId)
    s.pitching[inId] ??= emptyPitching()
  }
}

// ---------------------------------------------------------------- 1球

export interface PitchResult {
  /** 打席が終わったか */
  paEnded: boolean
  event: PlayEvent | null
}

const isUser = (s: MatchState, t: TeamState) => s.options.userSchoolId === t.schoolId

/** 1球進める */
export function simulatePitch(s: MatchState, ctx: MatchContext): PitchResult {
  if (s.finished) return { paEnded: true, event: null }
  const rng = ctx.rng
  const bat = battingTeam(s)
  const field = fieldingTeam(s)
  const newPA = s.count.balls === 0 && s.count.strikes === 0

  // 打席の初めに、CPU（とおまかせ）の継投を判断する
  if (newPA && (!isUser(s, field) || s.pending.pitching === 'auto')) {
    const reliever = shouldChangePitcher(s, ctx)
    if (reliever) {
      const before = field.pitcherId
      changePitcher(s, field, reliever)
      s.lastPitch = `${field.name}、投手交代：${name(ctx, before)} → ${name(ctx, reliever)}`
    }
  }

  // 作戦：プレイヤーが指示していればそれに従い、おまかせなら打席の初めにコーチ（AI）が決める
  let batOrder: BattingOrder
  if (isUser(s, bat) && s.pending.batting !== 'auto') batOrder = s.pending.batting
  else if (newPA) {
    batOrder = aiBattingOrder(s, ctx)
    if (batOrder === 'bunt') s.pending.batting = 'bunt'
  } else batOrder = s.pending.batting
  const pitOrder: PitchingOrder = isUser(s, field) ? s.pending.pitching : aiPitchingOrder(s, ctx)

  // 敬遠
  if (pitOrder === 'walk' && newPA) {
    s.pitching[field.pitcherId]!.pitches += 4
    return endPA(s, ctx, 'walk', 0, null, '敬遠')
  }

  // 盗塁
  if (batOrder === 'steal') {
    s.pending.batting = 'auto'
    const ev = attemptSteal(s, ctx)
    if (ev) return { paEnded: s.finished, event: ev }
  }

  const pitcher = ctx.players[field.pitcherId]!
  const batter = ctx.players[currentBatterId(s)]!
  const full = pitOrder === 'fullpower'
  const pn = pitcherNow(s, ctx, full)
  const bn = batterNow(s, ctx, batOrder)
  addPitch(s, field.pitcherId, pitcher, full)

  // 送りバント
  if (batOrder === 'bunt') return bunt(s, ctx, batter)

  // 1. 配球
  const breaking = pitcher.pitching.pitches.length > 0 && rng.chance(0.42 + (isUser(s, field) && s.pending.plan === 'breaking' ? 0.25 : 0))
  const pitch = breaking ? rng.weighted(pitcher.pitching.pitches.map((x) => ({ value: x, weight: x.level + 1 }))) : null
  const ahead = s.count.strikes > s.count.balls
  let wantBall = rng.chance(s.count.balls === 3 ? 0.08 : s.count.strikes === 2 ? 0.48 : ahead ? 0.4 : s.count.balls > s.count.strikes ? 0.18 : 0.3)
  // 2. 制球
  const missRate = clamp(0.58 - pn.control / 190 + pn.fatigue * 0.14, 0.1, 0.7)
  let inZone = !wantBall
  let meatball = false
  if (rng.chance(missRate)) {
    if (wantBall) inZone = rng.chance(0.5)
    else if (rng.chance(0.65)) inZone = false
    else meatball = true
  }
  // 「ど真ん中癖」は甘い球が増える
  if (!meatball && inZone && has(pitcher, 'meatball') && rng.chance(0.06)) meatball = true
  wantBall = !inZone
  // 配球の方針：内角＝左の列、外角＝右の列、低め＝下の段（打者から見た図）
  const plan = isUser(s, field) ? s.pending.plan : 'auto'
  const planZones = plan === 'inside' ? [0, 3, 6] : plan === 'outside' ? [2, 5, 8] : plan === 'low' ? [6, 7, 8] : [0, 1, 2, 3, 5, 6, 7, 8, 4]
  const zoneIdx = inZone ? (meatball ? 4 : rng.chance(0.75) ? rng.pick(planZones) : rng.pick([0, 1, 2, 3, 5, 6, 7, 8, 4])) : -1
  const zoneBonus = zoneIdx >= 0 ? (batter.batting.zone[zoneIdx] ?? 0) * 6 : 0
  const pitchName = pitch ? pitchLabel(pitch.type) : 'ストレート'
  const speedText = `${Math.round(pitch ? pn.velo - 12 - pitch.level : pn.velo)}km/h`

  // 死球
  if (!inZone && rng.chance(0.012)) {
    s.lastPitch = `${pitchName}が当たった`
    return endPA(s, ctx, 'hbp', 0, null, '死球')
  }

  // 3. 打者の判断
  let swing: boolean
  if (batOrder === 'hitrun') swing = true
  else if (batOrder === 'wait' && s.count.strikes < 2) swing = false
  else if (inZone) {
    swing = rng.chance(clamp(0.66 + (s.count.strikes === 2 ? 0.22 : 0) - (s.count.balls === 3 && s.count.strikes === 0 ? 0.45 : 0) + (meatball ? 0.1 : 0), 0.1, 0.97))
  } else {
    const chase = 0.245 - bn.eye / 300 + (s.count.strikes === 2 ? 0.12 : 0) + (pitch ? pitch.level * 0.018 : 0)
    swing = rng.chance(clamp(chase, 0.04, 0.6))
  }

  if (!swing) {
    if (inZone && !(zoneIdx !== 4 && rng.chance(0.12))) {
      s.count.strikes += 1
      s.lastPitch = `${pitchName} ${speedText}、見逃しストライク`
      if (s.count.strikes >= 3) return endPA(s, ctx, 'strikeout', 0, null, '見逃し三振')
    } else {
      s.count.balls += 1
      s.lastPitch = `${pitchName} ${speedText}、ボール`
      if (s.count.balls >= 4) return endPA(s, ctx, 'walk', 0, null, '四球')
    }
    return { paEnded: false, event: null }
  }

  // 4. 当たり判定
  let stuff = pn.stuff + (pitch ? pitch.level * 3 : 0) - (meatball ? 25 : 0) + (inZone ? 0 : 15)
  if (s.count.strikes === 2 && has(pitcher, 'finisher')) stuff += 10
  const pContact = clamp(0.84 + (bn.contact + zoneBonus - stuff) / 170, 0.45, 0.97) * (inZone ? 1 : 0.8)
  if (!rng.chance(pContact)) {
    s.count.strikes += 1
    s.lastPitch = `${pitchName} ${speedText}、空振り`
    if (s.count.strikes >= 3) return endPA(s, ctx, 'strikeout', 0, null, '空振り三振')
    if (batOrder === 'hitrun' && s.bases[0]) runnerCaughtOnMiss(s, ctx)
    return { paEnded: s.finished, event: null }
  }
  const foulRate = (inZone ? 0.36 : 0.46) + (s.count.strikes === 2 && has(batter, 'persistent') ? 0.12 : 0)
  if (rng.chance(foulRate)) {
    if (s.count.strikes < 2) s.count.strikes += 1
    s.lastPitch = `${pitchName} ${speedText}、ファウル`
    return { paEnded: false, event: null }
  }

  // 5. 打球
  const quality = (bn.power * 0.55 + bn.contact * 0.25 - stuff * 0.3) / 1
  let ev = 108 + quality * 0.55 + (meatball ? 14 : 0) + (inZone ? 0 : -12) + rng.normal(0, 17)
  ev = clamp(ev, 45, 182)
  const trajMean = [0, 2, 8, 13, 18][batter.batting.trajectory] ?? 8
  let la = rng.normal(trajMean, 19)
  if (has(pitcher, 'groundball')) la -= 5
  if (plan === 'low' && zoneIdx >= 6) la -= 6
  if (has(batter, 'double_play')) la -= 4
  if (pitch && (pitch.type === 'sinker' || pitch.type === 'fork' || pitch.type === 'splitter')) la -= 3
  const pullSide = batter.bats === 'L' ? 1 : batter.bats === 'R' ? -1 : (pitcher.throws === 'R' ? 1 : -1)
  const wide = has(batter, 'all_fields')
  const dir = clamp(rng.normal(pullSide * (wide ? 3 : 9), wide ? 25 : 21), -44, 44)

  s.lastPitch = `${pitchName} ${speedText}を打った！`
  // 6. 守備
  return battedBall(s, ctx, batter, ev, la, dir, batOrder)
}

function pitchLabel(t: string): string {
  const map: Record<string, string> = {
    slider: 'スライダー',
    curve: 'カーブ',
    fork: 'フォーク',
    changeup: 'チェンジアップ',
    shoot: 'シュート',
    sinker: 'シンカー',
    cutter: 'カットボール',
    splitter: 'スプリット',
  }
  return map[t] ?? '変化球'
}

function addPitch(s: MatchState, pitcherId: string, p: Player, full: boolean): void {
  const box = s.pitching[pitcherId]!
  box.pitches += 1
  // スタミナが尽きるまでの球数
  const pool = (42 + p.pitching.stamina * 1.15) * (0.6 + (0.4 * p.condition.stamina) / 100)
  let rate = 1 / 35
  if (s.options.summer) rate *= has(p, 'summer_child') ? 0.8 : has(p, 'heat_weak') ? 1.25 : 1
  if (full) rate *= 1.8
  if (has(p, 'tempo')) rate *= 0.88
  box.fatigue = Math.max(0, (box.pitches - pool) * rate)
}

// ---------------------------------------------------------------- 打球の処理

const FIELD_NAMES: Record<Position, string> = {
  P: 'ピッチャー',
  C: 'キャッチャー',
  '1B': 'ファースト',
  '2B': 'セカンド',
  '3B': 'サード',
  SS: 'ショート',
  LF: 'レフト',
  CF: 'センター',
  RF: 'ライト',
}

function groundFielder(dir: number): Position {
  if (dir < -22) return '3B'
  if (dir < 0) return 'SS'
  if (dir < 22) return '2B'
  return '1B'
}

function airFielder(dir: number): Position {
  if (dir < -15) return 'LF'
  if (dir <= 15) return 'CF'
  return 'RF'
}

/** 方向ごとのフェンスまでの距離（両翼92m、中堅118m） */
function fenceAt(dir: number): number {
  return 92 + 26 * Math.cos((dir * Math.PI) / 90)
}

function battedBall(
  s: MatchState,
  ctx: MatchContext,
  batter: Player,
  ev: number,
  la: number,
  dir: number,
  order: BattingOrder,
): PitchResult {
  const rng = ctx.rng
  const field = fieldingTeam(s)
  const speed = batter.running.speed
  const infieldIn = s.pending.shift === 'infieldIn'
  const v = ev / 3.6
  const rad = (Math.max(la, 1) * Math.PI) / 180
  // 飛距離（空気抵抗を大まかに入れた計算。低反発バットを想定して控えめ）
  const carry = clamp(((v * v * Math.sin(2 * rad)) / 9.8) * 0.62, 2, 140)
  const toXY = (d: number) => ({ x: Math.sin((dir * Math.PI) / 180) * d, y: Math.cos((dir * Math.PI) / 180) * d })

  if (la < 10) {
    // ゴロ
    const pos = Math.abs(dir) < 6 && ev < 95 && rng.chance(0.5) ? 'P' : groundFielder(dir)
    const f = ctx.players[fielderAt(field, pos)]!
    let pHit = 0.2 + (ev - 115) / 250 + (speed - 50) / 450 - (f.fielding.range - 50) / 320 + (infieldIn ? 0.07 : 0)
    if (has(f, 'highlight_defense')) pHit -= 0.05
    if (order === 'hitrun') pHit += 0.04
    pHit = clamp(pHit, 0.04, 0.6)
    const ball = { ...toXY(clamp(ev * 0.32, 18, 60)), type: 'ground' as const }
    if (rng.chance(pHit)) {
      const kind: PlayKind = ev > 150 && Math.abs(dir) > 34 && rng.chance(0.35) ? 'double' : 'single'
      const where = kind === 'double' ? `${dir < 0 ? '三塁線' : '一塁線'}を破る` : pos === 'P' ? '内野安打' : `${FIELD_NAMES[pos === '3B' || pos === 'SS' ? 'LF' : pos === '2B' ? 'CF' : 'RF']}前への`
      return hit(s, ctx, kind, ball, kind === 'double' ? `${where}ツーベース` : pos === 'P' ? '内野安打' : `${where}ヒット`, order)
    }
    // エラー
    const pErr = 0.05 + (55 - f.fielding.catching) / 650 + (55 - f.fielding.throwing) / 1000
    if (rng.chance(clamp(pErr, 0.005, 0.12))) {
      field.errors += 1
      return reachOnError(s, ctx, ball, `${FIELD_NAMES[pos]}のエラー`)
    }
    // 併殺
    if (s.bases[0] && s.outs < 2) {
      const pDP = clamp(0.48 + (has(batter, 'double_play') ? 0.15 : 0) - (speed - 50) / 220 - (order === 'hitrun' ? 0.3 : 0) + (ev - 120) / 400, 0.05, 0.8)
      if (rng.chance(pDP)) return doublePlay(s, ctx, ball, `${FIELD_NAMES[pos]}ゴロ、ゲッツー`)
    }
    return groundOut(s, ctx, ball, `${FIELD_NAMES[pos]}ゴロ`, infieldIn, order)
  }

  if (la >= 50) {
    // 内野フライ
    const pos: Position = rng.pick(['C', '1B', '2B', '3B', 'SS'] as Position[])
    return airOut(s, ctx, 'popout', { ...toXY(clamp(carry, 5, 40)), type: 'pop' }, `${FIELD_NAMES[pos]}フライ`, false)
  }

  if (la < 25) {
    // ライナー
    const pos = carry < 40 ? groundFielder(dir) : airFielder(dir)
    const f = ctx.players[fielderAt(field, pos)]!
    let pHit = 0.63 + (ev - 125) / 240 - (f.fielding.range - 50) / 420
    if (has(f, 'highlight_defense')) pHit -= 0.06
    pHit = clamp(pHit, 0.25, 0.9)
    const d = clamp(carry * 1.1, 25, 105)
    const ball = { ...toXY(d), type: 'line' as const }
    if (rng.chance(pHit)) {
      let kind: PlayKind = 'single'
      // 外野の間（左中間・右中間）や線際に飛ぶと長打になりやすい
      const gapBonus = (Math.abs(dir) > 12 && Math.abs(dir) < 30) || Math.abs(dir) > 36 ? 0.14 : 0
      if (carry >= 30 && rng.chance(clamp(0.1 + (ev - 125) / 140 + gapBonus + (speed - 50) / 300, 0.03, 0.6))) kind = 'double'
      if (kind === 'double' && speed >= 65 && rng.chance(0.12)) kind = 'triple'
      const of = FIELD_NAMES[airFielder(dir)]
      const text = kind === 'single' ? `${of}前ヒット` : kind === 'double' ? `${of}へのツーベース` : `${of}へのスリーベース`
      return hit(s, ctx, kind, ball, text, order)
    }
    return airOut(s, ctx, 'lineout', ball, `${FIELD_NAMES[pos]}ライナー`, carry > 50)
  }

  // フライ
  const pos = airFielder(dir)
  const f = ctx.players[fielderAt(field, pos)]!
  const fence = fenceAt(dir)
  const ball = { ...toXY(Math.min(carry, fence + 15)), type: 'fly' as const }
  if (carry >= fence) {
    const where = Math.abs(dir) > 30 ? `${dir < 0 ? 'レフト' : 'ライト'}ポール際` : `${FIELD_NAMES[pos]}スタンド`
    return hit(s, ctx, 'homerun', ball, `${where}へのホームラン！`, order)
  }
  let pHit = 0.14 + Math.max(0, carry - 65) / 110 - (f.fielding.range - 50) / 380
  if (has(f, 'highlight_defense')) pHit -= 0.06
  pHit = clamp(pHit, 0.03, 0.6)
  if (rng.chance(pHit)) {
    let kind: PlayKind = carry > fence * 0.84 ? 'double' : 'single'
    if (kind === 'double' && speed >= 60 && Math.abs(dir) < 25 && rng.chance(0.2)) kind = 'triple'
    const of = FIELD_NAMES[pos]
    const text = kind === 'single' ? `${of}前に落ちるヒット` : kind === 'double' ? `${of}の頭を越えるツーベース` : `${of}オーバーのスリーベース`
    return hit(s, ctx, kind, ball, text, order)
  }
  if (rng.chance(0.012)) {
    field.errors += 1
    return reachOnError(s, ctx, ball, `${FIELD_NAMES[pos]}の落球`)
  }
  return airOut(s, ctx, 'flyout', ball, `${FIELD_NAMES[pos]}フライ`, carry > 60)
}

// ---------------------------------------------------------------- 結果の反映

function runner(ctx: MatchContext, id: string | null): Player | undefined {
  return id ? ctx.players[id] : undefined
}

function hit(s: MatchState, ctx: MatchContext, kind: PlayKind, ball: PlayEvent['ball'], text: string, order: BattingOrder): PitchResult {
  const rng = ctx.rng
  const batterId = currentBatterId(s)
  const [r1, r2, r3] = s.bases
  let runs = 0
  const scored: string[] = []
  let bases: Bases = [null, null, null]
  const fast = (id: string | null, base: number) => {
    const p = runner(ctx, id)
    if (!p) return false
    let pr = base + (p.running.speed - 50) / 120 + (p.running.baserunning - 50) / 200
    if (has(p, 'heads_up')) pr += 0.12
    return rng.chance(clamp(pr, 0.05, 0.97))
  }
  if (kind === 'homerun') {
    for (const r of [r1, r2, r3]) if (r) scored.push(r)
    scored.push(batterId)
    runs = scored.length
  } else if (kind === 'triple') {
    for (const r of [r1, r2, r3]) if (r) scored.push(r)
    bases = [null, null, batterId]
  } else if (kind === 'double') {
    if (r3) scored.push(r3)
    if (r2) scored.push(r2)
    if (r1) {
      if (fast(r1, s.outs === 2 ? 0.55 : 0.4)) scored.push(r1)
      else bases[2] = r1
    }
    bases[1] = batterId
  } else {
    // シングル
    if (r3) scored.push(r3)
    if (r2) {
      if (fast(r2, s.outs === 2 ? 0.72 : 0.55)) scored.push(r2)
      else bases[2] = r2
    }
    if (r1) {
      if (!bases[2] && fast(r1, order === 'hitrun' ? 0.6 : 0.28)) bases[2] = r1
      else bases[1] = r1
    }
    bases[0] = batterId
  }
  runs = scored.length
  s.bases = bases
  const t = battingTeam(s)
  t.hits += 1
  const box = s.batting[batterId]!
  box.h += 1
  if (kind === 'double') box.d += 1
  if (kind === 'triple') box.t += 1
  if (kind === 'homerun') box.hr += 1
  s.pitching[fieldingTeam(s).pitcherId]!.h += 1
  if (kind === 'homerun') s.pitching[fieldingTeam(s).pitcherId]!.hr += 1
  return endPA(s, ctx, kind, runs, ball, text, scored)
}

function reachOnError(s: MatchState, ctx: MatchContext, ball: PlayEvent['ball'], text: string): PitchResult {
  const [r1, r2, r3] = s.bases
  const scored: string[] = []
  if (r3) scored.push(r3)
  const bases: Bases = [currentBatterId(s), r1, r2]
  s.bases = bases
  return endPA(s, ctx, 'error', scored.length, ball, text, scored, true)
}

function doublePlay(s: MatchState, ctx: MatchContext, ball: PlayEvent['ball'], text: string): PitchResult {
  const [, r2, r3] = s.bases
  s.outs += 2
  const scored: string[] = []
  // 3アウト目でなければ、三塁走者は生還し、二塁走者は三塁へ
  if (s.outs < 3 && r3) scored.push(r3)
  s.bases = s.outs < 3 ? [null, null, r2] : [null, null, null]
  return endPA(s, ctx, 'doubleplay', scored.length, ball, text, scored, true)
}

function groundOut(s: MatchState, ctx: MatchContext, ball: PlayEvent['ball'], text: string, infieldIn: boolean, order: BattingOrder): PitchResult {
  const rng = ctx.rng
  const [r1, r2, r3] = s.bases
  s.outs += 1
  const scored: string[] = []
  let bases: Bases = [null, null, null]
  if (s.outs < 3) {
    // 三塁走者：前進守備なら本塁で刺されやすい
    if (r3) {
      if (rng.chance(infieldIn ? 0.22 : r1 && r2 ? 0.0 : 0.55)) scored.push(r3)
      else bases[2] = r3
    }
    if (r2) {
      if (!bases[2]) bases[2] = r2
      else bases[1] = r2
    }
    if (r1) bases[1] = bases[1] ?? r1
    if (order === 'hitrun' && r1 && !bases[1]) bases[1] = r1
    // 満塁などで押し出された場合
    if (r1 && r2 && r3 && !scored.includes(r3)) {
      // フォースアウトは本塁で取った扱い：走者はそのまま、打者が一塁
      bases = [currentBatterId(s), r2 ? r1 : null, r2]
      return endPA(s, ctx, 'fielderschoice', 0, ball, `${text}、本塁フォースアウト`, [], true)
    }
  }
  s.bases = bases
  return endPA(s, ctx, 'groundout', scored.length, ball, text, scored, true)
}

function airOut(s: MatchState, ctx: MatchContext, kind: PlayKind, ball: PlayEvent['ball'], text: string, deep: boolean): PitchResult {
  const rng = ctx.rng
  s.outs += 1
  const scored: string[] = []
  const [r1, r2, r3] = s.bases
  if (s.outs < 3 && kind === 'flyout' && r3) {
    const p = runner(ctx, r3)!
    if (rng.chance(clamp((deep ? 0.75 : 0.35) + (p.running.speed - 50) / 150, 0.05, 0.97))) {
      scored.push(r3)
      s.bases = [r1, r2, null]
      if (deep && r2 && rng.chance(0.4)) s.bases = [r1, null, r2]
      return endPA(s, ctx, 'sacfly', 1, ball, `${text}、犠牲フライ`, scored, false, true)
    }
  }
  return endPA(s, ctx, kind, 0, ball, text, [], true)
}

function bunt(s: MatchState, ctx: MatchContext, batter: Player): PitchResult {
  const rng = ctx.rng
  s.pending.batting = 'auto'
  let pSuccess = 0.72 + (has(batter, 'bunt') ? 0.15 : 0) + (batter.batting.contact - 50) / 300 - (has(batter, 'sign_lost') ? 0.15 : 0)
  pSuccess = clamp(pSuccess, 0.35, 0.95)
  const r = rng.next()
  if (r < pSuccess) {
    // 成功：走者が進み、打者はアウト（まれに内野安打）
    if (rng.chance(0.06 + (batter.running.speed - 50) / 500)) {
      s.bases = [currentBatterId(s), s.bases[0], s.bases[1]]
      return endPA(s, ctx, 'single', 0, { x: 0, y: 15, type: 'ground' }, 'セーフティバント成功！', [], false)
    }
    const scored: string[] = []
    const [r1, r2, r3] = s.bases
    s.outs += 1
    if (r3 && s.outs < 3) scored.push(r3)
    s.bases = [null, r1, r2]
    return endPA(s, ctx, 'sacbunt', scored.length, { x: rng.chance(0.5) ? -8 : 8, y: 14, type: 'ground' }, '送りバント成功', scored, false, true)
  }
  if (r < pSuccess + 0.15 && s.count.strikes < 2) {
    s.count.strikes += 1
    s.lastPitch = 'バントはファウル'
    s.pending.batting = 'bunt'
    return { paEnded: false, event: null }
  }
  if (s.count.strikes >= 2) return endPA(s, ctx, 'strikeout', 0, null, 'スリーバント失敗、三振')
  // 失敗：先の走者がフォースアウト
  s.outs += 1
  const lead = s.bases[1] ? 1 : 0
  if (lead === 1) s.bases = [currentBatterId(s), s.bases[0], s.bases[2]]
  else s.bases = [currentBatterId(s), s.bases[1], s.bases[2]]
  return endPA(s, ctx, 'buntfail', 0, { x: 0, y: 12, type: 'ground' }, 'バント失敗、先の走者がアウト', [], true)
}

function attemptSteal(s: MatchState, ctx: MatchContext): PlayEvent | null {
  const rng = ctx.rng
  const field = fieldingTeam(s)
  let from: 0 | 1
  if (s.bases[0] && !s.bases[1]) from = 0
  else if (s.bases[1] && !s.bases[2]) from = 1
  else return null
  const id = s.bases[from]!
  const r = ctx.players[id]!
  const catcher = ctx.players[fielderAt(field, 'C')]!
  const pitcher = ctx.players[field.pitcherId]!
  let p = 0.6 + (r.running.steal - 50) / 160 + (r.running.speed - 50) / 220 - (catcher.fielding.arm - 50) / 220 - (pitcher.pitching.quick - 50) / 300
  if (has(r, 'rocket_start')) p += 0.1
  if (has(pitcher, 'no_steal')) p -= 0.1
  if (from === 1) p -= 0.08
  p = clamp(p, 0.15, 0.95)
  s.pitching[field.pitcherId]!.pitches += 1
  const success = rng.chance(p)
  s.bases[from] = null
  if (success) {
    s.bases[from === 0 ? 1 : 2] = id
    s.batting[id] && (s.batting[id]!.sb += 1)
    if (s.count.balls < 3) s.count.balls += 1
  } else {
    s.outs += 1
    s.pitching[field.pitcherId]!.outs += 1
  }
  const ev = makeEvent(s, ctx, id, success ? 'steal' : 'caughtstealing', `${name(ctx, id)}、${from === 0 ? '二盗' : '三盗'}${success ? '成功！' : '失敗'}`, 0)
  s.events.push(ev)
  s.lastPitch = ev.text
  if (s.outs >= 3) endHalfInning(s, ctx)
  return ev
}

function runnerCaughtOnMiss(s: MatchState, ctx: MatchContext): void {
  const id = s.bases[0]
  if (!id || s.bases[1]) return
  const r = ctx.players[id]!
  if (ctx.rng.chance(clamp(0.55 - (r.running.speed - 50) / 150, 0.15, 0.8))) {
    s.bases[0] = null
    s.outs += 1
    s.pitching[fieldingTeam(s).pitcherId]!.outs += 1
    s.events.push(makeEvent(s, ctx, id, 'caughtstealing', `${name(ctx, id)}、エンドランで飛び出しアウト`, 0))
    if (s.outs >= 3) endHalfInning(s, ctx)
  } else {
    s.bases[0] = null
    s.bases[1] = id
  }
}

function makeEvent(s: MatchState, ctx: MatchContext, batterId: string, kind: PlayKind, text: string, runs: number, ball?: PlayEvent['ball']): PlayEvent {
  return {
    inning: s.inning,
    top: s.top,
    batterId,
    pitcherId: fieldingTeam(s).pitcherId,
    kind,
    text,
    runs,
    ball,
    outsAfter: s.outs,
    basesAfter: [...s.bases],
    scoreAfter: score(s),
  }
}

/** 打席の終わり：記録をつけ、次の打者へ */
function endPA(
  s: MatchState,
  ctx: MatchContext,
  kind: PlayKind,
  runs: number,
  ball: PlayEvent['ball'] | null,
  text: string,
  scored: string[] = [],
  isOut = false,
  sacrifice = false,
): PitchResult {
  const bat = battingTeam(s)
  const field = fieldingTeam(s)
  const batterId = currentBatterId(s)
  const box = s.batting[batterId]!
  const pbox = s.pitching[field.pitcherId]!
  box.pa += 1

  if (kind === 'walk' || kind === 'hbp') {
    box.bb += 1
    if (kind === 'walk') pbox.bb += 1
    // 押し出しを含む進塁（詰まっている塁だけ進む）
    const [r1, r2, r3] = s.bases
    if (!r1) s.bases = [batterId, r2, r3]
    else if (!r2) s.bases = [batterId, r1, r3]
    else if (!r3) s.bases = [batterId, r1, r2]
    else {
      scored.push(r3)
      s.bases = [batterId, r1, r2]
    }
    runs = scored.length
  } else if (!sacrifice) {
    box.ab += 1
  }
  if (kind === 'strikeout') {
    box.k += 1
    pbox.k += 1
    s.outs += 1
    isOut = true
  }
  if (kind === 'doubleplay') pbox.outs += 1
  if (isOut || kind === 'strikeout' || kind === 'sacbunt' || kind === 'sacfly' || kind === 'fielderschoice' || kind === 'buntfail') pbox.outs += 1

  // 打点と得点
  if (kind !== 'error' && kind !== 'doubleplay') box.rbi += runs
  for (const id of scored) {
    const b = s.batting[id]
    if (b) b.r += 1
  }
  pbox.r += runs
  addRuns(s, runs)

  const ev = makeEvent(s, ctx, batterId, kind, `${name(ctx, batterId)}：${text}`, runs, ball ?? undefined)
  s.events.push(ev)
  if (s.events.length > 400) s.events.splice(0, s.events.length - 400)
  s.lastPitch = ev.text

  // 次の打者
  s.count = { balls: 0, strikes: 0 }
  s.pending = { batting: 'auto', pitching: 'auto', plan: s.pending.plan, shift: s.pending.shift }
  bat.battingIndex = (bat.battingIndex + 1) % 9

  checkWalkoff(s)
  if (!s.finished && s.outs >= 3) endHalfInning(s, ctx)
  return { paEnded: true, event: ev }
}

function addRuns(s: MatchState, runs: number): void {
  if (runs <= 0) return
  const bat = battingTeam(s)
  const before = score(s)
  bat.runsByInning[bat.runsByInning.length - 1]! += runs
  const after = score(s)
  // 勝ち越し・逆転を記録
  const leadBefore = Math.sign(before[0] - before[1])
  const leadAfter = Math.sign(after[0] - after[1])
  if (leadAfter !== 0 && leadAfter !== leadBefore) {
    const team = leadAfter > 0 ? 'away' : 'home'
    s.leadChange = { team, pitcherOfLoser: fieldingTeam(s).pitcherId, pitcherOfWinner: battingTeam(s).pitcherId }
  }
}

function checkWalkoff(s: MatchState): void {
  const [a, h] = score(s)
  if (!s.top && s.inning >= s.options.innings && h > a) finish(s, 'home')
}

function finish(s: MatchState, winner: 'away' | 'home' | null): void {
  s.finished = true
  s.winner = winner
  if (winner && s.leadChange && s.leadChange.team === winner) {
    s.winningPitcherId = s.leadChange.pitcherOfWinner
    s.losingPitcherId = s.leadChange.pitcherOfLoser
  }
}

function endHalfInning(s: MatchState, ctx: MatchContext): void {
  const [a, h] = score(s)
  const inn = s.inning
  // コールドゲーム
  for (const [mInn, diff] of s.options.mercy) {
    if (inn >= mInn) {
      if (!s.top && Math.abs(a - h) >= diff) return finish(s, a > h ? 'away' : 'home')
      if (s.top && h - a >= diff) return finish(s, 'home')
    }
  }
  if (s.top) {
    // 最終回の表が終わって後攻がリードしていれば試合終了
    if (inn >= s.options.innings && h > a) return finish(s, 'home')
    s.top = false
  } else {
    if (inn >= s.options.innings && a !== h) return finish(s, a > h ? 'away' : 'home')
    if (inn >= 25) return finish(s, null)
    s.top = true
    s.inning += 1
  }
  s.outs = 0
  s.bases = [null, null, null]
  s.count = { balls: 0, strikes: 0 }
  s.pending = { batting: 'auto', pitching: 'auto', plan: 'auto', shift: 'normal' }
  battingTeam(s).runsByInning.push(0)
  // タイブレーク：前の2人を一・二塁に置いて始める
  if (s.inning >= s.options.tiebreakFrom) {
    const t = battingTeam(s)
    const prev1 = t.lineup[(t.battingIndex + 8) % 9]!.playerId
    const prev2 = t.lineup[(t.battingIndex + 7) % 9]!.playerId
    s.bases = [prev1, prev2, null]
    s.lastPitch = `${s.inning}回${s.top ? '表' : '裏'}、タイブレーク（無死一・二塁）から開始`
  }
  void ctx
}

// ---------------------------------------------------------------- まとめて進める

/** 1打席進める */
export function simulatePlateAppearance(s: MatchState, ctx: MatchContext): PlayEvent | null {
  let guard = 0
  while (!s.finished && guard++ < 40) {
    const r = simulatePitch(s, ctx)
    if (r.paEnded) return r.event
  }
  return null
}

/** 試合終了まで進める（CPU同士の試合や、スキップ） */
export function simulateToEnd(s: MatchState, ctx: MatchContext): void {
  let guard = 0
  while (!s.finished && guard++ < 3000) simulatePitch(s, ctx)
  if (!s.finished) finish(s, null)
}

export function positionName(pos: FieldPos): string {
  return pos === 'DH' ? '指名打者' : POSITION_NAME[pos]
}
