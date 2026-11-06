<script setup lang="ts">
// ストーリーの会話画面：背景・立ち絵・名前・台詞を出し、タップで進める
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useGameStore } from '@/stores/game'
import { useUiStore } from '@/stores/ui'
import { bgUrl, cgUrl, isLeftSide, nameColor, portraitUrl } from '@/game/story/art'
import { CHAPTER_TITLES } from '@/game/story/engine'
import type { CharId, ChoiceStep, Face, SayStep, Step } from '@/game/story/types'

const game = useGameStore()
const ui = useUiStore()

interface Slot {
  char: CharId
  face: Face | undefined
}

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
const banner = ref<string | null>(null)
const finishing = ref(false)
let timer: number | null = null
let bannerTimer: number | null = null

const current = computed<Step | null>(() => queue.value[index.value] ?? null)
const say = computed<SayStep | null>(() => (current.value?.kind === 'say' ? current.value : null))
const choice = computed<ChoiceStep | null>(() => (current.value?.kind === 'choice' ? current.value : null))
const narr = computed(() => (current.value?.kind === 'narr' ? current.value.text : null))
const speaker = computed<CharId | null>(() => say.value?.char ?? null)

function stopTyping(): void {
  if (timer !== null) window.clearInterval(timer)
  timer = null
  typing.value = false
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
  const slot = { char, face }
  if (left.value?.char === char) left.value = slot
  else if (right.value?.char === char) right.value = slot
  else if (isLeftSide(char)) left.value = slot
  else right.value = slot
}

/** 今の行を表示する。背景の切り替えはその場で処理して次へ進む */
function enter(): void {
  for (;;) {
    const s = queue.value[index.value]
    if (!s) {
      void finish()
      return
    }
    if (s.kind === 'bg') {
      bg.value = s.bg
      cg.value = s.cg ?? null
      left.value = null
      right.value = null
      index.value += 1
      continue
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
  if (finishing.value || choice.value) return
  if (typing.value) {
    stopTyping()
    const s = current.value
    if (s?.kind === 'say') shown.value = s.think ? `（${s.text}）` : s.text
    else if (s?.kind === 'narr') shown.value = s.text
    return
  }
  index.value += 1
  enter()
}

function pick(i: number): void {
  const c = choice.value
  if (!c) return
  const opt = c.options[i] ?? c.options[0]!
  picks.push(i)
  queue.value = [...queue.value.slice(0, index.value + 1), ...opt.reply, ...queue.value.slice(index.value + 1)]
  index.value += 1
  enter()
}

/** 次の選択肢か、場面の終わりまで飛ばす */
function skip(): void {
  stopTyping()
  for (;;) {
    const s = queue.value[index.value]
    if (!s) {
      void finish()
      return
    }
    if (s.kind === 'choice') {
      enter()
      return
    }
    if (s.kind === 'bg') {
      bg.value = s.bg
      cg.value = s.cg ?? null
      left.value = null
      right.value = null
    }
    index.value += 1
  }
}

async function finish(): Promise<void> {
  if (finishing.value) return
  finishing.value = true
  stopTyping()
  const title = game.story?.scene.title ?? ''
  const messages = await game.finishStory(picks)
  if (messages.length) ui.notify({ title, message: messages.join('\n'), tone: 'good', duration: 2600 + messages.length * 900 })
}

function start(): void {
  const st = game.story
  if (!st) return
  queue.value = [...st.steps]
  index.value = 0
  picks.length = 0
  bg.value = null
  cg.value = null
  left.value = null
  right.value = null
  finishing.value = false
  // 使う絵を先に読み込んでおく
  for (const s of st.steps) {
    if (s.kind === 'bg') {
      if (s.bg) new Image().src = bgUrl(s.bg)
      if (s.cg) new Image().src = cgUrl(s.cg)
    } else if (s.kind === 'say' && s.char) new Image().src = portraitUrl(s.char, s.face)
  }
  const chapter = CHAPTER_TITLES[game.save?.story?.chapter ?? 1] ?? ''
  banner.value = `${chapter}　${st.scene.title}`
  if (bannerTimer !== null) window.clearTimeout(bannerTimer)
  bannerTimer = window.setTimeout(() => (banner.value = null), 2200)
  enter()
}

watch(
  () => game.story,
  (v) => {
    if (v) start()
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  stopTyping()
  if (bannerTimer !== null) window.clearTimeout(bannerTimer)
})

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
          :src="portraitUrl(right.char, right.face)"
          alt=""
        />
      </Transition>
    </div>

    <Transition name="banner">
      <div v-if="banner" class="banner">{{ banner }}</div>
    </Transition>

    <button class="skip" @click.stop="skip">スキップ ▶▶</button>

    <div v-if="choice" class="choices" @click.stop>
      <button v-for="(o, i) in choice.options" :key="i" class="choice" @click="pick(i)">{{ o.label }}</button>
    </div>

    <div v-if="narr !== null" class="narr">
      <p>{{ shown }}</p>
    </div>
    <div v-else-if="say" class="window" :class="{ think: say.think }">
      <div class="name" :style="{ background: nameColor(say.char) }">{{ say.name }}</div>
      <p class="text">{{ shown }}<span v-if="!typing" class="next">▼</span></p>
    </div>
  </div>
</template>

<style scoped>
.story {
  position: fixed;
  inset: 0;
  z-index: 90;
  overflow: hidden;
  background: #0b1424;
  user-select: none;
  -webkit-user-select: none;
  cursor: pointer;
}
.bg {
  position: absolute;
  inset: 0;
  background-size: cover;
  background-position: center;
  transition: background-image 0.4s;
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
  animation: fade-in 0.6s ease-out;
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
  transform: scale(0.96);
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
.banner {
  position: absolute;
  top: calc(18px + env(safe-area-inset-top, 0px));
  left: 50%;
  transform: translateX(-50%);
  background: rgba(10, 20, 38, 0.82);
  color: #fff;
  font-weight: 800;
  font-size: 14px;
  padding: 6px 18px;
  border-radius: 999px;
  white-space: nowrap;
  box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.35);
}
.banner-enter-active,
.banner-leave-active {
  transition: opacity 0.4s;
}
.banner-enter-from,
.banner-leave-to {
  opacity: 0;
}
.skip {
  position: absolute;
  top: calc(60px + env(safe-area-inset-top, 0px));
  right: 10px;
  background: rgba(10, 20, 38, 0.6);
  color: #fff;
  border: 0;
  font-size: 12px;
  font-weight: 700;
  padding: 5px 12px;
  border-radius: 999px;
  box-shadow: none;
}
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
  text-align: center;
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
