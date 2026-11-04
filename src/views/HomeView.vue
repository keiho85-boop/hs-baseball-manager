<script setup lang="ts">
import GameIcon from '@/components/GameIcon.vue'
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useGameStore } from '@/stores/game'
import { useUiStore } from '@/stores/ui'
import { POSITION_LABEL, SEASON_WEEKS, WEEKS_PER_YEAR, formatWeek, weekToDate } from '@/game/constants'
import { playerRating } from '@/game/player'
import RankBadge from '@/components/RankBadge.vue'
import FaceIcon from '@/components/FaceIcon.vue'
import FieldScene from '@/components/FieldScene.vue'

const game = useGameStore()
const ui = useUiStore()
const router = useRouter()
const picking = ref(false)

/** 練習試合の相手（同じ都道府県の、選手を個別に持つ学校） */
const opponents = computed(() => {
  void game.rev
  const s = game.save
  if (!s) return []
  return Object.values(s.schools)
    .filter((x) => x.prefCode === s.prefCode && x.detailed && x.id !== s.playerSchoolId)
    .sort((a, b) => b.overall - a.overall)
})

async function startMatch(id: string): Promise<void> {
  picking.value = false
  await game.startPracticeMatch(id)
  await router.push({ name: 'match' })
}

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

/** 夕方の景色にする時期（夏の終わり〜秋） */
const evening = computed(() => {
  void game.rev
  const m = weekToDate(game.save?.calendar.week ?? 1).month
  return m >= 9 && m <= 11
})

const summary = computed(() => {
  const list = members.value
  const injured = list.filter((p) => p.condition.injury).length
  const byGrade = [1, 2, 3].map((g) => list.filter((p) => p.grade === g).length)
  const helpers = list.filter((p) => p.helper).length
  const top = [...list].sort((a, b) => playerRating(b) - playerRating(a)).slice(0, 3)
  const goodForm = list.filter((p) => p.condition.form >= 4).length
  return { count: list.length, injured, byGrade, helpers, top, goodForm }
})

