<script setup lang="ts">
// 調子（5段階）を色付きの矢印で表すアイコン
// 絶好調：赤・上　好調：橙・右上　普通：黄・右　不調：青・右下　絶不調：紫・下
import { computed, useId } from 'vue'

const props = withDefaults(defineProps<{ form: number; size?: number }>(), { size: 18 })
const uid = useId()

const STYLES = [
  { color: '#7a4fd6', deep: '#4f2fa0', angle: 90, label: '絶不調' },
  { color: '#3d7be0', deep: '#2350a8', angle: 45, label: '不調' },
  { color: '#e6b000', deep: '#a87c00', angle: 0, label: '普通' },
  { color: '#f08a1c', deep: '#b85a00', angle: -45, label: '好調' },
  { color: '#e5363d', deep: '#a3151b', angle: -90, label: '絶好調' },
]
const st = computed(() => STYLES[Math.min(4, Math.max(0, props.form - 1))]!)
</script>

<template>
  <svg :width="size" :height="size" viewBox="0 0 24 24" class="form-icon" role="img" :aria-label="`調子：${st.label}`">
    <defs>
      <linearGradient :id="`${uid}-bg`" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" :stop-color="st.color" />
        <stop offset="1" :stop-color="st.deep" />
      </linearGradient>
    </defs>
    <circle cx="12" cy="12" r="11" :fill="`url(#${uid}-bg)`" />
    <ellipse cx="9" cy="6.5" rx="6" ry="3" fill="#fff" opacity="0.32" />
    <g :transform="`rotate(${st.angle} 12 12)`">
      <path d="M5.5 10.2 H12.5 V6.6 L19 12 L12.5 17.4 V13.8 H5.5Z" fill="#fff" stroke="rgba(0,0,0,0.15)" stroke-width="0.6" stroke-linejoin="round" />
    </g>
  </svg>
</template>

<style scoped>
.form-icon {
  display: inline-block;
  flex-shrink: 0;
  vertical-align: middle;
  filter: drop-shadow(0 1px 0 rgba(0, 0, 0, 0.18));
}
</style>
