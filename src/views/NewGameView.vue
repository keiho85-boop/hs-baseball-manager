<script setup lang="ts">
// はじめから：選手育成モードはシナリオと育成選手の名前、チーム育成モードは学校の設定を決める
import GameIcon from '@/components/GameIcon.vue'
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useGameStore } from '@/stores/game'
import { useUiStore } from '@/stores/ui'
import { modeOfSlot, PLAYER_MODE_PREF, PLAYER_MODE_SCHOOL, PREFECTURES } from '@/game/constants'
import { GIVEN_NAMES, PRIVATE_SUFFIXES, PUBLIC_SUFFIXES, SCHOOL_NAME_HEADS, SURNAMES } from '@/game/names'
import { unlockedScenarios } from '@/game/success/archive'
import type { Position, SchoolKind } from '@/game/types'

const props = defineProps<{ slot: string }>()
const game = useGameStore()
const ui = useUiStore()
const router = useRouter()
const BASE = import.meta.env.BASE_URL

const slotNumber = computed(() => Number(props.slot))
const mode = computed(() => modeOfSlot(slotNumber.value))

function pick<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)]!
}

// ---------------------------------------------------------------- 選手育成モード
const surname = ref('')
const givenName = ref('')
function randomFocusName(): void {
  surname.value = pick(SURNAMES)
  givenName.value = pick(GIVEN_NAMES)
}
randomFocusName()
/** 育てる選手の守備位置（外野は中堅として扱う） */
const POS_OPTIONS: { pos: Position; label: string }[] = [
  { pos: 'P', label: '投手' },
  { pos: 'C', label: '捕手' },
  { pos: '1B', label: '一塁手' },
  { pos: '2B', label: '二塁手' },
  { pos: '3B', label: '三塁手' },
  { pos: 'SS', label: '遊撃手' },
  { pos: 'CF', label: '外野手' },
]
const focusPos = ref<Position>('P')
const ch2Unlocked = computed(() => unlockedScenarios().includes(2))

// ---------------------------------------------------------------- チーム育成モード
const managerName = ref('')
const prefCode = ref(27)
const kind = ref<SchoolKind>('public')
const schoolName = ref('')

function randomName(): void {
  schoolName.value = pick(SCHOOL_NAME_HEADS) + pick(kind.value === 'private' ? PRIVATE_SUFFIXES : PUBLIC_SUFFIXES)
}
randomName()

const canStart = computed(() =>
  mode.value === 'player'
    ? surname.value.trim().length > 0 && givenName.value.trim().length > 0
    : managerName.value.trim().length > 0 && schoolName.value.trim().length > 0,
)

async function start(): Promise<void> {
  if (!canStart.value || game.busy) return
  const player = mode.value === 'player'
  try {
    await game.startNewGame({
      slot: slotNumber.value,
      managerName: player ? '朝比奈 ナギ' : managerName.value.trim().slice(0, 12),
      story: player,
      prefCode: player ? PLAYER_MODE_PREF : prefCode.value,
      kind: player ? 'public' : kind.value,
      schoolName: player ? PLAYER_MODE_SCHOOL : schoolName.value.trim().slice(0, 16),
      focusPosition: player ? focusPos.value : undefined,
      focusName: player ? { surname: surname.value.trim().slice(0, 6), givenName: givenName.value.trim().slice(0, 6) } : undefined,
      // 運の大きさは「高校野球らしく少し多め」で固定（構想書の決定事項）
      settings: { injury: 'normal', luck: 'normal', cutin: true, gameSpeed: 2, lightMode: false },
    })
    await router.replace({ name: 'home' })
  } catch (e) {
    await ui.alert((e as Error).message, '作成に失敗しました')
  }
}

</script>

