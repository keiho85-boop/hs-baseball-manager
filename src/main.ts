import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { registerSW } from 'virtual:pwa-register'
import App from './App.vue'
import { router } from './router'
import { useUiStore } from './stores/ui'
import './style.css'

const app = createApp(App)
const pinia = createPinia()
app.use(pinia)
app.use(router)
app.mount('#app')

// オフライン対応。新しい版が届いても、タイトル画面で「更新」を押したときだけ切り替える
const ui = useUiStore(pinia)
const updateSW = registerSW({
  onNeedRefresh() {
    ui.setUpdater(() => updateSW(true))
  },
})
