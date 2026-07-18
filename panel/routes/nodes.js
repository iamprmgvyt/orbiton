// ============================================================
// Orbiton Panel - Node Manager Router
// Full-featured node configuration — similar to Pterodactyl Panel.
// Each node supports: resource limits, over-allocation, maintenance mode,
// proxy/SSL settings, user file quotas, upload limits, location tags.
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

// ─── Validators ────────────────────────────────────────────────
function isValidIP(ip) {
  const ipv4 = /^(\d{1,3}\.){3}\d{1,3}$/.test(ip) && ip.split('.').every(n => parseInt(n) <= 255);
  const ipv6 = /^[a-fA-F0-9:]+$/.test(ip) && ip.includes(':');
  const hostname = /^[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?)*$/.test(ip);
  return ipv4 || ipv6 || hostname;
}

function isValidPort(port) {
  const p = parseInt(port);
  return !isNaN(p) && p >= 1 && p <= 65535;
}

// ─── GET /api/nodes — List all nodes with telemetry ───────────
router.get('/', async (req, res) => {
  try {
    const nodes = db.prepare('SELECT * FROM nodes ORDER BY id ASC').all();
    const result = [];

    for (const node of nodes) {
      const serversCount = db.prepare('SELECT COUNT(*) AS count FROM apps WHERE node_id = ?').get(node.id).count;

      let status = 'online';
      let systemInfo = 'Linux (amd64)';
      let daemonVersion = 'v1.19.0';
      let cpuCores = 1;
      let totalMem = 0;
      let usedMem = 0;
      let diskUsed = 0;
      let diskTotal = 0;
      let cpuUsage = 0;
      let uptime = 0;

      try {
        const stats = await daemonRequest('/api/system/stats', 'GET', null, node.id);
        systemInfo = `${stats.os?.distro || 'Linux'} (${stats.os?.arch || 'amd64'}) ${stats.os?.release || ''}`.trim();
        cpuCores  = stats.cpu?.cores  || 1;
        cpuUsage  = stats.cpu?.usage  || 0;
        totalMem  = stats.memory?.total || 0;
        usedMem   = stats.memory?.used  || 0;
        diskUsed  = stats.disk?.[0]?.used  || 0;
        diskTotal = stats.disk?.[0]?.size  || 0;
        uptime    = stats.os?.uptime   || 0;
      } catch (_) {
        status = 'offline';
      }

      result.push({
        ...node,
        status,
        serversCount,
        daemonVersion,
        systemInfo,
        cpuCores,
        cpuUsage,
        totalMem,
        usedMem,
        freeMem: totalMem - usedMem,
        diskUsed,
        diskTotal,
        uptime
      });
    }

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/nodes/:id — Get single node ────────────────────
router.get('/:id', (req, res) => {
  try {
    const node = db.prepare('SELECT * FROM nodes WHERE id = ?').get(req.params.id);
    if (!node) return res.status(404).json({ error: 'Node not found' });
    const serversCount = db.prepare('SELECT COUNT(*) AS count FROM apps WHERE node_id = ?').get(node.id).count;
    res.json({ ...node, serversCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/nodes — Create node ───────────────────────────
router.post('/', (req, res) => {
  const {
    name, description = '', location = '', ip, port, token,
    memory_limit = 0, memory_overalloc = 0,
    disk_limit = 0, disk_overalloc = 0,
    cpu_limit = 0, max_servers = 0,
    use_ssl = 0, behind_proxy = 0, public_host = '',
    upload_limit_mb = 100, user_file_quota_kb = 1024,
    maintenance_mode = 0, maintenance_msg = 'This node is currently under maintenance.',
    tags = ''
  } = req.body;

  // Required field validation
  if (!name || !ip || !port || !token)
    return res.status(400).json({ error: 'Required: name, ip, port, token.' });
  if (name.length > 64)
    return res.status(400).json({ error: 'Node name must be under 64 characters.' });
  if (!isValidIP(ip))
    return res.status(400).json({ error: 'Invalid IP address or hostname.' });
  if (!isValidPort(port))
    return res.status(400).json({ error: 'Port must be a valid number between 1 and 65535. Daemon default: 9900.' });
  if (token.length < 16)
    return res.status(400).json({ error: 'Daemon token must be at least 16 characters.' });

  // Numeric bounds
  if (memory_overalloc < 0 || memory_overalloc > 200)
    return res.status(400).json({ error: 'Memory over-allocation must be between 0% and 200%.' });
  if (disk_overalloc < 0 || disk_overalloc > 200)
    return res.status(400).json({ error: 'Disk over-allocation must be between 0% and 200%.' });

  try {
    const info = db.prepare(`
      INSERT INTO nodes (
        name, description, location, ip, port, token,
        memory_limit, memory_overalloc, disk_limit, disk_overalloc,
        cpu_limit, max_servers, use_ssl, behind_proxy, public_host,
        upload_limit_mb, user_file_quota_kb, maintenance_mode, maintenance_msg, tags
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      name.trim(), description.trim(), location.trim(), ip.trim(), parseInt(port), token.trim(),
      parseInt(memory_limit) || 0, parseInt(memory_overalloc) || 0,
      parseInt(disk_limit) || 0, parseInt(disk_overalloc) || 0,
      parseInt(cpu_limit) || 0, parseInt(max_servers) || 0,
      use_ssl ? 1 : 0, behind_proxy ? 1 : 0, (public_host || '').trim(),
      parseInt(upload_limit_mb) || 100, parseInt(user_file_quota_kb) || 1024,
      maintenance_mode ? 1 : 0, maintenance_msg.trim(),
      tags.trim()
    );
    res.json({ success: true, nodeId: info.lastInsertRowid });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── PUT /api/nodes/:id — Update node settings ────────────────
router.put('/:id', (req, res) => {
  const { id } = req.params;

  try {
    const node = db.prepare('SELECT * FROM nodes WHERE id = ?').get(id);
    if (!node) return res.status(404).json({ error: 'Node not found' });

    const {
      name         = node.name,
      description  = node.description,
      location     = node.location,
      ip           = node.ip,
      port         = node.port,
      token        = node.token,
      memory_limit       = node.memory_limit,
      memory_overalloc   = node.memory_overalloc,
      disk_limit         = node.disk_limit,
      disk_overalloc     = node.disk_overalloc,
      cpu_limit          = node.cpu_limit,
      max_servers        = node.max_servers,
      use_ssl            = node.use_ssl,
      behind_proxy       = node.behind_proxy,
      public_host        = node.public_host,
      upload_limit_mb    = node.upload_limit_mb,
      user_file_quota_kb = node.user_file_quota_kb,
      maintenance_mode   = node.maintenance_mode,
      maintenance_msg    = node.maintenance_msg,
      tags               = node.tags
    } = req.body;

    // Validate updated fields
    if (ip && !isValidIP(ip))
      return res.status(400).json({ error: 'Invalid IP address or hostname.' });
    if (port && !isValidPort(port))
      return res.status(400).json({ error: 'Invalid port number. Must be 1–65535.' });
    if (memory_overalloc < 0 || memory_overalloc > 200)
      return res.status(400).json({ error: 'Memory over-allocation must be 0%–200%.' });
    if (disk_overalloc < 0 || disk_overalloc > 200)
      return res.status(400).json({ error: 'Disk over-allocation must be 0%–200%.' });

    db.prepare(`
      UPDATE nodes SET
        name = ?, description = ?, location = ?, ip = ?, port = ?, token = ?,
        memory_limit = ?, memory_overalloc = ?, disk_limit = ?, disk_overalloc = ?,
        cpu_limit = ?, max_servers = ?, use_ssl = ?, behind_proxy = ?, public_host = ?,
        upload_limit_mb = ?, user_file_quota_kb = ?,
        maintenance_mode = ?, maintenance_msg = ?, tags = ?
      WHERE id = ?
    `).run(
      String(name).trim(), String(description).trim(), String(location).trim(),
      String(ip).trim(), parseInt(port), String(token).trim(),
      parseInt(memory_limit) || 0, parseInt(memory_overalloc) || 0,
      parseInt(disk_limit) || 0, parseInt(disk_overalloc) || 0,
      parseInt(cpu_limit) || 0, parseInt(max_servers) || 0,
      use_ssl ? 1 : 0, behind_proxy ? 1 : 0, String(public_host || '').trim(),
      parseInt(upload_limit_mb) || 100, parseInt(user_file_quota_kb) || 1024,
      maintenance_mode ? 1 : 0, String(maintenance_msg).trim(),
      String(tags).trim(),
      id
    );

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── DELETE /api/nodes/:id ────────────────────────────────────
router.delete('/:id', (req, res) => {
  const { id } = req.params;
  if (parseInt(id) === 1)
    return res.status(400).json({ error: 'Cannot delete the primary Local Node.' });

  try {
    const serversCount = db.prepare('SELECT COUNT(*) AS count FROM apps WHERE node_id = ?').get(id).count;
    if (serversCount > 0)
      return res.status(400).json({ error: `Cannot delete node: ${serversCount} server(s) are still allocated to it.` });

    db.prepare('DELETE FROM nodes WHERE id = ?').run(id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/nodes/:id/config — Generate .env config ────────
router.get('/:id/config', (req, res) => {
  const { id } = req.params;
  try {
    const node = db.prepare('SELECT * FROM nodes WHERE id = ?').get(id);
    if (!node) return res.status(404).json({ error: 'Node not found' });

    const envLines = [
      `PORT=${node.port}`,
      `DAEMON_TOKEN=${node.token}`,
      `DATA_DIR=/opt/orbiton-data`,
      node.use_ssl ? `SSL=true` : `SSL=false`,
      node.behind_proxy ? `TRUST_PROXY=true` : `TRUST_PROXY=false`,
      node.upload_limit_mb ? `UPLOAD_LIMIT_MB=${node.upload_limit_mb}` : '',
      node.user_file_quota_kb ? `USER_FILE_QUOTA_KB=${node.user_file_quota_kb}` : ''
    ].filter(Boolean).join('\n');

    res.json({
      filename: '.env',
      content: envLines,
      cmd: `cd /opt/orbiton-daemon && cat > .env << 'EOF'\n${envLines}\nEOF\nsystemctl restart orbiton-daemon`
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/nodes/:id/maintenance — Toggle maintenance ─────
router.post('/:id/maintenance', (req, res) => {
  const { id } = req.params;
  try {
    const node = db.prepare('SELECT * FROM nodes WHERE id = ?').get(id);
    if (!node) return res.status(404).json({ error: 'Node not found' });

    const newMode = node.maintenance_mode ? 0 : 1;
    db.prepare('UPDATE nodes SET maintenance_mode = ? WHERE id = ?').run(newMode, id);

    res.json({
      success: true,
      maintenance_mode: newMode,
      message: newMode ? 'Node is now in maintenance mode.' : 'Node maintenance mode disabled.'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/nodes/:id/stats — Live telemetry for single node ─
router.get('/:id/stats', async (req, res) => {
  const { id } = req.params;
  try {
    const node = db.prepare('SELECT * FROM nodes WHERE id = ?').get(id);
    if (!node) return res.status(404).json({ error: 'Node not found' });

    const stats = await daemonRequest('/api/system/stats', 'GET', null, node.id);
    res.json(stats);
  } catch (err) {
    res.status(503).json({ error: 'Node is offline or unreachable.', detail: err.message });
  }
});

module.exports = router;
