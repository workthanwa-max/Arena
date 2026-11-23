import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 1800,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: 'three',
              test: /node_modules[\\/]three/,
              priority: 25,
            },
            {
              name: 'phaser',
              test: /node_modules[\\/]phaser/,
              priority: 20,
            },
            {
              name: 'vendor',
              test: /node_modules[\\/](react|react-dom|gsap|zustand)/,
              priority: 10,
            },
          ],
        },
      },
    },
  },
  server: {
    port: 5555,
    strictPort: true,
    allowedHosts: ['arene.kitsakorn.com', 'arena.kitsakorn.com', 'loykrathong.kitsakorn.com'],
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
    proxy: {
      '/api': {
        target: 'http://localhost:7777',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://localhost:7777',
        ws: true,
        changeOrigin: true,
      },
    },
  },
})
