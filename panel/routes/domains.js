// ============================================================
// Orbiton Panel - Reverse Proxy & SSL Domains Router
// Manages domain bindings and triggers certbot via daemon.
// ============================================================
const express = require('express');
const { db } = require('../db/database');
const { daemonRequest } = require('../utils/daemonApi');
const crypto = require('crypto');

const router = express.Router();

// GET /api/domains/:appId - Fetch domains bound to an app
router.get('/:appId', (req, res) => {
  const { appId } = req.params;
  try {
    const list = db.prepare('SELECT * FROM domains WHERE app_id = ?').all(appId);
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/domains/:appId/bind - Bind a domain with optional SSL proxying
router.post('/:appId/bind', async (req, res) => {
  const { appId } = req.params;
  const { domain, port, sslEnabled } = req.body;

  if (!domain || !port) {
    return res.status(400).json({ error: 'domain and target port are required.' });
  }

  try {
    const app = db.prepare('SELECT node_id FROM apps WHERE id = ?').get(appId);
    if (!app) return res.status(404).json({ error: 'Application not found.' });

    // Request daemon to compile nginx server block config
    await daemonRequest(
      '/api/domains/bind',
      'POST',
      { domain, port, sslEnabled: sslEnabled ? 1 : 0 },
      app.node_id
    );

    const domainId = crypto.randomUUID();
    const sslVal = sslEnabled ? 1 : 0;

    // Record binding metadata
    db.prepare(`
      INSERT INTO domains (id, app_id, domain, ssl_enabled)
      VALUES (?, ?, ?, ?)
    `).run(domainId, appId, domain, sslVal);

    res.json({ success: true, domainId, domain, ssl_enabled: sslVal });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/domains/:appId/:domainId - Unbind proxy domain
router.delete('/:appId/:domainId', async (req, res) => {
  const { appId, domainId } = req.params;
  try {
    const app = db.prepare('SELECT node_id FROM apps WHERE id = ?').get(appId);
    if (!app) return res.status(404).json({ error: 'Application not found.' });

    const binding = db.prepare('SELECT domain FROM domains WHERE id = ?').get(domainId);
    if (!binding) return res.status(404).json({ error: 'Domain binding record not found.' });

    // Request daemon to wipe Nginx configuration
    await daemonRequest(
      '/api/domains/unbind',
      'POST',
      { domain: binding.domain },
      app.node_id
    );

    // Delete record from SQLite
    db.prepare('DELETE FROM domains WHERE id = ?').run(domainId);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
