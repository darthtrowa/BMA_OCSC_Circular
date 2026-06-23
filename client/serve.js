import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 5173;
const BASE_PATH = '/bma_ocsc_circular';
const DIST_DIR = path.join(__dirname, 'dist');

http.createServer((req, res) => {
  let urlPath = req.url.split('?')[0];
  
  // 1. Proxy /bma_ocsc_circular/admin to admin client on port 5175
  if (urlPath.startsWith('/bma_ocsc_circular/admin/') || urlPath === '/bma_ocsc_circular/admin') {
    const proxyReq = http.request({
      host: '127.0.0.1',
      port: 5175,
      path: req.url,
      method: req.method,
      headers: req.headers
    }, (proxyRes) => {
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res, { end: true });
    });
    
    proxyReq.on('error', (e) => {
      res.writeHead(502);
      res.end('Proxy Error (Admin): ' + e.message);
    });
    
    req.pipe(proxyReq, { end: true });
    return;
  }

  // 2. Proxy /bma_ocsc_circular/api/ to backend API on port 3000
  if (urlPath.startsWith('/bma_ocsc_circular/api/')) {
    const apiPath = urlPath.replace('/bma_ocsc_circular/api', '/api');
    const proxyReq = http.request({
      host: '127.0.0.1',
      port: 3000,
      path: apiPath + (req.url.includes('?') ? '?' + req.url.split('?')[1] : ''),
      method: req.method,
      headers: req.headers
    }, (proxyRes) => {
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res, { end: true });
    });
    
    proxyReq.on('error', (e) => {
      res.writeHead(502);
      res.end('Proxy Error (API): ' + e.message);
    });
    
    req.pipe(proxyReq, { end: true });
    return;
  }

  // 3. Proxy /bma_ocsc_circular/image/ and /bma_ocsc_circular/uploads/ to backend on port 3000
  if (urlPath.startsWith('/bma_ocsc_circular/image/') || urlPath.startsWith('/bma_ocsc_circular/uploads/')) {
    const targetPath = urlPath.replace('/bma_ocsc_circular', '');
    const proxyReq = http.request({
      host: '127.0.0.1',
      port: 3000,
      path: targetPath + (req.url.includes('?') ? '?' + req.url.split('?')[1] : ''),
      method: req.method,
      headers: req.headers
    }, (proxyRes) => {
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res, { end: true });
    });
    
    proxyReq.on('error', (e) => {
      res.writeHead(502);
      res.end('Proxy Error (Assets): ' + e.message);
    });
    
    req.pipe(proxyReq, { end: true });
    return;
  }

  // If request doesn't start with /bma_ocsc_circular, return 404
  if (!urlPath.startsWith(BASE_PATH)) {
    res.writeHead(404);
    return res.end('Not found - this service expects requests under /bma_ocsc_circular');
  }
  
  // Map /circular/assets/... to /assets/...
  let filePath = urlPath.replace(BASE_PATH, '');
  if (filePath === '' || filePath === '/') filePath = '/index.html';
  
  let fullPath = path.join(DIST_DIR, filePath);
  
  // SPA Fallback to index.html if file doesn't exist
  if (!fs.existsSync(fullPath)) {
    fullPath = path.join(DIST_DIR, 'index.html');
  }

  // Basic MIME types
  const ext = path.extname(fullPath).toLowerCase();
  const mimeTypes = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.eot': 'application/vnd.ms-fontobject',
    '.ico': 'image/x-icon'
  };
  
  const contentType = mimeTypes[ext] || 'application/octet-stream';
  
  // Read and serve file
  fs.readFile(fullPath, (err, content) => {
    if (err) {
      res.writeHead(500);
      res.end('Server Error: ' + err.code);
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
}).listen(PORT, () => {
  console.log(`Static server running on port ${PORT} at ${BASE_PATH}`);
});
