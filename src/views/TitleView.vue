<script setup lang="ts">
import GameIcon from '@/components/GameIcon.vue'
import { defineAsyncComponent, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useGameStore } from '@/stores/game'
import { useUiStore } from '@/stores/ui'
import { formatWeek } from '@/game/constants'
// 3DCGの球場（three.js）は容量が大きいので、別ファイルで後から読み込む
const Field3D = defineAsyncComponent(() => import('@/components/match/Field3D.vue'))
const noBases = [null, null, null]

const game = useGameStore()
const ui = useUiStore()
const router = useRouter()
const managing = ref(false)
const importTarget = ref<number | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)

onMounted(() => game.refreshSlots())

function updatedLabel(iso: string): string {
  const d = new Date(iso)
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`
}

async function play(slot: number): Promise<void> {
  try {
    const recovered = await game.loadSlot(slot)
    if (recovered) {
      await ui.alert('最新のセーブデータが壊れていたため、1つ前の保存から復旧しました。')
    }
    await router.push({ name: 'home' })
  } catch (e) {
    await ui.alert((e as Error).message, '読み込みに失敗しました')
  }
}

async function startNew(slot: number): Promise<void> {
  if (game.slots[slot - 1]) {
    const ok = await ui.confirm(`セーブ${slot}のデータを消して、新しく始めますか？\nこの操作は取り消せません。`, {
      okLabel: '消して始める',
      cancelLabel: 'やめる',
      danger: true,
    })
    if (!ok) return
  }
  await router.push({ name: 'new', params: { slot: String(slot) } })
}

function chooseImport(slot: number): void {
  importTarget.value = slot
  fileInput.value?.click()
}

async function onFile(e: Event): Promise<void> {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  const slot = importTarget.value
  if (!file || slot === null) return
  if (game.slots[slot - 1]) {
    const ok = await ui.confirm(`セーブ${slot}のデータを、読み込むファイルで上書きしますか？`, {
      okLabel: '上書きする',
      cancelLabel: 'やめる',
      danger: true,
    })
    if (!ok) return
  }
  try {
    await game.importToSlot(slot, file)
    ui.showToast(`セーブ${slot}に読み込みました`)
  } catch (err) {
    await ui.alert((err as Error).message, '読み込みに失敗しました')
  }
}

async function exportSlot(slot: number): Promise<void> {
  try {
    await game.exportSlot(slot)
  } catch (err) {
    await ui.alert((err as Error).message)
  }
}

async function remove(slot: number): Promise<void> {
  const ok = await ui.confirm(`セーブ${slot}のデータを削除しますか？\nこの操作は取り消せません。`, {
    okLabel: '削除する',
    cancelLabel: 'やめる',
    danger: true,
  })
  if (ok) await game.removeSlot(slot)
}
</script>

<template>
  <div class="title-page">
    <div class="hero">
      <div class="stage3d">
        <Field3D :bases="noBases" :names="{}" :last-event="null" :own-batting="true" cinematic />
      </div>
      <div class="vignette" />
      <div class="logo-wrap">
        <div class="kicker">HIGH SCHOOL BASEBALL</div>
        <h1 class="logo">
          <span class="l1">高校野球</span>
          <span class="l2">監督ゲーム</span>
        </h1>
        <div class="rule"><i /><GameIcon name="ball" :size="18" /><i /></div>
        <p class="sub">仮タイトル</p>
      </div>
    </div>

    <div class="page">
      <div v-if="ui.updateAvailable" class="card update">
        <div>新しい版があります。</div>
        <button @click="ui.runUpdate()">更新する</button>
      </div>

      <div class="row head">
        <h2>{{ managing ? 'データ管理' : 'セーブデータ' }}</h2>
        <button class="plain" @click="managing = !managing">{{ managing ? '戻る' : 'データ管理' }}</button>
      </div>

      <div v-for="(s, i) in game.slots" :key="i" class="card slot">
        <div class="slot-title">SAVE {{ i + 1 }}</div>
        <template v-if="s">
          <div class="school">{{ s.schoolName }}<span class="muted">（{{ s.prefName }}）</span></div>
          <div class="muted">{{ formatWeek(s.year, s.week) }} ／ 監督 {{ s.managerName }} ／ 保存 {{ updatedLabel(s.updatedAt) }}</div>
        </template>
        <div v-else class="muted">データなし</div>

        <div v-if="!managing" class="actions">
          <button v-if="s" class="sun" :disabled="game.busy" @click="play(i + 1)"><GameIcon name="play" :size="16" /> 続きから</button>
          <button :class="s ? 'secondary' : ''" :disabled="game.busy" @click="startNew(i + 1)">はじめから</button>
        </div>
        <div v-else class="actions">
          <button class="secondary" :disabled="!s" @click="exportSlot(i + 1)">書き出し</button>
          <button class="secondary" @click="chooseImport(i + 1)">読み込み</button>
          <button class="danger" :disabled="!s" @click="remove(i + 1)">削除</button>
        </div>
      </div>

      <p v-if="managing" class="muted">
        「書き出し」でセーブデータをファイルに保存できます。機種変更やアプリの削除に備えて、ときどき書き出しておくと安心です。
      </p>
      <p v-if="game.busy" class="muted">読み込み中…</p>
      <input ref="fileInput" type="file" accept=".hsbm,application/gzip,application/octet-stream" hidden @change="onFile" />
    </div>
  </div>
</template>

<style scoped>
/* タイトルはナイターの球場を背景に、暗い配色で引き締める */
.title-page {
  min-height: 100dvh;
  background: radial-gradient(120% 60% at 50% 0%, #17305a 0%, #0a1426 55%, #060c18 100%);
  color: #e8eef8;
}
.hero {
  position: relative;
  height: min(52dvh, 420px);
  overflow: hidden;
}
.stage3d {
  position: absolute;
  inset: 0;
}
.vignette {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background:
    linear-gradient(180deg, rgba(6, 12, 24, 0.55) 0%, rgba(6, 12, 24, 0) 30%, rgba(6, 12, 24, 0) 60%, #0a1426 100%),
    radial-gradient(60% 26% at 50% 48%, rgba(6, 12, 24, 0.55) 0%, rgba(6, 12, 24, 0) 100%),
    radial-gradient(90% 70% at 50% 40%, rgba(0, 0, 0, 0) 50%, rgba(0, 0, 0, 0.45) 100%);
}
.logo-wrap {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding-top: env(safe-area-inset-top, 0px);
  pointer-events: none;
}
.kicker {
  font-family: 'M PLUS Rounded 1c', sans-serif;
  font-size: 11px;
  font-weight: 900;
  letter-spacing: 0.42em;
  color: #ffd36b;
  text-shadow: 0 0 10px rgba(255, 211, 107, 0.6);
  animation: rise 0.8s ease-out both;
}
.logo {
  margin: 4px 0 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  line-height: 1;
  font-weight: 900;
  font-style: italic;
  animation: rise 0.8s ease-out 0.12s both;
}
.l1 {
  font-size: 30px;
  letter-spacing: 0.18em;
  color: #fff;
  text-shadow: 0 2px 0 #0b1a33, 0 0 18px rgba(120, 180, 255, 0.55);
}
.l2 {
  margin-top: 4px;
  font-size: 50px;
  letter-spacing: 0.04em;
  /* 金属のような光沢のある文字 */
  background: linear-gradient(180deg, #fffbe6 0%, #ffe07a 38%, #f2a516 52%, #ffd84d 70%, #fff1b8 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  -webkit-text-stroke: 1.5px #6b3d00;
  filter: drop-shadow(0 4px 0 #3a2000) drop-shadow(0 0 16px rgba(255, 196, 61, 0.55));
  position: relative;
}
.rule {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 10px;
  color: #fff;
  animation: rise 0.8s ease-out 0.24s both;
}
.rule i {
  display: block;
  width: 70px;
  height: 2px;
  background: linear-gradient(90deg, transparent, #ffd36b);
}
.rule i:last-child {
  background: linear-gradient(90deg, #ffd36b, transparent);
}
.sub {
  margin: 8px 0 0;
  font-size: 10px;
  font-weight: 800;
  color: #9fb4cc;
  letter-spacing: 0.2em;
}
@keyframes rise {
  from {
    opacity: 0;
    transform: translateY(14px) scale(0.96);
  }
  to {
    opacity: 1;
    transform: none;
  }
}
.page {
  position: relative;
  margin-top: -36px;
}
.head h2 {
  color: #fff;
}
.head .plain {
  color: #ffd36b;
}
.slot.card {
  background: linear-gradient(160deg, rgba(34, 58, 96, 0.85), rgba(16, 30, 54, 0.92));
  border: 1px solid rgba(140, 180, 230, 0.25);
  border-left: 5px solid #ffd36b;
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.12);
  color: #e8eef8;
  backdrop-filter: blur(6px);
}
.slot .muted,
.page > .muted {
  color: #9fb4cc;
}
.slot-title {
  font-size: 11px;
  font-weight: 900;
  color: #ffd36b;
  letter-spacing: 0.2em;
}
.school {
  font-weight: 900;
  font-size: 17px;
  color: #fff;
}
.actions {
  display: flex;
  gap: 8px;
  margin-top: 10px;
}
.actions button {
  flex: 1;
  padding: 10px 8px;
}
.update {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  background: #fff8e6;
  border-color: #ecd9a4;
  color: var(--ink);
}
.head {
  justify-content: space-between;
  margin: 4px 0 8px;
}
.head h2 {
  font-size: 17px;
  font-weight: 900;
}
</style>
