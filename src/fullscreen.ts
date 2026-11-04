// 全画面表示：アプリとして起動したときも、ブラウザで開いたときも、全画面で遊べるようにする

const KEY = 'hsbm:fullscreen'

export function fullscreenEnabled(): boolean {
  try {
    return localStorage.getItem(KEY) !== 'off'
  } catch {
    return true
  }
}

export function setFullscreenEnabled(on: boolean): void {
  try {
    localStorage.setItem(KEY, on ? 'on' : 'off')
  } catch {
    /* 保存できない環境では何もしない */
  }
  if (on) void enterFullscreen()
  else if (document.fullscreenElement) void document.exitFullscreen().catch(() => {})
}

/** ホーム画面のアイコンから全画面で起動しているか */
function launchedFullscreen(): boolean {
  return window.matchMedia?.('(display-mode: fullscreen)').matches ?? false
}

export async function enterFullscreen(): Promise<void> {
  if (!fullscreenEnabled() || document.fullscreenElement || launchedFullscreen()) return
  const el = document.documentElement
  if (!el.requestFullscreen) return
  try {
    await el.requestFullscreen({ navigationUI: 'hide' })
    // 縦向きに固定（対応している端末のみ）
    const orientation = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> }
    await orientation.lock?.('portrait').catch(() => {})
  } catch {
    /* 全画面にできない環境では、そのまま続ける */
  }
}

/**
 * ブラウザの決まりで、全画面は「画面に触れたとき」にしか始められない。
 * そこで、画面に触れるたびに（全画面でなければ）全画面に戻す。
 */
export function setupFullscreen(): void {
  const handler = () => void enterFullscreen()
  window.addEventListener('pointerup', handler, { passive: true })
}
