import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import path from 'path';

const app = express();
const PORT = process.env.PORT || 80;

// Security headers
app.use((req, res, next) => {
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});

// Root redirect
app.get('/', (req, res) => {
  res.redirect(301, '/circular/');
});

// API Proxy (Must come first to avoid being caught by other routes)
app.use('/circular/api/', createProxyMiddleware({
  target: 'http://server:3000',
  changeOrigin: true,
  pathRewrite: {
    '^/circular/api/': '/api/'
  },
  ws: true // proxy websockets
}));

// Static Assets
app.use('/circular/uploads/', express.static('/uploads', {
  setHeaders: (res, path, stat) => {
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Content-Disposition', 'inline');
    // Ensure only PDFs are served from uploads conceptually
    if (!path.toLowerCase().endsWith('.pdf')) {
      res.type('application/pdf');
    }
  },
  maxAge: '30d'
}));

app.use('/circular/image/', express.static('/image', {
  maxAge: '30d'
}));

app.use('/circular/fonts/', express.static('/fonts', {
  maxAge: '30d'
}));

// Admin Frontend
app.use('/circular/admin/', createProxyMiddleware({
  target: 'http://client-admin:80',
  changeOrigin: true
}));

// Public Frontend
app.use('/circular/', createProxyMiddleware({
  target: 'http://client-public:80',
  changeOrigin: true
}));

app.listen(PORT, () => {
  console.log(`Gateway Proxy listening on port ${PORT}`);
});
