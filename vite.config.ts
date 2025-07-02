// © 2025 Mark Hustad — MIT License
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000', // Target Vercel dev server (running on 3000)
        changeOrigin: true,
        // No rewrite needed if /api on frontend maps to /api on backend
      },
    },
  },
})
