// ============================================================
// Orbiton - Universal App & Server Manager
// Main Server Entry Point
// Cross-platform: Windows, macOS, Linux
// ============================================================
require('dotenv').config();
const express  = require('express');
const http     = require('http');
const https    = require('https');
const { Server } = require('socket.io');
const fs       = require('fs');
const path     = require('path');
const os       = require('os');
const cors     = require('cors');
const helmet   = require('helmet');
const rateLimit = require('express-rate-limit');

const { initDatabase } = require('./db/database');
const authRoutes   = require('./routes/auth');
const appsRoutes   = require('./routes/apps');
const fileRoutes   = require('./routes/files');
const systemRoutes = require('./routes/system');
const { setupSocketHandlers } = require('./managers/terminalManager');
const processManager = require('./managers/processManager');
const authMiddleware = require('./middleware/auth');

const app = express();

// ─── Configuration ────────────────────────────────────────────
const PORT     = parseInt(process.env.PORT     || '80');
const SSL_PORT = parseInt(process.env.SSL_PORT || '443');
const FRONTEND = path.join(__dirname, '..', 'frontend');

// Certs: look in ./certs/ relative to project root
const CERT_DIR  = path.join(__dirname, '..', 'certs');
const CERT_FILE = path.join(CERT_DIR, 'fullchain.pem');
const KEY_FILE  = path.join(CERT_DIR, 'privkey.pem');

// ─── Security Middleware ──────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'",
        "cdn.jsdelivr.net", "cdnjs.cloudflare.com", "fonts.googleapis.com"],
      styleSrc: ["'self'", "'unsafe-inline'",
        "cdn.jsdelivr.net", "fonts.googleapis.com", "fonts.gstatic.com"],
      fontSrc: ["'self'", "fonts.gstatic.com", "cdn.jsdelivr.net"],
      imgSrc:  ["'self'", "data:", "blob:"],
      connectSrc: ["'self'", "ws:", "wss:"],
    },
  },
}));

app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// Rate limiting
app.use('/api/', rateLimit({ windowMs: 15 * 60 * 1000, max: 2000 }));
app.use('/api/auth/login', rateLimit({ windowMs: 15 * 60 * 1000, max: 30 }));

// ─── Static Files ─────────────────────────────────────────────
app.use(express.static(FRONTEND));

// ─── API Routes ───────────────────────────────────────────────
app.use('/api/auth',   authRoutes);
app.use('/api/apps',   authMiddleware, appsRoutes);
app.use('/api/files',  authMiddleware, fileRoutes);
app.use('/api/system', authMiddleware, systemRoutes);

// Catch-all → serve frontend SPA
app.get('*', (req, res) => {
  const file = req.path.startsWith('/dashboard')
    ? 'dashboard.html'
    : 'index.html';
  res.sendFile(path.join(FRONTEND, file));
});

// ─── Init DB ──────────────────────────────────────────────────
initDatabase();

// ─── Server Startup ───────────────────────────────────────────
const httpServer = http.createServer(app);
const hasSSL     = fs.existsSync(CERT_FILE) && fs.existsSync(KEY_FILE);
let   io, primaryServer;

const ioOptions = { cors: { origin: '*' }, maxHttpBufferSize: 1e8 };

if (hasSSL) {
  const sslOpts = {
    cert: fs.readFileSync(CERT_FILE),
    key:  fs.readFileSync(KEY_FILE),
  };
  const httpsServer = https.createServer(sslOpts, app);
  io = new Server(httpsServer, ioOptions);
  setupSocketHandlers(io);
  processManager.setIO(io);

  httpsServer.listen(SSL_PORT, () =>
    console.log(`🔒 Orbiton HTTPS → https://localhost:${SSL_PORT}`));

  // Redirect HTTP → HTTPS
  http.createServer((req, res) => {
    const host = (req.headers.host || 'localhost').split(':')[0];
    res.writeHead(301, { Location: `https://${host}:${SSL_PORT}${req.url}` });
    res.end();
  }).listen(PORT, () =>
    console.log(`🔄 HTTP → HTTPS redirect on :${PORT}`));

  primaryServer = httpsServer;
} else {
  io = new Server(httpServer, ioOptions);
  setupSocketHandlers(io);
  processManager.setIO(io);

  httpServer.listen(PORT, () => {
    console.log(`\n🌐 Orbiton is running!`);
    console.log(`   Local:   http://localhost:${PORT}`);
    console.log(`   Network: http://${getLocalIP()}:${PORT}`);
    console.log(`   ⚠  No SSL certs. Run: bash generate-cert.sh\n`);
  });

  primaryServer = httpServer;
}

// ─── Helpers ──────────────────────────────────────────────────
function getLocalIP() {
  const ifaces = os.networkInterfaces();
  for (const dev of Object.values(ifaces)) {
    for (const info of dev) {
      if (info.family === 'IPv4' && !info.internal) return info.address;
    }
  }
  return 'localhost';
}

// ─── Graceful Shutdown ────────────────────────────────────────
const shutdown = () => {
  console.log('\n⏹  Shutting down Orbiton...');
  processManager.stopAll();
  primaryServer.close(() => { console.log('✅ Done.'); process.exit(0); });
  setTimeout(() => process.exit(1), 10000);
};
process.on('SIGTERM', shutdown);
process.on('SIGINT',  shutdown);

module.exports = { app, io };
