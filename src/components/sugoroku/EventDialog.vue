<script setup lang="ts">
// イベントの会話ウィンドウ（顔＋名前＋セリフ＋選択肢）
import { computed, onMounted, ref } from 'vue'
import { useGameStore } from '@/stores/game'
import type { EventInstance } from '@/game/types'
import FaceIcon from '../FaceIcon.vue'
import GameIcon from '../GameIcon.vue'
import type { IconName } from '../icons'
import PlayerSheet from '../PlayerSheet.vue'
import { hasPortrait, portraitUrl } from '@/game/story/art'
import type { CharId } from '@/game/story/types'

const props = defineProps<{ event: EventInstance }>()
const emit = defineEmits<{ done: [choice: number] }>()
const game = useGameStore()

const step = ref(0)
const viewing = ref<string | null>(null)

/** 能力を確認できる選手（古いセーブでは話し手の選手） */
const related = computed(() => {
  const ids = props.event.relatedPlayerIds ?? (props.event.speaker.kind === 'player' ? [props.event.speaker.playerId] : [])
  return ids.map((id) => game.player(id)).filter((p): p is NonNullable<typeof p> => !!p)
})
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
const avatar = computed<{ icon: IconName; color: string }>(() => {
  const k = props.event.speaker.kind
  if (k === 'manager') return { icon: 'clipboard', color: '#ff8fb1' }
  if (k === 'principal') return { icon: 'school', color: '#5f6f86' }
  if (k === 'ob') return { icon: 'trophy', color: '#e9a400' }
  if (k === 'local') return { icon: 'megaphone', color: '#ff7a2e' }
  return { icon: 'sparkle', color: '#3aa8f0' }
})

const atChoices = computed(() => step.value >= props.event.lines.length && chosen.value === null)
const text = computed(() => (chosen.value !== null ? props.event.choices[chosen.value]!.result : props.event.lines[step.value] ?? ''))

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
}

onMounted(() => typeOut(text.value))
</script>

<template>
  <div class="ev-backdrop">
    <div class="title-bar">{{ event.title }}</div>
    <div class="ev">
      <div class="speaker">
        <FaceIcon v-if="player" :face="player.face" :size="74" />
        <img v-else-if="portrait" class="portrait" :src="portrait" alt="" />
        <div v-else-if="event.speaker.kind !== 'narration'" class="avatar" :style="{ background: avatar.color }">
          <GameIcon :name="avatar.icon" :size="38" />
        </div>
      </div>
      <div class="window" @click="next">
        <div v-if="speakerName" class="name">{{ speakerName }}</div>
        <p class="line">{{ shown }}<span v-if="!atChoices && shown.length >= text.length" class="caret">▼</span></p>
      </div>
      <div v-if="related.length" class="related">
        <button v-for="rp in related" :key="rp.id" class="secondary look" @click.stop="viewing = rp.id">
          <GameIcon name="search" :size="14" /> {{ rp.surname }}の能力を見る
        </button>
      </div>
      <div v-if="atChoices" class="choices">
        <button v-for="(c, i) in event.choices" :key="i" class="choice" @click="choose(i)">{{ c.label }}</button>
      </div>
    </div>
    <PlayerSheet v-if="viewing" :player-id="viewing" @close="viewing = null" />
  </div>
</template>

<style scoped>
.portrait {
  width: 74px;
  height: 74px;
  border-radius: 50%;
  object-fit: cover;
  object-position: 50% 8%;
  background: linear-gradient(180deg, #fff3e6, #ffd9b8);
  box-shadow: 0 0 0 3px #fff, 0 3px 0 3px rgba(0, 0, 0, 0.18);
}
.ev-backdrop {
  position: fixed;
  inset: 0;
  z-index: 75;
  background: linear-gradient(180deg, rgba(10, 25, 45, 0.25), rgba(10, 25, 45, 0.6));
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  padding: 16px 12px calc(16px + var(--safe-bottom));
}
.title-bar {
  align-self: center;
  margin-bottom: auto;
  margin-top: 30vh;
  background: linear-gradient(180deg, #ff7fb5, #ff4f97);
  color: #fff;
  font-weight: 900;
  font-size: 20px;
  padding: 6px 26px;
  border-radius: 999px;
  box-shadow: 0 0 0 3px #fff, 0 5px 0 3px #c2185b;
  animation: pop-in 0.35s ease-out;
}
.ev {
  max-width: 640px;
  width: 100%;
  margin: 0 auto;
  animation: float-up 0.3s ease-out;
}
.speaker {
  margin-left: 12px;
  margin-bottom: -16px;
  position: relative;
  z-index: 2;
  width: fit-content;
}
.avatar {
  width: 74px;
  height: 74px;
  border-radius: 50%;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 0 0 3px #fff, 0 3px 0 3px rgba(0, 0, 0, 0.15);
}
.window {
  background: rgba(255, 255, 255, 0.97);
  border-radius: 18px;
  padding: 22px 16px 14px;
  min-height: 120px;
  box-shadow: 0 0 0 3px #ffd0e4, 0 0 0 6px #fff, 0 12px 24px rgba(0, 0, 0, 0.25);
}
.name {
  display: inline-block;
  font-weight: 900;
  color: #fff;
  background: var(--navy);
  border-radius: 8px;
  padding: 1px 10px;
  font-size: 13px;
  margin-bottom: 6px;
}
.line {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  line-height: 1.7;
  min-height: 3.4em;
}
.caret {
  color: var(--sky);
  margin-left: 4px;
  animation: blink 0.8s steps(2) infinite;
}
.related {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
}
.look {
  padding: 7px 12px;
  font-size: 13px;
}
.choices {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 12px;
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
