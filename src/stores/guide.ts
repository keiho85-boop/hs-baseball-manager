// 操作のチュートリアルの進み具合

import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { GUIDES, GUIDE_ORDER, type GuideId, type GuideStep } from '@/game/story/guides'
import { useGameStore } from './game'

export const useGuideStore = defineStore('guide', () => {
  const game = useGameStore()
  const active = ref<{ id: GuideId; index: number } | null>(null)

  const step = computed<GuideStep | null>(() => (active.value ? (GUIDES[active.value.id][active.value.index] ?? null) : null))
  const total = computed(() => (active.value ? GUIDES[active.value.id].length : 0))

  /** 待っているチュートリアルがあれば始める */
  function check(): void {
    if (active.value) return
    const st = game.save?.story
    if (!st?.enabled) return
    // 育て方のコツ：選手育成モードで、練習の説明が済んだあと（1年目の5月以降。以前のデータでも一度だけ出す）
    const cal = game.save!.calendar
    if (st.success && !st.success.ended && st.flags['guide:growth'] === undefined && st.flags['guide:practice'] !== 'todo' && (cal.year > 1 || cal.week >= 5)) st.flags['guide:growth'] = 'todo'
    const id = GUIDE_ORDER.find((g) => st.flags[`guide:${g}`] === 'todo')
    if (id) active.value = { id, index: 0 }
  }

  async function next(): Promise<void> {
    const a = active.value
    if (!a) return
    let i = a.index + 1
    // 飛ばす条件に当てはまる手順（部費が足りないなど）は飛ばす
    while (i < GUIDES[a.id].length && game.save && GUIDES[a.id][i]!.skipIf?.(game.save)) i += 1
    if (i < GUIDES[a.id].length) {
      active.value = { id: a.id, index: i }
      return
    }
    await finish()
  }

  /** 操作が終わったことを知らせる（その操作を待っている手順なら次へ） */
  function notify(event: string): void {
    if (step.value?.waitFor === event) void next()
  }

  /** 案内の吹き出しが画面に出ているか（試合の画面は、出ている間は進行を止める） */
  const showing = ref(false)

  /** 終わり（途中で飛ばしたときも） */
  async function finish(): Promise<void> {
    const a = active.value
    if (!a) return
    active.value = null
    await game.setStoryFlag(`guide:${a.id}`, 'done')
    check()
  }

  function reset(): void {
    active.value = null
  }

  return { active, step, total, showing, check, next, notify, finish, reset }
})
