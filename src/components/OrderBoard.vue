<script setup lang="ts">
// オーダー編成：スタメン（打順と先発投手）・控え・ベンチ外を1画面に並べ、
// 2人をタップ（またはドラッグ）すると入れ替わる。野手も投手もここで決める
import { computed, ref, watch } from 'vue'
import { useGameStore } from '@/stores/game'
import { useUiStore } from '@/stores/ui'
import { APTITUDE_LABEL, POSITIONS, POSITION_LABEL, POSITION_NAME, rankOf, velocityScore } from '@/game/constants'
import { autoLineup, available, BENCH_SIZE, canPitch, lineupValid } from '@/game/match/lineup'
import { ownLineup } from '@/game/match/session'
import type { LineupConfig, Player, Position } from '@/game/types'
import { getSkill } from '@/game/skills'
import GameIcon from './GameIcon.vue'
import PlayerSheet from './PlayerSheet.vue'

const game = useGameStore()
const ui = useUiStore()

const players = computed(() => game.save?.players ?? {})
const members = computed(() => game.ownPlayers().filter((p) => !p.retired))
const draft = ref<LineupConfig | null>(null)
const selected = ref<string | null>(null)
const viewing = ref<string | null>(null)
const posPicker = ref(false)

const auto = computed(() => {
  void game.rev
  const s = game.save
  return !s?.lineup || !lineupValid(s.lineup, s.players)
})

function reset(): void {
  if (game.save) draft.value = structuredClone(ownLineup(game.save))
}
watch(() => game.rev, reset, { immediate: true })

// ---------------------------------------------------------------- 表示用の並び
type Cell = { key: string; id: string; pos: string; posKind: string; no?: number; disabled?: boolean; note?: string }

function posKind(pos: Position | 'DH'): string {
  if (pos === 'P') return 'p'
  if (pos === 'C') return 'c'
  if (pos === 'LF' || pos === 'CF' || pos === 'RF') return 'of'
  if (pos === 'DH') return 'dh'
  return 'if'
}
function posShort(pos: Position | 'DH'): string {
  return pos === 'DH' ? '指' : pos === 'LF' || pos === 'CF' || pos === 'RF' ? POSITION_LABEL[pos] : POSITION_LABEL[pos]
}
/** ベンチ・ベンチ外では本職のポジションを出す（外野はまとめて「外」） */
function mainShort(p: Player): string {
  return p.mainPosition === 'LF' || p.mainPosition === 'CF' || p.mainPosition === 'RF' ? '外' : POSITION_LABEL[p.mainPosition]
}

const starters = computed<(Cell & { pitcher: boolean })[]>(() => {
  const d = draft.value
  if (!d) return []
  const list = d.batters.map((b, i) => ({ key: `S${i}`, id: b.playerId, pos: posShort(b.position), posKind: posKind(b.position), no: i + 1, pitcher: b.position === 'P' }))
  if (d.useDH) list.push({ key: 'P', id: d.startingPitcherId, pos: '投', posKind: 'p', no: undefined as unknown as number, pitcher: true })
  return list
})
const bench = computed<Cell[]>(() => {
  const d = draft.value
  if (!d) return []
  return d.bench.map((id, i) => {
    const p = players.value[id]
    return { key: `B${i}`, id, pos: p ? mainShort(p) : '', posKind: p ? posKind(p.mainPosition) : '' }
  })
})
const outside = computed<Cell[]>(() => {
  const d = draft.value
  if (!d) return []
  const used = new Set([...d.batters.map((b) => b.playerId), d.startingPitcherId, ...d.bench])
  return members.value
    .filter((p) => !used.has(p.id))
    .sort((a, b) => POSITIONS.indexOf(a.mainPosition) - POSITIONS.indexOf(b.mainPosition) || b.grade - a.grade)
    .map((p) => ({
      key: `O${p.id}`,
      id: p.id,
      pos: mainShort(p),
      posKind: posKind(p.mainPosition),
      disabled: !available(p),
      note: p.condition.injury ? 'ケガ' : undefined,
    }))
})

