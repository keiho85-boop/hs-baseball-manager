<script setup lang="ts">
// 選手育成モード：育てている選手の専用画面（能力・特殊能力・まわりの評価・ドラフトの見込み）
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useGameStore } from '@/stores/game'
import AbilityBar from '@/components/AbilityBar.vue'
import RankBadge from '@/components/RankBadge.vue'
import { PITCH_NAME, POSITION_NAME, velocityScore } from '@/game/constants'
import { fielderRating, pitcherRating, playerRating } from '@/game/player'
import { getSkill } from '@/game/skills'
import { EVAL_KEYS, EVAL_LABEL, EVAL_NOTE, evalStars, focusPlayer, successOf } from '@/game/success/state'
import type { EvalKey } from '@/game/success/types'

const game = useGameStore()
const router = useRouter()
const BASE = import.meta.env.BASE_URL

const p = computed(() => {
  void game.rev
  return game.save ? focusPlayer(game.save) : null
})
const st = computed(() => {
  void game.rev
  return game.save ? successOf(game.save) : null
})
const isPitcher = computed(() => p.value?.mainPosition === 'P')

const EVAL_ICON: Record<EvalKey, string> = {
  nagi: 'nagi',
  makabe: 'makabe',
  hasumi: 'hasumi',
  daichi: 'daichi',
  team: 'mob',
  genzo: 'genzo',
  scout: 'scout',
}
function stars(v: number): string {
  const n = evalStars(v)
  return '★'.repeat(n) + '☆'.repeat(5 - n)
}

/** 立ち絵：調子が良いと笑顔 */
const portrait = computed(() => {
  const f = p.value?.condition.form ?? 3
  const face = f >= 5 ? 'joy' : f >= 4 ? 'smile' : f <= 1 ? 'frustrated' : 'normal'
  return `${BASE}chara/focus_hs_practice_bust_${face}.webp`
})

/** 調子（やる気と調子はひとつにまとめた。1〜5） */
function formLabel(v: number): string {
  return ['', '絶不調', '不調', 'ふつう', '好調', '絶好調'][v] ?? 'ふつう'
}

/** スカウトの評価から見たドラフトの見込み */
const draft = computed(() => {
  const v = st.value?.eval.scout ?? 0
  if (v >= 80) return { label: '上位指名の有力候補', tone: 'gold' }
  if (v >= 60) return { label: '指名の可能性が高い', tone: 'good' }
  if (v >= 40) return { label: '下位指名の候補', tone: 'mid' }
  if (v >= 20) return { label: 'スカウトの目に留まり始めた', tone: 'low' }
  return { label: 'まだ名前が挙がっていない', tone: 'low' }
})
</script>

