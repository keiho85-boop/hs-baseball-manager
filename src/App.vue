<script setup lang="ts">
import ConfirmDialog from './components/ConfirmDialog.vue'
import ToastMessage from './components/ToastMessage.vue'
import GuideOverlay from './components/story/GuideOverlay.vue'
import { watchEffect } from 'vue'
import { useGameStore } from './stores/game'

// 軽量モード：画面の動き（アニメーション）を止めて、古い端末でも軽く動くようにする
const game = useGameStore()
watchEffect(() => {
  void game.rev
  document.documentElement.classList.toggle('light-mode', !!game.save?.settings.lightMode)
})
</script>

<template>
  <RouterView />
  <GuideOverlay />
  <ConfirmDialog />
  <ToastMessage />
</template>
