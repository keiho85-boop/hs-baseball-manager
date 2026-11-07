/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'

// GitHub Pages では https://<アカウント>.github.io/hs-baseball-manager/ で公開されるため base を合わせる
// mode が app のときは、Androidアプリ（Capacitor）に入れる版を作る（サーバー上の場所に依存せず、オフライン保存の仕組みも使わない）
// mode が artifact のときは、claude.ai の確認用ページに載せる版を作る（app と同じ作りで、フォントは Google Fonts から読む）
export default defineConfig(({ mode }) => {
  const standalone = mode === 'app' || mode === 'artifact'
  return {
  base: standalone ? './' : '/hs-baseball-manager/',
  build: { outDir: mode === 'app' ? 'dist-app' : mode === 'artifact' ? 'dist-artifact' : 'dist' },
  define: { __APP_BUILD__: JSON.stringify(standalone) },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // 確認用ページでは、細かく分かれたフォントのファイルを持たず Google Fonts から読む
      ...(mode === 'artifact'
        ? { '@fontsource/m-plus-rounded-1c': fileURLToPath(new URL('./src/assets/fonts-google', import.meta.url)) }
        : {}),
    },
  },
  plugins: [
    vue(),
    mode === 'artifact' && {
      name: 'google-fonts',
      transformIndexHtml: (html: string) =>
        html.replace(
          '</head>',
          '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=M+PLUS+Rounded+1c:wght@500;800;900&display=swap" />\n</head>',
        ),
    },
    !standalone &&
    VitePWA({
      // 更新はタイトル画面に戻ったときだけ反映する（プレイ中は切り替えない）
      registerType: 'prompt',
      includeAssets: ['icon.svg', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png'],
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
        background_color: '#0a1426',
        theme_color: '#1d4f9e',
        // Google Play（TWA）や Android のホーム画面では PNG のアイコンが必要
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        ],
      },
      workbox: {
        // フォントは文字の範囲ごとに細かく分かれていて数が多いため、最初にまとめて保存せず、
        // 使った分だけ保存する（一度表示した文字は通信なしでも表示できる）
        globPatterns: ['**/*.{js,css,html,svg,png}'],
        globIgnores: ['intro/**', 'privacy/**'],
        navigateFallback: '/hs-baseball-manager/index.html',
        // 紹介ページはゲーム本体とは別のページとして開く
        navigateFallbackDenylist: [/\/intro\//, /\/privacy\//],
        runtimeCaching: [
          {
            // ストーリーの立ち絵・背景・一枚絵は、最初にまとめて保存せず、表示した分だけ保存する
            urlPattern: ({ url }) => /\/(chara|bg|ev)\/[^/]+\.webp$/.test(url.pathname),
            handler: 'CacheFirst',
            options: {
              cacheName: 'story-art',
              expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
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
  }
})
