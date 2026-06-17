import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';

import publicRoutes from './routes/public.js';
import adminRoutes from './routes/admin.js';
import workflowRoutes from './routes/workflowRoutes.js';

import delegationRoutes from './routes/delegationRoutes.js';
import pool from './config/database.js';
import { runMigrations } from './config/migrations.js';
import { initAdminJS } from './config/adminjs.js';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './config/swagger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Security Middleware ──────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "blob:", "https:"],
      connectSrc: ["'self'"],
    }
  },
}));

// ─── CORS ─────────────────────────────────────────────────────
// SEC-06: Default to production-safe CORS (was permissive when NODE_ENV unset)
const isProduction = process.env.NODE_ENV !== 'development';
const corsOrigins: (string | RegExp)[] = [
  ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : []),
];
if (!isProduction) {
  corsOrigins.push(
    'http://localhost',
    'http://localhost:5173',
    'http://localhost:4173',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:4173',
    /^http:\/\/localhost:\d+$/,
    /^http:\/\/127.0.0.1:\d+$/,
  );
}
app.use(cors({
  origin: corsOrigins,
  credentials: true,
}));

// Rate limiter for public API (generous)
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 2000, // Increased limit from 200 to 2000 to prevent local dev blocking
  standardHeaders: true,
  legacyHeaders: false,
  message: { status: false, message: 'Too many requests, please try again later.' }
});
// Rate limiter for admin auth (strict — anti brute-force)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { status: false, message: 'Too many login attempts, please try again later.' }
});
app.use('/api', apiLimiter);
app.use('/api/admin/auth', authLimiter);
// ─── AdminJS Internal Control Panel (MUST BE BEFORE BODY PARSERS) ───
await initAdminJS(app);

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// ─── Static: Uploaded files ───────────────────────────────────
    // Nginx now serves /uploads, /image, and /fonts directly (see client/nginx.conf)
app.get('/favicon.ico', (req, res) => res.sendFile(path.join(__dirname, '../../favicon.ico')));

app.use('/uploads', express.static(path.join(__dirname, '../../uploads')));
app.use('/image', express.static(path.join(__dirname, '../../image')));
// ─── Routes ──────────────────────────────────────────────────
import { auditMiddleware } from './middleware/auditMiddleware.js';

app.use('/api', publicRoutes);
app.use('/api/admin', auditMiddleware, adminRoutes);
app.use('/api/admin/workflow', auditMiddleware, workflowRoutes);

app.use('/api/admin/delegations', auditMiddleware, delegationRoutes);

