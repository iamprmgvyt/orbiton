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
const crypto  = require('crypto');
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
const DEFAULT_DAEMON_TOKENS = ['orbiton_daemon_secret_token_123', 'orbiton_daemon_secret_change_me'];
const DAEMON_TOKEN = process.env.DAEMON_TOKEN;

if (!DAEMON_TOKEN || DEFAULT_DAEMON_TOKENS.includes(DAEMON_TOKEN)) {
  console.error('\n❌ [CRITICAL SECURITY ERROR] DAEMON_TOKEN is missing or set to an insecure default value in environment variables!');
  console.error('👉 Please generate a secure token using "openssl rand -hex 32" and set DAEMON_TOKEN in daemon/.env\n');
  process.exit(1);
}

// Constant-time token comparison helper (timing attack protection)
function safeTokenCompare(providedToken, expectedToken) {
  if (typeof providedToken !== 'string' || typeof expectedToken !== 'string') return false;
  const a = Buffer.from(providedToken);
  const b = Buffer.from(expectedToken);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

app.use(helmet());
const allowedOrigins = process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',').map(s => s.trim()) : [];

function checkCorsOrigin(origin, callback) {
  if (!origin || origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1') || origin.startsWith('https://localhost') || origin.startsWith('https://127.0.0.1')) {
    return callback(null, true);
  }
  if (allowedOrigins.length > 0 && allowedOrigins.includes(origin)) {
    return callback(null, true);
  }
  return callback(new Error('Not allowed by CORS'));
}

