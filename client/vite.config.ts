import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// vite.config.ts — standalone React app (ไม่ต้องพึ่ง backend localhost:3000)
export default defineConfig({
  plugins: [tailwindcss(), react()],
  base: '/ocsc-circular/',
  server: {
    port: 5173,
    host: '0.0.0.0',
    proxy: {
      '^/ocsc-circular/admin/.*': {
        target: 'http://127.0.0.1:5175',
        changeOrigin: true
      },
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
