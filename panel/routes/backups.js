// ============================================================
// Orbiton Panel - Backup & Recovery Management Router
// proxying requests to remote daemons and recording metadata in SQLite.
// ============================================================
const express = require('express');
const { db } = require('../db/database');
const { daemonRequest } = require('../utils/daemonApi');
const crypto = require('crypto');

const router = express.Router();

// GET /api/backups/:appId - Fetch all backups for an app
router.get('/:appId', (req, res) => {
  const { appId } = req.params;
  try {
    const list = db.prepare('SELECT * FROM backups WHERE app_id = ? ORDER BY datetime(created_at) DESC').all(appId);
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/backups/:appId/create - Create a new backup
router.post('/:appId/create', async (req, res) => {
  const { appId } = req.params;
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Backup name is required.' });

  try {
    const app = db.prepare('SELECT node_id FROM apps WHERE id = ?').get(appId);
    if (!app) return res.status(404).json({ error: 'Target application not found.' });

    const backupId = crypto.randomUUID();
    const backupName = `backup_${backupId}`;

    // Request daemon to zip the workspace
    const result = await daemonRequest(
      `/api/apps/${appId}/backup/create`, 
      'POST', 
      { backupName }, 
      app.node_id
    );

    const dateStr = new Date().toISOString();
    
    // Save backup metadata to SQLite database
    db.prepare(`
      INSERT INTO backups (id, app_id, name, filepath, size, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(backupId, appId, name, result.filename, result.size, dateStr);

    res.json({ success: true, backupId, name, size: result.size, created_at: dateStr });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/backups/:appId/restore/:backupId - Rollback app data
router.post('/:appId/restore/:backupId', async (req, res) => {
  const { appId, backupId } = req.params;
  try {
    const app = db.prepare('SELECT node_id FROM apps WHERE id = ?').get(appId);
    if (!app) return res.status(404).json({ error: 'Target application not found.' });

    const backup = db.prepare('SELECT filepath FROM backups WHERE id = ?').get(backupId);
    if (!backup) return res.status(404).json({ error: 'Backup record not found.' });

    const backupName = backup.filepath.replace('.zip', '');

    // Request daemon to extract ZIP backup
    await daemonRequest(
      `/api/apps/${appId}/backup/restore`, 
      'POST', 
      { backupName }, 
      app.node_id
    );

    res.json({ success: true, message: 'Application restored successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/backups/:appId/:backupId - Delete a backup
router.delete('/:appId/:backupId', async (req, res) => {
  const { appId, backupId } = req.params;
  try {
    const app = db.prepare('SELECT node_id FROM apps WHERE id = ?').get(appId);
    if (!app) return res.status(404).json({ error: 'Target application not found.' });

    const backup = db.prepare('SELECT filepath FROM backups WHERE id = ?').get(backupId);
    if (!backup) return res.status(404).json({ error: 'Backup record not found.' });

    const backupName = backup.filepath.replace('.zip', '');

    // Request daemon to delete backup file
    await daemonRequest(
      `/api/apps/${appId}/backup/${backupName}`, 
      'DELETE', 
      null, 
      app.node_id
    );

    // Remove metadata record from SQLite database
    db.prepare('DELETE FROM backups WHERE id = ?').run(backupId);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
