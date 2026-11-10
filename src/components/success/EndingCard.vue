<script setup lang="ts">
// 選手育成モード：シナリオの結末（ドラフト結果・育てた選手のカード・評価・3年間の成績）
import { computed, onMounted, ref } from 'vue'
import { useGameStore } from '@/stores/game'
import RankBadge from '@/components/RankBadge.vue'
import { POSITION_NAME, rankOf, velocityScore } from '@/game/constants'
import { playerRating } from '@/game/player'
import { getSkill } from '@/game/skills'
import { EVAL_KEYS, EVAL_LABEL, evalStars, focusPlayer, successOf } from '@/game/success/state'
import type { EvalKey } from '@/game/success/types'
import { play } from '@/sound'

const emit = defineEmits<{ title: [] }>()
const game = useGameStore()
const BASE = import.meta.env.BASE_URL

const f = computed(() => (game.save ? focusPlayer(game.save) : null))
const st = computed(() => (game.save ? successOf(game.save) : null))
const pro = computed(() => st.value?.ended === 'pro')
const drafted = computed(() => f.value?.drafted ?? null)
const dating = computed(() => st.value?.dating !== null && st.value?.dating !== undefined)
const history = computed(() => game.ownSchool()?.history ?? [])

const EVAL_ICON: Record<EvalKey, string> = {
  nagi: 'nagi',
  makabe: 'makabe',
  hasumi: 'hasumi',
  daichi: 'daichi',
  team: 'mob',
  genzo: 'genzo',
  scout: 'scout',
}

const abilities = computed(() => {
  const p = f.value
  if (!p) return []
  if (p.mainPosition === 'P') {
    const breaking = p.pitching.pitches.reduce((a, x) => a + x.level, 0)
    return [
      { k: '球速', v: `${p.pitching.velocity}km`, r: rankOf(velocityScore(p.pitching.velocity)) },
      { k: 'コントロール', v: String(p.pitching.control), r: rankOf(p.pitching.control) },
      { k: 'スタミナ', v: String(p.pitching.stamina), r: rankOf(p.pitching.stamina) },
      { k: 'キレ', v: String(p.pitching.kire), r: rankOf(p.pitching.kire) },
      { k: 'ピンチ', v: String(p.pitching.pinch), r: rankOf(p.pitching.pinch) },
      { k: '変化球', v: `合計${breaking}`, r: '' },
    ]
  }
  return [
    { k: 'ミート', v: String(p.batting.contact), r: rankOf(p.batting.contact) },
    { k: 'パワー', v: String(p.batting.power), r: rankOf(p.batting.power) },
    { k: '走力', v: String(p.running.speed), r: rankOf(p.running.speed) },
    { k: '肩力', v: String(p.fielding.arm), r: rankOf(p.fielding.arm) },
    { k: '守備', v: String(p.fielding.range), r: rankOf(p.fielding.range) },
    { k: '捕球', v: String(p.fielding.catching), r: rankOf(p.fielding.catching) },
  ]
})

/** 順に見せる（タップで次へ） */
const stage = ref(0)
function next(): void {
  if (stage.value < 3) {
    stage.value += 1
    play(stage.value === 1 ? 'cheer' : 'catch')
  }
}
onMounted(() => play(pro.value ? 'win' : 'lose'))

function stars(v: number): string {
  const n = evalStars(v)
  return '★'.repeat(n) + '☆'.repeat(5 - n)
}
</script>

