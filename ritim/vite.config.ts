/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Yayın adresi: https://ahmet85.github.io/Ahmet85/ritim/
// Yerelde denerken RITIM_BASE=/ ile değiştirilebilir.
const base = process.env.RITIM_BASE ?? '/Ahmet85/ritim/';

export default defineConfig({
  base,
  define: { __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? '0.1.0') },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Ritim',
        short_name: 'Ritim',
        description: 'Kişisel hayat ajandası ve nazik yaşam koçu',
        lang: 'tr',
        theme_color: '#F6F0E4',
        background_color: '#F6F0E4',
        display: 'standalone',
        start_url: base,
        scope: base,
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml' },
        ],
      },
      workbox: { globPatterns: ['**/*.{js,css,html,svg,png,woff2}'] },
    }),
  ],
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
});
