// ============================================================
// Orbiton Panel - Application Routes
// central controller dispatching actions to local/remote daemons
// ============================================================
const express  = require('express');
const path     = require('path');
const fs       = require('fs');
const multer   = require('multer');
const { v4: uuidv4 } = require('uuid');
const FormData = require('form-data');
const { db }   = require('../db/database');
const { daemonRequest, DAEMON_URL, DAEMON_TOKEN } = require('../utils/daemonApi');
const { checkPermission } = require('../middleware/permission');
const cache = require('../db/cache');
const userRateLimit = require('../middleware/userRateLimit');

const router = express.Router();

const zipUpload = multer({
  dest: require('os').tmpdir(),
  limits: { fileSize: 500 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    cb(null, file.mimetype === 'application/zip' ||
             file.originalname.endsWith('.zip') ||
             file.originalname.endsWith('.tar.gz'));
  },
});

// Helper for daemon runtimes/templates since they are static config presets
const RUNTIMES = {
  nodejs:  { label: 'Node.js',   icon: '🟩', color: '#43a047', desc: 'npm, yarn, bun' },
  python:  { label: 'Python',    icon: '🐍', color: '#1565c0', desc: 'python3, pip, venv' },
  java:    { label: 'Java',      icon: '☕', color: '#e65100', desc: 'Java 8/11/17/21/22+' },
  docker:  { label: 'Docker',    icon: '🐳', color: '#0277bd', desc: 'Any Docker image' },
  bash:    { label: 'Shell',     icon: '🔧', color: '#6a1b9a', desc: 'bash/sh/zsh/cmd/pwsh' },
  deno:    { label: 'Deno',      icon: '🦕', color: '#00796b', desc: 'Deno runtime' },
  bun:     { label: 'Bun',       icon: '🥟', color: '#f57c00', desc: 'Bun runtime' },
  go:      { label: 'Go',        icon: '🔵', color: '#0097a7', desc: 'Go runtime' },
  rust:    { label: 'Rust',      icon: '🦀', color: '#b71c1c', desc: 'Cargo, Rust' },
  php:     { label: 'PHP',       icon: '🐘', color: '#7b1fa2', desc: 'PHP, Laravel, Composer' },
  ruby:    { label: 'Ruby',      icon: '💎', color: '#c62828', desc: 'Ruby, Rails, Gem' },
  custom:  { label: 'Custom',    icon: '⚙️', color: '#37474f', desc: 'Any custom command' },
  'docker-compose': { label: 'Docker Compose', icon: '🐳', color: '#0288d1', desc: 'docker-compose.yml projects' }
};

