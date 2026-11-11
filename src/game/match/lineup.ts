// オーダーの自動編成（CPUの学校と、自校の「おまかせ」で使う）

import { fielderRating, pitcherRating } from '../player'
import type { LineupConfig, Player, Position } from '../types'

const APT_FACTOR = [0.62, 0.84, 0.94, 1.0]
/** 守備の要から順に埋める */
const FILL_ORDER: Position[] = ['C', 'SS', '2B', 'CF', '3B', 'RF', 'LF', '1B']
export const BENCH_SIZE = 11

/** 試合に出られる選手か */
export function available(p: Player): boolean {
  return !p.retired && !p.condition.injury
}

/** 投手として起用できるか */
export function canPitch(p: Player): boolean {
  return available(p) && !p.pitchingRetired
}

/** 先発投手としての評価（疲れ・球数・肩肘の不安を考える） */
export function starterScore(p: Player): number {
  if (!canPitch(p)) return -999
  let s = pitcherRating(p) + (p.mainPosition === 'P' ? 8 : -12)
  s -= Math.max(0, 70 - p.condition.stamina) * 0.6
  s -= p.weeklyPitches * 0.06
  if (p.condition.armIssue) s -= 25
  return s
}

function batScore(p: Player): number {
  const b = p.batting
  return b.contact * 0.45 + b.power * 0.35 + b.eye * 0.1 + p.running.speed * 0.1
}

export function autoLineup(players: Player[], wantDH: boolean): LineupConfig {
  let pool = players.filter(available)
  // ケガ人が多くて9人に満たないときは、ケガをしている選手も出場させる
  if (pool.length < 9) pool = players.filter((p) => !p.retired)
  // DHは投手＋打者9人の10人が必要。足りなければDHなしで組む
  const useDH = wantDH && pool.length >= 10
  const pitcherList = [...pool].filter(canPitch).sort((a, b) => starterScore(b) - starterScore(a))
  const starter = pitcherList[0] ?? pool[0]!

  const used = new Set<string>([starter.id])
  const positions = new Map<Position | 'DH', Player>()
  if (!useDH) positions.set('P', starter)

  for (const pos of FILL_ORDER) {
    let best: Player | null = null
    let bestScore = -Infinity
    for (const p of pool) {
      if (used.has(p.id)) continue
      const apt = p.fielding.aptitude[pos]
      // 捕手は適性がないと務まらない
      const factor = pos === 'C' && apt === 0 ? 0.3 : APT_FACTOR[apt]!
      // 本職の投手はなるべく野手に回さない
      const pitcherPenalty = p.mainPosition === 'P' ? 0.8 : 1
      const score = fielderRating(p) * factor * pitcherPenalty
      if (score > bestScore) {
        best = p
        bestScore = score
      }
    }
    if (best) {
      positions.set(pos, best)
      used.add(best.id)
    }
  }
  if (useDH) {
    const dh = pool.filter((p) => !used.has(p.id)).sort((a, b) => batScore(b) - batScore(a))[0]
    if (dh) {
      positions.set('DH', dh)
      used.add(dh.id)
    }
  }

  // 打順
  const hitters = [...positions.entries()]
    .filter(([pos]) => pos !== 'P')
    .map(([position, p]) => ({ position, p }))
  // 部員が9人に満たないときは、打者が足りないぶん空いたまま組む
  const take = (score: (p: Player) => number) => {
    hitters.sort((a, b) => score(b.p) - score(a.p))
    return hitters.shift()
  }
  const order: { position: Position | 'DH'; p: Player }[] = []
  const third = take(batScore)
  const fourth = take((p) => p.batting.power * 0.7 + p.batting.contact * 0.3)
  const first = take((p) => p.running.speed * 0.45 + p.batting.contact * 0.35 + p.batting.eye * 0.2)
  const second = take((p) => p.batting.contact * 0.6 + p.batting.eye * 0.2 + p.running.speed * 0.2)
  const fifth = take((p) => p.batting.power * 0.6 + p.batting.contact * 0.4)
  for (const o of [first, second, third, fourth, fifth]) if (o) order.push(o)
  hitters.sort((a, b) => batScore(b.p) - batScore(a.p))
  order.push(...hitters)
  if (!useDH) order.push({ position: 'P', p: starter })

  // ベンチ：控え投手を必ず入れる
  const rest = pool.filter((p) => !used.has(p.id))
  const benchPitchers = rest.filter(canPitch).sort((a, b) => pitcherRating(b) - pitcherRating(a)).slice(0, 4)
  const benchOthers = rest
    .filter((p) => !benchPitchers.includes(p))
    .sort((a, b) => Math.max(fielderRating(b), batScore(b)) - Math.max(fielderRating(a), batScore(a)))
  const bench = [...benchPitchers, ...benchOthers].slice(0, BENCH_SIZE).map((p) => p.id)

  return {
    batters: order.slice(0, 9).map((o) => ({ playerId: o.p.id, position: o.position })),
    startingPitcherId: starter.id,
    bench,
    useDH,
  }
}

/** 保存しているオーダーが今も使えるか（ケガ・引退・卒業で崩れていないか） */
export function lineupValid(lineup: LineupConfig, players: Record<string, Player>): boolean {
  const ids = lineup.batters.map((b) => b.playerId)
  if (ids.length !== 9 || new Set(ids).size !== 9) return false
  // スタメンと先発投手は出られる選手であること（控えにケガ人がいても、オーダーは有効。試合では外す）
  for (const id of [...ids, lineup.startingPitcherId]) {
    const p = players[id]
    if (!p || !available(p)) return false
  }
  const starter = players[lineup.startingPitcherId]
  if (!starter || !canPitch(starter)) return false
  const positions = lineup.batters.map((b) => b.position)
  const needed: (Position | 'DH')[] = ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', lineup.useDH ? 'DH' : 'P']
  return needed.every((pos) => positions.includes(pos))
}
