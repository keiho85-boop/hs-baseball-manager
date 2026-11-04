<script setup lang="ts">
// 手札のカード
import { CARD_EFFECT_DESC, CARD_EFFECT_NAME } from '@/game/sugoroku'
import type { Card } from '@/game/types'

defineProps<{ hand: Card[]; selected: number | null; disabled: boolean }>()
const emit = defineEmits<{ select: [index: number] }>()
</script>

<template>
  <div class="hand">
    <button
      v-for="(c, i) in hand"
      :key="`${i}-${c.value}-${c.effect}`"
      class="card-btn"
      :class="[`e-${c.effect}`, { sel: selected === i }]"
      :disabled="disabled"
      :title="CARD_EFFECT_DESC[c.effect]"
      @click="emit('select', i)"
    >
      <span class="num">{{ c.value }}</span>
      <span v-if="c.effect !== 'none'" class="eff">{{ CARD_EFFECT_NAME[c.effect] }}</span>
      <span v-else class="eff plain">練習</span>
    </button>
  </div>
</template>

<style scoped>
.hand {
  display: flex;
  gap: 6px;
  justify-content: center;
}
.card-btn {
  flex: 1;
  max-width: 68px;
  aspect-ratio: 0.68;
  padding: 0;
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  background-image: linear-gradient(180deg, rgba(255, 255, 255, 0.5) 0%, rgba(255, 255, 255, 0) 50%), linear-gradient(160deg, #ffffff, #e6f1fb);
  color: var(--navy);
  text-shadow: none;
  box-shadow: inset 0 0 0 2.5px var(--edge, #9fc3e4), 0 4px 0 var(--edge, #9fc3e4), 0 8px 12px -6px rgba(0, 0, 0, 0.3);
  transition: transform 0.15s;
}
.card-btn.sel {
  transform: translateY(-12px) rotate(-2deg);
  box-shadow: inset 0 0 0 3px #ffd33d, 0 4px 0 #d99400, 0 14px 18px -6px rgba(0, 0, 0, 0.35);
}
.num {
  font-size: 34px;
  font-weight: 900;
  font-style: italic;
  line-height: 1;
}
.eff {
  font-size: 11px;
  font-weight: 900;
  color: #fff;
  background: var(--edge);
  border-radius: 999px;
  padding: 0 8px;
}
.eff.plain {
  background: #b9cfe4;
}
.e-hot {
  --edge: #e5484d;
  background-image: linear-gradient(180deg, rgba(255, 255, 255, 0.5) 0%, rgba(255, 255, 255, 0) 50%), linear-gradient(160deg, #fff1f1, #ffd6d6);
}
.e-light {
  --edge: #3aa8f0;
}
.e-all {
  --edge: #e9a400;
  background-image: linear-gradient(180deg, rgba(255, 255, 255, 0.55) 0%, rgba(255, 255, 255, 0) 50%), linear-gradient(160deg, #fffbe6, #ffe8a3);
}
.e-hot .num {
  color: #c1272d;
}
.e-all .num {
  color: #a86f00;
}
</style>
