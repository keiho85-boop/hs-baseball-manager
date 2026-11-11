<script setup lang="ts">
// すごろくの盤面（横7×縦5の外周20マス。横いっぱいに広げ、真ん中に説明を出す）
import { computed } from 'vue'
import { SQUARES } from '@/game/sugoroku'
import type { SquareType } from '@/game/types'
import GameIcon from '../GameIcon.vue'
import { PERSON_BADGE, type Person } from '@/game/success/board'

const props = defineProps<{
  board: SquareType[]
  position: number
  /** 選んだカードで止まる予定のマス */
  preview: number | null
  month: number
  camp: boolean
  /** 合宿の行き先（選手育成モード） */
  campName?: string
  /** 選んだカードで止まると、練習のつながりが何回目になるか（2以上なら表示） */
  comboNext?: number
  /** いまの練習のつながり（回数） */
  comboNow?: number
  /** 選んだカードの効果の説明 */
  cardNote?: string | null
  milestone?: string
  /** サクセス：練習マスに付いている人物（マスの番号 → 人物） */
  attach?: Record<number, string> | null
}>()

function badge(i: number): { short: string; label: string; color: string } | null {
  const p = props.attach?.[i] as Person | undefined
  return p ? PERSON_BADGE[p] : null
}

/** マス番号 → 盤面の行・列（時計回り） */
function cell(i: number): { row: number; col: number } {
  if (i <= 6) return { row: 1, col: i + 1 }
  if (i <= 9) return { row: i - 5, col: 7 }
  if (i <= 16) return { row: 5, col: 17 - i }
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
      <span v-if="badge(c.i)" class="person" :style="{ background: badge(c.i)!.color }" :title="badge(c.i)!.label">{{ badge(c.i)!.short }}</span>
    </div>
    <div class="center">
      <div class="month">{{ month }}<small>月の練習</small></div>
      <div v-if="milestone" class="milestone">{{ milestone }}</div>
      <div v-if="camp" class="camp">{{ campName ? `${campName}で合宿中！` : '夏合宿中！' }}</div>
      <div v-if="previewInfo" class="info target-info" :style="{ '--c': previewInfo.color }">
        <b>{{ previewInfo.label }}マス</b>
        <span>{{ previewInfo.description }}</span>
        <span v-if="preview !== null && badge(preview)" class="person-note">＋{{ badge(preview)!.label }}のイベント</span>
        <span v-if="(comboNext ?? 0) >= 2" class="combo-note">練習がつながる！ ×{{ comboNext === 2 ? '1.2' : '1.4' }}</span>
      </div>
      <div v-else class="info" :style="{ '--c': hereInfo.color }">
        <span class="muted">いまの位置</span>
        <b>{{ hereInfo.label }}マス</b>
        <span v-if="(comboNow ?? 0) >= 2" class="combo-note">{{ hereInfo.label }}の練習 {{ comboNow }}連続</span>
      </div>
      <div v-if="cardNote" class="card-note">{{ cardNote }}</div>
    </div>
  </div>
</template>

<style scoped>
.board {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  grid-template-rows: repeat(5, 1fr);
  gap: 4px;
  aspect-ratio: 7 / 5;
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
  /* 左上から光が当たった、ぷっくりしたタイル */
  background-image:
    radial-gradient(120% 90% at 28% 12%, rgba(255, 255, 255, 0.55) 0%, rgba(255, 255, 255, 0.12) 38%, rgba(255, 255, 255, 0) 60%),
    linear-gradient(180deg, rgba(255, 255, 255, 0) 55%, rgba(0, 0, 0, 0.16) 100%),
    linear-gradient(180deg, var(--c), var(--c));
  color: #fff;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  box-shadow:
    inset 0 1.5px 0 rgba(255, 255, 255, 0.55),
    inset 0 -4px 0 rgba(0, 0, 0, 0.22),
    0 3px 0 rgba(0, 0, 0, 0.22),
    0 5px 6px -2px rgba(0, 0, 0, 0.25);
  text-shadow: 0 1px 0 rgba(0, 0, 0, 0.35), 0 2px 3px rgba(0, 0, 0, 0.2);
  transition: transform 0.15s;
  min-width: 0;
}
.short {
  font-size: 16px;
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
  background: radial-gradient(circle at 35% 30%, #ffffff 0%, #eef5fc 45%, #b9cde2 100%);
  color: var(--sky-deep);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 0 rgba(0, 0, 0, 0.25), 0 4px 6px rgba(0, 0, 0, 0.25);
  animation: hop 0.3s ease-out;
}
.person {
  position: absolute;
  bottom: -5px;
  left: -5px;
  min-width: 18px;
  height: 18px;
  padding: 0 3px;
  border-radius: 9px;
  border: 2px solid #fff;
  color: #fff;
  font-size: 10px;
  font-weight: 900;
  line-height: 14px;
  text-align: center;
  box-shadow: 0 2px 3px rgba(0, 0, 0, 0.3);
  z-index: 1;
}
.combo-note {
  font-weight: 900;
  color: #fff;
  background: linear-gradient(90deg, #ff7a2e, #e5484d);
  border-radius: 999px;
  padding: 0 8px;
  font-size: 11px;
}
.person-note {
  font-weight: 800;
  color: #c2185b;
}
.center {
  grid-row: 2 / 5;
  grid-column: 2 / 7;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.92);
  border-radius: 14px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  padding: 4px 6px;
  text-align: center;
  box-shadow: inset 0 0 0 2px rgba(0, 0, 0, 0.05);
}
.month {
  font-size: 22px;
  font-weight: 900;
  color: var(--grass-deep);
  line-height: 1;
}
.month small {
  font-size: 13px;
}
.milestone {
  display: none;
  font-size: 11px;
  font-weight: 800;
  color: var(--red);
}
@media (max-height: 720px) {
  .milestone {
    display: block;
  }
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
  gap: 1px;
  font-size: 11px;
  line-height: 1.3;
}
.info b {
  font-size: 15px;
  color: var(--c);
  font-weight: 900;
}
.card-note {
  font-size: 11px;
  font-weight: 800;
  color: #a86f00;
  background: #fff4d0;
  border-radius: 8px;
  padding: 2px 8px;
}
.target-info {
  background: #fff;
  border-radius: 10px;
  padding: 3px 8px;
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
