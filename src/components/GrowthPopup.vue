<script setup lang="ts">
// 練習や試合の週に伸びた選手を、能力表（ランクと数値）つきで見せる
import { computed } from 'vue'
import { useGameStore } from '@/stores/game'
import { POSITION_LABEL, rankOf, velocityScore } from '@/game/constants'
import type { Player } from '@/game/types'
import type { GrowthEntry } from '@/game/growth'
import FaceIcon from './FaceIcon.vue'
import { watch } from 'vue'
import { play } from '@/sound'

const game = useGameStore()

/** 主な能力（野手と投手で並べる項目を変える）。growth.ts の見出しと同じ名前を使う */
const CORE_FIELDER: { label: string; get: (p: Player) => number }[] = [
  { label: 'ミート', get: (p) => p.batting.contact },
  { label: 'パワー', get: (p) => p.batting.power },
  { label: '選球眼', get: (p) => p.batting.eye },
  { label: '走力', get: (p) => p.running.speed },
  { label: '肩力', get: (p) => p.fielding.arm },
  { label: '守備範囲', get: (p) => p.fielding.range },
]
const CORE_PITCHER: { label: string; get: (p: Player) => number; velo?: boolean }[] = [
  { label: '球速', get: (p) => p.pitching.velocity, velo: true },
  { label: 'コントロール', get: (p) => p.pitching.control },
  { label: 'スタミナ', get: (p) => p.pitching.stamina },
  { label: 'キレ', get: (p) => p.pitching.kire },
  { label: 'クイック', get: (p) => p.pitching.quick },
  { label: 'ミート', get: (p) => p.batting.contact },
]
const OFF_FIELDER = new Set(['球速', 'コントロール', 'スタミナ', 'キレ', 'クイック', '対ピンチ', '変化球'])
const OFF_PITCHER = new Set(['盗塁', '走塁', '走塁判断', '選球眼'])
const SHORT: Record<string, string> = { コントロール: '制球', スタミナ: 'スタミナ', 守備範囲: '守備', 走塁判断: '走塁' }

interface Row {
  e: GrowthEntry
  p: Player
  core: { label: string; rank: string; value: string; up: number }[]
  others: { label: string; up: number; unit: string }[]
  total: number
}

const rows = computed<Row[]>(() => {
  const list: Row[] = []
  for (const e of game.lastGrowth) {
    const p = game.player(e.playerId)
    if (!p) continue
    const core = p.mainPosition === 'P' ? CORE_PITCHER : CORE_FIELDER
    const up = (label: string) => {
      const c = e.changes.find((x) => x.label === label)
      return c ? c.after - c.before : 0
    }
    const coreLabels = new Set(core.map((c) => c.label))
    // 本職と関係のない伸び（野手の投手能力、投手の盗塁・走塁）は出さない
    const hide = p.mainPosition === 'P' ? OFF_PITCHER : OFF_FIELDER
    const shown = e.changes.filter((c) => !hide.has(c.label))
    if (shown.length === 0) continue
    list.push({
      e,
      p,
      core: core.map((c) => {
        const v = c.get(p)
        return {
          label: SHORT[c.label] ?? c.label,
          rank: rankOf('velo' in c && c.velo ? velocityScore(v) : v),
          value: 'velo' in c && c.velo ? `${v}km` : `${v}`,
          up: up(c.label),
        }
      }),
      others: shown.filter((c) => !coreLabels.has(c.label)).map((c) => ({ label: SHORT[c.label] ?? c.label, up: c.after - c.before, unit: c.unit ?? '' })),
      total: shown.reduce((s, c) => s + c.after - c.before, 0),
    })
  }
  // 選手育成モード：育成選手 → 各部のエースなど物語の人物 → ほかの部員 の順
  const st = game.save?.story?.success
  if (st) {
    const fixedIds = new Set(Object.values(st.joined ?? {}).filter(Boolean) as string[])
    const order = (r: Row) => (r.p.id === st.focusId ? 0 : r.p.storyCast === 'daichi' || fixedIds.has(r.p.id) ? 1 : 2)
    list.sort((a, b) => order(a) - order(b))
  }
  return list
})

watch(
  () => game.showGrowth,
  (v) => v && play('up'),
)

function close(): void {
  game.showGrowth = false
}
</script>

