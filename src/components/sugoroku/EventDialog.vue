<script setup lang="ts">
// イベントの会話ウィンドウ（顔＋名前＋セリフ＋選択肢）
import { useBack } from '@/back'
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useUiStore } from '@/stores/ui'
import { moodOf, segments } from '@/effectText'
import { play } from '@/sound'
import { useGameStore } from '@/stores/game'
import type { EventInstance } from '@/game/types'
import FaceIcon from '../FaceIcon.vue'
import GameIcon from '../GameIcon.vue'
import type { IconName } from '../icons'
import { bgUrl, facingOf, hasPortrait, portraitUrl } from '@/game/story/art'
import type { CharId, Face } from '@/game/story/types'

const props = defineProps<{ event: EventInstance }>()
const emit = defineEmits<{ done: [choice: number] }>()
const game = useGameStore()

const step = ref(0)
const shown = ref('')
const chosen = ref<number | null>(null)
let typing: ReturnType<typeof setInterval> | undefined

const player = computed(() => (props.event.speaker.kind === 'player' ? game.player(props.event.speaker.playerId) : null))
const speakerName = computed(() => {
  const s = props.event.speaker
  if (s.kind === 'player') return player.value ? `${player.value.surname} ${player.value.givenName}` : ''
  return s.name
})
/** ストーリーの人物の顔（ナギ・源造・レイカなど） */
const portrait = computed(() => {
  const s = props.event.speaker
  if (s.kind === 'player' || !s.portrait || !game.save?.story?.enabled || !hasPortrait(s.portrait as CharId)) return null
  return portraitUrl(s.portrait as CharId, 'smile')
})
/** 背景と立ち絵（選手育成モードの行事・合宿などの場面） */
const bgStyle = computed(() => (props.event.bg && game.save?.story?.enabled ? { backgroundImage: `linear-gradient(180deg, rgba(10, 25, 45, 0.05), rgba(10, 25, 45, 0.45)), url(${bgUrl(props.event.bg)})` } : undefined))
/**
 * 立ち絵。並んだ位置に合わせて、真ん中を向くように左右を反転する
 * （左に立つ人は右向き、右に立つ人は左向き。1人のときと3人の真ん中はそのまま）
 */
const cast = computed(() => {
  if (!game.save?.story?.enabled) return []
  const list = (props.event.cast ?? []).filter((c) => hasPortrait(c.char as CharId))
  return list.map((c, i) => {
    const side = list.length === 1 || (list.length === 3 && i === 1) ? 'center' : i === 0 ? 'left' : 'right'
    const f = facingOf(c.char as CharId)
    const flip = (side === 'left' && f === 'left') || (side === 'right' && f === 'right')
    return { url: portraitUrl(c.char as CharId, c.face as Face | undefined), flip }
  })
})
const avatar = computed<{ icon: IconName; color: string }>(() => {
  const k = props.event.speaker.kind
  if (k === 'manager') return { icon: 'clipboard', color: '#ff8fb1' }
  if (k === 'principal') return { icon: 'school', color: '#5f6f86' }
  if (k === 'ob') return { icon: 'trophy', color: '#e9a400' }
  if (k === 'local') return { icon: 'megaphone', color: '#ff7a2e' }
  return { icon: 'sparkle', color: '#3aa8f0' }
})

const atChoices = computed(() => step.value >= props.event.lines.length && chosen.value === null)
const text = computed(() => (chosen.value !== null ? props.event.choices[chosen.value]!.result : props.event.lines[Math.min(step.value, props.event.lines.length - 1)] ?? ''))

function typeOut(full: string): void {
  clearInterval(typing)
  shown.value = ''
  let i = 0
  typing = setInterval(() => {
    i += 1
    shown.value = full.slice(0, i)
    if (i >= full.length) clearInterval(typing)
  }, 28)
}

/** 吹き出しの大きさは一定。長い文は、流れるように下へ送る */
const lineEl = ref<HTMLElement | null>(null)
watch(shown, () => {
  void nextTick(() => {
    const el = lineEl.value
    if (el) el.scrollTop = el.scrollHeight
  })
})

