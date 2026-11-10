// ゲームの状態を画面に渡すストア
// セーブデータは選手が数千人いて大きいため、Vueの自動追跡（リアクティブ）には入れず、
// 変更したときに rev を増やして画面に再描画を知らせる

import { defineStore } from 'pinia'
import { markRaw, ref, shallowRef } from 'vue'
import { createNewGame, type NewGameInput } from '@/game/world'
import { advanceWeek, type WeekResult } from '@/game/season'
import { clearMatch, deleteSlot, listSlots, readMatch, readSave, requestPersistentStorage, writeMatch, writeSave } from '@/game/storage'
import { Rng } from '@/game/rng'
import { finishMatch as finishMatchLogic, startMatch, type FinishResult } from '@/game/match/session'
import {
  changePitcher as changePitcherLogic,
  simulatePitch,
  simulatePlateAppearance,
  simulateToEnd,
  substitute as substituteLogic,
  type MatchContext,
} from '@/game/match/engine'
import type { MatchState } from '@/game/match/types'
import { exportToBlob, importFromBlob } from '@/game/serialize'
import { diffSnapshot, takeSnapshot, type GrowthEntry } from '@/game/growth'
import { ensureSugoroku, playCard } from '@/game/sugoroku'
import { applyOps, buildEvent } from '@/game/events'
import { type VisitResult, ensureScout, scoutRecruit as scoutRecruitLogic, scoutVisit as scoutVisitLogic } from '@/game/scout'
import {
  TOURNAMENT_SPECS,
  facilityCost,
  currentTournament,
  ensureDetailed,
  ensureTournament,
  ownAlive,
  pendingOwnGame,
  recordOwnResult,
  roundName,
} from '@/game/tournament'
import type { LineupConfig, Player, SaveData, SaveSummary, School, SquareType } from '@/game/types'
import { setupStoryWorld } from '@/game/story/setup'
import { setFictionalPlaces } from '@/game/constants'
import { buildSteps, completeScene, markStory, nextScene, noteMatch, observeStory } from '@/game/story/engine'
import type { Scene, Step } from '@/game/story/types'
import { evalAfterMatch, rosterCount, successOf } from '@/game/success/state'
import { recruit as recruitLogic, type RecruitResult } from '@/game/success/clubs'
import type { ClubId } from '@/game/success/types'