const TEMPLATES = {
  docker_compose: {
    name: 'Docker Compose Project',
    runtime: 'docker-compose',
    start_cmd: 'docker compose up',
    install_cmd: '',
    description: 'Deploy multi-container services with docker-compose.yml config file',
    icon: '🐳',
    env_hint: '{}',
    readme: 'Place your docker-compose.yml file in the workspace directory. Orbiton will execute docker compose up -d to manage the stack.'
  },
  nodejs_generic: {
    name: 'Node.js Generic (Ptero-style)',
    runtime: 'nodejs',
    start_cmd: 'if [ -d .git ] && [ "$AUTO_UPDATE" = "1" ]; then git pull; fi; if [ -f package.json ]; then npm install; fi; node $MAIN_FILE $NODE_ARGS',
    install_cmd: 'npm install',
    description: 'Generic Node.js app with auto dependency install and git sync support',
    icon: '🟩',
    env_hint: '{"MAIN_FILE": "index.js", "NODE_ARGS": "", "AUTO_UPDATE": "0"}',
    readme: 'Automatically runs npm install if package.json exists. Set AUTO_UPDATE=1 to pull from git on startup.',
  },
  python_generic: {
    name: 'Python Generic (Ptero-style)',
    runtime: 'python',
    start_cmd: 'if [ -d .git ] && [ "$AUTO_UPDATE" = "1" ]; then git pull; fi; if [ -f requirements.txt ]; then pip install -r requirements.txt; fi; python3 $PY_FILE',
    install_cmd: 'pip install -r requirements.txt',
    description: 'Generic Python app with automatic requirements installer and git sync',
    icon: '🐍',
    env_hint: '{"PY_FILE": "app.py", "AUTO_UPDATE": "0"}',
    readme: 'Automatically runs pip install if requirements.txt exists. Set AUTO_UPDATE=1 to pull from git on startup.',
  },
  java_generic: {
    name: 'Java Generic (Ptero-style)',
    runtime: 'java',
    start_cmd: 'java -Dterminal.jline=false -Dterminal.ansi=true -jar $JARFILE',
    install_cmd: '',
    description: 'Generic Java container environment for execution jars',
    icon: '☕',
    env_hint: '{"JARFILE": "server.jar"}',
    readme: 'Specify your executable jar file name in JARFILE variable.',
  },
  discord_js: {
    name: 'Discord.js Bot',
    runtime: 'nodejs',
    start_cmd: 'node index.js',
    install_cmd: 'npm install discord.js dotenv',
    description: 'Discord bot with Node.js',
    icon: '🤖',
    env_hint: '{"DISCORD_TOKEN": "your-token"}',
    readme: 'npm install discord.js dotenv',
  },
  discord_py: {
    name: 'Discord.py Bot',
    runtime: 'python',
    start_cmd: 'python3 bot.py',
    install_cmd: 'pip3 install discord.py python-dotenv',
    description: 'Discord bot with Python',
    icon: '🤖',
    env_hint: '{"DISCORD_TOKEN": "your-token"}',
    readme: 'pip3 install discord.py python-dotenv',
  },
  express_api: {
    name: 'Express.js API',
    runtime: 'nodejs',
    start_cmd: 'node server.js',
    install_cmd: 'npm install express',
    description: 'Express.js REST API server',
    icon: '🌐',
    env_hint: '{"PORT": "3000"}',
    readme: 'npm install express',
  },
  fastapi: {
    name: 'FastAPI',
    runtime: 'python',
    start_cmd: 'python3 -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload',
    install_cmd: 'pip3 install fastapi uvicorn',
    description: 'FastAPI Python web framework',
    icon: '⚡',
    env_hint: '{}',
    readme: 'pip3 install fastapi uvicorn',
  },
  minecraft: {
    name: 'Minecraft Server',
    runtime: 'java',
    start_cmd: 'java -Xmx2G -Xms512M -jar server.jar nogui',
    install_cmd: '',
    description: 'Minecraft Java Edition server',
    icon: '⛏️',
    max_ram: 2048,
    env_hint: '{}',
    readme: 'Download server.jar from minecraft.net',
  },
};

