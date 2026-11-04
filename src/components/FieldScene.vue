<script setup lang="ts">
// 青空とグラウンドの背景イラスト（SVGで描画）
withDefaults(defineProps<{ height?: number; evening?: boolean }>(), { height: 170, evening: false })
</script>

<template>
  <svg class="scene" :style="{ height: `${height}px` }" viewBox="0 0 400 170" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
    <defs>
      <linearGradient id="fs-sky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" :stop-color="evening ? '#ff9a5c' : '#3fa9f0'" />
        <stop offset="1" :stop-color="evening ? '#ffd59a' : '#b9e6ff'" />
      </linearGradient>
      <linearGradient id="fs-grass" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#5cc65f" />
        <stop offset="1" stop-color="#2f9a3a" />
      </linearGradient>
    </defs>
    <rect width="400" height="170" fill="url(#fs-sky)" />
    <!-- 太陽 -->
    <circle cx="338" cy="34" r="18" :fill="evening ? '#fff1c1' : '#fff6c9'" opacity="0.9" />
    <!-- 雲 -->
    <g fill="#fff" opacity="0.92" class="clouds">
      <ellipse cx="70" cy="34" rx="30" ry="11" /><ellipse cx="92" cy="28" rx="18" ry="11" /><ellipse cx="52" cy="30" rx="14" ry="9" />
      <ellipse cx="230" cy="22" rx="24" ry="8" /><ellipse cx="246" cy="17" rx="13" ry="8" />
    </g>
    <!-- 遠くの山 -->
    <path d="M0 92 Q40 66 80 84 Q120 58 170 80 Q220 60 260 82 Q310 62 360 80 Q385 72 400 78 V110 H0Z" fill="#8ccfb0" opacity="0.7" />
    <!-- 校舎 -->
    <g>
      <rect x="250" y="66" width="104" height="34" rx="2" fill="#f4efe4" />
      <rect x="290" y="52" width="26" height="16" fill="#f4efe4" />
      <circle cx="303" cy="60" r="5" fill="#fff" stroke="#9aa7b6" stroke-width="1.2" />
      <g fill="#8fb6d9">
        <rect x="258" y="72" width="10" height="7" /><rect x="274" y="72" width="10" height="7" /><rect x="320" y="72" width="10" height="7" /><rect x="336" y="72" width="10" height="7" />
        <rect x="258" y="85" width="10" height="7" /><rect x="274" y="85" width="10" height="7" /><rect x="320" y="85" width="10" height="7" /><rect x="336" y="85" width="10" height="7" />
      </g>
    </g>
    <!-- 外野フェンス -->
    <path d="M0 100 Q200 84 400 100 V112 Q200 96 0 112Z" fill="#2f7d4a" />
    <!-- 芝生 -->
    <path d="M0 108 Q200 92 400 108 V170 H0Z" fill="url(#fs-grass)" />
    <!-- 芝の模様 -->
    <g fill="#ffffff" opacity="0.07">
      <path d="M60 170 L120 104 L160 102 L110 170Z" /><path d="M200 170 L200 100 L240 101 L270 170Z" /><path d="M320 170 L300 104 L340 106 L390 170Z" />
    </g>
    <!-- 内野 -->
    <path d="M200 112 L268 146 L200 182 L132 146Z" fill="#d9a066" />
    <path d="M200 122 L250 146 L200 170 L150 146Z" fill="#5fc062" />
    <circle cx="200" cy="146" r="8" fill="#d9a066" />
    <!-- ベース -->
    <g fill="#fff">
      <rect x="196" y="108" width="8" height="8" transform="rotate(45 200 112)" />
      <rect x="264" y="142" width="8" height="8" transform="rotate(45 268 146)" />
      <rect x="128" y="142" width="8" height="8" transform="rotate(45 132 146)" />
    </g>
  </svg>
</template>

<style scoped>
.scene {
  display: block;
  width: 100%;
}
.clouds {
  animation: drift 24s ease-in-out infinite alternate;
}
@keyframes drift {
  from {
    transform: translateX(-6px);
  }
  to {
    transform: translateX(10px);
  }
}
</style>
