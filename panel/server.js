// ============================================================
// Orbiton Panel - Main Server Entry Point
// Central API and Web Router serving compiled React frontend.
// ============================================================
require('dotenv').config();
const express  = require('express');
const http     = require('http');
const https    = require('https');
const { Server } = require('socket.io');
const fs       = require('fs');
const path     = require('path');
const cors     = require('cors');
const helmet   = require('helmet');
const rateLimit = require('express-rate-limit');

const { initDatabase } = require('./db/database');
const authRoutes   = require('./routes/auth');
const appsRoutes   = require('./routes/apps');
const fileRoutes   = require('./routes/files');
const systemRoutes = require('./routes/system');
const { setupSocketHandlers } = require('./managers/terminalManager');
const authMiddleware = require('./middleware/auth');
const userRateLimit = require('./middleware/userRateLimit');
const requestGuard  = require('./middleware/requestGuard');

const app = express();

// ─── Configuration ────────────────────────────────────────────
const PORT     = parseInt(process.env.PORT     || '3000');
const SSL_PORT = parseInt(process.env.SSL_PORT || '3443');
const FRONTEND = path.join(__dirname, 'dist');

// Certs: look in ./certs/ relative to project root
const CERT_DIR  = path.join(__dirname, '..', 'certs');
const CERT_FILE = path.join(CERT_DIR, 'fullchain.pem');
const KEY_FILE  = path.join(CERT_DIR, 'privkey.pem');

app.set('trust proxy', 1);

const hasSSLForHelmet = process.env.DISABLE_SSL !== 'true' &&
  require('fs').existsSync(path.join(__dirname, '..', 'certs', 'fullchain.pem'));

app.use(helmet({
  contentSecurityPolicy: hasSSLForHelmet ? {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https:"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
      imgSrc: ["'self'", "data:", "blob:", "https:", "http:"],
      connectSrc: ["'self'", "wss:", "ws:", "https:", "http:"],
      workerSrc: ["'self'", "blob:"]
    }
  } : false,  // Disable CSP on plain HTTP to avoid blocking frontend assets
  crossOriginEmbedderPolicy: false,
  hsts: hasSSLForHelmet ? {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  } : false   // Never send HSTS over plain HTTP
}));

const allowedOrigins = process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : [];
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin) || allowedOrigins.length === 0 || origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ─── Security Guard (runs before all routes) ──────────────────
app.use(requestGuard);

// ─── Additional Security Headers ─────────────────────────────
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});

// ─── Global IP Rate Limit (fallback) ─────────────────────────
app.use('/api/', rateLimit({ windowMs: 60 * 1000, max: 300 }));
app.use('/api/auth/login', rateLimit({ windowMs: 60 * 1000, max: 5 }));

// ─── Static Files ─────────────────────────────────────────────
app.use(express.static(FRONTEND));

// ─── API Routes ───────────────────────────────────────────────
app.use('/api/auth',   userRateLimit.auth, authRoutes);
app.use('/api/apps',   authMiddleware, userRateLimit.general, appsRoutes);
app.use('/api/files',  authMiddleware, userRateLimit.file, fileRoutes);
app.use('/api/system', authMiddleware, userRateLimit.general, systemRoutes);
app.use('/api/nodes',  authMiddleware, userRateLimit.general, require('./routes/nodes'));
app.use('/api/permissions', authMiddleware, userRateLimit.general, require('./routes/permissions'));
app.use('/api/backups',     authMiddleware, userRateLimit.backup, require('./routes/backups'));
app.use('/api/domains',     authMiddleware, userRateLimit.general, require('./routes/domains'));
app.use('/api/crons',       authMiddleware, userRateLimit.general, require('./routes/crons'));

// Catch-all → serve React frontend SPA index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(FRONTEND, 'index.html'));
});

// ─── Init DB ──────────────────────────────────────────────────
initDatabase();

// Init Cron Scheduler
const { initCronScheduler } = require('./managers/cronManager');
initCronScheduler();

// ─── Server Startup ───────────────────────────────────────────
const httpServer = http.createServer(app);
const hasSSL     = process.env.DISABLE_SSL !== 'true' && fs.existsSync(CERT_FILE) && fs.existsSync(KEY_FILE);
let   io, primaryServer;

const ioOptions = {
  cors: {
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin) || allowedOrigins.length === 0 || origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1')) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: ["GET", "POST"]
  },
  maxHttpBufferSize: 1e8
};

function printBanner(port, ssl = false) {
  const logo = `
\x1b[34m\x1b[1m   ____    ____    ____     ____    ______   ____    _   __
  / __ \\\\  / __ \\\\  / __ )   /_  _/  /_  __/  / __ \\\\  / | / /
 / / / / /_/ / / / __  |    / /     / /    / / / / /  |/ / 
/ /_/ / / _, _/ / /_/ /   _/ /_    / /    / /_/ / / /|  /  
\\____/  /_/ |_| /____/   /___/    /_/     \\____/ /_/ |_|   \x1b[0m
  
🪐 \x1b[32mOrbiton Panel is running on ${ssl ? 'HTTPS' : 'HTTP'} port ${port}!\x1b[0m
`;
  console.log(logo);
}

if (hasSSL) {
  const sslOpts = {
    cert: fs.readFileSync(CERT_FILE),
    key:  fs.readFileSync(KEY_FILE),
  };
  const httpsServer = https.createServer(sslOpts, app);
  io = new Server(httpsServer, ioOptions);
  setupSocketHandlers(io);

  httpsServer.listen(SSL_PORT, () => printBanner(SSL_PORT, true));

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

  httpServer.listen(PORT, () => printBanner(PORT, false));

  primaryServer = httpServer;
}

// ─── Hourly Counter Logic (1 to 24 Loop) ──────────────────────
const counterFile = path.join(__dirname, 'counter.json');
let hourlyCounter = 1;
if (fs.existsSync(counterFile)) {
  try {
    hourlyCounter = JSON.parse(fs.readFileSync(counterFile, 'utf8')).counter || 1;
  } catch (_) {}
}

function incrementCounter() {
  hourlyCounter = hourlyCounter + 1;
  if (hourlyCounter > 24) hourlyCounter = 1;
  try {
    fs.writeFileSync(counterFile, JSON.stringify({ counter: hourlyCounter }), 'utf8');
  } catch (_) {}
  console.log(`⏱ Hourly Counter updated to: ${hourlyCounter}`);
}

// Check and increment every hour (3600000 ms)
setInterval(incrementCounter, 3600000);

// GET /api/counter - Public endpoint to retrieve counter value
app.get('/api/counter', (req, res) => {
  res.json({ counter: hourlyCounter });
});

module.exports = { app, server: primaryServer };
