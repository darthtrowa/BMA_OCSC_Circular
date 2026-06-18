import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// vite.config.ts — Public-only circular lookup (lightweight build)
export default defineConfig({
  plugins: [tailwindcss(), react()],
  base: '/ocsc-circular/',
  server: {
    port: 5174,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom')) {
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
