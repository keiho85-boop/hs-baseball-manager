import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { registerSW } from 'virtual:pwa-register'
import App from './App.vue'
import { router } from './router'
import { useUiStore } from './stores/ui'
import { setupFullscreen } from './fullscreen'
import { installTapSound } from './sound'
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
setupFullscreen()

// オフライン対応。新しい版が届いても、タイトル画面で「更新」を押したときだけ切り替える
const ui = useUiStore(pinia)
const updateSW = registerSW({
  onNeedRefresh() {
    ui.setUpdater(() => updateSW(true))
  },
})
