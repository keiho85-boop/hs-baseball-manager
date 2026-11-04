<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()

const tabs = [
  { name: 'home', label: 'ホーム', icon: '⌂' },
  { name: 'players', label: '部員', icon: '👥' },
  { name: 'team', label: 'チーム', icon: '⚾' },
  { name: 'school', label: '学校', icon: '🏫' },
  { name: 'records', label: '記録', icon: '📖' },
] as const

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
    <button v-for="t in tabs" :key="t.name" :class="{ active: isActive(t.name) }" @click="go(t.name)">
      <span class="icon" aria-hidden="true">{{ t.icon }}</span>
      <span class="label">{{ t.label }}</span>
    </button>
  </nav>
  <div class="ad-slot" aria-hidden="true">広告スペース（準備中）</div>
</template>

<style scoped>
.tabbar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: calc(var(--ad-height) + var(--safe-bottom));
  height: var(--tab-height);
  display: flex;
  background: var(--paper);
  border-top: 1px solid var(--line);
  z-index: 50;
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
  font-weight: 500;
}
.tabbar button.active {
  color: var(--green);
  font-weight: 700;
}
.icon {
  font-size: 18px;
  line-height: 1.1;
}
.label {
  font-size: 11px;
}
.ad-slot {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  height: calc(var(--ad-height) + var(--safe-bottom));
  padding-bottom: var(--safe-bottom);
  background: #ebe6db;
  color: #b3ab9b;
  font-size: 11px;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 50;
}
</style>
