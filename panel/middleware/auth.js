// ============================================================
// JWT Auth Middleware — with Token Blacklist Check
// ============================================================
const jwt = require('jsonwebtoken');
const { isRevoked } = require('./tokenBlacklist');

const DEFAULT_JWT_SECRETS = ['vps-panel-super-secret-change-me-2024', 'change-me-please-use-openssl-rand-hex-32'];
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET || DEFAULT_JWT_SECRETS.includes(JWT_SECRET)) {
  console.error('\n❌ [CRITICAL SECURITY ERROR] JWT_SECRET is missing or set to an insecure default value in environment variables!');
  console.error('👉 Please generate a secure secret using "openssl rand -hex 32" and set JWT_SECRET in panel/.env\n');
  process.exit(1);
}

function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    // Check if this token has been explicitly revoked (e.g. after logout)
    const tokenId = decoded.jti || token;
    if (isRevoked(tokenId)) {
      return res.status(401).json({ error: 'Token has been revoked. Please log in again.' });
    }

    req.user = decoded;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Session expired. Please log in again.' });
    }
    return res.status(401).json({ error: 'Invalid or malformed token.' });
  }
}

function adminOnly(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

module.exports = authMiddleware;
module.exports.adminOnly = adminOnly;
module.exports.JWT_SECRET = JWT_SECRET;
