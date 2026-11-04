// ゲームの状態を画面に渡すストア
// セーブデータは選手が数千人いて大きいため、Vueの自動追跡（リアクティブ）には入れず、
// 変更したときに rev を増やして画面に再描画を知らせる

import { defineStore } from 'pinia'
import { markRaw, ref, shallowRef } from 'vue'
import { createNewGame, type NewGameInput } from '@/game/world'
import { advanceWeek, type WeekResult } from '@/game/season'
import { deleteSlot, listSlots, readSave, requestPersistentStorage, writeSave } from '@/game/storage'
import { exportToBlob, importFromBlob } from '@/game/serialize'
import { diffSnapshot, takeSnapshot, type GrowthEntry } from '@/game/growth'
import type { Player, SaveData, SaveSummary, School } from '@/game/types'

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
      save.value = markRaw(result.save)
      lastResult.value = null
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
