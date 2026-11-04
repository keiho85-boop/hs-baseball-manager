<script setup lang="ts">
// 下部タブ専用のアイコン。光沢と陰影を付けた、小さな立体模型のような絵柄
import { useId } from 'vue'

defineProps<{ name: 'home' | 'players' | 'team' | 'school' | 'records' | 'pennant' | 'news'; size?: number }>()
const uid = useId()
const id = (n: string) => `${uid}-${n}`
</script>

<template>
  <svg :width="size ?? 34" :height="size ?? 34" viewBox="0 0 48 48" class="tab-icon" aria-hidden="true">
    <defs>
      <linearGradient :id="id('gloss')" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#fff" stop-opacity="0.7" />
        <stop offset="0.5" stop-color="#fff" stop-opacity="0" />
      </linearGradient>
      <radialGradient :id="id('shadow')" cx="50%" cy="50%" r="50%">
        <stop offset="0" stop-color="#0b1a33" stop-opacity="0.35" />
        <stop offset="1" stop-color="#0b1a33" stop-opacity="0" />
      </radialGradient>
      <!-- ホーム -->
      <linearGradient :id="id('roof')" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#ff7b6b" />
        <stop offset="1" stop-color="#c8283a" />
      </linearGradient>
      <linearGradient :id="id('wall')" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#fffaf0" />
        <stop offset="1" stop-color="#e3d3b8" />
      </linearGradient>
      <!-- 部員（帽子） -->
      <radialGradient :id="id('cap')" cx="35%" cy="25%" r="85%">
        <stop offset="0" stop-color="#7fb8ff" />
        <stop offset="0.45" stop-color="#2a6fd6" />
        <stop offset="1" stop-color="#0f3a86" />
      </radialGradient>
      <!-- チーム（ボールとバット） -->
      <radialGradient :id="id('ball')" cx="35%" cy="30%" r="75%">
        <stop offset="0" stop-color="#ffffff" />
        <stop offset="0.7" stop-color="#eef2f7" />
        <stop offset="1" stop-color="#b8c4d4" />
      </radialGradient>
      <linearGradient :id="id('bat')" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#f6d7a5" />
        <stop offset="0.5" stop-color="#d89a52" />
        <stop offset="1" stop-color="#9c5f22" />
      </linearGradient>
      <!-- 学校 -->
      <linearGradient :id="id('bldg')" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#fdfdfd" />
        <stop offset="1" stop-color="#c9d5e3" />
      </linearGradient>
      <linearGradient :id="id('bldgRoof')" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#5fd07a" />
        <stop offset="1" stop-color="#1f8a42" />
      </linearGradient>
      <!-- 記録（トロフィー） -->
      <linearGradient :id="id('gold')" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#fff3b0" />
        <stop offset="0.35" stop-color="#ffd23d" />
        <stop offset="0.7" stop-color="#e99a00" />
        <stop offset="1" stop-color="#b86e00" />
      </linearGradient>
    </defs>

    <ellipse cx="24" cy="44" rx="15" ry="3" :fill="`url(#${id('shadow')})`" />

    <g v-if="name === 'home'">
      <path d="M11 22 V39 Q11 41 13 41 H35 Q37 41 37 39 V22 L24 12Z" :fill="`url(#${id('wall')})`" stroke="#b89a6e" stroke-width="1" />
      <rect x="20" y="29" width="8" height="12" rx="1.5" fill="#8a5a2b" />
      <circle cx="26" cy="35.5" r="0.9" fill="#ffd36b" />
      <rect x="14" y="26" width="5" height="5" rx="1" fill="#7cc8ff" stroke="#fff" stroke-width="0.8" />
      <rect x="29" y="26" width="5" height="5" rx="1" fill="#7cc8ff" stroke="#fff" stroke-width="0.8" />
      <path d="M6 24.5 L24 8 L42 24.5 Q43 26 41 26.5 L24 13 L7 26.5 Q5 26 6 24.5Z" :fill="`url(#${id('roof')})`" stroke="#8f1424" stroke-width="0.8" />
      <path d="M12 20 L24 9.5 L30 14.5" fill="none" stroke="#fff" stroke-opacity="0.6" stroke-width="1.4" stroke-linecap="round" />
    </g>

    <g v-else-if="name === 'players'">
      <path d="M8 31 Q7 12 24 11 Q41 12 40 31 Q32 27.5 24 27.5 Q16 27.5 8 31Z" :fill="`url(#${id('cap')})`" stroke="#0b2a66" stroke-width="1" />
      <path d="M24 11 V27.5" stroke="#0b2a66" stroke-opacity="0.35" stroke-width="1" />
      <path d="M5 31.5 Q24 22 43 31.5 Q44 36 39 35.5 Q24 30 9 35.5 Q4 36 5 31.5Z" fill="#164fae" stroke="#0b2a66" stroke-width="1" />
      <path d="M9 32 Q24 25.5 39 32" fill="none" stroke="#fff" stroke-opacity="0.35" stroke-width="1.2" />
      <circle cx="24" cy="19.5" r="4.6" fill="#fff" />
      <path d="M21.6 17.6 L24 22 L26.4 17.6" fill="none" stroke="#1d4fb0" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
      <ellipse cx="16" cy="15.5" rx="5" ry="2.2" fill="#fff" opacity="0.4" transform="rotate(-28 16 15.5)" />
      <circle cx="24" cy="11.2" r="1.6" fill="#0f3a86" />
    </g>

    <g v-else-if="name === 'team'">
      <g transform="rotate(-38 24 24)">
        <path d="M21.5 4 Q24 3 26.5 4 L25.6 30 H22.4Z" :fill="`url(#${id('bat')})`" stroke="#7a4512" stroke-width="0.8" />
        <rect x="22.2" y="30" width="3.6" height="11" rx="1.2" fill="#2b2b33" />
        <ellipse cx="24" cy="42" rx="3.2" ry="1.4" fill="#2b2b33" />
        <path d="M22.6 6 L23 26" stroke="#fff" stroke-opacity="0.55" stroke-width="1" stroke-linecap="round" />
      </g>
      <circle cx="30" cy="30" r="9.5" :fill="`url(#${id('ball')})`" stroke="#9aa8ba" stroke-width="0.8" />
      <path d="M23.5 23.5 Q27.5 30 23.5 36.5 M36.5 23.5 Q32.5 30 36.5 36.5" fill="none" stroke="#e5484d" stroke-width="1.3" stroke-dasharray="1.6 1.4" />
      <ellipse cx="27" cy="26" rx="3.4" ry="2" fill="#fff" opacity="0.9" transform="rotate(-30 27 26)" />
    </g>

    <g v-else-if="name === 'school'">
      <rect x="7" y="20" width="34" height="21" rx="1.5" :fill="`url(#${id('bldg')})`" stroke="#8ea3bd" stroke-width="1" />
      <path d="M16 20 L24 9 L32 20Z" :fill="`url(#${id('bldgRoof')})`" stroke="#16683a" stroke-width="0.8" />
      <rect x="18" y="15" width="12" height="26" fill="#f4f7fb" stroke="#8ea3bd" stroke-width="1" />
      <circle cx="24" cy="19.5" r="3.4" fill="#fff" stroke="#e9a400" stroke-width="1.4" />
      <path d="M24 17.6 V19.6 L25.4 20.6" stroke="#1d2a3d" stroke-width="0.9" fill="none" stroke-linecap="round" />
      <g fill="#7cc8ff" stroke="#fff" stroke-width="0.6">
        <rect x="9.5" y="24" width="5" height="4.5" rx="0.6" /><rect x="9.5" y="31.5" width="5" height="4.5" rx="0.6" />
        <rect x="33.5" y="24" width="5" height="4.5" rx="0.6" /><rect x="33.5" y="31.5" width="5" height="4.5" rx="0.6" />
      </g>
      <rect x="21" y="32" width="6" height="9" rx="1" fill="#2f6fe0" />
      <path d="M24 9 V4" stroke="#6b7a90" stroke-width="1" />
      <path d="M24 4 L30 5.5 L24 7Z" fill="#e5484d" />
    </g>

    <g v-else-if="name === 'pennant'">
      <rect x="10" y="6" width="2.6" height="36" rx="1.2" fill="#8a6a44" />
      <circle cx="11.3" cy="6" r="2.4" :fill="`url(#${id('gold')})`" />
      <path d="M12.6 9 L40 17 L12.6 26Z" :fill="`url(#${id('roof')})`" stroke="#8f1424" stroke-width="0.8" stroke-linejoin="round" />
      <path d="M15 13 L30 17" stroke="#fff" stroke-opacity="0.55" stroke-width="1.4" stroke-linecap="round" />
      <circle cx="22" cy="17.5" r="3.4" fill="#fff" />
      <path d="M20.3 16.2 L22 19.2 L23.7 16.2" fill="none" stroke="#c8283a" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" />
    </g>

    <g v-else-if="name === 'news'">
      <path d="M8 20 H15 L31 11 V37 L15 28 H8Z" :fill="`url(#${id('cap')})`" stroke="#0b2a66" stroke-width="1" stroke-linejoin="round" />
      <rect x="11" y="28" width="5" height="9" rx="1.5" fill="#164fae" />
      <path d="M10 22 H15 L28 15" fill="none" stroke="#fff" stroke-opacity="0.5" stroke-width="1.3" stroke-linecap="round" />
      <path d="M35 17 Q38.5 24 35 31" fill="none" stroke="#e99a00" stroke-width="2.4" stroke-linecap="round" />
      <path d="M38.5 13.5 Q44 24 38.5 34.5" fill="none" stroke="#ffd23d" stroke-width="2.2" stroke-linecap="round" />
    </g>

    <g v-else>
      <path d="M14 10 H34 V18 Q34 30 24 31 Q14 30 14 18Z" :fill="`url(#${id('gold')})`" stroke="#8a5200" stroke-width="1" />
      <path d="M14 13 Q6 13 7.5 20 Q9 25 15.5 25" fill="none" stroke="#e9a400" stroke-width="2.6" stroke-linecap="round" />
      <path d="M34 13 Q42 13 40.5 20 Q39 25 32.5 25" fill="none" stroke="#e9a400" stroke-width="2.6" stroke-linecap="round" />
      <rect x="21.5" y="30.5" width="5" height="5" :fill="`url(#${id('gold')})`" />
      <path d="M15 41 Q15 35.5 24 35.5 Q33 35.5 33 41Z" fill="#7a4a1a" stroke="#4d2c0c" stroke-width="0.8" />
      <rect x="13" y="40" width="22" height="3.2" rx="1" fill="#5a3410" />
      <path d="M24 14.5 L25.6 18 L29.4 18.3 L26.5 20.7 L27.4 24.4 L24 22.4 L20.6 24.4 L21.5 20.7 L18.6 18.3 L22.4 18Z" fill="#fff6c8" />
      <path d="M16.5 12 Q16 21 20 27" fill="none" stroke="#fff" stroke-opacity="0.7" stroke-width="1.6" stroke-linecap="round" />
    </g>

    <path v-if="name === 'home' || name === 'players' || name === 'school' || name === 'records'" d="M10 14 Q24 2 38 14 V18 H10Z" :fill="`url(#${id('gloss')})`" opacity="0.25" />
  </svg>
</template>

<style scoped>
.tab-icon {
  display: block;
  overflow: visible;
}
</style>
