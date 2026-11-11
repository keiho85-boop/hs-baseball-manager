<script setup lang="ts">
// タイトル画面から開く：プロ入りした育成選手の一覧と、育成選手だけで組むドリームチームのオーダー
// （ドリームチームでの大会は、のちに追加する）
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import GameIcon from '@/components/GameIcon.vue'
import RankBadge from '@/components/RankBadge.vue'
import AbilityBar from '@/components/AbilityBar.vue'
import { PITCH_NAME, velocityScore } from '@/game/constants'
import { getSkill } from '@/game/skills'
import type { Player, Position } from '@/game/types'
import {
  autoDreamTeam,
  DREAM_POSITIONS,
  listSavedPlayers,
  loadDreamTeam,
  saveDreamTeam,
  savedUid,
  type DreamPos,
  type DreamTeam,
  type SavedPlayer,
} from '@/game/success/archive'

const router = useRouter()
const BASE = import.meta.env.BASE_URL

const tab = ref<'list' | 'dream'>('list')
const saved = ref<SavedPlayer[]>(listSavedPlayers().sort((a, b) => b.rating - a.rating))
const byUid = computed(() => new Map(saved.value.map((x) => [savedUid(x), x])))
const open = ref<string | null>(null)

/** 守備位置の名前（育成選手の外野はひとまとめ。ドリームチームの打順では左・中・右を分ける） */
const POS_NAME: Record<Position, string> = { P: '投手', C: '捕手', '1B': '一塁手', '2B': '二塁手', '3B': '三塁手', SS: '遊撃手', LF: '外野手', CF: '外野手', RF: '外野手' }
const DREAM_LABEL: Record<DreamPos, string> = { C: '捕', '1B': '一', '2B': '二', '3B': '三', SS: '遊', LF: '左', CF: '中', RF: '右', DH: '指' }

