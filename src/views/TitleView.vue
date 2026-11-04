<script setup lang="ts">
import GameIcon from '@/components/GameIcon.vue'
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useGameStore } from '@/stores/game'
import { useUiStore } from '@/stores/ui'
import { formatWeek } from '@/game/constants'
import FieldScene from '@/components/FieldScene.vue'

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
      <FieldScene :height="260" />
      <div class="logo-wrap">
        <div class="logo-ball"><GameIcon name="ball" :size="44" /></div>
        <h1 class="logo">高校野球<br /><span>監督ゲーム</span></h1>
        <p class="sub">（仮タイトル）</p>
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
.title-page {
  min-height: 100vh;
}
.hero {
  position: relative;
}
.logo-wrap {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: calc(14px + env(safe-area-inset-top, 0px));
}
.logo-ball {
  color: #fff;
  filter: drop-shadow(0 3px 0 var(--sky-deep));
  animation: pop-in 0.5s ease-out;
}
.logo {
  text-align: center;
  font-size: 30px;
  font-weight: 900;
  line-height: 1.15;
  color: #fff;
  letter-spacing: 0.04em;
  -webkit-text-stroke: 6px var(--sky-deep);
  paint-order: stroke fill;
  text-shadow: 0 5px 0 rgba(0, 0, 0, 0.18);
  animation: pop-in 0.5s ease-out 0.1s both;
}
.logo span {
  font-size: 38px;
  color: var(--sun);
  -webkit-text-stroke: 6px #c26b00;
}
.sub {
  margin: 6px 0 0;
  color: var(--sky-deep);
  background: rgba(255, 255, 255, 0.9);
  border-radius: 999px;
  padding: 0 10px;
  font-weight: 800;
  font-size: 11px;
}
.head {
  justify-content: space-between;
  margin: 4px 0 8px;
}
.head h2 {
  font-size: 17px;
  font-weight: 900;
}
.slot {
  border-left: 7px solid var(--sky);
}
.slot-title {
  font-size: 12px;
  font-weight: 900;
  color: var(--sky-deep);
  letter-spacing: 0.08em;
}
.school {
  font-weight: 900;
  font-size: 17px;
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
}
</style>
