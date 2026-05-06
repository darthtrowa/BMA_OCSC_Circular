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
app.get('/favicon.ico', (req, res) => res.sendFile(path.join(__dirname, '../favicon.ico')))

// ─── Routes ──────────────────────────────────────────────────
app.use('/api',       publicRoutes)   // Public API
app.use('/api/chat',  chatRoutes)     // AI Chat
app.use('/admin',     adminRoutes)    // Admin API (JWT protected)

// ─── Root: Status Dashboard ──────────────────────────────────
app.get('/', async (_, res) => {
  let dbStatus = 'Offline';
  try {
    const pool = require('./config/database');
    await pool.query('SELECT NOW()');
    dbStatus = 'Online';
  } catch (e) {
    dbStatus = 'Error';
  }

  const thaiDate = new Intl.DateTimeFormat('th-TH', {
    dateStyle: 'full',
    timeStyle: 'medium',
  }).format(new Date());

  res.send(`
    <!DOCTYPE html>
    <html lang="th">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>CSC Circular API - Dashboard</title>
      <link href="https://fonts.googleapis.com/css2?family=Anuphan:wght@300;400;600&family=Outfit:wght@400;600&display=swap" rel="stylesheet">
      <link href="https://unpkg.com/boxicons@2.1.4/css/boxicons.min.css" rel="stylesheet">
      <style>
        :root {
          --primary: #4f46e5;
          --success: #10b981;
          --error: #ef4444;
          --bg: #0f172a;
        }
        body {
          font-family: 'Anuphan', 'Outfit', sans-serif;
          background: var(--bg);
          color: #f8fafc;
          margin: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          background: radial-gradient(circle at top left, #1e293b 0%, #0f172a 100%);
        }
        .container {
          width: 90%;
          max-width: 600px;
          background: rgba(30, 41, 59, 0.7);
          backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 24px;
          padding: 40px;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
          text-align: center;
        }
        .logo-area {
          font-size: 48px;
          color: var(--primary);
          margin-bottom: 20px;
          filter: drop-shadow(0 0 10px rgba(79, 70, 229, 0.4));
        }
        h1 { margin: 0; font-size: 28px; font-weight: 600; letter-spacing: -0.5px; }
        .status-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: rgba(16, 185, 129, 0.1);
          color: var(--success);
          padding: 6px 16px;
          border-radius: 100px;
          font-size: 14px;
          font-weight: 600;
          margin-top: 15px;
          border: 1px solid rgba(16, 185, 129, 0.2);
        }
        .grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
          margin-top: 40px;
          text-align: left;
        }
        .card {
          background: rgba(255, 255, 255, 0.03);
          padding: 20px;
          border-radius: 16px;
          border: 1px solid rgba(255, 255, 255, 0.05);
        }
        .card-label { font-size: 12px; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 5px; }
        .card-value { font-size: 16px; font-weight: 600; color: #f1f5f9; }
        .btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          margin-top: 30px;
          background: var(--primary);
          color: white;
          text-decoration: none;
          padding: 14px;
          border-radius: 12px;
          font-weight: 600;
          transition: all 0.3s;
          box-shadow: 0 10px 15px -3px rgba(79, 70, 229, 0.3);
        }
        .btn:hover { transform: translateY(-2px); box-shadow: 0 20px 25px -5px rgba(79, 70, 229, 0.4); }
        .footer { margin-top: 40px; font-size: 12px; color: #64748b; }
        .dot { height: 8px; width: 8px; border-radius: 50%; background-color: var(--success); display: inline-block; animation: pulse 2s infinite; }
        @keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.4; } 100% { opacity: 1; } }
        .status-error { color: var(--error); background: rgba(239, 68, 68, 0.1); border-color: rgba(239, 68, 68, 0.2); }
        .status-error .dot { background-color: var(--error); }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="logo-area"><i class='bx bxs-zap'></i></div>
        <h1>CSC Circular API</h1>
        <div class="status-badge">
          <span class="dot"></span> 🟢 API Server Online
        </div>

        <div class="grid">
          <div class="card">
            <div class="card-label">Database</div>
            <div class="card-value ${dbStatus === 'Online' ? '' : 'text-error'}">
              <i class='bx bxs-data'></i> ${dbStatus}
            </div>
          </div>
          <div class="card">
            <div class="card-label">Environment</div>
            <div class="card-value"><i class='bx bx-code-alt'></i> ${process.env.NODE_ENV || 'development'}</div>
          </div>
          <div class="card" style="grid-column: span 2;">
            <div class="card-label">Current Time (Server)</div>
            <div class="card-value"><i class='bx bx-time-five'></i> ${thaiDate}</div>
          </div>
        </div>

        <a href="http://localhost:5173" class="btn">
          <i class='bx bx-window-open'></i> Open Frontend Dashboard
        </a>

        <div class="footer">
          &copy; 2024 CSC Circular System • API Gateway v1.0.0
        </div>
      </div>
    </body>
    </html>
  `);
});

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
