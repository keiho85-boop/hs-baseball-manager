<script setup lang="ts">
import GameIcon from '@/components/GameIcon.vue'
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useGameStore } from '@/stores/game'
import { useUiStore } from '@/stores/ui'
import { ref } from 'vue'
import { fullscreenEnabled, setFullscreenEnabled } from '@/fullscreen'
import { play, setSoundEnabled, soundEnabled } from '@/sound'

const game = useGameStore()
const ui = useUiStore()
const router = useRouter()

const settings = computed(() => {
  void game.rev
  return game.save?.settings
})

const fullscreen = ref(fullscreenEnabled())
const sound = ref(soundEnabled())
function toggleSound(): void {
  sound.value = !sound.value
  setSoundEnabled(sound.value)
  if (sound.value) play('hit')
}
function toggleFullscreen(): void {
  fullscreen.value = !fullscreen.value
  setFullscreenEnabled(fullscreen.value)
}


async function toggle(key: 'cutin' | 'lightMode'): Promise<void> {
  if (!game.save) return
  game.save.settings[key] = !game.save.settings[key]
  await game.commit()
}

async function exportNow(): Promise<void> {
  await game.exportCurrent()
  ui.showToast('書き出しました')
}

async function backToTitle(): Promise<void> {
  const ok = await ui.confirm('タイトル画面に戻りますか？\n（進行状況は自動で保存されています）', {
    okLabel: '戻る',
    cancelLabel: '続ける',
  })
  if (!ok) return
  game.closeGame()
  await router.replace({ name: 'title' })
}
</script>

<template>
  <div v-if="settings" class="page">
    <button class="plain" @click="router.back()"><GameIcon name="back" :size="16" /> 戻る</button>

    <div class="card stack">
      <h2>ゲームの設定</h2>
      <label class="row">
        <input type="checkbox" class="check" :checked="sound" @change="toggleSound" />
        効果音を鳴らす
      </label>
      <label class="row">
        <input type="checkbox" class="check" :checked="fullscreen" @change="toggleFullscreen" />
        全画面で表示する
      </label>
      <label class="row">
        <input type="checkbox" class="check" :checked="settings.cutin" @change="toggle('cutin')" />
        ピンチ・チャンスのカットインを表示する
      </label>
      <label class="row">
        <input type="checkbox" class="check" :checked="settings.lightMode" @change="toggle('lightMode')" />
        軽量モード（演出を減らして動作を軽くする）
      </label>
      <p class="muted">軽量モードは、今後追加する演出から順に効くようになります。</p>
    </div>

    <div class="card stack">
      <h2>データ</h2>
      <p class="muted">進行状況は毎週自動で保存されています。機種変更やアプリの削除に備えて、ファイルにも書き出しておけます。</p>
      <button class="secondary full" @click="exportNow">セーブデータを書き出す</button>
      <p v-if="game.persistent === false" class="muted warn">
        このブラウザでは「保存データを消さない」設定が許可されませんでした。端末の空き容量が少ないと、データが消える可能性があります。こまめな書き出しをおすすめします。
      </p>
    </div>

    <button class="danger full" @click="backToTitle">タイトル画面に戻る</button>
    <p class="links"><a href="./privacy/" target="_blank" rel="noopener">プライバシーポリシー</a>・<a href="./intro/" target="_blank" rel="noopener">ゲーム紹介</a></p>
  </div>
</template>

<style scoped>
.links {
  text-align: center;
  font-size: 13px;
  margin-top: 16px;
}
.links a {
  color: var(--sky-deep);
  font-weight: 800;
}
.label {
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 4px;
}
.choices {
  display: flex;
  gap: 8px;
}
.choices button {
  flex: 1;
}
.check {
  width: auto;
}
.warn {
  color: var(--red);
}
</style>
