#!/usr/bin/env node
// ======================================================================================
// Orbiton Global Node.js CLI Tool
// Cross-platform command-line manager for Orbiton Panel & Daemon Node
// Created by iamprmgvyt
// ======================================================================================
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  cyan: '\x1b[36m'
};

const PANEL_DIR = '/opt/orbiton-panel';
const DAEMON_DIR = '/opt/orbiton-daemon';

function getModule(name) {
  try {
    return require(name);
  } catch (_) {
    try {
      const panelPath = path.join(PANEL_DIR, 'node_modules', name);
      if (fs.existsSync(panelPath)) return require(panelPath);
    } catch (_) {}
    try {
      const localPath = path.join(__dirname, 'panel', 'node_modules', name);
      if (fs.existsSync(localPath)) return require(localPath);
    } catch (_) {}
    throw new Error(`Required module '${name}' is not installed.`);
  }
}

function showHelp() {
  console.log(`\n${colors.cyan}${colors.bright}🪐 Orbiton System CLI Manager (v1.35.0)${colors.reset}`);
  console.log(`Usage: ${colors.green}sudo orbiton <command|flag> [args]${colors.reset}\n`);
  console.log(`${colors.bright}Commands & Short Flags:${colors.reset}`);
  
  const items = [
    ['start',          '-s, --start',        'Start Panel & Daemon services'],
    ['stop',           '-p, --stop',         'Stop Panel & Daemon services'],
    ['restart',        '-r, --restart',      'Restart Panel & Daemon services'],
    ['status',         '-st, --status',      'Show systemd service status'],
    ['logs',           '-l, --logs',         'Stream live system output logs'],
    ['update',         '-u, --update',       'Pull latest code from GitHub'],
    ['apps',           '-a, --apps',         'List all configured applications'],
    ['sysinfo',        '-i, --sysinfo',      'Display VPS hardware info'],
    ['ports',          '-po, --ports',       'List listening network ports'],
    ['create-admin',   '-ca, --create-admin', 'Create a new Admin account'],
    ['reset-password', '-rp, --reset-pass',  'Reset user account password'],
    ['fail2ban',       '-f, --fail2ban',     'Configure Fail2ban DDoS shield'],
    ['version',        '-v, --version',      'Show installed version info'],
    ['help',           '-h, -h, --help',     'Display this help menu']
  ];

  items.forEach(([cmd, flag, desc]) => {
    const col1 = cmd.padEnd(15, ' ');
    const col2 = flag.padEnd(20, ' ');
    console.log(`  ${colors.green}${col1}${colors.reset} ${colors.yellow}${col2}${colors.reset} ${desc}`);
  });

  console.log(`\n${colors.bright}Examples:${colors.reset}`);
  console.log(`  ${colors.cyan}sudo orbiton start${colors.reset}`);
  console.log(`  ${colors.cyan}sudo orbiton -i${colors.reset}`);
  console.log(`  ${colors.cyan}sudo orbiton create-admin admin mypassword${colors.reset}\n`);
  console.log(`Created by ${colors.yellow}iamprmgvyt${colors.reset}\n`);
}

function runCmd(cmd, options = {}) {
  try {
    execSync(cmd, { stdio: 'inherit', ...options });
    return true;
  } catch (err) {
    return false;
  }
}

const args = process.argv.slice(2);
let rawCommand = args[0] ? args[0].toLowerCase() : 'help';

// Normalize flags & short aliases
const aliasMap = {
  '-s': 'start', '--start': 'start',
  '-p': 'stop', '--stop': 'stop',
  '-r': 'restart', '--restart': 'restart',
  '-st': 'status', '--status': 'status',
  '-l': 'logs', '--logs': 'logs',
  '-u': 'update', '--update': 'update',
  '-a': 'apps', '--apps': 'apps',
  '-i': 'sysinfo', '--sysinfo': 'sysinfo',
  '-po': 'ports', '--ports': 'ports',
  '-ca': 'create-admin', '--create-admin': 'create-admin',
  '-rp': 'reset-password', '--reset-password': 'reset-password',
  '-f': 'fail2ban', '--fail2ban': 'fail2ban',
  '-v': 'version', '--version': 'version',
  '-h': 'help', '--h': 'help', '--help': 'help'
};

const command = aliasMap[rawCommand] || rawCommand;