function dateLabel(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`
}
function skillsOf(p: Player): { name: string; good: boolean }[] {
  return p.skills
    .map((id) => getSkill(id))
    .filter((x): x is NonNullable<typeof x> => !!x)
    .map((x) => ({ name: x.name, good: x.good }))
}

// ---------------------------------------------------------------- ドリームチーム
const dream = ref<DreamTeam>(loadDreamTeam())
// 消えた選手（保存データを消した等）は空きにする
dream.value.order.forEach((o) => {
  if (o.uid && !byUid.value.has(o.uid)) o.uid = null
})
if (dream.value.pitcher && !byUid.value.has(dream.value.pitcher)) dream.value.pitcher = null

function persist(): void {
  saveDreamTeam(JSON.parse(JSON.stringify(dream.value)) as DreamTeam)
}
const usedUids = computed(() => new Set([...dream.value.order.map((o) => o.uid), dream.value.pitcher].filter((x): x is string => !!x)))

/** 打順の枠をタップ → 選手を選ぶ */
const picking = ref<{ kind: 'bat'; index: number } | { kind: 'pitch' } | null>(null)
const pickList = computed(() => {
  const pk = picking.value
  if (!pk) return []
  const current = pk.kind === 'bat' ? dream.value.order[pk.index]?.uid : dream.value.pitcher
  return saved.value.map((x) => ({ x, uid: savedUid(x), used: usedUids.value.has(savedUid(x)) && savedUid(x) !== current }))
})
function choose(uid: string | null): void {
  const pk = picking.value
  if (!pk) return
  if (pk.kind === 'bat') dream.value.order[pk.index]!.uid = uid
  else dream.value.pitcher = uid
  picking.value = null
  persist()
}
/** 守備位置をタップすると、次の位置に変わる（重なった位置は相手と入れ替える） */
function cyclePos(i: number): void {
  const o = dream.value.order[i]!
  const next = DREAM_POSITIONS[(DREAM_POSITIONS.indexOf(o.pos) + 1) % DREAM_POSITIONS.length]!
  const other = dream.value.order.find((x, k) => k !== i && x.pos === next)
  if (other) other.pos = o.pos
  o.pos = next
  persist()
}
/** 打順を1つ上へ */
function moveUp(i: number): void {
  if (i === 0) return
  const o = dream.value.order
  ;[o[i - 1], o[i]] = [o[i]!, o[i - 1]!]
  persist()
}
function auto(): void {
  dream.value = autoDreamTeam(saved.value)
  persist()
}
const filled = computed(() => dream.value.order.filter((o) => o.uid).length + (dream.value.pitcher ? 1 : 0))
function brief(x: SavedPlayer | undefined): string {
  if (!x) return ''
  const p = x.player
  if (p.mainPosition === 'P') return `${p.pitching.velocity}km`
  return `ミ${p.batting.contact} パ${p.batting.power} 走${p.running.speed}`
}
</script>

<template>
  <div class="pros">
    <header class="ph">
      <button class="plain back" aria-label="タイトルに戻る" @click="router.replace({ name: 'title' })"><GameIcon name="back" :size="20" /></button>
      <h1>プロ入りした育成選手</h1>
    </header>
    <div class="tabs">
      <button :class="{ on: tab === 'list' }" @click="tab = 'list'">選手一覧<small>{{ saved.length }}人</small></button>
      <button :class="{ on: tab === 'dream' }" @click="tab = 'dream'">ドリームチーム</button>
    </div>

    <p v-if="saved.length === 0" class="empty">
      まだプロ入りした選手はいません。<br />選手育成モードで、ドラフト指名を目指しましょう。
    </p>

    <!-- 選手一覧 -->
    <template v-else-if="tab === 'list'">
      <div v-for="x in saved" :key="savedUid(x)" class="card pcard" @click="open = open === savedUid(x) ? null : savedUid(x)">
        <div class="pc-top">
          <img :src="`${BASE}icon/icon_focus.webp`" alt="" />
          <div class="pc-main">
            <b>{{ x.player.surname }} {{ x.player.givenName }}</b>
            <span class="muted">{{ POS_NAME[x.player.mainPosition] }}・{{ x.team }} {{ x.round }}位</span>
            <small class="muted">第{{ x.scenario }}章でプロ入り（{{ dateLabel(x.savedAt) }}）</small>
          </div>
          <RankBadge :value="x.rating" />
        </div>
        <div v-if="open === savedUid(x)" class="pc-detail">
          <template v-if="x.player.mainPosition === 'P'">
            <AbilityBar label="球速" :value="velocityScore(x.player.pitching.velocity)" :display="`${x.player.pitching.velocity}km/h`" />
            <AbilityBar label="コントロール" :value="x.player.pitching.control" />
            <AbilityBar label="スタミナ" :value="x.player.pitching.stamina" />
            <AbilityBar label="キレ" :value="x.player.pitching.kire" />
            <div class="pitches">
              <span v-for="pt in x.player.pitching.pitches" :key="pt.type">{{ PITCH_NAME[pt.type] }} {{ pt.level }}</span>
            </div>
          </template>
          <AbilityBar label="ミート" :value="x.player.batting.contact" />
          <AbilityBar label="パワー" :value="x.player.batting.power" />
          <AbilityBar label="走力" :value="x.player.running.speed" />
          <AbilityBar label="肩力" :value="x.player.fielding.arm" />
          <AbilityBar label="守備" :value="x.player.fielding.range" />
          <AbilityBar label="捕球" :value="x.player.fielding.catching" />
          <div class="skills">
            <span v-for="sk in skillsOf(x.player)" :key="sk.name" class="sk" :class="sk.good ? 'good' : 'bad'">{{ sk.name }}</span>
            <span v-if="skillsOf(x.player).length === 0" class="muted">特殊能力なし</span>
          </div>
        </div>
      </div>
    </template>

    <!-- ドリームチーム -->
    <template v-else>
      <div class="card dream">
        <div class="d-head">
          <span>オーダー <b>{{ filled }}</b>/10人</span>
          <button class="sky" @click="auto">おまかせ</button>
        </div>
        <div v-for="(o, i) in dream.order" :key="i" class="d-row">
          <span class="no">{{ i + 1 }}</span>
          <button class="pos" @click="cyclePos(i)">{{ DREAM_LABEL[o.pos] }}</button>
          <button class="who" @click="picking = { kind: 'bat', index: i }">
            <template v-if="o.uid && byUid.get(o.uid)">
              <b>{{ byUid.get(o.uid)!.player.surname }}</b>
              <small>{{ brief(byUid.get(o.uid)) }}</small>
            </template>
            <span v-else class="muted">選手を選ぶ</span>
          </button>
          <button class="up" :disabled="i === 0" aria-label="打順を上げる" @click="moveUp(i)">▲</button>
        </div>
        <div class="d-row pitcher">
          <span class="no">先</span>
          <span class="pos p">投</span>
          <button class="who" @click="picking = { kind: 'pitch' }">
            <template v-if="dream.pitcher && byUid.get(dream.pitcher)">
              <b>{{ byUid.get(dream.pitcher)!.player.surname }}</b>
              <small>{{ brief(byUid.get(dream.pitcher)) }}</small>
            </template>
            <span v-else class="muted">先発投手を選ぶ</span>
          </button>
          <span class="up-sp" />
        </div>
        <p class="note">守備位置は、位置の札をタップすると変わります。ドリームチームでの大会は、今後追加します。</p>
      </div>
    </template>

    <div v-if="picking" class="pick-backdrop" @click.self="picking = null">
      <div class="card pick">
        <h2>{{ picking.kind === 'pitch' ? '先発投手' : `${picking.index + 1}番打者` }}</h2>
        <button v-for="c in pickList" :key="c.uid" class="pk" :disabled="c.used" @click="choose(c.uid)">
          <img :src="`${BASE}icon/icon_focus.webp`" alt="" />
          <span class="pk-main">
            <b>{{ c.x.player.surname }} {{ c.x.player.givenName }}</b>
            <small>{{ POS_NAME[c.x.player.mainPosition] }}・{{ brief(c.x) }}{{ c.used ? '（起用中）' : '' }}</small>
          </span>
          <RankBadge :value="c.x.rating" size="sm" />
        </button>
        <button class="secondary full" @click="choose(null)">空きにする</button>
        <button class="plain full" @click="picking = null">閉じる</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.pros {
  min-height: 100dvh;
  padding: calc(8px + env(safe-area-inset-top, 0px)) 12px calc(20px + var(--safe-bottom, 0px));
  background: linear-gradient(180deg, #dff0ff, #f4f9ff);
}
.ph {
  display: flex;
  align-items: center;
  gap: 6px;
}
.ph h1 {
  font-size: 18px;
  margin: 0;
}
.back {
  padding: 6px;
}
.tabs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
  margin: 10px 0;
}
.tabs button {
  padding: 10px;
  border-radius: 12px;
  background: #fff;
  color: var(--ink);
  font-weight: 900;
  box-shadow: inset 0 0 0 2px #cfe0f1;
}
.tabs button.on {
  background: var(--sky-deep, #1a6fc2);
  color: #fff;
  box-shadow: none;
}
.tabs small {
  margin-left: 4px;
  font-size: 11px;
}
.empty {
  text-align: center;
  margin-top: 40px;
  line-height: 1.8;
  color: var(--ink-soft);
}
.pcard {
  margin-bottom: 8px;
  padding: 10px;
  cursor: pointer;
}
.pc-top {
  display: flex;
  align-items: center;
  gap: 10px;
}
.pc-top img {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  background: #fff3e0;
}
.pc-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.pc-main b {
  font-size: 16px;
}
.pc-main span,
.pc-main small {
  font-size: 12px;
}
.pc-detail {
  margin-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.pitches,
.skills {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  font-size: 12px;
  margin: 2px 0;
}
.pitches span {
  background: #eaf3fc;
  border-radius: 8px;
  padding: 1px 8px;
}
.sk {
  border-radius: 999px;
  padding: 1px 8px;
  font-weight: 800;
}
.sk.good {
  background: #fff1d6;
  color: #b35a00;
}
.sk.bad {
  background: #e8eef5;
  color: #4a5b70;
}
.dream {
  padding: 10px;
}
.d-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}
.d-head button {
  padding: 6px 14px;
}
.d-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 0;
  border-bottom: 1px solid #eef3f8;
}
.d-row.pitcher {
  margin-top: 6px;
  border-top: 2px solid #ffd9b8;
}
.no {
  width: 22px;
  text-align: center;
  font-weight: 900;
  color: var(--ink-soft);
}
.pos {
  width: 34px;
  height: 34px;
  padding: 0;
  border-radius: 8px;
  font-weight: 900;
  background: #e6f0fb;
  color: #1a4f8a;
  display: flex;
  align-items: center;
  justify-content: center;
}
.pos.p {
  background: #ffe1e1;
  color: #c0392b;
}
.who {
  flex: 1;
  display: flex;
  align-items: baseline;
  gap: 6px;
  padding: 8px 10px;
  border-radius: 10px;
  background: #fff;
  color: var(--ink);
  box-shadow: inset 0 0 0 1.5px #d7e5f3;
  text-align: left;
  min-width: 0;
}
.who small {
  font-size: 11px;
  color: var(--ink-soft);
}
.up {
  width: 32px;
  height: 32px;
  padding: 0;
  border-radius: 8px;
  background: #f1f5fa;
  color: var(--ink-soft);
}
.up-sp {
  width: 32px;
}
.note {
  font-size: 11px;
  color: var(--ink-soft);
  margin: 8px 0 0;
}
.pick-backdrop {
  position: fixed;
  inset: 0;
  z-index: 80;
  background: rgba(10, 20, 40, 0.45);
  display: flex;
  align-items: flex-end;
}
.pick {
  width: 100%;
  max-height: 80dvh;
  overflow-y: auto;
  border-radius: 20px 20px 0 0;
  padding: 14px 12px calc(14px + var(--safe-bottom, 0px));
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.pick h2 {
  margin: 0 0 4px;
  font-size: 16px;
}
.pk {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 12px;
  background: #fff;
  color: var(--ink);
  box-shadow: inset 0 0 0 1.5px #d7e5f3;
  text-align: left;
}
.pk:disabled {
  opacity: 0.45;
}
.pk img {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: #fff3e0;
}
.pk-main {
  flex: 1;
  display: flex;
  flex-direction: column;
}
.pk-main small {
  font-size: 11px;
  color: var(--ink-soft);
}
</style>