<template>
  <div v-if="p && st" class="focus-page">
    <div class="hero">
      <img class="bust" :src="portrait" alt="" />
      <div class="hero-info">
        <div class="h-pos" :class="{ pit: isPitcher }">{{ POSITION_NAME[p.mainPosition] }}</div>
        <div class="h-name">{{ p.surname }} {{ p.givenName }}</div>
        <div class="h-sub">{{ p.grade }}年・{{ p.throws === 'L' ? '左' : '右' }}投{{ p.bats === 'L' ? '左' : p.bats === 'S' ? '両' : '右' }}打</div>
        <div class="h-rank">
          <small>総合</small>
          <RankBadge :value="playerRating(p)" size="lg" />
        </div>
      </div>
    </div>

    <div class="page stack">
      <div class="card cond">
        <div class="c-item">
          <img :src="`${BASE}ui/ui_stamina.webp`" alt="" />
          <span>体力</span>
          <span class="bar"><i :style="{ width: `${p.condition.stamina}%` }" :class="{ low: p.condition.stamina < 50 }" /></span>
          <b>{{ Math.round(p.condition.stamina) }}</b>
        </div>
        <div class="c-item">
          <img :src="`${BASE}ui/ui_motivation.webp`" alt="" />
          <span>調子</span>
          <b class="mot" :class="`f${p.condition.form}`">{{ formLabel(p.condition.form) }}</b>
          <template v-if="p.condition.injury">
            <img :src="`${BASE}ui/ui_infirmary.webp`" alt="" />
            <b class="inj">ケガ</b>
          </template>
        </div>
      </div>

      <div class="card draft" :class="draft.tone">
        <img :src="`${BASE}icon/icon_scout.webp`" alt="" />
        <div>
          <small>ドラフトの見込み</small>
          <b>{{ draft.label }}</b>
        </div>
        <span class="star-s">{{ stars(st.eval.scout) }}</span>
      </div>

      <div v-if="isPitcher" class="card">
        <h2 class="red">投手能力 <span class="r"><RankBadge :value="pitcherRating(p)" size="sm" /></span></h2>
        <div class="velo">
          <span class="muted">球速</span>
          <b>{{ p.pitching.velocity }}<small>km/h</small></b>
          <RankBadge :value="velocityScore(p.pitching.velocity)" :show-value="false" />
        </div>
        <div class="abilities">
          <AbilityBar label="コントロール" :value="p.pitching.control" />
          <AbilityBar label="スタミナ" :value="p.pitching.stamina" />
          <AbilityBar label="キレ" :value="p.pitching.kire" />
          <AbilityBar label="クイック" :value="p.pitching.quick" />
          <AbilityBar label="ピンチ" :value="p.pitching.pinch" />
          <AbilityBar label="対左打者" :value="p.pitching.vsLeft" />
        </div>
        <div class="pitches">
          <span v-for="pt in p.pitching.pitches" :key="pt.type" class="pitch">{{ PITCH_NAME[pt.type] }}<b>{{ pt.level }}</b></span>
          <span v-if="!p.pitching.pitches.length" class="muted">変化球なし</span>
        </div>
      </div>

      <div class="card">
        <h2 class="orange">野手能力 <span class="r"><RankBadge :value="fielderRating(p)" size="sm" /></span></h2>
        <div class="abilities">
          <AbilityBar label="ミート" :value="p.batting.contact" />
          <AbilityBar label="パワー" :value="p.batting.power" />
          <AbilityBar label="走力" :value="p.running.speed" />
          <AbilityBar label="肩力" :value="p.fielding.arm" />
          <AbilityBar label="守備範囲" :value="p.fielding.range" />
          <AbilityBar label="捕球" :value="p.fielding.catching" />
        </div>
      </div>

      <div class="card">
        <h2 class="sun">特殊能力</h2>
        <div v-if="p.skills.length" class="skills">
          <span v-for="id in p.skills" :key="id" class="skill" :class="getSkill(id)?.good ? 'good' : 'bad'">{{ getSkill(id)?.name }}</span>
        </div>
        <p v-else class="muted">まだありません。イベントや特訓で覚えます。</p>
      </div>

      <div class="card">
        <h2 class="grass"><img class="h-icon" :src="`${BASE}ui/ui_eval.webp`" alt="" /> まわりの評価</h2>
        <div v-for="k in EVAL_KEYS" :key="k" class="ev-row">
          <img :src="`${BASE}icon/icon_${EVAL_ICON[k]}.webp`" alt="" />
          <span class="ev-name"><b>{{ EVAL_LABEL[k] }}</b><small>{{ EVAL_NOTE[k] }}</small></span>
          <span class="star-s">{{ stars(st.eval[k]) }}</span>
        </div>
      </div>

      <button class="secondary full" @click="router.push({ name: 'player', params: { id: p.id } })">くわしい能力・成績を見る</button>
    </div>
  </div>
  <div v-else class="page"><p class="muted">選手育成モードで遊んでいるときに使える画面です。</p></div>
</template>

