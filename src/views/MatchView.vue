<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useGameStore } from '@/stores/game'
import { useUiStore } from '@/stores/ui'
import { POSITION_LABEL, velocityScore } from '@/game/constants'
import { battingTeam, currentBatterId, fieldingTeam, score, situation } from '@/game/match/engine'
import { canPitch } from '@/game/match/lineup'
import type { BattingOrder, DefenseShift, FieldPos, PitchPlan, PitchingOrder, TeamState } from '@/game/match/types'
import type { Player } from '@/game/types'
import FieldView from '@/components/match/FieldView.vue'
import CutIn from '@/components/match/CutIn.vue'
import FaceIcon from '@/components/FaceIcon.vue'
import RankBadge from '@/components/RankBadge.vue'
import GameIcon from '@/components/GameIcon.vue'

const game = useGameStore()
const ui = useUiStore()
const router = useRouter()

const m = computed(() => {
  void game.matchRev
  return game.match
})
const players = computed(() => game.save?.players ?? {})
const ownId = computed(() => game.save?.playerSchoolId ?? '')
const ownTeam = computed<TeamState | null>(() => (m.value ? (m.value.home.schoolId === ownId.value ? m.value.home : m.value.away) : null))
const ownBatting = computed(() => !!m.value && battingTeam(m.value).schoolId === ownId.value)
const sc = computed(() => (m.value ? score(m.value) : [0, 0]))
const batter = computed<Player | null>(() => (m.value && !m.value.finished ? players.value[currentBatterId(m.value)] ?? null : null))
const pitcher = computed<Player | null>(() => (m.value ? players.value[fieldingTeam(m.value).pitcherId] ?? null : null))
const pitchBox = computed(() => (m.value && pitcher.value ? m.value.pitching[pitcher.value.id] : null))
const batBox = computed(() => (m.value && batter.value ? m.value.batting[batter.value.id] : null))
const lastEvent = computed(() => (m.value ? m.value.events[m.value.events.length - 1] ?? null : null))
const recent = computed(() => (m.value ? [...m.value.events].reverse().slice(0, 12) : []))
const inningsShown = computed(() => (m.value ? Math.max(m.value.options.innings, m.value.away.runsByInning.length, m.value.home.runsByInning.length) : 9))
const batterSlot = computed(() => {
  if (!m.value || !batter.value) return null
  const t = battingTeam(m.value)
  return { order: t.battingIndex + 1, pos: t.lineup[t.battingIndex]!.position }
})

function posLabel(pos: FieldPos): string {
  return pos === 'DH' ? '指' : POSITION_LABEL[pos]
}

function todayLine(b: { ab: number; h: number; hr: number; rbi: number; bb: number } | undefined): string {
  if (!b || b.ab + b.bb === 0) return '本日初打席'
  const extra = [b.hr ? `${b.hr}本塁打` : '', b.rbi ? `${b.rbi}打点` : '', b.bb ? `${b.bb}四死球` : ''].filter(Boolean).join(' ')
  return `${b.ab}打数${b.h}安打 ${extra}`.trim()
}

// ---- 作戦 ----
const BAT_ORDERS: { value: BattingOrder; label: string }[] = [
  { value: 'auto', label: 'おまかせ' },
  { value: 'swing', label: '強振' },
  { value: 'contact', label: 'ミート' },
  { value: 'wait', label: '待て' },
  { value: 'bunt', label: 'バント' },
  { value: 'hitrun', label: 'エンドラン' },
  { value: 'steal', label: '盗塁' },
]
const PITCH_ORDERS: { value: PitchingOrder; label: string }[] = [
  { value: 'auto', label: 'おまかせ' },
  { value: 'fullpower', label: '全力投球' },
  { value: 'walk', label: '敬遠' },
]
const PLANS: { value: PitchPlan; label: string }[] = [
  { value: 'auto', label: 'おまかせ' },
  { value: 'inside', label: '内角' },
  { value: 'outside', label: '外角' },
  { value: 'low', label: '低め' },
  { value: 'breaking', label: '変化球' },
]
const SHIFTS: { value: DefenseShift; label: string }[] = [
  { value: 'normal', label: '通常守備' },
  { value: 'infieldIn', label: '前進守備' },
]

