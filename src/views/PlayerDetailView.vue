<script setup lang="ts">
import GameIcon from '@/components/GameIcon.vue'
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useGameStore } from '@/stores/game'
import { useUiStore } from '@/stores/ui'
import {
  APTITUDE_LABEL,
  PITCH_NAME,
  POSITIONS,
  POSITION_LABEL,
  POSITION_NAME,
  PRACTICE_NAME,
  velocityScore,
} from '@/game/constants'
import { fielderRating, pitcherRating } from '@/game/player'
import { getSkill } from '@/game/skills'
import type { PracticeMenu, Position } from '@/game/types'
import FaceIcon from '@/components/FaceIcon.vue'
import RankBadge from '@/components/RankBadge.vue'
import AbilityBar from '@/components/AbilityBar.vue'

const props = defineProps<{ id: string }>()
const game = useGameStore()
const ui = useUiStore()
const router = useRouter()

const p = computed(() => game.player(props.id))
const isOwn = computed(() => p.value?.schoolId === game.save?.playerSchoolId)
const editing = ref(false)
const surname = ref('')
const givenName = ref('')

const BATS = { R: '右打', L: '左打', S: '両打' } as const
const THROWS = { R: '右投', L: '左投' } as const
const FORM = ['', '絶不調', '不調', '普通', '好調', '絶好調']
const FORM_ICON = ['', '⬇', '↘', '➡', '↗', '⬆']

function startEdit(): void {
  if (!p.value) return
  surname.value = p.value.surname
  givenName.value = p.value.givenName
  editing.value = true
}

async function saveName(): Promise<void> {
  if (!p.value) return
  const s = surname.value.trim().slice(0, 6)
  const g = givenName.value.trim().slice(0, 6)
  if (!s || !g) {
    await ui.alert('苗字と名前を入力してください。')
    return
  }
  p.value.surname = s
  p.value.givenName = g
  editing.value = false
  await game.commit()
  ui.showToast('名前を変更しました')
}

async function changePosition(e: Event): Promise<void> {
  const player = p.value
  if (!player) return
  const next = (e.target as HTMLSelectElement).value as Position
  if (next === player.mainPosition) return
  const ok = await ui.confirm(
    `${player.surname}の本職を「${POSITION_NAME[player.mainPosition]}」から「${POSITION_NAME[next]}」に変えますか？`,
    { okLabel: '変更する', cancelLabel: 'やめる' },
  )
  if (!ok) {
    ;(e.target as HTMLSelectElement).value = player.mainPosition
    return
  }
  player.mainPosition = next
  await game.commit()
}

async function changeMenu(e: Event): Promise<void> {
  if (!p.value) return
  p.value.practiceMenu = (e.target as HTMLSelectElement).value as PracticeMenu
  await game.commit()
  ui.showToast('練習メニューを変更しました')
}

const zoneLabel = (v: number) => (v >= 2 ? '◎' : v === 1 ? '○' : v === 0 ? '' : v === -1 ? '△' : '×')
</script>

