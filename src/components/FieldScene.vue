<script setup lang="ts">
// 青空と球場の背景イラスト（SVGで描画、このゲーム独自の絵柄）
import { useId } from 'vue'

withDefaults(defineProps<{ height?: number; evening?: boolean }>(), { height: 170, evening: false })
const uid = useId()
const id = (name: string) => `${uid}-${name}`
</script>

<template>
  <svg class="scene" :style="{ height: `${height}px` }" viewBox="0 0 400 170" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
    <defs>
      <linearGradient :id="id('sky')" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" :stop-color="evening ? '#f2785a' : '#2f9fef'" />
        <stop offset="0.6" :stop-color="evening ? '#ffb27a' : '#7cc9fa'" />
        <stop offset="1" :stop-color="evening ? '#ffe2a8' : '#d4f0ff'" />
      </linearGradient>
      <radialGradient :id="id('sun')" cx="50%" cy="50%" r="50%">
        <stop offset="0" stop-color="#ffffff" />
        <stop offset="0.25" :stop-color="evening ? '#fff0b8' : '#fffbe0'" />
        <stop offset="1" :stop-color="evening ? '#ffcf80' : '#ffffff'" stop-opacity="0" />
      </radialGradient>
      <linearGradient :id="id('grass')" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#5fca5f" />
        <stop offset="1" stop-color="#2a9137" />
      </linearGradient>
      <linearGradient :id="id('dirt')" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#e3ad74" />
        <stop offset="1" stop-color="#c98b52" />
      </linearGradient>
      <linearGradient :id="id('stand')" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#8fa8c4" />
        <stop offset="1" stop-color="#5f7a99" />
      </linearGradient>
      <linearGradient :id="id('wall')" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#2f8a52" />
        <stop offset="1" stop-color="#1f6a3c" />
      </linearGradient>
      <pattern :id="id('crowd')" width="6" height="5" patternUnits="userSpaceOnUse">
        <circle cx="1.5" cy="2" r="1.1" fill="#ffffff" opacity="0.55" />
        <circle cx="4.5" cy="3.5" r="1.1" fill="#ffd36b" opacity="0.5" />
      </pattern>
    </defs>

    <rect width="400" height="170" :fill="`url(#${id('sky')})`" />
    <!-- 太陽の光 -->
    <circle cx="336" cy="30" r="46" :fill="`url(#${id('sun')})`" />
    <g opacity="0.18" fill="#fff">
      <path d="M336 30 L400 -6 L400 12Z" /><path d="M336 30 L400 40 L400 58Z" /><path d="M336 30 L290 -10 L306 -10Z" />
    </g>
    <!-- 雲 -->
    <g class="clouds">
      <g fill="#fff">
        <ellipse cx="66" cy="34" rx="32" ry="11" /><ellipse cx="88" cy="27" rx="19" ry="12" /><ellipse cx="50" cy="29" rx="15" ry="10" />
      </g>
      <ellipse cx="68" cy="40" rx="30" ry="4" fill="#cfe6f7" opacity="0.7" />
      <g fill="#fff" opacity="0.85">
        <ellipse cx="214" cy="20" rx="24" ry="8" /><ellipse cx="230" cy="15" rx="13" ry="8" />
      </g>
    </g>
    <!-- 遠くの山と街 -->
    <path d="M0 76 Q50 54 100 70 Q150 50 200 66 Q250 52 300 68 Q350 54 400 64 V96 H0Z" :fill="evening ? '#c98a8a' : '#9fcfe8'" opacity="0.6" />
    <!-- スタンド（左右） -->
    <path d="M0 74 L118 82 L118 100 L0 100Z" :fill="`url(#${id('stand')})`" />
    <path d="M0 74 L118 82 L118 100 L0 100Z" :fill="`url(#${id('crowd')})`" />
    <path d="M0 70 L120 79 L120 82 L0 74Z" fill="#e8eef5" />
    <path d="M282 82 L400 74 L400 100 L282 100Z" :fill="`url(#${id('stand')})`" />
    <path d="M282 82 L400 74 L400 100 L282 100Z" :fill="`url(#${id('crowd')})`" />
    <path d="M280 79 L400 70 L400 74 L280 82Z" fill="#e8eef5" />
    <!-- 照明 -->
    <g>
      <rect x="20" y="40" width="2.5" height="36" fill="#b8c4d2" /><rect x="12" y="34" width="18" height="8" rx="1.5" fill="#eef3f8" stroke="#9aa9bb" stroke-width="1" />
      <rect x="377" y="40" width="2.5" height="36" fill="#b8c4d2" /><rect x="369" y="34" width="18" height="8" rx="1.5" fill="#eef3f8" stroke="#9aa9bb" stroke-width="1" />
    </g>
    <!-- スコアボード -->
    <g>
      <rect x="160" y="50" width="80" height="36" rx="3" fill="#1e3a2c" stroke="#e8eef5" stroke-width="2" />
      <g fill="#ffd36b" opacity="0.85">
        <rect x="167" y="57" width="66" height="2" /><rect x="167" y="64" width="66" height="2" /><rect x="167" y="71" width="40" height="2" />
      </g>
      <circle cx="222" cy="77" r="3.5" fill="#ffffff" opacity="0.9" />
      <rect x="196" y="86" width="8" height="10" fill="#5f7a99" />
    </g>
    <!-- 外野フェンス -->
    <path d="M100 98 Q200 86 300 98 L300 108 Q200 96 100 108Z" :fill="`url(#${id('wall')})`" />
    <path d="M0 100 L100 98 L100 108 L0 110Z M300 98 L400 100 L400 110 L300 108Z" :fill="`url(#${id('wall')})`" />
    <path d="M0 100 L100 98 Q200 86 300 98 L400 100" fill="none" stroke="#ffd33d" stroke-width="2" />
    <!-- ポール -->
    <rect x="42" y="72" width="2.5" height="36" fill="#ffd33d" />
    <rect x="356" y="72" width="2.5" height="36" fill="#ffd33d" />
    <!-- 芝生 -->
    <path d="M0 108 Q200 94 400 108 V170 H0Z" :fill="`url(#${id('grass')})`" />
    <!-- 芝刈りの縞 -->
    <g fill="#ffffff" opacity="0.08">
      <path d="M-10 170 L96 106 L128 104 L40 170Z" /><path d="M110 170 L160 101 L190 99 L170 170Z" />
      <path d="M230 170 L210 99 L240 101 L290 170Z" /><path d="M350 170 L272 104 L304 106 L410 170Z" />
    </g>
    <!-- 内野 -->
    <path d="M200 114 L272 150 L200 188 L128 150Z" :fill="`url(#${id('dirt')})`" />
    <path d="M200 125 L252 150 L200 176 L148 150Z" fill="#4fbf55" />
    <path d="M200 114 L272 150 M200 114 L128 150" stroke="#fff" stroke-width="1.4" opacity="0.85" />
    <!-- マウンド -->
    <ellipse cx="200" cy="150" rx="11" ry="6" :fill="`url(#${id('dirt')})`" />
    <rect x="196" y="148.5" width="8" height="2" fill="#fff" />
    <!-- ベース -->
    <g fill="#fff" stroke="#d8c3a8" stroke-width="0.6">
      <rect x="196" y="110" width="8" height="8" transform="rotate(45 200 114)" />
      <rect x="268" y="146" width="8" height="8" transform="rotate(45 272 150)" />
      <rect x="124" y="146" width="8" height="8" transform="rotate(45 128 150)" />
    </g>
    <!-- 手前を少し暗くして奥行きを出す -->
    <rect y="150" width="400" height="20" fill="#0a3d1a" opacity="0.12" />
  </svg>
</template>

<style scoped>
.scene {
  display: block;
  width: 100%;
}
.clouds {
  animation: drift 26s ease-in-out infinite alternate;
}
@keyframes drift {
  from {
    transform: translateX(-8px);
  }
  to {
    transform: translateX(12px);
  }
}
</style>
