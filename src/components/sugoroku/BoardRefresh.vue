<script setup lang="ts">
// 月が変わって、すごろくの盤面が新しくなったときの控えめな知らせ（画面中央に少しだけ出る）
import { onBeforeUnmount, onMounted } from 'vue'
import { SQUARES } from '@/game/sugoroku'
import type { SquareType } from '@/game/types'

defineProps<{ month: number; board: SquareType[] }>()
const emit = defineEmits<{ close: [] }>()

let timer: ReturnType<typeof setTimeout> | undefined
onMounted(() => {
  timer = setTimeout(() => emit('close'), 2400)
})
onBeforeUnmount(() => clearTimeout(timer))
</script>

<template>
  <div class="br" @click="emit('close')">
    <div class="box">
      <div class="title"><b>{{ month }}月</b>の練習盤面になりました</div>
      <div class="tiles">
        <span v-for="(sq, i) in board" :key="i" class="tile" :style="{ background: SQUARES[sq].color }">{{ SQUARES[sq].short }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.br {
  position: fixed;
  inset: 0;
  z-index: 70;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: auto;
}
.box {
  background: rgba(20, 34, 56, 0.88);
  color: #fff;
  border-radius: 16px;
  padding: 12px 16px 14px;
  max-width: 300px;
  text-align: center;
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.25);
  animation: show 2.4s ease both;
}
.title {
  font-size: 14px;
  font-weight: 800;
}
.title b {
  font-size: 18px;
  margin-right: 2px;
}
.tiles {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 3px;
  margin-top: 8px;
}
.tile {
  width: 20px;
  height: 20px;
  border-radius: 5px;
  font-size: 11px;
  font-weight: 900;
  display: flex;
  align-items: center;
  justify-content: center;
}
@keyframes show {
  0% {
    opacity: 0;
    transform: translateY(8px);
  }
  12%,
  85% {
    opacity: 1;
    transform: none;
  }
  100% {
    opacity: 0;
  }
}
</style>