const APT_ORDER: Position[] = ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF']
/** 守れる位置を適性の高い順に（×は出さない）。exclude は今ついている位置 */
function aptList(p: Player, exclude?: string): string {
  return APT_ORDER.filter((pos) => pos !== exclude && p.fielding.aptitude[pos] > 0)
    .sort((a, b) => p.fielding.aptitude[b] - p.fielding.aptitude[a])
    .map((pos) => `${POSITION_LABEL[pos]}${APTITUDE_LABEL[p.fielding.aptitude[pos]]}`)
    .join(' ')
}
/** スタメンの枠の守備位置（打順の枠なら Position か DH） */
function slotPos(key: string): string | undefined {
  const d = draft.value
  if (!d || key[0] !== 'S') return undefined
  return d.batters[Number(key.slice(1))]?.position
}

/** 名前の下に並べる5つのランク（野手：ミ・パ・走・肩・守／投手：球・コ・ス・キ・変） */
function ranks(p: Player, asPitcher = p.mainPosition === 'P'): string[] {
  if (asPitcher) {
    const breaking = p.pitching.pitches.reduce((a, x) => a + x.level, 0) * 7
    return [velocityScore(p.pitching.velocity), p.pitching.control, p.pitching.stamina, p.pitching.kire, Math.min(100, breaking)].map(rankOf)
  }
  return [p.batting.contact, p.batting.power, p.running.speed, p.fielding.arm, p.fielding.range].map(rankOf)
}

// ---------------------------------------------------------------- 入れ替え
function idAt(key: string): string | null {
  const d = draft.value
  if (!d) return null
  if (key === 'P') return d.startingPitcherId
  if (key[0] === 'S') return d.batters[Number(key.slice(1))]?.playerId ?? null
  if (key[0] === 'B') return d.bench[Number(key.slice(1))] ?? null
  if (key[0] === 'O') return key.slice(1)
  return null
}

function setAt(key: string, id: string): void {
  const d = draft.value!
  if (key === 'P') d.startingPitcherId = id
  else if (key[0] === 'S') {
    const slot = d.batters[Number(key.slice(1))]!
    slot.playerId = id
    if (slot.position === 'P') d.startingPitcherId = id
  } else if (key[0] === 'B') d.bench[Number(key.slice(1))] = id
}

function needsPitcher(key: string): boolean {
  const d = draft.value!
  if (key === 'P') return true
  if (key[0] === 'S') return d.batters[Number(key.slice(1))]?.position === 'P'
  return false
}

function swap(a: string, b: string): void {
  const d = draft.value
  if (!d || a === b) return
  const ia = idAt(a)
  const ib = idAt(b)
  if (!ia || !ib) return
  if (a[0] === 'O' && b[0] === 'O') return
  // スタメン同士は、守備位置ごと打順を入れ替える
  if (a[0] === 'S' && b[0] === 'S') {
    const x = Number(a.slice(1))
    const y = Number(b.slice(1))
    ;[d.batters[x], d.batters[y]] = [d.batters[y]!, d.batters[x]!]
    commit()
    return
  }
  const pa = players.value[ia]
  const pb = players.value[ib]
  if (!pa || !pb) return
  if ((needsPitcher(a) && !canPitch(pb)) || (needsPitcher(b) && !canPitch(pa))) {
    ui.showToast('先発投手には、投げられる選手を選んでください')
    return
  }
  if ((a[0] !== 'O' && !available(pb)) || (b[0] !== 'O' && !available(pa))) {
    ui.showToast('ケガをしている選手は入れられません')
    return
  }
  // DHなしで、先発投手がスタメンの投手の打順以外にもいる、という状態は作らない
  if (a[0] !== 'O') setAt(a, ib)
  if (b[0] !== 'O') setAt(b, ia)
  commit()
}

/** タップは選ぶだけ（上部に能力を出し、守備位置の変更に使う）。入れ替えはドラッグで行う */
function tap(cell: Cell): void {
  if (cell.disabled) {
    viewing.value = cell.id
    return
  }
  selected.value = selected.value === cell.key ? null : cell.key
}

