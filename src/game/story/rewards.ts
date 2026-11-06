// 実績と衣装

import type { StoryState } from './types'

/** 実績を加える。初めてなら知らせの文を返す */
export function addAchievement(st: StoryState, name: string): string[] {
  if (st.achievements.includes(name)) return []
  st.achievements.push(name)
  return [`実績「${name}」を達成した！`]
}

/** 衣装を加える。初めてなら知らせの文を返す */
export function addCostume(st: StoryState, name: string): string[] {
  if (st.costumes.includes(name)) return []
  st.costumes.push(name)
  return [`ナギの衣装「${name}」を手に入れた！`]
}
