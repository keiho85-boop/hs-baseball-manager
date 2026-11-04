<script setup lang="ts">
// 1週間の練習で伸びた選手を、ポップアップで見せる演出
import { computed } from 'vue'
import { useGameStore } from '@/stores/game'
import FaceIcon from './FaceIcon.vue'

const game = useGameStore()

const entries = computed(() => game.lastGrowth.slice(0, 6))
const rest = computed(() => Math.max(0, game.lastGrowth.length - entries.value.length))

function close(): void {
  game.showGrowth = false
}
</script>

<template>
  <Transition name="sheet">
    <div v-if="game.showGrowth" class="backdrop" @click.self="close">
      <div class="sheet">
        <div class="banner">練習の成果！</div>
        <div class="list">
          <div v-for="(e, i) in entries" :key="e.playerId" class="entry" :style="{ animationDelay: `${i * 70}ms` }">
            <FaceIcon v-if="game.player(e.playerId)" :face="game.player(e.playerId)!.face" :size="40" />
            <div class="body">
              <div class="name">{{ e.name }}</div>
              <div class="changes">
                <span v-for="c in e.changes" :key="c.label" class="up">
                  {{ c.label }} <b>+{{ c.after - c.before }}{{ c.unit ?? '' }}</b>
                </span>
              </div>
            </div>
          </div>
          <p v-if="rest > 0" class="more">ほか {{ rest }}人も成長しました</p>
        </div>
        <button class="sun full" @click="close">OK</button>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.backdrop {
  position: fixed;
  inset: 0;
  background: rgba(16, 40, 70, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  z-index: 80;
}
.sheet {
  width: 100%;
  max-width: 380px;
  background: #fff;
  border-radius: 22px;
  padding: 0 14px 16px;
  box-shadow: 0 6px 0 rgba(0, 0, 0, 0.15), 0 16px 40px rgba(0, 0, 0, 0.25);
  border: 3px solid #ffd85e;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
}
.banner {
  margin: -18px auto 8px;
  background: linear-gradient(180deg, #ffd85e, #ffb400);
  color: #5a3a00;
  font-weight: 900;
  font-size: 18px;
  padding: 6px 22px;
  border-radius: 999px;
  box-shadow: 0 4px 0 #d18f00;
  animation: pop-in 0.35s ease-out;
}
.list {
  overflow-y: auto;
  margin-bottom: 12px;
}
.entry {
  display: flex;
  gap: 10px;
  align-items: center;
  padding: 8px 4px;
  border-bottom: 2px dashed #eef3f8;
  animation: float-up 0.35s ease-out both;
}
.body {
  min-width: 0;
}
.name {
  font-weight: 800;
}
.changes {
  display: flex;
  flex-wrap: wrap;
  gap: 2px 10px;
  font-size: 13px;
  color: var(--ink-soft);
  font-weight: 700;
}
.up b {
  color: var(--orange);
  font-weight: 900;
}
.more {
  text-align: center;
  color: var(--ink-soft);
  font-size: 13px;
  margin: 8px 0 0;
}
.sheet-enter-active,
.sheet-leave-active {
  transition: opacity 0.2s;
}
.sheet-enter-active .sheet {
  animation: pop-in 0.3s ease-out;
}
.sheet-enter-from,
.sheet-leave-to {
  opacity: 0;
}
</style>
