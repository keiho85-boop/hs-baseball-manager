<script setup lang="ts">
// 顔パーツの組み合わせで描く選手の顔（このゲーム独自の絵柄）。
// AI生成イラストのパーツが用意できたら差し替える
import { computed, useId } from 'vue'
import type { FaceParts } from '@/game/types'

const props = withDefaults(defineProps<{ face: FaceParts; size?: number; capColor?: string }>(), {
  size: 40,
  capColor: '#1d3f7a',
})

const uid = useId()
const id = (name: string) => `${uid}-${name}`

const SKINS = [
  ['#ffe6cf', '#f5c9a3'],
  ['#fbd9b8', '#eab48a'],
  ['#efc195', '#d79a68'],
  ['#d9a274', '#b97d4f'],
]
const HAIR_COLORS = ['#2a221d', '#4a3426', '#1b1d29']
const OUTLINES = [
  // 丸顔
  'M26 46 Q26 30 50 30 Q74 30 74 46 V56 Q74 76 50 80 Q26 76 26 56Z',
  // 面長
  'M28 44 Q28 30 50 30 Q72 30 72 44 V58 Q72 78 50 83 Q28 78 28 58Z',
  // えら張り
  'M25 46 Q25 30 50 30 Q75 30 75 46 V60 Q74 72 62 78 Q50 83 38 78 Q26 72 25 60Z',
  // 卵形
  'M27 45 Q27 30 50 30 Q73 30 73 45 V55 Q72 74 50 81 Q28 74 27 55Z',
]
// 帽子の下から見える髪（もみあげ・前髪）
const HAIRS = [
  'M26 44 L26 54 L30 50 L30 42Z M74 44 L74 54 L70 50 L70 42Z',
  'M26 42 L25 58 L31 52 L31 41Z M74 42 L75 58 L69 52 L69 41Z M36 40 L42 46 L46 40Z',
  'M27 44 L27 49 L30 46Z M73 44 L73 49 L70 46Z',
  'M25 42 L24 60 L32 53 L31 40Z M75 42 L76 60 L68 53 L69 40Z M34 40 L39 47 L43 41 L48 47 L52 41Z',
  'M26 42 L26 55 L31 50 L31 41Z M74 42 L74 55 L69 50 L69 41Z M54 40 L60 47 L64 40Z',
  'M26 43 L25 51 L30 48 L30 42Z M74 43 L75 51 L70 48 L70 42Z',
  'M24 42 L22 64 L31 56 L31 40Z M76 42 L78 64 L69 56 L69 40Z',
  'M26 42 L26 53 L31 49 L31 41Z M74 42 L74 53 L69 49 L69 41Z M40 40 L44 45 L48 40 L52 45 L56 40Z',
]
const BROWS = [
  'M35 49 L45 48 M55 48 L65 49',
  'M35 50 L45 46.5 M55 46.5 L65 50',
  'M35 47.5 L45 49.5 M55 49.5 L65 47.5',
  'M35 49 Q40 45.5 45 48.5 M55 48.5 Q60 45.5 65 49',
]
const MOUTHS = [
  'M44 69 Q50 73.5 56 69',
  'M45 70.5 L55 70.5',
  'M43 68 Q50 76 57 68 Z',
  'M45 71.5 Q50 68.5 55 71.5',
  'M43.5 69.5 Q50 72.5 57 68',
]

const skin = computed(() => SKINS[props.face.skin % SKINS.length]!)
const hairColor = computed(() => HAIR_COLORS[props.face.hairColor % HAIR_COLORS.length])
const outline = computed(() => OUTLINES[props.face.outline % OUTLINES.length])
const hair = computed(() => HAIRS[props.face.hair % HAIRS.length])
const brows = computed(() => BROWS[props.face.brows % BROWS.length])
const mouth = computed(() => MOUTHS[props.face.mouth % MOUTHS.length])
const eyeType = computed(() => props.face.eyes % 6)
const openMouth = computed(() => props.face.mouth % MOUTHS.length === 2)
</script>