<template>
  <Transition name="sheet">
    <div v-if="game.showGrowth" class="backdrop" @click.self="close">
      <div class="sheet">
        <div class="banner">{{ game.growthTitle }}</div>
        <div class="list">
          <div v-for="(r, i) in rows" :key="r.e.playerId" class="entry" :style="{ animationDelay: `${Math.min(i, 8) * 50}ms` }">
            <div class="head">
              <FaceIcon :face="r.p.face" :size="34" />
              <span class="pos" :class="r.p.mainPosition === 'P' ? 'p' : ''">{{ POSITION_LABEL[r.p.mainPosition] }}</span>
              <span class="name">{{ r.e.name }}<small>{{ r.p.grade }}年</small></span>
              <span class="total">合計 +{{ r.total }}</span>
            </div>
            <div class="grid">
              <div v-for="c in r.core" :key="c.label" class="cell" :class="{ up: c.up > 0 }">
                <small>{{ c.label }}</small>
                <b :class="`rk-${c.rank}`">{{ c.rank }}<i>{{ c.value }}</i></b>
                <em v-if="c.up > 0">+{{ c.up }}</em>
              </div>
            </div>
            <div v-if="r.others.length" class="others">
              <span v-for="o in r.others" :key="o.label">{{ o.label }}<b>+{{ o.up }}{{ o.unit }}</b></span>
            </div>
          </div>
        </div>
        <button class="sun full" @click="close">OK</button>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.backdrop {
  position: fixed;
  inset: 0;
  background: rgba(16, 40, 70, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px 12px;
  z-index: 80;
}
.sheet {
  width: 100%;
  max-width: 420px;
  background: #fff;
  border-radius: 22px;
  padding: 0 10px 14px;
  box-shadow: 0 6px 0 rgba(0, 0, 0, 0.15), 0 16px 40px rgba(0, 0, 0, 0.25);
  border: 3px solid #ffd85e;
  max-height: 86vh;
  display: flex;
  flex-direction: column;
}
.banner {
  margin: -18px auto 8px;
  background: linear-gradient(180deg, #ffd85e, #ffb400);
  color: #5a3a00;
  font-weight: 900;
  font-size: 18px;
  padding: 6px 22px;
  border-radius: 999px;
  box-shadow: 0 4px 0 #d18f00;
  animation: pop-in 0.35s ease-out;
}
.list {
  overflow-y: auto;
  margin-bottom: 10px;
}
.entry {
  padding: 8px 2px;
  border-bottom: 2px dashed #eef3f8;
  animation: float-up 0.35s ease-out both;
}
.head {
  display: flex;
  align-items: center;
  gap: 6px;
}
.pos {
  font-size: 11px;
  font-weight: 900;
  background: #ffe9c7;
  color: #b8620a;
  border-radius: 5px;
  padding: 1px 5px;
}
.pos.p {
  background: #fde2e2;
  color: #c62d33;
}
.name {
  font-weight: 900;
  font-size: 15px;
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.name small {
  font-size: 11px;
  color: var(--ink-soft);
  margin-left: 4px;
}
.total {
  font-size: 12px;
  font-weight: 900;
  color: var(--orange);
}
.grid {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 3px;
  margin-top: 5px;
}
.cell {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  background: #f2f6fb;
  border-radius: 7px;
  padding: 2px 0 3px;
}
.cell.up {
  background: #fff3d6;
  box-shadow: inset 0 0 0 1.5px #ffc04d;
}
.cell small {
  font-size: 9px;
  font-weight: 800;
  color: var(--ink-soft);
  white-space: nowrap;
}
.cell b {
  font-size: 15px;
  font-weight: 900;
  font-style: italic;
  line-height: 1.1;
  white-space: nowrap;
}
.cell b i {
  font-style: normal;
  font-size: 11px;
  margin-left: 1px;
  color: var(--ink);
}
.cell em {
  position: absolute;
  top: -6px;
  right: -2px;
  font-style: normal;
  font-size: 10px;
  font-weight: 900;
  color: #fff;
  background: var(--orange);
  border-radius: 999px;
  padding: 0 4px;
}
.others {
  display: flex;
  flex-wrap: wrap;
  gap: 2px 10px;
  margin-top: 5px;
  font-size: 12px;
  font-weight: 700;
  color: var(--ink-soft);
}
.others b {
  color: var(--orange);
  font-weight: 900;
  margin-left: 2px;
}
.sheet-enter-active,
.sheet-leave-active {
  transition: opacity 0.2s;
}
.sheet-enter-from,
.sheet-leave-to {
  opacity: 0;
}
</style>
