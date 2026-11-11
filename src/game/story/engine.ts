// ストーリーの進行：次に流す場面を決め、見終わったら効果を反映する

import { POSITION_NAME } from '../constants'
import { Rng } from '../rng'
import { skylightsName } from '../scout'
import type { SaveData } from '../types'
import { CHAPTER1 } from './chapter1'
import { activeOwn, captain, inBracket, month, ownName, ownWins, pendingGame, reachedBest4, schoolName, year } from './query'
import type { ChoiceStep, Scene, Step, StoryContext, StoryState } from './types'
import { focusName, newSuccessState, rosterCount, successOf } from '../success/state'
import { playerRating } from '../player'

export const SCENES: Scene[] = [...CHAPTER1]

/** 章の名前 */
export const CHAPTER_TITLES: Record<number, string> = {
  1: '第1章「ナギ現役編」',
}

/** 場面タイトルの上に出す時期（「第1章　1年目 5月」など） */
export function sceneSub(save: SaveData, scene: Scene): string {
  if (scene.sub !== undefined) return scene.sub
  return `第${scene.chapter}章　${year(save)}年目 ${month(save)}月`
}

function ctxOf(save: SaveData, st: StoryState): StoryContext {
  return { save, st, rng: new Rng(save.rngState) }
}

/** 大会の結果から、章の記録（初勝利・ベスト4・全国出場）を更新する。変わったら true */
export function observeStory(save: SaveData): boolean {
  const st = save.story
  if (!st?.enabled) return false
  const own = save.playerSchoolId
  let changed = false
  // 以前のセーブ：日向大地をストーリーの主要人物にしておく（ケガをせず、転向の対象にならない）
  const d = st.daichiId ? save.players[st.daichiId] : undefined
  if (d && !d.storyCast) {
    d.storyCast = 'daichi'
    changed = true
  }
  // 以前の版（サクセスになる前）のセーブ：一番いい選手を育てる選手にして、1年目の場面は見たことにする
  if (!st.success) {
    st.success = newSuccessState()
    const own = save.schools[save.playerSchoolId]
    const best = (own?.playerIds ?? []).map((id) => save.players[id]).filter((p) => p && !p.retired && !p.helper && p.id !== st.daichiId).sort((a, b) => playerRating(b!) - playerRating(a!))[0]
    if (best) {
      st.success.focusId = best.id
      best.storyCast = best.storyCast ?? 'focus'
    }
    for (const sc of SCENES) if (sc.id !== 'c1_sotsugyou' && save.calendar.year > 1 && !st.seen.includes(sc.id) && /^c1_(ano|mezame|goukaku|nyugaku|kanyu|hokenshitsu|9nin|ryugamine|sofu|fuyu)/.test(sc.id)) st.seen.push(sc.id)
    if (rosterCount(save) >= 9) st.flags.join9 = save.calendar.year
    changed = true
  }
  const set = (key: string, value: string | number | boolean): void => {
    if (st.flags[key] === undefined) {
      st.flags[key] = value
      changed = true
    }
  }
  for (const t of save.tournaments ?? []) {
    const national = t.kind === 'summerNational' || t.kind === 'springNational'
    if (ownWins(t, own) > 0) set('firstWin', t.year)
    if (!national && reachedBest4(t, own)) set('best4', t.year)
    // 全国出場：夏の県大会で優勝した時点、または全国大会の組み合わせに入った時点
    const appeared = national ? inBracket(t, own) : t.kind === 'summerPref' && t.championId === own
    if (appeared) {
      set('national', t.year)
      const key = `national_${t.year}_${t.kind === 'summerPref' ? 'summerNational' : t.kind}`
      if (st.flags[key] === undefined) {
        st.flags[key] = true
        st.flags.nationalCount = Number(st.flags.nationalCount ?? 0) + 1
        changed = true
      }
    }
    // ライバル校と公式戦で当たったか
    if (st.rivalId) {
      const met = t.rounds.some((games) => games.some((g) => g.winner && !g.bye && (g.a === own || g.b === own) && (g.a === st.rivalId || g.b === st.rivalId)))
      if (met) set(`metRival_${t.year}`, true)
    }
  }
  return changed
}

/** 次に流す場面（なければ null） */
export function nextScene(save: SaveData): Scene | null {
  const st = save.story
  if (!st?.enabled) return null
  const ctx = ctxOf(save, st)
  for (const sc of SCENES) {
    if (sc.chapter !== st.chapter) continue
    if (st.seen.includes(sc.id)) continue
    if (sc.when(ctx)) return sc
  }
  return null
}

/** 台詞の {学校名} などを置き換える */
export function varsOf(save: SaveData, st: StoryState): Record<string, string> {
  const list = activeOwn(save)
  const cap = captain(save, st)
  const pending = pendingGame(save)
  const freshman = list.filter((p) => p.grade === 1 && p.id !== st.daichiId && !p.helper)[0]
  return {
    学校名: ownName(save),
    主将: cap ? cap.surname : '主将',
    相手校: schoolName(save, pending?.opponentId),
    部員数: String(list.filter((p) => !p.helper).length),
    新入生: freshman ? freshman.surname : '新入生',
    ライバル: schoolName(save, st.rivalId),
    球団: teamName(save.prefCode),
    フォーカス: focusName(save).surname,
    フォーカス名: focusName(save).full,
    フォーカス守備: (() => {
      const id = st.success?.focusId
      const f = id ? save.players[id] : undefined
      return f ? POSITION_NAME[f.mainPosition] : '内野'
    })(),
  }
}