function next(): void {
  if (shown.value.length < text.value.length) {
    clearInterval(typing)
    shown.value = text.value
    return
  }
  if (chosen.value !== null) {
    emit('done', chosen.value)
    return
  }
  if (step.value < props.event.lines.length - 1) {
    step.value += 1
    typeOut(text.value)
  } else step.value = props.event.lines.length
}

function choose(i: number): void {
  chosen.value = i
  typeOut(text.value)
  // 結果の良し悪しで効果音（部費が増えたらチャリン）
  const mood = moodOf(text.value)
  if (mood) play(mood)
}

/** 表示中の文を、良いこと（青）・悪いこと（赤）に色分けする（結果の文だけ） */
const shownSegs = computed(() => {
  const segs = chosen.value !== null ? segments(text.value) : [{ text: text.value, tone: null }]
  const out: { text: string; tone: string | null }[] = []
  let left = shown.value.length
  for (const sg of segs) {
    if (left <= 0) break
    out.push({ text: sg.text.slice(0, left), tone: sg.tone })
    left -= sg.text.length
  }
  return out
})

const ui = useUiStore()
// イベントの最中は戻るボタンを使わない（選ばずに閉じると進行が崩れるため）
useBack(() => true)
onMounted(() => {
  typeOut(text.value)
  if (props.event.bgm) ui.bgmOverride = props.event.bgm
})
onUnmounted(() => {
  if (props.event.bgm) ui.bgmOverride = null
})
</script>

