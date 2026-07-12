import AdminJS, { ComponentLoader } from 'adminjs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const componentLoader = new ComponentLoader();

const Components = {
  Dashboard: componentLoader.add('Dashboard', path.join(__dirname, './dist/adminjs/components/ApiStatusDashboard')),
  SystemMonitor: componentLoader.add('SystemMonitor', path.join(__dirname, './dist/adminjs/components/SystemMonitor')),
  AuditViewer: componentLoader.add('AuditViewer', path.join(__dirname, './dist/adminjs/components/AuditViewer')),
  LogViewer: componentLoader.add('LogViewer', path.join(__dirname, './dist/adminjs/components/LogViewer')),
  Maintenance: componentLoader.add('Maintenance', path.join(__dirname, './dist/adminjs/components/Maintenance')),
  BotMonitor: componentLoader.add('BotMonitor', path.join(__dirname, './dist/adminjs/components/BotMonitor')),
};

const admin = new AdminJS({
  componentLoader,
});

process.env.NODE_ENV = 'development';
admin.watch().then(() => {
  console.log('Bundle built!');
  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});
