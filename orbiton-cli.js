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
  console.log(`${colors.blue}${colors.bright}🪐 Orbiton System CLI Manager${colors.reset}`);
  console.log(`Usage: ${colors.green}orbiton <command|flag> [args]${colors.reset}\n`);
  console.log('Commands & Flags:');
  console.log(`  ${colors.green}start, -s, --start${colors.reset}                  : Start Orbiton Panel and Daemon Node services`);
  console.log(`  ${colors.green}stop, -p, --stop${colors.reset}                    : Stop Orbiton Panel and Daemon Node services`);
  console.log(`  ${colors.green}restart, -r, --restart${colors.reset}              : Restart both Orbiton Panel and Daemon Node`);
  console.log(`  ${colors.green}status, -st, --status${colors.reset}               : Show systemd status for Orbiton services`);
  console.log(`  ${colors.green}logs, -l, --logs${colors.reset}                    : View real-time systemd service output logs`);
  console.log(`  ${colors.green}update, -u, --update${colors.reset}                : Pull latest updates from GitHub and reload services`);
  console.log(`  ${colors.green}apps, -a, --apps${colors.reset}                    : List all applications configured on the panel`);
  console.log(`  ${colors.green}sysinfo, -i, --sysinfo${colors.reset}              : Display real-time VPS diagnostics (CPU/RAM/Uptime)`);
  console.log(`  ${colors.green}ports, -po, --ports${colors.reset}                 : List all listening network ports on the system`);
  console.log(`  ${colors.green}create-admin, -ca, --create-admin <u > <p >${colors.reset}: Create a new Web Panel admin account`);
  console.log(`  ${colors.green}reset-password, -rp, --reset-password <u > <p >${colors.reset}: Reset password for a panel user account`);
  console.log(`  ${colors.green}fail2ban, -f, --fail2ban${colors.reset}             : Install and configure Fail2ban shield for Panel logs`);
  console.log(`  ${colors.green}version, -v, --version${colors.reset}               : Show installed version info`);
  console.log(`  ${colors.green}help, -h, --h, --help${colors.reset}                : Display this options helper menu\n`);
  console.log(`Created by ${colors.yellow}iamprmgvyt${colors.reset}`);
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
      if (fs.existsSync(PANEL_DIR)) {
        runCmd(`cd "${PANEL_DIR}" && git pull || true && npm install --omit=dev || true`);
        runCmd('systemctl restart orbiton-panel || true');
      }
      if (fs.existsSync(DAEMON_DIR)) {
        runCmd(`cd "${DAEMON_DIR}" && git pull || true && npm install --omit=dev || true`);
        runCmd('systemctl restart orbiton-daemon || true');
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