const newPA = computed(() => !!m.value && m.value.count.balls === 0 && m.value.count.strikes === 0)

function orderDisabled(o: BattingOrder): boolean {
  const s = m.value
  if (!s) return true
  if (o === 'steal') return !((s.bases[0] && !s.bases[1]) || (s.bases[1] && !s.bases[2]))
  if (o === 'hitrun') return !s.bases[0]
  return false
}

// ---- 進行 ----
const auto = ref(false)
let timer: ReturnType<typeof setTimeout> | undefined

async function step(kind: 'pitch' | 'pa' | 'inning' | 'end'): Promise<void> {
  if (busyStep.value || !m.value || m.value.finished) return
  busyStep.value = true
  try {
    await game.stepMatch(kind)
  } finally {
    busyStep.value = false
  }
  checkCutin()
}
const busyStep = ref(false)

function scheduleAuto(): void {
  clearTimeout(timer)
  if (!auto.value || !m.value || m.value.finished || cutin.value) return
  const delay = [0, 1800, 1200, 700][game.save?.settings.gameSpeed ?? 2] ?? 1200
  timer = setTimeout(async () => {
    await step('pa')
    scheduleAuto()
  }, delay)
}

watch(auto, (on) => (on ? scheduleAuto() : clearTimeout(timer)))
onBeforeUnmount(() => clearTimeout(timer))

// ---- カットイン ----
const cutin = ref<{ kind: 'chance' | 'pinch'; player: Player; sub: string } | null>(null)
let lastCutinKey = ''

function checkCutin(): void {
  const s = m.value
  if (!s || s.finished || !newPA.value || !game.save?.settings.cutin || s.cutins >= 4) return
  const sit = situation(s)
  if (sit === 'normal') return
  const key = `${s.inning}${s.top}${battingTeam(s).battingIndex}`
  if (key === lastCutinKey) return
  lastCutinKey = key
  s.cutins += 1
  const p = sit === 'chance' ? batter.value : pitcher.value
  if (!p) return
  const outs = ['ノーアウト', 'ワンアウト', 'ツーアウト'][s.outs]
  const runners = s.bases.every((b) => b) ? '満塁' : s.bases[2] ? '三塁に走者' : s.bases[1] ? '得点圏に走者' : '走者あり'
  cutin.value = { kind: sit, player: p, sub: `${s.inning}回${s.top ? '表' : '裏'} ${outs}${runners}` }
}

function closeCutin(): void {
  cutin.value = null
  // チャンス・ピンチでは、自動進行を止めて作戦を選べるようにする
  auto.value = false
}

// ---- 選手交代 ----
const sheet = ref<'pitcher' | 'sub' | null>(null)
const subTarget = ref<string | null>(null)

const benchPitchers = computed(() => {
  const t = ownTeam.value
  if (!t) return []
  return t.bench.map((id) => players.value[id]).filter((p): p is Player => !!p && canPitch(p) && !t.used.includes(p.id))
})
const benchAll = computed(() => {
  const t = ownTeam.value
  if (!t) return []
  return t.bench.map((id) => players.value[id]).filter((p): p is Player => !!p)
})

async function pickPitcher(id: string): Promise<void> {
  await game.changeOwnPitcher(id)
  sheet.value = null
  ui.showToast('投手を交代しました')
}

async function pickSub(inId: string): Promise<void> {
  if (!subTarget.value) return
  await game.substituteOwn(subTarget.value, inId)
  sheet.value = null
  subTarget.value = null
  ui.showToast('選手を交代しました')
}

// ---- 試合終了 ----
const resultText = computed(() => {
  const s = m.value
  if (!s?.finished) return null
  const ownHome = s.home.schoolId === ownId.value
  const [a, h] = sc.value
  const own = ownHome ? h : a
  const opp = ownHome ? a : h
  if (s.winner === null) return { title: '引き分け', own, opp, cls: 'draw' }
  const won = (s.winner === 'home') === ownHome
  return { title: won ? '勝利！' : '敗戦…', own, opp, cls: won ? 'win' : 'lose' }
})

async function finish(): Promise<void> {
  const r = await game.endMatch()
  if (!r) return
  await router.replace({ name: 'home' })
  if (r.finish.messages.length > 0) await ui.alert(r.finish.messages.join('\n'), '試合を終えて')
}

