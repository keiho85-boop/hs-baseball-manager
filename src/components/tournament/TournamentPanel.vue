<script setup lang="ts">
// ホームの大会パネル：次の相手、ここまでの勝ち上がり、試合開始／次の週へ
import { computed } from 'vue'
import GameIcon from '@/components/GameIcon.vue'
import RankBadge from '@/components/RankBadge.vue'
import { prefName } from '@/game/constants'
import { ownAlive, roundName, type Tournament } from '@/game/tournament'
import type { School } from '@/game/types'

const props = defineProps<{
  t: Tournament
  schools: Record<string, School>
  ownId: string
  /** この週に戦う、まだ終わっていない試合 */
  pending: { round: number; opponentId: string } | null
  busy: boolean
}>()
defineEmits<{ start: []; next: []; bracket: []; order: [] }>()

const own = computed(() => props.schools[props.ownId]!)
const opp = computed(() => (props.pending ? props.schools[props.pending.opponentId] ?? null : null))
const alive = computed(() => ownAlive({ playerSchoolId: props.ownId }, props.t))
const national = computed(() => props.t.prefCode === null)

/** 自校のここまでの試合 */
const path = computed(() => {
  const list: { round: string; opp: string; score: string; won: boolean; note: string }[] = []
  props.t.rounds.forEach((games, r) => {
    const g = games.find((x) => x.a === props.ownId || x.b === props.ownId)
    if (!g || g.bye || !g.winner || !g.score) return
    const ownIsA = g.a === props.ownId
    const oppId = ownIsA ? g.b : g.a
    const [o, p] = ownIsA ? g.score : [g.score[1], g.score[0]]
    list.push({ round: roundName(props.t, r), opp: props.schools[oppId!]?.name ?? '', score: `${o} - ${p}`, won: g.winner === props.ownId, note: g.note ?? '' })
  })
  return list
})

/** 相手のこの大会での勝ち上がり */
const oppPath = computed(() => {
  const id = props.pending?.opponentId
  if (!id) return []
  const list: string[] = []
  props.t.rounds.forEach((games, r) => {
    const g = games.find((x) => x.a === id || x.b === id)
    if (!g || !g.winner || g.winner !== id || !g.score) return
    if (g.bye) return
    const isA = g.a === id
    const [o, p] = isA ? g.score : [g.score[1], g.score[0]]
    list.push(`${roundName(props.t, r)} ${o}-${p}`)
  })
  return list
})

const roundLabel = computed(() => (props.pending ? roundName(props.t, props.pending.round) : ''))
const nextRoundLabel = computed(() => (alive.value && props.t.current < props.t.rounds.length ? roundName(props.t, props.t.current) : ''))
</script>

