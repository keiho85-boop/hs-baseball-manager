<script setup lang="ts">
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
const TRAJ = ['', '1（低い）', '2', '3', '4（高い）']

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
    <button class="plain back" @click="router.back()">← 戻る</button>

    <div class="card profile">
      <FaceIcon :face="p.face" :size="72" />
      <div class="info">
        <template v-if="!editing">
          <div class="name">{{ p.surname }} {{ p.givenName }}</div>
          <div class="muted">
            {{ p.grade }}年 ・ {{ POSITION_NAME[p.mainPosition] }} ・ {{ THROWS[p.throws] }}{{ BATS[p.bats] }}
          </div>
          <div class="tags">
            <span v-if="p.helper" class="pill">助っ人</span>
            <span v-if="p.retired" class="pill">引退</span>
            <span v-if="p.fatherAlumniId" class="pill good">OBの息子</span>
            <span class="pill">監督の見立て：{{ p.estimate }}</span>
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
      <h2>状態</h2>
      <div class="grid2">
        <div>体力：{{ p.condition.stamina }}</div>
        <div>調子：{{ FORM[p.condition.form] }}</div>
        <div>やる気：{{ p.condition.motivation }}</div>
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
      <h2>野手能力 <RankBadge :value="fielderRating(p)" /></h2>
      <div class="grid2">
        <div class="ab">ミート<RankBadge :value="p.batting.contact" /></div>
        <div class="ab">パワー<RankBadge :value="p.batting.power" /></div>
        <div class="ab">弾道<span>{{ TRAJ[p.batting.trajectory] }}</span></div>
        <div class="ab">選球眼<RankBadge :value="p.batting.eye" /></div>
        <div class="ab">対左投手<RankBadge :value="p.batting.vsLeft" /></div>
        <div class="ab">走力<RankBadge :value="p.running.speed" /></div>
        <div class="ab">盗塁<RankBadge :value="p.running.steal" /></div>
        <div class="ab">走塁判断<RankBadge :value="p.running.baserunning" /></div>
        <div class="ab">肩力<RankBadge :value="p.fielding.arm" /></div>
        <div class="ab">守備範囲<RankBadge :value="p.fielding.range" /></div>
        <div class="ab">捕球<RankBadge :value="p.fielding.catching" /></div>
        <div class="ab">送球<RankBadge :value="p.fielding.throwing" /></div>
      </div>
      <div class="sub">
        <div class="muted">コース別の得意・苦手（打者から見た図）</div>
        <div class="zone">
          <div v-for="(v, i) in p.batting.zone" :key="i" :class="v > 0 ? 'hot' : v < 0 ? 'cold' : ''">{{ zoneLabel(v) }}</div>
        </div>
      </div>
      <div class="sub">
        <div class="muted">守備位置の適性</div>
        <div class="apt">
          <span v-for="pos in POSITIONS" :key="pos">{{ POSITION_LABEL[pos] }}{{ APTITUDE_LABEL[p.fielding.aptitude[pos]] }}</span>
        </div>
      </div>
    </div>

    <div class="card">
      <h2>投手能力 <RankBadge :value="pitcherRating(p)" /></h2>
      <div class="grid2">
        <div class="ab">球速<span><RankBadge :value="velocityScore(p.pitching.velocity)" :show-value="false" /> {{ p.pitching.velocity }}km/h</span></div>
        <div class="ab">コントロール<RankBadge :value="p.pitching.control" /></div>
        <div class="ab">スタミナ<RankBadge :value="p.pitching.stamina" /></div>
        <div class="ab">キレ<RankBadge :value="p.pitching.kire" /></div>
        <div class="ab">対左打者<RankBadge :value="p.pitching.vsLeft" /></div>
        <div class="ab">クイック<RankBadge :value="p.pitching.quick" /></div>
        <div class="ab">ピンチ<RankBadge :value="p.pitching.pinch" /></div>
      </div>
      <div class="sub">
        <div class="muted">変化球</div>
        <div v-if="p.pitching.pitches.length" class="pitches">
          <span v-for="pt in p.pitching.pitches" :key="pt.type" class="pill">{{ PITCH_NAME[pt.type] }} {{ pt.level }}</span>
        </div>
        <div v-else>なし</div>
      </div>
    </div>

    <div class="card">
      <h2>共通の能力</h2>
      <div class="grid2">
        <div class="ab">チャンス<RankBadge :value="p.common.clutch" /></div>
        <div class="ab">調子の安定<RankBadge :value="p.common.stability" /></div>
        <div class="ab">ケガしにくさ<RankBadge :value="p.common.durability" /></div>
        <div class="ab">回復力<RankBadge :value="p.common.recovery" /></div>
      </div>
      <div class="sub">
        <div class="muted">特殊能力</div>
        <div v-if="p.skills.length" class="skills">
          <div v-for="id in p.skills" :key="id" class="skill">
            <span class="pill" :class="getSkill(id)?.good ? 'good' : 'bad'">{{ getSkill(id)?.name }}</span>
            <span class="muted">{{ getSkill(id)?.description }}</span>
          </div>
        </div>
        <div v-else>なし</div>
      </div>
    </div>

    <div v-if="isOwn && !p.retired" class="card stack">
      <h2>監督の指示</h2>
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
  font-size: 19px;
  font-weight: 700;
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
.skill {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}
.bad-text {
  color: var(--red);
}
</style>