function back(): void {
  auto.value = false
  router.replace({ name: 'home' })
  ui.showToast('試合は保存されています。ホームから続きを再開できます')
}

if (!game.match) router.replace({ name: 'home' })
</script>

<template>
  <div v-if="m" class="match">
    <!-- スコアボード -->
    <div class="board">
      <div class="board-top">
        <button class="plain back" @click="back"><GameIcon name="back" :size="16" /> 中断</button>
        <span class="label">{{ m.options.label }}</span>
      </div>
      <div class="table-wrap">
        <table class="score">
          <thead>
            <tr>
              <th class="team" />
              <th v-for="i in inningsShown" :key="i" :class="{ now: i === m.inning }">{{ i }}</th>
              <th class="r">R</th>
              <th>H</th>
              <th>E</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(t, idx) in [m.away, m.home]" :key="t.schoolId" :class="{ own: t.schoolId === ownId }">
              <td class="team">{{ t.name }}</td>
              <td v-for="i in inningsShown" :key="i" :class="{ now: i === m.inning && m.top === (idx === 0) }">
                {{ t.runsByInning[i - 1] ?? '' }}
              </td>
              <td class="r">{{ sc[idx] }}</td>
              <td>{{ t.hits }}</td>
              <td>{{ t.errors }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="sit">
        <div class="inning">{{ m.inning }}<small>回{{ m.top ? '表' : '裏' }}</small></div>
        <div class="bso">
          <div><b>B</b><i v-for="n in 3" :key="n" :class="{ on: n <= m.count.balls, b: true }" /></div>
          <div><b>S</b><i v-for="n in 2" :key="n" :class="{ on: n <= m.count.strikes, s: true }" /></div>
          <div><b>O</b><i v-for="n in 2" :key="n" :class="{ on: n <= m.outs, o: true }" /></div>
        </div>
        <div class="mini-bases">
          <i :class="{ on: m.bases[1] }" class="b2" /><i :class="{ on: m.bases[2] }" class="b3" /><i :class="{ on: m.bases[0] }" class="b1" />
        </div>
      </div>
    </div>

    <div class="page body">
      <FieldView :bases="m.bases" :last-event="lastEvent" :own-batting="ownBatting" />

      <div class="live">{{ m.lastPitch || 'プレイボール！' }}</div>

      <!-- 対戦 -->
      <div v-if="batter && pitcher" class="duel">
        <div class="side bat" :class="{ own: ownBatting }">
          <FaceIcon :face="batter.face" :size="44" />
          <div class="info">
            <div class="who"><span class="slot">{{ batterSlot?.order }}番{{ batterSlot ? posLabel(batterSlot.pos) : '' }}</span>{{ batter.surname }}</div>
            <div class="ranks">
              <span>ミ</span><RankBadge :value="batter.batting.contact" :show-value="false" size="sm" />
              <span>パ</span><RankBadge :value="batter.batting.power" :show-value="false" size="sm" />
              <span>走</span><RankBadge :value="batter.running.speed" :show-value="false" size="sm" />
            </div>
            <div class="today">{{ todayLine(batBox ?? undefined) }}</div>
          </div>
        </div>
        <div class="vs">VS</div>
        <div class="side pit" :class="{ own: !ownBatting }">
          <FaceIcon :face="pitcher.face" :size="44" />
          <div class="info">
            <div class="who">{{ pitcher.surname }}</div>
            <div class="ranks">
              <span>{{ pitcher.pitching.velocity }}km</span>
              <span>制</span><RankBadge :value="pitcher.pitching.control" :show-value="false" size="sm" />
            </div>
            <div class="stamina">
              <div class="fill" :style="{ width: `${Math.max(4, 100 - (pitchBox?.fatigue ?? 0) * 70)}%` }" :class="{ low: (pitchBox?.fatigue ?? 0) > 0.6 }" />
            </div>
            <div class="today">{{ pitchBox?.pitches ?? 0 }}球</div>
          </div>
        </div>
      </div>

      <!-- 作戦 -->
      <div v-if="!m.finished" class="card orders">
        <template v-if="ownBatting">
          <h2 class="orange"><GameIcon name="bat" /> 攻撃の作戦</h2>
          <div class="chips">
            <button
              v-for="o in BAT_ORDERS"
              :key="o.value"
              :class="m.pending.batting === o.value ? 'sun' : 'secondary'"
              :disabled="orderDisabled(o.value) || ((o.value === 'bunt') && !newPA && m.pending.batting !== 'bunt')"
              @click="game.setMatchOrders({ batting: o.value })"
            >
              {{ o.label }}
            </button>
          </div>
          <button class="secondary full sub-btn" @click="sheet = 'sub'">代打・代走を出す</button>
        </template>
        <template v-else>
          <h2><GameIcon name="glove" /> 守備の作戦</h2>
          <div class="chips">
            <button
              v-for="o in PITCH_ORDERS"
              :key="o.value"
              :class="m.pending.pitching === o.value ? 'sun' : 'secondary'"
              :disabled="o.value === 'walk' && !newPA"
              @click="game.setMatchOrders({ pitching: o.value })"
            >
              {{ o.label }}
            </button>
          </div>
          <div class="sub-label">配球</div>
          <div class="chips">
            <button v-for="o in PLANS" :key="o.value" :class="m.pending.plan === o.value ? 'sky' : 'secondary'" @click="game.setMatchOrders({ plan: o.value })">
              {{ o.label }}
            </button>
          </div>
          <div class="chips">
            <button v-for="o in SHIFTS" :key="o.value" :class="m.pending.shift === o.value ? 'sky' : 'secondary'" @click="game.setMatchOrders({ shift: o.value })">
              {{ o.label }}
            </button>
          </div>
          <button class="secondary full sub-btn" @click="sheet = 'pitcher'">投手を交代する</button>
        </template>
      </div>

      <!-- 実況 -->
      <div class="card">
        <h2><GameIcon name="megaphone" /> 実況</h2>
        <ul class="log">
          <li v-for="(e, i) in recent" :key="i" :class="{ run: e.runs > 0 }">
            <span class="inn">{{ e.inning }}{{ e.top ? '表' : '裏' }}</span>{{ e.text }}<b v-if="e.runs > 0">（{{ e.runs }}点）</b>
          </li>
        </ul>
      </div>
    </div>

    <!-- 進める -->
    <div v-if="!m.finished" class="controls">
      <button class="secondary" :disabled="busyStep" @click="step('pitch')">1球</button>
      <button class="sun main" :disabled="busyStep" @click="step('pa')"><GameIcon name="play" :size="14" /> 1打席</button>
      <button class="secondary" :disabled="busyStep" @click="step('inning')">この回</button>
      <button :class="auto ? 'sky' : 'secondary'" @click="auto = !auto">{{ auto ? '自動中' : '自動' }}</button>
      <button class="secondary" :disabled="busyStep" @click="step('end')">結果へ</button>
    </div>

    <!-- 試合終了 -->
    <div v-if="resultText" class="result-backdrop">
      <div class="result" :class="resultText.cls">
        <div class="result-title">{{ resultText.title }}</div>
        <div class="result-score">{{ resultText.own }} - {{ resultText.opp }}</div>
        <p class="muted">{{ m.options.label }}</p>
        <button class="sun full" :disabled="game.busy" @click="finish">試合を終える</button>
      </div>
    </div>

    <!-- 交代のシート -->
    <div v-if="sheet" class="sheet-backdrop" @click.self="sheet = null">
      <div class="sheet card">
        <template v-if="sheet === 'pitcher'">
          <h2><GameIcon name="flame" /> 継投（ブルペン）</h2>
          <p v-if="benchPitchers.length === 0" class="muted">交代できる投手がいません。</p>
          <button v-for="p in benchPitchers" :key="p.id" class="pick" @click="pickPitcher(p.id)">
            <FaceIcon :face="p.face" :size="36" />
            <span class="pick-name">{{ p.surname }}<small>{{ p.grade }}年</small></span>
            <span class="muted">{{ p.pitching.velocity }}km</span>
            <RankBadge :value="velocityScore(p.pitching.velocity) * 0.4 + p.pitching.control * 0.6" size="sm" :show-value="false" />
            <span class="pill" :class="{ bad: p.condition.armIssue }">体力{{ p.condition.stamina }}</span>
          </button>
        </template>
        <template v-else>
          <h2 class="orange"><GameIcon name="cap" /> 代打・代走</h2>
          <template v-if="!subTarget">
            <p class="muted">交代させる選手を選んでください</p>
            <button v-for="(s, i) in ownTeam?.lineup ?? []" :key="s.playerId" class="pick" @click="subTarget = s.playerId">
              <span class="slot">{{ i + 1 }}番</span>
              <span class="pick-name">{{ players[s.playerId]?.surname }}<small>{{ posLabel(s.position) }}</small></span>
              <span v-if="m.bases.includes(s.playerId)" class="pill gold">走者</span>
            </button>
          </template>
          <template v-else>
            <p class="muted">{{ players[subTarget]?.surname }}に代わって出る選手</p>
            <button v-for="p in benchAll" :key="p.id" class="pick" :disabled="ownTeam?.used.includes(p.id)" @click="pickSub(p.id)">
              <FaceIcon :face="p.face" :size="36" />
              <span class="pick-name">{{ p.surname }}<small>{{ p.grade }}年・{{ POSITION_LABEL[p.mainPosition] }}</small></span>
              <span class="muted">ミ{{ p.batting.contact }} パ{{ p.batting.power }} 走{{ p.running.speed }}</span>
            </button>
            <button class="plain" @click="subTarget = null">選び直す</button>
          </template>
        </template>
        <button class="secondary full" @click="sheet = null">閉じる</button>
      </div>
    </div>

    <CutIn v-if="cutin" :kind="cutin.kind" :face="cutin.player.face" :name="cutin.player.surname" :sub="cutin.sub" @close="closeCutin" />
  </div>
</template>

<style scoped>
.match {
  min-height: 100vh;
  padding-bottom: 90px;
}
.board {
  position: sticky;
  top: 0;
  z-index: 30;
  background: linear-gradient(180deg, #123524, #1d4a33);
  color: #fff;
  padding: 6px 10px 8px;
  padding-top: calc(6px + env(safe-area-inset-top, 0px));
  border-radius: 0 0 18px 18px;
  box-shadow: 0 0 0 2px #e8eef5, 0 6px 14px rgba(0, 0, 0, 0.3);
}
.board-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.back {
  color: #fff;
  font-size: 13px;
  padding: 2px 4px;
}
.label {
  font-size: 12px;
  font-weight: 800;
  color: #ffd36b;
}
.table-wrap {
  overflow-x: auto;
}
.score {
  border-collapse: collapse;
  width: 100%;
  font-variant-numeric: tabular-nums;
  font-size: 13px;
}
.score th,
.score td {
  text-align: center;
  padding: 2px 3px;
  min-width: 18px;
}
.score th {
  color: #9fc8a8;
  font-size: 11px;
}
.score .team {
  text-align: left;
  max-width: 96px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-weight: 800;
}
.score td {
  color: #ffe9a3;
  font-weight: 900;
}
.score .r {
  color: #fff;
  font-size: 15px;
}
.score .now {
  background: rgba(255, 255, 255, 0.12);
}
.score tr.own .team {
  color: #8fd0ff;
}
.sit {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-top: 4px;
}
.inning {
  font-size: 24px;
  font-weight: 900;
}
.inning small {
  font-size: 13px;
}
.bso div {
  display: flex;
  align-items: center;
  gap: 3px;
  line-height: 1.2;
}
.bso b {
  width: 12px;
  font-size: 11px;
}
.bso i {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #2f4f3d;
}
.bso i.on.b {
  background: #4fd36a;
}
.bso i.on.s {
  background: #ffc93c;
}
.bso i.on.o {
  background: #ff5a4f;
}
.mini-bases {
  position: relative;
  width: 44px;
  height: 34px;
  margin-left: auto;
}
.mini-bases i {
  position: absolute;
  width: 13px;
  height: 13px;
  background: #2f4f3d;
  transform: rotate(45deg);
  border: 1.5px solid #9fc8a8;
}
.mini-bases i.on {
  background: #ffc93c;
}
.mini-bases .b2 {
  left: 15px;
  top: 2px;
}
.mini-bases .b3 {
  left: 3px;
  top: 14px;
}
.mini-bases .b1 {
  left: 27px;
  top: 14px;
}
.body {
  padding-top: 10px;
}
.live {
  margin: 10px 0;
  background: #fff;
  border-radius: 12px;
  padding: 8px 12px;
  font-weight: 800;
  box-shadow: var(--panel-shadow);
  min-height: 40px;
}
.duel {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 4px;
  margin-bottom: 14px;
}
.side {
  display: flex;
  gap: 6px;
  align-items: center;
  background: #fff;
  border-radius: 14px;
  padding: 6px;
  box-shadow: var(--panel-shadow);
  min-width: 0;
}
.side.own {
  box-shadow: 0 0 0 2.5px var(--sky), 0 6px 12px -6px rgba(0, 0, 0, 0.3);
}
.info {
  min-width: 0;
}
.who {
  font-weight: 900;
  font-size: 15px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.slot {
  font-size: 11px;
  font-weight: 800;
  color: #fff;
  background: var(--orange);
  border-radius: 5px;
  padding: 0 4px;
  margin-right: 3px;
}
.ranks {
  display: flex;
  align-items: center;
  gap: 2px;
  font-size: 11px;
  font-weight: 800;
  color: var(--ink-soft);
}
.today {
  font-size: 11px;
  color: var(--ink-soft);
  white-space: nowrap;
}
.vs {
  font-weight: 900;
  font-style: italic;
  color: var(--red);
  font-size: 18px;
}
.stamina {
  height: 6px;
  border-radius: 9px;
  background: #e5ebf2;
  overflow: hidden;
  margin: 2px 0;
}
.stamina .fill {
  height: 100%;
  background: linear-gradient(90deg, #4fd36a, #2f9e3a);
}
.stamina .fill.low {
  background: linear-gradient(90deg, #ff8a3d, #e5484d);
}
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 8px;
}
.chips button {
  padding: 7px 11px;
  font-size: 13px;
}
.sub-label {
  font-size: 12px;
  font-weight: 800;
  color: var(--ink-soft);
  margin-bottom: 4px;
}
.sub-btn {
  margin-top: 4px;
}
.log {
  list-style: none;
  margin: 0;
  padding: 0;
  font-size: 14px;
}
.log li {
  padding: 5px 0;
  border-bottom: 2px dashed #eef3f8;
}
.log li.run {
  color: var(--red);
  font-weight: 800;
}
.inn {
  display: inline-block;
  font-size: 11px;
  font-weight: 800;
  color: #fff;
  background: var(--navy);
  border-radius: 5px;
  padding: 0 5px;
  margin-right: 6px;
}
.controls {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  gap: 6px;
  padding: 8px 10px;
  padding-bottom: calc(8px + var(--safe-bottom));
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 -4px 14px rgba(0, 0, 0, 0.12);
  border-radius: 18px 18px 0 0;
  z-index: 40;
}
.controls button {
  flex: 1;
  padding: 11px 2px;
  font-size: 13px;
}
.controls .main {
  flex: 1.6;
  font-size: 15px;
}
.result-backdrop,
.sheet-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(10, 25, 45, 0.55);
  z-index: 70;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}
.sheet-backdrop {
  align-items: flex-end;
  padding: 0;
}
.result {
  background: #fff;
  border-radius: 22px;
  padding: 18px;
  width: 100%;
  max-width: 340px;
  text-align: center;
  animation: pop-in 0.35s ease-out;
  box-shadow: 0 0 0 4px #fff, 0 0 0 7px var(--c), 0 14px 30px rgba(0, 0, 0, 0.3);
}
.result.win {
  --c: #ffc93c;
}
.result.lose {
  --c: #7e8ca0;
}
.result.draw {
  --c: var(--sky);
}
.result-title {
  font-size: 40px;
  font-weight: 900;
  font-style: italic;
  color: var(--red);
}
.result.lose .result-title {
  color: var(--navy);
}
.result-score {
  font-size: 34px;
  font-weight: 900;
  font-variant-numeric: tabular-nums;
}
.sheet {
  width: 100%;
  max-width: 640px;
  max-height: 75vh;
  overflow-y: auto;
  margin: 0;
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
  font-weight: 700;
  margin-bottom: 8px;
  text-align: left;
}
.pick:active {
  box-shadow: inset 0 0 0 2px var(--sky);
}
.pick-name {
  flex: 1;
  font-weight: 900;
}
.pick-name small {
  margin-left: 6px;
  font-size: 11px;
  color: var(--ink-soft);
}
</style>
