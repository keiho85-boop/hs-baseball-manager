<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useGameStore } from '@/stores/game'
import { useUiStore } from '@/stores/ui'
import { POSITION_LABEL, velocityScore } from '@/game/constants'
import { battingTeam, currentBatterId, fieldingTeam, score, situation, activeSkills } from '@/game/match/engine'
import { canPitch } from '@/game/match/lineup'
import type { BattingOrder, DefenseShift, FieldPos, PlayEvent, PitchPlan, PitchingOrder, TeamState } from '@/game/match/types'
import type { Player } from '@/game/types'
import Field3D from '@/components/match/Field3D.vue'
import MatchResult from '@/components/match/MatchResult.vue'
import FormIcon from '@/components/FormIcon.vue'
import { play } from '@/sound'
import { shortResult, isGoodResult, bigResult } from '@/game/match/labels'
import { getSkill } from '@/game/skills'
import { rankOf } from '@/game/constants'
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
  { value: 'pull', label: '引っ張り' },
  { value: 'oppo', label: '流し打ち' },
  { value: 'grounder', label: 'ゴロ狙い' },
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


// ---- 投手・打者の成績（参考：一球速報の表示） ----
function inningsText(outs: number): string {
  return `${Math.floor(outs / 3)}${outs % 3 ? `.${outs % 3}` : ''}`
}

const pitcherStats = computed(() => {
  const s = m.value
  const p = pitcher.value
  if (!s || !p) return null
  const box = s.pitching[p.id]
  const season = p.seasonStats?.pitching
  const outs = (season?.outs ?? 0) + (box?.outs ?? 0)
  const er = (season?.earnedRuns ?? 0) + (box?.r ?? 0)
  const faced = s.events.filter((e) => e.pitcherId === p.id && e.kind !== 'steal' && e.kind !== 'caughtstealing').length
  return {
    era: outs === 0 ? '-.--' : ((er * 27) / outs).toFixed(2),
    pitches: box?.pitches ?? 0,
    ip: inningsText(box?.outs ?? 0),
    faced,
    h: box?.h ?? 0,
    k: box?.k ?? 0,
    bb: box?.bb ?? 0,
    r: box?.r ?? 0,
    fatigue: box?.fatigue ?? 0,
  }
})

const batterStats = computed(() => {
  const s = m.value
  const b = batter.value
  if (!s || !b) return null
  const box = s.batting[b.id]
  const season = b.seasonStats?.batting
  const ab = (season?.atBats ?? 0) + (box?.ab ?? 0)
  const h = (season?.hits ?? 0) + (box?.h ?? 0)
  const results = s.events.filter((e) => e.batterId === b.id && e.kind !== 'steal' && e.kind !== 'caughtstealing')
  return {
    avg: ab === 0 ? '.---' : (h / ab).toFixed(3).replace(/^0/, ''),
    today: `${box?.ab ?? 0}-${box?.h ?? 0}`,
    hr: (season?.homeRuns ?? 0) + (box?.hr ?? 0),
    rbi: (season?.rbi ?? 0) + (box?.rbi ?? 0),
    bb: (season?.walks ?? 0) + (box?.bb ?? 0),
    sb: (season?.steals ?? 0) + (box?.sb ?? 0),
    results: results.slice(-5).map((e) => ({ label: shortResult(e), good: isGoodResult(e) })),
  }
})

const names = computed(() => {
  const out: Record<string, string> = {}
  const s = m.value
  if (!s) return out
  for (const id of s.bases) if (id) out[id] = players.value[id]?.surname ?? ''
  return out
})

const pitchCountLabel = computed(() => {
  const s = m.value
  if (!s) return ''
  return s.count.balls === 0 && s.count.strikes === 0 ? '' : `${s.count.balls}-${s.count.strikes}`
})

function choosePitchOrder(o: PitchingOrder): void {
  void game.setMatchOrders({ pitching: o })
}

const PITCH_SHORT: Record<string, string> = {
  slider: 'スラ',
  curve: 'カーブ',
  fork: 'フォーク',
  changeup: 'チェンジ',
  shoot: 'シュート',
  sinker: 'シンカー',
  cutter: 'カット',
  splitter: 'スプリット',
}

/** いま効いている特殊能力（投手・打者） */
const skillsNow = computed(() => {
  const s = m.value
  if (!s) return { pitcher: [], batter: [] }
  const r = activeSkills(s, players.value)
  const view = (ids: string[]) =>
    ids.map((id) => getSkill(id)).filter((x): x is NonNullable<typeof x> => !!x).map((x) => ({ name: x.name, good: x.good, desc: x.description }))
  return { pitcher: view(r.pitcher), batter: view(r.batter) }
})