/** 守備位置の変更：選んだスタメンの守備位置を、別の位置の選手と入れ替える */
const selectedSlot = computed(() => (selected.value && selected.value[0] === 'S' ? Number(selected.value.slice(1)) : -1))
function setPosition(pos: Position | 'DH'): void {
  const d = draft.value
  const i = selectedSlot.value
  if (!d || i < 0) return
  const cur = d.batters[i]!
  if (cur.position === 'P' || pos === 'P') return
  const other = d.batters.find((b) => b.position === pos)
  if (other) other.position = cur.position
  cur.position = pos
  posPicker.value = false
  commit()
}
const selectedPlayer = computed(() => (selected.value ? (players.value[idAt(selected.value) ?? ''] ?? null) : null))

/** 守備練習（コンバート）：適性を上げたい守備位置を決める */
async function setConvert(pos: Position | null): Promise<void> {
  const p = selectedPlayer.value
  if (!p) return
  p.convertTo = pos
  await game.commit()
  ui.showToast(pos ? `${p.surname}が${POSITION_NAME[pos]}の守備練習を始めました` : `${p.surname}の守備練習をやめました`)
}

const posChoices = computed<(Position | 'DH')[]>(() => {
  const list: (Position | 'DH')[] = ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF']
  if (draft.value?.useDH) list.push('DH')
  return list
})

// ---------------------------------------------------------------- ドラッグで入れ替え
const drag = ref<{ key: string; id: string; x: number; y: number; sx: number; sy: number; on: boolean; pid: number } | null>(null)
const dropKey = ref<string | null>(null)
let suppressClick = false

function onDown(e: PointerEvent, cell: Cell): void {
  if (cell.disabled) return
  drag.value = { key: cell.key, id: cell.id, x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, on: false, pid: e.pointerId }
}
function onMove(e: PointerEvent): void {
  const d = drag.value
  if (!d || e.pointerId !== d.pid) return
  d.x = e.clientX
  d.y = e.clientY
  if (!d.on && Math.hypot(d.x - d.sx, d.y - d.sy) > 10) {
    d.on = true
    selected.value = d.key
    navigator.vibrate?.(10)
  }
  if (d.on) {
    const el = document.elementFromPoint(d.x, d.y)?.closest('[data-key]') as HTMLElement | null
    dropKey.value = el?.dataset.key ?? null
  }
}
function onUp(): void {
  const d = drag.value
  drag.value = null
  if (d?.on) {
    suppressClick = true
    setTimeout(() => (suppressClick = false), 50)
    if (dropKey.value && dropKey.value !== d.key) swap(d.key, dropKey.value)
    selected.value = dropKey.value ?? d.key
  }
  dropKey.value = null
}
function onClick(cell: Cell): void {
  if (suppressClick) return
  tap(cell)
}

// ---------------------------------------------------------------- 確認と保存
const problems = computed(() => {
  const d = draft.value
  if (!d) return []
  const msgs: string[] = []
  const positions = d.batters.map((b) => b.position)
  const needed: (Position | 'DH')[] = ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', d.useDH ? 'DH' : 'P']
  for (const pos of needed) {
    if (!positions.includes(pos)) msgs.push(`${pos === 'DH' ? '指名打者' : POSITION_NAME[pos as Position]}がいません`)
  }
  for (const b of d.batters) {
    const p = players.value[b.playerId]
    if (p && !available(p)) msgs.push(`${p.surname}はケガで出られません`)
  }
  return msgs
})

async function commit(): Promise<void> {
  const d = draft.value
  if (!d || problems.value.length > 0) return
  await game.saveLineup(JSON.parse(JSON.stringify(d)) as LineupConfig)
}

async function autoBuild(): Promise<void> {
  if (!game.save || !draft.value) return
  draft.value = autoLineup(members.value, draft.value.useDH)
  selected.value = null
  await commit()
  ui.showToast('自動でオーダーを組みました')
}

async function toggleDH(): Promise<void> {
  if (!draft.value) return
  draft.value = autoLineup(members.value, !draft.value.useDH)
  selected.value = null
  await commit()
}

