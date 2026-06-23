import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// vite.config.ts — Admin-only dashboard (no public pages)
export default defineConfig({
  plugins: [tailwindcss(), react()],
  base: '/bma_ocsc_circular/admin/',
  server: {
    port: 5175,
    host: '0.0.0.0',
    proxy: {
      '^/api/.*': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true
      },
      '^/uploads/.*': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true
      },
      '^/image/.*': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router-dom')) {
              return 'react';
            }
            if (id.includes('axios') || id.includes('moment') || id.includes('sweetalert2')) {
              return 'vendor';
            }
          }
        }
      }
    }
  },
})
