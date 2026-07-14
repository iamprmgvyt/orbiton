// ============================================================
// Orbiton Panel - Sub-User Permission Verification Middleware
// Scopes permissions dynamically for operator user accounts.
// ============================================================
const { db } = require('../db/database');

function checkPermission(action) {
  return (req, res, next) => {
    // Admins have absolute permissions over everything
    if (req.user?.role === 'admin') {
      return next();
    }

    const appId = req.params.appId || req.params.id || req.body.appId || req.query.appId;
    if (!appId) {
      return res.status(400).json({ error: 'Permission Check failed: Missing appId parameter.' });
    }

    const userId = req.user.id;

    try {
      const permission = db.prepare(`
        SELECT can_power, can_files, can_console 
        FROM permissions 
        WHERE user_id = ? AND app_id = ?
      `).get(userId, appId);

      if (!permission) {
        return res.status(403).json({ error: 'Access Denied: You do not have permissions for this application.' });
      }

      if (action === 'power' && permission.can_power !== 1) {
        return res.status(403).json({ error: 'Access Denied: You lack app power control privileges.' });
      }

      if (action === 'files' && permission.can_files !== 1) {
        return res.status(403).json({ error: 'Access Denied: You lack app file management privileges.' });
      }

      if (action === 'console' && permission.can_console !== 1) {
        return res.status(403).json({ error: 'Access Denied: You lack interactive console privileges.' });
      }

      next();
    } catch (err) {
      res.status(500).json({ error: 'Internal Permission Verification Error: ' + err.message });
    }
  };
}

module.exports = { checkPermission };
