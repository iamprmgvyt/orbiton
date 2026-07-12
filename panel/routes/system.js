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

module.exports = router;
