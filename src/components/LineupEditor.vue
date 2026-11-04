<script setup lang="ts">
// オーダー編成：打順・守備位置・先発投手・DHを決める
import { computed, ref, watch } from 'vue'
import { useGameStore } from '@/stores/game'
import { useUiStore } from '@/stores/ui'
import { POSITIONS, POSITION_LABEL, APTITUDE_LABEL } from '@/game/constants'
import { autoLineup, available, BENCH_SIZE, canPitch, lineupValid } from '@/game/match/lineup'
import { ownLineup } from '@/game/match/session'
import { fielderRating, pitcherRating } from '@/game/player'
import type { LineupConfig, Player, Position } from '@/game/types'
import FaceIcon from './FaceIcon.vue'
import RankBadge from './RankBadge.vue'
import GameIcon from './GameIcon.vue'

const game = useGameStore()
const ui = useUiStore()

const roster = computed(() => game.ownPlayers().filter(available))
const draft = ref<LineupConfig | null>(null)
const choosing = ref<number | 'P' | null>(null)
const auto = computed(() => {
  void game.rev
  const s = game.save
  return !s?.lineup || !lineupValid(s.lineup, s.players)
})

function reset(): void {
  if (game.save) draft.value = structuredClone(ownLineup(game.save))
}
watch(() => game.rev, reset, { immediate: true })

const players = computed(() => game.save?.players ?? {})

function posOptions(): (Position | 'DH')[] {
  const list: (Position | 'DH')[] = POSITIONS.filter((p) => p !== 'P' || !draft.value?.useDH)
  if (draft.value?.useDH) list.push('DH')
  return list
}

const problems = computed(() => {
  const d = draft.value
  if (!d) return []
  const msgs: string[] = []
  const positions = d.batters.map((b) => b.position)
  const needed: (Position | 'DH')[] = ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', d.useDH ? 'DH' : 'P']
  for (const pos of needed) {
    const n = positions.filter((x) => x === pos).length
    if (n === 0) msgs.push(`${pos === 'DH' ? '指名打者' : POSITION_LABEL[pos as Position]}がいません`)
    if (n > 1) msgs.push(`${pos === 'DH' ? '指名打者' : POSITION_LABEL[pos as Position]}が${n}人います`)
  }
  const ids = d.batters.map((b) => b.playerId)
  if (new Set(ids).size !== ids.length) msgs.push('同じ選手が2回入っています')
  if (!d.useDH) {
    const pSlot = d.batters.find((b) => b.position === 'P')
    if (pSlot && pSlot.playerId !== d.startingPitcherId) msgs.push('投手の打順には先発投手を入れてください')
  } else if (ids.includes(d.startingPitcherId)) {
    msgs.push('DHありのとき、先発投手は打順に入れられません')
  }
  return msgs
})

function aptOf(p: Player, pos: Position | 'DH'): string {
  return pos === 'DH' ? '' : APTITUDE_LABEL[p.fielding.aptitude[pos]] ?? ''
}

function choose(id: string): void {
  const d = draft.value
  if (!d || choosing.value === null) return
  if (choosing.value === 'P') {
    // 先発投手を替える。DHなしなら投手の打順も一緒に替える
    const slot = d.batters.find((b) => b.position === 'P')
    if (slot) slot.playerId = id
    d.startingPitcherId = id
  } else {
    const idx = choosing.value
    const other = d.batters.findIndex((b) => b.playerId === id)
    // すでに打順にいる選手なら、入れ替える
    if (other >= 0) {
      const tmp = d.batters[other]!.playerId
      d.batters[other]!.playerId = d.batters[idx]!.playerId
      d.batters[idx]!.playerId = tmp
    } else d.batters[idx]!.playerId = id
    if (d.batters[idx]!.position === 'P') d.startingPitcherId = id
  }
  choosing.value = null
}

// ---- ドラッグ＆ドロップで打順を入れ替える ----
const rowEls: (HTMLElement | null)[] = []
const drag = ref<{ from: number; over: number; dy: number; startY: number; rowH: number; id: number } | null>(null)

