// ============================================================
// Orbiton - Application Routes
// CRUD + Start/Stop/Restart/Kill + Import (Git/ZIP/Docker)
// ============================================================
const express  = require('express');
const path     = require('path');
const fs       = require('fs');
const multer   = require('multer');
const { v4: uuidv4 } = require('uuid');
const router   = express.Router();
const { db }   = require('../db/database');
const pm       = require('../managers/processManager');

// ZIP upload for import
const zipUpload = multer({
  dest: require('os').tmpdir(),
  limits: { fileSize: 500 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    cb(null, file.mimetype === 'application/zip' ||
             file.originalname.endsWith('.zip') ||
             file.originalname.endsWith('.tar.gz'));
  },
});

// ─── List All Apps ────────────────────────────────────────────
router.get('/', (req, res) => {
  let apps;
  if (req.user.role === 'admin') {
    apps = db.prepare(`
      SELECT a.*, u.username AS owner_name
      FROM apps a JOIN users u ON a.owner_id = u.id
      ORDER BY a.created_at DESC
    `).all();
  } else {
    apps = db.prepare(`
      SELECT a.*, u.username AS owner_name
      FROM apps a JOIN users u ON a.owner_id = u.id
      WHERE a.owner_id = ?
      ORDER BY a.created_at DESC
    `).all(req.user.id);
  }

  const running = pm.getRunningApps();
  apps = apps.map(a => ({
    ...a,
    env_vars:   JSON.parse(a.env_vars || '{}'),
    liveStatus: running[a.id]?.status || a.status,
    pid:        running[a.id]?.pid    || null,
  }));

  res.json(apps);
});

// ─── Get Templates ────────────────────────────────────────────
router.get('/templates', (req, res) => {
  res.json(pm.getTemplates());
});

// ─── Get Runtime List ─────────────────────────────────────────
router.get('/runtimes', (req, res) => {
  res.json(pm.getRuntimes());
});