<template>
  <div class="page stack">
    <div class="row">
      <button class="plain" @click="router.back()"><GameIcon name="back" :size="16" /> 戻る</button>
      <h1 class="title">{{ mode === 'player' ? '選手育成モード' : 'チーム育成モード' }}</h1>
    </div>

    <template v-if="mode === 'player'">
      <div class="scenario on">
        <div class="sc-art" :style="{ backgroundImage: `url(${BASE}bg/bg_ground_sunset.webp)` }">
          <div class="sc-title">
            <small>第1章・高校3年間</small>
            <b>ナギ現役編</b>
          </div>
        </div>
        <div class="sc-body">
          <p>廃部寸前の{{ PLAYER_MODE_SCHOOL }}野球部に、マネージャーとして入部したナギ。部員を集めながら、幼馴染の選手を3年間でプロへ導きます。</p>
          <div class="tags">
            <span><img :src="`${BASE}ui/ui_recruit.webp`" alt="" />部員集め</span>
            <span><img :src="`${BASE}ui/ui_facility.webp`" alt="" />育成：標準</span>
            <span><img :src="`${BASE}ui/ui_calendar.webp`" alt="" />約30〜45分</span>
          </div>
        </div>
      </div>

      <div class="scenario locked">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
        <div>
          <b>第2章 ナギ大学編</b>
          <small>{{ ch2Unlocked ? '準備中です' : '第1章で選手をプロ入りさせると解禁' }}</small>
        </div>
      </div>

      <div class="card stack">
        <div class="focus-row">
          <img class="focus-face" :src="`${BASE}icon/icon_focus.webp`" alt="" />
          <div>
            <div class="label">育てる選手の名前</div>
            <p class="muted small">名前と守備位置を決めてください。</p>
          </div>
        </div>
        <div class="names">
          <label>
            <span class="label">名字</span>
            <input v-model="surname" maxlength="6" />
          </label>
          <label>
            <span class="label">名前</span>
            <input v-model="givenName" maxlength="6" />
          </label>
        </div>
        <button class="secondary" @click="randomFocusName">名前をおまかせ</button>
        <div class="label">守備位置</div>
        <div class="positions">
          <button v-for="o in POS_OPTIONS" :key="o.pos" :class="focusPos === o.pos ? '' : 'secondary'" @click="focusPos = o.pos">{{ o.label }}</button>
        </div>
        <p class="muted small">{{ focusPos === 'C' ? '捕手を選ぶと、幼馴染の大地が投手になってバッテリーを組みます。' : focusPos === 'P' ? '投手を選ぶと、幼馴染の大地が捕手としてボールを受けます。' : '大地は捕手です。' }}</p>
      </div>
    </template>

    <template v-else>
      <div class="card stack">
        <label>
          <div class="label">監督の名前</div>
          <input v-model="managerName" maxlength="12" placeholder="例：中山" />
        </label>
        <label>
          <div class="label">都道府県</div>
          <select v-model.number="prefCode">
            <option v-for="p in PREFECTURES" :key="p.code" :value="p.code">{{ p.name }}</option>
          </select>
        </label>
      </div>

      <div class="card">
        <div class="label">学校の種類</div>
        <div class="kinds">
          <button :class="kind === 'public' ? '' : 'secondary'" @click="kind = 'public'; randomName()">公立</button>
          <button :class="kind === 'private' ? '' : 'secondary'" @click="kind = 'private'; randomName()">私立</button>
        </div>
        <p class="muted">
          <template v-if="kind === 'public'">部費や設備は控えめですが、地元の応援が厚い学校です。</template>
          <template v-else>部費と設備に恵まれ、スカウトにも強い学校です。</template>
        </p>
        <div class="label">学校名</div>
        <div class="row">
          <input v-model="schoolName" maxlength="16" />
          <button class="secondary nowrap" @click="randomName">おまかせ</button>
        </div>
        <p class="muted">はじめは県内で一番の弱小校からのスタートです。</p>
      </div>

    </template>

    <button class="full start" :disabled="!canStart || game.busy" @click="start">
      {{ game.busy ? '準備中…' : mode === 'player' ? 'このシナリオで始める' : 'この内容で始める' }}
    </button>
  </div>
</template>

<style scoped>
.title {
  font-size: 17px;
}
.label {
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 4px;
}
.small {
  font-size: 12px;
  margin: 0;
}
.kinds {
  display: flex;
  gap: 8px;
  margin-bottom: 6px;
}
.kinds button {
  flex: 1;
}
.nowrap {
  white-space: nowrap;
}
.start {
  padding: 14px;
  font-size: 16px;
}
.scenario {
  border-radius: 18px;
  overflow: hidden;
  background: #fff;
}
.scenario.on {
  border: 3px solid #36a843;
  box-shadow: 0 3px 0 #b9d8bd;
}
.sc-art {
  height: 120px;
  background-size: cover;
  background-position: center 60%;
  display: flex;
  align-items: flex-end;
}
.sc-title {
  width: 100%;
  padding: 8px 14px;
  color: #fff;
  background: linear-gradient(180deg, rgba(0, 0, 0, 0) 0%, rgba(10, 30, 20, 0.7) 100%);
  display: flex;
  flex-direction: column;
}
.sc-title small {
  font-size: 11px;
  font-weight: 700;
}
.sc-title b {
  font-size: 22px;
}
.sc-body {
  padding: 10px 14px 12px;
  font-size: 13px;
  line-height: 1.6;
}
.sc-body p {
  margin: 0 0 8px;
}
.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.tags span {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: #e8f5ea;
  color: #237d2e;
  border-radius: 999px;
  padding: 2px 10px 2px 4px;
  font-size: 11px;
  font-weight: 700;
}
.tags img {
  width: 20px;
  height: 20px;
}
.scenario.locked {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  background: #f1f4f8;
  border: 2px dashed #b7c3d3;
  color: #5f6f86;
}
.scenario.locked div {
  display: flex;
  flex-direction: column;
}
.scenario.locked small {
  font-size: 11px;
}
.focus-row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.focus-face {
  width: 52px;
  height: 52px;
}
.positions {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 6px;
}
.positions button {
  padding: 8px 2px;
  font-size: 13px;
}
.names {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}
</style>
