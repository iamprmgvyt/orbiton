// ============================================================
// File Manager Routes - Browse, Upload, Download, Edit, Delete
// ============================================================
const express  = require('express');
const multer   = require('multer');
const path     = require('path');
const fs       = require('fs');
const archiver = require('archiver');
const mime     = require('mime-types');
const { db }   = require('../db/database');
const router   = express.Router();

const BOTS_DIR = path.join(__dirname, '..', '..', '..', 'data', 'bots');

// ─── Multer config ───────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    try {
      const dir = safePath(req.params.botId, req.query.path || '/');
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    } catch (e) { cb(e); }
  },
  filename: (req, file, cb) => cb(null, file.originalname),
});
const upload = multer({ storage, limits: { fileSize: 500 * 1024 * 1024 } });

// ─── Helpers ─────────────────────────────────────────────────
function safePath(botId, relativePath = '/') {
  const base = path.join(BOTS_DIR, botId);
  const rel  = relativePath.startsWith('/') ? relativePath : '/' + relativePath;
  const full = path.resolve(base, '.' + rel);
  if (!full.startsWith(base)) throw new Error('Path traversal denied');
  return full;
}

function checkBotAccess(req, res) {
  const bot = db.prepare('SELECT * FROM bots WHERE id = ?').get(req.params.botId);
  if (!bot) { res.status(404).json({ error: 'Bot not found' }); return null; }
  if (req.user.role !== 'admin' && bot.owner_id !== req.user.id) {
    res.status(403).json({ error: 'Access denied' }); return null;
  }
  return bot;
}

// GET /api/files/:botId/list?path=/
router.get('/:botId/list', (req, res) => {
  if (!checkBotAccess(req, res)) return;
  try {
    const dir = safePath(req.params.botId, req.query.path || '/');
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

// GET /api/files/:botId/read?path=/file.txt
router.get('/:botId/read', (req, res) => {
  if (!checkBotAccess(req, res)) return;
  try {
    const filePath = safePath(req.params.botId, req.query.path);
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

// POST /api/files/:botId/write
router.post('/:botId/write', (req, res) => {
  if (!checkBotAccess(req, res)) return;
  try {
    const { path: filePath, content } = req.body;
    if (!filePath) return res.status(400).json({ error: 'path required' });
    const full = safePath(req.params.botId, filePath);
    const dir  = path.dirname(full);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(full, content || '', 'utf8');
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/files/:botId/delete?path=/file.txt
router.delete('/:botId/delete', (req, res) => {
  if (!checkBotAccess(req, res)) return;
  try {
    const target = safePath(req.params.botId, req.query.path);
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

// POST /api/files/:botId/mkdir
router.post('/:botId/mkdir', (req, res) => {
  if (!checkBotAccess(req, res)) return;
  try {
    const dir = safePath(req.params.botId, req.body.path);
    fs.mkdirSync(dir, { recursive: true });
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/files/:botId/rename
router.post('/:botId/rename', (req, res) => {
  if (!checkBotAccess(req, res)) return;
  try {
    const from = safePath(req.params.botId, req.body.from);
    const to   = safePath(req.params.botId, req.body.to);
    fs.renameSync(from, to);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/files/:botId/upload?path=/
router.post('/:botId/upload', (req, res, next) => {
  if (!checkBotAccess(req, res)) return;
  next();
}, upload.array('files', 50), (req, res) => {
  res.json({ success: true, count: req.files?.length || 0 });
});

// GET /api/files/:botId/download?path=/file.txt
router.get('/:botId/download', (req, res) => {
  if (!checkBotAccess(req, res)) return;
  try {
    const target = safePath(req.params.botId, req.query.path);
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
