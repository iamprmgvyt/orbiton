// ============================================================
// Orbiton - Process Manager (Cross-platform)
// Manages application processes: Node.js, Python, Java, Docker, etc.
// Works on Windows, macOS, Linux
// ============================================================
const { spawn, exec } = require('child_process');
const path = require('path');
const fs   = require('fs');
const os   = require('os');
const { db, DATA_DIR } = require('../db/database');

const APPS_DIR      = path.join(DATA_DIR, 'apps');
const MAX_LOG_LINES = 500;
const IS_WIN        = process.platform === 'win32';

// In-memory: appId → { process, logs[], status, pid, startedAt }
const processes = new Map();
let   ioInstance = null;

function setIO(io) { ioInstance = io; }

function emit(event, data) {
  if (ioInstance) ioInstance.emit(event, data);
}

// ─── App Directory ────────────────────────────────────────────
function getAppDir(appId) {
  const dir = path.join(APPS_DIR, appId);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

// ─── Runtime Presets ─────────────────────────────────────────
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
};

// ─── App Templates ────────────────────────────────────────────
const TEMPLATES = {
  discord_js: {
    name: 'Discord.js Bot',
    runtime: 'nodejs',
    start_cmd: 'node index.js',
    description: 'Discord bot with Node.js',
    icon: '🤖',
    env_hint: '{"DISCORD_TOKEN": "your-token"}',
    readme: 'npm install discord.js dotenv',
  },
  discord_py: {
    name: 'Discord.py Bot',
    runtime: 'python',
    start_cmd: 'python3 bot.py',
    description: 'Discord bot with Python',
    icon: '🤖',
    env_hint: '{"DISCORD_TOKEN": "your-token"}',
    readme: 'pip3 install discord.py python-dotenv',
  },
  express_api: {
    name: 'Express.js API',
    runtime: 'nodejs',
    start_cmd: 'node server.js',
    description: 'Express.js REST API server',
    icon: '🌐',
    env_hint: '{"PORT": "3000"}',
    readme: 'npm install express',
  },
  fastapi: {
    name: 'FastAPI',
    runtime: 'python',
    start_cmd: 'python3 -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload',
    description: 'FastAPI Python web framework',
    icon: '⚡',
    env_hint: '{}',
    readme: 'pip3 install fastapi uvicorn',
  },
  minecraft: {
    name: 'Minecraft Server',
    runtime: 'java',
    start_cmd: 'java -Xmx2G -Xms512M -jar server.jar nogui',
    description: 'Minecraft Java Edition server',
    icon: '⛏️',
    max_ram: 2048,
    env_hint: '{}',
    readme: 'Download server.jar from minecraft.net',
  },
  spring_boot: {
    name: 'Spring Boot App',
    runtime: 'java',
    start_cmd: 'java -jar app.jar',
    description: 'Spring Boot Java application',
    icon: '🌿',
    env_hint: '{"SERVER_PORT": "8080"}',
    readme: 'mvn package -DskipTests && mv target/*.jar app.jar',
  },
  docker_compose: {
    name: 'Docker Compose',
    runtime: 'docker',
    start_cmd: 'docker compose up',
    description: 'Docker Compose multi-container app',
    icon: '🐳',
    env_hint: '{}',
    readme: 'Create docker-compose.yml in the app directory',
  },
  telegram_bot: {
    name: 'Telegram Bot (Python)',
    runtime: 'python',
    start_cmd: 'python3 bot.py',
    description: 'Telegram bot with python-telegram-bot',
    icon: '✈️',
    env_hint: '{"BOT_TOKEN": "your-bot-token"}',
    readme: 'pip3 install python-telegram-bot',
  },
  nextjs: {
    name: 'Next.js App',
    runtime: 'nodejs',
    start_cmd: 'node .next/standalone/server.js',
    description: 'Next.js production server',
    icon: '▲',
    env_hint: '{"PORT": "3000", "NODE_ENV": "production"}',
    readme: 'npm run build',
  },
  static_server: {
    name: 'Static File Server',
    runtime: 'nodejs',
    start_cmd: 'npx serve . -l 8080',
    description: 'Serve static files (HTML/CSS/JS)',
    icon: '📄',
    env_hint: '{}',
    readme: 'Put your files in the app directory',
  },
};

