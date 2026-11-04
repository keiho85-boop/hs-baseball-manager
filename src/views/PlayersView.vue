<script setup lang="ts">
// 部員一覧：野手・投手を表で並べ、能力1／能力2／成績を切り替えて見る。見出しを押すと並び替え
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useGameStore } from '@/stores/game'
import { useUiStore } from '@/stores/ui'
import { POSITIONS, POSITION_LABEL, PRACTICE_NAME, rankOf, velocityScore } from '@/game/constants'
import type { Player, PracticeMenu } from '@/game/types'
import GameIcon from '@/components/GameIcon.vue'
import { getSkill } from '@/game/skills'

const game = useGameStore()
const ui = useUiStore()
const router = useRouter()

const kind = ref<'bat' | 'pit'>('bat')
const view = ref<'a1' | 'a2' | 'st' | 'sk'>('a1')
const filter = ref<string>('all')
const sort = ref<{ key: string; desc: boolean } | null>(null)
const showRetired = ref(false)
const menuFor = ref<Player | null>(null)

const OUTFIELD = ['LF', 'CF', 'RF']
const BAT_FILTERS = [
  { key: 'all', label: '全員' },
  { key: 'C', label: '捕' },
  { key: '1B', label: '一' },
  { key: '2B', label: '二' },
  { key: '3B', label: '三' },
  { key: 'SS', label: '遊' },
  { key: 'OF', label: '外野' },
]
const PIT_FILTERS = [
  { key: 'all', label: '全員' },
  { key: 'g3', label: '3年' },
  { key: 'g2', label: '2年' },
  { key: 'g1', label: '1年' },
]
const filters = computed(() => (kind.value === 'bat' ? BAT_FILTERS : PIT_FILTERS))

type Col = { key: string; label: string; value: (p: Player) => number; text?: (p: Player) => string; rank?: boolean }
const avg = (h: number, ab: number) => (ab === 0 ? 0 : h / ab)
const era = (p: Player) => {
  const s = p.seasonStats?.pitching
  return s && s.outs > 0 ? (s.earnedRuns * 27) / s.outs : 99
}
const breaking = (p: Player) => p.pitching.pitches.reduce((a, x) => a + x.level, 0)

