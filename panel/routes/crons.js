// ============================================================
// Orbiton Panel - Cron Job Scheduler Router
// Handles CRUD metadata and reloads node-cron scheduler.
// ============================================================
const express = require('express');
const { db } = require('../db/database');
const { reloadCronScheduler } = require('../managers/cronManager');
const crypto = require('crypto');

const router = express.Router();

// GET /api/crons/:appId - Fetch cron jobs mapped to an app
router.get('/:appId', (req, res) => {
  const { appId } = req.params;
  try {
    const list = db.prepare('SELECT * FROM cron_jobs WHERE app_id = ?').all(appId);
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/crons/:appId - Create a new cron job
router.post('/:appId', (req, res) => {
  const { appId } = req.params;
  const { name, expression, command } = req.body;

  if (!name || !expression || !command) {
    return res.status(400).json({ error: 'name, expression, and command are required.' });
  }

  // Basic validation of cron expression
  const cron = require('node-cron');
  if (!cron.validate(expression)) {
    return res.status(400).json({ error: 'Invalid cron expression format.' });
  }

  try {
    const cronId = crypto.randomUUID();
    db.prepare(`
      INSERT INTO cron_jobs (id, app_id, name, expression, command)
      VALUES (?, ?, ?, ?, ?)
    `).run(cronId, appId, name, expression, command);

    // Dynamic schedule reload
    reloadCronScheduler();

    res.json({ success: true, cronId, name, expression, command });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/crons/:appId/:cronId - Delete a cron job
router.delete('/:appId/:cronId', (req, res) => {
  const { cronId } = req.params;
  try {
    db.prepare('DELETE FROM cron_jobs WHERE id = ?').run(cronId);

    // Dynamic schedule reload
    reloadCronScheduler();

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