// ─── List All Apps ────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const cacheKey = `apps:list:${req.user.id}:${req.user.role}`;
    const cachedData = await cache.get(cacheKey);
    if (cachedData) {
      return res.json(cachedData);
    }

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
        WHERE a.owner_id = ? OR a.id IN (SELECT app_id FROM permissions WHERE user_id = ?)
        ORDER BY a.created_at DESC
      `).all(req.user.id, req.user.id);
    }

    // Batch daemon status request per node
    const nodesWithApps = [...new Set(apps.map(a => a.node_id || 1))];
    const statusMap = {};

    await Promise.all(nodesWithApps.map(async (nid) => {
      try {
        const running = await daemonRequest('/api/apps/status', 'GET', null, nid);
        Object.assign(statusMap, running);
      } catch (_) {}
    }));

    apps = apps.map(a => {
      let permissions = { can_power: 1, can_files: 1, can_console: 1 };
      if (req.user.role !== 'admin' && a.owner_id !== req.user.id) {
        const dbPerm = db.prepare('SELECT can_power, can_files, can_console FROM permissions WHERE user_id = ? AND app_id = ?').get(req.user.id, a.id);
        permissions = dbPerm ? {
          can_power: dbPerm.can_power,
          can_files: dbPerm.can_files,
          can_console: dbPerm.can_console
        } : { can_power: 0, can_files: 0, can_console: 0 };
      }

      return {
        ...a,
        permissions,
        env_vars:   JSON.parse(a.env_vars || '{}'),
        liveStatus: statusMap[a.id]?.status || a.status,
        pid:        statusMap[a.id]?.pid    || null,
      };
    });

    // Cache the resolved app list for 3 seconds to throttle heavy concurrent users
    await cache.set(cacheKey, apps, 3);
    res.json(apps);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── Get Templates ────────────────────────────────────────────
router.get('/templates', (req, res) => {
  res.json(TEMPLATES);
});

// ─── Get Runtime List ─────────────────────────────────────────
router.get('/runtimes', async (req, res) => {
  try {
    const data = await daemonRequest('/api/system/runtimes');
    res.json(data);
  } catch (_) {
    res.json(RUNTIMES);
  }
});

// ─── Create App ───────────────────────────────────────────────
router.post('/', (req, res) => {
  const { name, description, runtime, start_cmd, install_cmd, env_vars, max_ram, auto_restart, template, node_id } = req.body;

  let tpl = {};
  if (template && TEMPLATES[template]) {
    tpl = TEMPLATES[template];
  }

  const finalName    = name?.trim() || tpl.name;
  const finalCmd     = start_cmd?.trim() || tpl.start_cmd;
  const finalInstall = install_cmd !== undefined ? install_cmd.trim() : (tpl.install_cmd || '');
  const finalRuntime = runtime || tpl.runtime || 'custom';
  const finalNodeId  = parseInt(node_id) || 1;

  if (!finalName || !finalCmd)
    return res.status(400).json({ error: 'name and start_cmd are required' });

  const id      = uuidv4();
  const workDir = `/opt/orbiton-data/apps/${id}`;

  db.prepare(`
    INSERT INTO apps (id, name, description, runtime, start_cmd, install_cmd, work_dir,
                      owner_id, env_vars, max_ram, auto_restart, node_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    finalName,
    description || tpl.description || '',
    finalRuntime,
    finalCmd,
    finalInstall,
    workDir,
    req.user.id,
    JSON.stringify(env_vars || {}),
    max_ram || tpl.max_ram || 512,
    auto_restart ? 1 : 0,
    finalNodeId
  );

  const app = db.prepare('SELECT * FROM apps WHERE id = ?').get(id);
  cache.flush().catch(() => {});
  res.status(201).json(app);
});

// ─── Get App ──────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  const app = getAuthorizedApp(req, res);
  if (!app) return;

  const cacheKey = `app:detail:${app.id}:${req.user.id}`;
  const cachedData = await cache.get(cacheKey);
  if (cachedData) {
    return res.json(cachedData);
  }

  const status = await daemonRequest(`/api/apps/${app.id}/status`, 'GET', null, app.node_id).catch(() => ({ status: 'stopped', pid: null }));
  
  let permissions = { can_power: 1, can_files: 1, can_console: 1 };
  if (req.user.role !== 'admin' && app.owner_id !== req.user.id) {
    const dbPerm = db.prepare('SELECT can_power, can_files, can_console FROM permissions WHERE user_id = ? AND app_id = ?').get(req.user.id, app.id);
    permissions = dbPerm ? {
      can_power: dbPerm.can_power,
      can_files: dbPerm.can_files,
      can_console: dbPerm.can_console
    } : { can_power: 0, can_files: 0, can_console: 0 };
  }

  const appData = { 
    ...app, 
    env_vars: JSON.parse(app.env_vars || '{}'), 
    permissions,
    ...status 
  };

  // Cache single app detail for 2 seconds to throttle heavy websocket requests
  await cache.set(cacheKey, appData, 2);
  res.json(appData);
});