function showSkill(sk: { name: string; desc: string }): void {
  ui.notify({ title: sk.name, message: sk.desc, tone: 'info', icon: 'up' })
}

// ---- 進行 ----
const auto = ref(false)
let timer: ReturnType<typeof setTimeout> | undefined

async function step(kind: 'pitch' | 'pa' | 'inning' | 'end'): Promise<void> {
  if (busyStep.value || !m.value || m.value.finished) return
  busyStep.value = true
  const before = m.value.events.length
  try {
    await game.stepMatch(kind)
  } finally {
    busyStep.value = false
  }
  const s = m.value
  if (s && kind !== 'end' && s.events.length > before) {
    const e = s.events[s.events.length - 1]!
    if (!s.finished) flashResult(e)
    playFor(e)
  } else if (s && kind === 'pitch') {
    // 1球だけ進めたとき：打球にならなかった球はミットの音
    if (/空振り|見逃し|ボール/.test(s.lastPitch)) play('miss')
    else if (/ファウル/.test(s.lastPitch)) play('hit')
  }
  if (s?.finished) {
    const ownHome = s.home.schoolId === ownId.value
    const won = s.winner === null ? null : (s.winner === 'home') === ownHome
    setTimeout(() => play(won ? 'win' : 'lose'), 600)
  }
  checkCutin()
}

/** 打席の結果に合わせた効果音 */
function playFor(e: PlayEvent): void {
  if (e.kind === 'homerun') play('homerun')
  else if (['single', 'double', 'triple', 'error'].includes(e.kind)) play('hit')
  else if (e.kind === 'strikeout') play('miss')
  else if (['walk', 'hbp'].includes(e.kind)) play('catch')
  else if (['groundout', 'flyout', 'lineout', 'popout', 'doubleplay', 'sacbunt', 'sacfly', 'fielderschoice', 'buntfail'].includes(e.kind)) {
    play('hit')
    setTimeout(() => play('out'), 350)
  } else if (e.kind === 'steal') play('cheer')
  else play('catch')
}

// ---- 打席結果の演出（画面中央に一時的に出す） ----
const flash = ref<{ title: string; tone: string; sub: string; runs: number; key: number } | null>(null)
let flashTimer: ReturnType<typeof setTimeout> | undefined
let flashKey = 0
function flashResult(e: PlayEvent): void {
  const r = bigResult(e)
  const who = players.value[e.batterId]?.surname ?? ''
  const detail = e.text.split('：').slice(1).join('：') || e.text
  flash.value = { ...r, sub: e.kind === 'steal' || e.kind === 'caughtstealing' ? detail : `${who}　${detail}`, runs: e.runs, key: ++flashKey }
  clearTimeout(flashTimer)
  flashTimer = setTimeout(() => (flash.value = null), e.kind === 'homerun' ? 2200 : 1500)
}
onBeforeUnmount(() => clearTimeout(flashTimer))
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
const sheet = ref<'pitcher' | 'sub' | 'log' | 'lineup' | null>(null)
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
async function finish(): Promise<void> {
  const r = await game.endMatch()
  if (!r) return
  await router.replace({ name: 'home' })
  if (r.finish.messages.length > 0) await ui.alert(r.finish.messages.join('\n'), '試合を終えて')
}

function back(): void {
  auto.value = false
  router.replace({ name: 'home' })
  ui.notify({ title: '中断しました', message: '試合は保存されています。ホームから続きを再開できます', tone: 'info' })
}

if (!game.match) router.replace({ name: 'home' })
else if (game.match.events.length === 0 && game.match.count.balls + game.match.count.strikes === 0) play('whistle')
</script>

