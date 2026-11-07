// 一定の期間だけ効く補正（台風の座学で作戦が決まりやすくなる、OB戦の悔しさで練習に身が入る、など）

import type { Modifier, SaveData } from './types'

/** 通算の週（(年-1)×52＋週） */
export function absWeek(save: Pick<SaveData, 'calendar'>, year = save.calendar.year, week = save.calendar.week): number {
  return (year - 1) * 52 + week
}

/** いま効いている補正 */
export function activeModifiers(save: SaveData, key: Modifier['key']): Modifier[] {
  const now = absWeek(save)
  return (save.modifiers ?? []).filter((m) => m.key === key && (m.from ?? 0) <= now && m.until >= now)
}

export function hasModifier(save: SaveData, key: Modifier['key']): boolean {
  return activeModifiers(save, key).length > 0
}

/** 試合を始めたとき：「次の1試合だけ」の補正を使い切る */
export function consumeOnce(save: SaveData, key: Modifier['key']): void {
  const now = absWeek(save)
  save.modifiers = (save.modifiers ?? []).filter((m) => !(m.key === key && m.once && (m.from ?? 0) <= now && m.until >= now))
}

/** 期限の切れた補正を消す（毎週） */
export function pruneModifiers(save: SaveData): void {
  if (!save.modifiers) return
  const now = absWeek(save)
  save.modifiers = save.modifiers.filter((m) => m.until >= now)
}

/** 作戦（バント・盗塁・エンドラン）の成功率の上乗せ */
export const TACTIC_BONUS = 0.1
/** 練習の効果の上乗せ */
export const PRACTICE_BONUS = 0.1
