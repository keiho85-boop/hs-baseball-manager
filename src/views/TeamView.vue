<script setup lang="ts">
import GameIcon from '@/components/GameIcon.vue'
import { computed, ref } from 'vue'
import InfoSheet from '@/components/InfoSheet.vue'
import { useGameStore } from '@/stores/game'
import { POSITIONS, POSITION_NAME, PRACTICE_NAME } from '@/game/constants'
import { playerRating } from '@/game/player'
import type { PracticeMenu } from '@/game/types'
import RankBadge from '@/components/RankBadge.vue'
import LineupEditor from '@/components/LineupEditor.vue'

const game = useGameStore()
const members = computed(() => game.ownPlayers().filter((p) => !p.retired))

const byPosition = computed(() =>
  POSITIONS.map((pos) => {
    const list = members.value.filter((p) => p.mainPosition === pos).sort((a, b) => playerRating(b) - playerRating(a))
    return { pos, count: list.length, best: list[0] }
  }),
)

const open = ref<'pos' | 'menu' | null>(null)

const menuCount = computed(() => {
  const counts = Object.fromEntries(Object.keys(PRACTICE_NAME).map((k) => [k, 0])) as Record<PracticeMenu, number>
  for (const p of members.value) counts[p.practiceMenu] += 1
  return counts
})
</script>

<template>
  <div class="page">
    <LineupEditor>
      <template #tools>
        <button class="secondary tool" aria-label="ポジション別の部員" @click="open = 'pos'"><GameIcon name="glove" :size="16" />守備</button>
        <button class="secondary tool" aria-label="練習メニューの割り当て" @click="open = 'menu'"><GameIcon name="run" :size="16" />練習</button>
      </template>
    </LineupEditor>
    <InfoSheet v-if="open === 'pos'" @close="open = null">
      <h2 class="orange"><GameIcon name="glove" /> ポジション別の部員</h2>
      <div v-for="row in byPosition" :key="row.pos" class="row line">
        <span class="pos">{{ POSITION_NAME[row.pos] }}</span>
        <span class="count">{{ row.count }}人</span>
        <template v-if="row.best">
          <RouterLink :to="{ name: 'player', params: { id: row.best.id } }">{{ row.best.surname }}（{{ row.best.grade }}年）</RouterLink>
          <RankBadge :value="playerRating(row.best)" />
        </template>
        <span v-else class="muted">不在</span>
      </div>
    </InfoSheet>
    <InfoSheet v-if="open === 'menu'" @close="open = null">
      <h2 class="grass"><GameIcon name="run" /> 練習メニューの割り当て</h2>
      <div class="grid2">
        <div v-for="(label, key) in PRACTICE_NAME" :key="key">{{ label }}：{{ menuCount[key] }}人</div>
      </div>
      <p class="muted">練習メニューは、各選手の詳細画面で変更できます。</p>
    </InfoSheet>
  </div>
</template>

<style scoped>
.tool {
  padding: 7px 8px;
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: 2px;
  white-space: nowrap;
}
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
  color: var(--sky-deep);
  font-weight: 700;
  flex: 1;
}
</style>
