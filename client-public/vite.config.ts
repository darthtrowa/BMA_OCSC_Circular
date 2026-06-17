import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// vite.config.ts — Public-only circular lookup (lightweight build)
export default defineConfig({
  plugins: [react()],
  base: '/ocsc-circular/',
  server: {
    port: 5174,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom'],
          vendor: ['axios', 'moment', 'sweetalert2']
        }
      }
    }
  },
})
