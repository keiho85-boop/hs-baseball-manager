<script setup lang="ts">
// タイトルロゴ「転生名将ナギ」（文字は画像生成で崩れやすいので、フォントと図形で描く）
import '@/assets/logo-font.css'

withDefaults(defineProps<{ small?: boolean }>(), { small: false })
</script>

<template>
  <div class="tl" :class="{ small }" role="img" aria-label="転生名将ナギ">
    <div class="row1">
      <span class="stamp">転生</span>
      <span class="meisho">名将</span>
    </div>
    <div class="row2">
      <svg class="seam" viewBox="0 0 300 120" aria-hidden="true">
        <path d="M10 95 Q150 -10 290 70" fill="none" stroke="#fff" stroke-width="10" stroke-linecap="round" opacity="0.9" />
        <path d="M10 95 Q150 -10 290 70" fill="none" stroke="#e5484d" stroke-width="3" stroke-dasharray="8 10" stroke-linecap="round" />
      </svg>
      <span class="nagi">ナギ</span>
    </div>
    <div v-if="!small" class="en">TENSEI MEISHO NAGI</div>
  </div>
</template>

<style scoped>
.tl {
  --u: 1px;
  display: flex;
  flex-direction: column;
  align-items: center;
  font-family: 'Dela Gothic One', 'M PLUS Rounded 1c', sans-serif;
  line-height: 1;
  user-select: none;
}
.tl.small {
  --u: 0.42px;
}
.row1 {
  display: flex;
  align-items: center;
  gap: calc(8 * var(--u));
}
.stamp {
  display: inline-block;
  transform: rotate(-8deg);
  font-size: calc(26 * var(--u));
  color: #fff;
  background: linear-gradient(180deg, #ff5a5f, #c81e2b);
  padding: calc(6 * var(--u)) calc(8 * var(--u)) calc(7 * var(--u));
  border-radius: calc(8 * var(--u));
  border: calc(3 * var(--u)) solid #fff;
  box-shadow: 0 calc(4 * var(--u)) 0 #0d2a52;
  letter-spacing: 0.04em;
}
.meisho {
  font-size: calc(58 * var(--u));
  color: #fff;
  -webkit-text-stroke: calc(7 * var(--u)) #0d2a52;
  paint-order: stroke fill;
  text-shadow: 0 calc(5 * var(--u)) 0 #0d2a52;
  letter-spacing: 0.04em;
}
.row2 {
  position: relative;
  margin-top: calc(-4 * var(--u));
}
.seam {
  position: absolute;
  left: 50%;
  top: 50%;
  width: calc(300 * var(--u));
  transform: translate(-50%, -58%);
}
.nagi {
  position: relative;
  display: block;
  font-size: calc(104 * var(--u));
  letter-spacing: 0.02em;
  background: linear-gradient(180deg, #fffbe6 0%, #ffd34d 42%, #ff8a1c 70%, #e8590c 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  -webkit-text-stroke: calc(8 * var(--u)) #0d2a52;
  paint-order: stroke fill;
  filter: drop-shadow(0 calc(6 * var(--u)) 0 #0d2a52) drop-shadow(0 calc(10 * var(--u)) calc(14 * var(--u)) rgba(10, 30, 60, 0.45));
}
.en {
  margin-top: calc(6 * var(--u));
  font-family: 'M PLUS Rounded 1c', sans-serif;
  font-weight: 900;
  font-size: calc(11 * var(--u));
  letter-spacing: 0.42em;
  color: #fff;
  background: rgba(13, 42, 82, 0.75);
  border-radius: 999px;
  padding: calc(3 * var(--u)) calc(12 * var(--u));
}
</style>
