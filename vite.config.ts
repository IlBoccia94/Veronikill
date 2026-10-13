import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: '/Veronikill/',
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        id: '/Veronikill/',
        name: 'Veronikill — Zero resi',
        short_name: 'Veronikill',
        description: 'Uno shooter arcade top-down. Sopravvivi, raccogli potenziamenti e raggiungi la libreria.',
        theme_color: '#26182e',
        background_color: '#26182e',
        display: 'standalone',
        orientation: 'landscape',
        start_url: '/Veronikill/',
        scope: '/Veronikill/',
        icons: [
          { src: '/Veronikill/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
        navigateFallback: '/Veronikill/index.html',
        cleanupOutdatedCaches: true
      }
    })
  ]
});
