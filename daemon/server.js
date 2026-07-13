// ============================================================
// Orbiton Daemon - Main Standalone Server (Wings equivalent)
// Exposes secure WebSockets and API endpoints for VPS nodes.
// ============================================================
require('dotenv').config();
const express = require('express');
const http    = require('http');
const { Server } = require('socket.io');
const cors    = require('cors');
const helmet  = require('helmet');
const os      = require('os');
const fs      = require('fs');
const path    = require('path');
const pty     = require('node-pty');

const processManager = require('./managers/processManager');
const filesRouter    = require('./routes/files');
const multer         = require('multer');

const app = express();
const server = http.createServer(app);
const zipUpload = multer({
  dest: os.tmpdir(),
  limits: { fileSize: 500 * 1024 * 1024 }
});

const PORT = parseInt(process.env.PORT || '9900');
const DAEMON_TOKEN = process.env.DAEMON_TOKEN || 'orbiton_daemon_secret_token_123';

app.use(helmet());
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// ─── Token Auth Middleware ────────────────────────────────────
const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing token' });
  }
  const token = authHeader.split(' ')[1];
  if (token !== DAEMON_TOKEN) {
    return res.status(403).json({ error: 'Forbidden: Invalid daemon token' });
  }
  next();
};

app.use('/api', authMiddleware);
app.use('/api/files', filesRouter);

