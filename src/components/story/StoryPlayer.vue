<script setup lang="ts">
// ストーリーの会話画面：背景・立ち絵・名前・台詞を出し、タップで進める
// 場面の始まりは暗転して中央にタイトル、背景の切り替えは暗転、時間や場所が飛ぶところはタイトルコール
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useGameStore } from '@/stores/game'
import { useUiStore } from '@/stores/ui'
import { bgUrl, cgUrl, facingOf, hasPortrait, isLeftSide, nameColor, portraitUrl } from '@/game/story/art'
import { sceneSub } from '@/game/story/engine'
import type { CharId, ChoiceStep, Face, SayStep, Step } from '@/game/story/types'

const game = useGameStore()
const ui = useUiStore()

interface Slot {
  char: CharId
  face: Face | undefined
}

interface Cut {
  /** scene：場面の始まり　title：場面の途中のタイトルコール */
  kind: 'scene' | 'title'
  text: string
  sub: string
}

/** 暗転・明転の時間（ミリ秒） */
const FADE_MS = 340
/** 場面タイトルを出しておく時間 */
const SCENE_CUT_MS = 1700
/** タイトルコールを出しておく時間（タップでも進む） */
const TITLE_CUT_MS = 2400

/** 流す台本（選択肢を選ぶと、その続きが差し込まれる） */
const queue = ref<Step[]>([])
const index = ref(0)
const picks: number[] = []
const bg = ref<string | null>(null)
const cg = ref<string | null>(null)
const left = ref<Slot | null>(null)
const right = ref<Slot | null>(null)
const shown = ref('')
const typing = ref(false)
const finishing = ref(false)
/** 画面全体を黒で覆う（暗転） */
const dark = ref(true)
/** 中央のタイトル */
const cut = ref<Cut | null>(null)
/** 暗転中など、タップを受け付けない */
const locked = ref(false)
/** 左上に出す、今の場面の名前 */
const sceneLabel = ref('')

let timer: number | null = null
let cutTimer: number | null = null
/** 新しい場面が始まったら、前の場面の待ちを無効にするための番号 */
let run = 0

const current = computed<Step | null>(() => queue.value[index.value] ?? null)
const say = computed<SayStep | null>(() => (!cut.value && current.value?.kind === 'say' ? current.value : null))
const choice = computed<ChoiceStep | null>(() => (!cut.value && !locked.value && current.value?.kind === 'choice' ? current.value : null))
const narr = computed(() => (!cut.value && current.value?.kind === 'narr' ? current.value.text : null))
const speaker = computed<CharId | null>(() => say.value?.char ?? null)
/** 選択肢を出している間も、直前の台詞（問いかけ）を残して見せる */
const askLine = computed<SayStep | { kind: 'narr'; text: string } | null>(() => {
  if (!choice.value) return null
  for (let i = index.value - 1; i >= 0; i--) {
    const st = queue.value[i]
    if (!st) break
    if (st.kind === 'say') return st
    if (st.kind === 'narr') return { kind: 'narr', text: st.text }
    if (st.kind === 'title' || st.kind === 'choice') break
  }
  return null
})

function wait(ms: number): Promise<void> {
  return new Promise((r) => window.setTimeout(r, ms))
}

function stopTyping(): void {
  if (timer !== null) window.clearInterval(timer)
  timer = null
  typing.value = false
}

function clearCutTimer(): void {
  if (cutTimer !== null) window.clearTimeout(cutTimer)
  cutTimer = null
}

function typeText(text: string): void {
  stopTyping()
  shown.value = ''
  typing.value = true
  let i = 0
  timer = window.setInterval(() => {
    i += 1
    shown.value = text.slice(0, i)
    if (i >= text.length) stopTyping()
  }, 28)
}

/** 立ち絵を置く：主人公は左、それ以外は右 */
function place(char: CharId, face: Face | undefined): void {
  if (!hasPortrait(char)) return
  const slot = { char, face }
  if (left.value?.char === char) left.value = slot
  else if (right.value?.char === char) right.value = slot
  else if (isLeftSide(char)) left.value = slot
  else right.value = slot
}