function getRuntimes()  { return RUNTIMES;  }
function getTemplates() { return TEMPLATES; }

// ─── Start App ────────────────────────────────────────────────
function startApp(appId) {
  const existing = processes.get(appId);
  if (existing?.status === 'running') {
    throw new Error('Application is already running');
  }

  const app = db.prepare('SELECT * FROM apps WHERE id = ?').get(appId);
  if (!app) throw new Error('Application not found');

  const workDir = app.work_dir || getAppDir(appId);
  if (!fs.existsSync(workDir)) fs.mkdirSync(workDir, { recursive: true });

  let envVars = {};
  try { envVars = JSON.parse(app.env_vars || '{}'); } catch (_) {}

  const env = {
    ...process.env,
    ...envVars,
    APP_ID:   appId,
    APP_NAME: app.name,
  };

  // Build command — use shell for cross-platform compatibility
  const cmdStr = app.start_cmd.trim();

  updateStatus(appId, 'starting');

  const proc = spawn(cmdStr, [], {
    cwd:   workDir,
    env,
    shell: true,    // cross-platform: uses cmd.exe on Windows, /bin/sh on Unix
    stdio: ['pipe', 'pipe', 'pipe'],
    windowsHide: true,
  });

  const entry = {
    pid:       proc.pid,
    status:    'running',
    logs:      [],
    process:   proc,
    startedAt: new Date().toISOString(),
  };
  processes.set(appId, entry);
  updateStatus(appId, 'running');

  proc.stdout.on('data', (data) => appendLog(appId, data.toString()));
  proc.stderr.on('data', (data) => appendLog(appId, `\x1b[31m${data.toString()}\x1b[0m`));

  proc.on('close', (code) => {
    appendLog(appId, `\x1b[33m[Orbiton] Process exited (code ${code})\x1b[0m\n`);
    if (processes.has(appId)) processes.get(appId).status = 'stopped';
    updateStatus(appId, 'stopped');

    // Auto-restart
    if (app.auto_restart && code !== 0) {
      appendLog(appId, `\x1b[33m[Orbiton] Auto-restarting in 5s...\x1b[0m\n`);
      setTimeout(() => { try { startApp(appId); } catch (_) {} }, 5000);
    }
  });

  proc.on('error', (err) => {
    appendLog(appId, `\x1b[31m[Orbiton Error] ${err.message}\x1b[0m\n`);
    updateStatus(appId, 'error');
  });

  return { pid: proc.pid };
}

// ─── Stop App ─────────────────────────────────────────────────
function stopApp(appId, signal = null) {
  const entry = processes.get(appId);
  if (!entry || entry.status !== 'running') throw new Error('Application is not running');

  if (IS_WIN) {
    // Windows: use taskkill for force kill, or just proc.kill()
    if (signal === 'SIGKILL') {
      exec(`taskkill /PID ${entry.pid} /T /F`, () => {});
    } else {
      entry.process.kill();
    }
  } else {
    entry.process.kill(signal || 'SIGTERM');
  }

  updateStatus(appId, 'stopping');
}

// ─── Restart ──────────────────────────────────────────────────
async function restartApp(appId) {
  const entry = processes.get(appId);
  if (entry?.status === 'running') {
    stopApp(appId);
    await new Promise(r => setTimeout(r, 2000));
  }
  return startApp(appId);
}

// ─── Kill (force) ─────────────────────────────────────────────
function killApp(appId) { return stopApp(appId, 'SIGKILL'); }

// ─── Send stdin ───────────────────────────────────────────────
function sendInput(appId, input) {
  const entry = processes.get(appId);
  if (!entry?.status === 'running') throw new Error('Application is not running');
  entry.process.stdin.write(input + '\n');
}