/** 鬼頭鉄郎が率いたプロ球団の名前（選んだ都道府県の名前を冠する） */
export function teamName(prefCode: number): string {
  return skylightsName(prefCode)
}

function fill(text: string, vars: Record<string, string>): string {
  return text.replace(/\{([^}]+)\}/g, (m, k: string) => vars[k] ?? m)
}

function fillSteps(steps: Step[], vars: Record<string, string>): Step[] {
  return steps.map((s) => {
    if (s.kind === 'say') return { ...s, name: fill(s.name, vars), text: fill(s.text, vars) }
    if (s.kind === 'narr') return { ...s, text: fill(s.text, vars) }
    if (s.kind === 'title') return { ...s, text: fill(s.text, vars), sub: s.sub === undefined ? undefined : fill(s.sub, vars) }
    if (s.kind === 'choice') {
      return { ...s, options: s.options.map((o) => ({ ...o, label: fill(o.label, vars), reply: fillSteps(o.reply, vars) })) }
    }
    return s
  })
}

/** 場面の台本を作る（置き換え済み） */
export function buildSteps(save: SaveData, scene: Scene): Step[] {
  const st = save.story!
  return fillSteps(scene.steps(ctxOf(save, st)), varsOf(save, st))
}

/**
 * 場面を見終わったときの処理：選択の効果と場面の効果を反映し、見終わった印を付ける。
 * picks は、台本の中の選択に順に答えた番号。戻り値は画面に出す知らせ
 */
export function completeScene(save: SaveData, scene: Scene, steps: Step[], picks: number[]): string[] {
  const st = save.story!
  const ctx = ctxOf(save, st)
  const messages: string[] = []
  const choices: ChoiceStep[] = []
  const collect = (list: Step[], pickIndex: { i: number }): void => {
    for (const s of list) {
      if (s.kind !== 'choice') continue
      choices.push(s)
      const opt = s.options[picks[pickIndex.i] ?? 0] ?? s.options[0]
      pickIndex.i += 1
      if (opt) collect(opt.reply, pickIndex)
    }
  }
  collect(steps, { i: 0 })
  choices.forEach((c, i) => {
    const opt = c.options[picks[i] ?? 0] ?? c.options[0]
    const r = opt?.apply?.(ctx)
    if (r) messages.push(...r)
  })
  const r = scene.onEnd?.(ctx)
  if (r) messages.push(...r)
  if (!st.seen.includes(scene.id)) st.seen.push(scene.id)
  save.rngState = ctx.rng.getState()
  return messages
}

/** 画面の操作で起きる出来事の印（スカウトを初めて開いた、など） */
export function markStory(save: SaveData, key: string): boolean {
  const st = save.story
  if (!st?.enabled || st.flags[key] !== undefined) return false
  st.flags[key] = save.calendar.year
  return true
}

/** 試合が終わったときの記録（練習試合の結果、ライバル校との対戦） */
export function noteMatch(save: SaveData, info: { practice: boolean; won: boolean | null; opponentId: string }): void {
  const st = save.story
  if (!st?.enabled) return
  if (info.practice) {
    if (st.flags.firstPractice === undefined) st.flags.firstPractice = info.won === true ? 'win' : 'lose'
  }
  // テニス部のエースは、試合で1勝するまで話を聞いてくれない（練習試合でも公式戦でもよい）
  if (info.won === true && st.flags.practiceWin === undefined) st.flags.practiceWin = save.calendar.year
  if (st.rivalId && info.opponentId === st.rivalId) {
    st.flags[`metRival_${save.calendar.year}`] = true
    // 2年目の龍ヶ峰との練習試合（申し込まれた試合）の結果
    if (info.practice && st.flags.rivalOffer !== undefined && st.flags.rivalPractice === undefined) st.flags.rivalPractice = info.won === true ? 'win' : 'lose'
  }
}

export { addAchievement, addCostume } from './rewards'

/** 第1章の成績の段階：0 なし、1 公式戦1勝、2 県ベスト4、3 全国大会出場 */
const LEVEL_NAME = ['', '公式戦1勝', '県ベスト4', '全国大会出場', '全国大会に連続出場']

/** 第1章の目標と、今年の目安（目安を先に超えたら、次の年の目安は一つ上になる） */
export function chapterGoal(save: SaveData): { goal: string; target: string; done: boolean } | null {
  const st = save.story
  if (!st?.enabled || st.chapter !== 1) return null
  // サクセス：まずは9人。そろったら、プロ入り（ドラフト指名）を目指す
  if (successOf(save)) {
    if (st.flags.join9 === undefined) return { goal: 'プロ入り', target: `部員を9人に（いま${rosterCount(save)}人）`, done: false }
  }
  const y = save.calendar.year
  const best = st.flags.national !== undefined ? 3 : st.flags.best4 !== undefined ? 2 : st.flags.firstWin !== undefined ? 1 : 0
  const base = Math.min(3, y)
  // 去年までに出した最高成績より、一つ上を今年の目安にする
  const before = (key: string): boolean => {
    const v = st.flags[key]
    return typeof v === 'number' && v < y
  }
  const bestBefore = before('national') ? 3 : before('best4') ? 2 : before('firstWin') ? 1 : 0
  const level = Math.min(4, Math.max(base, bestBefore + 1))
  const done =
    level === 4
      ? st.flags[`national_${y}_summerNational`] !== undefined || st.flags[`national_${y}_springNational`] !== undefined
      : best >= level
  return { goal: '3年目の夏までに全国大会出場', target: LEVEL_NAME[level]!, done }
}
