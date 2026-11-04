<script setup lang="ts">
// 斜め上から見たグラウンド。走者の名前と、直前の打球を描く
import { computed } from 'vue'
import type { PlayEvent } from '@/game/match/types'

const props = defineProps<{
  bases: (string | null)[]
  /** 走者の名前（選手IDから引く） */
  names: Record<string, string>
  lastEvent: PlayEvent | null
  ownBatting: boolean
}>()

const W = 360
const HOME_Y = 206
/** メートル（x：右が＋、y：センター方向が＋）を画面の座標に変える（遠いほど小さく見える） */
function proj(x: number, y: number): { x: number; y: number } {
  const z = Math.max(-8, y)
  const k = (2.55 * 110) / (z + 110)
  return { x: W / 2 + x * k, y: HOME_Y - (340 * z) / (z + 110) }
}

const pts = (list: { x: number; y: number }[]) => list.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')

const fence = (() => {
  const list = []
  for (let d = -45; d <= 45; d += 3) {
    const dist = 92 + 26 * Math.cos((d * Math.PI) / 90)
    const r = (d * Math.PI) / 180
    list.push(proj(Math.sin(r) * dist, Math.cos(r) * dist))
  }
  return list
})()
const wall = (() => {
  const list = []
  for (let d = -45; d <= 45; d += 3) {
    const dist = 92 + 26 * Math.cos((d * Math.PI) / 90) + 7
    const r = (d * Math.PI) / 180
    list.push(proj(Math.sin(r) * dist, Math.cos(r) * dist))
  }
  return list
})()

const HOME = proj(0, 0)
const B1 = proj(19.4, 19.4)
const B2 = proj(0, 27.4)
const B3 = proj(-19.4, 19.4)
const BASES = [B1, B2, B3]
const MOUND = proj(0, 18.4)
// 内野の土の部分（ベースより少し外側まで）
const DIRT = [proj(0, -4), proj(29, 27), proj(0, 45), proj(-29, 27)]
const INNER = [proj(0, 3), proj(17.2, 19.4), proj(0, 25), proj(-17.2, 19.4)]
const LINE_L = proj(-66, 66)
const LINE_R = proj(66, 66)

const runners = computed(() =>
  props.bases.map((id, i) => (id ? { name: props.names[id] ?? '', pos: BASES[i]! } : null)),
)

const ball = computed(() => {
  const e = props.lastEvent
  if (!e?.ball) return null
  const end = proj(e.ball.x, e.ball.y)
  const lift = e.ball.type === 'fly' ? 80 : e.ball.type === 'pop' ? 70 : e.ball.type === 'line' ? 26 : 4
  const hits = ['single', 'double', 'triple', 'homerun']
  return {
    d: `M${HOME.x},${HOME.y - 3} Q${(HOME.x + end.x) / 2},${Math.min(HOME.y, end.y) - lift} ${end.x},${end.y}`,
    end,
    color: e.kind === 'homerun' ? '#ffd33d' : hits.includes(e.kind) ? '#ff5a4f' : '#ffffff',
    key: `${e.inning}-${e.top}-${e.batterId}-${e.text}`,
    hr: e.kind === 'homerun',
  }
})
</script>

<template>
  <svg class="fp" :viewBox="`0 0 ${W} 222`" preserveAspectRatio="xMidYMid meet" aria-label="グラウンド">
    <defs>
      <linearGradient id="fp-grass" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#2f8d3f" />
        <stop offset="1" stop-color="#4cbf58" />
      </linearGradient>
      <linearGradient id="fp-stand" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#1d3b2c" />
        <stop offset="0.55" stop-color="#16304a" stop-opacity="0.6" />
        <stop offset="1" stop-color="#16304a" stop-opacity="0" />
      </linearGradient>
      <pattern id="fp-stripe" width="22" height="22" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <rect width="11" height="22" fill="#ffffff" opacity="0.06" />
      </pattern>
    </defs>
    <!-- スタンドとフェンス -->
    <polygon :points="`${pts(wall)} ${W},222 0,222`" fill="url(#fp-stand)" />
    <polyline :points="pts(wall)" fill="none" stroke="#0f2219" stroke-width="10" />
    <!-- 芝生 -->
    <polygon :points="`${HOME.x},${HOME.y + 8} ${pts(fence)}`" fill="url(#fp-grass)" />
    <polygon :points="`${HOME.x},${HOME.y + 8} ${pts(fence)}`" fill="url(#fp-stripe)" />
    <polyline :points="pts(fence)" fill="none" stroke="#ffd33d" stroke-width="2" />
    <!-- 内野 -->
    <polygon :points="pts(DIRT)" fill="#d7a26b" />
    <polygon :points="pts(INNER)" fill="#4cbf58" />
    <line :x1="HOME.x" :y1="HOME.y" :x2="LINE_L.x" :y2="LINE_L.y" stroke="#fff" stroke-width="1.3" opacity="0.85" />
    <line :x1="HOME.x" :y1="HOME.y" :x2="LINE_R.x" :y2="LINE_R.y" stroke="#fff" stroke-width="1.3" opacity="0.85" />
    <ellipse :cx="MOUND.x" :cy="MOUND.y" rx="13" ry="5" fill="#d7a26b" />
    <ellipse :cx="HOME.x" :cy="HOME.y" rx="16" ry="6" fill="#d7a26b" />
    <!-- ベース -->
    <g v-for="(b, i) in BASES" :key="i">
      <polygon :points="`${b.x},${b.y - 4} ${b.x + 7},${b.y} ${b.x},${b.y + 4} ${b.x - 7},${b.y}`" :fill="bases[i] ? (ownBatting ? '#3aa8f0' : '#ff5a4f') : '#ffffff'" />
    </g>
    <polygon :points="`${HOME.x - 6},${HOME.y - 2} ${HOME.x + 6},${HOME.y - 2} ${HOME.x + 6},${HOME.y + 1} ${HOME.x},${HOME.y + 4} ${HOME.x - 6},${HOME.y + 1}`" fill="#fff" />
    <!-- 打球 -->
    <g v-if="ball" :key="ball.key">
      <path :d="ball.d" fill="none" :stroke="ball.color" stroke-width="2.4" stroke-linecap="round" stroke-dasharray="500" stroke-dashoffset="500" class="trail" />
      <circle :cx="ball.end.x" :cy="ball.end.y" r="4.5" :fill="ball.color" stroke="#0f1b2d" stroke-width="1" class="landing" />
      <circle v-if="ball.hr" :cx="ball.end.x" :cy="ball.end.y" r="12" fill="none" stroke="#ffd33d" stroke-width="2" class="burst" />
    </g>
    <!-- 走者の名前 -->
    <g v-for="(r, i) in runners" :key="`r${i}`">
      <g v-if="r" class="tag">
        <rect :x="r.pos.x - 22" :y="r.pos.y - 28" width="44" height="18" rx="4" fill="#0f1b2d" opacity="0.85" stroke="#ffffff55" />
        <text :x="r.pos.x" :y="r.pos.y - 15" text-anchor="middle" fill="#fff" font-size="11" font-weight="800">{{ r.name }}</text>
      </g>
    </g>
  </svg>
</template>

<style scoped>
.fp {
  width: 100%;
  height: 100%;
  display: block;
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
.tag {
  animation: pop-in 0.25s ease-out;
  transform-box: fill-box;
  transform-origin: center;
}
@keyframes draw {
  to {
    stroke-dashoffset: 0;
  }
}
@keyframes land {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
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