// Check root requirement on Linux/macOS
if (process.platform !== 'win32' && process.getuid && process.getuid() !== 0) {
  console.log(`${colors.red}❌ Please run with root privileges: sudo orbiton ${command}${colors.reset}`);
  process.exit(1);
}

function getDatabase() {
  const dataDir = process.env.DATA_DIR || (process.platform === 'win32'
    ? path.join(process.env.APPDATA || os.homedir(), 'orbiton-data')
    : '/opt/orbiton-data');
  const dbPath = path.join(dataDir, 'orbiton.db');
  if (!fs.existsSync(dbPath)) {
    throw new Error(`Database not found at ${dbPath}`);
  }
  const Database = getModule('better-sqlite3');
  return new Database(dbPath);
}

switch (command) {
  case 'start':
    console.log(`${colors.yellow}Starting Orbiton services...${colors.reset}`);
    runCmd('systemctl start orbiton-panel || true');
    runCmd('systemctl start orbiton-daemon || true');
    console.log(`${colors.green}✔ Orbiton services started.${colors.reset}`);
    break;

  case 'stop':
    console.log(`${colors.yellow}Stopping Orbiton services...${colors.reset}`);
    runCmd('systemctl stop orbiton-panel || true');
    runCmd('systemctl stop orbiton-daemon || true');
    console.log(`${colors.green}✔ Orbiton services stopped.${colors.reset}`);
    break;

  case 'restart':
    console.log(`${colors.yellow}Restarting Orbiton Panel and Daemon...${colors.reset}`);
    runCmd('systemctl restart orbiton-panel || true');
    runCmd('systemctl restart orbiton-daemon || true');
    console.log(`${colors.green}✔ Orbiton services restarted successfully.${colors.reset}`);
    break;

  case 'status':
    console.log(`${colors.blue}${colors.bright}orbiton-panel.service status:${colors.reset}`);
    runCmd('systemctl status orbiton-panel --no-pager || true');
    console.log(`\n${colors.blue}${colors.bright}orbiton-daemon.service status:${colors.reset}`);
    runCmd('systemctl status orbiton-daemon --no-pager || true');
    break;

  case 'logs':
    console.log(`${colors.cyan}Streaming real-time logs (Ctrl+C to exit)...${colors.reset}`);
    runCmd('journalctl -u orbiton-panel -u orbiton-daemon -f -n 50 || true');
    break;

  case 'update':
    console.log(`${colors.yellow}Running Orbiton update process...${colors.reset}`);
    const installerScript = fs.existsSync('/opt/orbiton-installer/install.sh')
      ? '/opt/orbiton-installer/install.sh'
      : (fs.existsSync('./install.sh') ? './install.sh' : null);

    if (installerScript) {
      runCmd(`bash "${installerScript}" --update`);
    } else {
      runCmd('git pull || true');
      if (fs.existsSync(PANEL_DIR)) {
        runCmd(`cd "${PANEL_DIR}" && git pull || true && npm install --omit=dev || true`);
        runCmd('systemctl restart orbiton-panel || true');
      }
      if (fs.existsSync(DAEMON_DIR)) {
        runCmd(`cd "${DAEMON_DIR}" && git pull || true && npm install --omit=dev || true`);
        runCmd('systemctl restart orbiton-daemon || true');
      }
      if (fs.existsSync('./orbiton-cli.js')) {
        runCmd('cp ./orbiton-cli.js /usr/local/bin/orbiton && chmod +x /usr/local/bin/orbiton');
      }
      console.log(`${colors.green}✔ Orbiton updated successfully.${colors.reset}`);
    }
    break;

  case 'apps':
    console.log(`${colors.cyan}Fetching Orbiton Applications List...${colors.reset}`);
    try {
      const db = getDatabase();
      const apps = db.prepare('SELECT id, name, runtime, status, start_cmd FROM apps').all();
      console.table(apps);
    } catch (err) {
      console.log(`${colors.red}Error fetching apps: ${err.message}${colors.reset}`);
    }
    break;

  case 'sysinfo':
    console.log(`${colors.blue}${colors.bright}🪐 VPS Hardware Diagnostics:${colors.reset}`);
    console.log(`  OS Platform: ${os.type()} ${os.release()} (${os.arch()})`);
    console.log(`  CPU Cores  : ${os.cpus().length} x ${os.cpus()[0]?.model}`);
    console.log(`  Total RAM  : ${(os.totalmem() / 1024 / 1024 / 1024).toFixed(2)} GB`);
    console.log(`  Free RAM   : ${(os.freemem() / 1024 / 1024 / 1024).toFixed(2)} GB`);
    console.log(`  System Uptime: ${(os.uptime() / 3600).toFixed(2)} hours`);
    break;

  case 'ports':
    console.log(`${colors.blue}${colors.bright}Listening Network Ports:${colors.reset}`);
    if (!runCmd('ss -tulpn | grep LISTEN')) {
      runCmd('netstat -plnt || echo "Neither ss nor netstat is available."');
    }
    break;

  case 'create-admin':
    const username = args[1];
    const password = args[2];
    if (!username || !password) {
      console.log(`${colors.red}❌ Usage: sudo orbiton create-admin <username> <password>${colors.reset}`);
      process.exit(1);
    }
    try {
      const db = getDatabase();
      const bcrypt = getModule('bcryptjs');
      const hash = bcrypt.hashSync(password, 12);
      db.prepare("INSERT INTO users (username, password, role) VALUES (?, ?, 'admin')").run(username, hash);
      console.log(`${colors.green}✔ Admin account '${username}' created successfully!${colors.reset}`);
    } catch (err) {
      console.log(`${colors.red}❌ Failed to create admin: ${err.message}${colors.reset}`);
    }
    break;

  case 'reset-password':
    const rUser = args[1];
    const rPass = args[2];
    if (!rUser || !rPass) {
      console.log(`${colors.red}❌ Usage: sudo orbiton reset-password <username> <new_password>${colors.reset}`);
      process.exit(1);
    }
    try {
      const db = getDatabase();
      const bcrypt = getModule('bcryptjs');
      const hash = bcrypt.hashSync(rPass, 12);
      const res = db.prepare('UPDATE users SET password = ? WHERE username = ?').run(hash, rUser);
      if (res.changes > 0) {
        console.log(`${colors.green}✔ Password for user '${rUser}' reset successfully!${colors.reset}`);
      } else {
        console.log(`${colors.red}❌ User '${rUser}' not found.${colors.reset}`);
      }
    } catch (err) {
      console.log(`${colors.red}❌ Failed to reset password: ${err.message}${colors.reset}`);
    }
    break;

  case 'fail2ban':
    console.log(`${colors.yellow}Configuring Fail2ban protection for Orbiton Panel...${colors.reset}`);
    runCmd('apt-get update -qq && apt-get install -y fail2ban || true');

    const filterConf = `[Definition]\nfailregex = ^\\[.*\\] \\[Orbiton-Security\\] \\[(?:RATE_LIMIT_STRIKE|RATE_LIMIT_SUSTAINED|LOGIN_FAILED)\\] IP=<ADDR> .*\nignoreregex =\n`;
    const jailConf = `[orbiton]\nenabled = true\nport = http,https,3000\nfilter = orbiton\nlogpath = /opt/orbiton-data/security.log\nmaxretry = 5\nfindtime = 60\nbantime = 1800\naction = iptables-multiport[name=orbiton, port="http,https,3000"]\n`;

    try {
      fs.mkdirSync('/etc/fail2ban/filter.d', { recursive: true });
      fs.mkdirSync('/etc/fail2ban/jail.d', { recursive: true });
      fs.writeFileSync('/etc/fail2ban/filter.d/orbiton.conf', filterConf);
      fs.writeFileSync('/etc/fail2ban/jail.d/orbiton.conf', jailConf);

      fs.mkdirSync('/opt/orbiton-data', { recursive: true });
      if (!fs.existsSync('/opt/orbiton-data/security.log')) {
        fs.writeFileSync('/opt/orbiton-data/security.log', '');
      }
      fs.chmodSync('/opt/orbiton-data/security.log', '644');

      runCmd('systemctl restart fail2ban || true');
      runCmd('systemctl enable fail2ban --quiet || true');
      console.log(`${colors.green}✔ Fail2ban security jail configured and activated successfully!${colors.reset}`);
    } catch (err) {
      console.log(`${colors.red}❌ Fail2ban setup error: ${err.message}${colors.reset}`);
    }
    break;

  case 'version':
    console.log(`${colors.green}Orbiton Orchestrator v1.35.0 (Node.js & Bash Unified CLI Edition)${colors.reset}`);
    break;

  case 'help':
  default:
    showHelp();
    break;
}
