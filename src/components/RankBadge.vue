<script setup lang="ts">
// ランク（S〜G）の札。六角形の盾の形に光沢を付けている
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
    <span class="shield"><b>{{ rank }}</b></span><small v-if="showValue">{{ value }}</small>
  </span>
</template>

<style scoped>
.badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  --w: 26px;
  --f: 16px;
}
.s-sm {
  --w: 21px;
  --f: 13px;
}
.s-lg {
  --w: 42px;
  --f: 27px;
}
.shield {
  width: var(--w);
  height: calc(var(--w) * 1.08);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  /* 外側の縁取り */
  background: var(--edge);
  clip-path: polygon(50% 0, 100% 22%, 100% 78%, 50% 100%, 0 78%, 0 22%);
  filter: drop-shadow(0 2px 0 rgba(0, 0, 0, 0.2));
  position: relative;
}
.shield::before {
  /* 内側の面と光沢 */
  content: '';
  position: absolute;
  inset: 2px;
  background-image: linear-gradient(180deg, rgba(255, 255, 255, 0.45) 0%, rgba(255, 255, 255, 0.1) 46%, rgba(255, 255, 255, 0) 50%), var(--face);
  clip-path: polygon(50% 0, 100% 22%, 100% 78%, 50% 100%, 0 78%, 0 22%);
}
b {
  position: relative;
  font-size: var(--f);
  font-weight: 900;
  font-style: italic;
  color: #fff;
  line-height: 1;
  text-shadow: 0 1px 0 rgba(0, 0, 0, 0.35), 0 0 3px rgba(0, 0, 0, 0.25);
  margin-left: -1px;
}
small {
  font-size: 14px;
  font-weight: 900;
  color: var(--ink);
  font-variant-numeric: tabular-nums;
  min-width: 20px;
}
.s-lg small {
  font-size: 19px;
}
/* 色だけでなく文字（S〜G）でも区別できるようにしている */
.r-S {
  --edge: #b87700;
  --face: linear-gradient(135deg, #fff3a6 0%, #ffcc33 40%, #f5a300 70%, #ffe27a 100%);
}
.r-S b {
  color: #fff;
  text-shadow: 0 1px 0 #9a5a00, 0 0 4px rgba(150, 90, 0, 0.6);
}
.r-SS,
.r-SSS {
  --edge: #6a1b9a;
  --face: linear-gradient(135deg, #ffe9ff 0%, #d39bff 35%, #8e5cf7 65%, #ffd1f7 100%);
}
.r-SSS {
  --edge: #2b1a6b;
  --face: linear-gradient(135deg, #fff6a8 0%, #ff9be2 25%, #9b8cff 50%, #7fe3ff 75%, #fff6a8 100%);
}
.r-SS b,
.r-SSS b {
  color: #fff;
  font-size: calc(var(--f) * 0.72);
  letter-spacing: -1px;
  text-shadow: 0 1px 0 #3d1466, 0 0 4px rgba(80, 20, 140, 0.6);
}
.r-A { --edge: #a3242a; --face: linear-gradient(180deg, #ff6b70, #e0353b); }
.r-B { --edge: #b5520f; --face: linear-gradient(180deg, #ffa363, #fb7420); }
.r-C { --edge: #1e7a29; --face: linear-gradient(180deg, #68cf6c, #2f9e3a); }
.r-D { --edge: #0b6d68; --face: linear-gradient(180deg, #46cdc4, #109a93); }
.r-E { --edge: #1b4ba6; --face: linear-gradient(180deg, #6a9ff5, #2c66d8); }
.r-F { --edge: #4f5b6b; --face: linear-gradient(180deg, #a1adbd, #75839a); }
.r-G { --edge: #858f9e; --face: linear-gradient(180deg, #cfd6df, #aab3c0); }
</style>
