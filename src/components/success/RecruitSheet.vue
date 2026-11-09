<script setup lang="ts">
// 勧誘：行き先の部活を選ぶ（その週に各部活にいる人が見える）
import { computed } from 'vue'
import { useGameStore } from '@/stores/game'
import GameIcon from '@/components/GameIcon.vue'
import { CLUBS, FIXED, strengthLabel } from '@/game/success/clubs'
import { successOf, repRank, rosterCount } from '@/game/success/state'
import { POSITION_LABEL } from '@/game/constants'
import type { ClubId, ClubMember } from '@/game/success/types'
import type { Position } from '@/game/types'

const emit = defineEmits<{ close: []; go: [club: ClubId] }>()
const game = useGameStore()

const state = computed(() => {
  void game.rev
  return game.save ? successOf(game.save) : null
})
const rep = computed(() => {
  void game.rev
  return game.ownSchool()?.reputation ?? 0
})
const count = computed(() => {
  void game.rev
  return game.save ? rosterCount(game.save) : 0
})

const rows = computed(() => {
  const s = state.value
  if (!s) return []
  return CLUBS.map((c) => ({
    club: c,
    members: s.clubs.find((r) => r.club === c.id)?.members ?? [],
    visits: s.visits[c.id] ?? 0,
    done: !!(c.fixed && s.joined[c.fixed]),
  }))
})

function label(m: ClubMember): string {
  if (m.kind === 'fixed') return `★${FIXED[m.id].surname} ${FIXED[m.id].givenName}（${FIXED[m.id].title}）`
  return `${m.grade}年 ${m.surname}（${POSITION_LABEL[m.position as Position] ?? '野'}・${strengthLabel(m.strength)}）`
}
</script>

<template>
  <div class="picker-backdrop" @click.self="emit('close')">
    <div class="picker card">
      <h2 class="grass"><GameIcon name="megaphone" /> 勧誘に行く</h2>
      <p class="muted">練習の代わりに1週間を使います。部員 {{ count }}人／評判 {{ repRank(rep) }}。★はほかの部のエースです。通うほど話しかけやすくなります。</p>
      <div class="list" data-tut="recruit-list">
        <div v-for="r in rows" :key="r.club.id" class="club">
          <div class="head">
            <b>{{ r.club.name }}</b>
            <small v-if="r.visits" class="muted">通った回数 {{ r.visits }}</small>
            <small v-if="r.done" class="pill good">エース入部済み</small>
          </div>
          <ul>
            <li v-for="(m, i) in r.members" :key="i" :class="{ fixed: m.kind === 'fixed' }">{{ label(m) }}</li>
            <li v-if="r.members.length === 0" class="muted">今週は誰もいない</li>
          </ul>
          <button class="sun go" :disabled="game.busy || r.members.length === 0" @click="emit('go', r.club.id)">ここへ行く</button>
        </div>
      </div>
      <button class="secondary full" @click="emit('close')">やめる</button>
    </div>
  </div>
</template>

<style scoped>
.picker-backdrop {
  position: fixed;
  inset: 0;
  z-index: 70;
  background: rgba(10, 25, 45, 0.5);
  display: flex;
  align-items: flex-end;
}
.picker {
  width: 100%;
  max-width: 640px;
  margin: 0 auto;
  max-height: 82vh;
  display: flex;
  flex-direction: column;
  border-radius: 20px 20px 0 0;
  padding-bottom: calc(14px + var(--safe-bottom));
}
.list {
  overflow-y: auto;
  margin: 6px 0 10px;
}
.club {
  background: #f6faff;
  border-radius: 12px;
  padding: 8px 10px;
  margin-bottom: 8px;
  box-shadow: inset 0 0 0 2px #e2eef8;
}
.head {
  display: flex;
  align-items: center;
  gap: 8px;
}
ul {
  list-style: none;
  padding: 0;
  margin: 4px 0 6px;
  font-size: 13px;
}
li.fixed {
  color: #c2185b;
  font-weight: 800;
}
.go {
  width: 100%;
  padding: 7px;
  font-size: 14px;
}
</style>
