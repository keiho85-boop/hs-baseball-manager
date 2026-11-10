import type { CapacitorConfig } from '@capacitor/cli'

// Androidアプリ（Google Play 用）の設定。アプリIDは公開後に変えられないので注意
const config: CapacitorConfig = {
  appId: 'io.github.keiho85boop.hsbaseball',
  appName: '転生名将ナギ',
  webDir: 'dist-app',
  backgroundColor: '#0a1426',
  android: {
    // 画面の明るさの切り替えでWebViewの色が変わらないように
    backgroundColor: '#0a1426',
  },
  plugins: {
    AdMob: {
      // 本番の広告IDは公開前に差し替える（今はGoogleのテスト用ID）
      appIdAndroid: 'ca-app-pub-3940256099942544~3347511713',
    },
  },
}

export default config
