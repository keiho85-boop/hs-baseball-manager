// サクセス（1人の選手を3年間育てる遊び方）の共通の処理
// 構想書18節：フォーカス選手・周りからの評価・部の評判・スカウトの評価とドラフト

import { Rng, clamp } from '../rng'
import { rankOf } from '../constants'
import { fullName, playerRating } from '../player'
import type { MatchState } from '../match/types'
import type { Player, SaveData } from '../types'
import type { EvalKey, SuccessState } from './types'

export const EVAL_KEYS: EvalKey[] = ['nagi', 'makabe', 'hasumi', 'daichi', 'team', 'genzo', 'scout']

export const EVAL_LABEL: Record<EvalKey, string> = {
  nagi: 'ナギ',
  makabe: '真壁',
  hasumi: '蓮見',
  daichi: '大地',
  team: 'チームメイト',
  genzo: '源造',
  scout: 'スカウト',
}

/** 評価が主に影響すること（画面の説明） */
export const EVAL_NOTE: Record<EvalKey, string> = {
  nagi: 'マネージャーとの信頼',
  makabe: '顧問の期待',
  hasumi: '体のケア',
  daichi: '幼馴染との絆',
  team: '部の仲間からの信頼',
  genzo: '商店会の応援',
  scout: 'プロからの注目',
}

/** 告白が成功する評価の目安（ナギと大地の両方が、5段階の3の後半以上。意識して上げる必要がある） */
export const CONFESS_LINE = 65

/** 自動で進む週（年末と春休み）。1年を約40ターンにする */
export const AUTO_WEEKS = [38, 39, 51, 52]

export function newSuccessState(): SuccessState {
  return {
    focusId: null,
    // はじめはみんな、まだこの部を知らない（評価は低いところから）
    eval: { nagi: 40, makabe: 30, hasumi: 25, daichi: 40, team: 30, genzo: 25, scout: 10 },
    clubs: [],
    visits: {},
    talks: {},
    joined: {},
    failStreak: 0,
    recruitStreak: 0,
    scoutFocus: false,
    dating: null,
    ended: null,
  }
}

// ---------------------------------------------------------------- 夏合宿の行き先（部費でグレードを上げる）

export interface CampPlace {
  name: string
  /** 合宿中の練習の効果の倍率 */
  mult: number
  /** このグレードに上げるのにかかる部費（万円） */
  cost: number
  note: string
}

/** 合宿の行き先。どこも海の近く（浜辺のイベントが起きる） */
export const CAMP_PLACES: CampPlace[] = [
  { name: '海辺の民宿', mult: 1.35, cost: 0, note: '安さが取り柄。グラウンドは近所の空き地' },
  { name: '海の見える合宿所', mult: 1.5, cost: 40, note: '専用のグラウンドと、広いお風呂がある' },
  { name: 'リゾートの合宿プラン', mult: 1.65, cost: 80, note: '室内練習場つき。食事も豪華' },
  { name: 'プロも使うキャンプ地', mult: 1.8, cost: 120, note: 'プロ球団が春季キャンプで使う施設' },
]

/** その年の合宿の行き先（選んでいなければ、いちばん安い民宿） */
export function campLevel(save: SaveData): number {
  const c = successOf(save)?.campChoice
  if (!c || c.year !== save.calendar.year) return 0
  return Math.max(0, Math.min(CAMP_PLACES.length - 1, c.level))
}
/** 夏合宿が始まる週（3年目は夏の大会の前） */
export function campStartWeek(save: SaveData): number {
  return save.calendar.year === 3 ? 12 : 18
}
export function campPlaceName(save: SaveData): string {
  return CAMP_PLACES[campLevel(save)]!.name
}
/** 合宿中の練習の効果の倍率（チーム育成モードは1.35倍のまま） */
export function campMultiplier(save: SaveData): number {
  return successOf(save) ? CAMP_PLACES[campLevel(save)]!.mult : 1.35
}

/** サクセスで遊んでいるときの状態（そうでなければ null） */
export function successOf(save: Pick<SaveData, 'story'>): SuccessState | null {
  const st = save.story
  return st?.enabled && st.success ? st.success : null
}

/** フォーカス選手（育てる選手） */
export function focusPlayer(save: SaveData): Player | null {
  const s = successOf(save)
  return s?.focusId ? (save.players[s.focusId] ?? null) : null
}

/** 評価の5段階（1〜5） */
export function evalStars(v: number): number {
  return clamp(Math.floor(v / 20) + 1, 1, 5)
}

/** 評価を上げ下げする。戻り値は画面に出す知らせ（変わらなければ null） */
export function addEval(save: SaveData, key: EvalKey, delta: number): string | null {
  const s = successOf(save)
  if (!s || delta === 0) return null
  const before = s.eval[key]
  s.eval[key] = clamp(Math.round(before + delta), 0, 100)
  if (s.eval[key] === before) return null
  return `${EVAL_LABEL[key]}の評価が${delta > 0 ? '上がった' : '下がった'}`
}