<template>
  <div v-if="f && st" class="ending" :class="{ pro }" @click="next">
    <div class="bg" :style="{ backgroundImage: `url(${BASE}${pro ? 'ev/ev_c1_draft' : 'bg/bg_ground_sunset'}.webp)` }" />
    <div class="shade" />
    <div v-if="pro" class="confetti" aria-hidden="true">
      <i v-for="n in 36" :key="n" :style="{ left: `${(n * 37) % 100}%`, animationDelay: `${(n % 9) * 0.35}s`, background: ['#ffd34d', '#ff6b6b', '#4dabf7', '#51cf66', '#f783ac'][n % 5] }" />
    </div>

    <div class="content">
      <div class="clear">
        <small>第1章　ナギ現役編</small>
        <b>{{ pro ? 'CLEAR' : 'END' }}</b>
      </div>

      <div class="headline">
        <template v-if="drafted">
          <span class="team">{{ drafted.team }}</span>
          <span class="round">ドラフト{{ drafted.round }}位指名！</span>
        </template>
        <span v-else class="round fail">指名はなかった…</span>
      </div>

      <Transition name="pop">
        <div v-if="stage >= 1" class="pcard">
          <div class="pc-top">
            <img :src="`${BASE}icon/icon_focus.webp`" alt="" />
            <div class="pc-name">
              <small>{{ POSITION_NAME[f.mainPosition] }}・七海東高校</small>
              <b>{{ f.surname }} {{ f.givenName }}</b>
            </div>
            <div class="pc-rank">
              <small>総合</small>
              <RankBadge :value="playerRating(f)" size="lg" />
            </div>
          </div>
          <div class="pc-ab">
            <div v-for="a in abilities" :key="a.k">
              <small>{{ a.k }}</small>
              <b :class="a.r ? `rk-${a.r}` : ''">{{ a.r }}<i>{{ a.v }}</i></b>
            </div>
          </div>
          <div v-if="f.skills.length" class="pc-skills">
            <span v-for="id in f.skills" :key="id" :class="getSkill(id)?.good ? 'good' : 'bad'">{{ getSkill(id)?.name }}</span>
          </div>
        </div>
      </Transition>

      <Transition name="pop">
        <div v-if="stage >= 2" class="evals">
          <div v-for="k in EVAL_KEYS" :key="k" class="ev">
            <img :src="`${BASE}icon/icon_${EVAL_ICON[k]}.webp`" :alt="EVAL_LABEL[k]" />
            <span>{{ stars(st.eval[k]) }}</span>
          </div>
        </div>
      </Transition>

      <Transition name="pop">
        <div v-if="stage >= 3" class="summary">
          <div v-for="h in history" :key="h.year" class="hist">
            <b>{{ h.year }}年目</b>
            <span v-for="(r, i) in h.results" :key="i" :class="{ gold: r.includes('全国') || r.includes('優勝') }">{{ r }}</span>
          </div>
          <div v-if="dating" class="love">
            <img :src="`${BASE}ev/ev_c1_confess.webp`" alt="" />
            <span>大地と、これからも一緒に</span>
          </div>
          <p class="save-note">{{ pro ? 'この選手は保存されました。第2章「ナギ大学編」が解禁されました。' : 'この選手は保存されません。もう一度、最初から育ててみましょう。' }}</p>
          <button class="sun full" @click.stop="emit('title')">タイトルへ</button>
        </div>
      </Transition>

      <div v-if="stage < 3" class="tap">TAP</div>
    </div>
  </div>
</template>

<style scoped>
.ending {
  position: fixed;
  inset: 0;
  z-index: 85;
  overflow-y: auto;
  color: #fff;
  cursor: pointer;
}
.bg {
  position: fixed;
  inset: 0;
  background-size: cover;
  background-position: center;
  animation: zoom 12s ease-out both;
}
.shade {
  position: fixed;
  inset: 0;
  background: linear-gradient(180deg, rgba(8, 20, 40, 0.15) 0%, rgba(8, 20, 40, 0.55) 40%, rgba(8, 20, 40, 0.85) 100%);
}
.ending:not(.pro) .shade {
  background: rgba(8, 20, 40, 0.65);
}
@keyframes zoom {
  from {
    transform: scale(1.12);
  }
}
.confetti {
  position: fixed;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
}
.confetti i {
  position: absolute;
  top: -20px;
  width: 8px;
  height: 14px;
  border-radius: 2px;
  animation: fall 3.2s linear infinite;
}
@keyframes fall {
  to {
    transform: translateY(110vh) rotate(720deg);
  }
}
.content {
  position: relative;
  min-height: 100%;
  padding: calc(env(safe-area-inset-top, 0px) + 18px) 14px calc(env(safe-area-inset-bottom, 0px) + 24px);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}
