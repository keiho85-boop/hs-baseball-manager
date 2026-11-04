<script setup lang="ts">
import { computed, ref } from 'vue'
import { useGameStore } from '@/stores/game'
import { POSITION_NAME, formatWeek } from '@/game/constants'

const game = useGameStore()
const tab = ref<'alumni' | 'log'>('alumni')

const CAREER = { pro: 'プロ入り', university: '大学進学', corporate: '社会人野球', work: '就職', other: 'その他' } as const

const alumni = computed(() => {
  void game.rev
  return [...(game.save?.alumni ?? [])].reverse()
})

const log = computed(() => {
  void game.rev
  return [...(game.save?.log ?? [])].reverse()
})
</script>

<template>
  <div class="page">
    <div class="row switch">
      <button :class="tab === 'alumni' ? 'sky' : 'secondary'" @click="tab = 'alumni'">OB名鑑</button>
      <button :class="tab === 'log' ? 'sky' : 'secondary'" @click="tab = 'log'">出来事の記録</button>
    </div>

    <template v-if="tab === 'alumni'">
      <p v-if="alumni.length === 0" class="muted">まだ卒業生はいません。最初の卒業式は1年目の3月です。</p>
      <div v-for="ob in alumni" :key="ob.id" class="card ob">
        <div class="row">
          <b>{{ ob.surname }} {{ ob.givenName }}</b>
          <span v-if="ob.notable" class="pill good">活躍OB</span>
        </div>
        <div class="muted">
          {{ ob.graduatedYear }}年目卒 ・ {{ POSITION_NAME[ob.mainPosition] }} ・ 進路：{{ CAREER[ob.career] }}
        </div>
      </div>
    </template>

    <div v-else class="card">
      <ul class="log">
        <li v-for="(l, i) in log" :key="i">
          <span class="muted">{{ formatWeek(l.year, l.week) }}</span><br />{{ l.text }}
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.switch {
  margin-bottom: 10px;
}
.switch button {
  flex: 1;
}
.ob {
  padding: 10px 12px;
}
.log {
  list-style: none;
  padding: 0;
  margin: 0;
}
.log li {
  padding: 6px 0;
  border-bottom: 1px solid var(--line);
}
</style>
