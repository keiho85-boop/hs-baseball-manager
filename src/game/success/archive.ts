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
