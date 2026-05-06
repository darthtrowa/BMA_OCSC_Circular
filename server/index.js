/**
 * server/index.js — BMA Circular API Server (Clean)
 *
 * Endpoints:
 *   GET  /api/filters        Public: dropdown data
 *   GET  /api/stats          Public: statistics
 *   POST /api/search         Public: search circulars
 *   POST /api/chat           Public: AI chat
 *   GET  /api/chat/ping      Public: ping AI
 *
 *   POST /admin/auth/login             Auth: login → JWT
 *   GET  /admin/dashboard              Admin: all data
 *   POST /admin/circular/create        Admin: create
 *   POST /admin/circular/update        Admin: update
 *   POST /admin/circular/delete        Admin: delete
 *   GET  /admin/profile                Admin: get profile
 *   POST /admin/profile                Admin: update name
 *   POST /admin/profile/change-password Admin: change pw
 *   POST /admin/master/action          Admin: master CRUD
 */
require('dotenv').config()
const express = require('express')
const cors    = require('cors')
const path    = require('path')

const publicRoutes = require('./routes/public')
const adminRoutes  = require('./routes/admin')
const chatRoutes   = require('./routes/chat')

const app  = express()
const PORT = process.env.PORT || 3000

// ─── Middleware ───────────────────────────────────────────────
app.use(cors({
  origin: [
    'http://localhost:5173',  // Vite dev
    'http://localhost:4173',  // Vite preview
    /^http:\/\/localhost:\d+$/,
  ],
  credentials: true,
}))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// ─── Static: Uploaded files ───────────────────────────────────
app.use('/uploads', express.static(path.join(__dirname, '../uploads')))
app.use('/image',   express.static(path.join(__dirname, '../image')))

// ─── Routes ──────────────────────────────────────────────────
app.use('/api',       publicRoutes)   // Public API
app.use('/api/chat',  chatRoutes)     // AI Chat
app.use('/admin',     adminRoutes)    // Admin API (JWT protected)

// ─── Health check ────────────────────────────────────────────
app.get('/health', (_, res) =>
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
)

// ─── 404 ─────────────────────────────────────────────────────
app.use((req, res) =>
  res.status(404).json({ status: false, message: `Route not found: ${req.method} ${req.path}` })
)

// ─── Global error handler ─────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('❌ Server Error:', err.message)
  res.status(500).json({ status: false, message: 'Internal Server Error' })
})

// ─── Start ────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log('\n🚀 BMA Circular API Server')
  console.log(`   URL:    http://localhost:${PORT}`)
  console.log(`   Health: http://localhost:${PORT}/health`)
  console.log(`   Mode:   ${process.env.NODE_ENV || 'development'}\n`)
})
