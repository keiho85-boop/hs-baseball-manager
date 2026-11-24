// 固有キャラの特殊能力（構想書・特殊能力の設計 11月19日）
// ・入部したとき、その人の守備位置に合う「その人の能力」を1つ持っている
// ・キャラ別イベントの最終話で正解を選ぶと、もう一方（投手なら投手用、野手なら野手用）の能力が取れることがある
// ・「別の道」の結末では、関係のある普通の能力が取れることがある

import type { Player } from '../types'
import { conflicts, getSkill, grantSkill } from '../skills'

/** キャラごとの能力（野手用・投手用、別の道の野手用・投手用、全員共通の能力） */
export interface CharSkillSet {
  fielder: string
  pitcher: string
  altFielder: string
  altPitcher: string
  /** 投手・野手に関係なく取れる、その人の能力（三木・東雲） */
  common?: string
  /** 入部したときに本人が持つ能力（省略すると、本人の守備位置に合う fielder / pitcher） */
  join?: string
  /** 育成選手が捕手のときに、最終話の正解で取れる能力（省略すると fielder） */
  catcher?: string
}

export const CHAR_SKILLS: Record<string, CharSkillSet> = {
  sumo: { fielder: 'upper_swing', pitcher: 'rikito', altFielder: 'gap_power', altPitcher: 'sokojikara' },
  soccer: { fielder: 'supercar', pitcher: 'last_spurt', altFielder: 'rocket_start', altPitcher: 'gear_change' },
  shogi: { fielder: 'senryo', pitcher: 'all_in', altFielder: 'late_hero', altPitcher: 'kyuen' },
  tennis: { fielder: 'shikaku', pitcher: 'makaiten', altFielder: 'persistent', altPitcher: 'denka' },
  // 11月19日：育成選手が投手のときは内野ゴロ量産（別の終わり方は能力アップのみ）。岩城本人は鉄球を持つ
  rikujo: { fielder: 'sniper', pitcher: 'groundball', altFielder: 'good_throw', altPitcher: '', join: 'tekkyu' },
  takkyu: { fielder: 'seiiki', pitcher: 'fuiuchi', altFielder: 'highlight_defense', altPitcher: 'no_steal' },
  shinbun: { fielder: 'shingan', pitcher: 'checkmate', altFielder: 'miwame', altPitcher: 'finisher', common: 'renshu_oni' },
  seitokai: { fielder: 'pillar', pitcher: 'ace', altFielder: 'bench_sun', altPitcher: 'heijoshin', common: 'charisma' },
  // 11月25日：育成選手が捕手のときは、捕手の最上位の能力「扇の要」。大地本人は下剋上を持つ
  daichi: { fielder: 'gekokujo', pitcher: 'ouja', altFielder: 'counterattack', altPitcher: 'pinch_ace', catcher: 'ougi', join: 'gekokujo' },
  tenkosei: { fielder: 'moda', pitcher: 'game_maker', altFielder: 'momentum', altPitcher: 'recover' },
}

/** その人の今の守備位置に合う能力 */
export function charSkillFor(key: string, p: Player, alt = false): string | undefined {
  const set = CHAR_SKILLS[key]
  if (!set) return undefined
  const pitcher = p.mainPosition === 'P'
  if (!alt && p.mainPosition === 'C' && set.catcher) return set.catcher
  const id = alt ? (pitcher ? set.altPitcher : set.altFielder) : pitcher ? set.pitcher : set.fielder
  return id || undefined
}

/** 入部したときに、その人の能力を持たせる */
export function grantJoinSkill(key: string, p: Player): string | undefined {
  const id = CHAR_SKILLS[key]?.join ?? charSkillFor(key, p)
  if (!id || p.skills.includes(id)) return undefined
  // ぶつかる良い能力があれば外して付ける（弱点は grantSkill が外す）
  p.skills = p.skills.filter((x) => !conflicts(x, id) || !getSkill(x)?.good)
  return grantSkill(p, id) ? id : undefined
}
