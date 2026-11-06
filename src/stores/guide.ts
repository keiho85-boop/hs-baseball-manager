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
    const id = GUIDE_ORDER.find((g) => st.flags[`guide:${g}`] === 'todo')
    if (id) active.value = { id, index: 0 }
  }

  async function next(): Promise<void> {
    const a = active.value
    if (!a) return
    if (a.index + 1 < GUIDES[a.id].length) {
      active.value = { id: a.id, index: a.index + 1 }
      return
    }
    await finish()
  }

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

  return { active, step, total, check, next, finish, reset }
})
