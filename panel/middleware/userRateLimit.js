// ============================================================
// Orbiton Maximum Security Rate Limiter
// 3-Tier: Burst → Sustained → Progressive Penalty (Exponential Backoff)
// + Automatic IP Blacklist for heavy abusers
// + Bot fingerprint detection via User-Agent analysis
// Zero dependency on external packages — pure Map/Set for low RAM VPS.
// ============================================================

const requestTracker = new Map();   // { id → record }
const penaltyBox     = new Map();   // { id → { until, strikes } } temporary blocks
const ipBlacklist    = new Set();   // permanent blocks for serial abusers

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
  /curl/i, /wget/i, /python-requests/i, /axios/i, /node-fetch/i,
  /java\//i, /go-http/i, /libwww/i, /scrapy/i, /nikto/i,
  /nmap/i, /sqlmap/i, /masscan/i, /dirbuster/i, /burpsuite/i,
  /hydra/i, /medusa/i, /bot/i, /crawler/i, /spider/i
];

function isBot(req) {
  const ua = req.headers['user-agent'] || '';
  if (!ua || ua.length < 10) return true;                    // no UA = bot
  if (BOT_UA_PATTERNS.some(p => p.test(ua))) return true;   // known tool
  return false;
}

// ─── Core 3-Tier Limiter Factory ─────────────────────────────
function createLimiter(options = {}) {
  const {
    burstLimit      = 4,       // max hits in burstWindowMs
    burstWindowMs   = 2000,    // 2 seconds
    sustainedLimit  = 60,      // max hits in sustainedWindowMs
    sustainedWindowMs = 60000, // 1 minute
    blockBot        = false,   // reject bot User-Agents
    ipOnly          = false    // track by IP even if authenticated
  } = options;

  return (req, res, next) => {
    // ── 1. Bot detection ────────────────────────────────────
    if (blockBot && isBot(req)) {
      return res.status(403).json({ error: 'Automated requests are not permitted.' });
    }

    const id  = (ipOnly || !req.user) ? (req.ip || 'unknown') : String(req.user.id);
    const now = Date.now();

    // ── 3. Permanent IP blacklist check ─────────────────────
    if (ipBlacklist.has(req.ip)) {
      return res.status(403).json({ error: 'Your IP address has been permanently blocked due to repeated abuse.' });
    }

    // ── 4. Temporary penalty box (exponential backoff) ──────
    const penalty = penaltyBox.get(id);
    if (penalty && now < penalty.until) {
      const waitSec = Math.ceil((penalty.until - now) / 1000);
      res.setHeader('Retry-After', waitSec);
      return res.status(429).json({
        error: `You are temporarily blocked for abusing the API. Try again in ${waitSec}s. (Strike ${penalty.strikes})`,
        retryAfter: waitSec
      });
    }

    // ── 5. Get / init tracking record ───────────────────────
    let rec = requestTracker.get(id);
    if (!rec) {
      rec = {
        burstCount: 0, burstReset: now + burstWindowMs,
        sustainedCount: 0, sustainedReset: now + sustainedWindowMs
      };
      requestTracker.set(id, rec);
    }

    // ── 6. Reset windows ────────────────────────────────────
    if (now > rec.burstReset) {
      rec.burstCount = 0;
      rec.burstReset = now + burstWindowMs;
    }
    if (now > rec.sustainedReset) {
      rec.sustainedCount = 0;
      rec.sustainedReset = now + sustainedWindowMs;
    }

    rec.burstCount++;
    rec.sustainedCount++;

    // ── 7. Burst violation → progressive penalty ─────────────
    if (rec.burstCount > burstLimit) {
      const existing = penaltyBox.get(id) || { strikes: 0 };
      const strikes  = existing.strikes + 1;

      // After 5 strikes → permanent blacklist
      if (strikes >= 5 && ipOnly) {
        ipBlacklist.add(req.ip);
        return res.status(403).json({ error: 'Your IP has been permanently banned for repeated spam attacks.' });
      }

      // Exponential backoff: 5s → 10s → 20s → 40s → 80s …
      const blockMs = Math.min(5000 * Math.pow(2, strikes - 1), 10 * 60 * 1000); // cap at 10 min
      penaltyBox.set(id, { until: now + blockMs, strikes });
      rec.burstCount = 0; // reset so next window is clean

      res.setHeader('Retry-After', Math.ceil(blockMs / 1000));
      return res.status(429).json({
        error: `Spam detected. Blocked for ${Math.ceil(blockMs / 1000)}s. (Strike ${strikes}/5)`,
        retryAfter: Math.ceil(blockMs / 1000)
      });
    }

    // ── 8. Sustained violation ───────────────────────────────
    if (rec.sustainedCount > sustainedLimit) {
      const waitSec = Math.ceil((rec.sustainedReset - now) / 1000);
      res.setHeader('Retry-After', waitSec);
      return res.status(429).json({
        error: `Rate limit exceeded. You've sent too many requests this minute. Try again in ${waitSec}s.`,
        retryAfter: waitSec
      });
    }

    next();
  };
}

// ─── Preset Situational Limiters ─────────────────────────────
module.exports = {

  // Login/Register — ultra strict + bot block + IP-based
  // Human typing speed max: ~1 attempt per 3-4 seconds
  auth: createLimiter({
    burstLimit: 1,          // 1 attempt per 4s window
    burstWindowMs: 4000,
    sustainedLimit: 5,      // 5 per minute total
    sustainedWindowMs: 60000,
    blockBot: true,
    ipOnly: true
  }),

  // General API (dashboard, status, listing)
  general: createLimiter({
    burstLimit: 4,
    burstWindowMs: 2000,
    sustainedLimit: 60,
    sustainedWindowMs: 60000
  }),

  // Power actions (Start/Stop/Restart/Kill)
  // No human clicks a button more than once per 3 seconds
  power: createLimiter({
    burstLimit: 1,
    burstWindowMs: 3000,
    sustainedLimit: 10,
    sustainedWindowMs: 60000,
    blockBot: true
  }),

  // File manager (fast browsing OK, but not tool-speed)
  file: createLimiter({
    burstLimit: 10,
    burstWindowMs: 2000,
    sustainedLimit: 120,
    sustainedWindowMs: 60000
  }),

  // Backups (compression is heavy — strict)
  backup: createLimiter({
    burstLimit: 1,
    burstWindowMs: 8000,
    sustainedLimit: 4,
    sustainedWindowMs: 60000,
    blockBot: true
  })
};
