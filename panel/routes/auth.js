// ============================================================
// Auth Routes - Login, Logout, Register, Change Password
// ============================================================
const express = require('express');
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const router  = express.Router();
const { db }  = require('../db/database');
const authMiddleware = require('../middleware/auth');
const { JWT_SECRET } = require('../middleware/auth');

// GET /api/auth/setup-status
router.get('/setup-status', (req, res) => {
  try {
    const count = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
    res.json({ needsSetup: count === 0 });
  } catch (err) {
    res.json({ needsSetup: true });
  }
});

// POST /api/auth/setup
router.post('/setup', (req, res) => {
  const count = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
  if (count > 0) {
    return res.status(400).json({ error: 'Setup already completed' });
  }

  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  const hash = bcrypt.hashSync(password, 10);
  db.prepare(`INSERT INTO users (username, password, role) VALUES (?, ?, 'admin')`).run(username, hash);

  res.json({ success: true });
});

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ error: 'Username and password required' });

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user || !bcrypt.compareSync(password, user.password))
    return res.status(401).json({ error: 'Invalid credentials' });

  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  try {
    db.prepare('INSERT INTO audit_log (user_id, action, ip) VALUES (?, ?, ?)').run(
      user.id, 'login', req.ip
    );
  } catch (_) {}

  res.json({
    token,
    user: { id: user.id, username: user.username, role: user.role },
  });
});

// GET /api/auth/me
router.get('/me', authMiddleware, (req, res) => {
  const user = db.prepare('SELECT id, username, role, created_at FROM users WHERE id = ?')
    .get(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});

// POST /api/auth/change-password
router.post('/change-password', authMiddleware, (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword)
    return res.status(400).json({ error: 'Both passwords required' });
  if (newPassword.length < 6)
    return res.status(400).json({ error: 'Password must be at least 6 characters' });

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!bcrypt.compareSync(currentPassword, user.password))
    return res.status(401).json({ error: 'Current password incorrect' });

  const hash = bcrypt.hashSync(newPassword, 10);
  db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hash, req.user.id);
  res.json({ success: true });
});

// POST /api/auth/users - Admin: create user
router.post('/users', authMiddleware, (req, res) => {
  if (req.user.role !== 'admin')
    return res.status(403).json({ error: 'Admin only' });

  const { username, password, role = 'user' } = req.body;
  if (!username || !password)
    return res.status(400).json({ error: 'Username and password required' });

  try {
    const hash = bcrypt.hashSync(password, 10);
    const result = db.prepare(
      'INSERT INTO users (username, password, role) VALUES (?, ?, ?)'
    ).run(username, hash, role);
    res.json({ id: result.lastInsertRowid, username, role });
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'Username already exists' });
    }
    res.status(500).json({ error: err.message });
  }
});

// GET /api/auth/users - Admin: list users
router.get('/users', authMiddleware, (req, res) => {
  if (req.user.role !== 'admin')
    return res.status(403).json({ error: 'Admin only' });

  const users = db.prepare(
    'SELECT id, username, role, created_at FROM users ORDER BY id'
  ).all();
  res.json(users);
});

// DELETE /api/auth/users/:id - Admin: delete user
router.delete('/users/:id', authMiddleware, (req, res) => {
  if (req.user.role !== 'admin')
    return res.status(403).json({ error: 'Admin only' });
  if (parseInt(req.params.id) === req.user.id)
    return res.status(400).json({ error: 'Cannot delete yourself' });

  db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
