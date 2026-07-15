// ============================================================
// Orbiton User-Based Rate Limiter Middleware
// Limits concurrent request spikes per individual User ID to protect
// SQLite database and Daemon IO queue from spam.
// Prevents memory leaks under high concurrent load on low-resource (1GB RAM) VPS.
// ============================================================

const requestTracker = new Map();

/**
 * User-based Rate Limiter middleware
 * @param {number} limit Maximum requests allowed inside the window
 * @param {number} windowMs Time window in milliseconds (default: 1 minute)
 */
module.exports = function userRateLimit(limit = 120, windowMs = 60000) {
  return (req, res, next) => {
    // Exempt administrators from rate limits to ensure clean operations
    if (req.user && req.user.role === 'admin') {
      return next();
    }

    const userId = req.user ? req.user.id : req.ip;
    const now = Date.now();

    let record = requestTracker.get(userId);

    if (!record || now > record.resetTime) {
      record = {
        count: 1,
        resetTime: now + windowMs
      };
      requestTracker.set(userId, record);
      return next();
    }

    record.count++;
    if (record.count > limit) {
      const retryAfterSeconds = Math.ceil((record.resetTime - now) / 1000);
      res.setHeader('Retry-After', retryAfterSeconds);
      return res.status(429).json({
        error: `Too many requests from your account. Please slow down. Try again in ${retryAfterSeconds} seconds.`
      });
    }

    // Proactive memory cleanup: prevents memory leaks on VPS with low RAM
    if (requestTracker.size > 1000) {
      for (const [key, val] of requestTracker.entries()) {
        if (now > val.resetTime) {
          requestTracker.delete(key);
        }
      }
    }

    next();
  };
};
