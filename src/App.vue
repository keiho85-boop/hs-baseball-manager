<script setup lang="ts">
import ConfirmDialog from './components/ConfirmDialog.vue'
import ToastMessage from './components/ToastMessage.vue'
</script>

<template>
  <RouterView />
  <ConfirmDialog />
  <ToastMessage />
</template>
