// ============================================================
// Auth Routes - Login, Logout, Register, Change Password
// Security hardening:
//   - JWT includes jti (unique ID) for server-side revocation
//   - Logout actually invalidates the token server-side
//   - Password complexity enforcement
//   - Constant-time comparison to prevent timing attacks
//   - Audit log on login, logout, failed login, password change
// ============================================================
const express = require('express');
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const crypto  = require('crypto');
const router  = express.Router();
const { db }  = require('../db/database');
const authMiddleware = require('../middleware/auth');
const { JWT_SECRET } = require('../middleware/auth');
const { revokeToken } = require('../middleware/tokenBlacklist');
const { logSecurityEvent } = require('../utils/securityLogger');
const userRateLimit = require('../middleware/userRateLimit');

// Helper: generate a unique JWT token ID
const genJti = () => crypto.randomBytes(16).toString('hex');

let initialSetupToken = null;

function getOrGenSetupToken() {
  try {
    const count = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
    if (count === 0) {
      if (!initialSetupToken) {
        initialSetupToken = crypto.randomBytes(16).toString('hex');
        console.log(`\n=============================================================`);
        console.log(`🔑 INITIAL ADMIN SETUP TOKEN: ${initialSetupToken}`);
        console.log(`   Include header 'x-setup-token: ${initialSetupToken}' or field 'setupToken' to complete initial admin setup.`);
        console.log(`=============================================================\n`);
      }
      return initialSetupToken;
    }
  } catch (_) {}
  initialSetupToken = null;
  return null;
}

// Generate token on startup if DB is clean
getOrGenSetupToken();

// ─── Setup Status ─────────────────────────────────────────────
router.get('/setup-status', userRateLimit.general, (req, res) => {
  try {
    const count = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
    res.json({ needsSetup: count === 0 });
  } catch (_) {
    res.json({ needsSetup: true });
  }
});

// ─── Initial Setup ────────────────────────────────────────────
router.post('/setup', userRateLimit.auth, (req, res) => {
  const activeSetupToken = getOrGenSetupToken();
  if (!activeSetupToken) return res.status(400).json({ error: 'Setup already completed' });

  const providedToken = req.headers['x-setup-token'] || req.body?.setupToken;
  if (!providedToken || providedToken !== activeSetupToken) {
    logSecurityEvent('UNAUTHORIZED_SETUP_ATTEMPT', `IP=${req.ip} attempted setup with invalid or missing token.`);
    return res.status(403).json({ error: 'Forbidden: Invalid or missing setup token. Check server console startup logs for token.' });
  }

  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

  if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });

  const hash = bcrypt.hashSync(password, 12); // cost factor 12 (harder to brute force)
  db.prepare(`INSERT INTO users (username, password, role) VALUES (?, ?, 'admin')`).run(username, hash);
  
  // Clear setup token after successful admin registration
  initialSetupToken = null;
  res.json({ success: true });
});

// Brute force lockout tables (5 strikes -> 15 min lock)
const ipFailedAttempts = new Map();
const userFailedAttempts = new Map();
const LOCKOUT_LIMIT = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 mins

