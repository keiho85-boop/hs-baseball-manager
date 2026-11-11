// 選手育成モード：試合での活躍に応じた育成選手の成長と、結果に応じた特殊能力の付与・取り消し
// （活躍するほど大きく伸び、振るわなければ伸びは小さい。強振で三振を重ねると「扇風機」がつく、など）

import { Rng, clamp } from '../rng'
import { ABILITY_LABEL } from '../events'
import { getSkill, conflicts } from '../skills'
import type { MatchState, PlayEvent } from '../match/types'
import type { Player, SaveData } from '../types'
import { successOf } from './state'

const HIT = ['single', 'double', 'triple', 'homerun']

/** 試合での活躍の点数（評価にも使う） */
export function focusScore(m: MatchState, id: string): number {
  const b = m.batting[id]
  const pi = m.pitching[id]
  let score = 0
  if (b) score += b.h * 1 + b.hr * 2 + b.rbi * 0.5 + b.bb * 0.3 + b.sb * 0.4 - b.k * 0.3 - (b.ab >= 3 && b.h === 0 ? 1 : 0)
  if (pi && pi.outs > 0) score += pi.outs / 6 + pi.k * 0.2 - pi.r * 0.5 - pi.bb * 0.15
  return score
}

function bump(p: Player, key: string, n: number): boolean {
  const [group, k] = key.split('.') as [string, string]
  const obj = (p as unknown as Record<string, Record<string, number>>)[group]
  if (!obj || typeof obj[k] !== 'number') return false
  const max = key === 'pitching.velocity' ? 163 : 99
  const before = obj[k]
  obj[k] = clamp(before + n, 1, max)
  return obj[k] !== before
}

function goodCount(p: Player): number {
  return p.skills.filter((id) => getSkill(id)?.good).length
}

/** 特殊能力をつける（反対の能力を持っていればつかない。良い能力は5つまで） */
function addSkill(p: Player, id: string): boolean {
  const def = getSkill(id)
  if (!def || p.skills.includes(id)) return false
  if (p.skills.some((o) => conflicts(o, id))) return false
  if (def.good && goodCount(p) >= 5) return false
  p.skills.push(id)
  return true
}
function removeSkill(p: Player, id: string): boolean {
  if (!p.skills.includes(id)) return false
  p.skills = p.skills.filter((x) => x !== id)
  return true
}

/**
 * 試合のあと：育成選手の活躍で能力の伸びが変わり、結果によって特殊能力がついたり消えたりする。
 * 返り値はお知らせの文
 */
