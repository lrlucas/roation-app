import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Proxy OAuth token endpoint (evita CORS en desarrollo)
      '/wcl-oauth': {
        target:      'https://www.warcraftlogs.com',
        changeOrigin: true,
        rewrite:     (path) => path.replace(/^\/wcl-oauth/, '/oauth'),
      },
      // Proxy GraphQL API endpoint
      '/wcl-api': {
        target:      'https://www.warcraftlogs.com',
        changeOrigin: true,
        rewrite:     (path) => path.replace(/^\/wcl-api/, '/api'),
      },
    },
  },
})