const recentLog = computed(() => {
  void game.rev
  return [...(game.save?.log ?? [])].reverse().slice(0, 5)
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
  <div class="home">
    <div class="stage">
      <FieldScene :height="190" :evening="evening" />
      <div class="bubble">
        {{ milestone.label }}まで<br /><b>あと{{ milestone.weeks }}週</b>
      </div>
      <div class="overall">
        <div class="overall-label">チーム総合</div>
        <RankBadge v-if="school" :value="school.overall" size="lg" />
      </div>
    </div>

    <div class="page">
      <button v-if="game.match" class="sun go" @click="router.push({ name: 'match' })">
        <span class="go-main">試合の続きへ</span>
        <span class="go-sub"><GameIcon name="play" :size="12" /> {{ game.match.options.label }}</span>
      </button>
      <template v-else>
        <button class="sun go" :disabled="game.busy" @click="next">
          <span class="go-main">{{ game.busy ? '練習中…' : '1週間 練習する' }}</span>
          <span class="go-sub"><GameIcon name="play" :size="12" /> 次の週へ</span>
        </button>
        <button class="sky full practice-match" :disabled="game.busy" @click="picking = true">
          <GameIcon name="ball" :size="18" /> 今週は練習試合をする
        </button>
      </template>

      <div class="card">
        <h2 class="grass"><GameIcon name="cap" /> チームの様子</h2>
        <div class="stats">
          <div class="stat">
            <div class="num">{{ summary.count }}<small>人</small></div>
            <div class="muted">部員</div>
          </div>
          <div class="stat">
            <div class="num">{{ summary.goodForm }}<small>人</small></div>
            <div class="muted">好調</div>
          </div>
          <div class="stat">
            <div class="num" :class="{ warn: summary.injured > 0 }">{{ summary.injured }}<small>人</small></div>
            <div class="muted">ケガ人</div>
          </div>
        </div>
        <div class="grades">
          <span class="pill">1年 {{ summary.byGrade[0] }}人</span>
          <span class="pill">2年 {{ summary.byGrade[1] }}人</span>
          <span class="pill">3年 {{ summary.byGrade[2] }}人</span>
          <span v-if="summary.helpers > 0" class="pill gold">助っ人 {{ summary.helpers }}人</span>
        </div>
      </div>

      <div v-if="summary.top.length" class="card">
        <h2 class="orange"><GameIcon name="star" /> 注目の選手</h2>
        <button v-for="(p, i) in summary.top" :key="p.id" class="star" @click="router.push({ name: 'player', params: { id: p.id } })">
          <span class="medal" :class="`m${i}`">{{ i + 1 }}</span>
          <FaceIcon :face="p.face" :size="42" />
          <span class="star-name">
            <b>{{ p.surname }} {{ p.givenName }}</b>
            <span class="muted">{{ p.grade }}年・{{ POSITION_LABEL[p.mainPosition] }}</span>
          </span>
          <RankBadge :value="playerRating(p)" />
        </button>
      </div>

      <div class="card">
        <h2><GameIcon name="megaphone" /> 最近の出来事</h2>
        <ul class="log">
          <li v-for="(l, i) in recentLog" :key="i">
            <span class="muted">{{ formatWeek(l.year, l.week) }}</span>
            <div>{{ l.text }}</div>
          </li>
        </ul>
      </div>
    </div>
    <div v-if="picking" class="picker-backdrop" @click.self="picking = false">
      <div class="picker card">
        <h2 class="grass"><GameIcon name="ball" /> 練習試合の相手を選ぶ</h2>
        <p class="muted">練習試合をした週は、すごろくの練習の代わりに試合を行います。強い相手ほど学ぶことも多くなります。</p>
        <div class="opp-list">
          <button v-for="o in opponents" :key="o.id" class="opp" @click="startMatch(o.id)">
            <span class="opp-name">{{ o.name }}<small>{{ o.kind === 'private' ? '私立' : '公立' }}</small></span>
            <RankBadge :value="o.overall" />
          </button>
        </div>
        <button class="secondary full" @click="picking = false">やめる</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.stage {
  position: relative;
  margin-top: -18px;
  overflow: hidden;
}
.bubble {
  position: absolute;
  left: 14px;
  top: 34px;
  background: #fff;
  border-radius: 16px;
  padding: 8px 14px;
  font-size: 13px;
  font-weight: 700;
  box-shadow: 0 4px 0 rgba(0, 0, 0, 0.12);
  animation: pop-in 0.4s ease-out;
}
.bubble::after {
  content: '';
  position: absolute;
  left: 22px;
  bottom: -9px;
  border: 6px solid transparent;
  border-top: 7px solid #fff;
}
.bubble b {
  font-size: 20px;
  color: var(--red);
  font-weight: 900;
}
.overall {
  position: absolute;
  right: 14px;
  top: 38px;
  background: rgba(255, 255, 255, 0.92);
  border-radius: 16px;
  padding: 6px 12px 8px;
  text-align: center;
  box-shadow: 0 4px 0 rgba(0, 0, 0, 0.12);
}
.overall-label {
  font-size: 11px;
  font-weight: 800;
  color: var(--ink-soft);
}
.go {
  width: 100%;
  padding: 14px;
  border-radius: 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-top: -36px;
  position: relative;
  z-index: 2;
  box-shadow: 0 6px 0 var(--sun-deep), 0 10px 18px rgba(0, 0, 0, 0.18);
}
.go {
  overflow: hidden;
}
.go::after {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  width: 30%;
  background: linear-gradient(90deg, rgba(255, 255, 255, 0) 0%, rgba(255, 255, 255, 0.55) 50%, rgba(255, 255, 255, 0) 100%);
  animation: shine 3.2s ease-in-out infinite;
  pointer-events: none;
}
.go-main {
  font-size: 21px;
  font-weight: 900;
}
.go-sub {
  font-size: 12px;
  opacity: 0.85;
}
.practice-match {
  margin-top: 14px;
  padding: 11px;
}
.go + .card,
.practice-match + .card {
  margin-top: 22px;
}
.picker-backdrop {
  position: fixed;
  inset: 0;
  z-index: 70;
  background: rgba(10, 25, 45, 0.5);
  display: flex;
  align-items: flex-end;
}
.picker {
  width: 100%;
  max-width: 640px;
  margin: 0 auto;
  max-height: 78vh;
  display: flex;
  flex-direction: column;
  border-radius: 20px 20px 0 0;
  padding-bottom: calc(14px + var(--safe-bottom));
}
.opp-list {
  overflow-y: auto;
  margin: 6px 0 10px;
}
.opp {
  display: flex;
  align-items: center;
  width: 100%;
  background: #fff;
  color: var(--ink);
  text-shadow: none;
  box-shadow: inset 0 0 0 2px #e2eef8;
  margin-bottom: 8px;
  text-align: left;
}
.opp-name {
  flex: 1;
  font-weight: 900;
}
.opp-name small {
  margin-left: 6px;
  font-size: 11px;
  color: var(--ink-soft);
}
.stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  text-align: center;
  gap: 6px;
}
.stat {
  background: #f3f9ff;
  border-radius: 12px;
  padding: 6px 0;
}
.num {
  font-size: 26px;
  font-weight: 900;
  line-height: 1.1;
  color: var(--sky-deep);
}
.num small {
  font-size: 12px;
}
.num.warn {
  color: var(--red);
}
.grades {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 10px;
}
.star {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  background: #fff;
  color: var(--ink);
  box-shadow: none;
  text-shadow: none;
  padding: 6px 4px;
  border-radius: 12px;
  font-weight: 400;
  text-align: left;
}
.star:active {
  background: #f3f9ff;
  box-shadow: none;
}
.star + .star {
  border-top: 2px dashed #eef3f8;
}
.medal {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 900;
  font-size: 13px;
  color: #fff;
}
.m0 {
  background: linear-gradient(135deg, #ffe066, #f5a300);
}
.m1 {
  background: linear-gradient(135deg, #e6ebf1, #a4afbd);
}
.m2 {
  background: linear-gradient(135deg, #f3c39a, #c27a43);
}
.star-name {
  flex: 1;
  display: flex;
  flex-direction: column;
  line-height: 1.3;
}
.log {
  list-style: none;
  padding: 0;
  margin: 0;
}
.log li {
  padding: 6px 0;
  border-bottom: 2px dashed #eef3f8;
}
.log li:last-child {
  border-bottom: none;
}
</style>
