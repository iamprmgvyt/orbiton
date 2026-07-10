// ============================================================
// Orbiton - Terminal Manager (AIO, Cross-platform)
// Uses node-pty for real PTY on all platforms
// Windows: PowerShell/cmd | macOS/Linux: bash/zsh/sh
// ============================================================
const os   = require('os');
const path = require('path');
const fs   = require('fs');
const { DATA_DIR } = require('../db/database');

const IS_WIN = process.platform === 'win32';
const IS_MAC = process.platform === 'darwin';

// Detect best available shell
function getShell() {
  if (IS_WIN) {
    // Prefer PowerShell Core (pwsh), fallback to PowerShell 5, then cmd
    const pwsh = ['pwsh.exe', 'powershell.exe', 'cmd.exe'];
    for (const sh of pwsh) {
      try { require('child_process').execSync(`where ${sh}`, { stdio: 'ignore' }); return sh; }
      catch (_) {}
    }
    return 'cmd.exe';
  }
  // Unix: prefer user shell, then bash, zsh, sh
  const shells = [
    process.env.SHELL,
    '/bin/bash', '/usr/bin/bash',
    '/bin/zsh',  '/usr/bin/zsh',
    '/bin/sh',
  ].filter(Boolean);
  for (const sh of shells) {
    if (fs.existsSync(sh)) return sh;
  }
  return '/bin/sh';
}

const SHELL = getShell();
const APPS_DIR = path.join(DATA_DIR, 'apps');

// node-pty: try to load, fallback to child_process
let pty;
try {
  pty = require('node-pty');
} catch {
  console.warn('⚠  node-pty not available — terminal in fallback mode (no PTY).');
  console.warn('   To enable full PTY: npm install node-pty --build-from-source');
  pty = null;
}

// terminalId → { pty|proc, sockets: Set, appId, cwd, fallback }
const terminals = new Map();