.clear {
  display: flex;
  flex-direction: column;
  align-items: center;
  animation: drop 0.8s cubic-bezier(0.2, 1.4, 0.4, 1) both;
}
.clear small {
  font-size: 13px;
  font-weight: 900;
  letter-spacing: 0.2em;
  color: #ffe08a;
}
.clear b {
  font-size: 54px;
  font-weight: 900;
  letter-spacing: 0.16em;
  background: linear-gradient(180deg, #fff8d6, #ffd34d 50%, #f08a1c);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  -webkit-text-stroke: 2px #0d2a52;
  paint-order: stroke fill;
  filter: drop-shadow(0 4px 0 #0d2a52);
}
.ending:not(.pro) .clear b {
  background: linear-gradient(180deg, #ffffff, #b8c7dc);
  -webkit-background-clip: text;
  background-clip: text;
}
@keyframes drop {
  from {
    opacity: 0;
    transform: translateY(-30px) scale(0.85);
  }
}
.headline {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-shadow: 0 2px 6px rgba(0, 0, 0, 0.6);
  animation: drop 0.8s 0.3s cubic-bezier(0.2, 1.4, 0.4, 1) both;
}
.team {
  font-size: 16px;
  font-weight: 900;
}
.round {
  font-size: 28px;
  font-weight: 900;
  color: #ffd34d;
}
.round.fail {
  color: #dce6f2;
  font-size: 22px;
}
.pcard {
  width: 100%;
  max-width: 420px;
  background: #fff;
  color: var(--ink);
  border-radius: 20px;
  border: 4px solid #ffc93c;
  box-shadow: 0 0 0 4px rgba(255, 201, 60, 0.35), 0 10px 30px rgba(0, 0, 0, 0.4);
  padding: 12px;
}
.pc-top {
  display: flex;
  align-items: center;
  gap: 10px;
}
.pc-top img {
  width: 58px;
  height: 58px;
}
.pc-name {
  flex: 1;
  display: flex;
  flex-direction: column;
}
.pc-name small {
  font-size: 11px;
  color: var(--ink-soft);
  font-weight: 700;
}
.pc-name b {
  font-size: 20px;
}
.pc-rank {
  display: flex;
  flex-direction: column;
  align-items: center;
  font-size: 10px;
  color: var(--ink-soft);
}
.pc-ab {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
  margin-top: 10px;
}
.pc-ab div {
  background: #f3f8fc;
  border-radius: 10px;
  padding: 4px 6px;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.pc-ab small {
  font-size: 10px;
  color: var(--ink-soft);
}
.pc-ab b {
  font-size: 18px;
}
.pc-ab i {
  font-style: normal;
  font-size: 11px;
  margin-left: 2px;
  color: var(--ink-soft);
}
.pc-skills {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  margin-top: 8px;
}
.pc-skills span {
  border-radius: 999px;
  padding: 2px 10px;
  font-size: 12px;
  font-weight: 800;
}
.pc-skills .good {
  background: #e3f0ff;
  color: #1a6fc2;
}
.pc-skills .bad {
  background: #ffe9e9;
  color: #c62828;
}
.evals {
  width: 100%;
  max-width: 420px;
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 4px;
  background: rgba(255, 255, 255, 0.92);
  border-radius: 16px;
  padding: 8px 4px;
}
.ev {
  display: flex;
  flex-direction: column;
  align-items: center;
}
.ev img {
  width: 40px;
  height: 40px;
}
.ev span {
  font-size: 8px;
  color: #d99400;
  letter-spacing: -1px;
}
.summary {
  width: 100%;
  max-width: 420px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.hist {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  background: rgba(255, 255, 255, 0.12);
  border-radius: 12px;
  padding: 6px 10px;
  font-size: 12px;
}
.hist span {
  background: rgba(255, 255, 255, 0.85);
  color: var(--ink);
  border-radius: 999px;
  padding: 1px 8px;
  font-weight: 700;
}
.hist span.gold {
  background: #ffd34d;
}
.love {
  position: relative;
  border-radius: 16px;
  overflow: hidden;
  border: 3px solid #f7a8c4;
}
.love img {
  display: block;
  width: 100%;
}
.love span {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 6px 10px;
  font-weight: 900;
  background: linear-gradient(180deg, rgba(0, 0, 0, 0), rgba(194, 24, 91, 0.75));
}
.save-note {
  margin: 0;
  font-size: 12px;
  text-align: center;
}
.tap {
  margin-top: auto;
  font-weight: 900;
  letter-spacing: 0.3em;
  animation: blink 1.4s ease-in-out infinite;
}
@keyframes blink {
  50% {
    opacity: 0.3;
  }
}
.pop-enter-active {
  transition: opacity 0.35s ease, transform 0.45s cubic-bezier(0.2, 1.4, 0.4, 1);
}
.pop-enter-from {
  opacity: 0;
  transform: scale(0.85) translateY(16px);
}
</style>
