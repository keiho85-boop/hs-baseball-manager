<script setup lang="ts">
// 操作のチュートリアル：説明する場所だけを明るく残し、ナギの吹き出しで案内する
// 'target' の手順では、明るい場所を実際に押すと次へ進む（それ以外の場所は押せない）
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useGameStore } from '@/stores/game'
import { useUiStore } from '@/stores/ui'
import { useGuideStore } from '@/stores/guide'
import { portraitUrl } from '@/game/story/art'

const game = useGameStore()
const ui = useUiStore()
const guide = useGuideStore()
const route = useRoute()
const router = useRouter()

/** タブで切り替えられる画面 */
const TAB_ROUTES = new Set(['home', 'players', 'team', 'school', 'records'])
/** 光らせる場所の余白 */
const PAD = 6

const rect = ref<{ x: number; y: number; w: number; h: number } | null>(null)
/** 光らせる場所が見つからないまま時間がたった（台詞だけ出して、タップで進めるようにする） */
const missing = ref(false)
let raf = 0
let missingTimer: number | null = null
let scrolledFor = ''

const step = computed(() => guide.step)

/** 週の処理・イベント・お知らせ・ストーリーの最中は隠す */
const blocked = computed(() => {
  void game.rev
  if (!game.save || game.story || game.showGrowth || ui.dialog || ui.notice) return true
  const s = step.value
  if (!s) return true
  if (s.route && route.name !== s.route) return true
  if (s.idle && (game.busy || !!game.save.sugoroku?.pending)) return true
  return false
})

const visible = computed(() => !!step.value && !blocked.value && (!!rect.value || !step.value.target || missing.value))

/** 案内する画面へ移る（タブの画面だけ。試合の画面は、移るまで待つ） */
watch(
  () => [step.value, route.name, game.story, game.showGrowth] as const,
  () => {
    const s = step.value
    if (!s?.route || route.name === s.route || game.story || game.showGrowth) return
    if (TAB_ROUTES.has(s.route) && TAB_ROUTES.has(String(route.name))) void router.replace({ name: s.route })
  },
  { immediate: true },
)

/** 手順が変わったら、見つからないときの待ち時間を数え直す */
watch(
  () => guide.active,
  () => {
    missing.value = false
    if (missingTimer !== null) window.clearTimeout(missingTimer)
    missingTimer = window.setTimeout(() => (missing.value = true), 3000)
  },
)

/** 始めるきっかけ：物語の旗が変わったら確かめる */
watch(
  () => [game.rev, game.story, game.save] as const,
  () => {
    if (!game.save) guide.reset()
    else if (!game.story) guide.check()
  },
  { immediate: true },
)

function track(): void {
  raf = requestAnimationFrame(track)
  const s = step.value
  if (!s?.target || blocked.value) {
    rect.value = null
    return
  }
  const el = document.querySelector<HTMLElement>(`[data-tut="${s.target}"]`)
  if (!el) {
    rect.value = null
    return
  }
  const key = `${guide.active?.id}-${guide.active?.index}`
  if (scrolledFor !== key) {
    scrolledFor = key
    el.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }
  const r = el.getBoundingClientRect()
  if (r.width === 0 && r.height === 0) {
    rect.value = null
    return
  }
  const next = { x: r.left - PAD, y: r.top - PAD, w: r.width + PAD * 2, h: r.height + PAD * 2 }
  const cur = rect.value
  if (!cur || Math.abs(cur.x - next.x) + Math.abs(cur.y - next.y) + Math.abs(cur.w - next.w) + Math.abs(cur.h - next.h) > 0.5) rect.value = next
}

/** 明るい場所を押したら次へ（押した操作そのものは、そのまま画面に届く） */
function onClickCapture(e: MouseEvent): void {
  const s = step.value
  if (!s || s.on !== 'target' || !visible.value || !s.target) return
  const el = document.querySelector(`[data-tut="${s.target}"]`)
  if (el && e.target instanceof Node && el.contains(e.target)) window.setTimeout(() => void guide.next(), 60)
}

onMounted(() => {
  raf = requestAnimationFrame(track)
  document.addEventListener('click', onClickCapture, true)
})
onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
  document.removeEventListener('click', onClickCapture, true)
  if (missingTimer !== null) window.clearTimeout(missingTimer)
})

/** 台詞だけで進む手順か（タップで次へ） */
const tapToNext = computed(() => !!step.value && (step.value.on === 'tap' || !rect.value))

const panels = computed(() => {
  const r = rect.value
  if (!r) return null
  return {
    top: { left: '0', top: '0', width: '100%', height: `${Math.max(0, r.y)}px` },
    bottom: { left: '0', top: `${r.y + r.h}px`, width: '100%', bottom: '0' },
    left: { left: '0', top: `${r.y}px`, width: `${Math.max(0, r.x)}px`, height: `${r.h}px` },
    right: { left: `${r.x + r.w}px`, top: `${r.y}px`, right: '0', height: `${r.h}px` },
  }
})