<template>
  <svg :width="size" :height="size" viewBox="0 0 100 100" class="face" aria-hidden="true">
    <defs>
      <radialGradient :id="id('bg')" cx="50%" cy="35%" r="70%">
        <stop offset="0" stop-color="#ffffff" />
        <stop offset="1" stop-color="#cfeaff" />
      </radialGradient>
      <!-- 左上から光が当たる立体的な陰影 -->
      <radialGradient :id="id('skin')" cx="38%" cy="40%" r="70%">
        <stop offset="0" stop-color="#fff6ec" />
        <stop offset="0.28" :stop-color="skin[0]" />
        <stop offset="0.8" :stop-color="skin[1]" />
        <stop offset="1" :stop-color="skin[1]" stop-opacity="0.9" />
      </radialGradient>
      <linearGradient :id="id('brimShade')" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#3a1d0a" stop-opacity="0.38" />
        <stop offset="1" stop-color="#3a1d0a" stop-opacity="0" />
      </linearGradient>
      <linearGradient :id="id('jaw')" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#3a1d0a" stop-opacity="0" />
        <stop offset="0.7" stop-color="#3a1d0a" stop-opacity="0" />
        <stop offset="1" stop-color="#3a1d0a" stop-opacity="0.22" />
      </linearGradient>
      <radialGradient :id="id('cap')" cx="35%" cy="25%" r="80%">
        <stop offset="0" stop-color="#ffffff" stop-opacity="0.55" />
        <stop offset="0.18" :stop-color="capColor" stop-opacity="0.92" />
        <stop offset="0.75" :stop-color="capColor" />
        <stop offset="1" stop-color="#000" stop-opacity="0.55" />
      </radialGradient>
      <linearGradient :id="id('brim')" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" :stop-color="capColor" />
        <stop offset="1" stop-color="#000" stop-opacity="0.7" />
      </linearGradient>
      <linearGradient :id="id('uni')" x1="0" y1="0" x2="1" y2="0.4">
        <stop offset="0" stop-color="#ffffff" />
        <stop offset="1" stop-color="#c7d3e2" />
      </linearGradient>
      <clipPath :id="id('faceClip')"><path :d="outline" /></clipPath>
      <radialGradient :id="id('iris')" cx="50%" cy="35%" r="65%">
        <stop offset="0" stop-color="#6b4a32" />
        <stop offset="1" stop-color="#20160f" />
      </radialGradient>
      <clipPath :id="id('clip')"><circle cx="50" cy="50" r="47" /></clipPath>
    </defs>

    <circle cx="50" cy="50" r="49" fill="#fff" />
    <circle cx="50" cy="50" r="47" :fill="`url(#${id('bg')})`" />
    <g :clip-path="`url(#${id('clip')})`">
      <!-- ユニフォーム -->
      <path d="M18 100 Q20 84 38 81 L50 88 L62 81 Q80 84 82 100Z" :fill="`url(#${id('uni')})`" stroke="#b8c8da" stroke-width="1" />
      <path d="M38 81 L50 92 L62 81" fill="none" :stroke="capColor" stroke-width="3" stroke-linejoin="round" />
      <rect x="43" y="74" width="14" height="10" :fill="skin[1]" />
      <!-- 耳 -->
      <ellipse cx="25.5" cy="55" rx="4.5" ry="6.5" :fill="skin[1]" />
      <ellipse cx="74.5" cy="55" rx="4.5" ry="6.5" :fill="skin[1]" />
      <!-- 顔 -->
      <path :d="outline" :fill="`url(#${id('skin')})`" />
      <g :clip-path="`url(#${id('faceClip')})`">
        <rect x="20" y="40" width="60" height="14" :fill="`url(#${id('brimShade')})`" />
        <rect x="20" y="30" width="60" height="60" :fill="`url(#${id('jaw')})`" />
        <ellipse cx="38" cy="62" rx="7" ry="4" fill="#fff" opacity="0.18" />
        <ellipse cx="50" cy="82" rx="22" ry="6" fill="#3a1d0a" opacity="0.12" />
      </g>
      <!-- 髪 -->
      <path :d="hair" :fill="hairColor" />
      <!-- 帽子 -->
      <path d="M23 44 Q22 16 50 14 Q78 16 77 44 Q64 39 50 39 Q36 39 23 44Z" :fill="`url(#${id('cap')})`" />
      <path d="M30 22 Q50 12 70 22" fill="none" stroke="#fff" stroke-opacity="0.25" stroke-width="2" />
      <path d="M50 14 V39" stroke="#000" stroke-opacity="0.15" stroke-width="1" />
      <path d="M21 44.5 Q50 34 79 44.5 Q79 49 74 48.5 Q50 42 26 48.5 Q21 49 21 44.5Z" :fill="`url(#${id('brim')})`" />
      <path d="M27 42.5 Q50 35.5 73 42.5" fill="none" stroke="#fff" stroke-opacity="0.35" stroke-width="1.2" stroke-linecap="round" />
      <ellipse cx="38" cy="22" rx="7" ry="3.2" fill="#fff" opacity="0.28" transform="rotate(-24 38 22)" />
      <path d="M24 45.5 Q50 37 76 45.5" fill="none" stroke="#000" stroke-opacity="0.25" stroke-width="1.2" />
      <circle cx="50" cy="27" r="6" fill="#fff" />
      <path d="M47 24 L50 30 L53 24" fill="none" :stroke="capColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
      <!-- 眉 -->
      <path :d="brows" :stroke="hairColor" stroke-width="2.8" stroke-linecap="round" fill="none" />
      <!-- 目 -->
      <g v-if="eyeType === 0 || eyeType === 4">
        <ellipse cx="40" cy="57" :rx="eyeType === 4 ? 5 : 4.2" :ry="eyeType === 4 ? 5.6 : 4.8" fill="#fff" />
        <ellipse cx="60" cy="57" :rx="eyeType === 4 ? 5 : 4.2" :ry="eyeType === 4 ? 5.6 : 4.8" fill="#fff" />
        <ellipse cx="40.4" cy="57.6" :rx="eyeType === 4 ? 3.6 : 3" :ry="eyeType === 4 ? 4.2 : 3.6" :fill="`url(#${id('iris')})`" />
        <ellipse cx="59.6" cy="57.6" :rx="eyeType === 4 ? 3.6 : 3" :ry="eyeType === 4 ? 4.2 : 3.6" :fill="`url(#${id('iris')})`" />
        <circle cx="41.6" cy="55.8" r="1.4" fill="#fff" /><circle cx="60.8" cy="55.8" r="1.4" fill="#fff" />
        <circle cx="39.3" cy="59.3" r="0.7" fill="#fff" opacity="0.8" /><circle cx="58.5" cy="59.3" r="0.7" fill="#fff" opacity="0.8" />
        <path d="M35.5 53.5 Q40 51.5 44.5 53.5 M55.5 53.5 Q60 51.5 64.5 53.5" stroke="#20160f" stroke-width="1.8" fill="none" stroke-linecap="round" />
      </g>
      <g v-else-if="eyeType === 1">
        <ellipse cx="40" cy="57.5" rx="2.6" ry="3.6" :fill="`url(#${id('iris')})`" />
        <ellipse cx="60" cy="57.5" rx="2.6" ry="3.6" :fill="`url(#${id('iris')})`" />
        <circle cx="40.9" cy="56.2" r="1" fill="#fff" /><circle cx="60.9" cy="56.2" r="1" fill="#fff" />
      </g>
      <g v-else-if="eyeType === 2">
        <path d="M35.5 57.5 Q40 53.5 44.5 57.5 M55.5 57.5 Q60 53.5 64.5 57.5" stroke="#20160f" stroke-width="2.6" fill="none" stroke-linecap="round" />
      </g>
      <g v-else-if="eyeType === 3">
        <path d="M35 55 L45 56.5 L44 58.5 Q40 60 36 57.5Z" fill="#20160f" />
        <path d="M65 55 L55 56.5 L56 58.5 Q60 60 64 57.5Z" fill="#20160f" />
        <circle cx="41.5" cy="57" r="0.9" fill="#fff" /><circle cx="58.5" cy="57" r="0.9" fill="#fff" />
      </g>
      <g v-else>
        <path d="M35.5 56 Q40 59 44.5 56" stroke="#20160f" stroke-width="2.4" fill="none" stroke-linecap="round" />
        <path d="M55.5 56 Q60 59 64.5 56" stroke="#20160f" stroke-width="2.4" fill="none" stroke-linecap="round" />
      </g>
      <!-- ほお -->
      <ellipse cx="34" cy="65" rx="4.5" ry="2.4" fill="#ff8f8f" opacity="0.28" />
      <ellipse cx="66" cy="65" rx="4.5" ry="2.4" fill="#ff8f8f" opacity="0.28" />
      <!-- 鼻 -->
      <path d="M50.5 61 Q52.5 64 50 65" :stroke="skin[1]" stroke-width="1.8" fill="none" stroke-linecap="round" />
      <!-- 口 -->
      <path :d="mouth" stroke="#8a3b2e" stroke-width="2.2" :fill="openMouth ? '#b34a3c' : 'none'" stroke-linecap="round" stroke-linejoin="round" />
    </g>
    <circle cx="50" cy="50" r="47.5" fill="none" stroke="#9fc8ea" stroke-width="2" />
    <!-- 丸い枠に光沢（ガラス玉のような立体感） -->
    <path d="M14 38 A38 38 0 0 1 62 10" fill="none" stroke="#fff" stroke-opacity="0.75" stroke-width="2.4" stroke-linecap="round" />
  </svg>
</template>

<style scoped>
.face {
  flex-shrink: 0;
  filter: drop-shadow(0 2px 0 rgba(23, 50, 87, 0.15)) drop-shadow(0 3px 4px rgba(23, 50, 87, 0.18));
}
</style>
