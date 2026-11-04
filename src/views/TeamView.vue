<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '@/stores/game'
import { POSITIONS, POSITION_NAME, PRACTICE_NAME } from '@/game/constants'
import { playerRating } from '@/game/player'
import type { PracticeMenu } from '@/game/types'
import RankBadge from '@/components/RankBadge.vue'

const game = useGameStore()
const members = computed(() => game.ownPlayers().filter((p) => !p.retired))

const byPosition = computed(() =>
  POSITIONS.map((pos) => {
    const list = members.value.filter((p) => p.mainPosition === pos).sort((a, b) => playerRating(b) - playerRating(a))
    return { pos, count: list.length, best: list[0] }
  }),
)

const menuCount = computed(() => {
  const counts = Object.fromEntries(Object.keys(PRACTICE_NAME).map((k) => [k, 0])) as Record<PracticeMenu, number>
  for (const p of members.value) counts[p.practiceMenu] += 1
  return counts
})
</script>

<template>
  <div class="page">
    <div class="card">
      <h2>ポジション別の部員</h2>
      <div v-for="row in byPosition" :key="row.pos" class="row line">
        <span class="pos">{{ POSITION_NAME[row.pos] }}</span>
        <span class="count">{{ row.count }}人</span>
        <template v-if="row.best">
          <RouterLink :to="{ name: 'player', params: { id: row.best.id } }">{{ row.best.surname }}（{{ row.best.grade }}年）</RouterLink>
          <RankBadge :value="playerRating(row.best)" />
        </template>
        <span v-else class="muted">不在</span>
      </div>
    </div>

    <div class="card">
      <h2>練習メニューの割り当て</h2>
      <div class="grid2">
        <div v-for="(label, key) in PRACTICE_NAME" :key="key">{{ label }}：{{ menuCount[key] }}人</div>
      </div>
      <p class="muted">練習メニューは、各選手の詳細画面で変更できます。</p>
    </div>

    <div class="card">
      <h2>オーダー</h2>
      <p class="muted">打順・守備位置・ベンチ入り・投手の起用順を決める画面は、試合と一緒に開発段階2で追加します。</p>
    </div>
  </div>
</template>

<style scoped>
.line {
  padding: 6px 0;
  border-bottom: 1px solid var(--line);
}
.line:last-child {
  border-bottom: none;
}
.pos {
  width: 64px;
  font-weight: 600;
}
.count {
  width: 36px;
}
a {
  color: var(--green);
  flex: 1;
}
</style>
