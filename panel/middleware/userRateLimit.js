// ============================================================
// Orbiton Maximum Security Rate Limiter
// 3-Tier: Burst → Sustained → Progressive Penalty (Exponential Backoff)
// + Automatic IP Blacklist for heavy abusers
// + Bot fingerprint detection via User-Agent analysis
// Zero dependency on external packages — pure Map/Set for low RAM VPS.
// ============================================================

const fs   = require('fs');
const path = require('path');
const { logSecurityEvent } = require('../utils/securityLogger');
const { analyzeTrafficBehavior } = require('./aiBehaviorEngine');

// Architecture Note: State is maintained in-memory (with file persistence for IP blacklists).
// Designed specifically for lightweight single-process Node.js deployments.

const requestTracker = new Map();   // { id → record }
const penaltyBox     = new Map();   // { id → { until, strikes } } temporary blocks
const ipBlacklist    = new Set();   // permanent blocks for serial abusers

const DATA_DIR = process.env.DATA_DIR || (process.platform === 'win32' ? path.join(process.env.APPDATA || require('os').homedir(), 'orbiton-data') : '/opt/orbiton-data');
const BLACKLIST_FILE = path.join(DATA_DIR, 'ip_blacklist.json');

// Load persisted IP blacklist on startup
try {
  if (fs.existsSync(BLACKLIST_FILE)) {
    const list = JSON.parse(fs.readFileSync(BLACKLIST_FILE, 'utf8'));
    if (Array.isArray(list)) list.forEach(ip => ipBlacklist.add(ip));
  }
} catch (_) {}

function saveBlacklist() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(BLACKLIST_FILE, JSON.stringify(Array.from(ipBlacklist)), 'utf8');
  } catch (_) {}
}

// Auto-cleanup every 5 minutes to prevent memory leaks on 1GB VPS
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of requestTracker.entries()) {
    if (now > v.sustainedReset + 60000) requestTracker.delete(k);
  }
  for (const [k, v] of penaltyBox.entries()) {
    if (now > v.until) penaltyBox.delete(k);
  }
}, 5 * 60 * 1000);

// ─── Bot / Automated Tool Detector ───────────────────────────
const BOT_UA_PATTERNS = [
  /curl/i, /wget/i, /python-requests/i,
  /java\//i, /go-http/i, /libwww/i, /scrapy/i, /nikto/i,
  /nmap/i, /sqlmap/i, /masscan/i, /dirbuster/i, /burpsuite/i,
  /hydra/i, /medusa/i
];

function isBot(req) {
  // Allow authenticated API requests (Bearer Token) and bot integrations
  if (req.headers['authorization']) return false;
  const ua = req.headers['user-agent'] || '';
  if (!ua) return false;
  if (BOT_UA_PATTERNS.some(p => p.test(ua))) return true;
  return false;
}

// ─── Core 3-Tier Limiter Factory ─────────────────────────────
function createLimiter(options = {}) {
  const {
    burstLimit      = 30,      // max hits in burstWindowMs (increased for multi-tab RDP)
    burstWindowMs   = 2000,    // 2 seconds
    sustainedLimit  = 300,     // max hits in sustainedWindowMs (300 requests per min)
    sustainedWindowMs = 60000, // 1 minute
    blockBot        = false,   // reject bot User-Agents
    ipOnly          = false,   // track by IP even if authenticated
    delayAfter      = 10,      // start slowing down after 10 hits
    delayMs         = 100
  } = options;

  return (req, res, next) => {
    // ── 1. Bot detection ────────────────────────────────────
    if (blockBot && isBot(req)) {
      return res.status(403).json({ error: 'Automated requests are not permitted.' });
    }

    const id  = (ipOnly || !req.user) ? (req.ip || 'unknown') : String(req.user.id);
    const now = Date.now();

    // ── AI Local Behavioral Trajectory Analysis ──────────────
    const aiAnalysis = analyzeTrafficBehavior(id, now);
    const isHumanUser = aiAnalysis.isHuman;
    const effectiveBurstLimit = isHumanUser ? Math.max(burstLimit, aiAnalysis.burstCap) : burstLimit;

    // ── 3. Permanent IP blacklist check ─────────────────────
    if (ipBlacklist.has(req.ip)) {
      return res.status(403).json({ error: 'Your IP address has been permanently blocked due to repeated abuse.' });
    }

    // ── 4. Authenticated Panel Users: NEVER block with 429 ──────────
    if (req.user) {
      if (rec.burstCount > 50) {
        const delayTime = Math.min((rec.burstCount - 50) * 50, 3000); // silent delay up to 3s
        return setTimeout(() => next(), delayTime);
      }
      return next();
    }

    // ── 5. Permanent IP blacklist check ─────────────────────
    if (ipBlacklist.has(req.ip)) {
      return res.status(403).json({ error: 'Your IP address has been permanently blocked due to repeated abuse.' });
    }

    // ── 6. Temporary penalty box (for unauthenticated brute force) ──
    const penalty = penaltyBox.get(id);
    if (penalty && now < penalty.until) {
      const waitSec = Math.ceil((penalty.until - now) / 1000);
      res.setHeader('Retry-After', waitSec);
      return res.status(429).json({
        error: `You are temporarily blocked. Try again in ${waitSec}s.`,
        retryAfter: waitSec
      });
    }

    // ── 7. Silent Rate Limit Buffer for unauthenticated traffic ──────
    if (rec.burstCount > 100) {
      const silentDelayMs = Math.min((rec.burstCount - 100) * 100, 4000);
      return setTimeout(() => next(), silentDelayMs);
    }

    next();
  };
}

// ─── Preset Situational Limiters ─────────────────────────────
module.exports = {

  // Login/Register — 15 per min window
  auth: createLimiter({
    burstLimit: 15,
    burstWindowMs: 4000,
    sustainedLimit: 50,
    sustainedWindowMs: 60000,
    blockBot: false,
    ipOnly: true
  }),

  // General API (dashboard, nodes, status, listing) - High capacity
  general: createLimiter({
    burstLimit: 100,          // 100 requests per 2s
    burstWindowMs: 2000,
    sustainedLimit: 1000,       // 1000 requests per min
    sustainedWindowMs: 60000,
    delayAfter: 80,
    delayMs: 20
  }),

  // Power actions (Start/Stop/Restart/Kill)
  power: createLimiter({
    burstLimit: 20,
    burstWindowMs: 3000,
    sustainedLimit: 100,
    sustainedWindowMs: 60000,
    blockBot: false
  }),

  // File manager (fast browsing & uploading)
  file: createLimiter({
    burstLimit: 150,
    burstWindowMs: 2000,
    sustainedLimit: 1500,
    sustainedWindowMs: 60000,
    delayAfter: 100,
    delayMs: 10
  }),

  // Backups (compression is heavy)
  backup: createLimiter({
    burstLimit: 10,
    burstWindowMs: 8000,
    sustainedLimit: 50,
    sustainedWindowMs: 60000
  })
};
    sustainedLimit: 4,
    sustainedWindowMs: 60000,
    blockBot: true
  })
};
