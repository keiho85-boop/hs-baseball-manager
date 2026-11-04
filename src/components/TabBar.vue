<script setup lang="ts">
import TabIcon from '@/components/TabIcon.vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()

const tabs = [
  { name: 'home', label: 'ホーム', color: '#e5484d' },
  { name: 'players', label: '部員', color: '#2a6fd6' },
  { name: 'team', label: 'チーム', color: '#d9731f' },
  { name: 'school', label: '学校', color: '#1f8a42' },
  { name: 'records', label: '記録', color: '#c98a00' },
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
      <span class="icon"><TabIcon :name="t.name" :size="30" /></span>
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
  width: 46px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 14px;
  /* 選ばれていないタブは色を落として、選んだタブだけを際立たせる */
  filter: grayscale(0.85) brightness(1.08) opacity(0.6);
  transition: transform 0.22s cubic-bezier(0.3, 1.6, 0.5, 1), filter 0.2s, background 0.2s;
}
.active .icon {
  filter: none;
  background:
    radial-gradient(120% 90% at 30% 10%, rgba(255, 255, 255, 0.95) 0%, rgba(255, 255, 255, 0) 60%),
    linear-gradient(180deg, #ffffff, #e4eef9);
  transform: translateY(-10px) scale(1.18);
  box-shadow:
    0 0 0 2.5px var(--c),
    0 4px 0 2.5px var(--c),
    0 10px 16px rgba(0, 0, 0, 0.22);
}
.active .icon :deep(svg) {
  animation: icon-bounce 0.45s cubic-bezier(0.3, 1.6, 0.5, 1);
}
@keyframes icon-bounce {
  0% {
    transform: scale(0.7) rotate(-8deg);
  }
  100% {
    transform: none;
  }
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
