<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()

const tabs = [
  { name: 'home', label: 'ホーム', icon: '🏠', color: '#48b3f0' },
  { name: 'players', label: '部員', icon: '🧢', color: '#3fae4a' },
  { name: 'team', label: 'チーム', icon: '⚾', color: '#ff8a3d' },
  { name: 'school', label: '学校', icon: '🏫', color: '#e5484d' },
  { name: 'records', label: '記録', icon: '🏆', color: '#e9a400' },
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
    <button
      v-for="t in tabs"
      :key="t.name"
      :class="{ active: isActive(t.name) }"
      :style="{ '--c': t.color }"
      @click="go(t.name)"
    >
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
  font-size: 20px;
  width: 38px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  transition: transform 0.2s cubic-bezier(0.3, 1.6, 0.5, 1), background 0.2s;
}
.active .icon {
  background: var(--c);
  transform: translateY(-6px) scale(1.12);
  box-shadow: 0 3px 0 rgba(0, 0, 0, 0.15);
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
  background: #e6eef6;
  color: #a7b4c4;
  font-size: 11px;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 50;
}
</style>
