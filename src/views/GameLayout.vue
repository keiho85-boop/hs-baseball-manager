<script setup lang="ts">
import GameIcon from '@/components/GameIcon.vue'
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import TabBar from '@/components/TabBar.vue'
import GrowthPopup from '@/components/GrowthPopup.vue'
import { useGameStore } from '@/stores/game'
import { weekToDate } from '@/game/constants'

const game = useGameStore()
const router = useRouter()

const date = computed(() => {
  void game.rev
  const s = game.save
  if (!s) return null
  return { year: s.calendar.year, ...weekToDate(s.calendar.week) }
})
</script>

<template>
  <div class="layout">
    <header class="top">
      <div v-if="date" class="calendar">
        <div class="cal-year">{{ date.year }}年目</div>
        <div class="cal-month">{{ date.month }}<small>月</small></div>
        <div class="cal-week">第{{ date.weekOfMonth }}週</div>
      </div>
      <div class="title">
        <div class="pref muted-light">{{ game.ownSchool()?.kind === 'private' ? '私立' : '公立' }}</div>
        <div class="school">{{ game.ownSchool()?.name }}</div>
      </div>
      <button class="gear" aria-label="設定" @click="router.push({ name: 'settings' })"><GameIcon name="gear" :size="24" /></button>
    </header>
    <main class="content">
      <RouterView v-slot="{ Component, route }">
        <Transition name="page" mode="out-in">
          <component :is="Component" :key="route.fullPath" />
        </Transition>
      </RouterView>
    </main>
    <TabBar />
    <GrowthPopup />
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
  gap: 10px;
  padding: 8px 12px 10px;
  padding-top: calc(8px + env(safe-area-inset-top, 0px));
  background:
    repeating-linear-gradient(135deg, rgba(255, 255, 255, 0.08) 0 10px, rgba(255, 255, 255, 0) 10px 20px),
    linear-gradient(180deg, #2c98e8 0%, #4fb6f4 100%);
  color: #fff;
  border-radius: 0 0 20px 20px;
  box-shadow: inset 0 -3px 0 rgba(0, 0, 0, 0.1), 0 0 0 1.5px #1f7fd0, 0 6px 14px rgba(26, 111, 194, 0.3);
}
.calendar {
  background: linear-gradient(180deg, #fff 60%, #eef4fa);
  color: var(--ink);
  border-radius: 10px;
  width: 58px;
  text-align: center;
  overflow: hidden;
  box-shadow: 0 3px 0 rgba(0, 0, 0, 0.15);
  flex-shrink: 0;
}
.cal-year {
  background: var(--red);
  color: #fff;
  font-size: 10px;
  font-weight: 800;
  padding: 1px 0;
}
.cal-month {
  font-size: 22px;
  font-weight: 900;
  line-height: 1.1;
}
.cal-month small {
  font-size: 11px;
}
.cal-week {
  font-size: 10px;
  font-weight: 800;
  color: var(--ink-soft);
  padding-bottom: 2px;
}
.title {
  flex: 1;
  min-width: 0;
}
.pref {
  font-size: 11px;
  font-weight: 700;
  opacity: 0.9;
}
.school {
  font-weight: 900;
  font-size: 19px;
  line-height: 1.2;
  text-shadow: 0 2px 0 rgba(0, 0, 0, 0.15);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.gear {
  width: 42px;
  height: 42px;
  padding: 0;
  border-radius: 50%;
  background-image: linear-gradient(180deg, #ffffff, #e3f1fc);
  box-shadow: inset 0 0 0 2px #fff, 0 3px 0 #1f7fd0, 0 6px 10px rgba(0, 0, 0, 0.15);
  color: var(--sky-deep);
  display: flex;
  align-items: center;
  justify-content: center;
}
.gear:active {
  box-shadow: none;
}
</style>
