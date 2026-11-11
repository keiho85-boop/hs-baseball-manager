// サクセスで育ててプロ入りした選手の保存と、シナリオの解禁（セーブ枠とは別に、端末に残す）
// のちに「育成選手だけでチームを作る」「対戦」に使う

import { playerRating } from '../player'
import type { Player } from '../types'

const KEY_PLAYERS = 'hsbm:success:players'
const KEY_UNLOCK = 'hsbm:success:unlocked'

export interface SavedPlayer {
  /** 保存した日時 */
  savedAt: string
  scenario: number
  /** 総合評価（0〜100） */
  rating: number
  team: string
  round: number
  player: Player
}

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

export function listSavedPlayers(): SavedPlayer[] {
  try {
    const raw = storage()?.getItem(KEY_PLAYERS)
    return raw ? (JSON.parse(raw) as SavedPlayer[]) : []
  } catch {
    return []
  }
}

/** プロ入りした選手を保存する（同じ選手は上書き） */
export function savePlayer(p: Player, scenario: number): void {
  const st = storage()
  if (!st) return
  const list = listSavedPlayers().filter((x) => x.player.id !== p.id || x.scenario !== scenario)
  list.push({
    savedAt: new Date().toISOString(),
    scenario,
    rating: playerRating(p),
    team: p.drafted?.team ?? '',
    round: p.drafted?.round ?? 0,
    player: structuredClone(p),
  })
  try {
    st.setItem(KEY_PLAYERS, JSON.stringify(list))
  } catch {
    // 端末の容量が足りないときは保存しない
  }
}

export function unlockedScenarios(): number[] {
  try {
    const raw = storage()?.getItem(KEY_UNLOCK)
    return raw ? (JSON.parse(raw) as number[]) : [1]
  } catch {
    return [1]
  }
}

export function unlockScenario(n: number): void {
  const st = storage()
  if (!st) return
  const list = new Set(unlockedScenarios())
  list.add(n)
  try {
    st.setItem(KEY_UNLOCK, JSON.stringify([...list].sort((a, b) => a - b)))
  } catch {
    // 保存できなくても遊びは続けられる
  }
}

// ---------------------------------------------------------------- ドリームチーム（育成選手だけのオーダー）

const KEY_DREAM = 'hsbm:success:dream'

/** 保存した選手を見分ける印（選手のidはゲームごとに重なることがあるので、保存日時と組み合わせる） */
export function savedUid(x: SavedPlayer): string {
  return `${x.savedAt}|${x.player.id}`
}

export type DreamPos = 'C' | '1B' | '2B' | '3B' | 'SS' | 'LF' | 'CF' | 'RF' | 'DH'

export interface DreamTeam {
  /** 打順（1番から9番）。uid は保存した選手の印、空きは null */
  order: { uid: string | null; pos: DreamPos }[]
  /** 先発投手 */
  pitcher: string | null
}

export const DREAM_POSITIONS: DreamPos[] = ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH']

export function emptyDreamTeam(): DreamTeam {
  return { order: (['CF', '2B', 'SS', '1B', 'RF', '3B', 'LF', 'C', 'DH'] as DreamPos[]).map((pos) => ({ uid: null, pos })), pitcher: null }
}

export function loadDreamTeam(): DreamTeam {
  try {
    const raw = storage()?.getItem(KEY_DREAM)
    const t = raw ? (JSON.parse(raw) as DreamTeam) : null
    if (t && Array.isArray(t.order) && t.order.length === 9) return t
  } catch {
    // 読めなければ空から
  }
  return emptyDreamTeam()
}

export function saveDreamTeam(t: DreamTeam): void {
  try {
    storage()?.setItem(KEY_DREAM, JSON.stringify(t))
  } catch {
    // 保存できなくても画面では使える
  }
}

/** おまかせ：投手はいちばん評価の高い投手、野手は評価の高い順に、得意な守備位置へ */
export function autoDreamTeam(list: SavedPlayer[]): DreamTeam {
  const sorted = [...list].sort((a, b) => b.rating - a.rating)
  const pitcher = sorted.find((x) => x.player.mainPosition === 'P') ?? null
  const fielders = sorted.filter((x) => x !== pitcher)
  const t = emptyDreamTeam()
  const used = new Set<string>()
  const apt = (x: SavedPlayer, pos: DreamPos): number => (pos === 'DH' ? 1 : (x.player.fielding.aptitude[pos] ?? 0))
  // 守備位置ごとに、適性のある中でいちばん評価の高い選手を当てる（捕手・遊撃から先に決める）
  const ordered: DreamPos[] = ['C', 'SS', '2B', 'CF', '3B', '1B', 'LF', 'RF', 'DH']
  const pick: Partial<Record<DreamPos, string>> = {}
  const OF = ['LF', 'CF', 'RF']
  const isMain = (x: SavedPlayer, pos: DreamPos): boolean =>
    x.player.mainPosition === pos || (OF.includes(pos) && OF.includes(x.player.mainPosition))
  const tries: ((x: SavedPlayer, pos: DreamPos) => boolean)[] = [isMain, (x, pos) => apt(x, pos) >= 2, () => true]
  // 1巡目は本職、2巡目は適性のある位置、3巡目は空いている位置に、評価の高い順で入れる
  for (const ok of tries) {
    for (const pos of ordered) {
      if (pick[pos]) continue
      const best = fielders.find((x) => !used.has(savedUid(x)) && ok(x, pos))
      if (!best) continue
      used.add(savedUid(best))
      pick[pos] = savedUid(best)
    }
  }
  t.order = t.order.map((o) => ({ pos: o.pos, uid: pick[o.pos] ?? null }))
  t.pitcher = pitcher ? savedUid(pitcher) : null
  return t
}
