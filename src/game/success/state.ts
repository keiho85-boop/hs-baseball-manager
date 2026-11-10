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

/** 告白が成功する評価の目安（5段階の4以上） */
export const CONFESS_LINE = 60

/** 自動で進む週（年末と春休み）。1年を約40ターンにする */
export const AUTO_WEEKS = [38, 39, 51, 52]

export function newSuccessState(): SuccessState {
  return {
    focusId: null,
    eval: { nagi: 50, makabe: 40, hasumi: 30, daichi: 55, team: 40, genzo: 30, scout: 10 },
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

/** ナギと大地の評価が告白の目安を超えているか */
export function canConfess(save: SaveData): boolean {
  const s = successOf(save)
  return !!s && s.dating === null && s.eval.nagi >= CONFESS_LINE && s.eval.daichi >= CONFESS_LINE
}

/** フォーカス選手の練習の伸びの倍率（捕手の大地がいるので、投手は少し育てやすい） */
export function focusGrowthMult(save: SaveData, p: Player): number {
  const s = successOf(save)
  if (!s || s.focusId !== p.id) return 1
  return p.mainPosition === 'P' ? 1.45 : 1.35
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
  return clamp((s.eval.scout - 35) / 45 + (playerRating(p) - 55) / 80, 0, 0.97)
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
