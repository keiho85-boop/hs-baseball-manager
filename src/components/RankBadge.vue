<script setup lang="ts">
import { computed } from 'vue'
import { rankOf } from '@/game/constants'

const props = withDefaults(defineProps<{ value: number; showValue?: boolean }>(), { showValue: true })
const rank = computed(() => rankOf(props.value))
</script>

<template>
  <span class="badge" :class="`r-${rank}`">
    <b>{{ rank }}</b><small v-if="showValue">{{ value }}</small>
  </span>
</template>

<style scoped>
.badge {
  display: inline-flex;
  align-items: baseline;
  gap: 3px;
  min-width: 46px;
}
b {
  display: inline-block;
  width: 20px;
  text-align: center;
  border-radius: 4px;
  font-size: 13px;
  color: #fff;
}
small {
  font-size: 13px;
  color: var(--ink);
  font-variant-numeric: tabular-nums;
}
/* 色だけでなく文字（S〜G）でも区別できるようにしている */
.r-S b { background: #c0392b; }
.r-A b { background: #d35400; }
.r-B b { background: #b8860b; }
.r-C b { background: #3d8b40; }
.r-D b { background: #2c7a9b; }
.r-E b { background: #4a6fa5; }
.r-F b { background: #7d7d7d; }
.r-G b { background: #a5a5a5; }
</style>
