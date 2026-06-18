import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// vite.config.js — standalone React app (ไม่ต้องพึ่ง backend localhost:3000)
export default defineConfig({
  plugins: [react()],
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
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          vendor: ['axios', 'moment', 'sweetalert2']
        }
      }
    }
  },
})
