<script setup lang="ts">
// 週の初めの出来事（季節の行事・レアイベント）を、順番に会話ウィンドウで出す
// ストーリーの場面・成長の知らせ・すごろくのイベント・試合の最中は待つ
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useGameStore } from '@/stores/game'
import { useUiStore } from '@/stores/ui'
import EventDialog from './sugoroku/EventDialog.vue'

const game = useGameStore()
const ui = useUiStore()
const route = useRoute()

const current = computed(() => {
  void game.rev
  const s = game.save
  const ev = s?.eventQueue?.[0]
  if (!s || !ev) return null
  if (game.story || game.showGrowth || game.busy || game.match || ui.dialog || ui.notice) return null
  if (s.sugoroku?.pending) return null
  if (route.name === 'match') return null
  return ev
})

async function done(choice: number): Promise<void> {
  await game.resolveQueuedEvent(choice)
}
</script>

<template>
  <EventDialog v-if="current" :key="current.id" :event="current" @done="done" />
</template>
