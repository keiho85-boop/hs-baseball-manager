<script setup lang="ts">
// スカウト：来年入学する県内の中学3年生を視察・勧誘する
import { computed } from 'vue'
import { useGameStore } from '@/stores/game'
import { useUiStore } from '@/stores/ui'
import { POSITION_NAME, prefName, rankOf, velocityScore } from '@/game/constants'
import { SCOUT_COST, canAct, interestLabel, knownOf, scoutAbilities, type Prospect } from '@/game/scout'
import { playerRating } from '@/game/player'
import { getSkill } from '@/game/skills'
import GameIcon from './GameIcon.vue'
import FaceIcon from './FaceIcon.vue'

defineEmits<{ close: [] }>()
const game = useGameStore()
const ui = useUiStore()

// セーブデータは自動追跡の外にあるので、変更のたびに写しを作って画面に知らせる
const scout = computed(() => {
  void game.rev
  const s = game.save?.scout
  return s ? { ...s, prospects: s.prospects.map((p) => ({ ...p })) } : null
})
const funds = computed(() => {
  void game.rev
  return game.ownSchool()?.funds ?? 0
})
const pref = computed(() => prefName(game.save?.prefCode ?? 0))
const canVisit = computed(() => {
  void game.rev
  return !!game.save && canAct(game.save, 'visit')
})
const canRecruit = computed(() => {
  void game.rev
  return !!game.save && canAct(game.save, 'recruit')
})

const BATS = { R: '右打', L: '左打', S: '両打' } as const
const THROWS = { R: '右投', L: '左投' } as const

/** 画面に出す能力：分かったものだけランク・数値を出す */
function abilities(pr: Prospect): { label: string; rank: string | null; value: string | null }[] {
  const k = knownOf(pr)
  return scoutAbilities(pr.player).map((a) => ({
    label: a.label,
    rank: k.rank.includes(a.key) ? rankOf(a.score) : null,
    value: k.value.includes(a.key) ? a.raw : null,
  }))
}

/** 特殊能力：数が分かっていれば枠を出し、名前の分かったものだけ表示する */
function skillSlots(pr: Prospect): { name: string; good: boolean | null }[] | null {
  const k = knownOf(pr)
  if (!k.skillCount) return null
  return pr.player.skills.map((id) => {
    if (!k.skills.includes(id)) return { name: '？？？', good: null }
    const sk = getSkill(id)
    return { name: sk?.name ?? '？', good: sk?.good ?? true }
  })
}

const overall = (pr: Prospect) => rankOf(playerRating(pr.player))

async function act(kind: 'visit' | 'recruit', pr: Prospect): Promise<void> {
  const before = pr.interest
  const r = await game.scoutAction(kind, pr.id)
  if (!r) {
    ui.notify({ message: kind === 'visit' ? 'これ以上は視察できません' : '部費か活動回数が足りません', tone: 'warn' })
    return
  }
  if (typeof r === 'string') {
    const now = game.save?.scout?.prospects.find((x) => x.id === pr.id)?.interest ?? before
    ui.notify({
      title: '勧誘した！',
      icon: 'heart',
      message: `${pr.player.surname}の関心が上がった`,
      highlight: { label: '関心', value: interestLabel(now) },
    })
    return
  }
  ui.notify({
    title: r.done ? '視察完了！' : '視察で判明！',
    icon: 'search',
    tone: 'info',
    message: r.done ? `${r.name}のことはすべて分かった` : `${r.name}を視察した`,
    highlight: { label: r.label, value: r.value, rank: r.rank && r.value === r.rank ? r.rank : undefined },
  })
}
const costLabel = (kind: 'visit' | 'recruit') =>
  (scout.value?.points ?? 0) > 0 ? '1回' : `${kind === 'visit' ? SCOUT_COST.visitFunds : SCOUT_COST.recruitFunds}万円`
</script>

<template>
  <div class="sc-backdrop" @click.self="$emit('close')">
    <div class="sc card">
      <h2><GameIcon name="search" /> スカウト（{{ pref }}の中学3年生）</h2>
      <div v-if="scout" class="status">
        <span>活動 <b>残り{{ scout.points }}回</b></span>
        <span>部費 <b>{{ funds }}万円</b></span>
      </div>
      <p class="muted note">
        最初は総合評価だけが分かります。視察するたびに能力のランクや数値、特殊能力が1つずつ判明し、勧誘で関心が上がります。回数がないときは部費を使います（視察{{ SCOUT_COST.visitFunds }}万・勧誘{{ SCOUT_COST.recruitFunds }}万）。2月に進学先が決まり、4月に入部します。回数はスカウトのマスと、毎月1回ずつ増えます。
      </p>
      <div v-if="scout" class="list">
        <div v-for="pr in scout.prospects" :key="pr.id" class="pr" :class="pr.status">
          <div class="pr-head">
            <FaceIcon :face="pr.player.face" :size="36" />
            <div class="pr-name">
              <b>{{ pr.player.surname }} {{ pr.player.givenName }}</b>
              <small>{{ POSITION_NAME[pr.player.mainPosition] }}・{{ THROWS[pr.player.throws] }}{{ BATS[pr.player.bats] }}</small>
            </div>
            <div class="ov"><small>総合</small><b :class="`rk-${overall(pr)}`">{{ overall(pr) }}</b></div>
            <span v-if="pr.status === 'own'" class="badge own">入学決定</span>
            <span v-else-if="pr.status === 'other'" class="badge other">{{ pr.otherSchool }}へ</span>
          </div>
          <div class="pr-ab">
            <div v-for="a in abilities(pr)" :key="a.label">
              <small>{{ a.label }}</small>
              <b v-if="a.rank" :class="`rk-${a.rank}`">{{ a.rank }}<i>{{ a.value ?? '' }}</i></b>
              <b v-else class="unk">？</b>
            </div>
          </div>
          <div class="pr-sk">
            <span class="sk-l">特殊能力</span>
            <template v-if="skillSlots(pr)">
              <span v-for="(sk, i) in skillSlots(pr)" :key="i" :class="sk.good === null ? 'unk' : sk.good ? 'good' : 'bad'">{{ sk.name }}</span>
              <span v-if="skillSlots(pr)!.length === 0" class="none">なし</span>
            </template>
            <span v-else class="unk">？個</span>
          </div>
          <div class="pr-int">
            <span class="lbl">関心</span>
            <span class="bar"><i :style="{ width: `${pr.interest}%` }" :class="{ hot: pr.interest >= 65 }" /></span>
            <span class="val">{{ interestLabel(pr.interest) }}</span>
          </div>
          <div v-if="pr.status === 'open'" class="pr-btns">
            <button class="secondary" :disabled="pr.level >= 2 || !canVisit || game.busy" @click="act('visit', pr)">
              {{ pr.level >= 2 ? '視察完了' : `視察（${costLabel('visit')}）` }}
            </button>
            <button :disabled="!canRecruit || pr.interest >= 100 || game.busy" @click="act('recruit', pr)">勧誘（{{ costLabel('recruit') }}）</button>
          </div>
        </div>
      </div>
      <button class="secondary full" @click="$emit('close')">閉じる</button>
    </div>
  </div>
