import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { router } from './router'
import { useUiStore } from './stores/ui'
import { setupFullscreen } from './fullscreen'
import { installTapSound } from './sound'
import { setupAds } from './ads'
// 太く丸みのある日本語フォント（無料で商用利用できる M PLUS Rounded 1c、SIL Open Font License）
import '@fontsource/m-plus-rounded-1c/500.css'
import '@fontsource/m-plus-rounded-1c/800.css'
import '@fontsource/m-plus-rounded-1c/900.css'
import './style.css'

const app = createApp(App)
const pinia = createPinia()
app.use(pinia)
app.use(router)
app.mount('#app')
installTapSound()
void setupAds()
// アプリ版は最初から全画面なので、ブラウザの全画面表示は使わない
if (!__APP_BUILD__) setupFullscreen()

// オフライン対応（Web版だけ）。新しい版が届いても、タイトル画面で「更新」を押したときだけ切り替える
// Androidアプリ版はアプリの中にすべて入っているので不要
if (!__APP_BUILD__) {
  const ui = useUiStore(pinia)
  void import('virtual:pwa-register').then(({ registerSW }) => {
    const updateSW = registerSW({
      onNeedRefresh() {
        ui.setUpdater(() => updateSW(true))
      },
    })
  })
}