// ─── Login ────────────────────────────────────────────────────
router.post('/login', userRateLimit.auth, (req, res) => {
  const { username, password } = req.body;
  const clientIp = req.ip || 'unknown';
  const now = Date.now();

  if (!username || !password)
    return res.status(400).json({ error: 'Username and password required' });

  // Sanitize input lengths (prevent giant string attacks)
  if (username.length > 80 || password.length > 200)
    return res.status(400).json({ error: 'Invalid credentials' });

  // Check IP lock
  const ipLock = ipFailedAttempts.get(clientIp);
  if (ipLock && ipLock.lockUntil > now) {
    const remainingSecs = Math.ceil((ipLock.lockUntil - now) / 1000);
    logSecurityEvent('BRUTE_FORCE_IP_BLOCKED', `IP=${clientIp} attempted login but is locked out.`);
    return res.status(403).json({
      error: `Too many failed login attempts. Your IP has been temporarily locked. Try again in ${Math.ceil(remainingSecs / 60)} minutes.`
    });
  }

  // Check Username lock
  const uNameLower = username.toLowerCase();
  const userLock = userFailedAttempts.get(uNameLower);
  if (userLock && userLock.lockUntil > now) {
    const remainingSecs = Math.ceil((userLock.lockUntil - now) / 1000);
    logSecurityEvent('BRUTE_FORCE_USER_BLOCKED', `User=${username} IP=${clientIp} attempted login but account is locked.`);
    return res.status(403).json({
      error: `Too many failed login attempts. This account is temporarily locked. Try again in ${Math.ceil(remainingSecs / 60)} minutes.`
    });
  }

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);

  // Always run bcrypt even if user not found (prevent username enumeration via timing)
  const dummyHash = '$2a$12$invalidhashfortimingprotection000000000000000000000000';
  const isValid = user ? bcrypt.compareSync(password, user.password) : bcrypt.compareSync(password, dummyHash);

  if (!user || !isValid) {
    // Record failure for IP
    let ipRecord = ipFailedAttempts.get(clientIp) || { count: 0, lockUntil: 0 };
    if (ipRecord.lockUntil <= now) {
      ipRecord.count++;
      logSecurityEvent('LOGIN_FAILED', `IP=${clientIp} User=${username} failed attempt ${ipRecord.count}/5`);
      if (ipRecord.count >= LOCKOUT_LIMIT) {
        ipRecord.lockUntil = now + LOCKOUT_DURATION;
        ipRecord.count = 0; // reset
        logSecurityEvent('LOCKOUT_IP', `IP=${clientIp} locked out for 15 mins due to failures.`);
      }
      ipFailedAttempts.set(clientIp, ipRecord);
    }

    // Record failure for Username
    let userRecord = userFailedAttempts.get(uNameLower) || { count: 0, lockUntil: 0 };
    if (userRecord.lockUntil <= now) {
      userRecord.count++;
      if (userRecord.count >= LOCKOUT_LIMIT) {
        userRecord.lockUntil = now + LOCKOUT_DURATION;
        userRecord.count = 0; // reset
        logSecurityEvent('LOCKOUT_USER', `Account=${username} locked out for 15 mins due to failures.`);
      }
      userFailedAttempts.set(uNameLower, userRecord);
    }

    try {
      db.prepare('INSERT INTO audit_log (user_id, action, ip) VALUES (?, ?, ?)').run(
        user ? user.id : 0, 'login_failed', clientIp
      );
    } catch (_) {}
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  // Reset lockouts on successful login
  ipFailedAttempts.delete(clientIp);
  userFailedAttempts.delete(uNameLower);

  const jti = genJti();
  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role, jti },
    JWT_SECRET,
    { expiresIn: '24h' } // 24h session
  );

  try {
    db.prepare('INSERT INTO audit_log (user_id, action, ip) VALUES (?, ?, ?)').run(
      user.id, 'login', clientIp
    );
  } catch (_) {}

  res.json({
    token,
    expiresIn: 86400,
    user: { id: user.id, username: user.username, role: user.role }
  });
});

// ─── Logout (server-side token revocation) ────────────────────
router.post('/logout', authMiddleware, (req, res) => {
  const jti = req.user.jti;
  const exp = req.user.exp * 1000; // convert to ms

  if (jti) revokeToken(jti, exp);

  try {
    db.prepare('INSERT INTO audit_log (user_id, action, ip) VALUES (?, ?, ?)').run(
      req.user.id, 'logout', req.ip
    );
  } catch (_) {}

  res.json({ success: true, message: 'Logged out successfully.' });
});

// ─── Current User ─────────────────────────────────────────────
router.get('/me', authMiddleware, userRateLimit.general, (req, res) => {
  const user = db.prepare('SELECT id, username, role, created_at FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});

// ─── Change Password ──────────────────────────────────────────
router.post('/change-password', authMiddleware, userRateLimit.auth, (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword)
    return res.status(400).json({ error: 'Both passwords required' });
  if (newPassword.length < 8)
    return res.status(400).json({ error: 'New password must be at least 8 characters' });
  if (currentPassword === newPassword)
    return res.status(400).json({ error: 'New password must differ from current password' });

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!bcrypt.compareSync(currentPassword, user.password))
    return res.status(401).json({ error: 'Current password is incorrect' });

  const hash = bcrypt.hashSync(newPassword, 12);
  db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hash, req.user.id);

  // Revoke current token — force re-login with new password
  if (req.user.jti) revokeToken(req.user.jti, req.user.exp * 1000);

  try {
    db.prepare('INSERT INTO audit_log (user_id, action, ip) VALUES (?, ?, ?)').run(
      req.user.id, 'password_changed', req.ip
    );
  } catch (_) {}

  res.json({ success: true, message: 'Password changed. Please log in again.' });
});

// ─── Admin: Create User ───────────────────────────────────────
router.post('/users', authMiddleware, userRateLimit.auth, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });

  const { username, password, role = 'user' } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
  if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
  if (!['admin', 'user'].includes(role)) return res.status(400).json({ error: 'Invalid role' });

  try {
    const hash = bcrypt.hashSync(password, 12);
    const result = db.prepare('INSERT INTO users (username, password, role) VALUES (?, ?, ?)').run(username, hash, role);
    res.json({ id: result.lastInsertRowid, username, role });
  } catch (err) {
    if (err.message.includes('UNIQUE')) return res.status(409).json({ error: 'Username already exists' });
    res.status(500).json({ error: err.message });
  }
});

// ─── Admin: List Users ────────────────────────────────────────
router.get('/users', authMiddleware, userRateLimit.general, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  const users = db.prepare('SELECT id, username, role, created_at FROM users ORDER BY id').all();
  res.json(users);
});

// ─── Admin: Delete User ───────────────────────────────────────
router.delete('/users/:id', authMiddleware, userRateLimit.auth, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  if (parseInt(req.params.id) === req.user.id) return res.status(400).json({ error: 'Cannot delete yourself' });
  db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
