<script setup lang="ts">
// 上から見たグラウンド。走者と、直前の打球の軌跡を描く
import { computed } from 'vue'
import type { PlayEvent } from '@/game/match/types'

const props = defineProps<{
  bases: (string | null)[]
  lastEvent: PlayEvent | null
  /** 守っている側が自校か（走者の色を変える） */
  ownBatting: boolean
}>()

const HOME = { x: 150, y: 238 }
const SCALE = 1.55
const toSvg = (x: number, y: number) => ({ x: HOME.x + x * SCALE, y: HOME.y - y * SCALE })
const BASES = [toSvg(19.4, 19.4), toSvg(0, 27.4), toSvg(-19.4, 19.4)]
const FIELDERS = [
  toSvg(0, 18.4), // 投
  toSvg(0, -5), // 捕
  toSvg(24, 26), // 一
  toSvg(12, 37), // 二
  toSvg(-12, 37), // 遊
  toSvg(-24, 26), // 三
  toSvg(-42, 72), // 左
  toSvg(0, 88), // 中
  toSvg(42, 72), // 右
]

const fence = (() => {
  const pts: string[] = []
  for (let d = -45; d <= 45; d += 5) {
    const dist = 92 + 26 * Math.cos((d * Math.PI) / 90)
    const r = (d * Math.PI) / 180
    const p = toSvg(Math.sin(r) * dist, Math.cos(r) * dist)
    pts.push(`${p.x.toFixed(1)},${p.y.toFixed(1)}`)
  }
  return pts.join(' ')
})()

const ball = computed(() => {
  const e = props.lastEvent
  if (!e?.ball) return null
  const end = toSvg(e.ball.x, e.ball.y)
  // フライほど高い弧を描く
  const lift = e.ball.type === 'fly' ? 70 : e.ball.type === 'pop' ? 60 : e.ball.type === 'line' ? 22 : 0
  const cx = (HOME.x + end.x) / 2
  const cy = (HOME.y + end.y) / 2 - lift
  const hr = e.kind === 'homerun'
  const hitKinds = ['single', 'double', 'triple', 'homerun']
  return {
    d: `M${HOME.x},${HOME.y - 2} Q${cx},${cy} ${end.x},${end.y}`,
    end,
    color: hr ? '#ffcf33' : hitKinds.includes(e.kind) ? '#ff5a4f' : '#ffffff',
    key: `${e.inning}-${e.top}-${e.batterId}-${e.text}`,
    hr,
  }
})
</script>

<template>
  <svg class="field" viewBox="0 0 300 258" aria-label="グラウンド">
    <defs>
      <linearGradient id="fv-grass" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#4dbd57" />
        <stop offset="1" stop-color="#2f9a3c" />
      </linearGradient>
    </defs>
    <rect width="300" height="258" rx="14" fill="#2a7f3a" />
    <polygon :points="`${HOME.x},${HOME.y} ${fence} ${HOME.x},${HOME.y}`" fill="url(#fv-grass)" stroke="#ffd33d" stroke-width="2" />
    <!-- 内野 -->
    <path :d="`M${HOME.x},${HOME.y} L${BASES[0]!.x},${BASES[0]!.y} Q${HOME.x},${BASES[1]!.y - 22} ${BASES[2]!.x},${BASES[2]!.y} Z`" fill="#d9a066" />
    <polygon :points="`${HOME.x},${HOME.y - 7} ${BASES[0]!.x - 6},${BASES[0]!.y} ${BASES[1]!.x},${BASES[1]!.y + 7} ${BASES[2]!.x + 6},${BASES[2]!.y}`" fill="#49b453" />
    <line :x1="HOME.x" :y1="HOME.y" x2="20" y2="108" stroke="#fff" stroke-width="1.2" opacity="0.8" />
    <line :x1="HOME.x" :y1="HOME.y" x2="280" y2="108" stroke="#fff" stroke-width="1.2" opacity="0.8" />
    <circle :cx="FIELDERS[0]!.x" :cy="FIELDERS[0]!.y" r="6" fill="#d9a066" />
    <!-- 守備位置 -->
    <circle v-for="(f, i) in FIELDERS" :key="i" :cx="f.x" :cy="f.y" r="3.2" fill="#ffffff" opacity="0.55" />
    <!-- ベース -->
    <rect v-for="(b, i) in BASES" :key="`b${i}`" :x="b.x - 4" :y="b.y - 4" width="8" height="8" :transform="`rotate(45 ${b.x} ${b.y})`" fill="#fff" />
    <path :d="`M${HOME.x - 4},${HOME.y - 3} h8 v3 l-4,4 l-4,-4z`" fill="#fff" />
    <!-- 走者 -->
    <g v-for="(r, i) in bases" :key="`r${i}`">
      <circle v-if="r" :cx="BASES[i]!.x" :cy="BASES[i]!.y - 9" r="7" :fill="ownBatting ? '#2f6fe0' : '#e5484d'" stroke="#fff" stroke-width="2" class="runner" />
    </g>
    <!-- 打球 -->
    <g v-if="ball" :key="ball.key">
      <path :d="ball.d" fill="none" :stroke="ball.color" stroke-width="2.6" stroke-linecap="round" stroke-dasharray="400" stroke-dashoffset="400" class="trail" />
      <circle :cx="ball.end.x" :cy="ball.end.y" r="5" :fill="ball.color" stroke="#1b2638" stroke-width="1" class="landing" />
      <circle v-if="ball.hr" :cx="ball.end.x" :cy="ball.end.y" r="14" fill="none" stroke="#ffcf33" stroke-width="2" class="burst" />
    </g>
  </svg>
</template>

<style scoped>
.field {
  width: 100%;
  display: block;
  border-radius: 14px;
  box-shadow: inset 0 0 0 2px rgba(255, 255, 255, 0.25), 0 4px 0 #1f5e2b;
}
.trail {
  animation: draw 0.7s ease-out forwards;
}
.landing {
  opacity: 0;
  animation: land 0.3s ease-out 0.65s forwards;
}
.burst {
  opacity: 0;
  transform-origin: center;
  transform-box: fill-box;
  animation: burst 0.8s ease-out 0.7s forwards;
}
.runner {
  animation: pop-in 0.25s ease-out;
}
@keyframes draw {
  to {
    stroke-dashoffset: 0;
  }
}
@keyframes land {
  from {
    opacity: 0;
    transform: scale(0.3);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}
@keyframes burst {
  0% {
    opacity: 1;
    transform: scale(0.4);
  }
  100% {
    opacity: 0;
    transform: scale(2.4);
  }
}
</style>
