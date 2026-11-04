<script setup lang="ts">
import { useUiStore } from '@/stores/ui'

const ui = useUiStore()
</script>

<template>
  <Transition name="fade">
    <div v-if="ui.toast" class="toast">{{ ui.toast }}</div>
  </Transition>
</template>

<style scoped>
.toast {
  position: fixed;
  left: 50%;
  transform: translateX(-50%);
  bottom: calc(var(--tab-height) + var(--ad-height) + var(--safe-bottom) + 16px);
  background: rgba(35, 33, 29, 0.92);
  color: #fff;
  padding: 10px 16px;
  border-radius: 999px;
  font-size: 14px;
  z-index: 90;
  max-width: 90vw;
  text-align: center;
}
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