// ─── Update App ───────────────────────────────────────────────
router.patch('/:id', async (req, res) => {
  const app = getAuthorizedApp(req, res);
  if (!app) return;

  const { name, description, runtime, start_cmd, install_cmd, env_vars, max_ram, auto_restart } = req.body;
  const statusInfo = await daemonRequest(`/api/apps/${app.id}/status`, 'GET', null, app.node_id).catch(() => ({ status: 'stopped' }));
  if (statusInfo.status === 'running')
    return res.status(409).json({ error: 'Stop the application first before editing' });

  // Runtime environment is immutable after server creation
  if (runtime !== undefined && runtime !== app.runtime) {
    return res.status(400).json({ error: 'Runtime environment (Server Type) cannot be modified after server creation. Please delete and recreate the server instead.' });
  }

  // Security Check: Role enforcement for non-admin users
  if (req.user.role !== 'admin') {
    if (
      (name !== undefined && name !== app.name) ||
      (max_ram !== undefined && parseInt(max_ram) !== app.max_ram) ||
      (auto_restart !== undefined && (auto_restart ? 1 : 0) !== app.auto_restart)
    ) {
      return res.status(403).json({ error: 'Forbidden: Only administrators can modify server name, RAM allocation, or auto-restart settings.' });
    }
  }

  db.prepare(`
    UPDATE apps SET
      name         = COALESCE(?, name),
      description  = COALESCE(?, description),
      start_cmd    = COALESCE(?, start_cmd),
      install_cmd  = COALESCE(?, install_cmd),
      env_vars     = COALESCE(?, env_vars),
      max_ram      = COALESCE(?, max_ram),
      auto_restart = COALESCE(?, auto_restart)
    WHERE id = ?
  `).run(
    name || null,
    description !== undefined ? description : null,
    start_cmd || null,
    install_cmd !== undefined ? install_cmd : null,
    env_vars ? JSON.stringify(env_vars) : null,
    max_ram || null,
    auto_restart !== undefined ? (auto_restart ? 1 : 0) : null,
    app.id
  );

  cache.flush().catch(() => {});
  res.json(db.prepare('SELECT * FROM apps WHERE id = ?').get(app.id));
});

// ─── Delete App ───────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  const app = getAuthorizedApp(req, res);
  if (!app) return;

  try { await daemonRequest(`/api/apps/${app.id}/stop`, 'POST', null, app.node_id); } catch (_) {}
  try { await daemonRequest(`/api/files/${app.id}/delete?path=/`, 'DELETE', null, app.node_id); } catch (_) {}
  
  db.prepare('DELETE FROM apps WHERE id = ?').run(app.id);
  cache.flush().catch(() => {});
  res.json({ success: true });
});