<template>
  <div v-if="p" class="page">
    <button class="plain back" @click="router.back()"><GameIcon name="back" :size="16" /> 戻る</button>

    <div class="card profile">
      <div class="face-wrap"><FaceIcon :face="p.face" :size="84" /></div>
      <div class="info">
        <template v-if="!editing">
          <div class="name">{{ p.surname }} {{ p.givenName }}</div>
          <div class="meta">
            <span class="chip grade">{{ p.grade }}年</span>
            <span class="chip pos">{{ POSITION_NAME[p.mainPosition] }}</span>
            <span class="chip">{{ THROWS[p.throws] }}{{ BATS[p.bats] }}</span>
          </div>
          <div class="tags">
            <span v-if="p.helper" class="pill">助っ人</span>
            <span v-if="p.retired" class="pill">引退</span>
            <span v-if="p.fatherAlumniId" class="pill good">OBの息子</span>
            <span class="pill gold"><GameIcon name="search" :size="13" /> 監督の見立て：{{ p.estimate }}</span>
          </div>
          <button v-if="isOwn" class="plain small" @click="startEdit">名前を変更</button>
        </template>
        <template v-else>
          <div class="row">
            <input v-model="surname" maxlength="6" placeholder="苗字" />
            <input v-model="givenName" maxlength="6" placeholder="名前" />
          </div>
          <div class="row edit-actions">
            <button class="secondary" @click="editing = false">やめる</button>
            <button @click="saveName">決定</button>
          </div>
        </template>
      </div>
    </div>

    <div class="card">
      <h2><GameIcon name="heart" /> 状態</h2>
      <div class="cond">
        <div class="form" :class="`f${p.condition.form}`">
          <div class="form-arrow">{{ FORM_ICON[p.condition.form] }}</div>
          <div class="form-label">{{ FORM[p.condition.form] }}</div>
        </div>
        <div class="cond-bars">
          <AbilityBar label="体力" :value="p.condition.stamina" hide-rank />
          <AbilityBar label="やる気" :value="p.condition.motivation" hide-rank />
        </div>
      </div>
      <div class="grid2">
        <div>
          ケガ：<span v-if="p.condition.injury" class="bad-text">{{ p.condition.injury.name }}（あと{{ p.condition.injury.weeksLeft }}週）</span>
          <span v-else>なし</span>
        </div>
        <div v-if="p.condition.armIssue" class="bad-text">
          {{ p.condition.armIssue.part === 'shoulder' ? '肩の不安' : '肘の不安' }}あり
        </div>
      </div>
    </div>

    <div class="card">
      <h2 class="orange"><GameIcon name="bat" /> 野手能力 <span class="h-rank"><RankBadge :value="fielderRating(p)" size="sm" /></span></h2>
      <div class="abilities">
        <AbilityBar label="ミート" :value="p.batting.contact" />
        <AbilityBar label="パワー" :value="p.batting.power" />
        <AbilityBar label="選球眼" :value="p.batting.eye" />
        <AbilityBar label="対左投手" :value="p.batting.vsLeft" />
        <AbilityBar label="走力" :value="p.running.speed" />
        <AbilityBar label="盗塁" :value="p.running.steal" />
        <AbilityBar label="走塁判断" :value="p.running.baserunning" />
        <AbilityBar label="肩力" :value="p.fielding.arm" />
        <AbilityBar label="守備範囲" :value="p.fielding.range" />
        <AbilityBar label="捕球" :value="p.fielding.catching" />
        <AbilityBar label="送球" :value="p.fielding.throwing" />
        <div class="traj">
          <div class="muted">弾道</div>
          <div class="traj-icons">
            <span v-for="n in 4" :key="n" :class="{ on: n <= p.batting.trajectory }">▲</span>
          </div>
        </div>
      </div>
      <div class="sub two">
        <div>
          <div class="muted">コース別の得意・苦手</div>
          <div class="zone">
            <div v-for="(v, i) in p.batting.zone" :key="i" :class="v > 0 ? 'hot' : v < 0 ? 'cold' : ''">{{ zoneLabel(v) }}</div>
          </div>
        </div>
        <div>
          <div class="muted">守備位置の適性</div>
          <div class="apt">
            <span v-for="pos in POSITIONS" :key="pos" :class="`a${p.fielding.aptitude[pos]}`">
              {{ POSITION_LABEL[pos] }}<b>{{ APTITUDE_LABEL[p.fielding.aptitude[pos]] }}</b>
            </span>
          </div>
        </div>
      </div>
    </div>

    <div class="card">
      <h2 class="red"><GameIcon name="flame" /> 投手能力 <span class="h-rank"><RankBadge :value="pitcherRating(p)" size="sm" /></span></h2>
      <div class="velo">
        <div class="muted">球速</div>
        <div class="velo-num">{{ p.pitching.velocity }}<small>km/h</small></div>
        <RankBadge :value="velocityScore(p.pitching.velocity)" :show-value="false" size="lg" />
      </div>
      <div class="abilities">
        <AbilityBar label="コントロール" :value="p.pitching.control" />
        <AbilityBar label="スタミナ" :value="p.pitching.stamina" />
        <AbilityBar label="キレ" :value="p.pitching.kire" />
        <AbilityBar label="対左打者" :value="p.pitching.vsLeft" />
        <AbilityBar label="クイック" :value="p.pitching.quick" />
        <AbilityBar label="ピンチ" :value="p.pitching.pinch" />
      </div>
      <div class="sub">
        <div class="muted">変化球</div>
        <div v-if="p.pitching.pitches.length" class="pitches">
          <div v-for="pt in p.pitching.pitches" :key="pt.type" class="pitch">
            <span class="pitch-name">{{ PITCH_NAME[pt.type] }}</span>
            <span class="dots"><i v-for="n in 7" :key="n" :class="{ on: n <= pt.level }" /></span>
          </div>
        </div>
        <div v-else>なし</div>
      </div>
    </div>

    <div class="card">
      <h2 class="grass"><GameIcon name="muscle" /> 共通の能力</h2>
      <div class="abilities">
        <AbilityBar label="チャンス" :value="p.common.clutch" />
        <AbilityBar label="調子の安定" :value="p.common.stability" />
        <AbilityBar label="ケガしにくさ" :value="p.common.durability" />
        <AbilityBar label="回復力" :value="p.common.recovery" />
      </div>
    </div>

    <div class="card">
      <h2 class="sun"><GameIcon name="sparkle" /> 特殊能力</h2>
      <div v-if="p.skills.length" class="skills">
        <div v-for="id in p.skills" :key="id" class="skill" :class="getSkill(id)?.good ? 'good' : 'bad'">
          <div class="skill-name">{{ getSkill(id)?.name }}</div>
          <div class="skill-desc">{{ getSkill(id)?.description }}</div>
        </div>
      </div>
      <div v-else class="muted">まだ特殊能力はありません</div>
    </div>

    <div v-if="isOwn && !p.retired" class="card stack">
      <h2 class="grass"><GameIcon name="clipboard" /> 監督の指示</h2>
      <label>
        <div class="muted">練習メニュー</div>
        <select :value="p.practiceMenu" @change="changeMenu">
          <option v-for="(label, key) in PRACTICE_NAME" :key="key" :value="key">{{ label }}</option>
        </select>
      </label>
      <label>
        <div class="muted">本職のポジション</div>
        <select :value="p.mainPosition" @change="changePosition">
          <option v-for="pos in POSITIONS" :key="pos" :value="pos">{{ POSITION_NAME[pos] }}</option>
        </select>
      </label>
    </div>
  </div>
  <div v-else class="page">
    <p>この選手は見つかりませんでした（卒業した可能性があります）。</p>
    <button @click="router.back()">戻る</button>
  </div>
