// ============================================================
// Bot Routes - CRUD + Start/Stop/Restart/Kill/Input
// ============================================================
const express = require('express');
const path    = require('path');
const fs      = require('fs');
const { v4: uuidv4 } = require('uuid');
const router  = express.Router();
const { db }  = require('../db/database');
const pm      = require('../managers/processManager');

// GET /api/bots - List all bots
router.get('/', (req, res) => {
  let bots;
  if (req.user.role === 'admin') {
    bots = db.prepare(`
      SELECT b.*, u.username AS owner_name
      FROM bots b JOIN users u ON b.owner_id = u.id
      ORDER BY b.created_at DESC
    `).all();
  } else {
    bots = db.prepare(`
      SELECT b.*, u.username AS owner_name
      FROM bots b JOIN users u ON b.owner_id = u.id
      WHERE b.owner_id = ?
      ORDER BY b.created_at DESC
    `).all(req.user.id);
  }

  const running = pm.getRunningBots();
  bots = bots.map(b => ({
    ...b,
    env_vars:   JSON.parse(b.env_vars || '{}'),
    liveStatus: running[b.id]?.status || b.status,
    pid:        running[b.id]?.pid    || null,
  }));

  res.json(bots);
});

// POST /api/bots - Create new bot
router.post('/', (req, res) => {
  const { name, description, runtime, start_cmd, env_vars, max_ram, auto_restart } = req.body;

  if (!name || !start_cmd)
    return res.status(400).json({ error: 'name and start_cmd are required' });

  const id = uuidv4();
  const workDir = pm.getBotDir(id);

  db.prepare(`
    INSERT INTO bots (id, name, description, runtime, start_cmd, work_dir,
                      owner_id, env_vars, max_ram, auto_restart)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    name.trim(),
    description || '',
    runtime || 'custom',
    start_cmd.trim(),
    workDir,
    req.user.id,
    JSON.stringify(env_vars || {}),
    max_ram || 512,
    auto_restart ? 1 : 0
  );

  const bot = db.prepare('SELECT * FROM bots WHERE id = ?').get(id);
  res.status(201).json(bot);
});

// GET /api/bots/runtimes/list - MUST be before /:id
router.get('/runtimes/list', (req, res) => {
  res.json(pm.getRuntimes());
});

// GET /api/bots/:id - Get bot details
router.get('/:id', (req, res) => {
  const bot = getAuthorizedBot(req, res);
  if (!bot) return;
  const running = pm.getBotStatus(bot.id);
  res.json({ ...bot, env_vars: JSON.parse(bot.env_vars || '{}'), ...running });
});

// PATCH /api/bots/:id - Update bot
router.patch('/:id', (req, res) => {
  const bot = getAuthorizedBot(req, res);
  if (!bot) return;

  const { name, description, runtime, start_cmd, env_vars, max_ram, auto_restart } = req.body;
  const current = pm.getBotStatus(bot.id);
  if (current.status === 'running')
    return res.status(409).json({ error: 'Stop the bot first before editing' });

  db.prepare(`
    UPDATE bots SET
      name = COALESCE(?, name),
      description = COALESCE(?, description),
      runtime = COALESCE(?, runtime),
      start_cmd = COALESCE(?, start_cmd),
      env_vars = COALESCE(?, env_vars),
      max_ram = COALESCE(?, max_ram),
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
    bot.id
  );

  res.json(db.prepare('SELECT * FROM bots WHERE id = ?').get(bot.id));
});

// DELETE /api/bots/:id
router.delete('/:id', (req, res) => {
  const bot = getAuthorizedBot(req, res);
  if (!bot) return;

  try { pm.stopBot(bot.id); } catch (_) {}

  if (fs.existsSync(bot.work_dir)) {
    fs.rmSync(bot.work_dir, { recursive: true, force: true });
  }

  db.prepare('DELETE FROM bots WHERE id = ?').run(bot.id);
  res.json({ success: true });
});

// ─── Process Control ────────────────────────────────────────

router.post('/:id/start', (req, res) => {
  const bot = getAuthorizedBot(req, res);
  if (!bot) return;
  try {
    const result = pm.startBot(bot.id);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/:id/stop', (req, res) => {
  const bot = getAuthorizedBot(req, res);
  if (!bot) return;
  try {
    pm.stopBot(bot.id);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/:id/restart', async (req, res) => {
  const bot = getAuthorizedBot(req, res);
  if (!bot) return;
  try {
    await pm.restartBot(bot.id);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/:id/kill', (req, res) => {
  const bot = getAuthorizedBot(req, res);
  if (!bot) return;
  try {
    pm.killBot(bot.id);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/bots/:id/input - Send command to bot stdin
router.post('/:id/input', (req, res) => {
  const bot = getAuthorizedBot(req, res);
  if (!bot) return;
  const { input } = req.body;
  if (input === undefined)
    return res.status(400).json({ error: 'input required' });
  try {
    pm.sendInput(bot.id, input);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/bots/:id/logs
router.get('/:id/logs', (req, res) => {
  const bot = getAuthorizedBot(req, res);
  if (!bot) return;
  const lines = parseInt(req.query.lines) || 200;
  res.json({ logs: pm.getLogs(bot.id, lines) });
});

// ─── Auth Helper ─────────────────────────────────────────────
function getAuthorizedBot(req, res) {
  const bot = db.prepare('SELECT * FROM bots WHERE id = ?').get(req.params.id);
  if (!bot) { res.status(404).json({ error: 'Bot not found' }); return null; }
  if (req.user.role !== 'admin' && bot.owner_id !== req.user.id) {
    res.status(403).json({ error: 'Access denied' }); return null;
  }
  return bot;
}

module.exports = router;
