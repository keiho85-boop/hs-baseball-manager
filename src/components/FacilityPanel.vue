<script setup lang="ts">
// 設備と部費（部の様子・学校の画面で使う）
import { computed } from 'vue'
import { useGameStore } from '@/stores/game'
import { useUiStore } from '@/stores/ui'
import { facilityCost } from '@/game/tournament'
import type { Facilities } from '@/game/types'

const game = useGameStore()
const ui = useUiStore()
const BASE = import.meta.env.BASE_URL
const school = computed(() => {
  void game.rev
  return game.ownSchool()
})

const FACILITY_NAME: Record<keyof Facilities, string> = {
  batting: '打撃練習場',
  pitching: 'ブルペン',
  fielding: '守備練習場',
  running: '走路',
  fitness: 'トレーニング室',
  medical: '医務室',
}
const FACILITY_EFFECT: Record<keyof Facilities, string> = {
  batting: '打撃・長打の練習',
  pitching: '投球の練習',
  fielding: '守備の練習',
  running: '走塁の練習',
  fitness: '体力づくりと全体の伸び',
  medical: 'ケガの治りと予防',
}
const KEYS = Object.keys(FACILITY_NAME) as (keyof Facilities)[]

async function upgrade(key: keyof Facilities): Promise<void> {
  const s = school.value
  if (!s) return
  const cost = facilityCost(s.facilities[key])
  const ok = await ui.confirm(`${FACILITY_NAME[key]}を強化しますか？\n部費 ${cost}万円（残り ${s.funds}万円）`, { okLabel: '強化する', cancelLabel: 'やめる' })
  if (!ok) return
  if (await game.upgradeFacility(key)) ui.notify({ title: '設備を強化！', message: `${FACILITY_NAME[key]}が★${school.value?.facilities[key]}になった`, icon: 'up' })
}
</script>

<template>
  <div v-if="school" class="fp">
    <div class="fp-head">
      <span class="fp-title"><img :src="`${BASE}ui/ui_facility.webp`" alt="" />設備</span>
      <span class="fp-funds"><img :src="`${BASE}ui/ui_funds.webp`" alt="" />部費 <b>{{ school.funds }}</b>万円</span>
    </div>
    <div v-for="key in KEYS" :key="key" class="fac">
      <div class="fac-main">
        <span class="fac-name">{{ FACILITY_NAME[key] }}</span>
        <span class="lv">{{ '★'.repeat(school.facilities[key]) }}{{ '☆'.repeat(5 - school.facilities[key]) }}</span>
        <small>{{ FACILITY_EFFECT[key] }}</small>
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
    <p class="fp-note">部費は毎月の収入と、大会で勝ち進んだときの寄付で増えます。</p>
  </div>
</template>

<style scoped>
.fp-head {
  display: flex;
  align-items: center;
  margin-bottom: 4px;
}
.fp-title,
.fp-funds {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-weight: 900;
}
.fp-title img,
.fp-funds img {
  width: 28px;
  height: 28px;
}
.fp-funds {
  margin-left: auto;
  font-size: 13px;
  color: #8a5a00;
  background: #fff6d6;
  border-radius: 999px;
  padding: 1px 10px 1px 2px;
}
.fac {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 3px 0;
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
.lv {
  color: var(--gold);
  letter-spacing: 1px;
}
.fac-main small {
  grid-column: 1 / -1;
  font-size: 10px;
  line-height: 1.2;
  color: var(--ink-soft);
}
.fac .small {
  padding: 4px 10px;
  font-size: 13px;
  min-width: 64px;
}
.fp-note {
  margin: 4px 0 0;
  font-size: 11px;
  color: var(--ink-soft);
}
</style>