const COLUMNS: Record<'bat' | 'pit', Record<'a1' | 'a2' | 'st', Col[]>> = {
  bat: {
    a1: [
      { key: 'contact', label: 'ミート', value: (p) => p.batting.contact, rank: true },
      { key: 'power', label: 'パワー', value: (p) => p.batting.power, rank: true },
      { key: 'speed', label: '走力', value: (p) => p.running.speed, rank: true },
      { key: 'arm', label: '肩力', value: (p) => p.fielding.arm, rank: true },
      { key: 'range', label: '守備', value: (p) => p.fielding.range, rank: true },
    ],
    a2: [
      { key: 'eye', label: '選球', value: (p) => p.batting.eye, rank: true },
      { key: 'vsl', label: '対左', value: (p) => p.batting.vsLeft, rank: true },
      { key: 'steal', label: '盗塁', value: (p) => p.running.steal, rank: true },
      { key: 'catch', label: '捕球', value: (p) => p.fielding.catching, rank: true },
      { key: 'throw', label: '送球', value: (p) => p.fielding.throwing, rank: true },
    ],
    st: [
      { key: 'g', label: '試合', value: (p) => p.seasonStats?.batting.games ?? 0 },
      { key: 'avg', label: '打率', value: (p) => avg(p.seasonStats?.batting.hits ?? 0, p.seasonStats?.batting.atBats ?? 0), text: (p) => (p.seasonStats?.batting.atBats ? avg(p.seasonStats.batting.hits, p.seasonStats.batting.atBats).toFixed(3).replace(/^0/, '') : '-') },
      { key: 'hr', label: '本', value: (p) => p.seasonStats?.batting.homeRuns ?? 0 },
      { key: 'rbi', label: '点', value: (p) => p.seasonStats?.batting.rbi ?? 0 },
      { key: 'sb', label: '盗', value: (p) => p.seasonStats?.batting.steals ?? 0 },
    ],
  },
  pit: {
    a1: [
      { key: 'velo', label: '球速', value: (p) => p.pitching.velocity, text: (p) => `${p.pitching.velocity}`, rank: true },
      { key: 'ctl', label: '制球', value: (p) => p.pitching.control, rank: true },
      { key: 'sta', label: 'スタ', value: (p) => p.pitching.stamina, rank: true },
      { key: 'kire', label: 'キレ', value: (p) => p.pitching.kire, rank: true },
      { key: 'brk', label: '変化', value: (p) => breaking(p), text: (p) => `${breaking(p)}` },
    ],
    a2: [
      { key: 'vsl', label: '対左', value: (p) => p.pitching.vsLeft, rank: true },
      { key: 'quick', label: 'クイ', value: (p) => p.pitching.quick, rank: true },
      { key: 'pinch', label: 'ピンチ', value: (p) => p.pitching.pinch, rank: true },
      { key: 'stam', label: '体力', value: (p) => Math.round(p.condition.stamina), text: (p) => `${Math.round(p.condition.stamina)}` },
      { key: 'wk', label: '週球数', value: (p) => p.weeklyPitches, text: (p) => `${p.weeklyPitches}` },
    ],
    st: [
      { key: 'g', label: '登板', value: (p) => p.seasonStats?.pitching.games ?? 0 },
      { key: 'era', label: '防御率', value: (p) => -era(p), text: (p) => (era(p) >= 99 ? '-' : era(p).toFixed(2)) },
      { key: 'w', label: '勝', value: (p) => p.seasonStats?.pitching.wins ?? 0 },
      { key: 'l', label: '敗', value: (p) => p.seasonStats?.pitching.losses ?? 0 },
      { key: 'k', label: '振', value: (p) => p.seasonStats?.pitching.strikeouts ?? 0 },
    ],
  },
}
const cols = computed(() => (view.value === 'sk' ? [] : COLUMNS[kind.value][view.value]))

function skillsOf(p: Player) {
  return p.skills.map((id) => getSkill(id)).filter((x): x is NonNullable<typeof x> => !!x)
}

/** 球速のランクは km/h を評価値にしてから求める */
function rankFor(c: Col, p: Player): string {
  return c.key === 'velo' ? rankOf(velocityScore(p.pitching.velocity)) : rankOf(c.value(p))
}

const all = computed(() => game.ownPlayers().filter((p) => showRetired.value || !p.retired))
const retiredCount = computed(() => game.ownPlayers().filter((p) => p.retired).length)

const list = computed(() => {
  const f = filter.value
  let rows = all.value.filter((p) => (kind.value === 'pit' ? p.mainPosition === 'P' : p.mainPosition !== 'P'))
  if (f === 'OF') rows = rows.filter((p) => OUTFIELD.includes(p.mainPosition))
  else if (f.startsWith('g')) rows = rows.filter((p) => p.grade === Number(f.slice(1)))
  else if (f !== 'all') rows = rows.filter((p) => p.mainPosition === f)
  const byPos = (p: Player) => POSITIONS.indexOf(p.mainPosition)
  const s = sort.value
  if (s) {
    const col = cols.value.find((c) => c.key === s.key)
    if (col) return [...rows].sort((a, b) => (s.desc ? col.value(b) - col.value(a) : col.value(a) - col.value(b)))
  }
  if (view.value === 'sk') {
    const good = (p: Player) => skillsOf(p).filter((x) => x.good).length
    return [...rows].sort((a, b) => good(b) - good(a) || b.grade - a.grade)
  }
  return [...rows].sort((a, b) => b.grade - a.grade || byPos(a) - byPos(b))
})

