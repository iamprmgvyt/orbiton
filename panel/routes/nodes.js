// ============================================================
// Orbiton Panel - Node Manager Router
// Manages multiple host VPS nodes daemon endpoints.
// All nodes require IP address + port — port is mandatory to reach the Daemon.
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

// ─── IP + Port Validator ───────────────────────────────────────
function isValidIP(ip) {
  // IPv4
  const ipv4 = /^(\d{1,3}\.){3}\d{1,3}$/.test(ip) && ip.split('.').every(n => parseInt(n) <= 255);
  // IPv6 basic check
  const ipv6 = /^[a-fA-F0-9:]+$/.test(ip) && ip.includes(':');
  // Hostname
  const hostname = /^[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?)*$/.test(ip);
  return ipv4 || ipv6 || hostname;
}

function isValidPort(port) {
  const p = parseInt(port);
  return !isNaN(p) && p >= 1 && p <= 65535;
}

// GET /api/nodes - List all nodes with realtime telemetry status
router.get('/', async (req, res) => {
  try {
    const nodes = db.prepare('SELECT * FROM nodes ORDER BY id ASC').all();
    const result = [];

    for (const node of nodes) {
      const serversCount = db.prepare('SELECT COUNT(*) AS count FROM apps WHERE node_id = ?').get(node.id).count;

      let status = 'online';
      let systemInfo = 'Linux (amd64)';
      let daemonVersion = 'v1.18.0';
      let cpuCores = 1;
      let totalMem = 0;
      let freeMem = 0;
      let diskUsed = 0;
      let diskTotal = 0;

      try {
        const stats = await daemonRequest('/api/system/stats', 'GET', null, node.id);
        daemonVersion = 'v1.18.0';
        systemInfo = `${stats.os?.distro || 'Linux'} (${stats.os?.arch || 'amd64'}) ${stats.os?.release || ''}`;
        cpuCores = stats.cpu?.cores || 1;
        totalMem = stats.memory?.total || 0;
        freeMem = totalMem - (stats.memory?.used || 0);
        diskUsed  = stats.disk?.[0]?.used  || 0;
        diskTotal = stats.disk?.[0]?.size  || 0;
      } catch (_) {
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
        freeMem,
        diskUsed,
        diskTotal
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

  // All fields required
  if (!name || !ip || !port || !token) {
    return res.status(400).json({ error: 'All fields (name, ip, port, token) are required.' });
  }

  // Validate name length
  if (name.length > 64) {
    return res.status(400).json({ error: 'Node name must be under 64 characters.' });
  }

  // Validate IP or hostname
  if (!isValidIP(ip)) {
    return res.status(400).json({ error: 'Invalid IP address or hostname format.' });
  }

  // Port is MANDATORY and must be valid
  if (!isValidPort(port)) {
    return res.status(400).json({ error: 'Port is required and must be a valid number between 1 and 65535. The Orbiton Daemon runs on port 9900 by default.' });
  }

  // Token validation
  if (token.length < 16) {
    return res.status(400).json({ error: 'Daemon token must be at least 16 characters long.' });
  }

  try {
    const info = db.prepare(`
      INSERT INTO nodes (name, ip, port, token) VALUES (?, ?, ?, ?)
    `).run(name.trim(), ip.trim(), parseInt(port), token.trim());

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

    // Validate updated IP if provided
    if (ip && !isValidIP(ip)) {
      return res.status(400).json({ error: 'Invalid IP address or hostname format.' });
    }

    // Validate updated port if provided
    if (port && !isValidPort(port)) {
      return res.status(400).json({ error: 'Invalid port number. Must be between 1 and 65535.' });
    }

    db.prepare(`
      UPDATE nodes SET name = ?, ip = ?, port = ?, token = ? WHERE id = ?
    `).run(
      (name || node.name).trim(),
      (ip || node.ip).trim(),
      parseInt(port || node.port),
      (token || node.token).trim(),
      id
    );

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

// GET /api/nodes/:id/config - Generate daemon config for copy-pasting
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
      filename: '.env',
      content: Object.entries(config).map(([k, v]) => `${k}=${v}`).join('\n'),
      cmd: `cd /opt/orbiton-daemon && printf 'PORT=${node.port}\\nDAEMON_TOKEN=${node.token}\\nDATA_DIR=/opt/orbiton-data\\n' > .env && systemctl restart orbiton-daemon`
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