async function setAuto(): Promise<void> {
  await game.saveLineup(null)
  selected.value = null
  ui.showToast('毎試合、調子やケガを見て自動で組みます')
}

// ---------------------------------------------------------------- 上部の選手情報
const focus = computed(() => {
  const id = selected.value ? idAt(selected.value) : (draft.value?.batters[0]?.playerId ?? null)
  return id ? (players.value[id] ?? null) : null
})
const focusPos = computed(() => {
  const d = draft.value
  const p = focus.value
  if (!d || !p) return ''
  const slot = d.batters.find((b) => b.playerId === p.id)
  if (slot) return slot.position === 'DH' ? '指名打者' : POSITION_NAME[slot.position]
  if (d.startingPitcherId === p.id) return '先発投手'
  return d.bench.includes(p.id) ? `控え（${POSITION_NAME[p.mainPosition]}）` : `ベンチ外（${POSITION_NAME[p.mainPosition]}）`
})
const focusStats = computed(() => {
  const p = focus.value
  if (!p) return ''
  const s = p.seasonStats
  if (focusAsPitcher.value) {
    const pt = s?.pitching
    const era = pt && pt.outs > 0 ? ((pt.earnedRuns * 27) / pt.outs).toFixed(2) : '-.--'
    return `防${era} / ${pt?.wins ?? 0}勝${pt?.losses ?? 0}敗 / ${pt?.strikeouts ?? 0}振`
  }
  const b = s?.batting
  const avg = b && b.atBats > 0 ? (b.hits / b.atBats).toFixed(3).replace(/^0/, '') : '.000'
  return `${avg} / ${b?.homeRuns ?? 0}本 / ${b?.rbi ?? 0}点 / ${b?.steals ?? 0}盗`
})
/** 上部に投手の能力を出すか（先発投手・投手の打順、またはスタメン外の本職投手） */
const focusAsPitcher = computed(() => {
  const d = draft.value
  const p = focus.value
  if (!d || !p) return false
  const slot = d.batters.find((b) => b.playerId === p.id)
  if (slot) return slot.position === 'P'
  if (d.startingPitcherId === p.id) return true
  return p.mainPosition === 'P'
})
const focusAbilities = computed(() => {
  const p = focus.value
  if (!p) return []
  if (focusAsPitcher.value) {
    const breaking = p.pitching.pitches.reduce((a, x) => a + x.level, 0)
    return [
      { label: '球速', rank: rankOf(velocityScore(p.pitching.velocity)), value: `${p.pitching.velocity}` },
      { label: '制球', rank: rankOf(p.pitching.control), value: `${p.pitching.control}` },
      { label: 'スタ', rank: rankOf(p.pitching.stamina), value: `${p.pitching.stamina}` },
      { label: 'キレ', rank: rankOf(p.pitching.kire), value: `${p.pitching.kire}` },
      { label: '変化', rank: rankOf(Math.min(100, breaking * 7)), value: `${breaking}` },
    ]
  }
  return [
    { label: 'ミート', rank: rankOf(p.batting.contact), value: `${p.batting.contact}` },
    { label: 'パワー', rank: rankOf(p.batting.power), value: `${p.batting.power}` },
    { label: '走力', rank: rankOf(p.running.speed), value: `${p.running.speed}` },
    { label: '肩力', rank: rankOf(p.fielding.arm), value: `${p.fielding.arm}` },
    { label: '守備', rank: rankOf(p.fielding.range), value: `${p.fielding.range}` },
  ]
})
const focusApt = computed(() => {
  const d = draft.value
  const p = focus.value
  if (!d || !p) return ''
  const slot = d.batters.find((b) => b.playerId === p.id)
  if (!slot || slot.position === 'DH' || slot.position === 'P') return ''
  return APTITUDE_LABEL[p.fielding.aptitude[slot.position]] ?? ''
})
const FORM_ICON = ['', '⬇', '↘', '➡', '↗', '⬆']
const focusSkills = computed(() =>
  (focus.value?.skills ?? []).map((id) => getSkill(id)).filter((x): x is NonNullable<typeof x> => !!x),
)
</script>

