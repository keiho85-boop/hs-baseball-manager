// 1週間の成長を比べて、画面の演出用にまとめる

import type { Player } from './types'

export interface GrowthChange {
  label: string
  before: number
  after: number
  unit?: string
}

export interface GrowthEntry {
  playerId: string
  name: string
  changes: GrowthChange[]
}

const TRACKED: { label: string; get: (p: Player) => number; unit?: string }[] = [
  { label: 'ミート', get: (p) => p.batting.contact },
  { label: 'パワー', get: (p) => p.batting.power },
  { label: '弾道', get: (p) => p.batting.trajectory },
  { label: '選球眼', get: (p) => p.batting.eye },
  { label: '走力', get: (p) => p.running.speed },
  { label: '盗塁', get: (p) => p.running.steal },
  { label: '走塁判断', get: (p) => p.running.baserunning },
  { label: '肩力', get: (p) => p.fielding.arm },
  { label: '守備範囲', get: (p) => p.fielding.range },
  { label: '捕球', get: (p) => p.fielding.catching },
  { label: '送球', get: (p) => p.fielding.throwing },
  { label: '球速', get: (p) => p.pitching.velocity, unit: 'km/h' },
  { label: 'コントロール', get: (p) => p.pitching.control },
  { label: 'スタミナ', get: (p) => p.pitching.stamina },
  { label: 'キレ', get: (p) => p.pitching.kire },
  { label: 'クイック', get: (p) => p.pitching.quick },
  { label: 'ケガしにくさ', get: (p) => p.common.durability },
  { label: '回復力', get: (p) => p.common.recovery },
]

export type Snapshot = Map<string, number[]>

export function takeSnapshot(players: Player[]): Snapshot {
  return new Map(players.map((p) => [p.id, TRACKED.map((t) => t.get(p))]))
}

export function diffSnapshot(before: Snapshot, players: Player[]): GrowthEntry[] {
  const result: GrowthEntry[] = []
  for (const p of players) {
    const prev = before.get(p.id)
    if (!prev) continue
    const changes: GrowthChange[] = []
    TRACKED.forEach((t, i) => {
      const now = t.get(p)
      if (now > prev[i]!) changes.push({ label: t.label, before: prev[i]!, after: now, unit: t.unit })
    })
    if (changes.length > 0) result.push({ playerId: p.id, name: `${p.surname} ${p.givenName}`, changes })
  }
  // 伸びが大きい選手から順に
  return result.sort(
    (a, b) =>
      b.changes.reduce((s, c) => s + c.after - c.before, 0) - a.changes.reduce((s, c) => s + c.after - c.before, 0),
  )
}
