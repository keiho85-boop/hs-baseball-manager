// ストーリーの進行：次に流す場面を決め、見終わったら効果を反映する

import { Rng } from '../rng'
import { skylightsName } from '../scout'
import type { SaveData } from '../types'
import { CHAPTER1 } from './chapter1'
import { activeOwn, captain, inBracket, month, ownName, ownWins, pendingGame, reachedBest4, schoolName, year } from './query'
import type { ChoiceStep, Scene, Step, StoryContext, StoryState } from './types'

export const SCENES: Scene[] = [...CHAPTER1]

/** 章の名前 */
export const CHAPTER_TITLES: Record<number, string> = {
  1: '第1章「再建」',
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
  if (st.rivalId && info.opponentId === st.rivalId) st.flags[`metRival_${save.calendar.year}`] = true
}

export { addAchievement, addCostume } from './rewards'
