import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// vite.config.ts — Admin-only dashboard (no public pages)
export default defineConfig({
  plugins: [react()],
  base: '/ocsc-circular/admin/',
  server: {
    port: 5175,
    host: '127.0.0.1',
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
