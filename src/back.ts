// Androidの戻るボタン（アプリ版）。
// ・開いている画面の部品（シートやポップアップ）があれば、新しく開いたものから閉じる
// ・確認ダイアログが出ていれば「いいえ」（お知らせなら OK）
// ・物語・イベント・説明の最中は何もしない（読み飛ばしや選択の取り消しで進行が崩れないように）
// ・試合中は中断の確認、ホームとタイトルでは終了の確認、それ以外の画面ではひとつ前の画面へ
import { onMounted, onUnmounted } from 'vue'
import type { Router } from 'vue-router'
import { Capacitor } from '@capacitor/core'

type Handler = () => boolean
const stack: Handler[] = []

/** 部品が開いているあいだ、戻るボタンで自分を閉じる（閉じたら true を返す） */
export function useBack(handler: Handler): void {
  onMounted(() => stack.push(handler))
  onUnmounted(() => {
    const i = stack.lastIndexOf(handler)
    if (i >= 0) stack.splice(i, 1)
  })
}

/** 戻るボタンを押したときの処理（テストやWeb版でも呼べるように分けておく） */
export async function handleBack(router: Router, deps: { dialogOpen: () => boolean; closeDialog: () => void; busy: () => boolean; confirmExit: () => Promise<boolean>; exit: () => void }): Promise<void> {
  if (deps.dialogOpen()) {
    deps.closeDialog()
    return
  }
  // 新しく開いたものから順に（閉じられなかったものは飛ばす）
  for (let i = stack.length - 1; i >= 0; i--) if (stack[i]!()) return
  if (deps.busy()) return
  const name = router.currentRoute.value.name
  if (name === 'home' || name === 'title') {
    if (await deps.confirmExit()) deps.exit()
    return
  }
  if (name === 'new' || name === 'pros') {
    await router.replace({ name: 'title' })
    return
  }
  await router.replace({ name: 'home' })
}

export async function installBackButton(router: Router, deps: Parameters<typeof handleBack>[1]): Promise<void> {
  if (!Capacitor.isNativePlatform()) return
  const { App } = await import('@capacitor/app')
  await App.addListener('backButton', () => void handleBack(router, deps))
}

export async function exitApp(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return
  const { App } = await import('@capacitor/app')
  await App.exitApp()
}
