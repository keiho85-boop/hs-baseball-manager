<script setup lang="ts">
// 能力1つ分の表示：名前・ランク・数値・目盛り付きのゲージ
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
  /** 次に1上がるまでの経験の貯まり具合（0〜1。育成選手だけ） */
  xp?: number
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
      <div class="ticks" />
    </div>
    <div v-if="xp !== undefined" class="xp" :title="`次に上がるまで ${Math.round((1 - xp) * 100)}%`">
      <i :style="{ width: `${Math.round(xp * 100)}%` }" />
    </div>
  </div>
</template>

<style scoped>
.xp {
  grid-column: 1 / -1;
  height: 3px;
  margin-top: 2px;
  border-radius: 2px;
  background: #eef2f7;
  overflow: hidden;
}
.xp i {
  display: block;
  height: 100%;
  background: linear-gradient(90deg, #ffd36b, #ff9f1c);
}
.ability {
  display: grid;
  grid-template-columns: 1fr auto auto;
  grid-template-rows: auto 9px;
  column-gap: 6px;
  align-items: center;
  padding: 4px 0 7px;
}
.label {
  font-size: 13px;
  font-weight: 800;
  color: var(--ink-soft);
  white-space: nowrap;
}
.rank {
  font-size: 23px;
  font-weight: 900;
  line-height: 1;
  font-style: italic;
  -webkit-text-stroke: 3px #fff;
  paint-order: stroke fill;
  filter: drop-shadow(0 1px 0 rgba(0, 0, 0, 0.18));
}
.value {
  font-size: 16px;
  font-weight: 900;
  min-width: 30px;
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.bar {
  grid-column: 1 / -1;
  height: 9px;
  border-radius: 99px;
  background: linear-gradient(180deg, #dfe7f0, #edf2f7);
  box-shadow: inset 0 1px 2px rgba(23, 50, 87, 0.18);
  overflow: hidden;
  margin-top: 3px;
  position: relative;
}
.fill {
  height: 100%;
  border-radius: 99px;
  transition: width 0.7s cubic-bezier(0.2, 0.9, 0.3, 1.15);
  position: relative;
}
.fill::after {
  /* ゲージの光沢 */
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  top: 1px;
  height: 3px;
  border-radius: 99px;
  background: rgba(255, 255, 255, 0.45);
}
.ticks {
  /* 10刻みの目盛り */
  position: absolute;
  inset: 0;
  background: repeating-linear-gradient(90deg, rgba(255, 255, 255, 0) 0 calc(10% - 1.5px), rgba(255, 255, 255, 0.75) calc(10% - 1.5px) 10%);
  pointer-events: none;
}
.r-S { color: #e99a00; }
.r-A { color: #e5484d; }
.r-B { color: #ff7a2e; }
.r-C { color: #2f9e3a; }
.r-D { color: #0f968f; }
.r-E { color: #2f6fe0; }
.r-F { color: #6c7a8e; }
.r-G { color: #a2acbb; }
.f-S { background: linear-gradient(90deg, #ffe27a, #f5a300); }
.f-A { background: linear-gradient(90deg, #ff8a8e, #e0353b); }
.f-B { background: linear-gradient(90deg, #ffbb8a, #fb7420); }
.f-C { background: linear-gradient(90deg, #8ddd8f, #2f9e3a); }
.f-D { background: linear-gradient(90deg, #76dcd5, #109a93); }
.f-E { background: linear-gradient(90deg, #8ab4f7, #2c66d8); }
.f-F { background: linear-gradient(90deg, #bcc5d1, #75839a); }
.f-G { background: #c5ccd7; }
</style>