// ─── Process Control ──────────────────────────────────────────
router.post('/:id/start', checkPermission('power'), userRateLimit.power, async (req, res) => {
  const app = getAuthorizedApp(req, res);
  if (!app) return;
  try {
    const appConfig = { ...app, env_vars: JSON.parse(app.env_vars || '{}') };
    const result = await daemonRequest(`/api/apps/${app.id}/start`, 'POST', { appConfig }, app.node_id);
    cache.flush().catch(() => {});
    res.json({ success: true, ...result });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.post('/:id/stop', checkPermission('power'), userRateLimit.power, async (req, res) => {
  const app = getAuthorizedApp(req, res);
  if (!app) return;
  try {
    await daemonRequest(`/api/apps/${app.id}/stop`, 'POST', null, app.node_id);
    cache.flush().catch(() => {});
    res.json({ success: true });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.post('/:id/restart', checkPermission('power'), userRateLimit.power, async (req, res) => {
  const app = getAuthorizedApp(req, res);
  if (!app) return;
  try {
    const appConfig = { ...app, env_vars: JSON.parse(app.env_vars || '{}') };
    await daemonRequest(`/api/apps/${app.id}/restart`, 'POST', { appConfig }, app.node_id);
    cache.flush().catch(() => {});
    res.json({ success: true });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.post('/:id/kill', checkPermission('power'), userRateLimit.power, async (req, res) => {
  const app = getAuthorizedApp(req, res);
  if (!app) return;
  try {
    await daemonRequest(`/api/apps/${app.id}/kill`, 'POST', null, app.node_id);
    cache.flush().catch(() => {});
    res.json({ success: true });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// ─── Send stdin ───────────────────────────────────────────────
router.post('/:id/input', checkPermission('console'), async (req, res) => {
  const app = getAuthorizedApp(req, res);
  if (!app) return;
  const { input } = req.body;
  if (input === undefined) return res.status(400).json({ error: 'input required' });
  try {
    await daemonRequest(`/api/apps/${app.id}/input`, 'POST', { input }, app.node_id);
    res.json({ success: true });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// ─── Logs ─────────────────────────────────────────────────────
router.get('/:id/logs', checkPermission('console'), async (req, res) => {
  const app = getAuthorizedApp(req, res);
  if (!app) return;
  try {
    const data = await daemonRequest(`/api/apps/${app.id}/logs?lines=${req.query.lines || 200}`, 'GET', null, app.node_id);
    res.json(data);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.post('/:id/logs/clear', checkPermission('console'), async (req, res) => {
  const app = getAuthorizedApp(req, res);
  if (!app) return;
  try {
    await daemonRequest(`/api/apps/${app.id}/logs/clear`, 'POST', null, app.node_id);
    res.json({ success: true });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// ─── Import: Git Clone ────────────────────────────────────────
router.post('/:id/import/git', async (req, res) => {
  const app = getAuthorizedApp(req, res);
  if (!app) return;
  const { url, branch } = req.body;
  if (!url) return res.status(400).json({ error: 'url required' });

  try {
    await daemonRequest(`/api/apps/${app.id}/import/git`, 'POST', { url, branch, installCmd: app.install_cmd }, app.node_id);
    db.prepare("UPDATE apps SET import_source = ? WHERE id = ?").run(`git:${url}`, app.id);
    res.json({ success: true, message: 'Git clone started' });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// ─── Import: ZIP Upload ───────────────────────────────────────
router.post('/:id/import/zip', zipUpload.single('file'), async (req, res) => {
  const app = getAuthorizedApp(req, res);
  if (!app) return;
  if (!req.file) return res.status(400).json({ error: 'ZIP file required' });

  try {
    const fd = new globalThis.FormData();
    const fileBuffer = fs.readFileSync(req.file.path);
    const fileBlob = new globalThis.Blob([fileBuffer]);
    fd.append('file', fileBlob, req.file.originalname);
    fd.append('installCmd', app.install_cmd || '');
    
    // Clean temp local file asynchronously
    fs.unlink(req.file.path, () => {});

    // Resolve node configuration dynamic
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
    const resDaemon = await fetch(`${targetUrl}/api/apps/${app.id}/import/zip`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${targetToken}`
      },
      body: fd
    });
    const data = await resDaemon.json();
    if (!resDaemon.ok) throw new Error(data.error || 'Failed proxying zip');

    db.prepare("UPDATE apps SET import_source = ? WHERE id = ?").run('zip', app.id);
    res.json({ success: true, message: 'Extracting ZIP...' });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// ─── Import: Docker Pull ──────────────────────────────────────
router.post('/:id/import/docker', async (req, res) => {
  const app = getAuthorizedApp(req, res);
  if (!app) return;
  const { image } = req.body;
  if (!image) return res.status(400).json({ error: 'image required' });

  try {
    await daemonRequest(`/api/apps/${app.id}/import/docker`, 'POST', { image }, app.node_id);
    db.prepare("UPDATE apps SET import_source = ?, start_cmd = ? WHERE id = ?")
      .run(`docker:${image}`, `docker run --rm ${image}`, app.id);
    res.json({ success: true, message: `Pulling ${image}...` });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// ─── Auth Helper ──────────────────────────────────────────────
function getAuthorizedApp(req, res) {
  const app = db.prepare('SELECT * FROM apps WHERE id = ?').get(req.params.id);
  if (!app) { res.status(404).json({ error: 'Application not found' }); return null; }
  if (req.user.role === 'admin' || app.owner_id === req.user.id) {
    return app;
  }

  // Check sub-user permission table
  try {
    const hasPerm = db.prepare('SELECT 1 FROM permissions WHERE user_id = ? AND app_id = ?').get(req.user.id, app.id);
    if (hasPerm) {
      return app;
    }
  } catch (_) {}

  res.status(403).json({ error: 'Access denied' });
  return null;
}

// GET /api/apps/:id/logs-history - Fetch historical console logs
router.get('/:id/logs-history', async (req, res) => {
  const app = getAuthorizedApp(req, res);
  if (!app) return;
  try {
    // Fetch logs history directly from the daemon hosting this app (reads console.log 24/7)
    const data = await daemonRequest(`/api/apps/${app.id}/logs?lines=200`, 'GET', null, app.node_id);
    
    // Map array of log lines to match frontend format [{ line: "...", timestamp: "..." }]
    const logs = (data.logs || []).map(line => ({
      line,
      timestamp: new Date().toISOString()
    }));
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/apps/:id/logs/clear - Clear daemon log file
router.post('/:id/logs/clear', async (req, res) => {
  const app = getAuthorizedApp(req, res);
  if (!app) return;
  try {
    await daemonRequest(`/api/apps/${app.id}/logs/clear`, 'POST', null, app.node_id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
