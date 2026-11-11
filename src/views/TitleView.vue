<script setup lang="ts">
// タイトル画面：解禁した章の1枚絵 →「TAP TO START」→ モード選択（セーブ選択）
import GameIcon from '@/components/GameIcon.vue'
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useGameStore } from '@/stores/game'
import { useUiStore } from '@/stores/ui'
import { formatWeek, PLAYER_MODE_SLOTS, POSITION_LABEL, TEAM_MODE_SLOTS, type GameMode } from '@/game/constants'
import { listSavedPlayers, unlockedScenarios } from '@/game/success/archive'

const game = useGameStore()
const ui = useUiStore()
const router = useRouter()
const BASE = import.meta.env.BASE_URL

/** splash：タイトル絵　mode：モード選択 */
const phase = ref<'splash' | 'mode'>('splash')
const mode = ref<GameMode>('player')
const managing = ref(false)
const importTarget = ref<number | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)

onMounted(() => game.refreshSlots())

/** 解禁した章（タイトル絵は一番新しい章のものを出す） */
const chapter = computed(() => Math.max(1, ...unlockedScenarios()))
const titleArt = computed(() => `${BASE}title/title_ch${Math.min(chapter.value, 1)}.webp`)
const savedCount = computed(() => listSavedPlayers().length)

/** チーム育成モードは、すべてのシナリオをクリアすると解禁（確認用の版では最初から遊べる） */
const ALL_SCENARIOS = [2]
const teamUnlocked = computed(
  () => import.meta.env.MODE !== 'production' || ALL_SCENARIOS.every((n) => unlockedScenarios().includes(n)),
)

const slotNumbers = computed(() => (mode.value === 'player' ? PLAYER_MODE_SLOTS : TEAM_MODE_SLOTS))
const rows = computed(() =>
  slotNumbers.value.map((n, i) => ({ n, no: i + 1, s: game.slots[n - 1] ?? null })),
)

function start(): void {
  phase.value = 'mode'
}

function pickMode(m: GameMode): void {
  if (m === 'team' && !teamUnlocked.value) {
    void ui.alert('チーム育成モードは、選手育成モードのシナリオをすべてクリアすると遊べるようになります。', 'まだ遊べません')
    return
  }
  mode.value = m
  managing.value = false
}

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

