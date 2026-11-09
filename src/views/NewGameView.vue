<script setup lang="ts">
import GameIcon from '@/components/GameIcon.vue'
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useGameStore } from '@/stores/game'
import { useUiStore } from '@/stores/ui'
import { PREFECTURES } from '@/game/constants'
import { PRIVATE_SUFFIXES, PUBLIC_SUFFIXES, SCHOOL_NAME_HEADS } from '@/game/names'
import type { Difficulty, SchoolKind } from '@/game/types'

const props = defineProps<{ slot: string }>()
const game = useGameStore()
const ui = useUiStore()
const router = useRouter()

const managerName = ref('')
const prefCode = ref(27)
const kind = ref<SchoolKind>('public')
const schoolName = ref('')
const injury = ref<Difficulty>('normal')
/** ストーリーあり：主人公はマネージャーの朝比奈ナギ（名前は決まっている） */
const story = ref(true)

const slotNumber = computed(() => Number(props.slot))

function pick<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)]!
}

function randomName(): void {
  schoolName.value = pick(SCHOOL_NAME_HEADS) + pick(kind.value === 'private' ? PRIVATE_SUFFIXES : PUBLIC_SUFFIXES)
}
randomName()

const canStart = computed(() => (story.value || managerName.value.trim().length > 0) && schoolName.value.trim().length > 0)

async function start(): Promise<void> {
  if (!canStart.value || game.busy) return
  try {
    await game.startNewGame({
      slot: slotNumber.value,
      managerName: story.value ? '朝比奈 ナギ' : managerName.value.trim().slice(0, 12),
      story: story.value,
      prefCode: prefCode.value,
      kind: kind.value,
      schoolName: schoolName.value.trim().slice(0, 16),
      // 運の大きさは「高校野球らしく少し多め」で固定（構想書の決定事項）
      settings: { injury: injury.value, luck: 'normal', cutin: true, gameSpeed: 2, lightMode: false },
    })
    await router.replace({ name: 'home' })
  } catch (e) {
    await ui.alert((e as Error).message, '作成に失敗しました')
  }
}

const DIFFICULTY_LABEL: Record<Difficulty, string> = { easy: 'やさしい', normal: 'ふつう', hard: 'きびしい' }
</script>

<template>
  <div class="page stack">
    <div class="row">
      <button class="plain" @click="router.back()"><GameIcon name="back" :size="16" /> 戻る</button>
      <h1 class="title">新しく始める（セーブ{{ slot }}）</h1>
    </div>

    <div class="card">
      <div class="label">遊び方</div>
      <div class="kinds">
        <button :class="story ? '' : 'secondary'" @click="story = true">ストーリーあり</button>
        <button :class="story ? 'secondary' : ''" @click="story = false">ストーリーなし</button>
      </div>
      <p class="muted">
        <template v-if="story">第1章「ナギ現役編」。廃部寸前の野球部に、マネージャーの朝比奈ナギとして入部します。部員を集めながら、幼馴染の選手を3年間育ててプロ入りを目指します。</template>
        <template v-else>会話の場面なしで、監督として自由に部を育てます。</template>
      </p>
    </div>

    <div class="card stack">
      <label v-if="!story">
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

    <div class="card stack">
      <div>
        <div class="label">ケガの厳しさ</div>
        <div class="kinds">
          <button v-for="d in (['easy', 'normal', 'hard'] as const)" :key="d" :class="injury === d ? '' : 'secondary'" @click="injury = d">
            {{ DIFFICULTY_LABEL[d] }}
          </button>
        </div>
      </div>
      <p class="muted">あとから設定画面で変更できます。</p>
    </div>

    <button class="full start" :disabled="!canStart || game.busy" @click="start">
      {{ game.busy ? '学校と選手を作成中…' : 'この内容で始める' }}
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
</style>
