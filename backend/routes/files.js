// ============================================================
// File Manager Routes - Browse, Upload, Download, Edit, Delete
// ============================================================
const express  = require('express');
const multer   = require('multer');
const path     = require('path');
const fs       = require('fs');
const archiver = require('archiver');
const mime     = require('mime-types');
const { db, DATA_DIR } = require('../db/database');
const router   = express.Router();

const APPS_DIR = path.join(DATA_DIR, 'apps');

// ─── Multer config ───────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    try {
      const dir = safePath(req.params.appId, req.query.path || '/');
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    } catch (e) { cb(e); }
  },
  filename: (req, file, cb) => cb(null, file.originalname),
});
const upload = multer({ storage, limits: { fileSize: 500 * 1024 * 1024 } });

// ─── Helpers ─────────────────────────────────────────────────
function safePath(appId, relativePath = '/') {
  const base = path.join(APPS_DIR, appId);
  const rel  = relativePath.startsWith('/') ? relativePath : '/' + relativePath;
  const full = path.resolve(base, '.' + rel);
  if (!full.startsWith(base)) throw new Error('Path traversal denied');
  return full;
}

function checkAppAccess(req, res) {
  const app = db.prepare('SELECT * FROM apps WHERE id = ?').get(req.params.appId);
  if (!app) { res.status(404).json({ error: 'Application not found' }); return null; }
  if (req.user.role !== 'admin' && app.owner_id !== req.user.id) {
    res.status(403).json({ error: 'Access denied' }); return null;
  }
  return app;
}

// GET /api/files/:appId/list?path=/
router.get('/:appId/list', (req, res) => {
  if (!checkAppAccess(req, res)) return;
  try {
    const dir = safePath(req.params.appId, req.query.path || '/');
    if (!fs.existsSync(dir))
      return res.json({ files: [], path: req.query.path || '/' });

    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const files = entries.map(e => {
      let size = 0, modified = new Date().toISOString();
      try {
        const stat = fs.statSync(path.join(dir, e.name));
        size     = e.isFile() ? stat.size : 0;
        modified = stat.mtime.toISOString();
      } catch (_) {}
      return {
        name:     e.name,
        type:     e.isDirectory() ? 'dir' : 'file',
        size,
        modified,
        mime:     e.isFile() ? (mime.lookup(e.name) || 'application/octet-stream') : null,
      };
    }).sort((a, b) => {
      if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    res.json({ files, path: req.query.path || '/' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/files/:appId/read?path=/file.txt
router.get('/:appId/read', (req, res) => {
  if (!checkAppAccess(req, res)) return;
  try {
    const filePath = safePath(req.params.appId, req.query.path);
    if (!fs.existsSync(filePath))
      return res.status(404).json({ error: 'File not found' });
    const stat = fs.statSync(filePath);
    if (stat.size > 5 * 1024 * 1024)
      return res.status(413).json({ error: 'File too large to edit (>5MB)' });
    const content = fs.readFileSync(filePath, 'utf8');
    res.json({ content, path: req.query.path, size: stat.size });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/files/:appId/write
router.post('/:appId/write', (req, res) => {
  if (!checkAppAccess(req, res)) return;
  try {
    const { path: filePath, content } = req.body;
    if (!filePath) return res.status(400).json({ error: 'path required' });
    const full = safePath(req.params.appId, filePath);
    const dir  = path.dirname(full);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(full, content || '', 'utf8');
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/files/:appId/delete?path=/file.txt
router.delete('/:appId/delete', (req, res) => {
  if (!checkAppAccess(req, res)) return;
  try {
    const target = safePath(req.params.appId, req.query.path);
    if (!fs.existsSync(target))
      return res.status(404).json({ error: 'Not found' });
    const stat = fs.statSync(target);
    if (stat.isDirectory()) {
      fs.rmSync(target, { recursive: true, force: true });
    } else {
      fs.unlinkSync(target);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/files/:appId/mkdir
router.post('/:appId/mkdir', (req, res) => {
  if (!checkAppAccess(req, res)) return;
  try {
    const dir = safePath(req.params.appId, req.body.path);
    fs.mkdirSync(dir, { recursive: true });
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/files/:appId/rename
router.post('/:appId/rename', (req, res) => {
  if (!checkAppAccess(req, res)) return;
  try {
    const from = safePath(req.params.appId, req.body.from);
    const to   = safePath(req.params.appId, req.body.to);
    fs.renameSync(from, to);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/files/:appId/upload?path=/
router.post('/:appId/upload', (req, res, next) => {
  if (!checkAppAccess(req, res)) return;
  next();
}, upload.array('files', 50), (req, res) => {
  res.json({ success: true, count: req.files?.length || 0 });
});

// GET /api/files/:appId/download?path=/file.txt
router.get('/:appId/download', (req, res) => {
  if (!checkAppAccess(req, res)) return;
  try {
    const target = safePath(req.params.appId, req.query.path);
    if (!fs.existsSync(target))
      return res.status(404).json({ error: 'Not found' });

    const stat = fs.statSync(target);
    if (stat.isDirectory()) {
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition',
        `attachment; filename="${path.basename(target)}.zip"`);
      const archive = archiver('zip', { zlib: { level: 9 } });
      archive.pipe(res);
      archive.directory(target, path.basename(target));
      archive.finalize();
    } else {
      res.download(target);
    }
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