async function startNew(slot: number, no: number): Promise<void> {
  if (game.slots[slot - 1]) {
    const ok = await ui.confirm(`データ${no}を消して、新しく始めますか？\nこの操作は取り消せません。`, {
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
    const ok = await ui.confirm('このデータを、読み込むファイルで上書きしますか？', {
      okLabel: '上書きする',
      cancelLabel: 'やめる',
      danger: true,
    })
    if (!ok) return
  }
  try {
    await game.importToSlot(slot, file)
    ui.showToast('セーブデータを読み込みました')
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

async function remove(slot: number, no: number): Promise<void> {
  const ok = await ui.confirm(`データ${no}を削除しますか？\nこの操作は取り消せません。`, {
    okLabel: '削除する',
    cancelLabel: 'やめる',
    danger: true,
  })
  if (ok) await game.removeSlot(slot)
}
</script>

<template>
  <div class="title-page" :class="`is-${phase}`" :style="{ '--art': `url(${titleArt})` }">
    <div class="art" />

    <!-- タイトル -->
    <div v-if="phase === 'splash'" class="splash" role="button" tabindex="0" @click="start" @keydown.enter="start">
      <img class="logo-img logo-anim" :src="`${BASE}title/logo.webp`" alt="転生名将ナギ" />
      <div class="tap">TAP TO START</div>
      <div v-if="ui.updateAvailable" class="update" @click.stop>
        新しい版があります　<button class="sun" @click="ui.runUpdate()">更新する</button>
      </div>
    </div>

    <!-- モード選択（セーブ選択） -->
    <div v-else class="menu">
      <div class="menu-head">
        <button class="back" aria-label="タイトルへ戻る" @click="phase = 'splash'"><GameIcon name="back" :size="18" /></button>
        <img class="logo-img small" :src="`${BASE}title/logo.webp`" alt="転生名将ナギ" />
        <button class="back" :aria-label="managing ? 'データ管理を閉じる' : 'データ管理'" @click="managing = !managing">
          <img :src="`${BASE}ui/ui_settings.webp`" alt="" />
        </button>
      </div>

      <div class="modes">
        <button class="mode" :class="{ on: mode === 'player' }" @click="pickMode('player')">
          <img :src="`${BASE}icon/icon_focus.webp`" alt="" />
          <span class="m-name">選手育成モード</span>
          <span class="m-sub">1人を3年間育ててプロへ</span>
        </button>
        <button class="mode" :class="{ on: mode === 'team', locked: !teamUnlocked }" @click="pickMode('team')">
          <img :src="`${BASE}ui/ui_trophy.webp`" alt="" />
          <span class="m-name">チーム育成モード</span>
          <span class="m-sub">{{ teamUnlocked ? '監督として部を頂点へ' : '全シナリオクリアで解禁' }}</span>
          <span v-if="!teamUnlocked" class="lock" aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
          </span>
        </button>
      </div>

      <div v-for="r in rows" :key="r.n" class="slot">
        <div class="slot-no">DATA {{ r.no }}</div>
        <template v-if="r.s">
          <template v-if="mode === 'player'">
            <div class="slot-main">
              <img class="slot-face" :src="`${BASE}icon/icon_focus.webp`" alt="" />
              <div>
                <div class="slot-chapter">第1章 ナギ現役編</div>
                <div class="slot-name">
                  {{ r.s.focus?.name ?? '育成中の選手' }}
                  <small v-if="r.s.focus">{{ POSITION_LABEL[r.s.focus.position] }}</small>
                </div>
              </div>
            </div>
          </template>
          <div v-else class="slot-name">{{ r.s.schoolName }}<small>（{{ r.s.prefName }}）</small></div>
          <div class="slot-meta">{{ formatWeek(r.s.year, r.s.week) }}　保存 {{ updatedLabel(r.s.updatedAt) }}</div>
        </template>
        <div v-else class="slot-empty">データなし</div>

        <div v-if="!managing" class="actions">
          <button v-if="r.s" class="sun" :disabled="game.busy" @click="play(r.n)"><GameIcon name="play" :size="15" /> 続きから</button>
          <button :class="r.s ? 'secondary' : ''" :disabled="game.busy" @click="startNew(r.n, r.no)">はじめから</button>
        </div>
        <div v-else class="actions">
          <button class="secondary" :disabled="!r.s" @click="exportSlot(r.n)">書き出し</button>
          <button class="secondary" @click="chooseImport(r.n)">読み込み</button>
          <button class="danger" :disabled="!r.s" @click="remove(r.n, r.no)">削除</button>
        </div>
      </div>

      <button v-if="mode === 'player'" class="saved" @click="router.push({ name: 'pros' })">
        <img :src="`${BASE}ui/ui_eval.webp`" alt="" />
        <span>プロ入りした育成選手<small>一覧・ドリームチーム</small></span>
        <b>{{ savedCount }}<small>人</small></b>
      </button>

      <p v-if="managing" class="note">「書き出し」でセーブデータをファイルに保存できます。機種変更やアプリの削除に備えて、ときどき書き出しておくと安心です。</p>
      <p v-if="game.busy" class="note">読み込み中…</p>
      <div class="links">
        <a href="./intro/">ゲーム紹介ページ</a>
        <a href="./privacy/">プライバシーポリシー</a>
      </div>
      <input ref="fileInput" type="file" accept=".hsbm,application/gzip,application/octet-stream" hidden @change="onFile" />
    </div>
  </div>
</template>

<style scoped>
.title-page {
  position: relative;
  min-height: 100dvh;
  overflow: hidden;
  color: #1b2638;
  background: #8ec5ef;
}
.art {
  position: fixed;
  inset: 0;
  background: var(--art) center top / cover no-repeat;
  transition: filter 0.4s ease, transform 0.6s ease;
}
.title-page.is-mode .art {
  filter: blur(6px) brightness(0.85) saturate(1.1);
  transform: scale(1.06);
}

/* ---- ロゴ ---- */
.logo {
  display: flex;
  flex-direction: column;
  align-items: center;
  line-height: 1;
  font-family: 'M PLUS Rounded 1c', sans-serif;
  font-weight: 900;
  filter: drop-shadow(0 4px 0 #0d2a52) drop-shadow(0 8px 16px rgba(10, 30, 60, 0.45));
}
.logo .l1,
.logo .l2 {
  background: linear-gradient(180deg, #fff8d6 0%, #ffd34d 45%, #f08a1c 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  -webkit-text-stroke: 2px #0d2a52;
  paint-order: stroke fill;
}
.logo .l1 {
  font-size: 34px;
  letter-spacing: 0.12em;
}
.logo .l2 {
  font-size: 84px;
  letter-spacing: 0.06em;
  margin-top: 2px;
}
.logo.small .l1 {
  font-size: 15px;
  -webkit-text-stroke-width: 1px;
}
.logo.small .l2 {
  font-size: 34px;
  -webkit-text-stroke-width: 1.5px;
}

/* ---- タイトル ---- */
.splash {
  position: relative;
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  padding: calc(env(safe-area-inset-top, 0px) + 7dvh) 16px calc(env(safe-area-inset-bottom, 0px) + 6dvh);
  cursor: pointer;
}
.logo-img {
  width: min(96vw, 460px);
  height: auto;
  filter: drop-shadow(0 6px 12px rgba(10, 30, 60, 0.35));
}
.logo-img.small {
  width: 150px;
  animation: none;
}
.logo-anim {
  animation: drop 0.9s cubic-bezier(0.2, 1.4, 0.4, 1) both;
}
.tap {
  font-family: 'M PLUS Rounded 1c', sans-serif;
  font-weight: 900;
  font-size: 20px;
  letter-spacing: 0.24em;
  color: #fff;
  text-shadow: 0 2px 0 #0d2a52, 0 0 12px rgba(13, 42, 82, 0.8);
  animation: blink 1.6s ease-in-out infinite;
}
.update {
  position: absolute;
  top: calc(env(safe-area-inset-top, 0px) + 8px);
  right: 8px;
  background: rgba(255, 255, 255, 0.9);
  border-radius: 12px;
  padding: 6px 8px;
  font-size: 12px;
  font-weight: 700;
}
.update button {
  padding: 4px 10px;
  font-size: 12px;
}
@keyframes drop {
  from {
    opacity: 0;
    transform: translateY(-24px) scale(0.9);
  }
}
@keyframes blink {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.25;
  }
}

/* ---- モード選択 ---- */
.menu {
  position: relative;
  min-height: 100dvh;
  padding: calc(env(safe-area-inset-top, 0px) + 10px) 14px calc(env(safe-area-inset-bottom, 0px) + 20px);
  display: flex;
  flex-direction: column;
  gap: 12px;
  animation: fade 0.35s ease both;
}
@keyframes fade {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
}
.menu-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.back {
  width: 44px;
  height: 44px;
  padding: 0;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.92);
  color: #1a6fc2;
  box-shadow: 0 3px 0 rgba(13, 42, 82, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
}
.back img {
  width: 30px;
  height: 30px;
}
.modes {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}
.mode {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 10px 6px 12px;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.82);
  border: 3px solid transparent;
  color: #1b2638;
  box-shadow: 0 4px 0 rgba(13, 42, 82, 0.3);
}
.mode img {
  width: 58px;
  height: 58px;
}
.mode.on {
  background: #fff;
  border-color: #ffc93c;
  box-shadow: 0 4px 0 #d99400, 0 0 0 4px rgba(255, 201, 60, 0.35);
}
.mode.locked {
  background: rgba(225, 232, 242, 0.85);
  color: #5f6f86;
}
.mode.locked img {
  filter: grayscale(1) opacity(0.6);
}
.m-name {
  font-size: 15px;
  font-weight: 900;
}
.m-sub {
  font-size: 11px;
  font-weight: 700;
  color: #5f6f86;
}
.lock {
  position: absolute;
  top: 8px;
  right: 8px;
}
.slot {
  background: rgba(255, 255, 255, 0.94);
  border-radius: 18px;
  padding: 10px 14px 12px;
  box-shadow: 0 4px 0 rgba(13, 42, 82, 0.28);
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.slot-no {
  align-self: flex-start;
  font-size: 11px;
  font-weight: 900;
  letter-spacing: 0.12em;
  color: #fff;
  background: #1a6fc2;
  border-radius: 999px;
  padding: 1px 10px;
}
.slot-main {
  display: flex;
  align-items: center;
  gap: 10px;
}
.slot-face {
  width: 46px;
  height: 46px;
}
.slot-chapter {
  font-size: 12px;
  font-weight: 800;
  color: #237d2e;
}
.slot-name {
  font-size: 17px;
  font-weight: 900;
}
.slot-name small {
  margin-left: 6px;
  font-size: 12px;
  color: #5f6f86;
}
.slot-meta,
.slot-empty {
  font-size: 12px;
  color: #5f6f86;
}
.actions {
  display: flex;
  gap: 8px;
  margin-top: 4px;
}
.actions button {
  flex: 1;
}
.saved {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  background: rgba(255, 255, 255, 0.94);
  color: var(--ink);
  border-radius: 16px;
  padding: 8px 14px 8px 8px;
  font-size: 14px;
  font-weight: 900;
  text-align: left;
  box-shadow: inset 0 0 0 2px #ffd38a, 0 4px 0 rgba(0, 0, 0, 0.12);
}
.saved img {
  width: 40px;
  height: 40px;
}
.saved span {
  flex: 1;
  display: flex;
  flex-direction: column;
}
.saved span small {
  font-size: 11px;
  color: var(--ink-soft);
  font-weight: 700;
}
.saved > b {
  font-size: 22px;
  color: #c96a00;
}
.saved > b small {
  font-size: 12px;
}
.note {
  margin: 0;
  font-size: 12px;
  color: #fff;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6);
}
.links {
  margin-top: auto;
  display: flex;
  justify-content: center;
  gap: 18px;
  font-size: 12px;
}
.links a {
  color: #fff;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6);
}
</style>
