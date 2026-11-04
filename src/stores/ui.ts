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

export const useUiStore = defineStore('ui', () => {
  const dialog = ref<DialogRequest | null>(null)
  const toast = ref<string | null>(null)
  const updateAvailable = ref(false)
  /** 選手詳細で「前の選手・次の選手」に移るための並び（部員一覧で開いたときの順） */
  const playerNav = ref<string[]>([])
  /** 選手詳細で最後に開いていたタブ（次の選手に移っても同じタブを開く） */
  const playerTab = ref<string | null>(null)
  let toastTimer: ReturnType<typeof setTimeout> | undefined
  let applyUpdate: (() => Promise<void>) | null = null

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

  function showToast(message: string): void {
    toast.value = message
    clearTimeout(toastTimer)
    toastTimer = setTimeout(() => (toast.value = null), 2500)
  }

  function setUpdater(fn: () => Promise<void>): void {
    applyUpdate = fn
    updateAvailable.value = true
  }

  async function runUpdate(): Promise<void> {
    await applyUpdate?.()
  }

  return { dialog, toast, updateAvailable, playerNav, playerTab, confirm, alert, closeDialog, showToast, setUpdater, runUpdate }
})
