import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  server: {
    proxy: {
      '/api': {
        target: process.env.VITE_WORKER_DEV_URL ?? 'http://127.0.0.1:8787',
        changeOrigin: true
      }
    }
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'STOWAWAY',
        short_name: 'STOWAWAY',
        description: 'A context-aware inventory operating system.',
        theme_color: 'hsl(218 34% 9%)',
        background_color: 'hsl(218 34% 9%)',
        display: 'standalone',
        start_url: '/',
        icons: []
      }
    })
  ]
});