<template>
  <div class="ev-backdrop" :class="{ scene: !!bgStyle }" :style="bgStyle">
    <div class="title-bar">{{ event.title }}</div>
    <!-- 立ち絵：吹き出しの後ろの決まった位置に立つ（吹き出しや選択肢が変わっても動かない） -->
    <div v-if="cast.length" class="cast" :class="`n${cast.length}`">
      <img
        v-for="(c, i) in cast"
        :key="i"
        :src="c.url"
        alt=""
        :class="{ flip: c.flip }"
        :style="{ animationDelay: `${0.15 + i * 0.12}s` }"
      />
    </div>
    <div class="ev">
      <div v-if="atChoices" class="choices">
        <button v-for="(c, i) in event.choices" :key="i" class="choice" @click="choose(i)">{{ c.label }}</button>
      </div>
      <!-- 立ち絵がないときだけ、話し手の顔を吹き出しの外に出す -->
      <div v-if="!cast.length && event.speaker.kind !== 'narration'" class="speaker">
        <FaceIcon v-if="player" :face="player.face" :size="56" />
        <img v-else-if="portrait" class="portrait" :src="portrait" alt="" />
        <div v-else class="avatar" :style="{ background: avatar.color }">
          <GameIcon :name="avatar.icon" :size="28" />
        </div>
      </div>
      <div class="window" @click="next">
        <div class="name" :class="{ empty: !speakerName }">{{ speakerName || '　' }}</div>
        <p ref="lineEl" class="line"><span v-for="(sg, i) in shownSegs" :key="i" :class="sg.tone ? `fx-${sg.tone}` : undefined">{{ sg.text }}</span><span v-if="!atChoices && shown.length >= text.length" class="caret">▼</span></p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ev-backdrop {
  --win-h: 138px;
  --win-bottom: calc(16px + var(--safe-bottom));
  position: fixed;
  inset: 0;
  z-index: 75;
  background: linear-gradient(180deg, rgba(10, 25, 45, 0.25), rgba(10, 25, 45, 0.6));
  display: flex;
  flex-direction: column;
  padding: 16px 12px var(--win-bottom);
}
.ev-backdrop.scene {
  background-size: cover;
  background-position: center;
  animation: scene-in 0.6s ease-out;
}
.title-bar {
  align-self: center;
  margin-top: 22vh;
  position: relative;
  z-index: 3;
  background: linear-gradient(180deg, #ff7fb5, #ff4f97);
  color: #fff;
  font-weight: 900;
  font-size: 20px;
  padding: 6px 26px;
  border-radius: 999px;
  box-shadow: 0 0 0 3px #fff, 0 5px 0 3px #c2185b;
  animation: pop-in 0.35s ease-out;
}
.ev-backdrop.scene .title-bar {
  margin-top: 10px;
}
/* 立ち絵は、吹き出しの上の端より少し下に足元をそろえ、高さを決めて描く */
.cast {
  position: absolute;
  left: 0;
  right: 0;
  bottom: calc(var(--win-bottom) + var(--win-h) - 36px);
  height: min(56vh, 100vw, 560px);
  display: flex;
  justify-content: center;
  align-items: flex-end;
  pointer-events: none;
  z-index: 1;
}
.cast img {
  height: 100%;
  max-width: 78%;
  object-fit: contain;
  object-position: bottom;
  filter: drop-shadow(0 6px 10px rgba(0, 0, 0, 0.25));
  animation: cast-in 0.5s ease-out both;
}
.cast img.flip {
  transform: scaleX(-1);
  animation-name: cast-in-flip;
}
.cast.n1 img {
  max-width: 100%;
}
/* 2人・3人のときは、高さをそろえて内側で少し重ねる（はみ出した肩は画面の外へ） */
.cast.n2,
.cast.n3 {
  overflow: hidden;
}
.cast.n2 img,
.cast.n3 img {
  flex: 0 0 auto;
  max-width: none;
}
.cast.n2 img {
  height: 82%;
}
.cast.n2 img + img {
  margin-left: -22%;
}
.cast.n3 img {
  height: 66%;
}
.cast.n3 img + img {
  margin-left: -16%;
}
@keyframes scene-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
@keyframes cast-in {
  from {
    opacity: 0;
    transform: translateY(14px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}
@keyframes cast-in-flip {
  from {
    opacity: 0;
    transform: scaleX(-1) translateY(14px);
  }
  to {
    opacity: 1;
    transform: scaleX(-1);
  }
}
/* 吹き出し・顔・選択肢は、画面の下から積む（吹き出しの位置と大きさは変わらない） */
.ev {
  position: absolute;
  left: 12px;
  right: 12px;
  bottom: var(--win-bottom);
  max-width: 640px;
  margin: 0 auto;
  z-index: 2;
  display: flex;
  flex-direction: column;
  animation: float-up 0.3s ease-out;
}
.speaker {
  margin: 0 0 8px 4px;
  width: fit-content;
}
.portrait {
  display: block;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  object-fit: cover;
  object-position: 50% 8%;
  background: linear-gradient(180deg, #fff3e6, #ffd9b8);
  box-shadow: 0 0 0 3px #fff, 0 3px 0 3px rgba(0, 0, 0, 0.18);
}
.avatar {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 0 0 3px #fff, 0 3px 0 3px rgba(0, 0, 0, 0.15);
}
.window {
  height: var(--win-h);
  box-sizing: border-box;
  background: rgba(255, 255, 255, 0.97);
  border-radius: 18px;
  padding: 12px 16px 10px;
  display: flex;
  flex-direction: column;
  box-shadow: 0 0 0 3px #ffd0e4, 0 0 0 6px #fff, 0 12px 24px rgba(0, 0, 0, 0.25);
}
.name {
  align-self: flex-start;
  font-weight: 900;
  color: #fff;
  background: var(--navy);
  border-radius: 8px;
  padding: 1px 10px;
  font-size: 13px;
  margin-bottom: 6px;
}
.name.empty {
  visibility: hidden;
}
.line {
  margin: 0;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  scroll-behavior: smooth;
  scrollbar-width: none;
  font-size: 16px;
  font-weight: 700;
  line-height: 1.7;
}
.line::-webkit-scrollbar {
  display: none;
}
.fx-good {
  color: #1565d8;
}
.fx-bad {
  color: #d32f2f;
}
.caret {
  color: var(--sky);
  margin-left: 4px;
  animation: blink 0.8s steps(2) infinite;
}
.choices {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 14px;
}
.choice {
  background-image: linear-gradient(180deg, rgba(255, 255, 255, 0.5), rgba(255, 255, 255, 0) 55%), linear-gradient(180deg, #ffffff, #fff0f6);
  color: #b0135a;
  text-shadow: none;
  box-shadow: inset 0 0 0 2.5px #ff8fbf, 0 4px 0 #ff8fbf, 0 8px 14px -6px rgba(0, 0, 0, 0.25);
  padding: 13px;
  font-size: 15px;
  animation: float-up 0.25s ease-out both;
}
.choice:nth-child(2) {
  animation-delay: 0.06s;
}
@keyframes blink {
  50% {
    opacity: 0;
  }
}
</style>
