<script setup lang="ts">
import { computed } from 'vue'
import { rankOf } from '@/game/constants'

const props = withDefaults(defineProps<{ value: number; showValue?: boolean; size?: 'sm' | 'md' | 'lg' }>(), {
  showValue: true,
  size: 'md',
})
const rank = computed(() => rankOf(props.value))
</script>

<template>
  <span class="badge" :class="[`r-${rank}`, `s-${size}`]">
    <b>{{ rank }}</b><small v-if="showValue">{{ value }}</small>
  </span>
</template>

<style scoped>
.badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
b {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 7px;
  font-size: 15px;
  font-weight: 900;
  color: #fff;
  text-shadow: 0 1px 0 rgba(0, 0, 0, 0.25);
  box-shadow: inset 0 -3px 0 rgba(0, 0, 0, 0.18), inset 0 2px 0 rgba(255, 255, 255, 0.35);
}
.s-sm b {
  width: 20px;
  height: 20px;
  font-size: 13px;
  border-radius: 6px;
}
.s-lg b {
  width: 38px;
  height: 38px;
  font-size: 24px;
  border-radius: 10px;
}
small {
  font-size: 14px;
  font-weight: 800;
  color: var(--ink);
  font-variant-numeric: tabular-nums;
  min-width: 20px;
}
.s-lg small {
  font-size: 18px;
}
/* 色だけでなく文字（S〜G）でも区別できるようにしている */
.r-S b {
  background: linear-gradient(135deg, #ffe066 0%, #f5a300 55%, #ffd23f 100%);
  color: #6b3d00;
  text-shadow: 0 1px 0 rgba(255, 255, 255, 0.5);
}
.r-A b { background: #e5484d; }
.r-B b { background: #ff8a3d; }
.r-C b { background: #3fae4a; }
.r-D b { background: #14a7a0; }
.r-E b { background: #2f6fe0; }
.r-F b { background: #7e8ca0; }
.r-G b { background: #b3bccb; }
</style>
