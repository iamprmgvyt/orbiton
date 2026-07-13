// ============================================================
// Orbiton Panel - System Routes (Proxy to Daemon Node)
// Dispatching telemetry requests to daemons.
// ============================================================
const express  = require('express');
const { daemonRequest } = require('../utils/daemonApi');

const router = express.Router();

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

module.exports = router;
