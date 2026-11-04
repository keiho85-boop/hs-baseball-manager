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
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#f4f1ea',
        theme_color: '#1f5130',
        icons: [
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: '/hs-baseball-manager/index.html',
      },
    }),
  ],
  test: {
    environment: 'node',
  },
})
