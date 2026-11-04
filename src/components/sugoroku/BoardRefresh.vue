<script setup lang="ts">
// 月が変わって、すごろくの盤面が新しくなったときの演出
import { computed, onBeforeUnmount, onMounted } from 'vue'
import { SQUARES } from '@/game/sugoroku'
import type { SquareType } from '@/game/types'

const props = defineProps<{ month: number; board: SquareType[] }>()
const emit = defineEmits<{ close: [] }>()

/** 注目のマス（特訓・実戦・イベントなど）の数 */
const highlights = computed(() => {
  const keys: SquareType[] = ['special', 'practical', 'event', 'manager', 'funds', 'rest']
  return keys
    .map((k) => ({ k, n: props.board.filter((x) => x === k).length, info: SQUARES[k] }))
    .filter((x) => x.n > 0)
})

/** その月らしい一言 */
const SEASON: Record<number, string> = {
  4: '新チームで、いざ始動！',
  5: '春季大会に向けて仕上げよう',
  6: '梅雨でも練習は止まらない',
  7: '夏の大会はもうすぐ！',
  8: '暑さに負けるな',
  9: '新チームの土台づくり',
  10: '秋季大会で結果を出そう',
  11: '冬に向けて鍛え直す',
  12: '冬の走り込みが春を変える',
  1: '新しい年も全力で',
  2: 'じっくり力を蓄えよう',
  3: '春の訪れとともに',
}

let timer: ReturnType<typeof setTimeout> | undefined
onMounted(() => {
  timer = setTimeout(() => emit('close'), 3800)
})
onBeforeUnmount(() => clearTimeout(timer))
</script>

<template>
  <div class="br" @click="emit('close')">
    <div class="rays" />
    <div class="box">
      <div class="cal">
        <div class="cal-top" />
        <div class="cal-num">{{ month }}<small>月</small></div>
      </div>
      <div class="title">練習の盤面が<br />新しくなった！</div>
      <div class="sub">{{ SEASON[month] }}</div>
      <div class="tiles">
        <span v-for="(sq, i) in board.slice(0, 10)" :key="i" class="tile" :style="{ '--c': SQUARES[sq].color, animationDelay: `${0.35 + i * 0.06}s` }">{{ SQUARES[sq].short }}</span>
      </div>
      <div class="hl">
        <span v-for="h in highlights" :key="h.k" class="chip" :style="{ '--c': h.info.color }">{{ h.info.label }} ×{{ h.n }}</span>
      </div>
      <div class="tap">タップで閉じる</div>
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
  background: radial-gradient(60% 45% at 50% 45%, rgba(20, 60, 120, 0.55), rgba(5, 15, 35, 0.78));
  animation: fade 0.25s ease-out;
  overflow: hidden;
}
.rays {
  position: absolute;
  width: 900px;
  height: 900px;
  left: 50%;
  top: 45%;
  margin: -450px 0 0 -450px;
  background: repeating-conic-gradient(rgba(255, 230, 140, 0.16) 0 8deg, transparent 8deg 20deg);
  animation: spin 14s linear infinite;
  mask-image: radial-gradient(circle, #000 20%, transparent 62%);
}
.box {
  position: relative;
  text-align: center;
  color: #fff;
  padding: 0 20px;
}
.cal {
  width: 96px;
  margin: 0 auto;
  background: linear-gradient(180deg, #fff 60%, #e8eef6);
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 8px 0 rgba(0, 0, 0, 0.2), 0 14px 26px rgba(0, 0, 0, 0.35);
  animation: flip 0.6s cubic-bezier(0.3, 1.5, 0.5, 1) both;
  transform-origin: 50% 0;
}
.cal-top {
  height: 20px;
  background: linear-gradient(180deg, #ff6b5e, #e5484d);
}
.cal-num {
  color: var(--ink);
  font-size: 52px;
  font-weight: 900;
  line-height: 1.15;
  padding-bottom: 4px;
}
.cal-num small {
  font-size: 18px;
}
.title {
  margin-top: 16px;
  font-size: 30px;
  font-weight: 900;
  font-style: italic;
  line-height: 1.2;
  background: linear-gradient(180deg, #fffbe6, #ffd84d 60%, #f2a516);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  -webkit-text-stroke: 1px #6b3d00;
  filter: drop-shadow(0 4px 0 #3a2000) drop-shadow(0 0 14px rgba(255, 196, 61, 0.5));
  animation: pop 0.45s cubic-bezier(0.2, 1.6, 0.4, 1) 0.15s both;
}
.sub {
  margin-top: 6px;
  font-weight: 800;
  font-size: 14px;
  opacity: 0.9;
  animation: pop 0.4s ease-out 0.25s both;
}
.tiles {
  display: flex;
  justify-content: center;
  gap: 4px;
  margin-top: 16px;
}
.tile {
  width: 28px;
  height: 28px;
  border-radius: 7px;
  font-size: 15px;
  font-weight: 900;
  display: flex;
  align-items: center;
  justify-content: center;
  background:
    radial-gradient(120% 90% at 28% 12%, rgba(255, 255, 255, 0.55), rgba(255, 255, 255, 0) 60%),
    var(--c);
  box-shadow: inset 0 -3px 0 rgba(0, 0, 0, 0.22), 0 3px 4px rgba(0, 0, 0, 0.3);
  text-shadow: 0 1px 0 rgba(0, 0, 0, 0.35);
  animation: drop 0.4s cubic-bezier(0.3, 1.6, 0.5, 1) both;
}
.hl {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 6px;
  margin-top: 14px;
  animation: pop 0.4s ease-out 1s both;
}
.chip {
  font-size: 12px;
  font-weight: 900;
  background: var(--c);
  border-radius: 999px;
  padding: 2px 10px;
  box-shadow: 0 2px 0 rgba(0, 0, 0, 0.25);
}
.tap {
  margin-top: 18px;
  font-size: 11px;
  opacity: 0.6;
}
@keyframes fade {
  from {
    opacity: 0;
  }
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
@keyframes flip {
  from {
    transform: perspective(400px) rotateX(-95deg);
    opacity: 0;
  }
}
@keyframes pop {
  from {
    transform: scale(0.6);
    opacity: 0;
  }
}
@keyframes drop {
  from {
    transform: translateY(-40px) rotate(-20deg);
    opacity: 0;
  }
}
</style>
