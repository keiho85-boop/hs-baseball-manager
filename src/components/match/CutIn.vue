<script setup lang="ts">
// チャンス・ピンチの場面で、選手の顔を大きく映す演出
import { onMounted } from 'vue'
import FaceIcon from '../FaceIcon.vue'
import type { FaceParts } from '@/game/types'

const props = defineProps<{ kind: 'chance' | 'pinch'; face: FaceParts; name: string; sub: string }>()
const emit = defineEmits<{ close: [] }>()

onMounted(() => {
  setTimeout(() => emit('close'), 1700)
})
void props
</script>

<template>
  <div class="cutin" :class="kind" @click="emit('close')">
    <div class="band">
      <div class="speed" />
      <div class="face"><FaceIcon :face="face" :size="120" /></div>
      <div class="text">
        <div class="title">{{ kind === 'chance' ? 'チャンス！' : 'ピンチ！' }}</div>
        <div class="name">{{ name }}</div>
        <div class="sub">{{ sub }}</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.cutin {
  position: fixed;
  inset: 0;
  z-index: 90;
  display: flex;
  align-items: center;
  background: rgba(10, 25, 45, 0.35);
  animation: fade 1.7s ease forwards;
}
.band {
  position: relative;
  width: 100%;
  height: 170px;
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 0 20px;
  overflow: hidden;
  transform: skewY(-6deg);
  animation: slide 0.35s cubic-bezier(0.2, 0.9, 0.3, 1.2);
  box-shadow: 0 0 0 4px #fff, 0 10px 30px rgba(0, 0, 0, 0.35);
}
.chance .band {
  background: linear-gradient(90deg, #ff7a2e, #ffc93c);
}
.pinch .band {
  background: linear-gradient(90deg, #1a3f8a, #2f6fe0);
}
.speed {
  position: absolute;
  inset: 0;
  background: repeating-linear-gradient(90deg, rgba(255, 255, 255, 0.18) 0 3px, rgba(255, 255, 255, 0) 3px 26px);
  animation: lines 0.6s linear infinite;
}
.face,
.text {
  position: relative;
  transform: skewY(6deg);
}
.face {
  animation: pop-in 0.4s ease-out 0.1s both;
}
.title {
  font-size: 38px;
  font-weight: 900;
  font-style: italic;
  color: #fff;
  -webkit-text-stroke: 6px rgba(0, 0, 0, 0.35);
  paint-order: stroke fill;
  line-height: 1.1;
}
.name {
  font-size: 22px;
  font-weight: 900;
  color: #fff;
  text-shadow: 0 2px 0 rgba(0, 0, 0, 0.3);
}
.sub {
  font-size: 13px;
  font-weight: 800;
  color: rgba(255, 255, 255, 0.9);
}
@keyframes slide {
  from {
    transform: skewY(-6deg) translateX(100%);
  }
  to {
    transform: skewY(-6deg) translateX(0);
  }
}
@keyframes lines {
  from {
    background-position: 0 0;
  }
  to {
    background-position: -52px 0;
  }
}
@keyframes fade {
  0%,
  85% {
    opacity: 1;
  }
  100% {
    opacity: 0;
  }
}
</style>
