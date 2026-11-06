<script setup lang="ts">
// 画面中央に出る知らせ（色付きの帯とアイコン）。OKを押すまで表示する
import { watch } from 'vue'
import { useUiStore } from '@/stores/ui'
import { play } from '@/sound'

const ui = useUiStore()
watch(
  () => ui.notice?.id,
  (id) => id && play(ui.notice?.tone === 'warn' || ui.notice?.tone === 'bad' ? 'catch' : 'notice'),
)
</script>

<template>
  <Transition name="nt">
    <div v-if="ui.notice" :key="ui.notice.id" class="nt-wrap">
      <div class="nt" :class="ui.notice.tone">
        <div class="medal">
          <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
            <path v-if="ui.notice.icon === 'check'" d="M5 12.5l4.2 4.2L19 7" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" />
            <g v-else-if="ui.notice.icon === 'warn'" fill="#fff"><rect x="10.6" y="5" width="2.8" height="9.5" rx="1.4" /><circle cx="12" cy="18.4" r="1.8" /></g>
            <path v-else-if="ui.notice.icon === 'bad'" d="M7 7l10 10M17 7L7 17" stroke="#fff" stroke-width="3.2" stroke-linecap="round" />
            <g v-else-if="ui.notice.icon === 'search'" fill="none" stroke="#fff" stroke-width="2.8" stroke-linecap="round"><circle cx="10.5" cy="10.5" r="5.5" /><path d="M15 15l4.5 4.5" /></g>
            <path v-else-if="ui.notice.icon === 'heart'" d="M12 19s-7-4.4-7-9.2A3.8 3.8 0 0 1 12 7.6a3.8 3.8 0 0 1 7 2.2C19 14.6 12 19 12 19z" fill="#fff" />
            <path v-else-if="ui.notice.icon === 'up'" d="M12 5l6 7h-4v7h-4v-7H6z" fill="#fff" />
            <g v-else fill="#fff"><circle cx="12" cy="6.6" r="1.9" /><rect x="10.6" y="10" width="2.8" height="9" rx="1.4" /></g>
          </svg>
        </div>
        <div class="title">{{ ui.notice.title }}</div>
        <div v-for="(h, i) in ui.notice.highlights ?? []" :key="i" class="hl" :style="{ animationDelay: `${i * 0.25}s` }">
          <span class="hl-label">{{ h.label }}</span>
          <span class="hl-value" :class="h.rank ? `rk-${h.rank}` : ''" :style="{ animationDelay: `${0.1 + i * 0.25}s` }">{{ h.value }}</span>
        </div>
        <div class="msg">{{ ui.notice.message }}</div>
        <button class="ok" @click="ui.closeNotice()">OK</button>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.nt-wrap {
  position: fixed;
  inset: 0;
  z-index: 95;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(10, 30, 60, 0.35);
}
.nt {
  --c: #2fa84a;
  --d: #1d7a33;
  pointer-events: auto;
  position: relative;
  width: min(300px, 82vw);
  background: #fff;
  border-radius: 20px;
  padding: 30px 16px 14px;
  text-align: center;
  box-shadow: 0 0 0 3px #fff, 0 0 0 5.5px var(--c), 0 14px 30px rgba(10, 30, 60, 0.35);
  overflow: hidden;
}
.nt::before {
  content: '';
  position: absolute;
  inset: 0 0 auto 0;
  height: 6px;
  background: repeating-linear-gradient(135deg, var(--c) 0 10px, var(--d) 10px 20px);
}
.nt.warn {
  --c: #f0a020;
  --d: #c07500;
}
.nt.bad {
  --c: #e5484d;
  --d: #a3151b;
}
.nt.info {
  --c: #3aa8f0;
  --d: #1f7fd0;
}
.medal {
  position: absolute;
  top: -1px;
  left: 50%;
  margin-left: -24px;
  width: 48px;
  height: 34px;
  border-radius: 0 0 24px 24px;
  background: linear-gradient(180deg, var(--c), var(--d));
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding-bottom: 3px;
  box-shadow: 0 3px 0 rgba(0, 0, 0, 0.12);
}
.title {
  margin-top: 6px;
  font-size: 17px;
  font-weight: 900;
  color: var(--d);
  letter-spacing: 0.04em;
}
.hl {
  margin: 6px auto 0;
  display: flex;
  width: fit-content;
  align-items: baseline;
  gap: 8px;
  background: #f4f7fb;
  border-radius: 12px;
  padding: 4px 14px;
}
.hl-label {
  font-size: 13px;
  font-weight: 800;
  color: var(--ink-soft);
}
.hl-value {
  font-size: 26px;
  font-weight: 900;
  font-style: italic;
  color: var(--ink);
  animation: pop-in 0.4s cubic-bezier(0.2, 1.6, 0.4, 1) 0.1s both;
}
.msg {
  margin-top: 6px;
  font-size: 14px;
  font-weight: 700;
  color: var(--ink);
  line-height: 1.5;
  white-space: pre-line;
}
.ok {
  margin-top: 12px;
  width: 100%;
  padding: 10px;
  font-size: 16px;
  font-weight: 900;
  border-radius: 14px;
  color: #fff;
  background: linear-gradient(180deg, var(--c), var(--d));
  box-shadow: 0 4px 0 rgba(0, 0, 0, 0.2);
  text-shadow: 0 1px 0 rgba(0, 0, 0, 0.2);
}
.ok:active {
  transform: translateY(3px);
  box-shadow: 0 1px 0 rgba(0, 0, 0, 0.2);
}
.timer {
  margin-top: 12px;
  height: 4px;
  border-radius: 9px;
  background: #eef2f7;
  overflow: hidden;
}
.timer i {
  display: block;
  height: 100%;
  background: var(--c);
  animation: shrink linear forwards;
  transform-origin: left;
}
@keyframes shrink {
  to {
    transform: scaleX(0);
  }
}
.nt-enter-active {
  transition: opacity 0.18s;
}
.nt-enter-active .nt {
  animation: nt-in 0.38s cubic-bezier(0.2, 1.5, 0.4, 1);
}
.nt-leave-active {
  transition: opacity 0.2s;
}
.nt-enter-from,
.nt-leave-to {
  opacity: 0;
}
@keyframes nt-in {
  from {
    transform: scale(0.7) translateY(16px);
  }
}
</style>
