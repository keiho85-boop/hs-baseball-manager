<script setup lang="ts">
// 組み合わせ表（回戦ごとに切り替えて見る）
import { computed, ref } from 'vue'
import GameIcon from '@/components/GameIcon.vue'
import { prefName } from '@/game/constants'
import { roundName, type Tournament } from '@/game/tournament'
import type { School } from '@/game/types'

const props = defineProps<{ t: Tournament; schools: Record<string, School>; ownId: string }>()
defineEmits<{ close: [] }>()

// 最初は、いま行っている回戦（終わっていれば決勝）を開く
const round = ref(Math.min(props.t.current, props.t.rounds.length - 1))
const national = computed(() => props.t.prefCode === null)

const games = computed(() => props.t.rounds[round.value]!.filter((g) => !g.bye && (g.a || g.b)))
const name = (id: string | null) => (id ? (props.schools[id]?.name ?? '？') : '未定')
const sub = (id: string | null) => (id && national.value ? prefName(props.schools[id]?.prefCode ?? 0) : '')
const ownGameIndex = computed(() => games.value.findIndex((g) => g.a === props.ownId || g.b === props.ownId))
</script>

<template>
  <div class="bk-backdrop" @click.self="$emit('close')">
    <div class="bk card">
      <h2 class="orange"><GameIcon name="trophy" /> {{ t.name }}</h2>
      <div class="rounds">
        <button v-for="(r, i) in t.rounds" :key="i" :class="{ on: round === i, done: i < t.current || t.finished }" @click="round = i">
          {{ roundName(t, i) }}
        </button>
        <span v-if="!t.rounds.length" />
      </div>
      <div class="list">
        <div v-for="(g, i) in games" :key="i" class="game" :class="{ own: i === ownGameIndex }">
          <div class="side" :class="{ win: g.winner && g.winner === g.a, lose: g.winner && g.winner !== g.a }">
            <span class="nm">{{ name(g.a) }}</span>
            <small v-if="sub(g.a)">{{ sub(g.a) }}</small>
          </div>
          <div class="sc">
            <template v-if="g.score">{{ g.score[0] }} - {{ g.score[1] }}</template>
            <template v-else>vs</template>
            <small v-if="g.note">{{ g.note }}</small>
          </div>
          <div class="side r" :class="{ win: g.winner && g.winner === g.b, lose: g.winner && g.winner !== g.b }">
            <span class="nm">{{ name(g.b) }}</span>
            <small v-if="sub(g.b)">{{ sub(g.b) }}</small>
          </div>
        </div>
        <p v-if="games.length === 0" class="muted">まだ組み合わせが決まっていません</p>
      </div>
      <p v-if="t.finished && t.championId" class="champ">
        <GameIcon name="trophy" :size="16" /> 優勝：{{ name(t.championId) }}
      </p>
      <button class="secondary full" @click="$emit('close')">閉じる</button>
    </div>
  </div>
</template>

<style scoped>
.bk-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(10, 30, 60, 0.45);
  z-index: 60;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}
.bk {
  width: 100%;
  max-width: 640px;
  max-height: 86vh;
  display: flex;
  flex-direction: column;
  margin: 0;
  border-radius: 20px 20px 0 0;
  padding-bottom: calc(14px + var(--safe-bottom));
  animation: float-up 0.2s ease-out;
}
.rounds {
  display: flex;
  gap: 4px;
  overflow-x: auto;
  padding-bottom: 6px;
  scrollbar-width: none;
}
.rounds button {
  flex-shrink: 0;
  padding: 6px 10px;
  font-size: 12px;
  background: #eef3f8;
  color: var(--ink-soft);
  box-shadow: none;
  text-shadow: none;
}
.rounds button.done {
  color: var(--ink);
}
.rounds button.on {
  background: var(--orange);
  color: #fff;
}
.list {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
  margin: 4px 0 10px;
}
.game {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 6px;
  padding: 7px 4px;
  border-bottom: 1px solid #eef3f8;
  font-size: 13px;
}
.game.own {
  background: #fff4d0;
  border-radius: 8px;
}
.side {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.side.r {
  text-align: right;
  align-items: flex-end;
}
.side .nm {
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}
.side small {
  font-size: 10px;
  color: var(--ink-soft);
}
.side.win .nm {
  font-weight: 900;
  color: var(--red);
}
.side.lose .nm {
  color: #9aa7b8;
}
.sc {
  display: flex;
  flex-direction: column;
  align-items: center;
  font-weight: 900;
  font-variant-numeric: tabular-nums;
  min-width: 54px;
}
.sc small {
  font-size: 9px;
  color: var(--ink-soft);
  font-weight: 700;
}
.champ {
  text-align: center;
  font-weight: 900;
  color: var(--gold);
  margin: 0 0 8px;
}
</style>
