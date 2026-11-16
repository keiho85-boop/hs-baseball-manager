<script setup lang="ts">
import ConfirmDialog from './components/ConfirmDialog.vue'
import ToastMessage from './components/ToastMessage.vue'
import GuideOverlay from './components/story/GuideOverlay.vue'
import { watchEffect } from 'vue'
import { useRoute } from 'vue-router'
import { useGameStore } from './stores/game'
import { useUiStore } from './stores/ui'
import { setBgm, type BgmName } from './bgm'
import { currentTournament, ownAlive, TOURNAMENT_SPECS } from './game/tournament'

// 軽量モード：画面の動き（アニメーション）を止めて、古い端末でも軽く動くようにする
const game = useGameStore()
watchEffect(() => {
  void game.rev
  document.documentElement.classList.toggle('light-mode', !!game.save?.settings.lightMode)
})

// BGM：場面に合わせて曲を選ぶ（レアイベント＞エンディング＞試合・大会中＞合宿＞ふだん）
const route = useRoute()
const ui = useUiStore()
watchEffect(() => {
  void game.rev
  void game.matchRev
  const name = route.name
  let bgm: BgmName = 'home'
  const s = game.save
  if (ui.bgmOverride) bgm = ui.bgmOverride
  else if (name === 'ending') bgm = 'ending'
  else if (s && name !== 'title' && name !== 'new' && name !== 'pros') {
    const m = game.match
    const t = currentTournament(s)
    const kindOf = (k: string | undefined): BgmName | null => (k ? (TOURNAMENT_SPECS[k as keyof typeof TOURNAMENT_SPECS]?.national ? 'national' : 'pref') : null)
    if (name === 'match' && m) bgm = kindOf(m.options.tournament ? s.tournaments?.find((x) => x.id === m.options.tournament!.id)?.kind : undefined) ?? 'pref'
    else if (t && ownAlive(s, t)) bgm = kindOf(t.kind) ?? 'home'
    else if ((s.sugoroku?.campWeeks ?? 0) > 0) bgm = 'camp'
  }
  setBgm(bgm)
})
</script>

<template>
  <RouterView />
  <GuideOverlay />
  <ConfirmDialog />
  <ToastMessage />
</template>
