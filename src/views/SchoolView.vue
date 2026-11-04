<script setup lang="ts">
import GameIcon from '@/components/GameIcon.vue'
import { computed, ref } from 'vue'
import InfoSheet from '@/components/InfoSheet.vue'
import ScoutSheet from '@/components/ScoutSheet.vue'
import { useGameStore } from '@/stores/game'
import { prefName } from '@/game/constants'
import RankBadge from '@/components/RankBadge.vue'
import { useUiStore } from '@/stores/ui'
import { facilityCost } from '@/game/tournament'
import type { Facilities } from '@/game/types'

const game = useGameStore()
const ui = useUiStore()
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

const rankOpen = ref(false)
const historyOpen = ref(false)
const scoutOpen = ref(false)
const scoutPoints = computed(() => {
  void game.rev
  return game.save?.scout?.points ?? 0
})

const FACILITY_EFFECT: Record<keyof Facilities, string> = {
  batting: '打撃・長打の練習',
  pitching: '投球の練習',
  fielding: '守備の練習',
  running: '走塁の練習',
  fitness: '体力づくりと全体の伸び',
  medical: 'ケガの治りと予防',
}

async function upgrade(key: keyof Facilities): Promise<void> {
  const s = school.value
  if (!s) return
  const cost = facilityCost(s.facilities[key])
  const ok = await ui.confirm(`${FACILITY_NAME[key]}を強化しますか？\n部費 ${cost}万円（残り ${s.funds}万円）`, { okLabel: '強化する', cancelLabel: 'やめる' })
  if (!ok) return
  if (await game.upgradeFacility(key)) ui.showToast(`${FACILITY_NAME[key]}を強化しました`)
}

const history = computed(() => {
  void game.rev
  return [...(school.value?.history ?? [])].reverse()
})

/** 評判の目安 */
const repLabel = computed(() => {
  const r = school.value?.reputation ?? 0
  return r >= 80 ? '全国区の名門' : r >= 65 ? '県内の強豪' : r >= 50 ? '中堅校' : r >= 35 ? '無名校' : '弱小校'
})
const ownRank = computed(() => ranking.value.findIndex((x) => x.id === school.value?.id) + 1)
</script>

<template>
  <div v-if="school" class="page">
    <div class="card">
      <h2>{{ school.name }}（{{ school.kind === 'private' ? '私立' : '公立' }}）</h2>
      <div class="grid2">
        <div>総合力：<RankBadge :value="school.overall" /></div>
        <div>県内順位：<button class="plain link" @click="rankOpen = true">{{ ownRank }}位／{{ ranking.length }}校</button></div>
        <div>評判：{{ Math.round(school.reputation) }}<small class="muted">（{{ repLabel }}）</small></div>
        <div>部費：{{ school.funds }}万円</div>
      </div>
    </div>

    <div class="card">
      <h2 class="sun"><GameIcon name="build" /> 設備 <span class="funds">部費 {{ school.funds }}万円</span></h2>
      <p class="muted note">部費は毎月の収入と、大会で勝ち進んだときのOB会の寄付で増えます。</p>
      <div v-for="(label, key) in FACILITY_NAME" :key="key" class="fac">
        <div class="fac-main">
          <span class="fac-name">{{ label }}</span>
          <span class="lv">{{ '★'.repeat(school.facilities[key]) }}{{ '☆'.repeat(5 - school.facilities[key]) }}</span>
          <small class="muted">{{ FACILITY_EFFECT[key] }}</small>
        </div>
        <button
          class="small"
          :class="school.funds >= facilityCost(school.facilities[key]) ? '' : 'secondary'"
          :disabled="school.facilities[key] >= 5 || school.funds < facilityCost(school.facilities[key]) || game.busy"
          @click="upgrade(key)"
        >
          {{ school.facilities[key] >= 5 ? '最大' : `${facilityCost(school.facilities[key])}万` }}
        </button>
      </div>
    </div>

    <div class="row two">
      <button class="sun" @click="scoutOpen = true"><GameIcon name="search" :size="16" /> スカウト<small class="pts">{{ scoutPoints }}</small></button>
      <button class="secondary" @click="historyOpen = true"><GameIcon name="trophy" :size="16" /> 大会成績</button>
      <button class="secondary" @click="rankOpen = true"><GameIcon name="trophy" :size="16" /> 県内の学校</button>
    </div>
    <ScoutSheet v-if="scoutOpen" @close="scoutOpen = false" />
    <InfoSheet v-if="historyOpen" @close="historyOpen = false">
      <h2 class="orange"><GameIcon name="trophy" /> {{ school.name }}の大会成績</h2>
      <p v-if="history.length === 0" class="muted">まだ大会に出ていません。最初の大会は1年目の5月（春季大会）です。</p>
      <div v-for="h in history" :key="h.year" class="hist">
        <b>{{ h.year }}年目</b>
        <span v-for="(r, i) in h.results" :key="i" class="pill" :class="{ gold: r.includes('全国') || r.includes('優勝') }">{{ r }}</span>
      </div>
    </InfoSheet>
    <InfoSheet v-if="rankOpen" @close="rankOpen = false">
      <h2 class="orange"><GameIcon name="trophy" /> {{ prefName(school.prefCode) }}の学校（総合力順）</h2>
      <div v-for="(s, i) in ranking" :key="s.id" class="row line" :class="{ own: s.id === school.id }">
        <span class="rank">{{ i + 1 }}</span>
        <span class="sname">{{ s.name }}</span>
        <span class="muted kind">{{ s.kind === 'private' ? '私立' : '公立' }}</span>
        <RankBadge :value="s.overall" />
      </div>
    </InfoSheet>
  </div>
</template>

<style scoped>
.funds {
  margin-left: auto;
  font-size: 13px;
  font-weight: 900;
  background: rgba(255, 255, 255, 0.9);
  color: #8a5a00;
  border-radius: 999px;
  padding: 1px 10px;
}
.fac {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 2px 0;
  border-bottom: 1px dashed #eef3f8;
}
.fac-main {
  flex: 1;
  display: grid;
  grid-template-columns: auto 1fr;
  column-gap: 8px;
  align-items: center;
}
.fac-name {
  font-weight: 800;
  font-size: 14px;
}
.fac-main small {
  grid-column: 1 / -1;
  font-size: 10px;
  line-height: 1.2;
}
.fac .small {
  padding: 4px 10px;
  font-size: 13px;
  min-width: 64px;
}
.note {
  margin: -2px 0 2px;
  font-size: 11px;
}
.scout-btn {
  margin-bottom: 8px;
  padding: 10px;
}
.scout-btn small {
  margin-left: 6px;
  font-size: 12px;
}
.two {
  gap: 8px;
}
.two button {
  flex: 1;
  padding: 10px 2px;
  font-size: 13px;
  white-space: nowrap;
}
.pts {
  margin-left: 3px;
  background: #fff;
  color: #a86f00;
  border-radius: 999px;
  padding: 0 6px;
  font-size: 11px;
}
.hist {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  align-items: center;
  padding: 6px 0;
  border-bottom: 1px solid var(--line);
}
.hist b {
  width: 52px;
  font-size: 13px;
}
.link {
  padding: 0;
  color: var(--sky-deep);
  font-weight: 800;
  text-decoration: underline;
}
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
