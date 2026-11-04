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
import SugorokuBoard from '@/components/sugoroku/SugorokuBoard.vue'
import CardHand from '@/components/sugoroku/CardHand.vue'
import EventDialog from '@/components/sugoroku/EventDialog.vue'
import PlayerSheet from '@/components/PlayerSheet.vue'
import { BOARD_SIZE, CARD_EFFECT_DESC, SQUARES } from '@/game/sugoroku'
import type { SquareType } from '@/game/types'

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

const sg = computed(() => {
  void game.rev
  return game.save?.sugoroku ?? null
})
const selected = ref<number | null>(null)
const displayPos = ref<number | null>(null)
const moving = ref(false)
const eventOpen = ref(false)
const specialOpen = ref(false)
const viewing = ref<string | null>(null)

const preview = computed(() => {
  const s = sg.value
  if (!s || selected.value === null) return null
  const c = s.hand[selected.value]
  return c ? (s.position + c.value) % BOARD_SIZE : null
})

function squareName(sq: SquareType): string {
  return SQUARES[sq].label
}

function selectCard(i: number): void {
  selected.value = selected.value === i ? null : i
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function go(): Promise<void> {
  if (selected.value === null || moving.value) return
  const idx = selected.value
  selected.value = null
  const start = sg.value?.position ?? 0
  moving.value = true
  displayPos.value = start
  const r = await game.useCard(idx)
  if (!r) {
    moving.value = false
    displayPos.value = null
    return
  }
  for (const pos of r.path) {
    displayPos.value = pos
    await sleep(170)
  }
  await sleep(250)
  moving.value = false
  displayPos.value = null
  afterLand()
}

function afterLand(): void {
  const pending = sg.value?.pending
  if (!pending) return
  if (pending.event) eventOpen.value = true
  else if (pending.needsPlayer) specialOpen.value = true
  else void finish({})
}

async function onEventDone(choice: number): Promise<void> {
  eventOpen.value = false
  await finish({ choice })
}

async function onSpecial(id: string): Promise<void> {
  specialOpen.value = false
  await finish({ specialPlayerId: id })
}

const IMPORTANT = ['特殊能力', '克服', '違和感', '悪化', '全治', '入部した']

async function finish(opts: { choice?: number; specialPlayerId?: string }): Promise<void> {
  const r = await game.finishSquare(opts)
  if (!r) return
  const important = r.week.messages.filter((m) => IMPORTANT.some((k) => m.includes(k)) && !m.includes('治った'))
  if (important.length > 0) await ui.alert(important.join('\n'), '今週の出来事')
  else if (r.week.messages.length > 0) ui.showToast(r.week.messages[r.week.messages.length - 1]!)
  if (r.week.backupPrompt) {
    const ok = await ui.confirm(
      '新しい年度になりました。\nスマホの故障や機種変更に備えて、セーブデータを書き出しておきませんか？',
      { title: 'バックアップのおすすめ', okLabel: '書き出す', cancelLabel: 'あとで' },
    )
    if (ok) await game.exportCurrent()
  }
}

const specialCandidates = computed(() =>
  game
    .ownPlayers()
    .filter((p) => !p.retired && !p.condition.injury)
    .sort((a, b) => playerRating(b) - playerRating(a)),
)
</script>

<template>
  <div class="home">
    <div class="stage">
      <FieldScene :height="84" :evening="evening" />
      <div class="strip">
        <div class="bubble">{{ milestone.label }}まで <b>あと{{ milestone.weeks }}週</b></div>
        <div class="overall">
          <span class="overall-label">チーム総合</span>
          <RankBadge v-if="school" :value="school.overall" />
        </div>
      </div>
    </div>

    <div class="page">
      <button v-if="game.match" class="sun go" @click="router.push({ name: 'match' })">
        <span class="go-main">試合の続きへ</span>
        <span class="go-sub"><GameIcon name="play" :size="12" /> {{ game.match.options.label }}</span>
      </button>
      <template v-else-if="sg">
        <div class="card board-card">
          <div class="board-fit">
            <SugorokuBoard
              :board="sg.board"
              :position="displayPos ?? sg.position"
              :preview="moving ? null : preview"
              :month="sg.boardMonth"
              :camp="sg.campWeeks > 0"
              :milestone="`${milestone.label}まで あと${milestone.weeks}週`"
              :card-note="selected !== null && sg.hand[selected] && sg.hand[selected]!.effect !== 'none' ? CARD_EFFECT_DESC[sg.hand[selected]!.effect] : null"
            />
          </div>
          <template v-if="sg.pending && !moving">
            <button class="sun full go-btn" :disabled="game.busy" @click="afterLand">{{ squareName(sg.pending.square) }}マスの続きをする</button>
          </template>
          <template v-else>
            <div class="hand-wrap">
              <CardHand :hand="sg.hand" :selected="selected" :disabled="moving || game.busy" @select="selectCard" />
            </div>
            <button class="sun full go-btn" :disabled="selected === null || moving || game.busy" @click="go">
              <GameIcon name="play" :size="14" /> {{ selected === null ? 'カードを選んでください' : `${sg.hand[selected]!.value}マス進む` }}
            </button>
          </template>
        </div>
        <button class="sky full practice-match" :disabled="game.busy || moving || !!sg.pending" @click="picking = true">
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
    <EventDialog v-if="eventOpen && sg?.pending?.event" :event="sg.pending.event" @done="onEventDone" />
    <div v-if="specialOpen" class="picker-backdrop">
      <div class="picker card">
        <h2 class="red"><GameIcon name="flame" /> 特訓する選手を選ぶ</h2>
        <p class="muted">選んだ選手は大きく伸び、特殊能力を覚えることもあります。そのぶん疲れます。</p>
        <div class="opp-list">
          <div v-for="p in specialCandidates" :key="p.id" class="opp-row">
            <button class="opp" @click="onSpecial(p.id)">
              <FaceIcon :face="p.face" :size="34" />
              <span class="opp-name">{{ p.surname }} {{ p.givenName }}<small>{{ p.grade }}年・{{ POSITION_LABEL[p.mainPosition] }}・体力{{ p.condition.stamina }}</small></span>
              <RankBadge :value="playerRating(p)" size="sm" />
            </button>
            <button class="secondary look" aria-label="能力を見る" @click="viewing = p.id"><GameIcon name="search" :size="16" /></button>
          </div>
        </div>
      </div>
    </div>
    <PlayerSheet v-if="viewing" :player-id="viewing" @close="viewing = null" />
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
.home {
  --stage-h: 66px;
}
.stage {
  position: relative;
  margin-top: -18px;
  overflow: hidden;
}
/* 縦に短い画面では背景の帯を省き、盤面を大きくする（節目までの週数は盤面の中に出す） */
@media (max-height: 720px) {
  .home {
    --stage-h: 0px;
  }
  .stage {
    display: none;
  }
  .board-card {
    margin-top: 0 !important;
  }
}
.strip {
  position: absolute;
  left: 10px;
  right: 10px;
  top: 26px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.bubble {
  background: #fff;
  border-radius: 999px;
  padding: 4px 12px;
  font-size: 12px;
  font-weight: 800;
  box-shadow: 0 3px 0 rgba(0, 0, 0, 0.12);
  white-space: nowrap;
}
.bubble b {
  font-size: 16px;
  color: var(--red);
  font-weight: 900;
}
.overall {
  display: flex;
  align-items: center;
  gap: 4px;
  background: rgba(255, 255, 255, 0.95);
  border-radius: 999px;
  padding: 2px 10px 2px 12px;
  box-shadow: 0 3px 0 rgba(0, 0, 0, 0.12);
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
.board-card {
  margin-top: -14px;
  z-index: 2;
  padding-top: 10px;
}
/* 盤面・カード・進むボタンが1画面に収まるよう、画面の高さに合わせて盤面の大きさを決める */
.board-fit {
  width: min(100%, max(220px, calc(100dvh - 400px - var(--stage-h) - env(safe-area-inset-top, 0px) - var(--safe-bottom))));
  margin: 0 auto;
}
.h-note {
  margin-left: auto;
  font-size: 11px;
  opacity: 0.9;
}
.hand-wrap {
  margin-top: 16px;
}
.card-desc {
  text-align: center;
  margin: 8px 0 0;
}
.go-btn {
  margin-top: 10px;
  padding: 12px;
  font-size: 16px;
}
.practice-match {
  margin-top: 0;
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
.opp-row {
  display: flex;
  gap: 8px;
  align-items: stretch;
}
.opp-row .opp {
  flex: 1;
}
.look {
  padding: 0 12px;
  margin-bottom: 8px;
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