<template>
  <div v-if="draft" class="ob" @pointermove="onMove" @pointerup="onUp" @pointercancel="onUp">
    <!-- 上：選んだ選手 -->
    <div v-if="focus" class="focus">
      <div class="f-top">
        <span class="f-name">{{ focus.surname }}<small>{{ focus.grade }}年</small></span>
        <span class="f-pos" :class="`k-${posKind(focus.mainPosition)}`">{{ focusPos }}<b v-if="focusApt">適性{{ focusApt }}</b></span>
        <span class="f-stats">{{ focusStats }}</span>
      </div>
      <div class="f-ab">
        <div v-for="a in focusAbilities" :key="a.label">
          <small>{{ a.label }}</small>
          <b :class="`rk-${a.rank}`">{{ a.rank }}<i>{{ a.value }}</i></b>
        </div>
        <div class="cond">
          <small>体力・調子</small>
          <b>{{ Math.round(focus.condition.stamina) }}<i>{{ FORM_ICON[focus.condition.form] }}</i></b>
        </div>
      </div>
      <div class="f-sk">
        <span v-for="sk in focusSkills" :key="sk.id" class="sk" :class="sk.good ? 'good' : 'bad'">{{ sk.name }}</span>
        <span v-if="focusSkills.length === 0" class="sk none">特殊能力なし</span>
        <span v-if="focus.convertTo" class="sk conv">{{ POSITION_NAME[focus.convertTo] }}の守備練習中</span>
      </div>
    </div>

    <!-- 中：3列 -->
    <div class="cols">
      <div class="col">
        <div class="col-h">スタメン</div>
        <div class="col-body">
          <div
            v-for="c in starters"
            :key="c.key"
            :data-key="c.key"
            class="cell"
            :class="{ sel: selected === c.key, drop: dropKey === c.key }"
            @pointerdown="onDown($event, c)"
            @click="onClick(c)"
          >
            <span class="no">{{ c.no ?? '' }}</span>
            <span class="pos" :class="`k-${c.posKind}`">{{ c.pos }}</span>
            <span class="body">
              <span class="nm">{{ players[c.id]?.surname }}<small>{{ players[c.id]?.bats === 'L' ? 'L' : players[c.id]?.bats === 'S' ? 'S' : 'R' }}</small></span>
              <span class="sub"><span class="rs"><i v-for="(r, k) in ranks(players[c.id]!, c.pitcher)" :key="k" :class="`rk-${r}`">{{ r }}</i></span>
              <span v-if="!c.pitcher" class="apt">{{ aptList(players[c.id]!, slotPos(c.key)) }}</span></span>
            </span>
          </div>
        </div>
      </div>
      <div class="col">
        <div class="col-h">控え<small>{{ bench.length }}/{{ BENCH_SIZE }}</small></div>
        <div class="col-body">
          <div
            v-for="c in bench"
            :key="c.key"
            :data-key="c.key"
            class="cell"
            :class="{ sel: selected === c.key, drop: dropKey === c.key }"
            @pointerdown="onDown($event, c)"
            @click="onClick(c)"
          >
            <span class="pos" :class="`k-${c.posKind}`">{{ c.pos }}</span>
            <span class="body">
              <span class="nm">{{ players[c.id]?.surname }}<small>{{ players[c.id]?.grade }}年</small></span>
              <span class="sub"><span class="rs"><i v-for="(r, k) in ranks(players[c.id]!)" :key="k" :class="`rk-${r}`">{{ r }}</i></span>
              <span v-if="players[c.id]!.mainPosition !== 'P'" class="apt">{{ aptList(players[c.id]!) }}</span></span>
            </span>
          </div>
        </div>
      </div>
      <div class="col">
        <div class="col-h">ベンチ外</div>
        <div class="col-body scroll">
          <div
            v-for="c in outside"
            :key="c.key"
            :data-key="c.key"
            class="cell"
            :class="{ sel: selected === c.key, drop: dropKey === c.key, off: c.disabled }"
            @pointerdown="onDown($event, c)"
            @click="onClick(c)"
          >
            <span class="pos" :class="`k-${c.posKind}`">{{ c.pos }}</span>
            <span class="body">
              <span class="nm">{{ players[c.id]?.surname }}<small>{{ c.note ?? `${players[c.id]?.grade}年` }}</small></span>
              <span class="sub"><span class="rs"><i v-for="(r, k) in ranks(players[c.id]!)" :key="k" :class="`rk-${r}`">{{ r }}</i></span>
              <span v-if="players[c.id]!.mainPosition !== 'P'" class="apt">{{ aptList(players[c.id]!) }}</span></span>
            </span>
          </div>
          <p v-if="outside.length === 0" class="empty">なし</p>
        </div>
      </div>
    </div>

    <p v-if="problems.length" class="problems">{{ problems.join('・') }}</p>
    <p v-else class="hint">選手をつまんで、入れ替える相手の上に動かす<span v-if="auto" class="auto">おまかせ中</span></p>

    <!-- 下：操作 -->
    <div class="ops">
      <button class="op cyan" :disabled="!focus" @click="viewing = focus?.id ?? null">選手詳細</button>
      <button class="op orange" @click="autoBuild">自動編成</button>
      <button class="op navy" :disabled="!selectedPlayer" @click="posPicker = true">守備位置</button>
      <button class="op gray" @click="toggleDH">DH{{ draft.useDH ? 'あり' : 'なし' }}</button>
      <button class="op" :class="auto ? 'on' : 'gray'" @click="setAuto">おまかせ</button>
    </div>

    <div v-if="drag?.on" class="ghost" :style="{ left: `${drag.x}px`, top: `${drag.y}px` }">{{ players[drag.id]?.surname }}</div>

    <div v-if="posPicker && selectedPlayer" class="pp-backdrop" @click.self="posPicker = false">
      <div class="pp card">
        <template v-if="selectedSlot >= 0 && draft.batters[selectedSlot]!.position !== 'P'">
          <h2><GameIcon name="glove" /> {{ selectedPlayer.surname }}の守備位置</h2>
          <div class="pp-grid">
            <button
              v-for="pos in posChoices"
              :key="pos"
              :class="draft.batters[selectedSlot]!.position === pos ? 'sun' : 'secondary'"
              @click="setPosition(pos)"
            >
              {{ pos === 'DH' ? '指名打者' : POSITION_NAME[pos] }}
              <small v-if="pos !== 'DH'">{{ APTITUDE_LABEL[selectedPlayer.fielding.aptitude[pos]] }}</small>
            </button>
          </div>
          <p class="muted">その位置を守っていた選手と、守備位置を入れ替えます。</p>
        </template>
        <h2 class="grass"><GameIcon name="run" /> 守備練習（適性を上げる）</h2>
        <p class="muted">選んだ位置の適性が、毎週の練習で少しずつ上がります（×→△→○→◎）。守備や実戦のマスで伸びやすくなります。</p>
        <div class="pp-grid">
          <button
            v-for="pos in APT_ORDER"
            :key="pos"
            :class="selectedPlayer.convertTo === pos ? 'sky' : 'secondary'"
            :disabled="selectedPlayer.fielding.aptitude[pos] >= 3"
            @click="setConvert(selectedPlayer.convertTo === pos ? null : pos)"
          >
            {{ POSITION_NAME[pos] }}
            <small>{{ APTITUDE_LABEL[selectedPlayer.fielding.aptitude[pos]] }}{{ selectedPlayer.convertTo === pos ? '・練習中' : '' }}</small>
          </button>
        </div>
        <button class="secondary full" @click="posPicker = false">閉じる</button>
      </div>
    </div>
    <PlayerSheet v-if="viewing" :player-id="viewing" @close="viewing = null" />
  </div>