function toggleSort(key: string): void {
  if (sort.value?.key === key) sort.value = sort.value.desc ? { key, desc: false } : null
  else sort.value = { key, desc: true }
}

function switchKind(k: 'bat' | 'pit'): void {
  kind.value = k
  filter.value = 'all'
  sort.value = null
}

const counts = computed(() => ({
  bat: all.value.filter((p) => p.mainPosition !== 'P').length,
  pit: all.value.filter((p) => p.mainPosition === 'P').length,
}))

const MENU_SHORT: Record<PracticeMenu, string> = { batting: '打撃', power: '長打', pitching: '投球', fitness: '体力', fielding: '守備', running: '走塁' }

async function setMenu(menu: PracticeMenu): Promise<void> {
  const p = menuFor.value
  if (!p) return
  p.practiceMenu = menu
  menuFor.value = null
  await game.commit()
  ui.showToast(`${p.surname}の練習を「${PRACTICE_NAME[menu]}」にしました`)
}

function openPlayer(id: string): void {
  // 詳細画面で前後の選手に移れるよう、いまの並びを覚えておく
  ui.playerNav = list.value.map((p) => p.id)
  ui.playerTab = null
  router.push({ name: 'player', params: { id } })
}

function posKind(p: Player): string {
  if (p.mainPosition === 'P') return 'p'
  if (p.mainPosition === 'C') return 'c'
  if (OUTFIELD.includes(p.mainPosition)) return 'of'
  return 'if'
}
</script>

