<script setup lang="ts">
// 顔パーツの組み合わせで描く仮の顔。AI生成イラストのパーツが用意できたら差し替える
import { computed } from 'vue'
import type { FaceParts } from '@/game/types'

const props = defineProps<{ face: FaceParts; size?: number }>()

const SKINS = ['#f6d7b8', '#eec39a', '#e0ac7e', '#c98e62']
const HAIR_COLORS = ['#2b2420', '#4a3426', '#1c1c24']
const OUTLINES = [
  'M20 46 Q20 18 50 16 Q80 18 80 46 Q80 78 50 84 Q20 78 20 46Z',
  'M22 44 Q22 16 50 16 Q78 16 78 44 Q78 72 62 80 Q50 86 38 80 Q22 72 22 44Z',
  'M18 48 Q18 18 50 17 Q82 18 82 48 Q82 82 50 84 Q18 82 18 48Z',
  'M23 42 Q24 16 50 16 Q76 16 77 42 L76 62 Q70 82 50 84 Q30 82 24 62Z',
]
const HAIRS = [
  'M20 44 Q18 14 50 12 Q82 14 80 44 Q74 26 50 26 Q26 26 20 44Z', // 短髪
  'M19 46 Q16 10 50 10 Q84 10 81 46 Q78 30 66 24 Q50 32 30 26 Q22 32 19 46Z', // 前髪あり
  'M22 38 Q24 16 50 15 Q76 16 78 38 Q70 30 50 30 Q30 30 22 38Z', // 坊主寄り
  'M18 50 Q14 8 50 9 Q86 8 82 50 Q80 28 70 22 L60 30 L52 22 L42 30 L32 22 Q22 30 18 50Z', // ツンツン
  'M20 46 Q18 12 52 11 Q84 14 80 40 Q70 22 46 24 Q30 26 20 46Z', // 流し
  'M21 40 Q22 14 50 13 Q78 14 79 40 Q78 34 50 34 Q22 34 21 40Z', // 角刈り
  'M19 52 Q12 10 50 10 Q88 10 81 52 L78 38 Q70 22 50 22 Q30 22 22 38Z', // 長め
  'M20 42 Q20 14 50 13 Q80 14 80 42 Q66 34 54 22 Q42 34 20 42Z', // 分け目
]
const BROWS = [
  'M33 42 L44 41 M56 41 L67 42',
  'M33 43 L44 40 M56 40 L67 43',
  'M33 40 L44 42 M56 42 L67 40',
  'M34 41 Q39 38 44 41 M56 41 Q61 38 66 41',
]
const MOUTHS = [
  'M43 70 Q50 74 57 70',
  'M44 71 L56 71',
  'M42 69 Q50 77 58 69 Z',
  'M45 72 Q50 69 55 72',
  'M43 70 Q50 73 57 69',
]

const skin = computed(() => SKINS[props.face.skin % SKINS.length])
const hairColor = computed(() => HAIR_COLORS[props.face.hairColor % HAIR_COLORS.length])
const outline = computed(() => OUTLINES[props.face.outline % OUTLINES.length])
const hair = computed(() => HAIRS[props.face.hair % HAIRS.length])
const brows = computed(() => BROWS[props.face.brows % BROWS.length])
const mouth = computed(() => MOUTHS[props.face.mouth % MOUTHS.length])
const eyeType = computed(() => props.face.eyes % 6)
</script>

<template>
  <svg :width="size ?? 40" :height="size ?? 40" viewBox="0 0 100 100" class="face" aria-hidden="true">
    <circle cx="50" cy="50" r="49" fill="#e6efe8" />
    <ellipse cx="19" cy="52" rx="5" ry="8" :fill="skin" />
    <ellipse cx="81" cy="52" rx="5" ry="8" :fill="skin" />
    <path :d="outline" :fill="skin" stroke="#00000022" stroke-width="1" />
    <path :d="hair" :fill="hairColor" />
    <path :d="brows" stroke="#2b2420" stroke-width="2.6" stroke-linecap="round" fill="none" />
    <g fill="#2b2420">
      <template v-if="eyeType === 0">
        <circle cx="39" cy="52" r="3.2" /><circle cx="61" cy="52" r="3.2" />
      </template>
      <template v-else-if="eyeType === 1">
        <ellipse cx="39" cy="52" rx="2.6" ry="4" /><ellipse cx="61" cy="52" rx="2.6" ry="4" />
      </template>
      <template v-else-if="eyeType === 2">
        <path d="M34 52 Q39 48 44 52 M56 52 Q61 48 66 52" stroke="#2b2420" stroke-width="2.6" fill="none" stroke-linecap="round" />
      </template>
      <template v-else-if="eyeType === 3">
        <path d="M34 53 L44 51 M56 51 L66 53" stroke="#2b2420" stroke-width="2.8" stroke-linecap="round" />
      </template>
      <template v-else-if="eyeType === 4">
        <circle cx="39" cy="52" r="4" fill="#fff" stroke="#2b2420" stroke-width="1.5" /><circle cx="39" cy="53" r="2" />
        <circle cx="61" cy="52" r="4" fill="#fff" stroke="#2b2420" stroke-width="1.5" /><circle cx="61" cy="53" r="2" />
      </template>
      <template v-else>
        <path d="M34 50 Q39 55 44 50 M56 50 Q61 55 66 50" stroke="#2b2420" stroke-width="2.6" fill="none" stroke-linecap="round" />
      </template>
    </g>
    <path d="M50 57 L48 63 L52 63" stroke="#00000044" stroke-width="1.5" fill="none" stroke-linejoin="round" />
    <path :d="mouth" stroke="#7a3b2e" stroke-width="2.4" fill="none" stroke-linecap="round" />
  </svg>
</template>

<style scoped>
.face {
  flex-shrink: 0;
  border-radius: 50%;
}
</style>