</template>

<style scoped>
.ob {
  display: flex;
  flex-direction: column;
  gap: 6px;
  height: calc(100dvh - 160px - var(--tab-height) - var(--ad-height) - var(--safe-bottom) - env(safe-area-inset-top, 0px));
  min-height: 330px;
  touch-action: pan-y;
}
.focus {
  background: #fff;
  border-radius: 14px;
  padding: 6px 10px 8px;
  box-shadow: 0 2px 0 #d8e4f0, inset 0 0 0 1.5px #e2eef8;
}
.f-top {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}
.f-name {
  font-weight: 900;
  font-size: 17px;
  white-space: nowrap;
}
.f-name small {
  font-size: 11px;
  color: var(--ink-soft);
  margin-left: 3px;
}
.f-pos {
  font-size: 11px;
  font-weight: 900;
  color: #fff;
  border-radius: 6px;
  padding: 1px 6px;
  white-space: nowrap;
}
.f-pos b {
  margin-left: 4px;
  background: rgba(255, 255, 255, 0.3);
  border-radius: 4px;
  padding: 0 3px;
}
.f-stats {
  margin-left: auto;
  font-size: 11px;
  font-weight: 800;
  color: var(--ink-soft);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.f-ab {
  display: grid;
  grid-template-columns: repeat(5, 1fr) 1.2fr;
  margin-top: 4px;
  background: #f2f6fb;
  border-radius: 8px;
}
.f-ab div {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 2px 0;
}
.f-ab small {
  font-size: 10px;
  font-weight: 800;
  color: var(--ink-soft);
}
.f-ab b {
  font-size: 18px;
  font-weight: 900;
  font-style: italic;
  line-height: 1.1;
}
.f-ab b i {
  font-style: normal;
  font-size: 12px;
  margin-left: 1px;
}
.f-sk {
  display: flex;
  flex-wrap: nowrap;
  gap: 4px;
  margin-top: 4px;
  overflow-x: auto;
  scrollbar-width: none;
}
.sk {
  flex-shrink: 0;
  font-size: 10px;
  font-weight: 900;
  border-radius: 999px;
  padding: 1px 8px;
  white-space: nowrap;
}
.sk.good {
  background: #fff1c2;
  color: #8a5a00;
  box-shadow: inset 0 0 0 1px #f2c94c;
}
.sk.bad {
  background: #e6ebf2;
  color: #4f5b6b;
}
.sk.conv {
  background: #dff0ff;
  color: #1f6fb5;
}
.sk.none {
  color: var(--ink-soft);
  font-weight: 700;
}
.cond b {
  color: var(--ink);
}
.cols {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 1.35fr 1fr 0.8fr;
  gap: 5px;
}
.col {
  display: flex;
  flex-direction: column;
  min-height: 0;
  background: #fff;
  border-radius: 12px;
  box-shadow: inset 0 0 0 1.5px #e2eef8;
  overflow: hidden;
}
.col-h {
  background: #5d6b80;
  color: #fff;
  font-weight: 900;
  font-size: 12px;
  text-align: center;
  padding: 3px 0;
}
.col-h small {
  font-size: 10px;
  margin-left: 4px;
  opacity: 0.85;
}
.col-body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.col-body.scroll {
  overflow-y: auto;
}
.cell {
  display: flex;
  align-items: center;
  gap: 3px;
  padding: 2px 3px;
  border-bottom: 1px solid #eef3f8;
  min-height: 0;
  flex: 1 1 0;
  max-height: 46px;
  cursor: pointer;
  user-select: none;
  touch-action: none;
}
.col-body.scroll .cell {
  flex: 0 0 auto;
  height: 42px;
}
.cell.sel {
  background: #fff1c2;
  box-shadow: inset 0 0 0 2px #f2a516;
}
.cell.drop {
  background: #dff0ff;
  box-shadow: inset 0 0 0 2px #3aa8f0;
}
.cell.off {
  opacity: 0.45;
}
.no {
  width: 12px;
  font-size: 12px;
  font-weight: 900;
  color: var(--navy);
  text-align: center;
  flex-shrink: 0;
}
.pos {
  width: 20px;
  height: 20px;
  border-radius: 5px;
  font-size: 11px;
  font-weight: 900;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
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
.k-dh {
  background: #e6e9ee;
  color: #4f5b6b;
}
.f-pos.k-p {
  background: #e5484d;
  color: #fff;
}
.f-pos.k-c {
  background: #2f6fe0;
  color: #fff;
}
.f-pos.k-if {
  background: #f08a1c;
  color: #fff;
}
.f-pos.k-of {
  background: #2fa84a;
  color: #fff;
}
.body {
  display: flex;
  flex-direction: column;
  min-width: 0;
  line-height: 1.15;
}
.nm {
  font-weight: 900;
  font-size: 13px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.nm small {
  font-size: 9px;
  color: var(--ink-soft);
  margin-left: 2px;
  font-weight: 700;
}
.rs {
  font-size: 10px;
  font-weight: 900;
  letter-spacing: 0;
}
.rs i {
  font-style: normal;
}
.sub {
  display: flex;
  align-items: baseline;
  gap: 3px;
  min-width: 0;
  white-space: nowrap;
}
.rs {
  flex-shrink: 0;
}
.apt {
  min-width: 0;
  font-size: 9px;
  font-weight: 800;
  color: #6b7a90;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.empty {
  text-align: center;
  font-size: 12px;
  color: var(--ink-soft);
}
.problems {
  margin: 0;
  font-size: 12px;
  font-weight: 800;
  color: var(--red);
  text-align: center;
}
.hint {
  margin: 0;
  font-size: 11px;
  color: var(--ink-soft);
  text-align: center;
}
.auto {
  margin-left: 6px;
  background: #fff1c2;
  color: #8a5a00;
  border-radius: 999px;
  padding: 0 8px;
  font-weight: 900;
}
.ops {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 5px;
}
.op {
  padding: 10px 0;
  font-size: 12px;
  border-radius: 10px;
  color: #fff;
  text-shadow: none;
  white-space: nowrap;
}
.op.cyan {
  background: linear-gradient(180deg, #2fd3ec, #12b0cf);
  box-shadow: 0 3px 0 #0b8aa3;
}
.op.orange {
  background: linear-gradient(180deg, #f6b25a, #e8902a);
  box-shadow: 0 3px 0 #b86a12;
}
.op.navy {
  background: linear-gradient(180deg, #56667e, #3e4c62);
  box-shadow: 0 3px 0 #27313f;
}
.op.gray {
  background: linear-gradient(180deg, #c4cfdc, #a6b3c4);
  box-shadow: 0 3px 0 #7f8c9d;
}
.op.on {
  background: linear-gradient(180deg, #ffd96b, #f4ad1d);
  color: #3a2600;
  box-shadow: 0 3px 0 #a86a00;
}
.ghost {
  position: fixed;
  z-index: 80;
  transform: translate(-50%, -130%);
  background: var(--navy);
  color: #fff;
  font-weight: 900;
  font-size: 14px;
  padding: 4px 12px;
  border-radius: 999px;
  pointer-events: none;
  box-shadow: 0 6px 14px rgba(0, 0, 0, 0.3);
}
/* 縦に短い画面：能力の行を省き、名前とランクを1行にまとめる */
@media (max-height: 720px) {
  .f-ab {
    display: none;
  }
  .cell .body {
    flex-direction: row;
    align-items: baseline;
    gap: 3px;
  }
  .nm {
    font-size: 12px;
  }
  .rs {
    display: none;
  }
  .sub {
    min-width: 0;
    overflow: hidden;
  }
  .op {
    padding: 8px 0;
  }
}
.pp-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(10, 30, 60, 0.45);
  z-index: 60;
  display: flex;
  align-items: flex-end;
}
.pp {
  max-height: 86vh;
  overflow-y: auto;
  width: 100%;
  margin: 0;
  border-radius: 20px 20px 0 0;
  padding-bottom: calc(14px + var(--safe-bottom));
}
.pp-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
}
.pp-grid button {
  padding: 10px 4px;
  font-size: 13px;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.pp-grid small {
  font-size: 11px;
}
</style>
