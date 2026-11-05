// 広告（Androidアプリ版だけ。Web版では何もしない）
// 画面最下部のバナー広告の場所（--ad-height）に AdMob のバナーを重ねる。
// 「広告を消す」を購入したら、バナーを外してその分画面を広く使う。
import { Capacitor } from '@capacitor/core'

const REMOVED_KEY = 'hsbm:adsRemoved'
/** 本番の広告ユニットIDは公開前に差し替える（今はGoogleのテスト用ID） */
const BANNER_ID = 'ca-app-pub-3940256099942544/6300978111'

export function isNativeApp(): boolean {
  return Capacitor.isNativePlatform()
}

export function adsRemoved(): boolean {
  try {
    return localStorage.getItem(REMOVED_KEY) === '1'
  } catch {
    return false
  }
}

/** 広告の場所の高さを決める（Web版と、広告を消したアプリでは 0） */
function setSlot(px: number): void {
  document.documentElement.style.setProperty('--ad-height', `${px}px`)
}

export async function setupAds(): Promise<void> {
  if (!isNativeApp() || adsRemoved()) {
    setSlot(0)
    return
  }
  try {
    const { AdMob, BannerAdPosition, BannerAdSize } = await import('@capacitor-community/admob')
    await AdMob.initialize({ initializeForTesting: true })
    await AdMob.showBanner({
      adId: BANNER_ID,
      adSize: BannerAdSize.ADAPTIVE_BANNER,
      position: BannerAdPosition.BOTTOM_CENTER,
      margin: 0,
      isTesting: true,
    })
    setSlot(56)
  } catch {
    setSlot(0)
  }
}

/** 試合画面など、広告を隠したい画面で使う */
export async function hideBanner(hide: boolean): Promise<void> {
  if (!isNativeApp() || adsRemoved()) return
  try {
    const { AdMob } = await import('@capacitor-community/admob')
    if (hide) await AdMob.hideBanner()
    else await AdMob.resumeBanner()
  } catch {
    /* 広告が読み込めていないときは何もしない */
  }
}

/** 「広告を消す」を購入したとき（課金の仕組みは公開準備で Google Play の課金とつなぐ） */
export async function removeAds(): Promise<void> {
  try {
    localStorage.setItem(REMOVED_KEY, '1')
  } catch {
    /* 保存できない環境 */
  }
  if (isNativeApp()) {
    try {
      const { AdMob } = await import('@capacitor-community/admob')
      await AdMob.removeBanner()
    } catch {
      /* すでに外れている */
    }
  }
  setSlot(0)
}
