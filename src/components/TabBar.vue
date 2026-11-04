<script setup lang="ts">
import GameIcon from '@/components/GameIcon.vue'
import type { IconName } from '@/components/icons'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()

const tabs = [
  { name: 'home', label: 'ホーム', icon: 'home', color: '#3aa8f0' },
  { name: 'players', label: '部員', icon: 'cap', color: '#36a843' },
  { name: 'team', label: 'チーム', icon: 'ball', color: '#ff7a2e' },
  { name: 'school', label: '学校', icon: 'school', color: '#e5484d' },
  { name: 'records', label: '記録', icon: 'trophy', color: '#e9a400' },
] as const satisfies readonly { name: string; label: string; icon: IconName; color: string }[]

function isActive(name: string): boolean {
  if (name === 'players') return route.name === 'players' || route.name === 'player'
  return route.name === name
}

function go(name: string): void {
  // タブの切り替えは履歴に積まない（戻るボタンで前のタブに戻り続けないように）
  if (route.name !== name) router.replace({ name })
}
</script>

<template>
  <nav class="tabbar">
    <button
      v-for="t in tabs"
      :key="t.name"
      :class="{ active: isActive(t.name) }"
      :style="{ '--c': t.color }"
      @click="go(t.name)"
    >
      <span class="icon"><GameIcon :name="t.icon" :size="22" /></span>
      <span class="label">{{ t.label }}</span>
    </button>
  </nav>
  <div class="ad-slot" aria-hidden="true" />
</template>

<style scoped>
.tabbar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: calc(var(--ad-height) + var(--safe-bottom));
  height: var(--tab-height);
  display: flex;
  background: #fff;
  border-radius: 20px 20px 0 0;
  box-shadow: 0 -4px 14px rgba(31, 42, 58, 0.1);
  z-index: 50;
  padding: 0 4px;
}
.tabbar button {
  flex: 1;
  background: transparent;
  color: var(--ink-soft);
  border-radius: 0;
  padding: 4px 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  box-shadow: none;
  text-shadow: none;
  gap: 1px;
}
.tabbar button:active {
  transform: none;
  box-shadow: none;
}
.icon {
  color: #9fb0c4;
  width: 42px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  transition: transform 0.2s cubic-bezier(0.3, 1.6, 0.5, 1), background 0.2s;
}
.active .icon {
  color: #fff;
  background-image: linear-gradient(180deg, rgba(255, 255, 255, 0.35) 0%, rgba(255, 255, 255, 0) 55%), linear-gradient(180deg, var(--c), var(--c));
  transform: translateY(-8px) scale(1.12);
  box-shadow: 0 0 0 3px #fff, 0 4px 0 3px rgba(0, 0, 0, 0.12), 0 8px 12px rgba(0, 0, 0, 0.15);
}
.label {
  font-size: 11px;
}
.active .label {
  color: var(--c);
  font-weight: 900;
}
.ad-slot {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  height: calc(var(--ad-height) + var(--safe-bottom));
  padding-bottom: var(--safe-bottom);
  background: #eef3f8;
  z-index: 50;
}
</style>
