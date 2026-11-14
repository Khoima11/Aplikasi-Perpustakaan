import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'SIMPUS - Sistem Informasi Perpustakaan Sekolah',
        short_name: 'SIMPUS',
        description: 'Katalog dan informasi pinjaman perpustakaan sekolah',
        lang: 'id',
        start_url: '/',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#1d4ed8',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Data perpustakaan selalu diambil langsung dari server (tidak di-cache),
        // agar ketersediaan buku dan jatuh tempo selalu terbaru.
        navigateFallback: '/index.html',
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
      },
    }),
  ],
})
