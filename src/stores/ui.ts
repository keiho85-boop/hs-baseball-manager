// 確認ダイアログ・お知らせ・アプリ更新の状態

import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface DialogRequest {
  title: string
  message: string
  okLabel: string
  cancelLabel: string | null
  danger: boolean
  resolve: (ok: boolean) => void
}

/** 画面中央に少しのあいだ出す知らせ */
export interface Notice {
  id: number
  title: string
  message: string
  tone: 'info' | 'good' | 'warn' | 'bad'
  icon: string
  /** 「〇〇が判明」などの大きな見出し部分 */
  highlight?: { label: string; value: string; rank?: string }
  /** 複数の見出し（スカウトで2つ分かったときなど） */
  highlights?: { label: string; value: string; rank?: string }[]
  duration: number
}
export type NoticeInput = Partial<Omit<Notice, 'id' | 'message'>> & { message: string }

export const useUiStore = defineStore('ui', () => {
  const dialog = ref<DialogRequest | null>(null)
  const toast = ref<string | null>(null)
  const updateAvailable = ref(false)
  /** 選手詳細で「前の選手・次の選手」に移るための並び（部員一覧で開いたときの順） */
  const playerNav = ref<string[]>([])
  /** 選手詳細で最後に開いていたタブ（次の選手に移っても同じタブを開く） */
  const playerTab = ref<string | null>(null)
  let applyUpdate: (() => Promise<void>) | null = null
  /** 版の確認に使う（Web版でオフライン対応が動いているときだけ） */
  let registration: ServiceWorkerRegistration | null = null
  /** 最後に版を確認した週（同じ週で何度も確かめない） */
  let checkedKey = ''

  function confirm(
    message: string,
    opts: { title?: string; okLabel?: string; cancelLabel?: string; danger?: boolean } = {},
  ): Promise<boolean> {
    return new Promise((resolve) => {
      dialog.value = {
        title: opts.title ?? '確認',
        message,
        okLabel: opts.okLabel ?? 'はい',
        cancelLabel: opts.cancelLabel ?? 'いいえ',
        danger: opts.danger ?? false,
        resolve,
      }
    })
  }

  function alert(message: string, title = 'お知らせ'): Promise<boolean> {
    return new Promise((resolve) => {
      dialog.value = { title, message, okLabel: 'OK', cancelLabel: null, danger: false, resolve }
    })
  }

  function closeDialog(ok: boolean): void {
    const d = dialog.value
    dialog.value = null
    d?.resolve(ok)
  }

  const notice = ref<Notice | null>(null)
  let noticeId = 0

  /** 中央のポップアップで知らせる */
  function notify(n: NoticeInput): void {
    const warn = /できません|られません|足りません|ありません/.test(n.message)
    const tone = n.tone ?? (warn ? 'warn' : 'good')
    notice.value = {
      id: ++noticeId,
      title: n.title ?? (tone === 'warn' ? 'ご注意' : tone === 'bad' ? '残念…' : tone === 'info' ? 'お知らせ' : 'OK！'),
      message: n.message,
      tone,
      icon: n.icon ?? (tone === 'warn' ? 'warn' : tone === 'bad' ? 'bad' : tone === 'info' ? 'info' : 'check'),
      highlights: n.highlights ?? (n.highlight ? [n.highlight] : undefined),
      duration: n.duration ?? (n.highlight || n.highlights ? 3200 : 2200),
    }
  }
  function closeNotice(): void {
    notice.value = null
  }
  /** 以前からの呼び方。文字だけの知らせも、中央のポップアップで出す */
  function showToast(message: string, opts: Partial<NoticeInput> = {}): void {
    notify({ ...opts, message })
  }

  function setUpdater(fn: () => Promise<void>): void {
    applyUpdate = fn
    updateAvailable.value = true
  }

  async function runUpdate(): Promise<void> {
    await applyUpdate?.()
  }

  function setRegistration(r: ServiceWorkerRegistration | undefined): void {
    registration = r ?? null
  }

  /**
   * 新しい版が出ていないか確かめる（週を進めてセーブしたあとに呼ぶ）。
   * 新しい版があれば true。同じ週に2回目以降は確かめない
   */
  async function checkForUpdate(key: string): Promise<boolean> {
    if (updateAvailable.value) return true
    if (!registration || checkedKey === key || !navigator.onLine) return false
    checkedKey = key
    try {
      await registration.update()
    } catch {
      return false
    }
    // 新しい版が見つかったら、読み込みが終わるまで少し待つ（最大10秒）
    for (let i = 0; i < 40 && !updateAvailable.value; i++) {
      if (!registration.installing && !registration.waiting) break
      await new Promise((r) => setTimeout(r, 250))
    }
    return updateAvailable.value
  }

  return { dialog, toast, notice, notify, closeNotice, updateAvailable, playerNav, playerTab, confirm, alert, closeDialog, showToast, setUpdater, runUpdate, setRegistration, checkForUpdate }
})
