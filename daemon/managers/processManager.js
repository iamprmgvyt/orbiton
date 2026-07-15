// ============================================================
// Orbiton Daemon - Process Manager (Cross-platform)
// Manages application processes locally without database.
// ============================================================
const { exec } = require('child_process');
const path = require('path');
const fs   = require('fs');
const pty  = require('node-pty');

const MAX_LOG_LINES = 500;
const IS_WIN        = process.platform === 'win32';

// In-memory: appId → { process, logs[], status, pid, startedAt, config }
const processes = new Map();
let ioInstance = null;

// Set data directory (normally passed from server.js environment)
const DATA_DIR = process.env.DATA_DIR || '/opt/orbiton-data';
const APPS_DIR = path.join(DATA_DIR, 'apps');

function setIO(io) { ioInstance = io; }

function emit(event, data) {
  if (ioInstance) ioInstance.emit(event, data);
}

const terminalBuffers = new Map();

function emitTerminalData(appId, data) {
  if (!ioInstance) return;
  
  let currentBuffer = terminalBuffers.get(appId) || '';
  currentBuffer += data;
  terminalBuffers.set(appId, currentBuffer);

  const timeoutKey = `timeout:${appId}`;
  if (!terminalBuffers.has(timeoutKey)) {
    const timeout = setTimeout(() => {
      const finalData = terminalBuffers.get(appId);
      terminalBuffers.delete(appId);
      terminalBuffers.delete(timeoutKey);
      if (finalData && ioInstance) {
        ioInstance.to(`terminal:${appId}`).emit('terminal:data', { data: finalData });
      }
    }, 100); // 100ms throttle batch buffer to optimize socket traffic
    terminalBuffers.set(timeoutKey, timeout);
  }
}

