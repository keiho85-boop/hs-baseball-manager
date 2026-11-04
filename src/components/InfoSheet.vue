<script setup lang="ts">
/** 画面に収まらない情報を出すための、下から出るポップアップ */
defineEmits<{ close: [] }>()
</script>

<template>
  <div class="info-backdrop" @click.self="$emit('close')">
    <div class="info-sheet card">
      <slot />
      <button class="secondary full close" @click="$emit('close')">閉じる</button>
    </div>
  </div>
</template>

<style scoped>
.info-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(10, 30, 60, 0.45);
  z-index: 60;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}
.info-sheet {
  width: 100%;
  max-width: 640px;
  max-height: 82vh;
  overflow-y: auto;
  margin: 0;
  border-radius: 20px 20px 0 0;
  padding-bottom: calc(14px + var(--safe-bottom));
  animation: float-up 0.2s ease-out;
}
.close {
  margin-top: 10px;
}
</style>
