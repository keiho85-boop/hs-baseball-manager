/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'

// GitHub Pages では https://<アカウント>.github.io/hs-baseball-manager/ で公開されるため base を合わせる
export default defineConfig({
  base: '/hs-baseball-manager/',
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  plugins: [
    vue(),
    VitePWA({
      // 更新はタイトル画面に戻ったときだけ反映する（プレイ中は切り替えない）
      registerType: 'prompt',
      includeAssets: ['icon.svg'],
      manifest: {
        name: '高校野球監督ゲーム（仮）',
        short_name: '監督ゲーム',
        description: '高校野球の監督として、選手を育て、采配を振るい、学校を強くする',
        lang: 'ja',
        start_url: '/hs-baseball-manager/',
        scope: '/hs-baseball-manager/',
        // ホーム画面のアイコンから起動したときは全画面で表示する
        display: 'fullscreen',
        display_override: ['fullscreen', 'standalone'],
        orientation: 'portrait',
        background_color: '#f4f1ea',
        theme_color: '#1f5130',
        icons: [
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
        ],
      },
      workbox: {
        // フォントは文字の範囲ごとに細かく分かれていて数が多いため、最初にまとめて保存せず、
        // 使った分だけ保存する（一度表示した文字は通信なしでも表示できる）
        globPatterns: ['**/*.{js,css,html,svg,png}'],
        globIgnores: ['intro/**'],
        navigateFallback: '/hs-baseball-manager/index.html',
        // 紹介ページはゲーム本体とは別のページとして開く
        navigateFallbackDenylist: [/\/intro\//],
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.destination === 'font',
            handler: 'CacheFirst',
            options: {
              cacheName: 'fonts',
              expiration: { maxEntries: 400, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
        ],
      },
    }),
  ],
  test: {
    environment: 'node',
  },
})
