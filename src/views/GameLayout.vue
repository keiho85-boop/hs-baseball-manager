<script setup lang="ts">
import GameIcon from '@/components/GameIcon.vue'
import { computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import TabBar from '@/components/TabBar.vue'
import GrowthPopup from '@/components/GrowthPopup.vue'
import StoryPlayer from '@/components/story/StoryPlayer.vue'
import QueuedEventHost from '@/components/QueuedEventHost.vue'
import { useGameStore } from '@/stores/game'
import { useUiStore } from '@/stores/ui'
import { SEASON_WEEKS, WEEKS_PER_YEAR, weekToDate } from '@/game/constants'
import RankBadge from '@/components/RankBadge.vue'
import { currentTournament, nextTournament } from '@/game/tournament'

const game = useGameStore()
const router = useRouter()
const ui = useUiStore()

/**
 * 週を進めてセーブしたら、新しい版が出ていないか確かめる。
 * 新しい版があれば、お知らせや物語が終わるのを待って「最新版に更新します」と伝え、タイトルに戻って更新する。
 * 試合の画面ではこの画面が開いていないので、試合中は確かめない
 */
let updating = false
function quiet(): boolean {
  return !game.busy && !game.match && !game.story && !game.showGrowth && !ui.dialog && !game.save?.sugoroku?.pending
}
function waitQuiet(): Promise<void> {
  if (quiet()) return Promise.resolve()
  return new Promise((resolve) => {
    const stop = watch(
      () => [game.rev, game.busy, game.match, game.story, game.showGrowth, ui.dialog] as const,
      () => {
        if (!quiet()) return
        stop()
        resolve()
      },
    )
  })
}
watch(
  () => {
    // セーブデータは変更を追わない作りなので、rev（更新の合図）を読む
    void game.rev
    return game.save ? `${game.save.slot}-${game.save.calendar.year}-${game.save.calendar.week}` : ''
  },
  async (key, before) => {
    // ゲームを開いた直後（週を進めていない）は確かめない
    if (!key || !before || key === before || updating) return
    if (!(await ui.checkForUpdate(key))) return
    updating = true
    await waitQuiet()
    await ui.alert('新しい版が出ています。最新版に更新します。\n（ここまでの進行はセーブされています。タイトル画面に戻ります）', '最新版に更新します')
    game.closeGame()
    await router.replace({ name: 'title' })
    await ui.runUpdate()
  },
)

const date = computed(() => {
  void game.rev
  const s = game.save
  if (!s) return null
  return { year: s.calendar.year, ...weekToDate(s.calendar.week) }
})

/** 次の節目までの週数（引退・卒業式・新年度） */
const milestone = computed(() => {
  void game.rev
  const week = game.save?.calendar.week ?? 1
  const items = [
    { week: SEASON_WEEKS.thirdYearRetire, label: '3年生の引退' },
    { week: SEASON_WEEKS.graduation, label: '卒業式' },
    { week: WEEKS_PER_YEAR + 1, label: '新年度' },
  ]
  const next = items.find((i) => i.week >= week) ?? items[items.length - 1]!
  let best = { label: next.label, weeks: next.week - week, live: false }
  const s = game.save
  if (s) {
    const now = currentTournament(s)
    if (now && !now.finished) return { label: now.name, weeks: 0, live: true }
    const t = nextTournament(s)
    if (t && t.weeks > 0 && t.weeks <= best.weeks) best = { label: t.name, weeks: t.weeks, live: false }
  }
  return best
})
// ストーリー：週が進んだり試合が終わったりしたら、流す場面があるか確かめる（成長の知らせを閉じてから）
// 場面の結果の知らせやダイアログが出ている間は、次の場面を始めない（知らせの上に場面が重ならないように）
watch(
  () => [game.rev, game.busy, game.showGrowth, game.match, ui.notice, ui.dialog] as const,
  () => {
    if (!game.showGrowth && !game.busy && !ui.notice && !ui.dialog) void game.checkStory()
  },
  { immediate: true },
)

const playerMode = computed(() => {
  void game.rev
  return !!game.save?.story?.enabled
})
const overall = computed(() => {
  void game.rev
  return game.ownSchool()?.overall ?? null
})
</script>

<template>
  <div class="layout">
    <header class="top">
      <div v-if="date" class="calendar">
        <div class="cal-year">{{ date.year }}年目</div>
        <div class="cal-month">{{ date.month }}<small>月</small></div>
        <div class="cal-week">第{{ date.weekOfMonth }}週</div>
      </div>
      <div class="title">
        <div class="pref muted-light">{{ playerMode ? '第1章 ナギ現役編' : game.ownSchool()?.kind === 'private' ? '私立' : '公立' }}</div>
        <div class="school">{{ game.ownSchool()?.name }}</div>
        <div v-if="milestone.live" class="milestone live">{{ milestone.label }} <b>開催中</b></div>
        <div v-else class="milestone">{{ milestone.label }}まで <b>あと{{ milestone.weeks }}週</b></div>
      </div>
      <div v-if="overall !== null" class="overall">
        <span class="ov-label">チーム総合</span>
        <RankBadge :value="overall" size="sm" />
      </div>
      <button class="gear" aria-label="設定" @click="router.push({ name: 'settings' })"><GameIcon name="gear" :size="24" /></button>
    </header>
    <main class="content">
      <RouterView v-slot="{ Component, route }">
        <Transition name="page" mode="out-in">
          <component :is="Component" :key="route.fullPath" />
        </Transition>
      </RouterView>
    </main>
    <TabBar />
    <GrowthPopup />
    <QueuedEventHost />
    <StoryPlayer />
  </div>
</template>

<style scoped>
.layout {
  min-height: 100vh;
  padding-bottom: calc(var(--tab-height) + var(--ad-height) + var(--safe-bottom) + 8px);
}
.top {
  position: sticky;
  top: 0;
  z-index: 40;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 12px 7px;
  padding-top: calc(6px + env(safe-area-inset-top, 0px));
  background:
    repeating-linear-gradient(135deg, rgba(255, 255, 255, 0.08) 0 10px, rgba(255, 255, 255, 0) 10px 20px),
    linear-gradient(180deg, #2c98e8 0%, #4fb6f4 100%);
  color: #fff;
  border-radius: 0 0 20px 20px;
  box-shadow: inset 0 -3px 0 rgba(0, 0, 0, 0.1), 0 0 0 1.5px #1f7fd0, 0 6px 14px rgba(26, 111, 194, 0.3);
}
.calendar {
  background: linear-gradient(180deg, #fff 60%, #eef4fa);
  color: var(--ink);
  border-radius: 10px;
  width: 58px;
  text-align: center;
  overflow: hidden;
  box-shadow: 0 3px 0 rgba(0, 0, 0, 0.15);
  flex-shrink: 0;
}
.cal-year {
  background: var(--red);
  color: #fff;
  font-size: 10px;
  font-weight: 800;
  padding: 1px 0;
}
.cal-month {
  font-size: 22px;
  font-weight: 900;
  line-height: 1.1;
}
.cal-month small {
  font-size: 11px;
}
.cal-week {
  font-size: 10px;
  font-weight: 800;
  color: var(--ink-soft);
  padding-bottom: 2px;
}
.title {
  flex: 1;
  min-width: 0;
}
.pref {
  font-size: 11px;
  font-weight: 700;
  opacity: 0.9;
}
.school {
  font-weight: 900;
  font-size: 19px;
  line-height: 1.2;
  text-shadow: 0 2px 0 rgba(0, 0, 0, 0.15);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.milestone {
  display: inline-block;
  margin-top: 2px;
  background: rgba(255, 255, 255, 0.95);
  color: var(--ink);
  border-radius: 999px;
  padding: 1px 9px;
  font-size: 11px;
  font-weight: 800;
  white-space: nowrap;
}
.milestone.live {
  background: #ffd36b;
}
.milestone b {
  color: var(--red);
  font-size: 13px;
  font-weight: 900;
}
.overall {
  display: flex;
  flex-direction: column;
  align-items: center;
  background: rgba(255, 255, 255, 0.95);
  border-radius: 12px;
  padding: 3px 7px 4px;
  box-shadow: 0 2px 0 rgba(0, 0, 0, 0.12);
  flex-shrink: 0;
}
.ov-label {
  font-size: 9px;
  font-weight: 800;
  color: var(--ink-soft);
}
.gear {
  width: 42px;
  height: 42px;
  padding: 0;
  border-radius: 50%;
  background-image: linear-gradient(180deg, #ffffff, #e3f1fc);
  box-shadow: inset 0 0 0 2px #fff, 0 3px 0 #1f7fd0, 0 6px 10px rgba(0, 0, 0, 0.15);
  color: var(--sky-deep);
  display: flex;
  align-items: center;
  justify-content: center;
}
.gear:active {
  box-shadow: none;
}
</style>
