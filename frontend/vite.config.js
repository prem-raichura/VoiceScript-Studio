import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
  const env = loadEnv(mode, process.cwd(), '')
  const apiUrl = env.VITE_API_BASE_URL || 'http://localhost:8000'

  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        '/detect-source': {
          target: apiUrl,
          changeOrigin: true,
        },
        '/transcribe': {
          target: apiUrl,
          changeOrigin: true,
        },
        '/transcribe-chunk': {
          target: apiUrl,
          changeOrigin: true,
        },
        '/transcribe-large': {
          target: apiUrl,
          changeOrigin: true,
        },
        '/extract-audio-url': {
          target: apiUrl,
          changeOrigin: true,
        },
        '/translate-text': {
          target: apiUrl,
          changeOrigin: true,
        },
        '/health': {
          target: apiUrl,
          changeOrigin: true,
        },
      },
    },
  }
})
