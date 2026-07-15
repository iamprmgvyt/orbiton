// ============================================================
// Orbiton 2-Tier Situational Rate Limiter Middleware
// Mitigates both Burst Spikes (short-term spam) and Sustained Abuse (long-term load)
// per individual User ID or IP address.
// Lightweight Map storage with auto-cleanup protects RAM on 1GB VPS.
// ============================================================

const requestTracker = new Map();

/**
 * Core 2-Tier Rate Limiter Generator
 * @param {object} options Limiter configuration
 * @param {number} options.burstLimit Max requests in short window
 * @param {number} options.burstWindowMs Short window duration (default: 2s)
 * @param {number} options.sustainedLimit Max requests in long window
 * @param {number} options.sustainedWindowMs Long window duration (default: 60s)
 * @param {boolean} options.ipOnly Force IP-based limiting (for public endpoints)
 */
function createLimiter(options = {}) {
  const {
    burstLimit = 5,
    burstWindowMs = 2000,
    sustainedLimit = 100,
    sustainedWindowMs = 60000,
    ipOnly = false
  } = options;

  return (req, res, next) => {
    // Exempt administrators from all rate limits
    if (!ipOnly && req.user && req.user.role === 'admin') {
      return next();
    }

    const trackerId = (ipOnly || !req.user) ? req.ip : req.user.id;
    const now = Date.now();

    let record = requestTracker.get(trackerId);

    if (!record) {
      record = {
        burstCount: 1,
        burstReset: now + burstWindowMs,
        sustainedCount: 1,
        sustainedReset: now + sustainedWindowMs
      };
      requestTracker.set(trackerId, record);
      return next();
    }

    // Reset short-term burst window if time passed
    if (now > record.burstReset) {
      record.burstCount = 0;
      record.burstReset = now + burstWindowMs;
    }

    // Reset long-term sustained window if time passed
    if (now > record.sustainedReset) {
      record.sustainedCount = 0;
      record.sustainedReset = now + sustainedWindowMs;
    }

    record.burstCount++;
    record.sustainedCount++;

    // 1. Check Burst Limit (Spam spikes protection)
    if (record.burstCount > burstLimit) {
      const retryAfter = Math.ceil((record.burstReset - now) / 1000) || 1;
      res.setHeader('Retry-After', retryAfter);
      return res.status(429).json({
        error: `Spam protection: Too many requests in a short time. Please slow down and try again in ${retryAfter} second(s).`
      });
    }

    // 2. Check Sustained Limit (Long-term resource protection)
    if (record.sustainedCount > sustainedLimit) {
      const retryAfter = Math.ceil((record.sustainedReset - now) / 1000);
      res.setHeader('Retry-After', retryAfter);
      return res.status(429).json({
        error: `Rate limit exceeded: Too many requests. Please try again in ${retryAfter} second(s).`
      });
    }

    // Proactive memory cleanup: prevents memory leaks on VPS with low RAM
    if (requestTracker.size > 1500) {
      for (const [key, val] of requestTracker.entries()) {
        if (now > val.sustainedReset) {
          requestTracker.delete(key);
        }
      }
    }

    next();
  };
}

// ─── Preset Situational Limiters ────────────────────────────────
module.exports = {
  // General Web Page Browsing/Dashboard
  general: createLimiter({
    burstLimit: 12,
    burstWindowMs: 2000,
    sustainedLimit: 120,
    sustainedWindowMs: 60000
  }),

  // Auth Endpoints (Login/Register - Strict IP-based to counter bots & brute force)
  auth: createLimiter({
    burstLimit: 2,
    burstWindowMs: 3000,
    sustainedLimit: 6,
    sustainedWindowMs: 60000,
    ipOnly: true
  }),

  // Power Actions (Start/Stop/Restart/Kill - Choke server command flooding)
  power: createLimiter({
    burstLimit: 2,
    burstWindowMs: 4000,
    sustainedLimit: 15,
    sustainedWindowMs: 60000
  }),

  // File Explorer Actions (Differentiate fast file browsing from API abuse)
  file: createLimiter({
    burstLimit: 20,
    burstWindowMs: 2000,
    sustainedLimit: 200,
    sustainedWindowMs: 60000
  }),

  // Database Backups (Heaviest compression load, strict limits)
  backup: createLimiter({
    burstLimit: 1,
    burstWindowMs: 5000,
    sustainedLimit: 5,
    sustainedWindowMs: 60000
  })
};
