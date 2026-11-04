<script setup lang="ts">
import { useUiStore } from '@/stores/ui'

const ui = useUiStore()
</script>

<template>
  <div v-if="ui.dialog" class="backdrop" @click.self="ui.dialog.cancelLabel && ui.closeDialog(false)">
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