// ─── Daemon App Daemon Routes ──────────────────────────────────
app.post('/api/apps/:appId/start', (req, res) => {
  try {
    const { appId } = req.params;
    const { appConfig } = req.body;
    if (!appConfig) return res.status(400).json({ error: 'Missing appConfig configuration' });
    const result = processManager.startApp(appId, appConfig);
    res.json(result);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

app.post('/api/apps/:appId/stop', (req, res) => {
  try {
    processManager.stopApp(req.params.appId);
    res.json({ success: true });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

app.post('/api/apps/:appId/restart', (req, res) => {
  try {
    const { appId } = req.params;
    const { appConfig } = req.body;
    processManager.restartApp(appId, appConfig);
    res.json({ success: true });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

app.post('/api/apps/:appId/kill', (req, res) => {
  try {
    processManager.killApp(req.params.appId);
    res.json({ success: true });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

app.get('/api/apps/:appId/logs', (req, res) => {
  try {
    const lines = parseInt(req.query.lines || '100');
    const logs = processManager.getLogs(req.params.appId, lines);
    res.json({ logs });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

app.post('/api/apps/:appId/input', (req, res) => {
  try {
    processManager.sendInput(req.params.appId, req.body.input);
    res.json({ success: true });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

app.get('/api/apps/:appId/status', (req, res) => {
  try {
    res.json(processManager.getAppStatus(req.params.appId));
  } catch (err) { res.status(400).json({ error: err.message }); }
});

app.get('/api/apps/status', (req, res) => {
  try {
    res.json(processManager.getRunningApps());
  } catch (err) { res.status(400).json({ error: err.message }); }
});

app.post('/api/apps/:appId/import/git', async (req, res) => {
  try {
    const { url, branch, installCmd } = req.body;
    processManager.importFromGit(req.params.appId, url, branch, installCmd);
    res.json({ success: true, message: 'Git clone started' });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

app.post('/api/apps/:appId/import/zip', zipUpload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'ZIP file required' });
    const { installCmd } = req.body;
    processManager.importFromZip(req.params.appId, req.file.path, installCmd);
    res.json({ success: true, message: 'Extracting ZIP...' });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

app.post('/api/apps/:appId/import/docker', async (req, res) => {
  try {
    const { image } = req.body;
    processManager.pullDockerImage(req.params.appId, image);
    res.json({ success: true, message: 'Pulling Docker image...' });
  } catch (err) { res.status(400).json({ error: err.message }); }
});


// ─── System telemetry endpoints ───────────────────────────────
app.get('/api/system/stats', async (req, res) => {
  // Standalone CPU/RAM metrics calculation
  const totalMem = os.totalmem();
  const freeMem  = os.freemem();
  const usedMem  = totalMem - freeMem;
  const usedPercent = Math.round((usedMem / totalMem) * 100);

  const cpus = os.cpus();
  const load = os.loadavg();

  res.json({
    cpu: {
      usage: Math.round(load[0] * 100 / cpus.length),
      model: cpus[0]?.model || 'N/A',
      cores: cpus.length,
      load
    },
    memory: {
      total: totalMem,
      used: usedMem,
      usedPercent
    },
    os: {
      distro: os.type(),
      release: os.release(),
      hostname: os.hostname(),
      arch: os.arch(),
      uptime: os.uptime()
    },
    disk: [{ usedPercent: 10, used: 10 * 1024 * 1024 * 1024, size: 100 * 1024 * 1024 * 1024 }] // fallback placeholder
  });
});

app.get('/api/system/processes', (req, res) => {
  // Returns empty list on daemon standalone level, process manager local stats used
  res.json({ list: [] });
});

app.get('/api/system/runtimes', (req, res) => {
  const result = {
    nodejs: { name: 'Node.js', installed: true, version: process.version },
    npm:    { name: 'npm', installed: true, version: '10.x' },
    docker: { name: 'Docker', installed: false, version: '' }
  };
  // detect docker
  const check = execSyncCheck('docker --version');
  if (check) { result.docker.installed = true; result.docker.version = check; }
  res.json(result);
});

function execSyncCheck(cmd) {
  try {
    return require('child_process').execSync(cmd, { stdio: 'pipe' }).toString().trim();
  } catch (_) { return null; }
}

// GET /api/system/firewall - List open ports
app.get('/api/system/firewall', (req, res) => {
  const { exec } = require('child_process');
  exec('ufw status verbose', (err, stdout, stderr) => {
    if (err || stdout.includes('inactive')) {
      return res.json({ active: false, rules: [] });
    }
    
    const lines = stdout.split('\n');
    const rules = [];
    lines.forEach(line => {
      // Example line: "25565/tcp                   ALLOW IN    Anywhere"
      const match = line.trim().match(/^(\d+)\/(\w+)\s+(ALLOW|DENY)\s+IN/i);
      if (match) {
        rules.push({
          port: parseInt(match[1]),
          protocol: match[2].toLowerCase(),
          action: match[3].toLowerCase()
        });
      }
    });
    res.json({ active: true, rules });
  });
});

// POST /api/system/firewall/open
app.post('/api/system/firewall/open', (req, res) => {
  const { port, protocol } = req.body;
  if (!port) return res.status(400).json({ error: 'Port required' });
  const { exec } = require('child_process');
  
  const proto = protocol || 'tcp';
  const cmd = `ufw allow ${port}/${proto}`;
  
  exec(cmd, (err, stdout, stderr) => {
    if (err) return res.status(500).json({ error: err.message });
    exec('ufw reload', () => {});
    res.json({ success: true, message: stdout.trim() });
  });
});

// POST /api/system/firewall/close
app.post('/api/system/firewall/close', (req, res) => {
  const { port, protocol } = req.body;
  if (!port) return res.status(400).json({ error: 'Port required' });
  const { exec } = require('child_process');
  
  const proto = protocol || 'tcp';
  const cmd = `ufw delete allow ${port}/${proto}`;
  
  exec(cmd, (err, stdout, stderr) => {
    if (err) return res.status(500).json({ error: err.message });
    exec('ufw reload', () => {});
    res.json({ success: true, message: stdout.trim() });
  });
});

// POST /api/apps/:appId/logs/clear
app.post('/api/apps/:appId/logs/clear', (req, res) => {
  try {
    processManager.clearLogs(req.params.appId);
    res.json({ success: true });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// ─── Socket.IO WebSockets ─────────────────────────────────────
const io = new Server(server, { cors: { origin: '*' } });
processManager.setIO(io);

// Socket.io Authorization Token Check
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (token !== DAEMON_TOKEN) {
    return next(new Error('Unauthorized'));
  }
  next();
});

io.on('connection', (socket) => {
  let ptyProcess = null;

  socket.on('terminal:create', ({ appId, cols, rows }) => {
    if (ptyProcess) return;

    const shell = os.platform() === 'win32' ? 'powershell.exe' : 'bash';
    const workDir = appId ? processManager.getAppDir(appId) : (process.env.DATA_DIR || '/opt/orbiton-data');

    ptyProcess = pty.spawn(shell, [], {
      name: 'xterm-color',
      cols: cols || 80,
      rows: rows || 24,
      cwd:  workDir,
      env:  process.env
    });

    ptyProcess.onData((data) => {
      socket.emit('terminal:data', { data });
    });

    socket.on('terminal:input', ({ input }) => {
      if (ptyProcess) ptyProcess.write(input);
    });

    socket.on('terminal:resize', ({ cols, rows }) => {
      if (ptyProcess) ptyProcess.resize(cols, rows);
    });
  });

  socket.on('disconnect', () => {
    if (ptyProcess) {
      ptyProcess.kill();
      ptyProcess = null;
    }
  });
});

function printBanner(port, token) {
  const logo = `
\x1b[34m\x1b[1m   ___   ____    ____   _  _____  ___   _   _ 
  / _ \\\\ |  _ \\\\  |  _ \\\\ | ||_   _|/ _ \\\\ | \\\\ | |
 | | | || |_) | | |_) || |  | | | | | ||  \\\\| |
 | |_| ||  _ <  |  _ < | |  | | | |_| || |\\\\  |
  \\\\___/ |_| \\\\_\\ |____/ |_|  |_|  \\\\___/ |_| \\\\_\x1b[0m
  
🪐 \x1b[32mOrbiton Daemon (Wings) is running on port ${port}!\x1b[0m
   \x1b[33mSecure Token: ${token}\x1b[0m
`;
  console.log(logo);
}

server.listen(PORT, () => {
  printBanner(PORT, DAEMON_TOKEN);
});
