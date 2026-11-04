<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '@/stores/game'
import { prefName } from '@/game/constants'
import RankBadge from '@/components/RankBadge.vue'

const game = useGameStore()
const school = computed(() => game.ownSchool())

const FACILITY_NAME = {
  batting: '打撃練習場',
  pitching: 'ブルペン',
  fielding: '守備練習場',
  running: '走路',
  fitness: 'トレーニング室',
  medical: '医務室',
} as const

const ranking = computed(() => {
  void game.rev
  const s = game.save
  if (!s) return []
  return Object.values(s.schools)
    .filter((x) => x.prefCode === s.prefCode)
    .sort((a, b) => b.overall - a.overall)
})

const ownRank = computed(() => ranking.value.findIndex((x) => x.id === school.value?.id) + 1)
</script>

<template>
  <div v-if="school" class="page">
    <div class="card">
      <h2>{{ school.name }}（{{ school.kind === 'private' ? '私立' : '公立' }}）</h2>
      <div class="grid2">
        <div>総合力：<RankBadge :value="school.overall" /></div>
        <div>県内順位：{{ ownRank }}位／{{ ranking.length }}校</div>
        <div>評判：{{ school.reputation }}</div>
        <div>部費：{{ school.funds }}万円</div>
      </div>
    </div>

    <div class="card">
      <h2 class="sun">🏗 設備</h2>
      <div class="grid2">
        <div v-for="(label, key) in FACILITY_NAME" :key="key">
          {{ label }}：<span class="lv">{{ '★'.repeat(school.facilities[key]) }}{{ '☆'.repeat(5 - school.facilities[key]) }}</span>
        </div>
      </div>
      <p class="muted">設備の強化とスカウトは、開発段階4で追加します。</p>
    </div>

    <div class="card">
      <h2 class="orange">🏆 {{ prefName(school.prefCode) }}の学校（総合力順）</h2>
      <div v-for="(s, i) in ranking" :key="s.id" class="row line" :class="{ own: s.id === school.id }">
        <span class="rank">{{ i + 1 }}</span>
        <span class="sname">{{ s.name }}</span>
        <span class="muted kind">{{ s.kind === 'private' ? '私立' : '公立' }}</span>
        <RankBadge :value="s.overall" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.lv {
  color: var(--gold);
  letter-spacing: 1px;
}
.line {
  padding: 5px 0;
  border-bottom: 1px solid var(--line);
}
.own {
  background: #fff4d0;
  font-weight: 700;
}
.rank {
  width: 24px;
  text-align: right;
  color: var(--ink-soft);
}
.sname {
  flex: 1;
}
.kind {
  width: 32px;
}
</style>