/** 部の評判の段階（E〜S） */
export function repRank(rep: number): string {
  const r = rankOf(rep)
  return r === 'F' || r === 'G' ? 'E' : r
}

/** 試合に出られる部員の数（助っ人を除く） */
export function rosterCount(save: SaveData): number {
  const own = save.schools[save.playerSchoolId]
  if (!own) return 0
  return own.playerIds.map((id) => save.players[id]).filter((p) => p && !p.retired && !p.helper).length
}

/**
 * 選手育成モードで、この大会を棄権するか。
 * 部員が9人に満たないとき、そして1年目の春の県大会（部員がそろう前にエントリーが締め切られた、というストーリー）
 */
export function mustForfeit(save: SaveData, kind: string): 'short' | 'story' | null {
  if (!successOf(save)) return null
  if (save.calendar.year === 1 && kind === 'springPref') return 'story'
  return rosterCount(save) < 9 ? 'short' : null
}

/** ナギと大地の評価が告白の目安を超えているか */
export function canConfess(save: SaveData): boolean {
  const s = successOf(save)
  return !!s && s.dating === null && s.eval.nagi >= CONFESS_LINE && s.eval.daichi >= CONFESS_LINE
}

/** フォーカス選手の練習の伸びの倍率（捕手の大地がいるので、投手は少し育てやすい） */
export function focusGrowthMult(save: SaveData, p: Player): number {
  const s = successOf(save)
  if (!s) return 1
  if (s.focusId !== p.id) return teamGrowthMult(save)
  return p.mainPosition === 'P' ? 1.45 : 1.35
}

/**
 * 選手育成モード：育成選手以外の部員の伸びの倍率。
 * チームメイトの評価（部の雰囲気）が高いほど、みんなの練習の効率が上がる（★1で1.15倍〜★5で1.43倍）
 */
export function teamGrowthMult(save: SaveData): number {
  const s = successOf(save)
  if (!s) return 1
  return 1.15 + 0.07 * (evalStars(s.eval.team) - 1)
}

/** 試合が終わったとき：勝敗とフォーカス選手の活躍で評価を動かす。戻り値は知らせ */
export function evalAfterMatch(save: SaveData, m: MatchState, official: boolean, won: boolean | null): string[] {
  const s = successOf(save)
  if (!s) return []
  const out: (string | null)[] = []
  const own = save.schools[save.playerSchoolId]
  if (won === true) {
    out.push(addEval(save, 'team', official ? 2 : 1))
    out.push(addEval(save, 'makabe', 1))
    if (official) out.push(addEval(save, 'genzo', 2))
    else if (own) own.reputation = clamp(own.reputation + 1, 0, 100)
  } else if (won === false) {
    const ownHome = m.home.schoolId === save.playerSchoolId
    const runs = (t: MatchState['home']) => t.runsByInning.reduce((a, b) => a + b, 0)
    const diff = runs(ownHome ? m.away : m.home) - runs(ownHome ? m.home : m.away)
    out.push(addEval(save, 'team', official && diff >= 7 ? -2 : -1))
  }
  // フォーカス選手の活躍
  const id = s.focusId
  if (id) {
    const b = m.batting[id]
    const pi = m.pitching[id]
    let score = 0
    if (b) score += b.h * 1 + b.hr * 2 + b.rbi * 0.5 + b.bb * 0.3 - (b.ab >= 3 && b.h === 0 ? 1 : 0)
    if (pi && pi.outs > 0) score += pi.outs / 6 + pi.k * 0.2 - pi.r * 0.5
    if (score >= 2) {
      out.push(addEval(save, 'scout', official ? Math.min(5, Math.round(score)) : 1))
      out.push(addEval(save, 'nagi', 1))
    } else if (official && score < 0) {
      out.push(addEval(save, 'scout', -1))
    }
  }
  return out.filter((x): x is string => !!x)
}

/** ドラフト：フォーカス選手はスカウトの評価で指名が決まる（能力が低くても、評価が良ければ指名もある） */
export function focusDraftChance(save: SaveData, p: Player): number {
  const s = successOf(save)
  if (!s) return 0
  // スカウトの評価が90以上なら、必ず指名される
  if (s.eval.scout >= 90) return 1
  // それより下は、スカウトの評価と能力の両方で決まる（どちらかが高ければ望みはある。能力C〜Bでも十分狙える）
  return clamp((s.eval.scout - 20) / 70 + (playerRating(p) - 55) / 50, 0, 0.92)
}

/** フォーカス選手の名前（台本の置き換え用） */
export function focusName(save: SaveData): { surname: string; full: string } {
  const p = focusPlayer(save)
  return p ? { surname: p.surname, full: fullName(p) } : { surname: '幼馴染', full: '幼馴染' }
}

/** 新年度の新入部員の数（評判で決まる） */
export function successFreshmen(rng: Rng, rep: number): number {
  return clamp(Math.round(1 + rep / 15 + rng.int(-1, 1)), 1, 7)
}
