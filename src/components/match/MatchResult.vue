<script setup lang="ts">
// 試合結果の画面（スコア、本塁打、バッテリー、スタメン、打者成績、投手成績）
import { computed, ref } from 'vue'
import type { MatchState, TeamState } from '@/game/match/types'
import type { Player, Position } from '@/game/types'
import { POSITION_LABEL } from '@/game/constants'
import { score } from '@/game/match/engine'

const props = defineProps<{ m: MatchState; players: Record<string, Player>; ownId: string; busy: boolean }>()
defineEmits<{ finish: [] }>()

type Tab = 'top' | 'bat' | 'pitch'
const tab = ref<Tab>('top')
const teamSel = ref<'away' | 'home'>(props.m.home.schoolId === props.ownId ? 'home' : 'away')

const sc = computed(() => score(props.m))
const ownHome = computed(() => props.m.home.schoolId === props.ownId)
const verdict = computed(() => {
  const s = props.m
  if (s.winner === null) return { title: '引き分け', cls: 'draw' }
  const won = (s.winner === 'home') === ownHome.value
  return won ? { title: '勝利！', cls: 'win' } : { title: '敗戦…', cls: 'lose' }
})

const innings = computed(() => Math.max(props.m.options.innings, props.m.away.runsByInning.length, props.m.home.runsByInning.length))
const short = (t: TeamState) => t.name.replace(/高校$|高等学校$/, '').slice(0, 4)
const nameOf = (id: string) => props.players[id]?.surname ?? '？'
const fullName = (id: string) => {
  const p = props.players[id]
  return p ? `${p.surname} ${p.givenName}` : '？'
}
const teamOf = (key: 'away' | 'home') => (key === 'away' ? props.m.away : props.m.home)
const posLabel = (pos: Position | 'DH') => (pos === 'DH' ? '指' : POSITION_LABEL[pos])

/** 本塁打の一覧（今季の通算本数・回・何ラン） */
const homeRuns = computed(() => {
  const s = props.m
  const count: Record<string, number> = {}
  return s.events
    .filter((e) => e.kind === 'homerun')
    .map((e) => {
      count[e.batterId] = (count[e.batterId] ?? 0) + 1
      const season = props.players[e.batterId]?.seasonStats?.batting.homeRuns ?? 0
      const kind = e.runs === 1 ? 'ソロ' : e.runs === 4 ? '満塁' : `${e.runs}ラン`
      return {
        team: e.top ? s.away : s.home,
        text: `${fullName(e.batterId)}　${season + count[e.batterId]!}号（${e.inning}回${e.top ? '表' : '裏'}${kind}）`,
      }
    })
})

/** 投げた順の投手 */
function pitchersOf(t: TeamState): string[] {
  const out: string[] = []
  for (const e of props.m.events) {
    if (props.players[e.pitcherId]?.schoolId === t.schoolId && !out.includes(e.pitcherId)) out.push(e.pitcherId)
  }
  if (!out.includes(t.pitcherId)) out.push(t.pitcherId)
  return out
}
function catcherOf(t: TeamState): string {
  return t.lineup.find((x) => x.position === 'C')?.playerId ?? ''
}
const battery = computed(() =>
  (['away', 'home'] as const).map((k) => {
    const t = teamOf(k)
    return { team: t, text: `${pitchersOf(t).map(nameOf).join('、')} - ${nameOf(catcherOf(t))}` }
  }),
)
const decision = computed(() => {
  const s = props.m
  const list: { label: string; text: string }[] = []
  if (s.winningPitcherId) list.push({ label: '勝', text: `${fullName(s.winningPitcherId)}（${short(props.players[s.winningPitcherId]?.schoolId === s.away.schoolId ? s.away : s.home)}）` })
  if (s.losingPitcherId) list.push({ label: '敗', text: `${fullName(s.losingPitcherId)}（${short(props.players[s.losingPitcherId]?.schoolId === s.away.schoolId ? s.away : s.home)}）` })
  return list
})