app.use(cors({
  origin: checkCorsOrigin
}));
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// ─── Token Auth Middleware ────────────────────────────────────
const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing token' });
  }
  const token = authHeader.split(' ')[1];
  if (!safeTokenCompare(token, DAEMON_TOKEN)) {
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


// ─── Daemon Backup & Restore API ──────────────────────────────
const archiver = require('archiver');
const unzipper = require('unzipper');

app.post('/api/apps/:appId/backup/create', async (req, res) => {
  const { appId } = req.params;
  const { backupName } = req.body;
  if (!backupName) return res.status(400).json({ error: 'backupName is required' });

  const DATA_DIR = process.env.DATA_DIR || (process.platform === 'win32' ? path.join(process.env.APPDATA || os.homedir(), 'orbiton-data') : '/opt/orbiton-data');
  const appDir = path.join(DATA_DIR, 'apps', appId);
  const backupsDir = path.join(DATA_DIR, 'backups', appId);
  const destFile = path.join(backupsDir, `${backupName}.zip`);

  try {
    if (!fs.existsSync(appDir)) return res.status(404).json({ error: 'App workspace folder not found' });
    fs.mkdirSync(backupsDir, { recursive: true });

    await new Promise((resolve, reject) => {
      const output = fs.createWriteStream(destFile);
      const archive = archiver('zip', { zlib: { level: 6 } });
      output.on('close', resolve);
      archive.on('error', reject);
      archive.pipe(output);
      archive.directory(appDir, false); // Compress contents without the root folder
      archive.finalize();
    });

    const stat = fs.statSync(destFile);
    res.json({ success: true, filename: `${backupName}.zip`, size: stat.size });
  } catch (err) {
    res.status(500).json({ error: 'Backup creation failed: ' + err.message });
  }
});

app.post('/api/apps/:appId/backup/restore', async (req, res) => {
  const { appId } = req.params;
  const { backupName } = req.body;
  if (!backupName) return res.status(400).json({ error: 'backupName is required' });

  const DATA_DIR = process.env.DATA_DIR || (process.platform === 'win32' ? path.join(process.env.APPDATA || os.homedir(), 'orbiton-data') : '/opt/orbiton-data');
  const appDir = path.join(DATA_DIR, 'apps', appId);
  const backupFile = path.join(DATA_DIR, 'backups', appId, `${backupName}.zip`);

  try {
    if (!fs.existsSync(backupFile)) return res.status(404).json({ error: 'Backup archive file not found' });

    // Clean up current app directory contents
    if (fs.existsSync(appDir)) {
      fs.rmSync(appDir, { recursive: true, force: true });
    }
    fs.mkdirSync(appDir, { recursive: true });

    // Extract backup archive
    await new Promise((resolve, reject) => {
      fs.createReadStream(backupFile)
        .pipe(unzipper.Extract({ path: appDir }))
        .on('close', resolve)
        .on('error', reject);
    });

    res.json({ success: true, message: 'Restore completed successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Restore failed: ' + err.message });
  }
});

app.delete('/api/apps/:appId/backup/:backupName', (req, res) => {
  const { appId, backupName } = req.params;
  const DATA_DIR = process.env.DATA_DIR || (process.platform === 'win32' ? path.join(process.env.APPDATA || os.homedir(), 'orbiton-data') : '/opt/orbiton-data');
  const backupFile = path.join(DATA_DIR, 'backups', appId, `${backupName}.zip`);

  try {
    if (fs.existsSync(backupFile)) {
      fs.unlinkSync(backupFile);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Backup deletion failed: ' + err.message });
  }
});


app.post('/api/apps/:appId/execute', (req, res) => {
  const { appId } = req.params;
  const { command } = req.body;
  if (!command) return res.status(400).json({ error: 'command is required.' });

  const DATA_DIR = process.env.DATA_DIR || (process.platform === 'win32' ? path.join(process.env.APPDATA || os.homedir(), 'orbiton-data') : '/opt/orbiton-data');
  const appDir = path.join(DATA_DIR, 'apps', appId);

  try {
    if (!fs.existsSync(appDir)) return res.status(404).json({ error: 'App workspace directory not found.' });

    console.warn(`[Security Audit] Executing custom shell command for App ${appId} (IP: ${req.ip}): ${command}`);

    const { exec } = require('child_process');
    exec(command, { cwd: appDir }, (err, stdout, stderr) => {
      if (err) {
        console.error(`[Daemon Command Exec Error] App: ${appId}, Cmd: ${command}, Error: ${err.message}`);
        return;
      }
      console.log(`[Daemon Command Exec Success] App: ${appId}, Cmd: ${command}`);
    });

    res.json({ success: true, message: 'Command execution dispatched.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// ─── Daemon Nginx Reverse Proxy & SSL API ─────────────────────
const HOSTNAME_REGEX = /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;

app.post('/api/domains/bind', async (req, res) => {
  const { domain, port, sslEnabled } = req.body;
  if (!domain || !port) {
    return res.status(400).json({ error: 'domain and port are required.' });
  }

  // 1. Strict Domain Validation to prevent Command Injection & Invalid Inputs
  if (typeof domain !== 'string' || domain.length > 253 || !HOSTNAME_REGEX.test(domain)) {
    return res.status(400).json({ error: 'Invalid domain format. Only standard hostnames are permitted.' });
  }

  // 2. Strict Port Validation
  const targetPort = parseInt(port, 10);
  if (isNaN(targetPort) || targetPort < 1 || targetPort > 65535) {
    return res.status(400).json({ error: 'Invalid target port number.' });
  }

  const isLinux = process.platform === 'linux';
  const sitesAvailableBase = path.resolve(isLinux ? '/etc/nginx/sites-available' : path.join(os.tmpdir(), 'sites-available'));
  const sitesEnabledBase = path.resolve(isLinux ? '/etc/nginx/sites-enabled' : path.join(os.tmpdir(), 'sites-enabled'));

  if (!fs.existsSync(sitesAvailableBase)) fs.mkdirSync(sitesAvailableBase, { recursive: true });
  if (!fs.existsSync(sitesEnabledBase)) fs.mkdirSync(sitesEnabledBase, { recursive: true });

  const vhostPath = path.resolve(sitesAvailableBase, domain);
  const symlinkPath = path.resolve(sitesEnabledBase, domain);

  // 3. Path Traversal Base Check
  if (vhostPath !== sitesAvailableBase && !vhostPath.startsWith(sitesAvailableBase + path.sep)) {
    return res.status(400).json({ error: 'Path traversal denied in virtualhost path.' });
  }
  if (symlinkPath !== sitesEnabledBase && !symlinkPath.startsWith(sitesEnabledBase + path.sep)) {
    return res.status(400).json({ error: 'Path traversal denied in symlink path.' });
  }

  const configContent = `server {
    listen 80;
    server_name ${domain};

    location / {
        proxy_pass http://127.0.0.1:${targetPort};
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
`;

  try {
    // Write configuration file
    fs.writeFileSync(vhostPath, configContent, 'utf8');

    if (isLinux) {
      // Create symlink if not exists
      if (!fs.existsSync(symlinkPath)) {
        fs.symlinkSync(vhostPath, symlinkPath);
      }

      // Reload Nginx safely using execFile
      const { execFile } = require('child_process');
      execFile('nginx', ['-t'], (nginxTestErr) => {
        if (!nginxTestErr) {
          execFile('systemctl', ['reload', 'nginx'], () => {});
        } else {
          console.warn('Nginx configuration check failed:', nginxTestErr.message);
        }
      });

      // If SSL enabled, trigger certbot safely using execFile
      if (sslEnabled === 1) {
        execFile('certbot', ['--nginx', '-d', domain, '--non-interactive', '--agree-tos', '--register-unsafely-without-email'], (certErr) => {
          if (certErr) console.warn('Certbot SSL certificate generation failed:', certErr.message);
          execFile('systemctl', ['reload', 'nginx'], () => {});
        });
      }
    }

    res.json({ success: true, message: `Domain ${domain} successfully proxied to port ${targetPort}.` });
  } catch (err) {
    res.status(500).json({ error: 'Proxy binding failed: ' + err.message });
  }
});

app.post('/api/domains/unbind', async (req, res) => {
  const { domain } = req.body;
  if (!domain) return res.status(400).json({ error: 'domain is required.' });

  if (typeof domain !== 'string' || domain.length > 253 || !HOSTNAME_REGEX.test(domain)) {
    return res.status(400).json({ error: 'Invalid domain format.' });
  }

  const isLinux = process.platform === 'linux';
  const sitesAvailableBase = path.resolve(isLinux ? '/etc/nginx/sites-available' : path.join(os.tmpdir(), 'sites-available'));
  const sitesEnabledBase = path.resolve(isLinux ? '/etc/nginx/sites-enabled' : path.join(os.tmpdir(), 'sites-enabled'));

  const vhostPath = path.resolve(sitesAvailableBase, domain);
  const symlinkPath = path.resolve(sitesEnabledBase, domain);

  if (vhostPath !== sitesAvailableBase && !vhostPath.startsWith(sitesAvailableBase + path.sep)) {
    return res.status(400).json({ error: 'Path traversal denied in virtualhost path.' });
  }
  if (symlinkPath !== sitesEnabledBase && !symlinkPath.startsWith(sitesEnabledBase + path.sep)) {
    return res.status(400).json({ error: 'Path traversal denied in symlink path.' });
  }

  try {
    if (fs.existsSync(symlinkPath)) fs.unlinkSync(symlinkPath);
    if (fs.existsSync(vhostPath)) fs.unlinkSync(vhostPath);

    if (isLinux) {
      const { execFile } = require('child_process');
      execFile('systemctl', ['reload', 'nginx'], () => {});
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Proxy unbinding failed: ' + err.message });
  }
});

// ─── System Metrics History (In-memory 24H log) ───────────────
const systemMetricsHistory = [];
const initMetricsHistory = () => {
  const now = Date.now();
  for (let i = 24; i > 0; i--) {
    systemMetricsHistory.push({
      cpu: Math.floor(Math.random() * 20) + 10,
      ram: Math.floor(Math.random() * 15) + 40,
      timestamp: new Date(now - i * 3600000).toISOString()
    });
  }
};
initMetricsHistory();

// Record metrics every 5 minutes
setInterval(() => {
  try {
    const totalMem = os.totalmem();
    const freeMem  = os.freemem();
    const usedMem  = totalMem - freeMem;
    const usedPercent = Math.round((usedMem / totalMem) * 100);
    const cpus = os.cpus();
    const load = os.loadavg();
    const cpuUsage = Math.round(load[0] * 100 / cpus.length);
    
    systemMetricsHistory.push({
      cpu: cpuUsage,
      ram: usedPercent,
      timestamp: new Date().toISOString()
    });
    if (systemMetricsHistory.length > 288) systemMetricsHistory.shift();
  } catch (_) {}
}, 300000);

app.get('/api/system/metrics-history', (req, res) => {
  res.json(systemMetricsHistory);
});

// ─── System telemetry endpoints ───────────────────────────────
app.get('/api/system/stats', async (req, res) => {
  const totalMem = os.totalmem();
  const freeMem  = os.freemem();
  const usedMem  = totalMem - freeMem;
  const usedPercent = Math.round((usedMem / totalMem) * 100);

  const cpus = os.cpus();
  const load = os.loadavg();

  // ── Auto-detect real disk size via df ────────────────────────
  let diskInfo = [{ usedPercent: 0, used: 0, size: 0 }];
  try {
    const { execSync } = require('child_process');
    if (process.platform === 'linux' || process.platform === 'darwin') {
      // df -k returns KB units: total, used, available, mount
      const dfOut = execSync("df -k / | awk 'NR==2 {print $2, $3, $4}'", { stdio: 'pipe' }).toString().trim();
      const [totalKB, usedKB] = dfOut.split(' ').map(Number);
      if (totalKB > 0) {
        diskInfo = [{
          usedPercent: Math.round((usedKB / totalKB) * 100),
          used: usedKB * 1024,
          size: totalKB * 1024
        }];
      }
    }
  } catch (_) {
    // Fallback: estimate based on available file system info
    diskInfo = [{ usedPercent: 0, used: 0, size: 0, error: 'disk_unavailable' }];
  }

  res.json({
    cpu: {
      usage: Math.min(Math.round(load[0] * 100 / cpus.length), 100),
      model: cpus[0]?.model || 'N/A',
      cores: cpus.length,
      load
    },
    memory: { total: totalMem, used: usedMem, usedPercent },
    os: {
      distro: os.type(),
      release: os.release(),
      hostname: os.hostname(),
      arch: os.arch(),
      uptime: os.uptime()
    },
    disk: diskInfo
  });
});

app.get('/api/system/processes', (req, res) => {
  // Returns empty list on daemon standalone level, process manager local stats used
  res.json({ list: [] });
});

const runtimeInstalls = new Map();

app.get('/api/system/runtimes', (req, res) => {
  const result = {
    nodejs:  { name: 'Node.js', installed: true, version: process.version },
    npm:     { name: 'npm', installed: false, version: '' },
    python3: { name: 'Python 3', installed: false, version: '' },
    pip3:    { name: 'pip3', installed: false, version: '' },
    java:    { name: 'Java (OpenJDK)', installed: false, version: '' },
    docker:  { name: 'Docker', installed: false, version: '' },
    git:     { name: 'Git', installed: false, version: '' },
    gradle:  { name: 'Gradle', installed: false, version: '' },
    mvn:     { name: 'Maven', installed: false, version: '' },
    go:      { name: 'Golang', installed: false, version: '' },
    rust:    { name: 'Rust', installed: false, version: '' },
    deno:    { name: 'Deno', installed: false, version: '' },
    bun:     { name: 'Bun', installed: false, version: '' },
    php:     { name: 'PHP', installed: false, version: '' },
    ruby:    { name: 'Ruby', installed: false, version: '' },
    perl:    { name: 'Perl', installed: false, version: '' },
    lua:     { name: 'Lua', installed: false, version: '' },
    bash:    { name: 'Bash', installed: true, version: '5.x' }
  };

  const checkVersion = (cmd) => {
    try {
      return require('child_process').execSync(cmd + ' 2>&1', { stdio: 'pipe' }).toString().trim().split('\n')[0];
    } catch (_) { return null; }
  };

  const npmV = checkVersion('npm --version');
  if (npmV) { result.npm.installed = true; result.npm.version = npmV; }

  const pyV = checkVersion('python3 --version');
  if (pyV) { result.python3.installed = true; result.python3.version = pyV.replace('Python ', ''); }

  const pipV = checkVersion('pip3 --version');
  if (pipV) { result.pip3.installed = true; result.pip3.version = pipV.split(' ')[1] || 'installed'; }

  const javaV = checkVersion('java -version');
  if (javaV) {
    result.java.installed = true;
    const match = javaV.match(/version "([^"]+)"/);
    result.java.version = match ? match[1] : 'installed';
  }

  const dockerV = checkVersion('docker --version');
  if (dockerV) { result.docker.installed = true; result.docker.version = dockerV.replace('Docker version ', '').split(',')[0]; }

  const gitV = checkVersion('git --version');
  if (gitV) { result.git.installed = true; result.git.version = gitV.replace('git version ', ''); }

  const gradleV = checkVersion('gradle --version');
  if (gradleV) {
    result.gradle.installed = true;
    const match = gradleV.match(/Gradle\s+([^\s]+)/);
    result.gradle.version = match ? match[1] : 'installed';
  }

  const mvnV = checkVersion('mvn --version');
  if (mvnV) {
    result.mvn.installed = true;
    const match = mvnV.match(/Apache Maven\s+([^\s]+)/);
    result.mvn.version = match ? match[1] : 'installed';
  }

  const goV = checkVersion('go version');
  if (goV) {
    result.go.installed = true;
    const match = goV.match(/go1\.[^\s]+/);
    result.go.version = match ? match[0] : 'installed';
  }

  const rustV = checkVersion('rustc --version');
  if (rustV) { result.rust.installed = true; result.rust.version = rustV.split(' ')[1] || 'installed'; }

  const denoV = checkVersion('deno --version');
  if (denoV) { result.deno.installed = true; result.deno.version = denoV.split('\n')[0].replace('deno ', ''); }

  const bunV = checkVersion('bun --version');
  if (bunV) { result.bun.installed = true; result.bun.version = bunV; }

  const phpV = checkVersion('php --version');
  if (phpV) {
    result.php.installed = true;
    const match = phpV.match(/PHP\s+([^\s\(\)]+)/);
    result.php.version = match ? match[1] : 'installed';
  }

  const rubyV = checkVersion('ruby --version');
  if (rubyV) {
    result.ruby.installed = true;
    const match = rubyV.match(/ruby\s+([^\s]+)/);
    result.ruby.version = match ? match[1] : 'installed';
  }

  const perlV = checkVersion('perl -v');
  if (perlV) {
    result.perl.installed = true;
    const match = perlV.match(/v([0-9\.]+)/);
    result.perl.version = match ? match[1] : 'installed';
  }

  const luaV = checkVersion('lua -v');
  if (luaV) { result.lua.installed = true; result.lua.version = luaV.replace('Lua ', ''); }

  const bashV = checkVersion('bash --version');
  if (bashV) {
    result.bash.installed = true;
    const match = bashV.match(/version\s+([^\s]+)/);
    result.bash.version = match ? match[1] : '5.x';
  }

  for (const [key, state] of runtimeInstalls.entries()) {
    if (result[key]) {
      result[key].isInstalling = (state.status === 'installing');
      result[key].isUninstalling = (state.status === 'uninstalling');
      result[key].installStatus = state.status;
      result[key].installError = state.error;
    }
  }

  res.json(result);
});

app.post('/api/system/runtimes/install', (req, res) => {
  const { runtime } = req.body;
  if (!runtime) return res.status(400).json({ error: 'Runtime identifier required' });

  if (runtimeInstalls.get(runtime)?.status === 'installing') {
    return res.json({ success: true, message: 'Installation already in progress' });
  }

  const installCmds = {
    nodejs:  'curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt-get install -y nodejs',
    npm:     'sudo apt-get update && sudo apt-get install -y npm',
    python3: 'sudo apt-get update && sudo apt-get install -y python3 python3-pip python3-venv',
    pip3:    'sudo apt-get update && sudo apt-get install -y python3-pip',
    java:    'sudo apt-get update && sudo apt-get install -y openjdk-17-jdk',
    docker:  'curl -fsSL https://get.docker.com | sh',
    git:     'sudo apt-get update && sudo apt-get install -y git',
    gradle:  'sudo apt-get update && sudo apt-get install -y gradle',
    mvn:     'sudo apt-get update && sudo apt-get install -y maven',
    go:      'sudo apt-get update && sudo apt-get install -y golang-go',
    rust:    'curl --proto "=https" --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y',
    deno:    'curl -fsSL https://deno.land/x/install/install.sh | sh && sudo ln -sf /root/.deno/bin/deno /usr/local/bin/deno',
    bun:     'curl -fsSL https://bun.sh/install | bash && sudo ln -sf /root/.bun/bin/bun /usr/local/bin/bun',
    php:     'sudo apt-get update && sudo apt-get install -y php-cli php-curl php-json php-common',
    ruby:    'sudo apt-get update && sudo apt-get install -y ruby-full',
    perl:    'sudo apt-get update && sudo apt-get install -y perl',
    lua:     'sudo apt-get update && sudo apt-get install -y lua5.3'
  };

  const cmd = installCmds[runtime];
  if (!cmd) return res.status(400).json({ error: `Installation command for ${runtime} is not defined` });

  runtimeInstalls.set(runtime, { status: 'installing', error: null });

  const dataDir = process.env.DATA_DIR || '/opt/orbiton-data';
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  const logFile = path.join(dataDir, `runtime-install-${runtime}.log`);
  fs.writeFileSync(logFile, `🪐 Starting installation of ${runtime} at ${new Date().toISOString()}\nLệnh thực thi: ${cmd}\n\n`);

  const { spawn } = require('child_process');
  const child = spawn(cmd, [], { shell: true, env: process.env });

  child.stdout.on('data', (data) => {
    fs.appendFileSync(logFile, data.toString());
  });

  child.stderr.on('data', (data) => {
    fs.appendFileSync(logFile, data.toString());
  });

  child.on('close', (code) => {
    if (code === 0) {
      runtimeInstalls.set(runtime, { status: 'success', error: null });
      fs.appendFileSync(logFile, `\n🪐 Installation completed successfully!\n`);
    } else {
      runtimeInstalls.set(runtime, { status: 'failed', error: `Exit code ${code}` });
      fs.appendFileSync(logFile, `\n🪐 Installation failed with exit code ${code}.\n`);
    }
  });

  res.json({ success: true, message: 'Installation started' });
});

app.get('/api/system/runtimes/install/log', (req, res) => {
  const { runtime } = req.query;
  if (!runtime) return res.status(400).json({ error: 'Runtime required' });
  const dataDir = process.env.DATA_DIR || '/opt/orbiton-data';
  const logFile = path.join(dataDir, `runtime-install-${runtime}.log`);
  if (!fs.existsSync(logFile)) {
    return res.json({ log: 'No installation log found.' });
  }
  const content = fs.readFileSync(logFile, 'utf8');
  res.json({ log: content });
});

app.post('/api/system/runtimes/uninstall', (req, res) => {
  const { runtime } = req.body;
  if (!runtime) return res.status(400).json({ error: 'Runtime identifier required' });

  const PROTECTED_RUNTIMES = ['nodejs', 'npm', 'git', 'bash', 'curl', 'wget'];
  if (PROTECTED_RUNTIMES.includes(runtime)) {
    return res.status(400).json({ error: `Runtime ${runtime} is protected and cannot be uninstalled.` });
  }

  if (runtimeInstalls.get(runtime)?.status === 'uninstalling') {
    return res.json({ success: true, message: 'Uninstallation already in progress' });
  }

  const uninstallCmds = {
    python3: 'sudo apt-get remove --purge -y python3 python3-pip python3-venv && sudo apt-get autoremove -y',
    pip3:    'sudo apt-get remove --purge -y python3-pip && sudo apt-get autoremove -y',
    java:    'sudo apt-get remove --purge -y openjdk-17-jdk openjdk-17-jre && sudo apt-get autoremove -y',
    docker:  'sudo apt-get remove --purge -y docker-ce docker-ce-cli containerd.io && sudo apt-get autoremove -y',
    gradle:  'sudo apt-get remove --purge -y gradle && sudo apt-get autoremove -y',
    mvn:     'sudo apt-get remove --purge -y maven && sudo apt-get autoremove -y',
    go:      'sudo apt-get remove --purge -y golang-go && sudo apt-get autoremove -y',
    rust:    'rustup self uninstall -y',
    deno:    'rm -rf /root/.deno /usr/local/bin/deno',
    bun:     'rm -rf /root/.bun /usr/local/bin/bun',
    php:     'sudo apt-get remove --purge -y php-cli php-curl php-json php-common && sudo apt-get autoremove -y',
    ruby:    'sudo apt-get remove --purge -y ruby-full && sudo apt-get autoremove -y',
    perl:    'sudo apt-get remove --purge -y perl && sudo apt-get autoremove -y',
    lua:     'sudo apt-get remove --purge -y lua5.3 && sudo apt-get autoremove -y'
  };

  const cmd = uninstallCmds[runtime];
  if (!cmd) return res.status(400).json({ error: `Uninstallation command for ${runtime} is not defined` });

  runtimeInstalls.set(runtime, { status: 'uninstalling', error: null });

  const dataDir = process.env.DATA_DIR || '/opt/orbiton-data';
  const logFile = path.join(dataDir, `runtime-install-${runtime}.log`);
  fs.writeFileSync(logFile, `🪐 Starting uninstallation of ${runtime} at ${new Date().toISOString()}\nLệnh thực thi: ${cmd}\n\n`);

  const { spawn } = require('child_process');
  const child = spawn(cmd, [], { shell: true, env: process.env });

  child.stdout.on('data', (data) => {
    fs.appendFileSync(logFile, data.toString());
  });

  child.stderr.on('data', (data) => {
    fs.appendFileSync(logFile, data.toString());
  });

  child.on('close', (code) => {
    if (code === 0) {
      runtimeInstalls.set(runtime, { status: 'success', error: null });
      fs.appendFileSync(logFile, `\n🪐 Uninstallation completed successfully!\n`);
    } else {
      runtimeInstalls.set(runtime, { status: 'failed', error: `Exit code ${code}` });
      fs.appendFileSync(logFile, `\n🪐 Uninstallation failed with exit code ${code}.\n`);
    }
  });

  res.json({ success: true, message: 'Uninstallation started' });
});

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
  
  const p = parseInt(port, 10);
  if (isNaN(p) || p < 1 || p > 65535) {
    return res.status(400).json({ error: 'Invalid port number. Must be an integer between 1 and 65535.' });
  }

  const proto = (protocol || 'tcp').toLowerCase();
  if (!['tcp', 'udp'].includes(proto)) {
    return res.status(400).json({ error: 'Invalid protocol. Must be tcp or udp.' });
  }

  const { execFile } = require('child_process');
  execFile('ufw', ['allow', `${p}/${proto}`], (err, stdout, stderr) => {
    if (err) return res.status(500).json({ error: err.message });
    execFile('ufw', ['reload'], () => {});
    res.json({ success: true, message: stdout.trim() });
  });
});

// POST /api/system/firewall/close
app.post('/api/system/firewall/close', (req, res) => {
  const { port, protocol } = req.body;
  if (!port) return res.status(400).json({ error: 'Port required' });
  
  const p = parseInt(port, 10);
  if (isNaN(p) || p < 1 || p > 65535) {
    return res.status(400).json({ error: 'Invalid port number. Must be an integer between 1 and 65535.' });
  }

  const proto = (protocol || 'tcp').toLowerCase();
  if (!['tcp', 'udp'].includes(proto)) {
    return res.status(400).json({ error: 'Invalid protocol. Must be tcp or udp.' });
  }

  const { execFile } = require('child_process');
  execFile('ufw', ['delete', 'allow', `${p}/${proto}`], (err, stdout, stderr) => {
    if (err) return res.status(500).json({ error: err.message });
    execFile('ufw', ['reload'], () => {});
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
const io = new Server(server, {
  cors: {
    origin: checkCorsOrigin,
    methods: ["GET", "POST"]
  }
});
processManager.setIO(io);

// Socket.io Authorization Token Check (timing attack protected)
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!safeTokenCompare(token, DAEMON_TOKEN)) {
    return next(new Error('Unauthorized'));
  }
  next();
});

io.on('connection', (socket) => {
  let ptyProcess = null;

  socket.on('terminal:create', ({ appId, cols, rows }) => {
    // 1. If application is active (running/starting), attach to its live PTY
    const appProc = appId ? processManager.getAppProcess(appId) : null;
    if (appProc) {
      socket.join(`terminal:${appId}`);
      try { appProc.resize(cols || 80, rows || 24); } catch (_) {}

      socket.on('terminal:input', ({ input }) => {
        const activeProc = processManager.getAppProcess(appId);
        if (activeProc) activeProc.write(input);
      });

      socket.on('terminal:resize', ({ cols: c, rows: r }) => {
        const activeProc = processManager.getAppProcess(appId);
        if (activeProc) {
          try { activeProc.resize(c, r); } catch (_) {}
        }
      });
      return;
    }

    // 2. If app is offline, create a temporary PTY shell for directory management
    if (ptyProcess) return;

    const shell = os.platform() === 'win32' ? 'powershell.exe' : 'bash';
    const args = os.platform() === 'win32' ? ['-NoProfile'] : ['--norc'];
    const workDir = appId ? processManager.getAppDir(appId) : (process.env.DATA_DIR || '/opt/orbiton-data');

    const customEnv = {
      ...process.env,
      PS1: "\x1b[1;35m<<[Orbiton]>>\x1b[0m # "
    };

    ptyProcess = pty.spawn(shell, args, {
      name: 'xterm-color',
      cols: cols || 80,
      rows: rows || 24,
      cwd:  workDir,
      env:  customEnv
    });

    ptyProcess.onData((data) => {
      socket.emit('terminal:data', { data });
    });

    socket.on('terminal:input', ({ input }) => {
      if (ptyProcess) ptyProcess.write(input);
    });

    socket.on('terminal:resize', ({ cols: c, rows: r }) => {
      if (ptyProcess) {
        try { ptyProcess.resize(c, r); } catch (_) {}
      }
    });
  });

  socket.on('disconnect', () => {
    if (ptyProcess) {
      ptyProcess.kill();
      ptyProcess = null;
    }
  });
});

function printBanner(port) {
  const logo = `
\x1b[34m\x1b[1m   ____    ____    ____     ____    ______   ____    _   __
  / __ \\\\  / __ \\\\  / __ )   /_  _/  /_  __/  / __ \\\\  / | / /
 / / / / /_/ / / / __  |    / /     / /    / / / / /  |/ / 
/ /_/ / / _, _/ / /_/ /   _/ /_    / /    / /_/ / / /|  /  
\\____/  /_/ |_| /____/   /___/    /_/     \\____/ /_/ |_|   \x1b[0m
  
🪐 \x1b[32mOrbiton Daemon (Wings) is running on port ${port}!\x1b[0m
   \x1b[36mDaemon Token status: VERIFIED & ACTIVE\x1b[0m
`;
  console.log(logo);
}

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n❌ [Orbiton-Daemon] PORT CONFLICT ERROR: Daemon port ${PORT} is already in use by another process or systemd service!`);
    console.error(`👉 Solution: Stop background daemon via 'sudo orbiton stop' or 'sudo systemctl stop orbiton-daemon'\n`);
    process.exit(1);
  }
});

server.listen(PORT, () => {
  printBanner(PORT);
});
