// ============================================================
// Orbiton Panel - Sub-User Permissions Management Router
// Allowing administrators to view/grant scopes per user.
// ============================================================
const express = require('express');
const { db } = require('../db/database');

const router = express.Router();

// Middleware: Admin access control
router.use((req, res, next) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Administrator role required to manage account permissions.' });
  }
  next();
});

// GET /api/permissions/users - List all sub-users
router.get('/users', (req, res) => {
  try {
    const users = db.prepare(`
      SELECT id, username, role, created_at 
      FROM users 
      WHERE role != 'admin'
    `).all();
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/permissions/:userId - Fetch all permissions for a sub-user
router.get('/:userId', (req, res) => {
  const { userId } = req.params;
  try {
    const list = db.prepare(`
      SELECT p.id, p.app_id, a.name AS app_name, p.can_power, p.can_files, p.can_console
      FROM permissions p
      JOIN apps a ON p.app_id = a.id
      WHERE p.user_id = ?
    `).all(userId);
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/permissions/:userId - Grant or update permissions
router.post('/:userId', (req, res) => {
  const { userId } = req.params;
  const { permissions } = req.body; // Array of { appId, can_power, can_files, can_console }

  if (!Array.isArray(permissions)) {
    return res.status(400).json({ error: 'Body key "permissions" must be an array.' });
  }

  try {
    // Wrap database modifications in transaction
    const insertOrUpdate = db.transaction((perms) => {
      // Clear old permissions first for complete sync
      db.prepare('DELETE FROM permissions WHERE user_id = ?').run(userId);

      const stmt = db.prepare(`
        INSERT INTO permissions (user_id, app_id, can_power, can_files, can_console)
        VALUES (?, ?, ?, ?, ?)
      `);

      for (let p of perms) {
        stmt.run(
          userId, 
          p.appId, 
          p.can_power ? 1 : 0, 
          p.can_files ? 1 : 0, 
          p.can_console ? 1 : 0
        );
      }
    });

    insertOrUpdate(permissions);
    res.json({ success: true, message: 'Permissions updated successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