// ─── Setup Socket.IO Handlers ────────────────────────────────
function setupSocketHandlers(io) {
  io.on('connection', (socket) => {
    // Verify JWT
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (!token) { socket.disconnect(true); return; }

    let user;
    try {
      const jwt = require('jsonwebtoken');
      const { JWT_SECRET } = require('../middleware/auth');
      user = jwt.verify(token, JWT_SECRET);
    } catch { socket.disconnect(true); return; }

    socket.user = user;
    let activeTermId = null;

    // ── Create/Attach Terminal ─────────────────────────────
    socket.on('terminal:create', ({ appId, cols = 120, rows = 30 } = {}) => {
      const termId = appId ? `app_${appId}` : `sys_${user.id}`;
      activeTermId = termId;

      // Reuse existing terminal
      if (terminals.has(termId)) {
        const term = terminals.get(termId);
        clearTimeout(term._killTimer);
        term.sockets.add(socket.id);
        socket.join(`term:${termId}`);
        socket.emit('terminal:ready', { termId, shell: SHELL });
        return;
      }

      // Working directory
      let cwd = os.homedir();
      if (appId) {
        cwd = path.join(APPS_DIR, appId);
        if (!fs.existsSync(cwd)) fs.mkdirSync(cwd, { recursive: true });
      }

      socket.join(`term:${termId}`);

      const welcomeMsg = buildWelcome(appId, SHELL, IS_WIN);

      if (pty) {
        // ─ Full PTY mode ─
        const ptyArgs = IS_WIN ? [] : ['--login'];
        const ptyProc = pty.spawn(SHELL, ptyArgs, {
          name: 'xterm-256color',
          cols, rows, cwd,
          env: {
            ...process.env,
            TERM: 'xterm-256color',
            COLORTERM: 'truecolor',
            LANG: 'en_US.UTF-8',
            APP_ID: appId || '',
            ORBITON: '1',
          },
        });

        const entry = { pty: ptyProc, sockets: new Set([socket.id]), appId, cwd };
        terminals.set(termId, entry);

        ptyProc.onData((data) => {
          io.to(`term:${termId}`).emit('terminal:data', { termId, data });
        });
        ptyProc.onExit(() => {
          io.to(`term:${termId}`).emit('terminal:exit', { termId });
          terminals.delete(termId);
        });

        socket.emit('terminal:ready', { termId, shell: SHELL });
        socket.emit('terminal:data',  { termId, data: welcomeMsg });

      } else {
        // ─ Fallback (no PTY) ─
        const { spawn } = require('child_process');
        const proc = spawn(SHELL, [], {
          cwd, env: process.env,
          shell: false, stdio: ['pipe', 'pipe', 'pipe'],
        });

        const entry = { proc, sockets: new Set([socket.id]), appId, cwd, fallback: true };
        terminals.set(termId, entry);

        proc.stdout.on('data', d => io.to(`term:${termId}`).emit('terminal:data', { termId, data: d.toString() }));
        proc.stderr.on('data', d => io.to(`term:${termId}`).emit('terminal:data', { termId, data: d.toString() }));
        proc.on('close', () => { io.to(`term:${termId}`).emit('terminal:exit', { termId }); terminals.delete(termId); });

        socket.emit('terminal:ready', { termId, shell: SHELL, fallback: true });
        socket.emit('terminal:data',  { termId, data: welcomeMsg });
      }
    });

    // ── Input ──────────────────────────────────────────────
    socket.on('terminal:input', ({ termId, input }) => {
      const term = terminals.get(termId);
      if (!term) return;
      if (term.pty)  term.pty.write(input);
      else if (term.proc) term.proc.stdin.write(input);
    });

    // ── Resize ─────────────────────────────────────────────
    socket.on('terminal:resize', ({ termId, cols, rows }) => {
      const term = terminals.get(termId);
      if (term?.pty) term.pty.resize(cols, rows);
    });

    // ── Close ──────────────────────────────────────────────
    socket.on('terminal:close', ({ termId }) => destroyTerminal(termId));

    // ── App Log Subscribe ──────────────────────────────────
    socket.on('app:subscribe', ({ appId }) => {
      socket.join(`app:${appId}`);
      const { getLogs } = require('./processManager');
      socket.emit('app:history', { appId, logs: getLogs(appId, 200) });
    });

    socket.on('app:unsubscribe', ({ appId }) => socket.leave(`app:${appId}`));

    // ── Disconnect ─────────────────────────────────────────
    socket.on('disconnect', () => {
      if (!activeTermId) return;
      const term = terminals.get(activeTermId);
      if (!term) return;
      term.sockets.delete(socket.id);
      if (term.sockets.size === 0) {
        // Kill after 10 min of inactivity
        term._killTimer = setTimeout(() => destroyTerminal(activeTermId), 10 * 60 * 1000);
      }
    });
  });

  // Proxy app:log events to per-app rooms
  const origEmit = io.emit.bind(io);
  io.use((socket, next) => { next(); });
}

function destroyTerminal(termId) {
  const term = terminals.get(termId);
  if (!term) return;
  clearTimeout(term._killTimer);
  try { if (term.pty)  term.pty.kill();  } catch (_) {}
  try { if (term.proc) term.proc.kill(); } catch (_) {}
  terminals.delete(termId);
}

function buildWelcome(appId, shell, isWin) {
  const runtimeHints = isWin
    ? `node  python  java  docker  pwsh  cmd`
    : `node  python3  java  docker  bash  npm  pip3`;
  return (
    `\r\n\x1b[1;35m╔═══════════════════════════════════════════╗\r\n` +
    `║          🌐 Orbiton  AIO  Terminal        ║\r\n` +
    `║  ${(appId ? `App: ${appId.slice(0,8)}...` : 'System Terminal').padEnd(41)}║\r\n` +
    `║  Shell: ${shell.split(/[\\/]/).pop().padEnd(34)}║\r\n` +
    `║  Run any: ${runtimeHints.padEnd(32)}║\r\n` +
    `╚═══════════════════════════════════════════╝\x1b[0m\r\n\r\n`
  );
}

module.exports = { setupSocketHandlers, terminals, getShell };