<style scoped>
.hero {
  position: relative;
  height: 230px;
  margin-top: -18px;
  background:
    radial-gradient(80% 90% at 30% 100%, rgba(255, 255, 255, 0.5) 0%, rgba(255, 255, 255, 0) 60%),
    linear-gradient(180deg, #6cc8fb 0%, #3aa8f0 70%, #2a8fd8 100%);
  overflow: hidden;
}
.bust {
  position: absolute;
  left: -10px;
  bottom: 0;
  height: 250px;
  filter: drop-shadow(0 4px 10px rgba(10, 30, 60, 0.35));
}
.hero-info {
  position: absolute;
  right: 14px;
  top: 34px;
  width: 52%;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  color: #fff;
}
.h-pos {
  font-size: 12px;
  font-weight: 900;
  background: #1a6fc2;
  border-radius: 6px;
  padding: 1px 8px;
}
.h-pos.pit {
  background: #e53935;
}
.h-name {
  font-size: 24px;
  font-weight: 900;
  text-shadow: 0 2px 0 rgba(13, 42, 82, 0.5);
}
.h-sub {
  font-size: 12px;
  font-weight: 700;
}
.h-rank {
  margin-top: 6px;
  display: flex;
  align-items: center;
  gap: 6px;
  background: rgba(255, 255, 255, 0.92);
  color: var(--ink-soft);
  border-radius: 14px;
  padding: 4px 10px;
  font-weight: 800;
}
.cond {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.c-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 700;
}
.c-item img {
  width: 24px;
  height: 24px;
}
.c-item .bar {
  flex: 1;
  height: 8px;
  border-radius: 9px;
  background: #e2eef8;
  overflow: hidden;
}
.c-item .bar i {
  display: block;
  height: 100%;
  background: linear-gradient(90deg, #6ad66f, #2f9e3a);
}
.c-item .bar i.low {
  background: linear-gradient(90deg, #ff9f43, #e0353b);
}
.mot {
  color: #d9731f;
}
.mot.f1,
.mot.f2 {
  color: #3d6fb5;
}
.mot.f3 {
  color: #5a6a80;
}
.inj {
  color: #c62828;
}
.draft {
  display: flex;
  align-items: center;
  gap: 10px;
}
.draft img {
  width: 46px;
  height: 46px;
}
.draft div {
  flex: 1;
  display: flex;
  flex-direction: column;
}
.draft small {
  font-size: 11px;
  color: var(--ink-soft);
}
.draft b {
  font-size: 15px;
}
.draft.gold {
  background: #fff3c4;
}
.draft.good {
  background: #e8f5ea;
}
h2 {
  display: flex;
  align-items: center;
  gap: 6px;
}
h2 .r {
  margin-left: auto;
}
.h-icon {
  width: 26px;
  height: 26px;
}
.velo {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 6px;
}
.velo b {
  font-size: 24px;
}
.velo small {
  font-size: 12px;
}
.abilities {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 4px 12px;
}
.pitches {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
}
.pitch {
  background: #eaf3fc;
  border-radius: 999px;
  padding: 2px 10px;
  font-size: 12px;
  font-weight: 700;
}
.pitch b {
  margin-left: 4px;
  color: #1a6fc2;
}
.skills {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.skill {
  border-radius: 999px;
  padding: 3px 12px;
  font-size: 13px;
  font-weight: 800;
}
.skill.good {
  background: #e3f0ff;
  color: #1a6fc2;
}
.skill.bad {
  background: #ffe9e9;
  color: #c62828;
}
.ev-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 4px 0;
  border-bottom: 1px dashed #e2eef8;
}
.ev-row img {
  width: 38px;
  height: 38px;
}
.ev-name {
  flex: 1;
  display: flex;
  flex-direction: column;
}
.ev-name small {
  font-size: 11px;
  color: var(--ink-soft);
}
.star-s {
  color: var(--gold);
  letter-spacing: 1px;
  white-space: nowrap;
}
</style>
