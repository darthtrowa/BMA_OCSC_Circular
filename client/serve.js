import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 5173;
const BASE_PATH = '/circular';
const DIST_DIR = path.join(__dirname, 'dist');

http.createServer((req, res) => {
  let urlPath = req.url.split('?')[0];
  
  // If request doesn't start with /circular, return 404
  if (!urlPath.startsWith(BASE_PATH)) {
    res.writeHead(404);
    return res.end('Not found - this service expects requests under /circular');
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