// ─── Swagger Documentation ────────────────────────────────────
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// ─── Root: Status Dashboard ──────────────────────────────────
app.get('/', async (_req: Request, res: Response) => {
  // SEC-11: Strip environment details in production
  if (isProduction) {
    return res.json({ status: 'ok', service: 'CSC Circular API' });
  }

  let dbStatus = 'Offline';
  try {
    await pool.query('SELECT 1');
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
      <link href="https://fonts.googleapis.com/css2?family=Anuphan:wght@300;400;500;600;700&family=Inter:wght@300;400;500;600;700&family=Sarabun:wght@300;400;500;600;700&display=swap" rel="stylesheet">
      <link href="https://unpkg.com/boxicons@2.1.4/css/boxicons.min.css" rel="stylesheet">
      <style>
        @font-face {
          font-family: "SaoChingcha";
          src: url("/fonts/SaoChingcha-Regular.otf") format("opentype");
          font-weight: 400;
          font-style: normal;
          font-display: swap;
        }
        @font-face {
          font-family: "SaoChingcha";
          src: url("/fonts/SaoChingcha-Bold.otf") format("opentype");
          font-weight: 700;
          font-style: normal;
          font-display: swap;
        }
        .font-saochingcha {
          font-family: 'SaoChingcha', 'Anuphan', 'Sarabun', sans-serif !important;
        }
        :root {
          --primary: #10b981;
          --success: #10b981;
          --error: #ef4444;
          --bg: #0f172a;
        }
        body {
          font-family: 'Anuphan', 'Inter', 'Sarabun', sans-serif;
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
          filter: drop-shadow(0 0 10px rgba(16, 185, 129, 0.4));
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
          box-shadow: 0 10px 15px -3px rgba(16, 185, 129, 0.3);
        }
        .btn:hover { transform: translateY(-2px); box-shadow: 0 20px 25px -5px rgba(16, 185, 129, 0.4); }
        .footer { margin-top: 40px; font-size: 12px; color: #64748b; }
        .dot { height: 8px; width: 8px; border-radius: 50%; background-color: var(--success); display: inline-block; animation: pulse 2s infinite; }
        @keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.4; } 100% { opacity: 1; } }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="logo-area"><i class='bx bxs-zap'></i></div>
        <h1 class="font-saochingcha">CSC Circular API</h1>
        <div class="status-badge">
          <span class="dot"></span> 🟢 API Server Online
        </div>

        <div class="grid">
          <div class="card">
            <div class="card-label">Database</div>
            <div class="card-value">
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

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-top: 30px;">
          <a href="http://localhost/ocsc-circular" class="btn" style="margin-top: 0; background: #334155;">
            <i class='bx bx-window-open'></i> Public Portal
          </a>
          <a href="http://localhost/ocsc-circular/admin/login" class="btn" style="margin-top: 0;">
            <i class='bx bx-lock-alt'></i> Admin Login
          </a>
        </div>
        <div style="margin-top: 15px;">
          <a href="/internal-admin" class="btn" style="margin-top: 0; background: #6366f1;">
            <i class='bx bx-server'></i> Internal Admin Control Panel
          </a>
        </div>

        <div class="footer">
          &copy; 2024 CSC Circular System • API Gateway v1.1.0 (TypeScript)
        </div>
      </div>
    </body>
    </html>
  `);
});

/**
 * @swagger
 * /health:
 *   get:
 *     summary: API Health Check
 *     description: Returns the health status of the API
 *     responses:
 *       200:
 *         description: Successful response
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: ok
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 */
app.get('/health', (_req: Request, res: Response) =>
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
);

// ─── 404 ─────────────────────────────────────────────────────
app.use((req: Request, res: Response) =>
  res.status(404).json({ status: false, message: 'Route not found' })
);

// ─── Global error handler ─────────────────────────────────────
app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
  console.error('❌ Server Error on', req.originalUrl, ':', err.message);
  res.status(500).json({ status: false, message: 'Internal Server Error' });
});

// ─── Start ────────────────────────────────────────────────────
// STAB-02: Run database migrations synchronously before accepting requests
await runMigrations();

const server = app.listen(PORT, () => {
  console.log('\n🚀 BMA Circular API Server (TypeScript ESM)');
  console.log(`   URL:    http://localhost:${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/health`);
  console.log(`   Mode:   ${process.env.NODE_ENV || 'development'}\n`);
  
  // ─── Scheduled Tasks ──────────────────────────────────────────
  import('./services/metricsCollector.js').then(({ startMetricsCollector }) => {
    startMetricsCollector(60000); // 1 minute interval
  }).catch(e => console.error('Failed to load metricsCollector:', e));

  // Cron job for bot scraper is disabled per user request
  // cron.schedule('0 3 * * 1-5', () => { ... });
  console.log(`   Cron:   Disabled (Manual Sync Only)`);
});

// ─── STAB-06: Graceful Shutdown ─────────────────────────────────
const shutdown = async (signal: string) => {
  console.log(`\n⏳ ${signal} received — graceful shutdown...`);
  server.close(async () => {
    try {
      await pool.end();
      console.log('✅ Database pool closed');
    } catch (e) {
      console.error('❌ Error closing pool:', e);
    }
    process.exit(0);
  });
  // Force kill after 10 seconds if graceful shutdown hangs
  setTimeout(() => {
    console.error('❌ Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
