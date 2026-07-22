#!/usr/bin/env node
// ======================================================================================
// Orbiton Global Node.js CLI Tool
// Cross-platform command-line manager for Orbiton Panel & Daemon Node
// Created by iamprmgvyt
// ======================================================================================
const { execSync, spawn } = require('child_process');
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

function showHelp() {
  console.log(`${colors.blue}${colors.bright}🪐 Orbiton Global Node.js CLI Manager${colors.reset}`);
  console.log(`Usage: ${colors.green}orbiton <command> [args]${colors.reset}\n`);
  console.log('Commands:');
  console.log(`  ${colors.green}start${colors.reset}                   : Start Orbiton Panel and Daemon Node services`);
  console.log(`  ${colors.green}stop${colors.reset}                    : Stop Orbiton Panel and Daemon Node services`);
  console.log(`  ${colors.green}restart${colors.reset}                 : Restart both Orbiton Panel and Daemon Node`);
  console.log(`  ${colors.green}status${colors.reset}                  : Show systemd status for Orbiton services`);
  console.log(`  ${colors.green}logs${colors.reset}                    : View real-time systemd service output logs`);
  console.log(`  ${colors.green}update${colors.reset}                  : Pull latest code updates from GitHub and reload services`);
  console.log(`  ${colors.green}apps${colors.reset}                    : List all applications configured on the panel`);
  console.log(`  ${colors.green}sysinfo${colors.reset}                 : Display real-time VPS diagnostics (CPU/RAM/Uptime)`);
  console.log(`  ${colors.green}fail2ban${colors.reset}                : Configure Fail2ban shield for Panel logs`);
  console.log(`  ${colors.green}version${colors.reset}                 : Show installed version info`);
  console.log(`  ${colors.green}help${colors.reset}                    : Display this options helper menu\n`);
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
const command = args[0] ? args[0].toLowerCase() : 'help';

// Check root requirement on Linux/macOS
if (process.platform !== 'win32' && process.getuid && process.getuid() !== 0) {
  console.log(`${colors.red}❌ Please run with root privileges: sudo orbiton ${command}${colors.reset}`);
  process.exit(1);
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
    console.log(`${colors.cyan}Tailing Orbiton live systemd journal logs (Ctrl+C to exit)...${colors.reset}`);
    runCmd('journalctl -u orbiton-panel -u orbiton-daemon -f --no-hostname -o cat || true');
    break;

  case 'update':
    console.log(`${colors.yellow}Triggering Orbiton auto-update...${colors.reset}`);
    if (fs.existsSync('/opt/orbiton-installer/setup.js')) {
      runCmd('node /opt/orbiton-installer/setup.js --update');
    } else {
      runCmd('git pull && systemctl restart orbiton-panel orbiton-daemon');
    }
    break;

  case 'apps':
    console.log(`${colors.cyan}Fetching Orbiton Applications List...${colors.reset}`);
    try {
      const dbPath = path.join(process.env.DATA_DIR || '/opt/orbiton-data', 'orbiton.db');
      if (fs.existsSync(dbPath)) {
        const Database = require('better-sqlite3');
        const db = new Database(dbPath);
        const apps = db.prepare('SELECT id, name, runtime, status, start_cmd FROM apps').all();
        console.table(apps);
      } else {
        console.log(`${colors.yellow}Database not found at ${dbPath}.${colors.reset}`);
      }
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

  case 'version':
    console.log(`${colors.green}🪐 Orbiton Orchestrator v1.35.0 (Node.js CLI Edition)${colors.reset}`);
    break;

  case 'help':
  default:
    showHelp();
    break;
}