<template>
  <div v-if="m" class="match">
    <!-- 上部：対戦カード -->
    <div class="topbar">
      <button class="plain back" aria-label="中断" @click="back"><GameIcon name="back" :size="18" /></button>
      <div class="title">
        <div class="vs">{{ m.away.name }} <small>vs</small> {{ m.home.name }}</div>
        <div class="label">{{ m.options.label }}</div>
      </div>
      <div class="top-tools">
        <button class="tool" @click="sheet = 'log'"><GameIcon name="megaphone" :size="16" />実況</button>
        <button class="tool" @click="sheet = 'lineup'"><GameIcon name="clipboard" :size="16" />オーダー</button>
      </div>
    </div>

    <!-- スコアボード -->
    <div class="board">
      <table class="score">
        <thead>
          <tr>
            <th class="team" />
            <th v-for="i in inningsShown" :key="i">{{ i }}</th>
            <th class="sum">計</th>
            <th class="sum">安</th>
            <th class="sum">失</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(t, idx) in [m.away, m.home]" :key="t.schoolId" :class="{ own: t.schoolId === ownId }">
            <td class="team">{{ t.name.slice(0, 4) }}</td>
            <td v-for="i in inningsShown" :key="i" :class="{ now: i === m.inning && m.top === (idx === 0) && !m.finished }">
              {{ t.runsByInning[i - 1] ?? '' }}
            </td>
            <td class="sum r">{{ sc[idx] }}</td>
            <td class="sum">{{ t.hits }}</td>
            <td class="sum">{{ t.errors }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 1球の情報 -->
    <div class="pitchline">
      <span v-if="pitchCountLabel" class="count">{{ pitchCountLabel }}</span>
      <span class="ptext">{{ m.lastPitch || 'プレイボール！' }}</span>
    </div>

    <!-- BSO -->
    <div class="bso">
      <span class="inning">{{ m.inning }}回{{ m.top ? '表' : '裏' }}</span>
      <span class="lamp"><b>B</b><i v-for="n in 3" :key="n" :class="{ on: n <= m.count.balls }" class="g" /></span>
      <span class="lamp"><b>S</b><i v-for="n in 2" :key="n" :class="{ on: n <= m.count.strikes }" class="y" /></span>
      <span class="lamp"><b>O</b><i v-for="n in 2" :key="n" :class="{ on: n <= m.outs }" class="r" /></span>
    </div>

    <!-- グラウンド（左右に作戦などのボタン） -->
    <div class="field">
      <Field3D
        :bases="m.bases"
        :names="names"
        :last-event="newPA ? lastEvent : null"
        :own-batting="ownBatting"
        :batter-side="batter?.bats ?? 'R'"
        :infield-in="!ownBatting && m.pending.shift === 'infieldIn'"
      />
    </div>

    <!-- 作戦コマンド（その場で選ぶ） -->
    <div v-if="!m.finished" class="command">
      <template v-if="ownBatting">
        <div class="cmd-grid">
          <button
            v-for="o in BAT_ORDERS"
            :key="o.value"
            class="cmd"
            :class="{ on: m.pending.batting === o.value }"
            :disabled="orderDisabled(o.value) || (o.value === 'bunt' && !newPA && m.pending.batting !== 'bunt')"
            @click="game.setMatchOrders({ batting: o.value })"
          >
            {{ o.label }}
          </button>
          <button class="cmd sub" @click="sheet = 'sub'">代打・代走</button>
        </div>
      </template>
      <template v-else>
        <div class="cmd-grid five">
          <button
            v-for="o in PITCH_ORDERS"
            :key="o.value"
            class="cmd"
            :class="{ on: m.pending.pitching === o.value }"
            :disabled="o.value === 'walk' && !newPA"
            @click="choosePitchOrder(o.value)"
          >
            {{ o.label }}
          </button>
          <button class="cmd" :class="{ on: m.pending.shift === 'infieldIn' }" @click="game.setMatchOrders({ shift: m.pending.shift === 'infieldIn' ? 'normal' : 'infieldIn' })">前進守備</button>
          <button class="cmd sub" @click="sheet = 'pitcher'">継投</button>
          <button v-for="o in PLANS" :key="o.value" class="cmd plan" :class="{ on: m.pending.plan === o.value }" @click="game.setMatchOrders({ plan: o.value })">
            {{ o.value === 'auto' ? '配球任せ' : o.label }}
          </button>
        </div>
      </template>
    </div>

    <!-- 投手と打者 -->
    <div v-if="pitcher && pitcherStats" class="duel">
      <div class="panel" :class="{ own: !ownBatting }">
        <div class="ph">
          <span class="role">投手</span>
          <FormIcon :form="pitcher.condition.form" :size="15" />
          <span class="pname">{{ pitcher.surname }}</span>
          <span class="hand" :class="pitcher.throws">{{ pitcher.throws === 'L' ? '左投' : '右投' }}</span>
        </div>
        <div class="abil">
          <span class="velo">{{ pitcher.pitching.velocity }}<small>km</small></span>
          <span class="ab"><small>コン</small><b :class="`k-${rankOf(pitcher.pitching.control)}`">{{ rankOf(pitcher.pitching.control) }}</b></span>
          <span class="ab"><small>スタ</small><b :class="`k-${rankOf(pitcher.pitching.stamina)}`">{{ rankOf(pitcher.pitching.stamina) }}</b></span>
          <span class="ab"><small>キレ</small><b :class="`k-${rankOf(pitcher.pitching.kire)}`">{{ rankOf(pitcher.pitching.kire) }}</b></span>
        </div>
        <div class="pitches">
          <span v-for="pt in pitcher.pitching.pitches" :key="pt.type">{{ PITCH_SHORT[pt.type] }}<b>{{ pt.level }}</b></span>
          <span v-if="pitcher.pitching.pitches.length === 0" class="none">変化球なし</span>
        </div>
        <div class="tbl">
          <div><small>防</small>{{ pitcherStats.era }}</div>
          <div><small>球</small>{{ pitcherStats.pitches }}</div>
          <div><small>回</small>{{ pitcherStats.ip }}</div>
          <div><small>打</small>{{ pitcherStats.faced }}</div>
          <div><small>安</small>{{ pitcherStats.h }}</div>
          <div><small>振</small>{{ pitcherStats.k }}</div>
          <div><small>四</small>{{ pitcherStats.bb }}</div>
          <div><small>失</small>{{ pitcherStats.r }}</div>
        </div>
        <div class="stamina"><div class="fill" :class="{ low: pitcherStats.fatigue > 0.6 }" :style="{ width: `${Math.max(4, 100 - pitcherStats.fatigue * 70)}%` }" /></div>
        <div class="skills">
          <button v-for="sk in skillsNow.pitcher" :key="sk.name" class="skill" :class="sk.good ? 'good' : 'bad'" @click="showSkill(sk)">{{ sk.name }}</button>
        </div>
      </div>
      <div v-if="batter && batterStats" class="panel" :class="{ own: ownBatting }">
        <div class="ph">
          <span class="role">{{ batterSlot?.order }}番 {{ batterSlot ? posLabel(batterSlot.pos) : '' }}</span>
          <FormIcon :form="batter.condition.form" :size="15" />
          <span class="pname">{{ batter.surname }}</span>
          <span class="hand" :class="batter.bats === 'L' ? 'L' : 'R'">{{ batter.bats === 'L' ? '左打' : batter.bats === 'S' ? '両打' : '右打' }}</span>
        </div>
        <div class="abil">
          <span class="traj"><small>弾道</small>{{ '▲'.repeat(batter.batting.trajectory) }}</span>
          <span class="ab"><small>ミート</small><b :class="`k-${rankOf(batter.batting.contact)}`">{{ rankOf(batter.batting.contact) }}</b></span>
          <span class="ab"><small>パワー</small><b :class="`k-${rankOf(batter.batting.power)}`">{{ rankOf(batter.batting.power) }}</b></span>
          <span class="ab"><small>走力</small><b :class="`k-${rankOf(batter.running.speed)}`">{{ rankOf(batter.running.speed) }}</b></span>
        </div>
        <div class="bt">
          <div class="tbl small">
            <div><small>率</small>{{ batterStats.avg }}</div>
            <div><small>本</small>{{ batterStats.hr }}</div>
            <div><small>点</small>{{ batterStats.rbi }}</div>
            <div><small>盗</small>{{ batterStats.sb }}</div>
          </div>
          <ol class="results">
            <li v-for="(r, i) in batterStats.results" :key="i" :class="{ good: r.good }">{{ r.label }}</li>
            <li v-if="batterStats.results.length === 0" class="none">第1打席</li>
          </ol>
        </div>
        <div class="skills">
          <button v-for="sk in skillsNow.batter" :key="sk.name" class="skill" :class="sk.good ? 'good' : 'bad'" @click="showSkill(sk)">{{ sk.name }}</button>
        </div>
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
    <MatchResult v-if="m.finished && !flash" :m="m" :players="players" :own-id="ownId" :busy="game.busy" @finish="finish" />

    <!-- ポップアップ -->
    <div v-if="sheet" class="sheet-backdrop" @click.self="sheet = null">
      <div class="sheet card">
        <template v-if="sheet === 'pitcher'">
          <h2 class="red"><GameIcon name="flame" /> 継投（ブルペン）</h2>
          <p v-if="benchPitchers.length === 0" class="muted">交代できる投手がいません。</p>
          <button v-for="p in benchPitchers" :key="p.id" class="pick" @click="pickPitcher(p.id)">
            <FaceIcon :face="p.face" :size="36" />
            <span class="pick-name">{{ p.surname }}<small>{{ p.grade }}年</small></span>
            <span class="muted">{{ p.pitching.velocity }}km</span>
            <RankBadge :value="velocityScore(p.pitching.velocity) * 0.4 + p.pitching.control * 0.6" size="sm" :show-value="false" />
            <span class="pill" :class="{ bad: p.condition.armIssue }">体力{{ Math.round(p.condition.stamina) }}</span>
          </button>
        </template>

        <template v-else-if="sheet === 'sub'">
          <h2 class="orange"><GameIcon name="cap" /> 代打・代走</h2>
          <template v-if="!subTarget">
            <p class="muted">交代させる選手を選んでください</p>
            <button v-for="(sl, i) in ownTeam?.lineup ?? []" :key="sl.playerId" class="pick" @click="subTarget = sl.playerId">
              <span class="slot">{{ i + 1 }}番</span>
              <span class="pick-name">{{ players[sl.playerId]?.surname }}<small>{{ posLabel(sl.position) }}</small></span>
              <span v-if="m.bases.includes(sl.playerId)" class="pill gold">走者</span>
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

        <template v-else-if="sheet === 'log'">
          <h2><GameIcon name="megaphone" /> 実況</h2>
          <ul class="log">
            <li v-for="(e, i) in recent" :key="i" :class="{ run: e.runs > 0 }">
              <span class="inn">{{ e.inning }}{{ e.top ? '表' : '裏' }}</span>{{ e.text }}<b v-if="e.runs > 0">（{{ e.runs }}点）</b>
            </li>
            <li v-if="recent.length === 0" class="muted">まだプレーはありません</li>
          </ul>
        </template>

        <template v-else-if="sheet === 'lineup'">
          <h2 class="grass"><GameIcon name="clipboard" /> オーダー</h2>
          <div class="lineups">
            <div v-for="t in [m.away, m.home]" :key="t.schoolId" class="lu">
              <div class="lu-name" :class="{ own: t.schoolId === ownId }">{{ t.name }}</div>
              <div v-for="(sl, i) in t.lineup" :key="sl.playerId" class="lu-row" :class="{ now: t === battingTeam(m) && t.battingIndex === i }">
                <span class="lu-no">{{ i + 1 }}</span>
                <span class="lu-pos">{{ posLabel(sl.position) }}</span>
                <span class="lu-p">{{ players[sl.playerId]?.surname }}</span>
                <span class="lu-r">{{ m.batting[sl.playerId]?.h ?? 0 }}/{{ m.batting[sl.playerId]?.ab ?? 0 }}</span>
              </div>
              <div class="lu-row pit">
                <span class="lu-no">投</span>
                <span class="lu-p">{{ players[t.pitcherId]?.surname }}</span>
                <span class="lu-r">{{ m.pitching[t.pitcherId]?.pitches ?? 0 }}球</span>
              </div>
            </div>
          </div>
        </template>
        <button class="secondary full" @click="sheet = null">閉じる</button>
      </div>
    </div>

    <div v-if="flash" :key="flash.key" class="flash" :class="flash.tone">
      <div class="flash-title" :class="{ long: flash.title.length >= 7 }">{{ flash.title }}</div>
      <div v-if="flash.runs > 0" class="flash-runs">+{{ flash.runs }}点</div>
      <div class="flash-sub">{{ flash.sub }}</div>
    </div>

    <CutIn v-if="cutin" :kind="cutin.kind" :face="cutin.player.face" :name="cutin.player.surname" :sub="cutin.sub" @close="closeCutin" />
  </div>
</template>
<style scoped>
/* 試合中は、球場の電光掲示板のような暗い配色で、1画面に収める */
.match {
  height: 100dvh;
  display: flex;
  flex-direction: column;
  background: linear-gradient(180deg, #0b1626 0%, #102038 100%);
  color: #fff;
  overflow: hidden;
  padding-top: env(safe-area-inset-top, 0px);
}
.topbar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px 2px;
}
.back {
  color: #fff;
  padding: 4px;
}
.title {
  min-width: 0;
}
.vs {
  font-size: 17px;
  font-weight: 900;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.vs small {
  font-size: 12px;
  color: #9fb4cc;
  margin: 0 2px;
}
.label {
  font-size: 11px;
  font-weight: 800;
  color: #ffd36b;
}
.board {
  padding: 2px 8px 4px;
}
.score {
  width: 100%;
  border-collapse: separate;
  border-spacing: 2px;
  font-variant-numeric: tabular-nums;
  table-layout: fixed;
}
.score th {
  font-size: 10px;
  color: #8ea3bd;
  font-weight: 700;
}
.score td {
  background: #1b2d47;
  text-align: center;
  font-weight: 900;
  font-size: 15px;
  height: 26px;
  border-radius: 3px;
}
.score .team {
  width: 52px;
  background: transparent;
  font-size: 12px;
  text-align: left;
  white-space: nowrap;
  overflow: hidden;
}
.score tr.own .team {
  color: #8fd0ff;
}
.score td.now {
  background: #2c4a70;
  box-shadow: inset 0 0 0 1.5px #ffd36b;
}
.score .sum {
  width: 24px;
}
.score td.sum {
  background: #24395a;
}
.score td.r {
  color: #ffd36b;
}
.pitchline {
  margin: 0 8px;
  display: flex;
  align-items: center;
  gap: 8px;
  background: #13233a;
  border: 1px solid #2a3f5e;
  border-radius: 8px;
  padding: 6px 10px;
  min-height: 40px;
}
.count {
  background: #1f9e6a;
  color: #fff;
  font-weight: 900;
  border-radius: 999px;
  padding: 2px 9px;
  font-size: 13px;
  flex-shrink: 0;
}
.ptext {
  font-weight: 800;
  font-size: 14px;
  line-height: 1.3;
}
.bso {
  display: flex;
  align-items: center;
  justify-content: space-around;
  padding: 4px 10px;
  font-weight: 900;
}
.inning {
  font-size: 14px;
  color: #ffd36b;
}
.lamp {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 15px;
}
.lamp b {
  margin-right: 2px;
}
.lamp i {
  width: 11px;
  height: 11px;
  border-radius: 50%;
  background: #2a3a50;
}
.lamp i.on.g {
  background: #22c55e;
  box-shadow: 0 0 6px #22c55e;
}
.lamp i.on.y {
  background: #facc15;
  box-shadow: 0 0 6px #facc15;
}
.lamp i.on.r {
  background: #ef4444;
  box-shadow: 0 0 6px #ef4444;
}
.top-tools {
  margin-left: auto;
  display: flex;
  gap: 6px;
  flex-shrink: 0;
}
.tool {
  padding: 5px 8px;
  border-radius: 9px;
  background: #1b2d47;
  box-shadow: inset 0 0 0 1.5px #3a5478;
  color: #e6eef8;
  font-size: 11px;
  font-weight: 800;
  display: flex;
  align-items: center;
  gap: 3px;
  text-shadow: none;
}
.command {
  padding: 4px 8px 2px;
}
.cmd-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 5px;
}
.cmd-grid.five {
  grid-template-columns: repeat(5, 1fr);
}
.cmd {
  padding: 7px 0;
  border-radius: 9px;
  background: #1b2d47;
  box-shadow: inset 0 0 0 1.5px #34506f;
  color: #e6eef8;
  font-size: 12px;
  font-weight: 900;
  text-shadow: none;
  white-space: nowrap;
}
.cmd.plan {
  padding: 6px 0;
  font-size: 11px;
}
.cmd.on {
  background: linear-gradient(180deg, #ffd96b, #f6b21c);
  color: #3a2600;
  box-shadow: 0 0 8px rgba(255, 211, 107, 0.5);
}
.cmd.plan.on {
  background: linear-gradient(180deg, #7cc8ff, #3aa8f0);
  color: #062038;
}
.cmd.sub {
  color: #ffd36b;
  box-shadow: inset 0 0 0 1.5px #ffd36b88;
}
.cmd:disabled {
  opacity: 0.35;
}
.abil {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 2px;
  margin-bottom: 3px;
}
.velo {
  font-size: 17px;
  font-weight: 900;
  font-style: italic;
  color: #ff8a80;
  line-height: 1;
}
.velo small {
  font-size: 9px;
  margin-left: 1px;
}
.ab,
.traj {
  display: flex;
  flex-direction: column;
  align-items: center;
  line-height: 1.05;
}
.ab small,
.traj small {
  font-size: 9px;
  color: #8ea3bd;
  font-weight: 700;
}
.traj {
  font-size: 10px;
  color: #ff9f43;
}
.ab b {
  font-size: 16px;
  font-weight: 900;
  font-style: italic;
}
.k-S {
  color: #ff5bd0;
}
.k-A {
  color: #ff5a5f;
}
.k-B {
  color: #ff9f43;
}
.k-C {
  color: #5fd36a;
}
.k-D {
  color: #3fd2c7;
}
.k-E {
  color: #6aa5ff;
}
.k-F,
.k-G {
  color: #9aa7b8;
}
.pitches {
  display: flex;
  flex-wrap: wrap;
  gap: 2px 7px;
  font-size: 11px;
  font-weight: 800;
  color: #cfe0f2;
  margin-bottom: 4px;
  min-height: 15px;
}
.pitches b {
  color: #ffd36b;
  margin-left: 1px;
}
.pitches .none {
  color: #8ea3bd;
}
.skills {
  display: flex;
  flex-wrap: wrap;
  gap: 3px;
  margin-top: 4px;
  min-height: 0;
}
.skill {
  padding: 1px 6px;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 900;
  text-shadow: none;
  box-shadow: none;
  animation: pop-in 0.25s ease-out;
}
.skill.good {
  background: #ffd36b;
  color: #3a2600;
}
.skill.bad {
  background: #5a6b82;
  color: #e6eef8;
}
.field {
  flex: 1;
  min-height: 80px;
  position: relative;
}
.field > :deep(.fp) {
  position: absolute;
  inset: 0;
}
.side {
  position: absolute;
  z-index: 1;
  top: 4px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.side.left {
  left: 6px;
}
.side.right {
  right: 6px;
}
.side-btn {
  width: 62px;
  padding: 6px 2px;
  border-radius: 12px;
  background: rgba(16, 32, 56, 0.85);
  box-shadow: inset 0 0 0 1.5px #3a5478;
  color: #ffd36b;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
  font-size: 11px;
  text-shadow: none;
}
.side-btn span {
  color: #e6eef8;
  font-weight: 800;
}
.side-btn em {
  font-style: normal;
  font-size: 10px;
  color: #0b1626;
  background: #ffd36b;
  border-radius: 999px;
  padding: 0 6px;
}
.side-btn:active:not(:disabled) {
  transform: scale(0.96);
  box-shadow: inset 0 0 0 1.5px #ffd36b;
}
.duel {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
  padding: 4px 8px 6px;
}
.panel {
  background: #13233a;
  border: 1px solid #2a3f5e;
  border-radius: 10px;
  padding: 6px 8px;
  min-width: 0;
}
.panel.own {
  border-color: #3aa8f0;
}
.ph {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 4px;
  min-width: 0;
}
.role {
  font-size: 10px;
  color: #8ea3bd;
  font-weight: 800;
  flex-shrink: 0;
}
.pname {
  font-weight: 900;
  font-size: 15px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.hand {
  margin-left: auto;
  font-size: 10px;
  font-weight: 900;
  padding: 0 4px;
  border-radius: 3px;
  background: #d6336c;
  flex-shrink: 0;
}
.hand.L {
  background: #2f6fe0;
}
.tbl {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 2px;
  font-size: 13px;
  font-weight: 900;
  font-variant-numeric: tabular-nums;
}
.tbl div {
  display: flex;
  flex-direction: column;
  align-items: center;
  background: #1b2d47;
  border-radius: 4px;
  padding: 1px 0;
}
.tbl small {
  font-size: 9px;
  color: #8ea3bd;
}
.tbl.small {
  grid-template-columns: repeat(2, 1fr);
}
.bt {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px;
}
.results {
  list-style: none;
  margin: 0;
  padding: 0;
  font-size: 12px;
  font-weight: 800;
  counter-reset: pa;
}
.results li {
  counter-increment: pa;
  display: flex;
  gap: 4px;
  line-height: 1.45;
}
.results li::before {
  content: counter(pa);
  font-size: 10px;
  color: #8ea3bd;
  width: 10px;
}
.results li.good {
  color: #ffd36b;
}
.results li.none::before {
  content: '';
}
.stamina {
  height: 5px;
  border-radius: 9px;
  background: #2a3a50;
  overflow: hidden;
  margin-top: 5px;
}
.stamina .fill {
  height: 100%;
  background: linear-gradient(90deg, #4fd36a, #22c55e);
}
.stamina .fill.low {
  background: linear-gradient(90deg, #ff8a3d, #ef4444);
}
.controls {
  display: flex;
  gap: 6px;
  padding: 6px 8px;
  padding-bottom: calc(6px + var(--safe-bottom));
  background: #0b1626;
  border-top: 1px solid #22344f;
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
  background: rgba(5, 12, 24, 0.6);
  z-index: 70;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  color: var(--ink);
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
  max-height: 78vh;
  overflow-y: auto;
  margin: 0;
  border-radius: 20px 20px 0 0;
  padding-bottom: calc(14px + var(--safe-bottom));
  animation: float-up 0.2s ease-out;
}
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 10px;
}
.chips button {
  padding: 9px 13px;
  font-size: 14px;
}
.sub-label {
  font-size: 12px;
  font-weight: 800;
  color: var(--ink-soft);
  margin-bottom: 4px;
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
.pick-name {
  flex: 1;
  font-weight: 900;
}
.pick-name small {
  margin-left: 6px;
  font-size: 11px;
  color: var(--ink-soft);
}
.slot {
  font-size: 11px;
  font-weight: 800;
  color: #fff;
  background: var(--orange);
  border-radius: 5px;
  padding: 0 4px;
}
.log {
  list-style: none;
  margin: 0 0 10px;
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
.lineups {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-bottom: 10px;
}
.lu-name {
  font-weight: 900;
  font-size: 13px;
  margin-bottom: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.lu-name.own {
  color: var(--sky-deep);
}
.lu-row {
  display: flex;
  gap: 4px;
  font-size: 13px;
  padding: 2px 0;
  border-bottom: 1px solid #eef3f8;
}
.lu-row.now {
  background: #fff4d0;
}
.lu-no {
  width: 16px;
  color: var(--ink-soft);
  font-weight: 800;
}
.lu-pos {
  width: 16px;
  font-weight: 900;
  color: var(--orange);
}
.lu-p {
  flex: 1;
  font-weight: 800;
}
.lu-r {
  font-size: 11px;
  color: var(--ink-soft);
}
.flash {
  position: fixed;
  left: 0;
  right: 0;
  top: 38%;
  z-index: 65;
  pointer-events: none;
  text-align: center;
  padding: 10px 12px 12px;
  background: linear-gradient(90deg, transparent, rgba(8, 18, 34, 0.88) 15%, rgba(8, 18, 34, 0.88) 85%, transparent);
  animation: flash-in 0.28s cubic-bezier(0.2, 1.6, 0.4, 1) both, flash-out 0.3s ease-in 1.2s forwards;
}
.flash.hr {
  animation: flash-in 0.32s cubic-bezier(0.2, 1.6, 0.4, 1) both, flash-out 0.35s ease-in 1.85s forwards;
}
.flash-title {
  font-size: 40px;
  font-weight: 900;
  font-style: italic;
  letter-spacing: 1px;
  line-height: 1.1;
  color: #fff;
  -webkit-text-stroke: 1.5px rgba(0, 0, 0, 0.35);
  text-shadow: 0 4px 0 rgba(0, 0, 0, 0.35);
}
.flash-title.long {
  font-size: 29px;
  white-space: nowrap;
}
.flash.hit .flash-title {
  color: #ff6b5e;
  text-shadow: 0 4px 0 #7a1410, 0 0 18px rgba(255, 90, 80, 0.6);
}
.flash.hr .flash-title {
  font-size: 46px;
  background: linear-gradient(180deg, #fff6c2, #ffd33d 55%, #f39c12);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  -webkit-text-stroke: 1.5px #7a4a00;
  filter: drop-shadow(0 4px 0 #6b3d00) drop-shadow(0 0 14px rgba(255, 211, 61, 0.7));
}
.flash.out .flash-title {
  color: #8fd0ff;
  text-shadow: 0 4px 0 #0b3a66;
}
.flash.walk .flash-title {
  color: #7ee08a;
  text-shadow: 0 4px 0 #145a22;
}
.flash.error .flash-title {
  color: #ffb547;
  text-shadow: 0 4px 0 #6b3d00;
}
.flash-runs {
  display: inline-block;
  margin-top: 4px;
  background: #ffd33d;
  color: #3a2600;
  font-weight: 900;
  font-size: 18px;
  border-radius: 999px;
  padding: 1px 14px;
}
.flash-sub {
  margin-top: 4px;
  color: #e6eef8;
  font-weight: 800;
  font-size: 13px;
}
@keyframes flash-in {
  from {
    opacity: 0;
    transform: scale(1.8);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}
@keyframes flash-out {
  to {
    opacity: 0;
    transform: translateY(-14px);
  }
}
</style>