function onGripDown(e: PointerEvent, i: number): void {
  const el = rowEls[i]
  if (!el) return
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  drag.value = { from: i, over: i, dy: 0, startY: e.clientY, rowH: el.getBoundingClientRect().height, id: e.pointerId }
  navigator.vibrate?.(10)
}
function onGripMove(e: PointerEvent): void {
  const d = drag.value
  if (!d || e.pointerId !== d.id) return
  d.dy = e.clientY - d.startY
  const over = Math.max(0, Math.min(8, Math.round(d.from + d.dy / d.rowH)))
  if (over !== d.over) navigator.vibrate?.(5)
  d.over = over
}
function onGripUp(): void {
  const d = drag.value
  const dr = draft.value
  drag.value = null
  if (!d || !dr || d.from === d.over) return
  const [item] = dr.batters.splice(d.from, 1)
  dr.batters.splice(d.over, 0, item!)
}
function rowStyle(i: number): Record<string, string> | undefined {
  const d = drag.value
  if (!d) return undefined
  if (i === d.from) return { transform: `translateY(${d.dy}px)`, zIndex: '5', transition: 'none' }
  if (d.from < d.over && i > d.from && i <= d.over) return { transform: `translateY(${-d.rowH}px)` }
  if (d.from > d.over && i < d.from && i >= d.over) return { transform: `translateY(${d.rowH}px)` }
  return { transform: 'translateY(0)' }
}

function toggleDH(): void {
  const s = game.save
  if (!s || !draft.value) return
  draft.value = autoLineup(roster.value, !draft.value.useDH)
}

function autoBuild(): void {
  if (!draft.value) return
  draft.value = autoLineup(roster.value, draft.value.useDH)
}

async function save(): Promise<void> {
  const d = draft.value
  if (!d || problems.value.length > 0) return
  // ベンチ：打順と先発投手以外から、控え投手を含めて選ぶ
  const used = new Set([...d.batters.map((b) => b.playerId), d.startingPitcherId])
  const rest = roster.value.filter((p) => !used.has(p.id))
  const pitchers = rest.filter(canPitch).sort((a, b) => pitcherRating(b) - pitcherRating(a)).slice(0, 4)
  const others = rest.filter((p) => !pitchers.includes(p)).sort((a, b) => fielderRating(b) - fielderRating(a))
  d.bench = [...pitchers, ...others].slice(0, BENCH_SIZE).map((p) => p.id)
  await game.saveLineup(structuredClone(d))
  ui.showToast('オーダーを保存しました')
}

async function useAuto(): Promise<void> {
  await game.saveLineup(null)
  ui.showToast('オーダーをおまかせにしました')
}

const candidates = computed(() => {
  if (choosing.value === 'P') return roster.value.filter(canPitch).sort((a, b) => pitcherRating(b) - pitcherRating(a))
  return [...roster.value].sort((a, b) => fielderRating(b) - fielderRating(a))
})
</script>

