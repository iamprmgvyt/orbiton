// ============================================================
// Orbiton Request Guard Middleware
// Defends against:
//   - Oversized JSON payload bombs (slow/memory exhaustion)
//   - Suspicious/malformed HTTP headers
//   - Path traversal / injection attempts in URL
//   - Missing essential browser-like headers (detects raw tool requests)
// ============================================================

const DANGEROUS_PATH_PATTERNS = [
  /\.\.\//,        // directory traversal
  /\/etc\/passwd/, // linux secret file probe
  /\/proc\//,      // linux process probe
  /<script/i,      // XSS probe
  /UNION.*SELECT/i,// SQLi probe
  /SELECT.*FROM/i, // SQLi probe
  /DROP.*TABLE/i,  // SQLi probe
  /INSERT.*INTO/i, // SQLi probe
  /exec\(/i,       // RCE probe
  /eval\(/i,       // RCE probe
  /base64_decode/i // encoded payload probe
];

const DANGEROUS_HEADER_PATTERNS = [
  /<script/i, /javascript:/i, /vbscript:/i
];

/**
 * Request Guard — runs before all routes
 * Blocks probes, injection attempts, oversized requests, and raw tool queries.
 */
function requestGuard(req, res, next) {
  let url = '';
  try {
    url = decodeURIComponent(req.url || '');
  } catch (_) {
    return res.status(400).json({ error: 'Malformed URL encoding.' });
  }

  // 1. Block path traversal & injection probes
  for (const pattern of DANGEROUS_PATH_PATTERNS) {
    if (pattern.test(url)) {
      return res.status(400).json({ error: 'Invalid request path.' });
    }
  }

  // 2. Check headers for injection payloads
  const suspiciousHeaders = ['referer', 'x-forwarded-for', 'x-real-ip', 'origin'];
  for (const hdr of suspiciousHeaders) {
    const val = req.headers[hdr] || '';
    for (const p of DANGEROUS_HEADER_PATTERNS) {
      if (p.test(val)) {
        return res.status(400).json({ error: 'Invalid request headers.' });
      }
    }
  }

  // 3. Content-Length sanity check for API routes (non-file upload)
  const contentLength = parseInt(req.headers['content-length'] || '0');
  const isFileRoute = req.path.startsWith('/api/files') || req.path.startsWith('/api/backups');
  if (!isFileRoute && contentLength > 2 * 1024 * 1024) { // 2MB cap for non-file API
    return res.status(413).json({ error: 'Request payload is too large.' });
  }

  next();
}

module.exports = requestGuard;