/** 吹き出しは、光らせた場所の上か下（空いているほう） */
const bubbleStyle = computed(() => {
  const r = rect.value
  if (!r) return { top: '50%', transform: 'translateY(-50%)' }
  const below = window.innerHeight - (r.y + r.h)
  if (below >= 170 && below >= r.y) return { top: `${r.y + r.h + 12}px` }
  if (r.y >= 170) return { bottom: `${window.innerHeight - r.y + 12}px` }
  if (below >= 170) return { top: `${r.y + r.h + 12}px` }
  // 上にも下にも空きがない（大きな場所を光らせたとき）：画面の下に重ねて出す
  return { bottom: 'calc(16px + var(--safe-bottom))' }
})

function onTap(): void {
  if (tapToNext.value) void guide.next()
}
</script>

<template>
  <div v-if="visible && step" class="guide">
    <template v-if="panels">
      <div class="shade" :style="panels.top" />
      <div class="shade" :style="panels.bottom" />
      <div class="shade" :style="panels.left" />
      <div class="shade" :style="panels.right" />
      <div class="ring" :class="{ press: step.on === 'target' }" :style="{ left: `${rect!.x}px`, top: `${rect!.y}px`, width: `${rect!.w}px`, height: `${rect!.h}px` }" />
    </template>
    <div v-else class="shade full" />
    <!-- 台詞だけで進む手順は、画面のどこを押しても次へ -->
    <div v-if="tapToNext" class="catcher" @click="onTap" />

    <div class="bubble" :style="bubbleStyle" @click="onTap">
      <img class="face" :src="portraitUrl('nagi', step.face ?? 'normal')" alt="ナギ" />
      <div class="say">
        <b>ナギ</b>
        <p>{{ step.text }}</p>
        <div class="foot">
          <span class="count">{{ (guide.active?.index ?? 0) + 1 }} / {{ guide.total }}</span>
          <span v-if="tapToNext" class="next">タップで次へ ▼</span>
          <span v-else class="next press">光っているところを押してください</span>
          <button class="skip" @click.stop="guide.finish()">説明を飛ばす</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.guide {
  position: fixed;
  inset: 0;
  z-index: 88;
  pointer-events: none;
}
.shade {
  position: fixed;
  background: rgba(6, 14, 28, 0.62);
  pointer-events: auto;
}
.shade.full {
  inset: 0;
}
.ring {
  position: fixed;
  border-radius: 14px;
  box-shadow: 0 0 0 3px #ffd33d, 0 0 18px 4px rgba(255, 211, 61, 0.7);
  pointer-events: none;
  animation: glow 1.4s ease-in-out infinite;
}
.ring.press {
  animation: glow 0.9s ease-in-out infinite;
}
.catcher {
  position: fixed;
  inset: 0;
  pointer-events: auto;
}
.bubble {
  position: fixed;
  left: 10px;
  right: 10px;
  max-width: 560px;
  margin: 0 auto;
  display: flex;
  align-items: flex-end;
  gap: 8px;
  pointer-events: auto;
  animation: pop 0.25s ease-out;
}
.face {
  width: 62px;
  height: 62px;
  flex-shrink: 0;
  border-radius: 50%;
  object-fit: cover;
  object-position: 50% 8%;
  background: linear-gradient(180deg, #fff3e6, #ffd9b8);
  box-shadow: 0 0 0 3px #fff, 0 3px 0 3px rgba(0, 0, 0, 0.2);
}
.say {
  flex: 1;
  background: #fff;
  border-radius: 14px;
  padding: 8px 12px 6px;
  box-shadow: 0 0 0 3px #ffd33d, 0 8px 18px rgba(0, 0, 0, 0.35);
}
.say b {
  display: block;
  font-size: 11px;
  color: #ff8a3d;
}
.say p {
  margin: 2px 0 4px;
  font-size: 14px;
  line-height: 1.6;
  color: var(--ink);
}
.foot {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 2px 8px;
  font-size: 11px;
}
.foot > span {
  white-space: nowrap;
}
.count {
  color: var(--ink-soft);
  font-weight: 800;
}
.next {
  color: var(--sky-deep);
  font-weight: 800;
}
.next.press {
  color: #d97a00;
}
.skip {
  margin-left: auto;
  background: none;
  border: 0;
  box-shadow: none;
  color: var(--ink-soft);
  font-size: 11px;
  padding: 2px 4px;
  text-decoration: underline;
}
@keyframes glow {
  50% {
    box-shadow: 0 0 0 3px #ffd33d, 0 0 28px 8px rgba(255, 211, 61, 0.95);
  }
}
@keyframes pop {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
}
</style>
