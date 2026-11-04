<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useGameStore } from '@/stores/game'
import { POSITIONS, POSITION_LABEL } from '@/game/constants'
import { playerRating } from '@/game/player'
import type { Player } from '@/game/types'
import FaceIcon from '@/components/FaceIcon.vue'
import RankBadge from '@/components/RankBadge.vue'

type SortKey = 'grade' | 'position' | 'rating'

const game = useGameStore()
const router = useRouter()
const sortKey = ref<SortKey>('grade')
const showRetired = ref(false)

const list = computed(() => {
  const players = game.ownPlayers().filter((p) => showRetired.value || !p.retired)
  const byPos = (p: Player) => POSITIONS.indexOf(p.mainPosition)
  const sorters: Record<SortKey, (a: Player, b: Player) => number> = {
    grade: (a, b) => b.grade - a.grade || byPos(a) - byPos(b),
    position: (a, b) => byPos(a) - byPos(b) || b.grade - a.grade,
    rating: (a, b) => playerRating(b) - playerRating(a),
  }
  return [...players].sort(sorters[sortKey.value])
})

const retiredCount = computed(() => game.ownPlayers().filter((p) => p.retired).length)

const FORM = ['', '絶不調', '不調', '普通', '好調', '絶好調']

/** ポジションの系統（色分けに使う） */
function group(pos: Player['mainPosition']): string {
  if (pos === 'P') return 'p'
  if (pos === 'C') return 'c'
  if (pos === 'LF' || pos === 'CF' || pos === 'RF') return 'of'
  return 'if'
}
</script>

<template>
  <div class="page">
    <div class="row controls">
      <span class="muted">並び替え</span>
      <button v-for="k in (['grade', 'position', 'rating'] as const)" :key="k" :class="sortKey === k ? '' : 'secondary'" class="small" @click="sortKey = k">
        {{ k === 'grade' ? '学年' : k === 'position' ? '守備' : '総合' }}
      </button>
    </div>
    <label v-if="retiredCount > 0" class="row retired-toggle">
      <input v-model="showRetired" type="checkbox" class="check" />
      <span class="muted">引退した3年生（{{ retiredCount }}人）も表示</span>
    </label>

    <div class="list">
      <button v-for="p in list" :key="p.id" class="item" :class="`g-${group(p.mainPosition)}`" @click="router.push({ name: 'player', params: { id: p.id } })">
        <FaceIcon :face="p.face" :size="42" />
        <div class="main">
          <div class="name">
            <span class="pos">{{ POSITION_LABEL[p.mainPosition] }}</span>
            {{ p.surname }} {{ p.givenName }}
            <span class="muted">{{ p.grade }}年</span>
            <span v-if="p.helper" class="pill">助っ人</span>
            <span v-if="p.retired" class="pill">引退</span>
            <span v-if="p.condition.injury" class="pill bad">ケガ</span>
          </div>
          <div class="stats muted">
            <template v-if="p.mainPosition === 'P'">
              {{ p.pitching.velocity }}km/h ・ 制球 {{ p.pitching.control }} ・ スタ {{ p.pitching.stamina }}
            </template>
            <template v-else>
              ミート {{ p.batting.contact }} ・ パワー {{ p.batting.power }} ・ 走力 {{ p.running.speed }}
            </template>
            ・ {{ FORM[p.condition.form] }}
          </div>
        </div>
        <RankBadge :value="playerRating(p)" size="lg" :show-value="false" />
      </button>
    </div>
    <p class="muted">右端のランクは、投手は投手として、野手は野手としての総合評価です。</p>
  </div>
</template>

<style scoped>
.controls {
  margin-bottom: 8px;
}
.small {
  padding: 6px 12px;
  font-size: 13px;
}
.retired-toggle {
  margin-bottom: 8px;
}
.check {
  width: auto;
}
.list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.item {
  display: flex;
  align-items: center;
  gap: 10px;
  background: var(--paper);
  color: var(--ink);
  border: 2px solid #e2eef8;
  border-left: 7px solid var(--c);
  text-align: left;
  font-weight: 400;
  padding: 8px 10px;
  box-shadow: 0 3px 0 rgba(31, 42, 58, 0.08);
  text-shadow: none;
}
.item:active {
  box-shadow: none;
}
.g-p { --c: #e5484d; }
.g-c { --c: #2f6fe0; }
.g-if { --c: #ff8a3d; }
.g-of { --c: #3fae4a; }
.main {
  flex: 1;
  min-width: 0;
}
.name {
  font-weight: 800;
}
.pos {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  background: var(--c);
  color: #fff;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 900;
  margin-right: 4px;
}
.stats {
  font-size: 12px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