function applyBg(name: string | null, cgName: string | null | undefined): void {
  bg.value = name
  cg.value = cgName ?? null
  left.value = null
  right.value = null
}

/** 暗転して背景を切り替え、明るくする */
async function changeBg(name: string | null, cgName: string | null | undefined, my: number): Promise<boolean> {
  locked.value = true
  stopTyping()
  shown.value = ''
  if (!dark.value) {
    dark.value = true
    await wait(FADE_MS)
    if (my !== run) return false
  }
  applyBg(name, cgName)
  await wait(80)
  if (my !== run) return false
  dark.value = false
  await wait(FADE_MS)
  if (my !== run) return false
  locked.value = false
  return true
}

/** 中央にタイトルを出す。時間が来るかタップで閉じる */
function showCut(c: Cut, ms: number, then: () => void): void {
  clearCutTimer()
  stopTyping()
  shown.value = ''
  cut.value = c
  cutTimer = window.setTimeout(() => closeCut(then), ms)
  pendingAfterCut = then
}
let pendingAfterCut: (() => void) | null = null

function closeCut(then?: () => void): void {
  clearCutTimer()
  if (!cut.value) return
  cut.value = null
  const next = then ?? pendingAfterCut
  pendingAfterCut = null
  next?.()
}

/** 今の行を表示する。背景の切り替えとタイトルコールはその場で処理する */
async function enter(): Promise<void> {
  const my = run
  for (;;) {
    const s = queue.value[index.value]
    if (!s) {
      void finish()
      return
    }
    if (s.kind === 'bg') {
      const ok = await changeBg(s.bg, s.cg, my)
      if (!ok) return
      index.value += 1
      continue
    }
    if (s.kind === 'title') {
      showCut({ kind: 'title', text: s.text, sub: s.sub ?? '' }, TITLE_CUT_MS, () => {
        index.value += 1
        void enter()
      })
      return
    }
    // 暗いままなら明るくしてから台詞へ
    if (dark.value) {
      locked.value = true
      dark.value = false
      await wait(FADE_MS)
      if (my !== run) return
      locked.value = false
    }
    if (s.kind === 'say') {
      if (s.char) place(s.char, s.face)
      typeText(s.think ? `（${s.text}）` : s.text)
    } else if (s.kind === 'narr') {
      typeText(s.text)
    } else {
      stopTyping()
    }
    return
  }
}

function advance(): void {
  if (finishing.value || locked.value) return
  if (cut.value) {
    closeCut()
    return
  }
  if (choice.value) return
  if (typing.value) {
    stopTyping()
    const s = current.value
    if (s?.kind === 'say') shown.value = s.think ? `（${s.text}）` : s.text
    else if (s?.kind === 'narr') shown.value = s.text
    return
  }
  index.value += 1
  void enter()
}

function pick(i: number): void {
  const c = choice.value
  if (!c) return
  const opt = c.options[i] ?? c.options[0]!
  picks.push(i)
  queue.value = [...queue.value.slice(0, index.value + 1), ...opt.reply, ...queue.value.slice(index.value + 1)]
  index.value += 1
  void enter()
}

/** 次の選択肢か、場面の終わりまで飛ばす */
function skip(): void {
  if (finishing.value) return
  run += 1
  stopTyping()
  clearCutTimer()
  cut.value = null
  pendingAfterCut = null
  locked.value = false
  for (;;) {
    const s = queue.value[index.value]
    if (!s) {
      void finish()
      return
    }
    if (s.kind === 'choice') {
      dark.value = false
      void enter()
      return
    }
    if (s.kind === 'bg') applyBg(s.bg, s.cg)
    index.value += 1
  }
}

async function finish(): Promise<void> {
  if (finishing.value) return
  finishing.value = true
  stopTyping()
  clearCutTimer()
  cut.value = null
  // 暗転してから閉じる
  dark.value = true
  await wait(FADE_MS)
  const title = game.story?.scene.title ?? ''
  await game.finishStory(picks, (messages) => {
    if (messages.length) ui.notify({ title, message: messages.join('\n'), tone: 'good', duration: 2600 + messages.length * 900 })
  })
}

