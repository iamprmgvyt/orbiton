// ============================================================
// Orbiton Panel - System Routes (Proxy to Daemon Node)
// Dispatching telemetry requests to daemons.
// ============================================================
const express  = require('express');
const { daemonRequest } = require('../utils/daemonApi');

const router = express.Router();

// Middleware: Admin access control for system-level APIs
router.use((req, res, next) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Administrator role required to access host system APIs.' });
  }
  next();
});

// GET /api/system/metrics-history
router.get('/metrics-history', async (req, res) => {
  try {
    const data = await daemonRequest('/api/system/metrics-history');
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/system/stats
router.get('/stats', async (req, res) => {
  try {
    const data = await daemonRequest('/api/system/stats');
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/system/runtimes
router.get('/runtimes', async (req, res) => {
  try {
    const data = await daemonRequest('/api/system/runtimes');
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/system/processes
router.get('/processes', async (req, res) => {
  try {
    const data = await daemonRequest('/api/system/processes');
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/system/firewall
router.get('/firewall', async (req, res) => {
  try {
    const data = await daemonRequest('/api/system/firewall');
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/system/firewall/open
router.post('/firewall/open', async (req, res) => {
  try {
    const data = await daemonRequest('/api/system/firewall/open', 'POST', req.body);
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/system/firewall/close
router.post('/firewall/close', async (req, res) => {
  try {
    const data = await daemonRequest('/api/system/firewall/close', 'POST', req.body);
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/system/runtimes/install
router.post('/runtimes/install', async (req, res) => {
  try {
    const data = await daemonRequest('/api/system/runtimes/install', 'POST', req.body);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/system/runtimes/install/log
router.get('/runtimes/install/log', async (req, res) => {
  try {
    const data = await daemonRequest(`/api/system/runtimes/install/log?runtime=${req.query.runtime}`);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/system/runtimes/uninstall
router.post('/runtimes/uninstall', async (req, res) => {
  try {
    const data = await daemonRequest('/api/system/runtimes/uninstall', 'POST', req.body);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/system/audit-logs
router.get('/audit-logs', (req, res) => {
  try {
    const { db } = require('../db/database');
    const logs = db.prepare(`
      SELECT a.*, u.username 
      FROM audit_log a 
      LEFT JOIN users u ON a.user_id = u.id 
      ORDER BY a.id DESC 
      LIMIT 150
    `).all();
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
