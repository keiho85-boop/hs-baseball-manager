<script setup lang="ts">
// 勧誘：行き先の部活と、声をかける相手を選ぶ（その週に各部活にいる人が見える）
import { computed, ref } from 'vue'
import { useGameStore } from '@/stores/game'
import { CLUBS, FIXED, strengthLabel } from '@/game/success/clubs'
import { successOf, repRank, rosterCount } from '@/game/success/state'
import { POSITION_LABEL } from '@/game/constants'
import type { ClubId, ClubMember } from '@/game/success/types'
import type { Position } from '@/game/types'

const props = defineProps<{ /** 最初の勧誘（必ず行う。やめられない） */ forced?: boolean }>()
const emit = defineEmits<{ close: []; go: [club: ClubId, target: number] }>()
const game = useGameStore()
const BASE = import.meta.env.BASE_URL

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
    members: (s.clubs.find((r) => r.club === c.id)?.members ?? []).map((m, i) => ({ m, i })),
    visits: s.visits[c.id] ?? 0,
    done: !!(c.fixed && s.joined[c.fixed]),
  })).sort((a, b) => Number(b.members.length > 0) - Number(a.members.length > 0))
})

/** 声をかける相手（部活と並び順） */
const picked = ref<{ club: ClubId; i: number } | null>(null)
function isPicked(club: ClubId, i: number): boolean {
  return picked.value?.club === club && picked.value.i === i
}

function icon(m: ClubMember): string {
  return m.kind === 'fixed' ? `${BASE}icon/icon_${FIXED[m.id].char}.webp` : `${BASE}icon/icon_mob.webp`
}
function name(m: ClubMember): string {
  return m.kind === 'fixed' ? `${FIXED[m.id].surname} ${FIXED[m.id].givenName}` : `${m.surname} ${m.givenName}`
}
function sub(m: ClubMember): string {
  if (m.kind === 'fixed') return FIXED[m.id].title
  return `${m.grade}年・${POSITION_LABEL[m.position as Position] ?? '野'}向き・${strengthLabel(m.strength)}`
}

function go(): void {
  if (picked.value) emit('go', picked.value.club, picked.value.i)
}
</script>

<template>
  <div class="picker-backdrop" @click.self="!props.forced && emit('close')">
    <div class="picker card">
      <div class="top">
        <img :src="`${BASE}ui/ui_recruit.webp`" alt="" />
        <div>
          <h2>勧誘に行く</h2>
          <p>{{ props.forced ? '最初の勧誘です。声をかける相手を選んでください。今回は週を使いません。' : '声をかける相手を選んでください。1週間を使います。' }}</p>
        </div>
      </div>
      <div class="stats">
        <span>部員 <b :class="{ warn: count < 9 }">{{ count }}</b>人</span>
        <span>評判 <b>{{ repRank(rep) }}</b></span>
        <span class="ace">★ ほかの部のエース</span>
      </div>
      <div class="list" data-tut="recruit-list">
        <div v-for="r in rows" :key="r.club.id" class="club" :class="{ empty: r.members.length === 0 }">
          <div class="head">
            <b>{{ r.club.name }}</b>
            <small v-if="r.visits" class="visits">通った回数 {{ r.visits }}</small>
            <small v-if="r.done" class="pill good">エース入部済み</small>
          </div>
          <div v-if="r.members.length === 0" class="none">今週は誰もいない</div>
          <button
            v-for="x in r.members"
            :key="x.i"
            class="person"
            :class="{ fixed: x.m.kind === 'fixed', on: isPicked(r.club.id, x.i) }"
            :disabled="game.busy"
            @click="picked = { club: r.club.id, i: x.i }"
          >
            <img :src="icon(x.m)" alt="" />
            <span class="p-text">
              <b>{{ x.m.kind === 'fixed' ? '★' : '' }}{{ name(x.m) }}</b>
              <small>{{ sub(x.m) }}</small>
            </span>
            <span class="check" aria-hidden="true">{{ isPicked(r.club.id, x.i) ? '✓' : '' }}</span>
          </button>
        </div>
      </div>
      <div class="foot">
        <button v-if="!props.forced" class="secondary" @click="emit('close')">やめる</button>
        <button class="sun" :disabled="!picked || game.busy" @click="go">{{ picked ? '声をかける' : '相手を選んでください' }}</button>
      </div>
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
  max-height: 86vh;
  display: flex;
  flex-direction: column;
  border-radius: 20px 20px 0 0;
  padding-bottom: calc(14px + var(--safe-bottom));
}
.top {
  display: flex;
  align-items: center;
  gap: 10px;
}
.top img {
  width: 44px;
  height: 44px;
}
.top h2 {
  margin: 0;
  font-size: 18px;
}
.top p {
  margin: 2px 0 0;
  font-size: 12px;
  color: var(--ink-soft);
}
.stats {
  display: flex;
  gap: 12px;
  margin: 8px 0 4px;
  font-size: 13px;
}
.stats .warn {
  color: #c62828;
}
.stats .ace {
  margin-left: auto;
  color: #c2185b;
  font-weight: 800;
  font-size: 12px;
}
.list {
  overflow-y: auto;
  margin: 4px 0 10px;
}
.club {
  background: #f6faff;
  border-radius: 14px;
  padding: 8px 10px;
  margin-bottom: 8px;
  box-shadow: inset 0 0 0 2px #e2eef8;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.club.empty {
  opacity: 0.6;
}
.head {
  display: flex;
  align-items: center;
  gap: 8px;
}
.visits {
  color: var(--ink-soft);
}
.none {
  font-size: 12px;
  color: var(--ink-soft);
}
.person {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 6px 10px 6px 6px;
  border-radius: 12px;
  background: #fff;
  color: var(--ink);
  box-shadow: inset 0 0 0 2px #e2eef8;
  text-align: left;
}
.person img {
  width: 40px;
  height: 40px;
  flex: none;
}
.person.fixed {
  box-shadow: inset 0 0 0 2px #f3b6cf;
}
.person.on {
  background: #fff6d6;
  box-shadow: inset 0 0 0 3px #ffc93c;
}
.p-text {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
}
.p-text b {
  font-size: 14px;
}
.person.fixed .p-text b {
  color: #c2185b;
}
.p-text small {
  font-size: 11px;
  color: var(--ink-soft);
}
.check {
  width: 22px;
  font-weight: 900;
  color: #d99400;
}
.foot {
  display: grid;
  grid-template-columns: 1fr 2fr;
  gap: 8px;
}
</style>