function preload(steps: Step[]): void {
  for (const s of steps) {
    if (s.kind === 'bg') {
      if (s.bg) new Image().src = bgUrl(s.bg)
      if (s.cg) new Image().src = cgUrl(s.cg)
    } else if (s.kind === 'say' && s.char && hasPortrait(s.char)) new Image().src = portraitUrl(s.char, s.face)
    else if (s.kind === 'choice') for (const o of s.options) preload(o.reply)
  }
}

function start(): void {
  const st = game.story
  if (!st) return
  run += 1
  stopTyping()
  clearCutTimer()
  queue.value = [...st.steps]
  index.value = 0
  picks.length = 0
  applyBg(null, null)
  finishing.value = false
  locked.value = false
  dark.value = true
  shown.value = ''
  preload(st.steps)
  const sub = game.save ? sceneSub(game.save, st.scene) : ''
  sceneLabel.value = st.scene.title
  // 暗転したまま、中央に場面のタイトル
  showCut({ kind: 'scene', text: st.scene.title, sub }, SCENE_CUT_MS, () => void enter())
}

watch(
  () => game.story,
  (v) => {
    if (v) start()
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  run += 1
  stopTyping()
  clearCutTimer()
})

/** 立ち絵の向き：左の人物は右向き、右の人物は左向きにして、向かい合って話しているように見せる */
function flipStyle(char: CharId, side: 'left' | 'right'): Record<string, string> {
  const f = facingOf(char)
  const flip = (side === 'left' && f === 'left') || (side === 'right' && f === 'right')
  return { '--sx': flip ? '-1' : '1' }
}

const bgStyle = computed(() => (bg.value ? { backgroundImage: `url(${bgUrl(bg.value)})` } : {}))
</script>

<template>
  <div v-if="game.story" class="story" @click="advance">
    <div class="bg" :class="{ dark: !bg && !cg }" :style="bgStyle" />
    <img v-if="cg" class="cg" :src="cgUrl(cg)" alt="" />

    <div class="stage">
      <Transition name="fig">
        <img
          v-if="left"
          :key="`l-${left.char}`"
          class="fig left"
          :class="{ dim: speaker !== left.char }"
          :style="flipStyle(left.char, 'left')"
          :src="portraitUrl(left.char, left.face)"
          alt=""
        />
      </Transition>
      <Transition name="fig">
        <img
          v-if="right"
          :key="`r-${right.char}`"
          class="fig right"
          :class="{ dim: speaker !== right.char }"
          :style="flipStyle(right.char, 'right')"
          :src="portraitUrl(right.char, right.face)"
          alt=""
        />
      </Transition>
    </div>

    <div v-if="choice" class="choices" @click.stop>
      <button v-for="(o, i) in choice.options" :key="i" class="choice" @click="pick(i)">{{ o.label }}</button>
    </div>

    <div v-if="askLine && askLine.kind === 'narr'" class="narr">
      <p>{{ askLine.text }}</p>
    </div>
    <div v-else-if="askLine && askLine.kind === 'say'" class="window" :class="{ think: askLine.think }">
      <div class="name" :style="{ background: nameColor(askLine.char) }">{{ askLine.name }}</div>
      <p class="text">{{ askLine.think ? `（${askLine.text}）` : askLine.text }}</p>
    </div>
    <div v-else-if="narr !== null" class="narr">
      <p>{{ shown }}</p>
    </div>
    <div v-else-if="say" class="window" :class="{ think: say.think }">
      <div class="name" :style="{ background: nameColor(say.char) }">{{ say.name }}</div>
      <p class="text">{{ shown }}<span v-if="!typing" class="next">▼</span></p>
    </div>

    <!-- 暗転 -->
    <div class="curtain" :class="{ on: dark }" />
    <!-- タイトルコールの間は、背景を暗くする -->
    <div class="dim-layer" :class="{ on: cut?.kind === 'title' && !dark }" />

    <Transition name="cut">
      <div v-if="cut" :key="`${cut.kind}-${cut.text}`" class="cut" :class="cut.kind">
        <div class="cut-band">
          <span v-if="cut.sub" class="cut-sub">{{ cut.sub }}</span>
          <span class="cut-text">{{ cut.text }}</span>
        </div>
      </div>
    </Transition>

    <div v-if="sceneLabel && !(cut && cut.kind === 'scene')" class="scene-label">{{ sceneLabel }}</div>
    <button class="skip" @click.stop="skip">スキップ ▶▶</button>
  </div>
