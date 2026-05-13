import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// vite.config.js — standalone React app (ไม่ต้องพึ่ง backend localhost:3000)
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // ไม่มี proxy → app ทำงานแบบ standalone ด้วย mock data
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
})