/** 打者成績（打順どおり。途中出場の選手は最後に「代」として載せる） */
const batters = computed(() => {
  const s = props.m
  const t = teamOf(teamSel.value)
  const ids = t.lineup.map((x) => x.playerId)
  const subs = Object.keys(s.batting).filter((id) => props.players[id]?.schoolId === t.schoolId && !ids.includes(id))
  const rows = [
    ...t.lineup.map((x) => ({ id: x.playerId, pos: posLabel(x.position) })),
    ...subs.map((id) => ({ id, pos: '代' })),
  ]
  return rows.map((r) => {
    const b = s.batting[r.id]
    const season = props.players[r.id]?.seasonStats?.batting
    const ab = (season?.atBats ?? 0) + (b?.ab ?? 0)
    const h = (season?.hits ?? 0) + (b?.h ?? 0)
    return {
      ...r,
      name: fullName(r.id),
      avg: ab === 0 ? '-' : (h / ab).toFixed(3).replace(/^0/, ''),
      ab: b?.ab ?? 0,
      h: b?.h ?? 0,
      rbi: b?.rbi ?? 0,
      hr: b?.hr ?? 0,
      sb: b?.sb ?? 0,
    }
  })
})

const ip = (outs: number) => `${Math.floor(outs / 3)}${outs % 3 ? `.${outs % 3}` : ''}`
const pitchers = computed(() =>
  (['away', 'home'] as const).map((k) => {
    const t = teamOf(k)
    return {
      team: t,
      rows: pitchersOf(t).map((id) => {
        const p = props.m.pitching[id]
        const mark = id === props.m.winningPitcherId ? '勝' : id === props.m.losingPitcherId ? '敗' : ''
        return { id, name: fullName(id), mark, ip: ip(p?.outs ?? 0), pitches: p?.pitches ?? 0, h: p?.h ?? 0, k: p?.k ?? 0, bb: p?.bb ?? 0, r: p?.r ?? 0 }
      }),
    }
  }),
)
</script>

