<script setup lang="ts">
// このゲーム独自のアイコン（絵文字は端末ごとに見た目が変わるため使わない）
import type { IconName } from './icons'

defineProps<{ name: IconName; size?: number }>()

</script>

<template>
  <svg :width="size ?? 22" :height="size ?? 22" viewBox="0 0 24 24" class="gi" aria-hidden="true">
    <template v-if="name === 'home'">
      <path d="M3 11.2 12 3.5l9 7.7v9.3a1 1 0 0 1-1 1h-5.2v-6.2H9.2v6.2H4a1 1 0 0 1-1-1z" fill="currentColor" />
    </template>
    <template v-else-if="name === 'cap'">
      <path d="M4 15c0-5.2 3.4-9 8-9s8 3.8 8 9z" fill="currentColor" />
      <path d="M3 15h13.5c2.6 0 4.5 1 4.5 2.2 0 .8-.9 1.3-2 1.3H4.4C3.6 18.5 3 17.8 3 17z" fill="currentColor" opacity="0.75" />
      <circle cx="12" cy="6" r="1.2" fill="currentColor" />
    </template>
    <template v-else-if="name === 'ball'">
      <circle cx="12" cy="12" r="9" fill="currentColor" />
      <circle cx="12" cy="12" r="9" fill="none" stroke="#000" stroke-opacity="0.12" stroke-width="1" />
      <path d="M7.6 4.8c2 2.2 2 12.2 0 14.4M16.4 4.8c-2 2.2-2 12.2 0 14.4" stroke="#e5484d" stroke-width="1.6" fill="none" stroke-dasharray="1.6 1.3" />
    </template>
    <template v-else-if="name === 'school'">
      <path d="M2.5 21V10.5L8 8V5.5L12 3l4 2.5V8l5.5 2.5V21z" fill="currentColor" />
      <g fill="#fff" opacity="0.9">
        <rect x="5" y="12.5" width="2.4" height="2.4" rx=".4" /><rect x="16.6" y="12.5" width="2.4" height="2.4" rx=".4" />
        <rect x="5" y="16.5" width="2.4" height="2.4" rx=".4" /><rect x="16.6" y="16.5" width="2.4" height="2.4" rx=".4" />
        <rect x="10.4" y="15.5" width="3.2" height="5.5" rx=".5" /><circle cx="12" cy="8.5" r="1.6" />
      </g>
    </template>
    <template v-else-if="name === 'trophy'">
      <path d="M7 3h10v5.5a5 5 0 0 1-10 0z" fill="currentColor" />
      <path d="M7 5H4v1.5A3.5 3.5 0 0 0 7.5 10M17 5h3v1.5A3.5 3.5 0 0 1 16.5 10" stroke="currentColor" stroke-width="1.8" fill="none" />
      <path d="M10.5 13.2h3l.7 3.8H9.8zM7.5 18h9v3h-9z" fill="currentColor" />
    </template>
    <template v-else-if="name === 'gear'">
      <path
        d="M10.3 2.5h3.4l.5 2.6 1.6.7 2.2-1.5 2.4 2.4-1.5 2.2.7 1.6 2.6.5v3.4l-2.6.5-.7 1.6 1.5 2.2-2.4 2.4-2.2-1.5-1.6.7-.5 2.6h-3.4l-.5-2.6-1.6-.7-2.2 1.5-2.4-2.4 1.5-2.2-.7-1.6-2.6-.5v-3.4l2.6-.5.7-1.6L4.4 6.7l2.4-2.4L9 5.8l1.6-.7z"
        fill="currentColor"
      />
      <circle cx="12" cy="12" r="3.3" fill="#fff" opacity="0.9" />
    </template>
    <template v-else-if="name === 'back'">
      <path d="M15 4 7 12l8 8" stroke="currentColor" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round" />
    </template>
    <template v-else-if="name === 'heart'">
      <path d="M12 21s-8.5-5.2-8.5-11A4.8 4.8 0 0 1 12 7a4.8 4.8 0 0 1 8.5 3c0 5.8-8.5 11-8.5 11z" fill="currentColor" />
    </template>
    <template v-else-if="name === 'bat'">
      <path d="M20.6 2.6c.8.8.6 2.1-.4 3.1l-9.6 9.9-2.2-2.2 9.9-9.6c1-1 2.3-1.2 2.3-1.2z" fill="currentColor" />
      <path d="m8.9 14.2 1 1-4.6 4.7-1-1z" fill="currentColor" />
      <circle cx="18" cy="18" r="2.6" fill="currentColor" opacity="0.8" />
    </template>
    <template v-else-if="name === 'flame'">
      <path d="M12 2.5c.6 3.4 5.5 6 5.5 11a5.5 5.5 0 0 1-11 0c0-2.5 1.4-4.2 2.6-5.3.1 1.8.9 3 2 3.6C10.6 8.6 11 5.3 12 2.5z" fill="currentColor" />
    </template>
    <template v-else-if="name === 'muscle'">
      <path d="M5 19.5c-1.5-3-1.4-6.4.6-9l3.6-5.2c.7-1 2.2-.9 2.7.2l.5 1-2.2 3.6c2-.6 4.3-.2 5.7 1.1 1.3-1 3.3-.8 4.4.6 1.4 1.9.8 4.6-1.3 5.8-3.5 2-8.8 2.6-14 1.9z" fill="currentColor" />
    </template>
    <template v-else-if="name === 'sparkle'">
      <path d="M12 2.5 14 10l7.5 2-7.5 2-2 7.5-2-7.5-7.5-2L10 10z" fill="currentColor" />
      <path d="m19 3 .7 2.3L22 6l-2.3.7L19 9l-.7-2.3L16 6l2.3-.7z" fill="currentColor" opacity="0.7" />
    </template>
    <template v-else-if="name === 'clipboard'">
      <rect x="4.5" y="4" width="15" height="17.5" rx="2" fill="currentColor" />
      <rect x="8.5" y="2.5" width="7" height="3.5" rx="1" fill="currentColor" stroke="#fff" stroke-width="1.2" />
      <path d="M8 11h8M8 14.5h8M8 18h5" stroke="#fff" stroke-width="1.6" stroke-linecap="round" />
    </template>
    <template v-else-if="name === 'megaphone'">
      <path d="M3.5 9.5h3l9-5v15l-9-5h-3z" fill="currentColor" />
      <path d="M6.5 14.5 8 20h2.6l-1.2-5.5" fill="currentColor" opacity="0.8" />
      <path d="M18.5 9a4 4 0 0 1 0 6" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round" />
    </template>
    <template v-else-if="name === 'star'">
      <path d="m12 2.8 2.8 5.8 6.3.9-4.6 4.4 1.1 6.3L12 17.2 6.4 20.2l1.1-6.3L2.9 9.5l6.3-.9z" fill="currentColor" />
    </template>
    <template v-else-if="name === 'up'">
      <path d="M12 3.5 20 13h-5v7.5H9V13H4z" fill="currentColor" />
    </template>
    <template v-else-if="name === 'play'">
      <path d="M7 4.5v15l12.5-7.5z" fill="currentColor" />
    </template>
    <template v-else-if="name === 'glove'">
      <path d="M6 21c-1.6-1.4-2.5-3.6-2.5-6.2V8.5a1.6 1.6 0 0 1 3.2 0V12V5a1.6 1.6 0 0 1 3.2 0v6V4a1.6 1.6 0 0 1 3.2 0v7V5.5a1.6 1.6 0 0 1 3.2 0V13l1.8-2.2a1.6 1.6 0 0 1 2.5 2L16 19c-1 1.3-2.5 2-4.2 2z" fill="currentColor" />
    </template>
    <template v-else-if="name === 'build'">
      <path d="M3 20.5h18v1.5H3zM5 9h3v11H5zm5.5-3h3v14h-3zM16 12h3v8h-3z" fill="currentColor" />
      <path d="M4 7.5 12 3l8 4.5" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round" />
    </template>
    <template v-else-if="name === 'run'">
      <circle cx="15" cy="4.5" r="2.3" fill="currentColor" />
      <path d="M9.5 8.5 13 7.4c.9-.3 1.8 0 2.3.8l1.6 2.8 2.9.8-.6 2-3.7-1-1.2-1.8-1.6 3.5 2.8 2.4-1.4 5.4-2.1-.5 1-4-3.5-2.8L8 19.5l-2-.8 2.4-5.4.8-2.7-1.8.6-1.1 2.6-1.9-.8 1.5-3.4z" fill="currentColor" />
    </template>
    <template v-else-if="name === 'search'">
      <circle cx="10.5" cy="10.5" r="6" stroke="currentColor" stroke-width="2.6" fill="none" />
      <path d="m15 15 5.5 5.5" stroke="currentColor" stroke-width="3" stroke-linecap="round" />
    </template>
  </svg>
</template>

<style scoped>
.gi {
  display: inline-block;
  vertical-align: -0.2em;
  flex-shrink: 0;
}
</style>
