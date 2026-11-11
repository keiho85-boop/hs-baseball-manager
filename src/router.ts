import { createRouter, createWebHashHistory } from 'vue-router'
import { useGameStore } from './stores/game'
import { useUiStore } from './stores/ui'

export const TAB_ROUTES = ['home', 'players', 'team', 'school', 'records'] as const

export const router = createRouter({
  // GitHub Pages では # 付きのURLが確実に動く
  history: createWebHashHistory(),
  // 画面を移ったら一番上から表示する（戻ったときは元の位置）
  scrollBehavior: (_to, _from, saved) => saved ?? { top: 0 },
  routes: [
    { path: '/', name: 'title', component: () => import('./views/TitleView.vue') },
    { path: '/new/:slot', name: 'new', component: () => import('./views/NewGameView.vue'), props: true },
    { path: '/match', name: 'match', component: () => import('./views/MatchView.vue'), meta: { requiresGame: true } },
    // 選手育成モードの結末（タブなしの1画面。見終えたら「タイトルに戻る」）
    { path: '/ending', name: 'ending', component: () => import('./views/EndingView.vue'), meta: { requiresGame: true } },
    // プロ入りした育成選手の一覧と、ドリームチームのオーダー（タイトル画面から）
    { path: '/pros', name: 'pros', component: () => import('./views/ProsView.vue') },
    {
      path: '/game',
      component: () => import('./views/GameLayout.vue'),
      meta: { requiresGame: true },
      children: [
        { path: 'home', name: 'home', component: () => import('./views/HomeView.vue') },
        { path: 'focus', name: 'focus', component: () => import('./views/FocusView.vue') },
        { path: 'players', name: 'players', component: () => import('./views/PlayersView.vue') },
        { path: 'players/:id', name: 'player', component: () => import('./views/PlayerDetailView.vue'), props: true },
        { path: 'team', name: 'team', component: () => import('./views/TeamView.vue') },
        { path: 'school', name: 'school', component: () => import('./views/SchoolView.vue') },
        { path: 'records', name: 'records', component: () => import('./views/RecordsView.vue') },
        { path: 'settings', name: 'settings', component: () => import('./views/SettingsView.vue') },
      ],
    },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})

router.beforeEach(async (to, from) => {
  const game = useGameStore()
  // ゲームを読み込んでいないのにゲーム画面を開こうとしたら、タイトルへ
  if (to.matched.some((r) => r.meta.requiresGame) && !game.save) return { name: 'title' }

  // Androidの戻るボタン：ゲーム中のタブ画面からタイトルへ戻るときは確認する
  const fromTab = TAB_ROUTES.includes(from.name as (typeof TAB_ROUTES)[number])
  if (fromTab && to.name === 'title' && game.save) {
    const ui = useUiStore()
    if (game.busy) return false
    const ok = await ui.confirm('タイトル画面に戻りますか？\n（進行状況は自動で保存されています）', {
      okLabel: '戻る',
      cancelLabel: '続ける',
    })
    if (!ok) return false
    game.closeGame()
  }
  return true
})
