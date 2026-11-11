<script setup lang="ts">
// 選手育成モード：シナリオの結末。タブやヘッダーのない1画面で見せ、見終えたら「タイトルに戻る」
import { useRouter } from 'vue-router'
import { useGameStore } from '@/stores/game'
import EndingCard from '@/components/success/EndingCard.vue'

const game = useGameStore()
const router = useRouter()

/** 育成はここで終わり：セーブデータを消してタイトルへ（プロ入りした選手はドラフトのときに保存済み） */
async function backToTitle(): Promise<void> {
  const slot = game.save?.slot
  if (slot) await game.removeSlot(slot)
  game.closeGame()
  await router.replace({ name: 'title' })
}
</script>

<template>
  <div class="ending-page">
    <EndingCard @title="backToTitle" />
  </div>
</template>

<style scoped>
.ending-page {
  min-height: 100dvh;
  padding: calc(12px + env(safe-area-inset-top, 0px)) 12px calc(20px + var(--safe-bottom, 0px));
  background: linear-gradient(180deg, #ffe8b8 0%, #fff6e0 40%, #eaf4ff 100%);
}
</style>
