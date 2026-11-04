<script setup lang="ts">
// すごろくの盤面（6×6の外周20マス）
import { computed } from 'vue'
import { SQUARES } from '@/game/sugoroku'
import type { SquareType } from '@/game/types'
import GameIcon from '../GameIcon.vue'

const props = defineProps<{
  board: SquareType[]
  position: number
  /** 選んだカードで止まる予定のマス */
  preview: number | null
  month: number
  camp: boolean
}>()

/** マス番号 → 盤面の行・列（時計回り） */
function cell(i: number): { row: number; col: number } {
  if (i <= 5) return { row: 1, col: i + 1 }
  if (i <= 9) return { row: i - 4, col: 6 }
  if (i <= 15) return { row: 6, col: 16 - i }
  return { row: 21 - i, col: 1 }
}

const cells = computed(() => props.board.map((sq, i) => ({ sq, i, ...cell(i), info: SQUARES[sq] })))
const previewInfo = computed(() => (props.preview !== null ? SQUARES[props.board[props.preview]!] : null))
const hereInfo = computed(() => SQUARES[props.board[props.position]!])
</script>

<template>
  <div class="board">
    <div
      v-for="c in cells"
      :key="c.i"
      class="sq"
      :class="{ here: c.i === position, target: c.i === preview }"
      :style="{ gridRow: c.row, gridColumn: c.col, '--c': c.info.color }"
    >
      <span class="short">{{ c.info.short }}</span>
      <span class="lbl">{{ c.info.label }}</span>
      <span v-if="c.i === position" class="token"><GameIcon name="cap" :size="18" /></span>
    </div>
    <div class="center">
      <div class="month">{{ month }}<small>月の練習</small></div>
      <div v-if="camp" class="camp">夏合宿中！</div>
      <div v-if="previewInfo" class="info target-info" :style="{ '--c': previewInfo.color }">
        <b>{{ previewInfo.label }}マス</b>
        <span>{{ previewInfo.description }}</span>
      </div>
      <div v-else class="info" :style="{ '--c': hereInfo.color }">
        <span class="muted">いまの位置</span>
        <b>{{ hereInfo.label }}マス</b>
      </div>
    </div>
  </div>
</template>

<style scoped>
.board {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  grid-template-rows: repeat(6, 1fr);
  gap: 4px;
  aspect-ratio: 1;
  background:
    repeating-linear-gradient(135deg, rgba(255, 255, 255, 0.06) 0 10px, rgba(255, 255, 255, 0) 10px 20px),
    linear-gradient(180deg, #4dbd57, #2f9a3c);
  border-radius: 18px;
  padding: 6px;
  box-shadow: inset 0 0 0 3px rgba(255, 255, 255, 0.35), 0 4px 0 #1f6e2b, 0 10px 18px -8px rgba(0, 0, 0, 0.4);
}
.sq {
  position: relative;
  border-radius: 10px;
  background-image: linear-gradient(180deg, rgba(255, 255, 255, 0.4) 0%, rgba(255, 255, 255, 0) 55%), linear-gradient(180deg, var(--c), var(--c));
  color: #fff;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  box-shadow: inset 0 -3px 0 rgba(0, 0, 0, 0.2), 0 2px 0 rgba(0, 0, 0, 0.2);
  text-shadow: 0 1px 0 rgba(0, 0, 0, 0.3);
  transition: transform 0.15s;
  min-width: 0;
}
.short {
  font-size: 17px;
  font-weight: 900;
  line-height: 1;
}
.lbl {
  font-size: 9px;
  font-weight: 800;
  white-space: nowrap;
  overflow: hidden;
  max-width: 100%;
}
.sq.here {
  box-shadow: 0 0 0 3px #fff, 0 0 0 5px #1b2638, 0 4px 6px rgba(0, 0, 0, 0.3);
  z-index: 2;
}
.sq.target {
  animation: blink 0.9s ease-in-out infinite;
  z-index: 3;
}
.token {
  position: absolute;
  top: -12px;
  right: -6px;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: #fff;
  color: var(--sky-deep);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 0 rgba(0, 0, 0, 0.25);
  animation: hop 0.3s ease-out;
}
.center {
  grid-row: 2 / 6;
  grid-column: 2 / 6;
  background: rgba(255, 255, 255, 0.92);
  border-radius: 14px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px;
  text-align: center;
  box-shadow: inset 0 0 0 2px rgba(0, 0, 0, 0.05);
}
.month {
  font-size: 30px;
  font-weight: 900;
  color: var(--grass-deep);
  line-height: 1;
}
.month small {
  font-size: 13px;
}
.camp {
  font-weight: 900;
  color: #fff;
  background: var(--red);
  border-radius: 999px;
  padding: 1px 12px;
  font-size: 12px;
}
.info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 12px;
}
.info b {
  font-size: 16px;
  color: var(--c);
  font-weight: 900;
}
.target-info {
  background: #fff;
  border-radius: 10px;
  padding: 6px 8px;
  box-shadow: inset 0 0 0 2px var(--c);
}
@keyframes blink {
  0%,
  100% {
    transform: scale(1);
    box-shadow: 0 0 0 3px #ffd33d, 0 0 12px 3px rgba(255, 211, 61, 0.8);
  }
  50% {
    transform: scale(1.08);
    box-shadow: 0 0 0 3px #fff, 0 0 18px 6px rgba(255, 211, 61, 0.9);
  }
}
@keyframes hop {
  0% {
    transform: translateY(0) scale(0.7);
  }
  50% {
    transform: translateY(-8px) scale(1.1);
  }
  100% {
    transform: translateY(0) scale(1);
  }
}
</style>
