import AdminJS, { ComponentLoader } from 'adminjs';
import AdminJSExpress from '@adminjs/express';
import { Database, Resource, Adapter } from '@adminjs/sql';
import session from 'express-session';
import pgSession from 'connect-pg-simple';
import pool from './database.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { runMigrations } from './migrations.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize AdminJS SQL Adapter
AdminJS.registerAdapter({ Database, Resource });

const componentLoader = new ComponentLoader();

const Components = {
  Dashboard: componentLoader.add('Dashboard', path.join(__dirname, '../adminjs/components/ApiStatusDashboard')),
  SystemMonitor: componentLoader.add('SystemMonitor', path.join(__dirname, '../adminjs/components/SystemMonitor')),
  AuditViewer: componentLoader.add('AuditViewer', path.join(__dirname, '../adminjs/components/AuditViewer')),
  LogViewer: componentLoader.add('LogViewer', path.join(__dirname, '../adminjs/components/LogViewer')),
  Maintenance: componentLoader.add('Maintenance', path.join(__dirname, '../adminjs/components/Maintenance')),
  BotMonitor: componentLoader.add('BotMonitor', path.join(__dirname, '../adminjs/components/BotMonitor')),
};

export const initAdminJS = async (app: any) => {
  const sqlAdapter = new Adapter('postgresql', {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'circular',
    port: parseInt(process.env.DB_PORT || '5432'),
  });
  const db = await sqlAdapter.init();

  const adminOptions = {
    databases: [db],
    resources: [], // We are relying on the SQL adapter or just custom pages for now
    componentLoader,
    rootPath: '/ocsc-circular/internal-admin',
    loginPath: '/ocsc-circular/internal-admin/login',
    logoutPath: '/ocsc-circular/internal-admin/logout',
    dashboard: {
      component: Components.Dashboard,
    },
    pages: {
      SystemMonitor: { component: Components.SystemMonitor, icon: 'Activity' },
      AuditLogs: { component: Components.AuditViewer, icon: 'Shield' },
      SystemLogs: { component: Components.LogViewer, icon: 'List' },
      Maintenance: { component: Components.Maintenance, icon: 'Settings' },
      BotMonitor: { component: Components.BotMonitor, icon: 'Activity' },
    },
    branding: {
      companyName: 'BMA Circular Control Panel',
      softwareBrothers: false,
      logo: false as false,
    },
  };

  const admin = new AdminJS(adminOptions);

  if (process.env.NODE_ENV !== 'production') {
    admin.watch();
  } else {
    admin.initialize();
  }

  // Custom API routes for AdminJS components
  app.get('/ocsc-circular/internal-admin/api/server-status', async (req: any, res: any) => {
    let dbStatus = 'Offline';
    let dbHealth = false;
    try {
      await pool.query('SELECT 1');
      dbStatus = 'Online';
      dbHealth = true;
    } catch (e) {
      dbStatus = 'Error';
    }
    const thaiDate = new Intl.DateTimeFormat('th-TH', {
      dateStyle: 'full',
      timeStyle: 'medium',
    }).format(new Date());
    
    res.json({
      dbStatus,
      dbHealth,
      env: process.env.NODE_ENV || 'development',
      time: thaiDate
    });
  });

  app.get('/ocsc-circular/internal-admin/api/metrics', async (req: any, res: any) => {
    try {
      const { rows } = await pool.query('SELECT * FROM system_metrics ORDER BY timestamp DESC LIMIT 50');
      res.json(rows);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/ocsc-circular/internal-admin/api/audit-logs', async (req: any, res: any) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const offset = (page - 1) * limit;
      const search = req.query.search || '';

      let countSql = 'SELECT COUNT(*) FROM audit_logs';
      let sql = 'SELECT * FROM audit_logs';
      const params: any[] = [];

      if (search) {
        const s = `%${search}%`;
        const where = ' WHERE action ILIKE $1 OR target_resource ILIKE $1 OR user_name ILIKE $1 OR payload::text ILIKE $1';
        countSql += where;
        sql += where;
        params.push(s);
      }

      sql += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
      
      const [{ rows: [{ count }] }, { rows: logs }] = await Promise.all([
        pool.query(countSql, params),
        pool.query(sql, [...params, limit, offset])
      ]);

      res.json({ logs, total: parseInt(count), page, limit });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/ocsc-circular/internal-admin/api/logs', (req: any, res: any) => {
    try {
      const logPath = path.join(process.env.USERPROFILE || process.env.HOME || '', '.pm2/logs/ocsc-circular-api-out.log');
      const errPath = path.join(process.env.USERPROFILE || process.env.HOME || '', '.pm2/logs/ocsc-circular-api-error.log');
      
      let logs = '';
      if (fs.existsSync(logPath)) {
        logs += '=== OUT LOGS ===\n' + fs.readFileSync(logPath, 'utf8').slice(-10000);
      }
      if (fs.existsSync(errPath)) {
        logs += '\n=== ERR LOGS ===\n' + fs.readFileSync(errPath, 'utf8').slice(-10000);
      }
      res.json({ logs });
    } catch (e: any) {
      res.json({ logs: 'Failed to read logs: ' + e.message });
    }
  });

  app.post('/ocsc-circular/internal-admin/api/migrate', async (req: any, res: any) => {
    try {
      await runMigrations();
      res.json({ message: 'Migrations executed successfully.' });
    } catch (e: any) {
      res.status(500).json({ message: 'Migration failed: ' + e.message });
    }
  });

  app.get('/ocsc-circular/internal-admin/api/bot-status', (req: any, res: any) => {
    res.json({ status: 'Idle', lastRun: new Date().toISOString() });
  });

  const PgSession = pgSession(session);
  const sessionStore = new PgSession({ pool });

  const router = AdminJSExpress.buildAuthenticatedRouter(admin, {
    authenticate: async (email, password) => {
      const expectedEmail = process.env.ADMINJS_EMAIL || 'admin@admin.com';
      const expectedPassword = process.env.ADMINJS_PASSWORD || 'secret';
      
      console.log('[AdminJS] Login attempt:', { email, password });
      console.log('[AdminJS] Expected:', { expectedEmail, expectedPassword });
      
      if (email === expectedEmail && password === expectedPassword) {
        console.log('[AdminJS] Login SUCCESS');
        return { email };
      }
      console.log('[AdminJS] Login FAILED');
      return null;
    },
    cookieName: 'adminjs',
    cookiePassword: process.env.ADMIN_COOKIE_SECRET || 'super-secret-cookie-password',
  }, null, {
    store: sessionStore,
    secret: process.env.ADMIN_COOKIE_SECRET || 'super-secret-cookie-password',
    resave: false,
    saveUninitialized: true,
  });

  app.use(admin.options.rootPath, router);
};