</template>

<style scoped>
.story {
  position: fixed;
  inset: 0;
  z-index: 90;
  overflow: hidden;
  background: #05090f;
  user-select: none;
  -webkit-user-select: none;
  cursor: pointer;
}
.bg {
  position: absolute;
  inset: 0;
  background-size: cover;
  background-position: center;
}
.bg.dark {
  background: radial-gradient(ellipse at 50% 40%, #1f3352, #070d18 75%);
}
.cg {
  position: absolute;
  left: 0;
  right: 0;
  top: 12%;
  width: 100%;
  max-width: 720px;
  margin: 0 auto;
  border-radius: 6px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.6);
}
.stage {
  position: absolute;
  left: 0;
  right: 0;
  bottom: calc(150px + var(--safe-bottom));
  height: min(62vw, 360px);
  max-width: 720px;
  margin: 0 auto;
  pointer-events: none;
}
.fig {
  position: absolute;
  bottom: 0;
  width: min(62vw, 360px);
  height: auto;
  filter: drop-shadow(0 6px 14px rgba(0, 0, 0, 0.35));
  transform: scaleX(var(--sx, 1));
  transform-origin: bottom center;
  transition: filter 0.25s, transform 0.25s;
}
.fig.left {
  left: -4%;
}
.fig.right {
  right: -4%;
}
.fig.dim {
  filter: brightness(0.55) drop-shadow(0 6px 14px rgba(0, 0, 0, 0.35));
  transform: scaleX(var(--sx, 1)) scale(0.96);
  transform-origin: bottom center;
}
.fig-enter-active,
.fig-leave-active {
  transition: opacity 0.3s, transform 0.3s;
}
.fig-enter-from,
.fig-leave-to {
  opacity: 0;
  transform: translateY(12px);
}

/* ---- 暗転 ---- */
.curtain {
  position: absolute;
  inset: 0;
  background: #05090f;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.34s ease;
  z-index: 5;
}
.curtain.on {
  opacity: 1;
}
.dim-layer {
  position: absolute;
  inset: 0;
  background: rgba(5, 9, 15, 0.6);
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.3s ease;
  z-index: 4;
}
.dim-layer.on {
  opacity: 1;
}