</template>

<style scoped>
.sc-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(10, 30, 60, 0.45);
  z-index: 60;
  display: flex;
  align-items: flex-end;
}
.sc {
  width: 100%;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  margin: 0;
  border-radius: 20px 20px 0 0;
  padding-bottom: calc(14px + var(--safe-bottom));
}
.status {
  display: flex;
  gap: 14px;
  font-size: 13px;
  font-weight: 700;
}
.status b {
  color: var(--orange);
}
.note {
  font-size: 11px;
  margin: 4px 0 8px;
}
.list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  margin-bottom: 10px;
}
.pr {
  border-radius: 12px;
  box-shadow: inset 0 0 0 1.5px #e2eef8;
  padding: 8px;
  margin-bottom: 8px;
}
.pr.own {
  background: #fff8e0;
  box-shadow: inset 0 0 0 2px #f2c94c;
}
.pr.other {
  opacity: 0.55;
}
.pr-head {
  display: flex;
  align-items: center;
  gap: 8px;
}
.pr-name {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.pr-name b {
  font-size: 15px;
}
.pr-name small {
  font-size: 11px;
  color: var(--ink-soft);
}
.ov {
  display: flex;
  flex-direction: column;
  align-items: center;
  line-height: 1;
}
.ov small {
  font-size: 9px;
  font-weight: 800;
  color: var(--ink-soft);
}
.ov b {
  font-size: 26px;
  font-weight: 900;
  font-style: italic;
}
.badge {
  font-size: 11px;
  font-weight: 900;
  border-radius: 999px;
  padding: 2px 8px;
  white-space: nowrap;
}
.badge.own {
  background: #ffd36b;
  color: #5a3a00;
}
.badge.other {
  background: #e6ebf2;
  color: #4f5b6b;
}
.pr-ab {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 3px;
  margin-top: 6px;
}
.pr-ab div {
  display: flex;
  flex-direction: column;
  align-items: center;
  background: #f2f6fb;
  border-radius: 7px;
  padding: 2px 0;
}
.pr-ab small {
  font-size: 10px;
  color: var(--ink-soft);
  font-weight: 800;
}
.pr-ab b {
  font-size: 16px;
  font-style: italic;
  font-weight: 900;
}
.pr-ab b i {
  font-style: normal;
  font-size: 11px;
  color: var(--ink);
  margin-left: 2px;
}
.pr-ab .unk {
  color: #b0bccb;
  font-style: normal;
}
.pr-sk {
  display: flex;
  flex-wrap: wrap;
  gap: 3px;
  margin-top: 5px;
}
.pr-sk span {
  font-size: 10px;
  font-weight: 900;
  border-radius: 999px;
  padding: 1px 7px;
}
.pr-sk .good {
  background: #fff1c2;
  color: #8a5a00;
}
.pr-sk {
  align-items: center;
}
.sk-l {
  font-size: 10px !important;
  color: var(--ink-soft);
  padding: 0 !important;
}
.pr-sk .unk {
  background: #eef2f7;
  color: #9aa7b8;
}
.pr-sk .none {
  color: var(--ink-soft);
}
.pr-sk .bad {
  background: #e6ebf2;
  color: #4f5b6b;
}
.pr-int {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 6px;
  font-size: 12px;
  font-weight: 800;
}
.lbl {
  color: var(--ink-soft);
}
.bar {
  flex: 1;
  height: 8px;
  border-radius: 9px;
  background: #e6ebf2;
  overflow: hidden;
}
.bar i {
  display: block;
  height: 100%;
  background: linear-gradient(90deg, #7cc8ff, #3aa8f0);
}
.bar i.hot {
  background: linear-gradient(90deg, #ffb35c, #f07a1a);
}
.val {
  width: 66px;
  text-align: right;
}
.pr-btns {
  display: flex;
  gap: 6px;
  margin-top: 6px;
}
.pr-btns button {
  flex: 1;
  padding: 8px 4px;
  font-size: 13px;
}
</style>