<template>
  <div class="page pv">
    <div class="top">
      <div class="kind">
        <button :class="{ on: kind === 'bat' }" @click="switchKind('bat')">野手<small>{{ counts.bat }}</small></button>
        <button :class="{ on: kind === 'pit' }" @click="switchKind('pit')">投手<small>{{ counts.pit }}</small></button>
      </div>
      <label v-if="retiredCount > 0" class="ret">
        <input v-model="showRetired" type="checkbox" class="check" />引退も表示
      </label>
    </div>

    <div class="table">
      <div class="thead" :class="{ skv: view === 'sk' }">
        <span class="c-name">名前／年</span>
        <span class="c-pos">守</span>
        <button v-for="c in cols" :key="c.key" class="c-v" :class="{ sorted: sort?.key === c.key }" @click="toggleSort(c.key)">
          {{ c.label }}<i v-if="sort?.key === c.key">{{ sort.desc ? '▼' : '▲' }}</i>
        </button>
        <span v-if="view === 'sk'" class="c-sk">特殊能力</span>
        <span class="c-m">練習</span>
      </div>
      <div class="tbody">
        <div v-for="p in list" :key="p.id" class="tr" :class="{ off: p.retired, skv: view === 'sk' }" @click="openPlayer(p.id)">
          <span class="c-name">
            <b>{{ p.surname }}</b><small>{{ p.grade }}</small>
            <em v-if="p.condition.injury" class="tag bad">ケガ</em>
            <em v-else-if="p.helper" class="tag">助</em>
          </span>
          <span class="c-pos"><i :class="`k-${posKind(p)}`">{{ POSITION_LABEL[p.mainPosition] }}</i></span>
          <span v-for="c in cols" :key="c.key" class="c-v">
            <template v-if="c.rank"><b :class="`rk-${rankFor(c, p)}`">{{ rankFor(c, p) }}</b><small>{{ c.text ? c.text(p) : c.value(p) }}</small></template>
            <template v-else>{{ c.text ? c.text(p) : c.value(p) }}</template>
          </span>
          <span v-if="view === 'sk'" class="c-sk">
            <i v-for="sk in skillsOf(p)" :key="sk.id" :class="sk.good ? 'good' : 'bad'">{{ sk.name }}</i>
            <em v-if="p.skills.length === 0">なし</em>
          </span>
          <button class="c-m" :disabled="p.retired" @click.stop="menuFor = p">{{ MENU_SHORT[p.practiceMenu] }}</button>
        </div>
        <p v-if="list.length === 0" class="empty">該当する部員はいません</p>
      </div>
    </div>

    <div class="filters">
      <button v-for="f in filters" :key="f.key" :class="{ on: filter === f.key }" @click="filter = f.key">{{ f.label }}</button>
    </div>
    <div class="views">
      <button :class="{ on: view === 'a1' }" @click="view = 'a1'; sort = null">能力1</button>
      <button :class="{ on: view === 'a2' }" @click="view = 'a2'; sort = null">能力2</button>
      <button :class="{ on: view === 'st' }" @click="view = 'st'; sort = null">成績</button>
      <button :class="{ on: view === 'sk' }" @click="view = 'sk'; sort = null">特能</button>
    </div>

    <div v-if="menuFor" class="mb" @click.self="menuFor = null">
      <div class="mb-sheet card">
        <h2 class="grass"><GameIcon name="run" /> {{ menuFor.surname }}の練習メニュー</h2>
        <div class="mb-grid">
          <button v-for="(label, key) in PRACTICE_NAME" :key="key" :class="menuFor.practiceMenu === key ? 'sun' : 'secondary'" @click="setMenu(key)">{{ label }}</button>
        </div>
        <button class="secondary full" @click="menuFor = null">閉じる</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.pv {
  display: flex;
  flex-direction: column;
  gap: 6px;
  height: calc(100dvh - 112px - var(--tab-height) - var(--ad-height) - var(--safe-bottom) - env(safe-area-inset-top, 0px));
  min-height: 420px;
  padding-bottom: 0;
}
.top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.kind {
  display: flex;
  background: #e2ebf5;
  border-radius: 12px;
  padding: 3px;
}
.kind button {
  padding: 6px 18px;
  font-size: 14px;
  background: transparent;
  color: var(--ink-soft);
  box-shadow: none;
  text-shadow: none;
  border-radius: 9px;
}
.kind button small {
  margin-left: 4px;
  font-size: 11px;
}
.kind button.on {
  background: linear-gradient(180deg, #ffe65c, #ffd100);
  color: #2a2100;
  box-shadow: 0 2px 0 #c9a400;
}
.ret {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--ink-soft);
  font-weight: 700;
}
.table {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: #fff;
  border-radius: 12px;
  box-shadow: inset 0 0 0 1.5px #e2eef8, 0 2px 0 #d8e4f0;
  overflow: hidden;
}
.thead,
.tr {
  display: grid;
  grid-template-columns: 1.55fr 0.6fr repeat(5, 1fr) 0.95fr;
  align-items: center;
}
.thead.skv,
.tr.skv {
  grid-template-columns: 1.55fr 0.6fr 5fr 0.95fr;
}
.c-sk {
  display: flex;
  flex-wrap: wrap;
  gap: 3px;
  padding: 4px 2px;
  justify-content: flex-start;
}
.thead .c-sk {
  justify-content: center;
}
.c-sk i {
  font-style: normal;
  font-size: 10px;
  font-weight: 900;
  border-radius: 999px;
  padding: 1px 6px;
  white-space: nowrap;
}
.c-sk i.good {
  background: #fff1c2;
  color: #8a5a00;
  box-shadow: inset 0 0 0 1px #f2c94c;
}
.c-sk i.bad {
  background: #e6ebf2;
  color: #4f5b6b;
}
.c-sk em {
  font-style: normal;
  font-size: 11px;
  color: var(--ink-soft);
}
.thead {
  background: #5d6b80;
  color: #fff;
  font-size: 11px;
  font-weight: 900;
  text-align: center;
}
.thead > * {
  padding: 6px 0;
}
.thead button {
  background: transparent;
  color: #fff;
  box-shadow: none;
  text-shadow: none;
  border-radius: 0;
  font-size: 11px;
  padding: 6px 0;
  border-left: 1px solid rgba(255, 255, 255, 0.15);
}
.thead button.sorted {
  background: rgba(255, 255, 255, 0.18);
}
.thead i {
  font-style: normal;
  font-size: 8px;
  margin-left: 1px;
}
.tbody {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
}
.tr {
  border-bottom: 1px solid #edf2f7;
  min-height: 42px;
  cursor: pointer;
}
.tr:active {
  background: #f2f7fc;
}
.tr.off {
  opacity: 0.5;
}
.c-name {
  padding-left: 8px;
  display: flex;
  align-items: baseline;
  gap: 2px;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
}
.thead .c-name {
  padding-left: 0;
  justify-content: center;
}
.c-name b {
  font-size: 15px;
  font-weight: 900;
  overflow: hidden;
  text-overflow: ellipsis;
}
.c-name small {
  font-size: 11px;
  color: var(--ink-soft);
  font-weight: 800;
}
.tag {
  font-style: normal;
  font-size: 9px;
  font-weight: 900;
  background: #e6e9ee;
  border-radius: 4px;
  padding: 0 3px;
  margin-left: 2px;
  align-self: center;
}
.tag.bad {
  background: #ffe1e1;
  color: var(--red);
}
.c-pos {
  display: flex;
  justify-content: center;
}
.c-pos i {
  font-style: normal;
  width: 22px;
  height: 22px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 900;
  display: flex;
  align-items: center;
  justify-content: center;
}
.k-p {
  background: #fde2e2;
  color: #c62d33;
}
.k-c {
  background: #dce9ff;
  color: #2a5fc8;
}
.k-if {
  background: #ffe9c7;
  color: #b8620a;
}
.k-of {
  background: #d8f2dc;
  color: #22863a;
}
.tr .c-v {
  text-align: center;
  font-weight: 800;
  font-size: 13px;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.c-v b {
  font-size: 15px;
  font-weight: 900;
  font-style: italic;
  margin-right: 1px;
}
.c-v small {
  font-size: 11px;
  color: var(--ink);
}
.tr .c-m {
  margin: 0 4px;
  padding: 5px 0;
  font-size: 11px;
  border-radius: 8px;
  background: #fff;
  color: var(--ink);
  box-shadow: inset 0 0 0 1.5px #cdd9e6, 0 2px 0 #cdd9e6;
  text-shadow: none;
}
.empty {
  text-align: center;
  color: var(--ink-soft);
  font-size: 13px;
}
.filters {
  display: flex;
  background: #e2ebf5;
  border-radius: 14px;
  padding: 3px;
}
.filters button {
  flex: 1;
  padding: 7px 0;
  font-size: 13px;
  background: transparent;
  color: var(--ink-soft);
  box-shadow: none;
  text-shadow: none;
  border-radius: 11px;
}
.filters button.on {
  background: #6aa9ec;
  color: #fff;
}
.views {
  display: flex;
  gap: 0;
  border-bottom: 2px solid #e2ebf5;
}
.views button {
  flex: 1;
  background: transparent;
  color: var(--ink-soft);
  box-shadow: none;
  text-shadow: none;
  border-radius: 0;
  padding: 7px 0;
  font-size: 14px;
  border-bottom: 3px solid transparent;
  margin-bottom: -2px;
}
.views button.on {
  color: var(--ink);
  border-bottom-color: var(--orange);
}
.mb {
  position: fixed;
  inset: 0;
  background: rgba(10, 30, 60, 0.45);
  z-index: 60;
  display: flex;
  align-items: flex-end;
}
.mb-sheet {
  width: 100%;
  margin: 0;
  border-radius: 20px 20px 0 0;
  padding-bottom: calc(14px + var(--safe-bottom));
}
.mb-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin-bottom: 10px;
}
.mb-grid button {
  padding: 12px 4px;
}
</style>