// ─── Create App ───────────────────────────────────────────────
router.post('/', (req, res) => {
  const { name, description, runtime, start_cmd, env_vars, max_ram, auto_restart, template } = req.body;

  // Apply template defaults if provided
  let tpl = {};
  if (template && pm.getTemplates()[template]) {
    tpl = pm.getTemplates()[template];
  }

  const finalName    = name?.trim() || tpl.name;
  const finalCmd     = start_cmd?.trim() || tpl.start_cmd;
  const finalRuntime = runtime || tpl.runtime || 'custom';

  if (!finalName || !finalCmd)
    return res.status(400).json({ error: 'name and start_cmd are required' });

  const id      = uuidv4();
  const workDir = pm.getAppDir(id);

  db.prepare(`
    INSERT INTO apps (id, name, description, runtime, start_cmd, work_dir,
                      owner_id, env_vars, max_ram, auto_restart)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    finalName,
    description || tpl.description || '',
    finalRuntime,
    finalCmd,
    workDir,
    req.user.id,
    JSON.stringify(env_vars || {}),
    max_ram || tpl.max_ram || 512,
    auto_restart ? 1 : 0
  );

  const app = db.prepare('SELECT * FROM apps WHERE id = ?').get(id);
  res.status(201).json(app);
});

// ─── Get App ──────────────────────────────────────────────────
router.get('/:id', (req, res) => {
  const app = getAuthorizedApp(req, res);
  if (!app) return;
  const status = pm.getAppStatus(app.id);
  res.json({ ...app, env_vars: JSON.parse(app.env_vars || '{}'), ...status });
});

// ─── Update App ───────────────────────────────────────────────
router.patch('/:id', (req, res) => {
  const app = getAuthorizedApp(req, res);
  if (!app) return;

  const { name, description, runtime, start_cmd, env_vars, max_ram, auto_restart } = req.body;
  const { status } = pm.getAppStatus(app.id);
  if (status === 'running')
    return res.status(409).json({ error: 'Stop the application first before editing' });

  db.prepare(`
    UPDATE apps SET
      name         = COALESCE(?, name),
      description  = COALESCE(?, description),
      runtime      = COALESCE(?, runtime),
      start_cmd    = COALESCE(?, start_cmd),
      env_vars     = COALESCE(?, env_vars),
      max_ram      = COALESCE(?, max_ram),
      auto_restart = COALESCE(?, auto_restart)
    WHERE id = ?
  `).run(
    name || null,
    description !== undefined ? description : null,
    runtime || null,
    start_cmd || null,
    env_vars ? JSON.stringify(env_vars) : null,
    max_ram || null,
    auto_restart !== undefined ? (auto_restart ? 1 : 0) : null,
    app.id
  );

  res.json(db.prepare('SELECT * FROM apps WHERE id = ?').get(app.id));
});

// ─── Delete App ───────────────────────────────────────────────
router.delete('/:id', (req, res) => {
  const app = getAuthorizedApp(req, res);
  if (!app) return;

  try { pm.stopApp(app.id); } catch (_) {}

  if (fs.existsSync(app.work_dir)) {
    fs.rmSync(app.work_dir, { recursive: true, force: true });
  }
  db.prepare('DELETE FROM apps WHERE id = ?').run(app.id);
  res.json({ success: true });
});

// ─── Process Control ──────────────────────────────────────────
router.post('/:id/start', (req, res) => {
  const app = getAuthorizedApp(req, res);
  if (!app) return;
  try   { res.json({ success: true, ...pm.startApp(app.id) }); }
  catch (e) { res.status(400).json({ error: e.message }); }
});

router.post('/:id/stop', (req, res) => {
  const app = getAuthorizedApp(req, res);
  if (!app) return;
  try   { pm.stopApp(app.id); res.json({ success: true }); }
  catch (e) { res.status(400).json({ error: e.message }); }
});

router.post('/:id/restart', async (req, res) => {
  const app = getAuthorizedApp(req, res);
  if (!app) return;
  try   { await pm.restartApp(app.id); res.json({ success: true }); }
  catch (e) { res.status(400).json({ error: e.message }); }
});

router.post('/:id/kill', (req, res) => {
  const app = getAuthorizedApp(req, res);
  if (!app) return;
  try   { pm.killApp(app.id); res.json({ success: true }); }
  catch (e) { res.status(400).json({ error: e.message }); }
});

// ─── Send stdin ───────────────────────────────────────────────
router.post('/:id/input', (req, res) => {
  const app = getAuthorizedApp(req, res);
  if (!app) return;
  const { input } = req.body;
  if (input === undefined) return res.status(400).json({ error: 'input required' });
  try   { pm.sendInput(app.id, input); res.json({ success: true }); }
  catch (e) { res.status(400).json({ error: e.message }); }
});

// ─── Logs ─────────────────────────────────────────────────────
router.get('/:id/logs', (req, res) => {
  const app = getAuthorizedApp(req, res);
  if (!app) return;
  res.json({ logs: pm.getLogs(app.id, parseInt(req.query.lines) || 200) });
});

// ─── Import: Git Clone ────────────────────────────────────────
router.post('/:id/import/git', async (req, res) => {
  const app = getAuthorizedApp(req, res);
  if (!app) return;
  const { url, branch } = req.body;
  if (!url) return res.status(400).json({ error: 'url required' });

  res.json({ success: true, message: 'Git clone started, check logs...' });
  try {
    await pm.importFromGit(app.id, url, branch);
    db.prepare("UPDATE apps SET import_source = ? WHERE id = ?").run(`git:${url}`, app.id);
  } catch (e) {
    console.error('Git import error:', e.message);
  }
});

// ─── Import: ZIP Upload ───────────────────────────────────────
router.post('/:id/import/zip', zipUpload.single('file'), async (req, res) => {
  const app = getAuthorizedApp(req, res);
  if (!app) return;
  if (!req.file) return res.status(400).json({ error: 'ZIP file required' });

  res.json({ success: true, message: 'Extracting ZIP...' });
  try {
    await pm.importFromZip(app.id, req.file.path);
    db.prepare("UPDATE apps SET import_source = ? WHERE id = ?").run('zip', app.id);
  } catch (e) {
    console.error('ZIP import error:', e.message);
  }
});

// ─── Import: Docker Pull ──────────────────────────────────────
router.post('/:id/import/docker', async (req, res) => {
  const app = getAuthorizedApp(req, res);
  if (!app) return;
  const { image } = req.body;
  if (!image) return res.status(400).json({ error: 'image required' });

  res.json({ success: true, message: `Pulling ${image}...` });
  try {
    await pm.pullDockerImage(app.id, image);
    db.prepare("UPDATE apps SET import_source = ?, start_cmd = ? WHERE id = ?")
      .run(`docker:${image}`, `docker run --rm ${image}`, app.id);
  } catch (e) {
    console.error('Docker pull error:', e.message);
  }
});

// ─── Auth Helper ──────────────────────────────────────────────
function getAuthorizedApp(req, res) {
  const app = db.prepare('SELECT * FROM apps WHERE id = ?').get(req.params.id);
  if (!app) { res.status(404).json({ error: 'Application not found' }); return null; }
  if (req.user.role !== 'admin' && app.owner_id !== req.user.id) {
    res.status(403).json({ error: 'Access denied' }); return null;
  }
  return app;
}

module.exports = router;