<template>
  <div class="tp" :class="{ national }">
    <div class="tp-head">
      <span class="tp-name"><GameIcon name="trophy" :size="16" /> {{ t.name }}</span>
      <button class="plain link" @click="$emit('bracket')">組み合わせ表</button>
    </div>

    <template v-if="pending && opp">
      <div class="round">{{ roundLabel }}</div>
      <div class="vs">
        <div class="team own">
          <div class="tn">{{ own.name }}</div>
          <RankBadge :value="own.overall" />
        </div>
        <div class="vs-mark">VS</div>
        <div class="team">
          <div class="tn">{{ opp.name }}</div>
          <RankBadge :value="opp.overall" />
          <small>{{ national ? prefName(opp.prefCode) : '' }}{{ national ? '・' : '' }}{{ opp.kind === 'private' ? '私立' : '公立' }}</small>
        </div>
      </div>
      <p v-if="oppPath.length" class="opp-path">相手の勝ち上がり：{{ oppPath.join('、') }}</p>
      <p v-else class="opp-path">{{ pending.round === 0 ? '初戦の相手です' : 'シードで勝ち上がってきた相手です' }}</p>
      <div class="btns">
        <button class="secondary" @click="$emit('order')"><GameIcon name="clipboard" :size="16" /> オーダー</button>
        <button class="sun main" :disabled="busy" @click="$emit('start')"><GameIcon name="play" :size="16" /> 試合開始</button>
      </div>
    </template>

    <template v-else>
      <div v-if="alive" class="status good">
        <b>今週の試合はすべて終わりました</b>
        <span>次は{{ nextRoundLabel }}です</span>
      </div>
      <div v-else-if="t.championId === ownId" class="status champ">
        <b>優勝！</b>
        <span>{{ t.name }}を制しました</span>
      </div>
      <div v-else class="status bad">
        <b>敗退…</b>
        <span>次の大会に向けて練習を再開します</span>
      </div>
      <button class="sun full" :disabled="busy" @click="$emit('next')"><GameIcon name="play" :size="14" /> 次の週へ</button>
    </template>

    <ul v-if="path.length" class="path">
      <li v-for="p in path" :key="p.round" :class="{ won: p.won }">
        <span class="pr">{{ p.round }}</span>
        <span class="po">{{ p.opp }}</span>
        <span class="ps">{{ p.score }}<small v-if="p.note">{{ p.note }}</small></span>
        <span class="pw">{{ p.won ? '○' : '●' }}</span>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.tp {
  background:
    radial-gradient(120% 80% at 50% 0%, rgba(255, 255, 255, 0.12), transparent 60%),
    linear-gradient(160deg, #1d4f9e, #0f2c63);
  color: #fff;
  border-radius: 20px;
  padding: 12px 14px 14px;
  box-shadow: 0 6px 0 #0a1f47, 0 12px 22px rgba(10, 31, 71, 0.3);
}
.tp.national {
  background:
    radial-gradient(120% 80% at 50% 0%, rgba(255, 230, 150, 0.22), transparent 60%),
    linear-gradient(160deg, #8a1f2c, #3e0b16);
  box-shadow: 0 6px 0 #2a0610, 0 12px 22px rgba(60, 10, 20, 0.35);
}
.tp-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
.tp-name {
  font-weight: 900;
  font-size: 15px;
  display: flex;
  align-items: center;
  gap: 4px;
  color: #ffd36b;
}
.link {
  flex-shrink: 0;
  color: #fff;
  font-size: 12px;
  text-decoration: underline;
  padding: 2px 0;
}
.round {
  text-align: center;
  font-size: 22px;
  font-weight: 900;
  font-style: italic;
  margin: 6px 0 2px;
  letter-spacing: 0.1em;
}
.vs {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 6px;
}
.team {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 14px;
  padding: 8px 4px;
  min-width: 0;
}
.team.own {
  box-shadow: inset 0 0 0 2px #ffd36b;
}
.tn {
  font-weight: 900;
  font-size: 15px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}
.team :deep(small) {
  color: #fff;
}
.team > small {
  font-size: 10px;
  opacity: 0.8;
}
.vs-mark {
  font-size: 22px;
  font-weight: 900;
  font-style: italic;
  color: #ffd36b;
  text-shadow: 0 2px 0 rgba(0, 0, 0, 0.3);
}
.opp-path {
  text-align: center;
  font-size: 12px;
  opacity: 0.85;
  margin: 6px 0 8px;
}
.btns {
  display: flex;
  gap: 8px;
}
.btns button {
  flex: 1;
  padding: 11px 6px;
  white-space: nowrap;
}
.btns .main {
  flex: 1.6;
  font-size: 17px;
}
.status {
  text-align: center;
  padding: 12px 0 10px;
  display: flex;
  flex-direction: column;
}
.status b {
  font-size: 22px;
  font-style: italic;
}
.status span {
  font-size: 13px;
  opacity: 0.85;
}
.status.champ b {
  color: #ffd36b;
  font-size: 30px;
}
.status.bad b {
  color: #b8c8e0;
}
.path {
  list-style: none;
  margin: 10px 0 0;
  padding: 8px 0 0;
  border-top: 1px dashed rgba(255, 255, 255, 0.25);
  font-size: 12px;
}
.path li {
  display: grid;
  grid-template-columns: 58px 1fr auto 18px;
  gap: 6px;
  align-items: center;
  padding: 2px 0;
  opacity: 0.8;
}
.path li.won {
  opacity: 1;
}
.pr {
  font-weight: 800;
}
.po {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.ps {
  font-weight: 900;
  font-variant-numeric: tabular-nums;
}
.ps small {
  margin-left: 4px;
  font-size: 9px;
}
.pw {
  text-align: center;
  font-weight: 900;
  color: #9fb4cc;
}
.won .pw {
  color: #ffd36b;
}
</style>
