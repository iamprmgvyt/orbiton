// ============================================================
// Orbiton Panel - Node Manager Router
// Manages multiple host VPS nodes daemon endpoints.
// ============================================================
const express = require('express');
const { db } = require('../db/database');
const { daemonRequest } = require('../utils/daemonApi');

const router = express.Router();

// Middleware: Admin access control
router.use((req, res, next) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Administrator role required to manage daemon nodes.' });
  }
  next();
});

// GET /api/nodes - List all nodes with realtime telemetry status
router.get('/', async (req, res) => {
  try {
    const nodes = db.prepare('SELECT * FROM nodes ORDER BY id ASC').all();
    const result = [];

    for (const node of nodes) {
      // Get apps count allocated to this node
      const serversCount = db.prepare('SELECT COUNT(*) AS count FROM apps WHERE node_id = ?').get(node.id).count;
      
      let status = 'online';
      let systemInfo = 'Linux (amd64)';
      let daemonVersion = 'v1.0.0';
      let cpuCores = 1;
      let totalMem = 0;
      let freeMem = 0;

      try {
        // Ping daemon node for telemetry
        const stats = await daemonRequest('/api/system/stats', 'GET', null, node.id);
        daemonVersion = 'v1.13.1'; // Orbiton Daemon current protocol version
        systemInfo = `${stats.os?.distro || 'Linux'} (${stats.os?.arch || 'amd64'}) ${stats.os?.release || ''}`;
        cpuCores = stats.cpu?.cores || 1;
        totalMem = stats.memory?.total || 0;
        freeMem = stats.memory?.total - stats.memory?.used || 0;
      } catch (err) {
        status = 'offline';
      }

      result.push({
        id: node.id,
        name: node.name,
        ip: node.ip,
        port: node.port,
        token: node.token,
        created_at: node.created_at,
        status,
        serversCount,
        daemonVersion,
        systemInfo,
        cpuCores,
        totalMem,
        freeMem
      });
    }

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/nodes - Create a new Daemon node connection
router.post('/', (req, res) => {
  const { name, ip, port, token } = req.body;
  if (!name || !ip || !port || !token) {
    return res.status(400).json({ error: 'All fields (name, ip, port, token) are required.' });
  }

  try {
    const info = db.prepare(`
      INSERT INTO nodes (name, ip, port, token)
      VALUES (?, ?, ?, ?)
    `).run(name, ip, parseInt(port), token);

    res.json({ success: true, nodeId: info.lastInsertRowid });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/nodes/:id - Update node configuration
router.put('/:id', (req, res) => {
  const { name, ip, port, token } = req.body;
  const { id } = req.params;

  try {
    const node = db.prepare('SELECT * FROM nodes WHERE id = ?').get(id);
    if (!node) return res.status(404).json({ error: 'Node not found' });

    db.prepare(`
      UPDATE nodes
      SET name = ?, ip = ?, port = ?, token = ?
      WHERE id = ?
    `).run(name || node.name, ip || node.ip, parseInt(port) || node.port, token || node.token, id);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/nodes/:id - Delete node configuration
router.delete('/:id', (req, res) => {
  const { id } = req.params;
  if (parseInt(id) === 1) {
    return res.status(400).json({ error: 'Cannot delete the primary Local Node.' });
  }

  try {
    // Check if there are apps allocated to this node
    const serversCount = db.prepare('SELECT COUNT(*) AS count FROM apps WHERE node_id = ?').get(id).count;
    if (serversCount > 0) {
      return res.status(400).json({ error: `Cannot delete node: ${serversCount} server(s) are currently allocated to it.` });
    }

    db.prepare('DELETE FROM nodes WHERE id = ?').run(id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/nodes/:id/config - Generate configuration file for copy-pasting
router.get('/:id/config', (req, res) => {
  const { id } = req.params;
  try {
    const node = db.prepare('SELECT * FROM nodes WHERE id = ?').get(id);
    if (!node) return res.status(404).json({ error: 'Node not found' });

    const config = {
      PORT: node.port,
      DAEMON_TOKEN: node.token,
      DATA_DIR: '/opt/orbiton-data'
    };

    res.json({
      filename: 'config.json',
      content: JSON.stringify(config, null, 2),
      cmd: `echo '${JSON.stringify(config)}' > /opt/orbiton-daemon/config.json && systemctl restart orbiton-daemon`
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