// ─── Import from Git ──────────────────────────────────────────
async function importFromGit(appId, gitUrl, branch = '') {
  const dir = getAppDir(appId);
  return new Promise((resolve, reject) => {
    const branchFlag = branch ? `-b ${branch}` : '';
    const cmd = `git clone ${branchFlag} "${gitUrl}" .`;
    appendLog(appId, `\x1b[36m[Orbiton] Cloning: ${gitUrl}\x1b[0m\n`);

    exec(cmd, { cwd: dir, timeout: 120000 }, (err, stdout, stderr) => {
      if (err) {
        appendLog(appId, `\x1b[31m[Git Error] ${err.message}\x1b[0m\n`);
        return reject(err);
      }
      appendLog(appId, `\x1b[32m[Orbiton] Clone complete!\x1b[0m\n`);
      resolve({ success: true });
    });
  });
}

// ─── Import from ZIP ──────────────────────────────────────────
async function importFromZip(appId, zipPath) {
  const unzipper = require('unzipper');
  const dir = getAppDir(appId);
  appendLog(appId, `\x1b[36m[Orbiton] Extracting ZIP...\x1b[0m\n`);

  await fs.createReadStream(zipPath)
    .pipe(unzipper.Extract({ path: dir }))
    .promise();

  // Cleanup the temp zip
  try { fs.unlinkSync(zipPath); } catch (_) {}

  appendLog(appId, `\x1b[32m[Orbiton] ZIP extracted!\x1b[0m\n`);
  return { success: true };
}

// ─── Pull Docker Image ────────────────────────────────────────
async function pullDockerImage(appId, image) {
  return new Promise((resolve, reject) => {
    appendLog(appId, `\x1b[36m[Orbiton] Pulling Docker image: ${image}\x1b[0m\n`);
    exec(`docker pull ${image}`, { timeout: 300000 }, (err, stdout, stderr) => {
      if (err) {
        appendLog(appId, `\x1b[31m[Docker Error] ${err.message}\x1b[0m\n`);
        return reject(err);
      }
      appendLog(appId, `\x1b[32m[Orbiton] Image pulled: ${image}\x1b[0m\n`);
      resolve({ success: true });
    });
  });
}

// ─── Getters ──────────────────────────────────────────────────
function getAppStatus(appId) {
  const entry = processes.get(appId);
  return {
    status:    entry ? entry.status : 'stopped',
    pid:       entry?.pid    || null,
    startedAt: entry?.startedAt || null,
  };
}

function getRunningApps() {
  const result = {};
  for (const [id, e] of processes) {
    result[id] = { status: e.status, pid: e.pid, startedAt: e.startedAt };
  }
  return result;
}

function getLogs(appId, lines = 100) {
  const entry = processes.get(appId);
  if (entry) return entry.logs.slice(-lines);
  const rows = db.prepare(
    'SELECT line FROM app_logs WHERE app_id = ? ORDER BY id DESC LIMIT ?'
  ).all(appId, lines);
  return rows.map(r => r.line).reverse();
}

function stopAll() {
  for (const [appId] of processes) {
    try { stopApp(appId); } catch (_) {}
  }
}

// ─── Internals ────────────────────────────────────────────────
function appendLog(appId, line) {
  const entry = processes.get(appId);
  if (entry) {
    entry.logs.push(line);
    if (entry.logs.length > MAX_LOG_LINES) entry.logs.shift();
  }
  emit('app:log', { appId, line });
  try {
    db.prepare('INSERT INTO app_logs (app_id, line) VALUES (?, ?)').run(appId, line);
    db.prepare(`
      DELETE FROM app_logs WHERE app_id = ? AND id NOT IN (
        SELECT id FROM app_logs WHERE app_id = ? ORDER BY id DESC LIMIT 500
      )
    `).run(appId, appId);
  } catch (_) {}
}

function updateStatus(appId, status) {
  db.prepare('UPDATE apps SET status = ? WHERE id = ?').run(status, appId);
  emit('app:status', { appId, status });
}

module.exports = {
  setIO,
  startApp, stopApp, restartApp, killApp, sendInput,
  importFromGit, importFromZip, pullDockerImage,
  getAppStatus, getRunningApps, getLogs, getAppDir,
  getRuntimes, getTemplates,
  stopAll,
};