/* ---- 中央のタイトル ---- */
.cut {
  position: absolute;
  left: 0;
  right: 0;
  top: 50%;
  transform: translateY(-50%);
  z-index: 6;
  pointer-events: none;
}
.cut-band {
  position: relative;
  margin: 0 auto;
  max-width: 720px;
  padding: 18px 20px 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  background: linear-gradient(90deg, rgba(14, 30, 58, 0), rgba(14, 30, 58, 0.92) 18%, rgba(14, 30, 58, 0.92) 82%, rgba(14, 30, 58, 0));
}
.cut-band::before,
.cut-band::after {
  content: '';
  position: absolute;
  left: 12%;
  right: 12%;
  height: 2px;
  background: linear-gradient(90deg, transparent, #f2c14e 20%, #f2c14e 80%, transparent);
}
.cut-band::before {
  top: 0;
}
.cut-band::after {
  bottom: 0;
}
.cut-sub {
  color: #f2c14e;
  font-size: 13px;
  font-weight: 800;
  letter-spacing: 0.2em;
}
.cut-text {
  color: #fff;
  font-size: 26px;
  font-weight: 900;
  letter-spacing: 0.14em;
  text-shadow: 0 2px 10px rgba(0, 0, 0, 0.6);
  text-align: center;
}
.cut.scene .cut-text {
  font-size: 28px;
}
.cut-enter-active {
  transition: opacity 0.35s ease, transform 0.45s cubic-bezier(0.2, 0.8, 0.2, 1);
}
.cut-leave-active {
  transition: opacity 0.3s ease, transform 0.3s ease;
}
.cut-enter-from {
  opacity: 0;
  transform: translate(-40px, -50%);
}
.cut-leave-to {
  opacity: 0;
  transform: translate(40px, -50%);
}

/* ---- 左上の場面名とスキップ ---- */
.scene-label {
  position: absolute;
  top: calc(14px + env(safe-area-inset-top, 0px));
  left: 10px;
  max-width: 58%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  background: rgba(10, 20, 38, 0.72);
  color: #fff;
  font-weight: 800;
  font-size: 12px;
  padding: 5px 12px 5px 10px;
  border-radius: 6px;
  border-left: 3px solid #f2c14e;
  z-index: 7;
}
.skip {
  position: absolute;
  top: calc(12px + env(safe-area-inset-top, 0px));
  right: 10px;
  background: rgba(10, 20, 38, 0.6);
  color: #fff;
  border: 0;
  font-size: 12px;
  font-weight: 700;
  padding: 5px 12px;
  border-radius: 999px;
  box-shadow: none;
  z-index: 7;
}

/* ---- 台詞 ---- */
.window {
  position: absolute;
  left: 10px;
  right: 10px;
  bottom: calc(14px + var(--safe-bottom));
  max-width: 700px;
  margin: 0 auto;
  min-height: 128px;
  background: rgba(255, 255, 255, 0.96);
  border-radius: 16px;
  padding: 24px 16px 14px;
  box-shadow: 0 0 0 3px #fff, 0 0 0 5px rgba(23, 50, 87, 0.35), 0 10px 24px rgba(0, 0, 0, 0.35);
}
.window.think {
  background: rgba(235, 243, 255, 0.96);
}
.name {
  position: absolute;
  top: -14px;
  left: 14px;
  color: #fff;
  font-weight: 900;
  font-size: 14px;
  padding: 3px 14px;
  border-radius: 999px;
  box-shadow: 0 0 0 2px #fff;
}
.text {
  margin: 0;
  font-size: 15.5px;
  line-height: 1.75;
  color: var(--ink);
  white-space: pre-wrap;
}
.window.think .text {
  color: #2d4a73;
}
.next {
  display: inline-block;
  margin-left: 4px;
  font-size: 11px;
  color: var(--sky-deep);
  animation: bob 0.9s ease-in-out infinite;
}
.narr {
  position: absolute;
  left: 0;
  right: 0;
  bottom: calc(40px + var(--safe-bottom));
  padding: 14px 22px;
  background: linear-gradient(90deg, rgba(5, 12, 24, 0), rgba(5, 12, 24, 0.82) 15%, rgba(5, 12, 24, 0.82) 85%, rgba(5, 12, 24, 0));
}
.narr p {
  margin: 0 auto;
  max-width: 640px;
  color: #fff;
  font-size: 14.5px;
  line-height: 1.8;
  text-align: left;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.6);
}
.choices {
  position: absolute;
  left: 16px;
  right: 16px;
  top: 30%;
  max-width: 560px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
  z-index: 3;
}
.choice {
  background: linear-gradient(180deg, #fff, #eef6ff);
  color: var(--ink);
  font-weight: 800;
  font-size: 15px;
  padding: 14px 16px;
  border-radius: 14px;
  box-shadow: 0 0 0 3px var(--sky), 0 5px 0 3px var(--sky-deep);
  animation: fade-in 0.3s ease-out;
}
@keyframes bob {
  50% {
    transform: translateY(3px);
  }
}
@keyframes fade-in {
  from {
    opacity: 0;
  }
}
</style>