<template>
  <div class="mr">
    <div class="head" :class="verdict.cls">
      <div class="verdict">{{ verdict.title }}</div>
      <div class="sub">{{ m.options.label }}　{{ m.away.name }} vs {{ m.home.name }}</div>
    </div>

    <table class="board">
      <thead>
        <tr>
          <th class="tn" />
          <th v-for="i in innings" :key="i">{{ i }}</th>
          <th class="gap" />
          <th>計</th>
          <th>安</th>
          <th>失</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(t, idx) in [m.away, m.home]" :key="t.schoolId" :class="{ own: t.schoolId === ownId }">
          <td class="tn">{{ short(t) }}</td>
          <td v-for="i in innings" :key="i">{{ t.runsByInning[i - 1] ?? (idx === 1 && m.winner === 'home' && i === innings ? 'x' : '') }}</td>
          <td class="gap" />
          <td class="sum r">{{ sc[idx] }}</td>
          <td class="sum">{{ t.hits }}</td>
          <td class="sum">{{ t.errors }}</td>
        </tr>
      </tbody>
    </table>

    <div class="tabs">
      <button :class="{ on: tab === 'top' }" @click="tab = 'top'">トップ</button>
      <button :class="{ on: tab === 'bat' }" @click="tab = 'bat'">打者成績</button>
      <button :class="{ on: tab === 'pitch' }" @click="tab = 'pitch'">投手成績</button>
    </div>

    <div class="body">
      <template v-if="tab === 'top'">
        <div class="sec">本塁打</div>
        <div v-if="homeRuns.length === 0" class="line muted">なし</div>
        <div v-for="(h, i) in homeRuns" :key="i" class="line">
          <span class="tag">{{ short(h.team) }}</span>{{ h.text }}
        </div>
        <template v-if="decision.length">
          <div class="sec">責任投手</div>
          <div v-for="d in decision" :key="d.label" class="line">
            <span class="tag" :class="d.label === '勝' ? 'w' : 'l'">{{ d.label }}</span>{{ d.text }}
          </div>
        </template>
        <div class="sec">バッテリー</div>
        <div v-for="b in battery" :key="b.team.schoolId" class="line">
          <span class="tag">{{ short(b.team) }}</span>{{ b.text }}
        </div>
        <div class="sec">スターティングメンバー</div>
        <div class="starters">
          <div v-for="t in [m.away, m.home]" :key="t.schoolId" class="col">
            <div class="col-h" :class="{ own: t.schoolId === ownId }">{{ t.name }}</div>
            <div v-for="(sl, i) in t.lineup" :key="sl.playerId" class="st">
              <span class="no">{{ i + 1 }}</span>
              <span class="ps">{{ posLabel(sl.position) }}</span>
              <span class="nm">{{ fullName(sl.playerId) }}</span>
            </div>
            <div v-if="t.useDH" class="st">
              <span class="no" />
              <span class="ps">投</span>
              <span class="nm">{{ fullName(pitchersOf(t)[0] ?? t.pitcherId) }}</span>
            </div>
          </div>
        </div>
      </template>

      <template v-else-if="tab === 'bat'">
        <div class="team-sw">
          <button :class="{ on: teamSel === 'away' }" @click="teamSel = 'away'">{{ m.away.name }}</button>
          <button :class="{ on: teamSel === 'home' }" @click="teamSel = 'home'">{{ m.home.name }}</button>
        </div>
        <table class="grid">
          <thead>
            <tr>
              <th>位置</th>
              <th class="nmc">選手名</th>
              <th>打率</th>
              <th>打</th>
              <th>安</th>
              <th>点</th>
              <th>本</th>
              <th>盗</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="b in batters" :key="b.id">
              <td class="ps">{{ b.pos }}</td>
              <td class="nmc">{{ b.name }}</td>
              <td>{{ b.avg }}</td>
              <td>{{ b.ab }}</td>
              <td :class="{ hl: b.h > 0 }">{{ b.h }}</td>
              <td :class="{ hl: b.rbi > 0 }">{{ b.rbi }}</td>
              <td :class="{ hl: b.hr > 0 }">{{ b.hr }}</td>
              <td>{{ b.sb }}</td>
            </tr>
          </tbody>
        </table>
      </template>

      <template v-else>
        <div v-for="g in pitchers" :key="g.team.schoolId" class="pgroup">
          <div class="sec">{{ g.team.name }}</div>
          <table class="grid">
            <thead>
              <tr>
                <th class="nmc">選手名</th>
                <th>回</th>
                <th>球</th>
                <th>安</th>
                <th>振</th>
                <th>四</th>
                <th>失</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="p in g.rows" :key="p.id">
                <td class="nmc">
                  <span v-if="p.mark" class="mk" :class="p.mark === '勝' ? 'w' : 'l'">{{ p.mark }}</span>{{ p.name }}
                </td>
                <td>{{ p.ip }}</td>
                <td>{{ p.pitches }}</td>
                <td>{{ p.h }}</td>
                <td>{{ p.k }}</td>
                <td>{{ p.bb }}</td>
                <td>{{ p.r }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>
    </div>

    <div class="foot">
      <button class="sun full" :disabled="busy" @click="$emit('finish')">試合を終える</button>
    </div>
  </div>
</template>

<style scoped>
.mr {
  position: fixed;
  inset: 0;
  z-index: 75;
  background: #05080f;
  color: #e8eef8;
  display: flex;
  flex-direction: column;
  padding-top: env(safe-area-inset-top, 0px);
  animation: float-up 0.25s ease-out;
}
.head {
  text-align: center;
  padding: 10px 12px 6px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.06), transparent);
}
.verdict {
  font-size: 34px;
  font-weight: 900;
  font-style: italic;
  line-height: 1.1;
}
.win .verdict {
  background: linear-gradient(180deg, #fff6c2, #ffd33d 55%, #f39c12);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  filter: drop-shadow(0 0 12px rgba(255, 211, 61, 0.5));
}
.lose .verdict {
  color: #8fa6c4;
}
.draw .verdict {
  color: #8fd0ff;
}
.sub {
  font-size: 12px;
  color: #9fb0c4;
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.board {
  width: calc(100% - 12px);
  margin: 4px 6px 8px;
  border-collapse: separate;
  border-spacing: 2px;
  table-layout: fixed;
  font-variant-numeric: tabular-nums;
}
.board th {
  font-size: 11px;
  color: #b8c4d4;
  font-weight: 600;
}
.board td {
  background: #1a1d24;
  text-align: center;
  font-size: 17px;
  font-weight: 700;
  height: 32px;
}
.board .tn {
  width: 48px;
  background: transparent;
  font-size: 13px;
  text-align: left;
  white-space: nowrap;
  overflow: hidden;
}
.board tr.own .tn {
  color: #ffd36b;
}
.board .gap {
  width: 4px;
  background: transparent;
}
.board .sum {
  background: #24282f;
}
.board .r {
  color: #fff;
}
.tabs {
  display: flex;
  border-bottom: 1px solid #2a2f38;
}
.tabs button {
  flex: 1;
  background: transparent;
  box-shadow: none;
  text-shadow: none;
  color: #e8eef8;
  font-weight: 700;
  border-radius: 0;
  padding: 10px 0;
  font-size: 15px;
  border-bottom: 2px solid transparent;
}
.tabs button.on {
  color: #f0b640;
  border-bottom-color: #f0b640;
}
.body {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
}
.sec {
  background: #15181e;
  border-left: 3px solid #8a93a3;
  padding: 4px 10px;
  font-size: 13px;
  font-weight: 700;
  border-top: 1px solid #2a2f38;
}
.line {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 5px 10px;
  font-size: 14px;
  border-bottom: 1px solid #23272f;
}
.line.muted {
  color: #7f8a99;
}
.tag {
  flex-shrink: 0;
  min-width: 46px;
  text-align: center;
  font-size: 11px;
  color: #b8c4d4;
  background: #1f232b;
  border-radius: 4px;
  padding: 2px 4px;
}
.tag.w,
.mk.w {
  background: #c22f2f;
  color: #fff;
}
.tag.l,
.mk.l {
  background: #2f5fc2;
  color: #fff;
}
.starters {
  display: grid;
  grid-template-columns: 1fr 1fr;
}
.col + .col {
  border-left: 1px solid #2a2f38;
}
.col-h {
  text-align: center;
  font-size: 13px;
  font-weight: 700;
  padding: 5px 4px;
  border-bottom: 1px solid #2a2f38;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.col-h.own {
  color: #ffd36b;
}
.st {
  display: flex;
  align-items: center;
  font-size: 13px;
  padding: 2px 6px;
  border-bottom: 1px solid #1c2027;
}
.no {
  width: 16px;
  color: #9fb0c4;
}
.ps {
  width: 20px;
  text-align: center;
  color: #b8c4d4;
}
.nm {
  flex: 1;
  border-left: 2px solid #3a6fd8;
  padding-left: 5px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.team-sw {
  display: flex;
  gap: 6px;
  padding: 8px;
}
.team-sw button {
  flex: 1;
  padding: 7px 4px;
  font-size: 13px;
  background: #1a1d24;
  color: #b8c4d4;
  box-shadow: inset 0 0 0 1px #2f3540;
  text-shadow: none;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.team-sw button.on {
  background: #f0b640;
  color: #1a1200;
  box-shadow: none;
}
.grid {
  width: 100%;
  border-collapse: collapse;
  font-variant-numeric: tabular-nums;
  font-size: 14px;
}
.grid th {
  font-size: 12px;
  font-weight: 600;
  color: #b8c4d4;
  background: #15181e;
  padding: 6px 2px;
  border: 1px solid #23272f;
}
.grid td {
  text-align: center;
  padding: 6px 2px;
  border: 1px solid #1f232a;
}
.grid .nmc {
  text-align: left;
  padding-left: 8px;
  white-space: nowrap;
}
.grid td.ps {
  width: 36px;
}
.grid .hl {
  color: #ffd36b;
  font-weight: 800;
}
.mk {
  display: inline-block;
  font-size: 10px;
  border-radius: 3px;
  padding: 0 3px;
  margin-right: 4px;
}
.foot {
  padding: 8px 12px;
  padding-bottom: calc(8px + var(--safe-bottom));
  border-top: 1px solid #2a2f38;
}
</style>
