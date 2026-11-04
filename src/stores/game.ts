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
import type { LineupConfig, Player, SaveData, SaveSummary, School, SquareType } from '@/game/types'

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
  /** 途中の試合（選手が多いセーブ本体とは別に、小さく保存する）。
   * 試合の状態は小さいので、Vueの自動追跡に入れて画面がそのまま追従するようにする */
  const match = ref<MatchState | null>(null)
  const matchRev = ref(0)
  let matchRng: Rng | null = null

  function touch(): void {
    rev.value += 1
  }

  async function refreshSlots(): Promise<void> {
    slots.value = await listSlots()
  }

  async function ensurePersistence(): Promise<void> {
    if (persistent.value === null) persistent.value = await requestPersistentStorage()
  }

  async function startNewGame(input: Omit<NewGameInput, 'seed'>): Promise<void> {
    busy.value = true
    try {
      await ensurePersistence()
      // 少し待って画面に「作成中」を表示してから重い処理をする
      await new Promise((r) => setTimeout(r, 30))
      const data = createNewGame({ ...input, seed: (Math.random() * 2 ** 32) >>> 0 })
      ensureSugoroku(data)
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
      ensureSugoroku(result.save)
      save.value = markRaw(result.save)
      lastResult.value = null
      const rec = await readMatch(slot)
      if (rec && !rec.match.finished) {
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
      const result = advanceWeek(save.value)
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
  async function endMatch(): Promise<{ finish: FinishResult; week: WeekResult } | null> {
    const s = save.value
    const m = match.value
    if (!s || !m || !matchRng || !m.finished || busy.value) return null
    busy.value = true
    try {
      const finish = finishMatchLogic(s, m, matchRng)
      s.rngState = matchRng.getState()
      match.value = null
      matchRng = null
      const before = takeSnapshot(ownPlayers())
      const week = advanceWeek(s, { kind: 'match' })
      lastResult.value = week
      lastGrowth.value = diffSnapshot(before, ownPlayers().filter((p) => !p.retired))
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
      pending.event = buildEvent(s, rng, result.square)
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
      const week = advanceWeek(s, { kind: 'square', square: pending.square, card: pending.card, specialPlayerId: opts.specialPlayerId })
      lastResult.value = week
      lastGrowth.value = diffSnapshot(before, ownPlayers().filter((p) => !p.retired))
      showGrowth.value = lastGrowth.value.length > 0
      touch()
      await writeSave(s)
      return { week, eventResult }
    } finally {
      busy.value = false
    }
  }

  async function saveLineup(lineup: LineupConfig | null): Promise<void> {
    if (!save.value) return
    save.value.lineup = lineup
    await commit()
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
    match,
    matchRev,
    startPracticeMatch,
    stepMatch,
    setMatchOrders,
    changeOwnPitcher,
    substituteOwn,
    endMatch,
    saveLineup,
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