</template>

<style scoped>
.back {
  margin-bottom: 6px;
}
.profile {
  display: flex;
  gap: 12px;
  align-items: flex-start;
}
.info {
  flex: 1;
  min-width: 0;
}
.name {
  font-size: 21px;
  font-weight: 900;
}
.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 4px;
}
.small {
  font-size: 13px;
  padding: 4px 0;
  margin-top: 4px;
}
.edit-actions {
  margin-top: 8px;
}
.edit-actions button {
  flex: 1;
}
.card h2 {
  display: flex;
  align-items: center;
  gap: 8px;
}
.ab {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 4px;
  font-size: 14px;
}
.sub {
  margin-top: 10px;
}
.zone {
  display: grid;
  grid-template-columns: repeat(3, 34px);
  grid-template-rows: repeat(3, 34px);
  gap: 2px;
  margin-top: 4px;
}
.zone div {
  border: 1px solid var(--line);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  background: var(--cream);
}
.zone .hot {
  background: #fbe3dc;
  color: var(--red);
}
.zone .cold {
  background: #dfe9f6;
  color: var(--blue);
}
.apt,
.pitches {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 12px;
  margin-top: 4px;
}
.skills {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 4px;
}

.bad-text {
  color: var(--red);
}
.face-wrap {
  background: linear-gradient(180deg, #bfe7ff, #e8f6ff);
  border-radius: 20px;
  padding: 4px;
  box-shadow: inset 0 -4px 0 rgba(0, 0, 0, 0.06);
}
.meta {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
  margin-top: 2px;
}
.chip {
  font-size: 12px;
  font-weight: 800;
  padding: 1px 8px;
  border-radius: 6px;
  background: #eef3f8;
  color: var(--navy);
}
.chip.grade {
  background: var(--sky);
  color: #fff;
}
.chip.pos {
  background: var(--orange);
  color: #fff;
}
.card h2.red {
  background: linear-gradient(90deg, #e5484d 0%, #ff7a7e 100%);
}
.h-rank {
  margin-left: auto;
  background: #fff;
  border-radius: 8px;
  padding: 1px 6px;
}
.abilities {
  display: grid;
  grid-template-columns: 1fr 1fr;
  column-gap: 16px;
}
.traj {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.traj-icons span {
  color: #d5dde7;
  font-size: 15px;
}
.traj-icons span.on {
  color: var(--orange);
}
.two {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 16px;
}
.apt span {
  font-weight: 700;
  font-size: 13px;
}
.apt b {
  margin-left: 1px;
}
.apt .a3 b { color: var(--red); }
.apt .a2 b { color: var(--orange); }
.apt .a1 b { color: var(--blue); }
.apt .a0 { color: #b3bccb; }
.velo {
  display: flex;
  align-items: center;
  gap: 10px;
  background: #fff5f5;
  border-radius: 12px;
  padding: 6px 12px;
  margin-bottom: 4px;
}
.velo-num {
  font-size: 30px;
  font-weight: 900;
  font-style: italic;
  color: var(--red);
  flex: 1;
}
.velo-num small {
  font-size: 13px;
  margin-left: 2px;
}
.pitch {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
}
.pitch-name {
  font-weight: 800;
  width: 110px;
}
.dots {
  display: flex;
  gap: 3px;
}
.dots i {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #e8eef5;
}
.dots i.on {
  background: var(--sky);
  box-shadow: inset 0 -2px 0 rgba(0, 0, 0, 0.15);
}
.skill {
  border-radius: 12px;
  padding: 6px 12px;
  border: 2px solid;
}
.skill.good {
  background: #e9f4ff;
  border-color: #9ccbf5;
}
.skill.bad {
  background: #fff0f0;
  border-color: #f5b2b4;
}
.skill-name {
  font-weight: 900;
}
.skill.good .skill-name { color: var(--blue); }
.skill.bad .skill-name { color: var(--red); }
.skill-desc {
  font-size: 12px;
  color: var(--ink-soft);
}
.cond {
  display: flex;
  gap: 12px;
  align-items: center;
  margin-bottom: 6px;
}
.form {
  width: 76px;
  text-align: center;
  border-radius: 14px;
  padding: 6px 0;
  color: #fff;
  flex-shrink: 0;
}
.form-arrow {
  font-size: 26px;
  line-height: 1.1;
}
.form-label {
  font-size: 12px;
  font-weight: 900;
}
.f1 { background: #5b6b80; }
.f2 { background: #2f6fe0; }
.f3 { background: #3fae4a; }
.f4 { background: #ff8a3d; }
.f5 { background: #e5484d; }
.cond-bars {
  flex: 1;
}
</style>