function getAppDir(appId) {
  const dir = path.join(APPS_DIR, appId);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function buildStartCommand(runtime, fileOrCmd) {
  const val = fileOrCmd ? fileOrCmd.trim() : '';
  if (!val) return '';
  if (val.includes(' ')) return val; // Already a full command
  
  if (runtime === 'nodejs') {
    if (val.endsWith('.ts')) {
      return `ts-node --esm "${val}"`;
    }
    return `node "${val}"`;
  }
  if (runtime === 'python' || runtime === 'python3') {
    return `python3 "${val}"`;
  }
  if (runtime === 'java') {
    return `java -Dterminal.jline=false -Dterminal.ansi=true -jar "${val}"`;
  }
  if (runtime === 'go' || runtime === 'golang') {
    return `go run "${val}"`;
  }
  return val;
}

function buildInstallCommand(runtime, fileOrCmd) {
  const val = fileOrCmd ? fileOrCmd.trim() : '';
  if (!val) return '';
  if (val.includes(' ')) return val; // Already a full command
  
  if (runtime === 'nodejs') {
    if (val === 'yarn.lock') return 'yarn install';
    if (val === 'pnpm-lock.yaml') return 'pnpm install';
    return 'npm install';
  }
  if (runtime === 'python' || runtime === 'python3') {
    return `pip install -r "${val}" --break-system-packages`;
  }
  return '';
}

// ─── Start App ────────────────────────────────────────────────
function startApp(appId, appConfig) {
  const existing = processes.get(appId);
  if (existing?.status === 'running' || existing?.status === 'starting') {
    throw new Error('Application is already active');
  }

  const workDir = getAppDir(appId);
  if (!fs.existsSync(workDir)) fs.mkdirSync(workDir, { recursive: true });

  let envVars = {};
  if (appConfig.env_vars) {
    envVars = typeof appConfig.env_vars === 'string' 
      ? JSON.parse(appConfig.env_vars || '{}') 
      : appConfig.env_vars;
  }

  const env = {
    ...process.env,
    ...envVars,
    APP_ID:   appId,
    APP_NAME: appConfig.name,
  };

  const installCmd = buildInstallCommand(appConfig.runtime, appConfig.install_cmd);
  const startCmd = buildStartCommand(appConfig.runtime, appConfig.start_cmd);

  // If there is an install command, run it first!
  if (installCmd) {
    updateStatus(appId, 'starting');
    appendLog(appId, `\x1b[36m<<[OrbitonDaemon]>> Step 1/2: Running installation command: ${installCmd}\x1b[0m\n`);

    const installProc = pty.spawn(IS_WIN ? 'powershell.exe' : 'bash', IS_WIN ? ['-NoProfile', '-Command', installCmd] : ['-c', installCmd], {
      name: 'xterm-color',
      cols: 80,
      rows: 24,
      cwd: workDir,
      env
    });

    const entry = {
      pid: installProc.pid,
      status: 'starting',
      logs: [],
      process: installProc,
      startedAt: new Date().toISOString(),
      config: appConfig
    };
    processes.set(appId, entry);

    installProc.onData((data) => {
      appendLog(appId, data.toString());
      emitTerminalData(appId, data.toString());
    });

    installProc.on('exit', (code) => {
      const current = processes.get(appId);
      // Check if it was stopped/killed during installation
      if (!current || current.status === 'stopped' || current.status === 'stopping') return;

      if (code === 0) {
        appendLog(appId, `\x1b[32m<<[OrbitonDaemon]>> Step 2/2: Installation complete! Launching startup command: ${startCmd}\x1b[0m\n`);
        emitTerminalData(appId, `\x1b[32m<<[OrbitonDaemon]>> Step 2/2: Installation complete! Launching startup command: ${startCmd}\x1b[0m\r\n`);
        launchStartupCmd(appId, appConfig, workDir, env);
      } else {
        appendLog(appId, `\x1b[31m<<[OrbitonDaemon Error]>> Installation failed with code ${code}. Startup aborted.\x1b[0m\n`);
        emitTerminalData(appId, `\x1b[31m<<[OrbitonDaemon Error]>> Installation failed with code ${code}. Startup aborted.\x1b[0m\r\n`);
        current.status = 'stopped';
        updateStatus(appId, 'stopped');
      }
    });

    return { pid: installProc.pid };

  } else {
    // No install command, launch startup command directly
    updateStatus(appId, 'starting');
    return launchStartupCmd(appId, appConfig, workDir, env);
  }
}

function launchStartupCmd(appId, appConfig, workDir, env) {
  const startCmd = buildStartCommand(appConfig.runtime, appConfig.start_cmd);
  
  const proc = pty.spawn(IS_WIN ? 'powershell.exe' : 'bash', IS_WIN ? ['-NoProfile', '-Command', startCmd] : ['-c', startCmd], {
    name: 'xterm-color',
    cols: 80,
    rows: 24,
    cwd:  workDir,
    env
  });

  const entry = {
    pid:       proc.pid,
    status:    'running',
    logs:      [],
    process:   proc,
    startedAt: new Date().toISOString(),
    config:    appConfig
  };
  processes.set(appId, entry);
  updateStatus(appId, 'running');

  proc.onData((data) => {
    appendLog(appId, data.toString());
    emitTerminalData(appId, data.toString());
  });

  proc.on('exit', (code) => {
    appendLog(appId, `\x1b[33m<<[OrbitonDaemon]>> Process exited (code ${code})\x1b[0m\n`);
    emitTerminalData(appId, `\x1b[33m<<[OrbitonDaemon]>> Process exited (code ${code})\x1b[0m\r\n`);
    
    if (processes.has(appId)) processes.get(appId).status = 'stopped';
    updateStatus(appId, 'stopped');

    // Auto-restart
    if (appConfig.auto_restart && code !== 0) {
      appendLog(appId, `\x1b[33m<<[OrbitonDaemon]>> Auto-restarting in 5s...\x1b[0m\n`);
      emitTerminalData(appId, `\x1b[33m<<[OrbitonDaemon]>> Auto-restarting in 5s...\x1b[0m\r\n`);
      setTimeout(() => { 
        try { 
          const current = processes.get(appId);
          if (current && current.status !== 'running') {
            startApp(appId, appConfig); 
          }
        } catch (_) {} 
      }, 5000);
    }
  });

  return { pid: proc.pid };
}

// ─── Stop App ─────────────────────────────────────────────────
function stopApp(appId, signal = null) {
  const entry = processes.get(appId);
  if (!entry || (entry.status !== 'running' && entry.status !== 'starting')) {
    throw new Error('Application is not active');
  }

  // Handle docker-compose cleanup down command
  const isDockerCompose = entry.config?.runtime === 'docker-compose' || entry.config?.start_cmd?.includes('docker compose');
  if (isDockerCompose) {
    const workDir = getAppDir(appId);
    exec('docker compose down', { cwd: workDir }, (err, stdout, stderr) => {
      if (err) {
        console.error(`[Daemon Docker Compose Stop Error] App: ${appId}, Error: ${err.message}`);
      } else {
        console.log(`[Daemon Docker Compose Stop Success] App: ${appId}`);
      }
    });
  }

  if (IS_WIN) {
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
async function restartApp(appId, appConfig) {
  const entry = processes.get(appId);
  if (entry?.status === 'running') {
    stopApp(appId);
    await new Promise(r => setTimeout(r, 2000));
  }
  return startApp(appId, appConfig || entry?.config);
}

// ─── Kill (force) ─────────────────────────────────────────────
function killApp(appId) { return stopApp(appId, 'SIGKILL'); }

// ─── Send stdin ───────────────────────────────────────────────
function sendInput(appId, input) {
  const entry = processes.get(appId);
  if (!entry || entry.status !== 'running') throw new Error('Application is not running');
  entry.process.stdin.write(input + '\n');
}

async function runInstallCmd(appId, installCmd) {
  if (!installCmd || !installCmd.trim()) return;
  const dir = getAppDir(appId);
  appendLog(appId, `\x1b[36m<<[OrbitonDaemon]>> Running install command: ${installCmd}\x1b[0m\n`);
  
  return new Promise((resolve) => {
    const proc = spawn(installCmd, [], {
      cwd: dir,
      shell: true,
      env: process.env,
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    proc.stdout.on('data', (data) => appendLog(appId, data.toString()));
    proc.stderr.on('data', (data) => appendLog(appId, `\x1b[31m${data.toString()}\x1b[0m`));
    
    proc.on('close', (code) => {
      if (code === 0) {
        appendLog(appId, `\x1b[32m<<[OrbitonDaemon]>> Install completed successfully!\x1b[0m\n`);
      } else {
        appendLog(appId, `\x1b[31m<<[OrbitonDaemon]>> Install failed with code ${code}\x1b[0m\n`);
      }
      resolve();
    });
    proc.on('error', (err) => {
      appendLog(appId, `\x1b[31m<<[OrbitonDaemon Error]>> Install failed: ${err.message}\x1b[0m\n`);
      resolve();
    });
  });
}

// ─── Import from Git ──────────────────────────────────────────
async function importFromGit(appId, gitUrl, branch = '', installCmd = '') {
  const dir = getAppDir(appId);
  return new Promise((resolve, reject) => {
    const branchFlag = branch ? `-b ${branch}` : '';
    const cmd = `git clone ${branchFlag} "${gitUrl}" .`;
    appendLog(appId, `\x1b[36m<<[OrbitonDaemon]>> Cloning: ${gitUrl}\x1b[0m\n`);

    exec(cmd, { cwd: dir, timeout: 120000 }, (err, stdout, stderr) => {
      if (err) {
        appendLog(appId, `\x1b[31m[Git Error] ${err.message}\x1b[0m\n`);
        return reject(err);
      }
      appendLog(appId, `\x1b[32m<<[OrbitonDaemon]>> Clone complete!\x1b[0m\n`);
      resolve({ success: true });
      if (installCmd) runInstallCmd(appId, installCmd);
    });
  });
}

// ─── Import from ZIP ──────────────────────────────────────────
async function importFromZip(appId, zipPath, installCmd = '') {
  const unzipper = require('unzipper');
  const dir = getAppDir(appId);
  appendLog(appId, `\x1b[36m<<[OrbitonDaemon]>> Extracting ZIP...\x1b[0m\n`);

  await new Promise((resolve, reject) => {
    fs.createReadStream(zipPath)
      .pipe(unzipper.Extract({ path: dir }))
      .on('close', resolve)
      .on('error', reject);
  });

  try { fs.unlinkSync(zipPath); } catch (_) {}

  appendLog(appId, `\x1b[32m<<[OrbitonDaemon]>> ZIP extracted!\x1b[0m\n`);
  if (installCmd) runInstallCmd(appId, installCmd);
  return { success: true };
}

// ─── Pull Docker Image ────────────────────────────────────────
async function pullDockerImage(appId, image) {
  return new Promise((resolve, reject) => {
    appendLog(appId, `\x1b[36m<<[OrbitonDaemon]>> Pulling Docker image: ${image}\x1b[0m\n`);
    exec(`docker pull ${image}`, { timeout: 300000 }, (err, stdout, stderr) => {
      if (err) {
        appendLog(appId, `\x1b[31m[Docker Error] ${err.message}\x1b[0m\n`);
        return reject(err);
      }
      appendLog(appId, `\x1b[32m<<[OrbitonDaemon]>> Image pulled: ${image}\x1b[0m\n`);
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
  
  // Standalone file logs fallback
  const logFile = path.join(getAppDir(appId), 'console.log');
  if (fs.existsSync(logFile)) {
    try {
      const content = fs.readFileSync(logFile, 'utf8');
      const allLines = content.split('\n');
      return allLines.slice(-lines);
    } catch (_) {}
  }
  return [];
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
  
  // Write to console.log in app dir
  try {
    const logFile = path.join(getAppDir(appId), 'console.log');
    fs.appendFileSync(logFile, line);
  } catch (_) {}
}

function updateStatus(appId, status) {
  const entry = processes.get(appId);
  if (entry) entry.status = status;
  emit('app:status', { appId, status });
}

function clearLogs(appId) {
  const entry = processes.get(appId);
  if (entry) {
    entry.logs = [];
  }
  try {
    const logFile = path.join(getAppDir(appId), 'console.log');
    fs.writeFileSync(logFile, '');
  } catch (_) {}
}

function getAppProcess(appId) {
  const entry = processes.get(appId);
  return entry && (entry.status === 'running' || entry.status === 'starting') ? entry.process : null;
}

module.exports = {
  setIO,
  startApp, stopApp, restartApp, killApp, sendInput,
  importFromGit, importFromZip, pullDockerImage,
  getAppStatus, getRunningApps, getLogs, getAppDir,
  stopAll, clearLogs, getAppProcess,
};
