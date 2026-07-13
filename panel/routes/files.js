// ============================================================
// Orbiton Panel - File Manager Routes (Proxy to Daemon Node)
// Proxies filesystem requests securely.
// ============================================================
const express  = require('express');
const multer   = require('multer');
const fs       = require('fs');
const { db }   = require('../db/database');
const { daemonRequest, DAEMON_URL, DAEMON_TOKEN } = require('../utils/daemonApi');

const router = express.Router();

const upload = multer({
  dest: require('os').tmpdir(),
  limits: { fileSize: 500 * 1024 * 1024 }
});

function checkAppAccess(req, res, appId) {
  const app = db.prepare('SELECT * FROM apps WHERE id = ?').get(appId);
  if (!app) { res.status(404).json({ error: 'Application not found' }); return null; }
  if (req.user.role !== 'admin' && app.owner_id !== req.user.id) {
    res.status(403).json({ error: 'Access denied' }); return null;
  }
  return app;
}

// GET /api/files/:appId/list?path=/
router.get('/:appId/list', async (req, res) => {
  const app = checkAppAccess(req, res, req.params.appId);
  if (!app) return;
  try {
    const data = await daemonRequest(`/api/files/${req.params.appId}/list?path=${encodeURIComponent(req.query.path || '/')}`, 'GET', null, app.node_id);
    res.json(data);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// GET /api/files/:appId/read?path=/file.txt
router.get('/:appId/read', async (req, res) => {
  const app = checkAppAccess(req, res, req.params.appId);
  if (!app) return;
  try {
    const data = await daemonRequest(`/api/files/${req.params.appId}/read?path=${encodeURIComponent(req.query.path)}`, 'GET', null, app.node_id);
    res.json(data);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// POST /api/files/:appId/write
router.post('/:appId/write', async (req, res) => {
  const app = checkAppAccess(req, res, req.params.appId);
  if (!app) return;
  try {
    const data = await daemonRequest(`/api/files/${req.params.appId}/write`, 'POST', req.body, app.node_id);
    res.json(data);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// DELETE /api/files/:appId/delete?path=/file.txt
router.delete('/:appId/delete', async (req, res) => {
  const app = checkAppAccess(req, res, req.params.appId);
  if (!app) return;
  try {
    const data = await daemonRequest(`/api/files/${req.params.appId}/delete?path=${encodeURIComponent(req.query.path)}`, 'DELETE', null, app.node_id);
    res.json(data);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// POST /api/files/:appId/mkdir
router.post('/:appId/mkdir', async (req, res) => {
  const app = checkAppAccess(req, res, req.params.appId);
  if (!app) return;
  try {
    const data = await daemonRequest(`/api/files/${req.params.appId}/mkdir`, 'POST', req.body, app.node_id);
    res.json(data);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// POST /api/files/:appId/rename
router.post('/:appId/rename', async (req, res) => {
  const app = checkAppAccess(req, res, req.params.appId);
  if (!app) return;
  try {
    const data = await daemonRequest(`/api/files/${req.params.appId}/rename`, 'POST', req.body, app.node_id);
    res.json(data);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// POST /api/files/:appId/move
router.post('/:appId/move', async (req, res) => {
  const app = checkAppAccess(req, res, req.params.appId);
  if (!app) return;
  try {
    const data = await daemonRequest(`/api/files/${req.params.appId}/move`, 'POST', req.body, app.node_id);
    res.json(data);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// POST /api/files/:appId/archive
router.post('/:appId/archive', async (req, res) => {
  const app = checkAppAccess(req, res, req.params.appId);
  if (!app) return;
  try {
    const data = await daemonRequest(`/api/files/${req.params.appId}/archive`, 'POST', req.body, app.node_id);
    res.json(data);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// POST /api/files/:appId/extract
router.post('/:appId/extract', async (req, res) => {
  const app = checkAppAccess(req, res, req.params.appId);
  if (!app) return;
  try {
    const data = await daemonRequest(`/api/files/${req.params.appId}/extract`, 'POST', req.body, app.node_id);
    res.json(data);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// POST /api/files/:appId/upload
router.post('/:appId/upload', upload.array('files', 50), async (req, res) => {
  const app = checkAppAccess(req, res, req.params.appId);
  if (!app) return;
  try {
    const fd = new globalThis.FormData();
    for (const f of req.files) {
      const fileBuffer = fs.readFileSync(f.path);
      const fileBlob = new globalThis.Blob([fileBuffer]);
      fd.append('files', fileBlob, f.originalname);
      fs.unlink(f.path, () => {});
    }

    let targetUrl = DAEMON_URL;
    let targetToken = DAEMON_TOKEN;
    if (app.node_id) {
      const node = db.prepare('SELECT * FROM nodes WHERE id = ?').get(app.node_id);
      if (node) {
        targetUrl = `http://${node.ip.replace(/\/$/, '')}:${node.port}`;
        targetToken = node.token;
      }
    }

    const fetch = globalThis.fetch;
    const resDaemon = await fetch(`${targetUrl}/api/files/${req.params.appId}/upload?path=${encodeURIComponent(req.query.path || '/')}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${targetToken}`
      },
      body: fd
    });
    const data = await resDaemon.json();
    if (!resDaemon.ok) throw new Error(data.error || 'Daemon upload failed');
    res.json(data);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// GET /api/files/:appId/download
router.get('/:appId/download', (req, res) => {
  const app = checkAppAccess(req, res, req.params.appId);
  if (!app) return;
  try {
    let targetUrl = DAEMON_URL;
    let targetToken = DAEMON_TOKEN;
    if (app.node_id) {
      const node = db.prepare('SELECT * FROM nodes WHERE id = ?').get(app.node_id);
      if (node) {
        targetUrl = `http://${node.ip.replace(/\/$/, '')}:${node.port}`;
        targetToken = node.token;
      }
    }

    const fetch = global.fetch || require('node-fetch');
    const url = `${targetUrl}/api/files/${req.params.appId}/download?path=${encodeURIComponent(req.query.path)}`;
    fetch(url, { headers: { 'Authorization': `Bearer ${targetToken}` } })
      .then(daemonRes => {
        res.setHeader('Content-Type', daemonRes.headers.get('content-type') || 'application/octet-stream');
        res.setHeader('Content-Disposition', daemonRes.headers.get('content-disposition') || `attachment; filename="${req.query.path.split('/').pop()}"`);
        daemonRes.body.pipe(res);
      })
      .catch(err => res.status(400).json({ error: err.message }));
  } catch (err) { res.status(400).json({ error: err.message }); }
});

module.exports = router;
