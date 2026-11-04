<script setup lang="ts">
// 能力1つ分の表示：名前・ランク・数値・ゲージ
import { computed } from 'vue'
import { rankOf } from '@/game/constants'

const props = defineProps<{
  label: string
  value: number
  /** ゲージに出す値（球速などは別の換算値を使う） */
  gauge?: number
  /** 数値の代わりに表示する文字（例：145km/h） */
  display?: string
  /** ランクの文字を出さない（体力などの状態表示用） */
  hideRank?: boolean
}>()

const g = computed(() => Math.max(2, Math.min(100, props.gauge ?? props.value)))
const rank = computed(() => rankOf(props.gauge ?? props.value))
</script>

<template>
  <div class="ability">
    <div class="label">{{ label }}</div>
    <div class="rank" :class="`r-${rank}`">{{ hideRank ? '' : rank }}</div>
    <div class="value">{{ display ?? value }}</div>
    <div class="bar">
      <div class="fill" :class="`f-${rank}`" :style="{ width: `${g}%` }" />
    </div>
  </div>
</template>

<style scoped>
.ability {
  display: grid;
  grid-template-columns: 1fr auto auto;
  grid-template-rows: auto 7px;
  column-gap: 6px;
  align-items: center;
  padding: 4px 0 6px;
}
.label {
  font-size: 13px;
  font-weight: 700;
  color: var(--ink-soft);
  white-space: nowrap;
}
.rank {
  font-size: 22px;
  font-weight: 900;
  line-height: 1;
  font-style: italic;
  -webkit-text-stroke: 0.5px rgba(0, 0, 0, 0.15);
}
.value {
  font-size: 15px;
  font-weight: 800;
  min-width: 30px;
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.bar {
  grid-column: 1 / -1;
  height: 7px;
  border-radius: 99px;
  background: #e8eef5;
  overflow: hidden;
  margin-top: 3px;
}
.fill {
  height: 100%;
  border-radius: 99px;
  transition: width 0.6s cubic-bezier(0.2, 0.9, 0.3, 1.2);
}
.r-S { color: #e99a00; }
.r-A { color: #e5484d; }
.r-B { color: #ff7a2e; }
.r-C { color: #2f9e3a; }
.r-D { color: #0f968f; }
.r-E { color: #2f6fe0; }
.r-F { color: #6c7a8e; }
.r-G { color: #a2acbb; }
.f-S { background: linear-gradient(90deg, #ffd23f, #f5a300); }
.f-A { background: linear-gradient(90deg, #ff7a7e, #e5484d); }
.f-B { background: linear-gradient(90deg, #ffb07a, #ff8a3d); }
.f-C { background: linear-gradient(90deg, #7ed67f, #3fae4a); }
.f-D { background: linear-gradient(90deg, #5fd3cc, #14a7a0); }
.f-E { background: linear-gradient(90deg, #73a3f5, #2f6fe0); }
.f-F { background: linear-gradient(90deg, #aab5c4, #7e8ca0); }
.f-G { background: #c5ccd7; }
</style>
