<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '@/stores/game'
import { useUiStore } from '@/stores/ui'
import { SEASON_WEEKS, WEEKS_PER_YEAR, formatWeek } from '@/game/constants'
import { playerRating } from '@/game/player'
import RankBadge from '@/components/RankBadge.vue'

const game = useGameStore()
const ui = useUiStore()

const members = computed(() => game.ownPlayers().filter((p) => !p.retired))
const school = computed(() => game.ownSchool())

const milestone = computed(() => {
  void game.rev
  const week = game.save?.calendar.week ?? 1
  const items = [
    { week: SEASON_WEEKS.thirdYearRetire, label: '3年生の引退' },
    { week: SEASON_WEEKS.graduation, label: '卒業式' },
    { week: WEEKS_PER_YEAR + 1, label: '新年度' },
  ]
  const next = items.find((i) => i.week >= week) ?? items[items.length - 1]!
  return { label: next.label, weeks: next.week - week }
})

const summary = computed(() => {
  const list = members.value
  const injured = list.filter((p) => p.condition.injury).length
  const byGrade = [1, 2, 3].map((g) => list.filter((p) => p.grade === g).length)
  const helpers = list.filter((p) => p.helper).length
  const top = [...list].sort((a, b) => playerRating(b) - playerRating(a)).slice(0, 3)
  return { count: list.length, injured, byGrade, helpers, top }
})

const recentLog = computed(() => {
  void game.rev
  return [...(game.save?.log ?? [])].reverse().slice(0, 6)
})

async function next(): Promise<void> {
  const result = await game.nextWeek()
  if (!result) return
  if (result.messages.length > 0) ui.showToast(result.messages[result.messages.length - 1]!)
  if (result.backupPrompt) {
    const ok = await ui.confirm(
      '新しい年度になりました。\nスマホの故障や機種変更に備えて、セーブデータを書き出しておきませんか？',
      { title: 'バックアップのおすすめ', okLabel: '書き出す', cancelLabel: 'あとで' },
    )
    if (ok) await game.exportCurrent()
  }
}
</script>

<template>
  <div class="page">
    <div class="card next-card">
      <div class="muted">次の節目</div>
      <div class="milestone">
        {{ milestone.label }}まで <b>あと{{ milestone.weeks }}週</b>
      </div>
      <button class="full big" :disabled="game.busy" @click="next">{{ game.busy ? '保存中…' : '1週進める' }}</button>
      <p class="muted note">※ すごろくでの練習は、開発段階3で追加します。今は「1週進める」で通常の練習が行われます。</p>
    </div>

    <div class="card">
      <h2>チームの様子</h2>
      <div class="grid2">
        <div>部員数：<b>{{ summary.count }}人</b></div>
        <div>総合力：<RankBadge v-if="school" :value="school.overall" /></div>
        <div>1年 {{ summary.byGrade[0] }}人／2年 {{ summary.byGrade[1] }}人／3年 {{ summary.byGrade[2] }}人</div>
        <div>ケガ人：{{ summary.injured }}人</div>
      </div>
      <p v-if="summary.helpers > 0" class="muted">助っ人 {{ summary.helpers }}人が参加中</p>
      <div v-if="summary.top.length" class="top">
        <div class="muted">注目の選手</div>
        <div v-for="p in summary.top" :key="p.id" class="row">
          <RouterLink :to="{ name: 'player', params: { id: p.id } }">{{ p.surname }} {{ p.givenName }}</RouterLink>
          <span class="muted">{{ p.grade }}年</span>
          <RankBadge :value="playerRating(p)" />
        </div>
      </div>
    </div>

    <div class="card">
      <h2>最近の出来事</h2>
      <ul class="log">
        <li v-for="(l, i) in recentLog" :key="i">
          <span class="muted">{{ formatWeek(l.year, l.week) }}</span><br />{{ l.text }}
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.milestone {
  font-size: 16px;
  margin-bottom: 10px;
}
.big {
  padding: 14px;
  font-size: 17px;
}
.note {
  margin: 8px 0 0;
  font-size: 12px;
}
.top {
  margin-top: 8px;
}
.top a {
  color: var(--green);
  font-weight: 600;
}
.log {
  list-style: none;
  padding: 0;
  margin: 0;
}
.log li {
  padding: 6px 0;
  border-bottom: 1px solid var(--line);
}
.log li:last-child {
  border-bottom: none;
}
</style>
