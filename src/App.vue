<script setup lang="ts">
import ConfirmDialog from './components/ConfirmDialog.vue'
import ToastMessage from './components/ToastMessage.vue'
import GuideOverlay from './components/story/GuideOverlay.vue'
</script>

<template>
  <RouterView />
  <GuideOverlay />
  <ConfirmDialog />
  <ToastMessage />
</template>