export const useGameStore = defineStore('game', () => {
  const save = shallowRef<SaveData | null>(null)
  const rev = ref(0)
  const slots = ref<(SaveSummary | null)[]>([null, null, null])
  const busy = ref(false)
  const lastResult = ref<WeekResult | null>(null)
  const persistent = ref<boolean | null>(null)
  /** 直前の週に伸びた選手（成長の演出に使う） */
  const lastGrowth = ref<GrowthEntry[]>([])
  const showGrowth = ref(false)
  /** 成長の知らせの見出し（練習の成果／試合の経験 など） */
  const growthTitle = ref('練習の成果！')
  /** 途中の試合（選手が多いセーブ本体とは別に、小さく保存する）。
   * 試合の状態は小さいので、Vueの自動追跡に入れて画面がそのまま追従するようにする */
  const match = ref<MatchState | null>(null)
  const matchRev = ref(0)
  let matchRng: Rng | null = null
  /** 月が変わってすごろくの盤面が新しくなったとき、その月（ホームで演出を出す） */
  const boardNotice = ref<number | null>(null)
  /** いま流しているストーリーの場面（台本は置き換え済み） */
  const story = shallowRef<{ scene: Scene; steps: Step[] } | null>(null)

  /** 1週間進めたあとの共通処理：盤面が新しくなった知らせは、文字ではなく演出で出す */
  function afterWeek(result: WeekResult): WeekResult {
    const i = result.messages.findIndex((m) => m.includes('練習の盤面が新しくなった'))
    if (i >= 0) {
      result.messages.splice(i, 1)
      boardNotice.value = save.value?.sugoroku?.boardMonth ?? null
    }
    return result
  }

  function touch(): void {
    rev.value += 1
  }

  async function refreshSlots(): Promise<void> {
    slots.value = await listSlots()
  }

  async function ensurePersistence(): Promise<void> {
    if (persistent.value === null) persistent.value = await requestPersistentStorage()
  }

  async function startNewGame(input: Omit<NewGameInput, 'seed'> & { story?: boolean; focusName?: { surname: string; givenName: string } }): Promise<void> {
    busy.value = true
    try {
      await ensurePersistence()
      // 少し待って画面に「作成中」を表示してから重い処理をする
      await new Promise((r) => setTimeout(r, 30))
      // 選手育成モード（ストーリーあり）は、地名をすべて架空のものにする
      setFictionalPlaces(!!input.story)
      const data = createNewGame({ ...input, seed: (Math.random() * 2 ** 32) >>> 0 })
      if (input.story) setupStoryWorld(data, { focusName: input.focusName })
      ensureSugoroku(data)
      {
        const rng = new Rng(data.rngState)
        ensureScout(data, rng)
        data.rngState = rng.getState()
      }
      save.value = markRaw(data)
      await writeSave(data)
      lastResult.value = null
      touch()
      await refreshSlots()
    } finally {
      busy.value = false
    }
  }

  /** 読み込む。戻り値は「壊れていたので1つ前から復旧した」かどうか */
  async function loadSlot(slot: number): Promise<boolean> {
    busy.value = true
    try {
      await ensurePersistence()
      const result = await readSave(slot)
      if (!result.save) throw new Error('セーブデータを読み込めませんでした。')
      setFictionalPlaces(!!result.save.story?.enabled)
      ensureSugoroku(result.save)
      // 大会の期間中なのに大会がない、スカウトのリストがない（以前の版のデータ）ときは、ここで作る
      {
        const rng = new Rng(result.save.rngState)
        const needScout = result.save.scout?.year !== result.save.calendar.year
        const made = (!currentTournament(result.save) && !!ensureTournament(result.save, rng)) || needScout
        if (needScout) ensureScout(result.save, rng)
        if (made) {
          result.save.rngState = rng.getState()
          await writeSave(result.save)
        }
      }
      save.value = markRaw(result.save)
      lastResult.value = null
      const rec = await readMatch(slot)
      // 終わった試合も、結果を反映する前なら戻す（大会の結果を取りこぼさないように）
      if (rec) {
        match.value = rec.match
        matchRng = new Rng(rec.rngState)
      } else {
        match.value = null
        matchRng = null
      }
      touch()
      return result.recovered
    } finally {
      busy.value = false
    }
  }

  async function persist(): Promise<void> {
    if (!save.value) return
    await writeSave(save.value)
  }

  async function nextWeek(): Promise<WeekResult | null> {
    if (!save.value || busy.value) return null
    busy.value = true
    try {
      const before = takeSnapshot(ownPlayers())
      const result = afterWeek(advanceWeek(save.value))
      lastResult.value = result
      lastGrowth.value = diffSnapshot(before, ownPlayers().filter((p) => !p.retired))
      showGrowth.value = lastGrowth.value.length > 0
      touch()
      await persist()
      return result
    } finally {
      busy.value = false
    }
  }

  /** 選手の情報を変えたとき（名前の編集など）に呼ぶ */
  async function commit(): Promise<void> {
    touch()
    await persist()
  }

  async function exportCurrent(): Promise<void> {
    if (!save.value) return
    await downloadSave(save.value)
  }

  async function exportSlot(slot: number): Promise<void> {
    const result = await readSave(slot)
    if (!result.save) throw new Error('この枠にはセーブデータがありません。')
    await downloadSave(result.save)
  }

  async function importToSlot(slot: number, file: File): Promise<void> {
    const data = await importFromBlob(file)
    data.slot = slot
    await writeSave(data)
    await refreshSlots()
  }

  async function removeSlot(slot: number): Promise<void> {
    await deleteSlot(slot)
    if (save.value?.slot === slot) save.value = null
    await refreshSlots()
  }

  function closeGame(): void {
    save.value = null
    story.value = null
    lastResult.value = null
    match.value = null
    matchRng = null
  }

  // ---- 試合 ----

  function matchContext(): MatchContext | null {
    if (!save.value || !matchRng) return null
    return { players: save.value.players, rng: matchRng }
  }

  async function persistMatch(): Promise<void> {
    if (!save.value || !match.value || !matchRng) return
    await writeMatch({ slot: save.value.slot, match: match.value, rngState: matchRng.getState() })
  }

  async function startPracticeMatch(opponentId: string): Promise<void> {
    const s = save.value
    if (!s || busy.value || s.sugoroku?.pending) return
    const t = currentTournament(s)
    if (t && ownAlive(s, t)) return
    busy.value = true
    try {
      matchRng = new Rng(s.rngState)
      const m = startMatch(s, opponentId, matchRng)
      match.value = m
      matchRev.value += 1
      await persistMatch()
    } finally {
      busy.value = false
    }
  }

  /** 大会の次の試合を始める。サクセスで部員が9人に満たないときは棄権になり、その知らせを返す */
  async function startTournamentMatch(): Promise<string[] | null> {
    const s = save.value
    if (!s || busy.value || match.value) return null
    const p = pendingOwnGame(s)
    if (!p) return null
    busy.value = true
    try {
      if (successOf(s) && rosterCount(s) < 9) {
        const rng = new Rng(s.rngState)
        const msgs = [`部員が9人に満たないため、${p.t.name}は棄権となった…。`, ...recordOwnResult(s, rng, p.t, p.round, false, 0, 9, '人数不足で棄権')]
        s.rngState = rng.getState()
        touch()
        await writeSave(s)
        return msgs
      }
      matchRng = new Rng(s.rngState)
      // 他県の学校など、選手を持っていない相手はその場で選手を作る
      ensureDetailed(s, matchRng, p.t, p.opponentId)
      const spec = TOURNAMENT_SPECS[p.t.kind]
      const m = startMatch(s, p.opponentId, matchRng, {
        label: `${p.t.name} ${roundName(p.t, p.round)}`,
        summer: spec.summer,
        bigStage: spec.national,
        // 県大会は5回10点差・7回7点差でコールド
        mercy: spec.national ? [] : [
          [5, 10],
          [7, 7],
        ],
        tournament: { id: p.t.id, round: p.round },
      })
      match.value = m
      matchRev.value += 1
      s.rngState = matchRng.getState()
      touch()
      await writeSave(s)
      await persistMatch()
      return null
    } finally {
      busy.value = false
    }
  }

  /** 大会の週：試合を終えたら、練習の代わりに軽い調整で1週間進める */
  async function nextTournamentWeek(): Promise<WeekResult | null> {
    const s = save.value
    if (!s || busy.value || match.value || pendingOwnGame(s)) return null
    busy.value = true
    try {
      const before = takeSnapshot(ownPlayers())
      const week = afterWeek(advanceWeek(s, { kind: 'tournament' }))
      lastResult.value = week
      lastGrowth.value = diffSnapshot(before, ownPlayers().filter((p) => !p.retired))
      growthTitle.value = '大会の週の成長！'
      showGrowth.value = lastGrowth.value.length > 0
      touch()
      await writeSave(s)
      return week
    } finally {
      busy.value = false
    }
  }

  /** 試合を進める：1球／1打席／この回の終わりまで／試合終了まで */
  async function stepMatch(kind: 'pitch' | 'pa' | 'inning' | 'end'): Promise<void> {
    const m = match.value
    const ctx = matchContext()
    if (!m || !ctx || m.finished) return
    if (kind === 'pitch') simulatePitch(m, ctx)
    else if (kind === 'pa') simulatePlateAppearance(m, ctx)
    else if (kind === 'inning') {
      const startInning = m.inning
      const startTop = m.top
      let guard = 0
      while (!m.finished && m.inning === startInning && m.top === startTop && guard++ < 30) simulatePlateAppearance(m, ctx)
    } else simulateToEnd(m, ctx)
    matchRev.value += 1
    await persistMatch()
  }

  async function setMatchOrders(orders: Partial<MatchState['pending']>): Promise<void> {
    const m = match.value
    if (!m) return
    Object.assign(m.pending, orders)
    matchRev.value += 1
  }

  async function changeOwnPitcher(newId: string): Promise<void> {
    const m = match.value
    if (!m || !save.value) return
    const team = m.home.schoolId === save.value.playerSchoolId ? m.home : m.away
    changePitcherLogic(m, team, newId)
    matchRev.value += 1
    await persistMatch()
  }

  async function substituteOwn(outId: string, inId: string): Promise<void> {
    const m = match.value
    if (!m || !save.value) return
    const team = m.home.schoolId === save.value.playerSchoolId ? m.home : m.away
    substituteLogic(m, team, outId, inId)
    matchRev.value += 1
    await persistMatch()
  }

  /** 試合を終える：成績を反映して1週間進める */
  async function endMatch(): Promise<{ finish: FinishResult; week: WeekResult | null } | null> {
    const s = save.value
    const m = match.value
    if (!s || !m || !matchRng || !m.finished || busy.value) return null
    busy.value = true
    try {
      const finish = finishMatchLogic(s, m, matchRng)
      const tm = m.options.tournament
      // サクセス：勝敗とフォーカス選手の活躍で、周りの評価が動く
      finish.messages.push(...evalAfterMatch(s, m, !!tm, finish.won))
      noteMatch(s, {
        practice: !tm,
        won: finish.won,
        opponentId: m.home.schoolId === s.playerSchoolId ? m.away.schoolId : m.home.schoolId,
      })
      const t = tm ? (s.tournaments ?? []).find((x) => x.id === tm.id) : null
      if (tm && t) {
        // 大会の試合：結果を組み合わせ表に記録し、週は進めない（同じ週にもう1試合あることもある）
        const ownHome = m.home.schoolId === s.playerSchoolId
        const homeRuns = m.home.runsByInning.reduce((p, q) => p + q, 0)
        const awayRuns = m.away.runsByInning.reduce((p, q) => p + q, 0)
        const ownRuns = ownHome ? homeRuns : awayRuns
        const oppRuns = ownHome ? awayRuns : homeRuns
        // 引き分け（ごくまれ）は抽選で決める
        const won = finish.won ?? matchRng.chance(0.5)
        const note = m.inning < m.options.innings ? `${m.inning}回コールド` : m.inning > m.options.innings ? `延長${m.inning}回` : ''
        finish.messages.push(...recordOwnResult(s, matchRng, t, tm.round, won, ownRuns, oppRuns, note))
        s.rngState = matchRng.getState()
        match.value = null
        matchRng = null
        touch()
        await writeSave(s)
        await clearMatch(s.slot)
        return { finish, week: null }
      }
      s.rngState = matchRng.getState()
      match.value = null
      matchRng = null
      const before = takeSnapshot(ownPlayers())
      const week = afterWeek(advanceWeek(s, { kind: 'match' }))
      lastResult.value = week
      lastGrowth.value = diffSnapshot(before, ownPlayers().filter((p) => !p.retired))
      growthTitle.value = '試合で得た経験！'
      showGrowth.value = lastGrowth.value.length > 0
      touch()
      await writeSave(s)
      await clearMatch(s.slot)
      return { finish, week }
    } finally {
      busy.value = false
    }
  }

  // ---- すごろく ----

  /** カードを使って進む。止まったマスと通ったマスを返す */
  async function useCard(index: number): Promise<{ square: SquareType; path: number[] } | null> {
    const s = save.value
    if (!s || busy.value || match.value || s.sugoroku?.pending) return null
    busy.value = true
    try {
      const rng = new Rng(s.rngState)
      const result = playCard(s, rng, index)
      const pending = s.sugoroku!.pending!
      pending.event = buildEvent(s, rng, result.square, s.sugoroku!.position)
      s.rngState = rng.getState()
      touch()
      await writeSave(s)
      return result
    } finally {
      busy.value = false
    }
  }

  /** 止まったマスの処理をして、1週間進める */
  async function finishSquare(opts: { choice?: number; specialPlayerId?: string } = {}): Promise<{ week: WeekResult; eventResult: string | null } | null> {
    const s = save.value
    const pending = s?.sugoroku?.pending
    if (!s || !pending || busy.value) return null
    busy.value = true
    try {
      let eventResult: string | null = null
      if (pending.event) {
        const choice = pending.event.choices[opts.choice ?? 0] ?? pending.event.choices[0]!
        applyOps(s, choice.ops)
        eventResult = choice.result
        s.log.push({ year: s.calendar.year, week: s.calendar.week, text: `${pending.event.title}：${choice.result}` })
      }
      const before = takeSnapshot(ownPlayers())
      const week = afterWeek(advanceWeek(s, { kind: 'square', square: pending.square, card: pending.card, specialPlayerId: opts.specialPlayerId }))
      lastResult.value = week
      lastGrowth.value = diffSnapshot(before, ownPlayers().filter((p) => !p.retired))
      growthTitle.value = '練習の成果！'
      showGrowth.value = lastGrowth.value.length > 0
      touch()
      await writeSave(s)
      return { week, eventResult }
    } finally {
      busy.value = false
    }
  }

  /** サクセス：勧誘に行く（1週間を使う） */
  async function recruitAt(club: ClubId, target?: number): Promise<{ result: RecruitResult; week: WeekResult } | null> {
    const s = save.value
    if (!s || !successOf(s) || busy.value || match.value || s.sugoroku?.pending) return null
    busy.value = true
    try {
      const rng = new Rng(s.rngState)
      const result = recruitLogic(s, rng, club, target)
      s.rngState = rng.getState()
      const before = takeSnapshot(ownPlayers())
      const week = afterWeek(advanceWeek(s, { kind: 'recruit' }))
      lastResult.value = week
      lastGrowth.value = diffSnapshot(before, ownPlayers().filter((p) => !p.retired))
      growthTitle.value = '残った部員の練習'
      showGrowth.value = false
      touch()
      await writeSave(s)
      return { result, week }
    } finally {
      busy.value = false
    }
  }

  /** 部費を使って設備を1段階強化する */
  async function upgradeFacility(key: keyof School['facilities']): Promise<boolean> {
    const s = save.value
    const own = s ? s.schools[s.playerSchoolId] : null
    if (!s || !own || busy.value) return false
    const level = own.facilities[key]
    const cost = facilityCost(level)
    if (level >= 5 || own.funds < cost) return false
    own.funds -= cost
    own.facilities[key] = level + 1
    s.log.push({ year: s.calendar.year, week: s.calendar.week, text: `部費${cost}万円で設備を強化した。` })
    await commit()
    return true
  }

  /** スカウト：視察と勧誘 */
  async function scoutAction(kind: 'visit' | 'recruit', id: string): Promise<VisitResult | string | null> {
    const s = save.value
    if (!s || busy.value) return null
    const rng = new Rng(s.rngState)
    const msg = kind === 'visit' ? scoutVisitLogic(s, rng, id) : scoutRecruitLogic(s, rng, id)
    s.rngState = rng.getState()
    if (msg) await commit()
    return msg
  }

  async function saveLineup(lineup: LineupConfig | null): Promise<void> {
    if (!save.value) return
    save.value.lineup = lineup
    await commit()
  }

  // ---- ストーリー ----

  /** 次に流す場面があれば用意する（試合中・処理中は流さない）。用意したら true */
  async function checkStory(): Promise<boolean> {
    const s = save.value
    if (!s?.story?.enabled || busy.value || match.value || story.value) return false
    if (s.sugoroku?.pending) return false
    const changed = observeStory(s)
    const scene = nextScene(s)
    if (changed && !scene) await writeSave(s)
    if (!scene) return false
    story.value = { scene, steps: buildSteps(s, scene) }
    return true
  }

  /** 場面を見終わった：効果を反映して保存する。戻り値は画面に出す知らせ */
  async function finishStory(picks: number[]): Promise<string[]> {
    const s = save.value
    const cur = story.value
    if (!s || !cur) return []
    const messages = completeScene(s, cur.scene, cur.steps, picks)
    story.value = null
    touch()
    await writeSave(s)
    return messages
  }

  /** 画面の操作で起きる出来事の印（スカウトを初めて開いた、など） */
  async function markStoryFlag(key: string): Promise<void> {
    const s = save.value
    if (!s || !markStory(s, key)) return
    touch()
    await writeSave(s)
  }

  /** 週の初めの出来事（季節の行事など）を選び終えた：効果を反映して保存する */
  async function resolveQueuedEvent(choice: number): Promise<void> {
    const s = save.value
    const ev = s?.eventQueue?.[0]
    if (!s || !ev) return
    const c = ev.choices[choice] ?? ev.choices[0]
    s.eventQueue!.shift()
    if (c) applyOps(s, c.ops)
    s.log.push({ year: s.calendar.year, week: s.calendar.week, text: `${ev.title}：${c?.result ?? ''}` })
    touch()
    await writeSave(s)
  }

  /** 物語の旗に値を書いて保存する（チュートリアルの済み・未済など） */
  async function setStoryFlag(key: string, value: string | number | boolean): Promise<void> {
    const s = save.value
    if (!s?.story?.enabled) return
    s.story.flags[key] = value
    touch()
    await writeSave(s)
  }

  // ---- 画面から使う取得用の関数（rev を読むことで再描画の対象になる） ----
  function ownSchool(): School | null {
    void rev.value
    const s = save.value
    return s ? (s.schools[s.playerSchoolId] ?? null) : null
  }

  function ownPlayers(): Player[] {
    void rev.value
    const s = save.value
    const school = ownSchool()
    if (!s || !school) return []
    return school.playerIds.map((id) => s.players[id]).filter((p): p is Player => !!p)
  }

  function player(id: string): Player | null {
    void rev.value
    return save.value?.players[id] ?? null
  }

  return {
    save,
    rev,
    slots,
    busy,
    lastResult,
    persistent,
    lastGrowth,
    showGrowth,
    growthTitle,
    match,
    matchRev,
    boardNotice,
    story,
    checkStory,
    finishStory,
    markStoryFlag,
    setStoryFlag,
    resolveQueuedEvent,
    startPracticeMatch,
    startTournamentMatch,
    nextTournamentWeek,
    stepMatch,
    setMatchOrders,
    changeOwnPitcher,
    substituteOwn,
    endMatch,
    saveLineup,
    upgradeFacility,
    scoutAction,
    recruitAt,
    useCard,
    finishSquare,
    refreshSlots,
    startNewGame,
    loadSlot,
    nextWeek,
    commit,
    exportCurrent,
    exportSlot,
    importToSlot,
    removeSlot,
    closeGame,
    ownSchool,
    ownPlayers,
    player,
    touch,
  }
})

async function downloadSave(data: SaveData): Promise<void> {
  const blob = await exportToBlob(data)
  const school = data.schools[data.playerSchoolId]?.name ?? 'save'
  const name = `${school}_${data.calendar.year}年目_${data.calendar.week}週.hsbm`
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