<template>
  <div v-if="draft" class="card">
    <h2><GameIcon name="clipboard" /> オーダー <span v-if="auto" class="soon">おまかせ中</span></h2>
    <div class="row top">
      <button :class="draft.useDH ? 'sky' : 'secondary'" class="small" @click="toggleDH">DH {{ draft.useDH ? 'あり' : 'なし' }}</button>
      <button class="secondary small" @click="autoBuild">自動で組む</button>
      <slot name="tools" />
    </div>

    <div
      v-for="(b, i) in draft.batters"
      :key="i"
      :ref="(el) => (rowEls[i] = el as HTMLElement | null)"
      class="slot"
      :class="{ dragging: drag?.from === i }"
      :style="rowStyle(i)"
    >
      <div class="order">{{ i + 1 }}</div>
      <select v-model="b.position" class="pos" :disabled="b.position === 'P'">
        <option v-for="pos in posOptions()" :key="pos" :value="pos">{{ pos === 'DH' ? '指' : POSITION_LABEL[pos] }}</option>
        <option v-if="b.position === 'P'" value="P">投</option>
      </select>
      <button class="who" @click="b.position === 'P' ? (choosing = 'P') : (choosing = i)">
        <template v-if="players[b.playerId]">
          <FaceIcon :face="players[b.playerId]!.face" :size="24" />
          <span class="name">{{ players[b.playerId]!.surname }}<small>{{ players[b.playerId]!.grade }}年</small></span>
          <span class="apt">{{ aptOf(players[b.playerId]!, b.position) }}</span>
        </template>
      </button>
      <div
        class="grip"
        aria-label="ドラッグして打順を入れ替える"
        @pointerdown.prevent="onGripDown($event, i)"
        @pointermove="onGripMove"
        @pointerup="onGripUp"
        @pointercancel="onGripUp"
      >
        <i /><i /><i />
      </div>
    </div>

    <div class="slot pitcher">
      <div class="order">先</div>
      <div class="pos fixed">投</div>
      <button class="who" @click="choosing = 'P'">
        <template v-if="players[draft.startingPitcherId]">
          <FaceIcon :face="players[draft.startingPitcherId]!.face" :size="24" />
          <span class="name">{{ players[draft.startingPitcherId]!.surname }}<small>{{ players[draft.startingPitcherId]!.pitching.velocity }}km/h</small></span>
          <span class="muted">体力{{ Math.round(players[draft.startingPitcherId]!.condition.stamina) }}</span>
        </template>
      </button>
    </div>

    <ul v-if="problems.length" class="problems">
      <li v-for="p in problems" :key="p">{{ p }}</li>
    </ul>
    <div class="row actions">
      <button class="secondary" @click="useAuto">毎試合おまかせ</button>
      <button :disabled="problems.length > 0" @click="save">決定</button>
    </div>

    <div v-if="choosing !== null" class="choose-backdrop" @click.self="choosing = null">
      <div class="choose card">
        <h2 class="orange">{{ choosing === 'P' ? '先発投手を選ぶ' : `${(choosing as number) + 1}番打者を選ぶ` }}</h2>
        <button v-for="p in candidates" :key="p.id" class="pick" @click="choose(p.id)">
          <FaceIcon :face="p.face" :size="34" />
          <span class="name">{{ p.surname }} {{ p.givenName }}<small>{{ p.grade }}年・{{ POSITION_LABEL[p.mainPosition] }}</small></span>
          <RankBadge :value="choosing === 'P' ? pitcherRating(p) : fielderRating(p)" size="sm" />
        </button>
        <button class="secondary full" @click="choosing = null">閉じる</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.top {
  margin-bottom: 6px;
  gap: 6px;
  flex-wrap: nowrap;
}
.small {
  padding: 7px 10px;
  font-size: 13px;
  white-space: nowrap;
}
.slot {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 2px 0;
  border-bottom: 2px dashed #eef3f8;
}
.slot.pitcher {
  border-bottom: none;
  margin-top: 4px;
}
.order {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: var(--navy);
  color: #fff;
  font-weight: 900;
  font-size: 13px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.pos {
  width: 64px;
  padding: 3px 26px 3px 10px;
  background-size: 16px 16px, 100% 100%;
  background-position: right 6px center, 0 0;
  flex-shrink: 0;
}
.pos.fixed {
  font-weight: 900;
  text-align: center;
}
.who {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 6px;
  background: #fff;
  color: var(--ink);
  box-shadow: inset 0 0 0 2px #e2eef8;
  text-shadow: none;
  padding: 2px 8px;
  min-width: 0;
  text-align: left;
}
.name {
  flex: 1;
  font-weight: 900;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.name small {
  margin-left: 4px;
  font-size: 11px;
  color: var(--ink-soft);
}
.apt {
  font-weight: 900;
  color: var(--orange);
}
.slot {
  position: relative;
  transition: transform 0.15s ease;
  background: var(--card-bg, #fff);
}
.slot.dragging {
  box-shadow: 0 8px 18px rgba(15, 40, 80, 0.25);
  border-radius: 12px;
  background: #fff8e1;
}
.grip {
  width: 34px;
  align-self: stretch;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  touch-action: none;
  cursor: grab;
  flex-shrink: 0;
}
.grip i {
  display: block;
  width: 18px;
  height: 3px;
  border-radius: 2px;
  background: #9fb4cc;
}
.slot.dragging .grip i {
  background: var(--orange);
}
.arrows {
  display: flex;
  flex-direction: column;
}
.arrows button {
  padding: 0 6px;
  font-size: 11px;
  line-height: 1.2;
}
.problems {
  color: var(--red);
  font-weight: 700;
  font-size: 13px;
  margin: 8px 0;
  padding-left: 18px;
}
.actions {
  margin-top: 8px;
}
.actions button {
  flex: 1;
}
.choose-backdrop {
  position: fixed;
  inset: 0;
  z-index: 70;
  background: rgba(10, 25, 45, 0.5);
  display: flex;
  align-items: flex-end;
}
.choose {
  width: 100%;
  max-width: 640px;
  margin: 0 auto;
  max-height: 78vh;
  overflow-y: auto;
  border-radius: 20px 20px 0 0;
  padding-bottom: calc(14px + var(--safe-bottom));
}
.pick {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  background: #fff;
  color: var(--ink);
  box-shadow: inset 0 0 0 2px #e2eef8;
  text-shadow: none;
  margin-bottom: 8px;
  text-align: left;
}
</style>
