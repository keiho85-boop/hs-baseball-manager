<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import TabBar from '@/components/TabBar.vue'
import { useGameStore } from '@/stores/game'
import { formatWeek } from '@/game/constants'

const game = useGameStore()
const router = useRouter()

const header = computed(() => {
  void game.rev
  const s = game.save
  if (!s) return ''
  return formatWeek(s.calendar.year, s.calendar.week)
})
</script>

<template>
  <div class="layout">
    <header class="top">
      <div>
        <div class="school">{{ game.ownSchool()?.name }}</div>
        <div class="date">{{ header }}</div>
      </div>
      <button class="plain gear" aria-label="設定" @click="router.push({ name: 'settings' })">⚙ 設定</button>
    </header>
    <main class="content">
      <RouterView />
    </main>
    <TabBar />
  </div>
</template>

<style scoped>
.layout {
  min-height: 100vh;
  padding-bottom: calc(var(--tab-height) + var(--ad-height) + var(--safe-bottom) + 8px);
}
.top {
  position: sticky;
  top: 0;
  z-index: 40;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 14px;
  padding-top: calc(8px + env(safe-area-inset-top, 0px));
  background: var(--green);
  color: #fff;
}
.school {
  font-weight: 700;
  font-size: 16px;
}
.date {
  font-size: 12px;
  opacity: 0.9;
}
.gear {
  color: #fff;
  font-size: 13px;
}
</style>
