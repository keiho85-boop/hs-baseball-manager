<script setup lang="ts">
import { computed } from 'vue'
import { useUiStore } from '@/stores/ui'
import { bgUrl, hasPortrait, portraitUrl } from '@/game/story/art'
import type { CharId } from '@/game/story/types'

const ui = useUiStore()
/** 背景と立ち絵（固定キャラの勧誘など） */
const scene = computed(() => {
  const sc = ui.dialog?.scene
  if (!sc) return null
  return {
    style: { backgroundImage: `linear-gradient(180deg, rgba(10, 25, 45, 0.05), rgba(10, 25, 45, 0.5)), url(${bgUrl(sc.bg)})` },
    chars: sc.chars.filter((c) => hasPortrait(c as CharId)).map((c) => portraitUrl(c as CharId, 'normal')),
  }
})
</script>

<template>
  <div v-if="ui.dialog" class="backdrop" :class="{ scene: !!scene }" :style="scene?.style" @click.self="ui.dialog.cancelLabel && ui.closeDialog(false)">
    <div v-if="scene?.chars.length" class="cast">
      <img v-for="(u, i) in scene.chars" :key="i" :src="u" alt="" />
    </div>
    <div class="dialog" role="dialog" aria-modal="true">
      <h3>{{ ui.dialog.title }}</h3>
      <p class="message">{{ ui.dialog.message }}</p>
      <div class="actions">
        <button v-if="ui.dialog.cancelLabel" class="secondary" @click="ui.closeDialog(false)">
          {{ ui.dialog.cancelLabel }}
        </button>
        <button :class="{ danger: ui.dialog.danger }" @click="ui.closeDialog(true)">{{ ui.dialog.okLabel }}</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  z-index: 100;
}
.backdrop.scene {
  background-size: cover;
  background-position: center;
  flex-direction: column;
  justify-content: flex-end;
  padding-bottom: calc(24px + var(--safe-bottom, 0px));
  animation: scene-in 0.5s ease-out;
}
.cast {
  flex: 1;
  min-height: 0;
  display: flex;
  justify-content: center;
  align-items: flex-end;
  pointer-events: none;
}
.cast img {
  max-height: 50vh;
  max-width: 80%;
  object-fit: contain;
  filter: drop-shadow(0 6px 10px rgba(0, 0, 0, 0.25));
  animation: cast-in 0.5s ease-out both;
}
@keyframes scene-in {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes cast-in {
  from { opacity: 0; transform: translateY(14px); }
  to { opacity: 1; transform: none; }
}
.dialog {
  background: var(--paper);
  border-radius: 14px;
  padding: 18px;
  width: 100%;
  max-width: 360px;
}
h3 {
  font-size: 16px;
  margin-bottom: 8px;
}
.message {
  white-space: pre-line;
  margin: 0 0 16px;
}
.actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}
.actions button {
  flex: 1;
}
</style>