export function focusMatchGrowth(save: SaveData, m: MatchState, rng: Rng, official: boolean): string[] {
  const s = successOf(save)
  const id = s?.focusId
  const p = id ? save.players[id] : undefined
  if (!s || !id || !p) return []
  const b = m.batting[id]
  const pi = m.pitching[id]
  const played = (b && b.pa > 0) || (pi && pi.outs + pi.pitches > 0)
  if (!played) return []
  const out: string[] = []
  const name = p.surname

  // ---- 能力の伸び：活躍の点数で量が変わる（公式戦は多め）
  const score = focusScore(m, id)
  const points = clamp(Math.round((official ? 1.4 : 1) * (1.5 + score)), 0, 7)
  const weights: { key: string; w: number }[] = []
  if (b && b.pa > 0) {
    weights.push({ key: 'batting.contact', w: 1 + b.h })
    weights.push({ key: 'batting.power', w: 0.6 + (b.d + b.t) * 0.8 + b.hr * 2 })
    weights.push({ key: 'batting.eye', w: 0.4 + b.bb })
    weights.push({ key: 'running.speed', w: 0.4 + b.sb * 0.6 })
    if (b.sb > 0) weights.push({ key: 'running.steal', w: b.sb })
  }
  if (pi && pi.outs > 0) {
    weights.push({ key: 'pitching.control', w: 1 + Math.max(0, 3 - pi.bb) * 0.5 })
    weights.push({ key: 'pitching.kire', w: 0.6 + pi.k * 0.25 })
    weights.push({ key: 'pitching.stamina', w: 0.4 + pi.outs / 9 })
    weights.push({ key: 'pitching.velocity', w: 0.3 })
  }
  const grown: Record<string, number> = {}
  for (let i = 0; i < points && weights.length; i++) {
    const k = rng.weighted(weights.map((x) => ({ value: x.key, weight: x.w })))
    if (bump(p, k, 1)) grown[k] = (grown[k] ?? 0) + 1
  }
  const labels = Object.entries(grown).map(([k, n]) => `${ABILITY_LABEL[k] ?? k}+${n}`)
  if (labels.length) out.push(`${score >= 2 ? '大活躍！' : score >= 0.5 ? '試合の経験で、' : '悔しさをばねに、'}${name}の能力が伸びた（${labels.join('・')}）`)
  else out.push(`${name}は、この試合ではあまり経験を積めなかった…`)

  // ---- 特殊能力：結果に応じて、つく・消える
  const mine = m.events.filter((e) => e.batterId === id)
  const pas = mine.filter((e) => !['steal', 'caughtstealing'].includes(e.kind))
  const ks = pas.filter((e) => e.kind === 'strikeout').length
  const swings = pas.filter((e) => e.order === 'swing').length
  const hits = pas.filter((e) => HIT.includes(e.kind)).length
  const clutchHits = pas.filter((e) => e.chance && HIT.includes(e.kind) && e.runs > 0).length
  const chanceOuts = pas.filter((e) => e.chance && !HIT.includes(e.kind) && !['walk', 'hbp', 'sacfly', 'sacbunt'].includes(e.kind)).length
  const dps = pas.filter((e) => e.kind === 'doubleplay').length
  const bunts = pas.filter((e: PlayEvent) => e.kind === 'sacbunt').length
  const buntFails = pas.filter((e) => e.kind === 'buntfail').length
  const steals = mine.filter((e) => e.kind === 'steal').length
  const caught = mine.filter((e) => e.kind === 'caughtstealing').length

  const gain = (skill: string, chance: number, why: string): void => {
    if (rng.chance(chance) && addSkill(p, skill)) {
      const def = getSkill(skill)!
      out.push(def.good ? `${why}${name}は特殊能力「${def.name}」を身につけた！` : `${why}${name}に弱点「${def.name}」がついてしまった…`)
    }
  }
  const lose = (skill: string, chance: number, why: string): void => {
    if (p.skills.includes(skill) && rng.chance(chance) && removeSkill(p, skill)) {
      const def = getSkill(skill)!
      out.push(def.good ? `${why}${name}の特殊能力「${def.name}」が消えてしまった…` : `${why}${name}は弱点「${def.name}」を克服した！`)
    }
  }

  if (pas.length > 0) {
    // 扇風機：強振で三振を重ねるとつく。三振せずに打てば消える
    if (ks >= 2 && ks * 2 >= pas.length && swings >= 1) gain('fan', 0.35 + swings * 0.1, '強振で空振りを重ね、')
    if (ks === 0 && hits >= 2) lose('fan', 0.5, 'しっかりバットに当て、')
    // チャンスに強い／弱い
    if (clutchHits >= 2) gain('late_hero', 0.4, 'チャンスで打ちまくり、')
    if (clutchHits >= 1 && pas.some((e) => e.chance && e.kind === 'homerun')) gain('bases_loaded', 0.3, '走者を返す一発で、')
    if (chanceOuts >= 3 && clutchHits === 0) lose('late_hero', 0.3, 'チャンスで打てず、')
    // 併殺
    if (dps >= 2) gain('double_play', 0.4, '併殺を重ね、')
    if (dps === 0 && hits >= 2) lose('double_play', 0.4, '鋭い打球を飛ばし、')
    // バント
    if (bunts >= 1 && pas.some((e) => e.kind === 'sacbunt' && (e.order === 'bunt' || e.order === 'squeeze'))) gain('bunt', 0.25, 'サインどおりに決め、')
    if (buntFails >= 1) gain('sign_lost', 0.3, 'サインを決めきれず、')
    if (bunts >= 1 && buntFails === 0) lose('sign_lost', 0.4, 'サインを確実にこなし、')
    // 粘り（四球が多い）・初球から打つ
    if (b && b.bb >= 2) gain('persistent', 0.25, 'しぶとく粘り、')
    if (pas.filter((e) => HIT.includes(e.kind)).length >= 3) gain('momentum', 0.2, '固め打ちで、')
  }
  // 盗塁
  if (steals >= 2) gain('rocket_start', 0.4, '次々と塁を盗み、')
  if (caught >= 2) lose('rocket_start', 0.4, '盗塁を刺され続け、')

  // 投手
  if (pi && pi.outs > 0) {
    if (pi.k >= 8) gain('finisher', 0.35, '三振を量産し、')
    if (pi.hr >= 2) gain('meatball', 0.35, '長打を浴び、')
    if (pi.r === 0 && pi.outs >= 15) lose('meatball', 0.5, '長打を許さず、')
    if (pi.outs >= 27 && pi.r <= 2) {
      gain('gear_change', 0.3, '最後まで投げ抜き、')
      lose('out_of_gas', 0.5, '最後まで球威が落ちず、')
    }
    if (pi.bb >= 5) gain('glass_heart', 0.25, '四球から崩れ、')
    if (pi.bb === 0 && pi.outs >= 15) lose('glass_heart', 0.4, '最後まで落ち着いて投げ、')
  }
  return out
}
