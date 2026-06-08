import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/detect-source': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/transcribe': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/transcribe-chunk': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/transcribe-large': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/extract-audio-url': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/translate-text': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/health': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
})
