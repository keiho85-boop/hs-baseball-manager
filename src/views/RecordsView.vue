<script setup lang="ts">
import { computed, ref } from 'vue'
import { useGameStore } from '@/stores/game'
import { POSITION_NAME, formatWeek } from '@/game/constants'
import { listSavedPlayers } from '@/game/success/archive'
import RankBadge from '@/components/RankBadge.vue'

const game = useGameStore()
const tab = ref<'alumni' | 'log' | 'saved'>('alumni')
/** サクセスで育ててプロ入りした選手（端末に保存） */
const saved = computed(() => [...listSavedPlayers()].reverse())

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
      <button :class="tab === 'saved' ? 'sky' : 'secondary'" @click="tab = 'saved'">育成選手</button>
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
        <div v-for="a in ob.achievements" :key="a" class="ach">{{ a }}</div>
      </div>
    </template>

    <template v-else-if="tab === 'saved'">
      <p v-if="saved.length === 0" class="muted">まだ保存した選手はいません。第1章で育てた選手がプロ入りすると、ここに保存されます。</p>
      <div v-for="x in saved" :key="x.savedAt" class="card ob">
        <div class="row">
          <b>{{ x.player.surname }} {{ x.player.givenName }}</b>
          <RankBadge :value="x.rating" size="sm" />
        </div>
        <div class="muted">第{{ x.scenario }}章 ・ {{ POSITION_NAME[x.player.mainPosition] }} ・ {{ x.team }} {{ x.round }}位指名</div>
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
.ach {
  font-size: 12px;
  font-weight: 800;
  color: #a86f00;
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
