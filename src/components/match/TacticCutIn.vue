<script setup lang="ts">
// 選手育成モード：ナギの作戦指示の結果を、大きく映す演出（成功は明るく、失敗は青く）
import { onBeforeUnmount, onMounted } from 'vue'
import FaceIcon from '../FaceIcon.vue'
import type { FaceParts } from '@/game/types'

const props = defineProps<{
  /** 作戦の名前（例：盗塁、スクイズ、一発狙い） */
  label: string
  /** 大きく出す結果（例：盗塁成功！、三振！） */
  title: string
  /** 結果の説明 */
  sub: string
  /** 作戦がうまくいったか */
  good: boolean
  face: FaceParts | null
  name: string
}>()
const emit = defineEmits<{ close: [] }>()

let timer: ReturnType<typeof setTimeout> | undefined
onMounted(() => {
  timer = setTimeout(() => emit('close'), 2600)
})
onBeforeUnmount(() => clearTimeout(timer))
void props
</script>

<template>
  <div class="tcut" :class="good ? 'good' : 'bad'" @click="emit('close')">
    <div class="band">
      <div class="speed" />
      <div v-if="face" class="face"><FaceIcon :face="face" :size="110" /></div>
      <div class="text">
        <div class="label">作戦：{{ label }}<span v-if="name">　{{ name }}</span></div>
        <div class="title">{{ title }}</div>
        <div class="sub">{{ sub }}</div>
      </div>
    </div>
    <div class="tap">タップで次へ</div>
  </div>
</template>

<style scoped>
.tcut {
  position: fixed;
  inset: 0;
  z-index: 90;
  display: flex;
  flex-direction: column;
  justify-content: center;
  background: rgba(10, 25, 45, 0.4);
  animation: fade 0.25s ease;
}
.band {
  position: relative;
  width: 100%;
  min-height: 160px;
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 20px;
  overflow: hidden;
  transform: skewY(-5deg);
  animation: slide 0.35s cubic-bezier(0.2, 0.9, 0.3, 1.2);
  box-shadow: 0 0 0 4px #fff, 0 10px 30px rgba(0, 0, 0, 0.35);
}
.good .band {
  background: linear-gradient(90deg, #ff7a2e, #ffc93c);
}
.bad .band {
  background: linear-gradient(90deg, #2b3f63, #4f6a93);
}
.speed {
  position: absolute;
  inset: 0;
  background: repeating-linear-gradient(100deg, rgba(255, 255, 255, 0.16) 0 6px, rgba(255, 255, 255, 0) 6px 26px);
  animation: run 0.6s linear infinite;
}
.face {
  position: relative;
  flex: none;
  transform: skewY(5deg);
  filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.3));
}
.text {
  position: relative;
  transform: skewY(5deg);
  color: #fff;
  min-width: 0;
}
.label {
  font-size: 13px;
  font-weight: 800;
  opacity: 0.92;
}
.title {
  font-size: 34px;
  font-weight: 900;
  line-height: 1.15;
  letter-spacing: 0.02em;
  text-shadow: 0 3px 0 rgba(0, 0, 0, 0.25);
  margin: 2px 0 4px;
}
.sub {
  font-size: 13px;
  font-weight: 700;
  line-height: 1.4;
}
.tap {
  text-align: center;
  color: #fff;
  font-size: 12px;
  font-weight: 700;
  margin-top: 26px;
  opacity: 0.85;
}
@keyframes slide {
  from {
    transform: translateX(-100%) skewY(-5deg);
  }
}
@keyframes run {
  to {
    background-position: 52px 0;
  }
}
@keyframes fade {
  from {
    opacity: 0;
  }
}
</style>
