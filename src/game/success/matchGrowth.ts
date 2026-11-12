// 選手育成モード：試合での活躍に応じた育成選手の成長と、結果に応じた特殊能力の付与・取り消し
// （活躍するほど大きく伸び、振るわなければ伸びは小さい。強振で三振を重ねると「扇風機」がつく、など）

import { Rng, clamp } from '../rng'
import { ABILITY_LABEL } from '../events'
import { getSkill, conflicts } from '../skills'
import type { MatchState, PlayEvent } from '../match/types'
import type { Player, SaveData } from '../types'
import { raiseAbility } from '../player'
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
  // 才能の上限（＋5）までしか上がらない
  return raiseAbility(p, key, n)
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

  // ---- 能力の伸び：伸びる項目は完全にランダム。量は、勝ち上がるほど・活躍するほど多い
  const score = focusScore(m, id)
  // 試合の重み：練習試合0.6、公式戦は初戦1.0から1回戦ごとに+0.3、全国大会はさらに+0.8
  const t = m.options?.tournament ? (save.tournaments ?? []).find((x) => x.id === m.options?.tournament!.id) : undefined
  const national = t ? t.kind === 'summerNational' || t.kind === 'springNational' : false
  const stage = !official ? 0.6 : 1 + (m.options?.tournament?.round ?? 0) * 0.3 + (national ? 0.8 : 0)
  // 活躍の倍率：振るわなければ0.4倍、ふつうで1倍、大活躍で2倍まで
  const perf = clamp(0.7 + score * 0.3, 0.4, 2)
  const raw = stage * perf
  const points = clamp(Math.floor(raw) + (rng.chance(raw - Math.floor(raw)) ? 1 : 0), 0, 6)
  const pool =
    p.mainPosition === 'P'
      ? ['pitching.velocity', 'pitching.control', 'pitching.stamina', 'pitching.kire', 'pitching.quick', 'pitching.pinch']
      : ['batting.contact', 'batting.power', 'batting.eye', 'running.speed', 'running.steal', 'running.baserunning', 'fielding.arm', 'fielding.range', 'fielding.catching', 'fielding.throwing']
  const grown: Record<string, number> = {}
  for (let i = 0; i < points; i++) {
    const k = rng.pick(pool)
    if (bump(p, k, 1)) grown[k] = (grown[k] ?? 0) + 1
  }
  const labels = Object.entries(grown).map(([k, n]) => `${ABILITY_LABEL[k] ?? k}+${n}`)
  if (labels.length) out.push(`${score >= 2 ? '大活躍！' : score >= 0.5 ? '試合の経験で、' : '悔しさをばねに、'}${name}の能力が伸びた（${labels.join('・')}）`)
  else if (points > 0) out.push(`${name}は試合の経験を積んだ（能力が上がるまで、あと少し）`)
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
