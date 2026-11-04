<script setup lang="ts">
// 選手の能力をその場で確認するシート（イベント中や特訓の選手選びで使う）
import { computed } from 'vue'
import { useGameStore } from '@/stores/game'
import { APTITUDE_LABEL, PITCH_NAME, POSITIONS, POSITION_LABEL, POSITION_NAME, velocityScore } from '@/game/constants'
import { fielderRating, pitcherRating } from '@/game/player'
import { getSkill } from '@/game/skills'
import AbilityBar from './AbilityBar.vue'
import FaceIcon from './FaceIcon.vue'
import RankBadge from './RankBadge.vue'
import GameIcon from './GameIcon.vue'

const props = defineProps<{ playerId: string }>()
const emit = defineEmits<{ close: [] }>()
const game = useGameStore()
const p = computed(() => game.player(props.playerId))

const BATS = { R: '右打', L: '左打', S: '両打' } as const
const THROWS = { R: '右投', L: '左投' } as const
const FORM = ['', '絶不調', '不調', '普通', '好調', '絶好調']
</script>

<template>
  <div class="ps-backdrop" @click.self="emit('close')">
    <div v-if="p" class="ps card">
      <div class="head">
        <FaceIcon :face="p.face" :size="58" />
        <div class="who">
          <div class="name">{{ p.surname }} {{ p.givenName }}</div>
          <div class="muted">{{ p.grade }}年・{{ POSITION_NAME[p.mainPosition] }}・{{ THROWS[p.throws] }}{{ BATS[p.bats] }}</div>
          <div class="muted">見立て：{{ p.estimate }} ／ 調子：{{ FORM[p.condition.form] }} ／ 体力{{ p.condition.stamina }}</div>
          <div v-if="p.condition.injury" class="bad">ケガ：{{ p.condition.injury.name }}（あと{{ p.condition.injury.weeksLeft }}週）</div>
          <div v-if="p.condition.armIssue" class="bad">{{ p.condition.armIssue.part === 'shoulder' ? '肩' : '肘' }}の不安あり</div>
        </div>
        <button class="plain close" aria-label="閉じる" @click="emit('close')">✕</button>
      </div>

      <div class="sec-title orange"><GameIcon name="bat" :size="15" /> 野手 <RankBadge :value="fielderRating(p)" size="sm" /></div>
      <div class="grid">
        <AbilityBar label="ミート" :value="p.batting.contact" />
        <AbilityBar label="パワー" :value="p.batting.power" />
        <AbilityBar label="選球眼" :value="p.batting.eye" />
        <AbilityBar label="走力" :value="p.running.speed" />
        <AbilityBar label="肩力" :value="p.fielding.arm" />
        <AbilityBar label="守備範囲" :value="p.fielding.range" />
        <AbilityBar label="捕球" :value="p.fielding.catching" />
        <AbilityBar label="送球" :value="p.fielding.throwing" />
      </div>
      <div class="apt">
        <span v-for="pos in POSITIONS" :key="pos" :class="`a${p.fielding.aptitude[pos]}`">{{ POSITION_LABEL[pos] }}<b>{{ APTITUDE_LABEL[p.fielding.aptitude[pos]] }}</b></span>
      </div>

      <div class="sec-title red"><GameIcon name="flame" :size="15" /> 投手 <RankBadge :value="pitcherRating(p)" size="sm" /></div>
      <div v-if="p.pitchingRetired" class="bad">投手としては引退しています</div>
      <div class="grid">
        <AbilityBar label="球速" :value="p.pitching.velocity" :gauge="velocityScore(p.pitching.velocity)" :display="`${p.pitching.velocity}km`" />
        <AbilityBar label="コントロール" :value="p.pitching.control" />
        <AbilityBar label="スタミナ" :value="p.pitching.stamina" />
        <AbilityBar label="キレ" :value="p.pitching.kire" />
      </div>
      <div class="pitches">
        <span v-for="pt in p.pitching.pitches" :key="pt.type" class="pill">{{ PITCH_NAME[pt.type] }} {{ pt.level }}</span>
        <span v-if="p.pitching.pitches.length === 0" class="muted">変化球なし</span>
      </div>

      <div v-if="p.skills.length" class="skills">
        <span v-for="id in p.skills" :key="id" class="pill" :class="getSkill(id)?.good ? 'good' : 'bad'">{{ getSkill(id)?.name }}</span>
      </div>
      <button class="secondary full" @click="emit('close')">閉じる</button>
    </div>
  </div>
</template>

<style scoped>
.ps-backdrop {
  position: fixed;
  inset: 0;
  z-index: 85;
  background: rgba(10, 25, 45, 0.5);
  display: flex;
  align-items: flex-end;
}
.ps {
  width: 100%;
  max-width: 640px;
  margin: 0 auto;
  max-height: 86vh;
  overflow-y: auto;
  border-radius: 20px 20px 0 0;
  padding-bottom: calc(14px + var(--safe-bottom));
  animation: float-up 0.25s ease-out;
}
.head {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  margin-bottom: 6px;
}
.who {
  flex: 1;
  min-width: 0;
}
.name {
  font-size: 19px;
  font-weight: 900;
}
.close {
  font-size: 18px;
  color: var(--ink-soft);
}
.sec-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 900;
  font-size: 14px;
  margin: 8px 0 2px;
}
.sec-title.orange {
  color: var(--orange);
}
.sec-title.red {
  color: var(--red);
}
.grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  column-gap: 14px;
}
.apt,
.pitches,
.skills {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 10px;
  font-size: 13px;
  font-weight: 700;
  margin: 4px 0 6px;
}
.apt .a3 b { color: var(--red); }
.apt .a2 b { color: var(--orange); }
.apt .a1 b { color: var(--blue); }
.apt .a0 { color: #b3bccb; }
.skills {
  gap: 6px;
}
.bad {
  color: var(--red);
  font-weight: 800;
  font-size: 13px;
}
</style>
