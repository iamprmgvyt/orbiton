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
  if (!app) { res.status(404).json({ error: 'Application not found' }); return false; }
  if (req.user.role !== 'admin' && app.owner_id !== req.user.id) {
    res.status(403).json({ error: 'Access denied' }); return false;
  }
  return true;
}

// GET /api/files/:appId/list?path=/
router.get('/:appId/list', async (req, res) => {
  if (!checkAppAccess(req, res, req.params.appId)) return;
  try {
    const data = await daemonRequest(`/api/files/${req.params.appId}/list?path=${encodeURIComponent(req.query.path || '/')}`);
    res.json(data);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// GET /api/files/:appId/read?path=/file.txt
router.get('/:appId/read', async (req, res) => {
  if (!checkAppAccess(req, res, req.params.appId)) return;
  try {
    const data = await daemonRequest(`/api/files/${req.params.appId}/read?path=${encodeURIComponent(req.query.path)}`);
    res.json(data);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// POST /api/files/:appId/write
router.post('/:appId/write', async (req, res) => {
  if (!checkAppAccess(req, res, req.params.appId)) return;
  try {
    const data = await daemonRequest(`/api/files/${req.params.appId}/write`, 'POST', req.body);
    res.json(data);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// DELETE /api/files/:appId/delete?path=/file.txt
router.delete('/:appId/delete', async (req, res) => {
  if (!checkAppAccess(req, res, req.params.appId)) return;
  try {
    const data = await daemonRequest(`/api/files/${req.params.appId}/delete?path=${encodeURIComponent(req.query.path)}`, 'DELETE');
    res.json(data);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// POST /api/files/:appId/mkdir
router.post('/:appId/mkdir', async (req, res) => {
  if (!checkAppAccess(req, res, req.params.appId)) return;
  try {
    const data = await daemonRequest(`/api/files/${req.params.appId}/mkdir`, 'POST', req.body);
    res.json(data);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// POST /api/files/:appId/rename
router.post('/:appId/rename', async (req, res) => {
  if (!checkAppAccess(req, res, req.params.appId)) return;
  try {
    const data = await daemonRequest(`/api/files/${req.params.appId}/rename`, 'POST', req.body);
    res.json(data);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// POST /api/files/:appId/move
router.post('/:appId/move', async (req, res) => {
  if (!checkAppAccess(req, res, req.params.appId)) return;
  try {
    const data = await daemonRequest(`/api/files/${req.params.appId}/move`, 'POST', req.body);
    res.json(data);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// POST /api/files/:appId/archive
router.post('/:appId/archive', async (req, res) => {
  if (!checkAppAccess(req, res, req.params.appId)) return;
  try {
    const data = await daemonRequest(`/api/files/${req.params.appId}/archive`, 'POST', req.body);
    res.json(data);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// POST /api/files/:appId/extract
router.post('/:appId/extract', async (req, res) => {
  if (!checkAppAccess(req, res, req.params.appId)) return;
  try {
    const data = await daemonRequest(`/api/files/${req.params.appId}/extract`, 'POST', req.body);
    res.json(data);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// POST /api/files/:appId/upload
router.post('/:appId/upload', upload.array('files', 50), async (req, res) => {
  if (!checkAppAccess(req, res, req.params.appId)) return;
  try {
    const fd = new globalThis.FormData();
    for (const f of req.files) {
      const fileBuffer = fs.readFileSync(f.path);
      const fileBlob = new globalThis.Blob([fileBuffer]);
      fd.append('files', fileBlob, f.originalname);
      // clean temp local file asynchronously
      fs.unlink(f.path, () => {});
    }

    const fetch = globalThis.fetch;
    const resDaemon = await fetch(`${DAEMON_URL}/api/files/${req.params.appId}/upload?path=${encodeURIComponent(req.query.path || '/')}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DAEMON_TOKEN}`
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
  if (!checkAppAccess(req, res, req.params.appId)) return;
  try {
    const fetch = global.fetch || require('node-fetch');
    const url = `${DAEMON_URL}/api/files/${req.params.appId}/download?path=${encodeURIComponent(req.query.path)}`;
    fetch(url, { headers: { 'Authorization': `Bearer ${DAEMON_TOKEN}` } })
      .then(daemonRes => {
        res.setHeader('Content-Type', daemonRes.headers.get('content-type') || 'application/octet-stream');
        res.setHeader('Content-Disposition', daemonRes.headers.get('content-disposition') || `attachment; filename="${req.query.path.split('/').pop()}"`);
        daemonRes.body.pipe(res);
      })
      .catch(err => res.status(400).json({ error: err.message }));
  } catch (err) { res.status(400).json({ error: err.message }); }
});

module.exports = router;
