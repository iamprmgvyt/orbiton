// ======================================================================================
// Orbiton Cross-Platform Node.js Interactive Setup Script
// Equivalent to install.sh but written in JS for development and multi-platform compatibility
// ======================================================================================

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// ─── Enforce Root Permissions (Linux/Unix) ─────────────────────
if (process.platform !== 'win32' && typeof process.getuid === 'function' && process.getuid() !== 0) {
  console.error(`\x1b[31m\x1b[1m❌ CRITICAL SECURITY ERROR: Orbiton setup script must be run as root!\x1b[0m`);
  console.error(`👉 Please run using sudo: \x1b[33msudo node setup.js\x1b[0m\n`);
  process.exit(1);
}

const askQuestion = (query) => new Promise((resolve) => rl.question(query, resolve));

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  cyan: '\x1b[36m'
};

async function welcome() {
  console.log(`${colors.blue}${colors.bright}`);
  console.log('   ____    ____    ____     ____    ______   ____    _   __');
  console.log('  / __ \\  / __ \\  / __ )   /_  _/  /_  __/  / __ \\  / | / /');
  console.log(' / / / / /_/ / / / __  |    / /     / /    / / / / /  |/ / ');
  console.log('/ /_/ / / _, _/ / /_/ /   _/ /_    / /    / /_/ / / /|  /  ');
  console.log('\\____/  /_/ |_| /____/   /___/    /_/     \\____/ /_/ |_|   ');
  console.log(colors.reset);
  console.log(`       ${colors.yellow}— Node.js Interactive Installer & Developer Setup —${colors.reset}\n`);
}

function runCmd(cmd, cwd = process.cwd()) {
  try {
    execSync(cmd, { cwd, stdio: 'inherit' });
    return true;
  } catch (err) {
    console.error(`${colors.red}Failed to execute command: ${cmd}${colors.reset}`);
    return false;
  }
}

function configureFail2ban() {
  if (process.platform !== 'linux') return;
  
  // Check if running as root
  const isRoot = process.getuid && process.getuid() === 0;
  if (!isRoot) {
    console.log(`${colors.yellow}⚠️ Skip Fail2ban configuration: not running as root.${colors.reset}`);
    return;
  }

  console.log(`\n${colors.yellow}🛡️ Auto-configuring Fail2ban Shield for Panel logs...${colors.reset}`);
  
  try {
    // Check if fail2ban is installed
    let hasFail2ban = false;
    try {
      execSync('which fail2ban-client', { stdio: 'ignore' });
      hasFail2ban = true;
    } catch (_) {
      console.log(`${colors.yellow}Installing Fail2ban via apt...${colors.reset}`);
      execSync('apt-get update -qq && apt-get install -y fail2ban', { stdio: 'inherit' });
      hasFail2ban = true;
    }

    if (hasFail2ban) {
      // 1. Create filter
      const filterContent = `[Definition]\nfailregex = ^\\[.*\\] \\[Orbiton-Security\\] \\[(?:RATE_LIMIT_STRIKE|RATE_LIMIT_SUSTAINED|LOGIN_FAILED)\\] IP=<ADDR> .*\nignoreregex =\n`;
      fs.writeFileSync('/etc/fail2ban/filter.d/orbiton.conf', filterContent);

      // 2. Create jail config
      const jailContent = `[orbiton]\nenabled = true\nport = http,https,3000\nfilter = orbiton\nlogpath = /opt/orbiton-data/security.log\nmaxretry = 5\nfindtime = 60\nbantime = 1800\naction = iptables-multiport[name=orbiton, port="http,https,3000"]\n`;
      fs.writeFileSync('/etc/fail2ban/jail.d/orbiton.conf', jailContent);

      // Create log directory/file if needed
      fs.mkdirSync('/opt/orbiton-data', { recursive: true });
      const logPath = '/opt/orbiton-data/security.log';
      if (!fs.existsSync(logPath)) {
        fs.writeFileSync(logPath, '');
      }
      fs.chmodSync(logPath, 0o644);

      // Restart Fail2ban
      execSync('systemctl restart fail2ban', { stdio: 'ignore' });
      execSync('systemctl enable fail2ban --quiet', { stdio: 'ignore' });
      console.log(`${colors.green}✔ Fail2ban security jail configured and activated automatically!${colors.reset}`);
    }
  } catch (err) {
    console.log(`${colors.yellow}⚠ Fail2ban auto-configuration bypassed: ${err.message}${colors.reset}`);
  }
}

function writeSystemdServices(panelPort) {
  if (process.platform !== 'linux') return;
  const isRoot = process.getuid && process.getuid() === 0;
  if (!isRoot) return;

  const panelDir = path.join(__dirname, 'panel');
  const daemonDir = path.join(__dirname, 'daemon');

  console.log(`\n${colors.yellow}⚙️ Registering systemd services (Linux daemon mode)...${colors.reset}`);

  // Panel systemd
  const panelService = `[Unit]
Description=Orbiton Panel - Central Manager
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=${panelDir}
ExecStart=/usr/bin/node ${panelDir}/server.js
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=orbiton-panel
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
`;

  // Daemon systemd
  const daemonService = `[Unit]
Description=Orbiton Daemon - Process Agent
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=${daemonDir}
ExecStart=/usr/bin/node ${daemonDir}/server.js
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=orbiton-daemon

[Install]
WantedBy=multi-user.target
`;

  try {
    fs.writeFileSync('/etc/systemd/system/orbiton-panel.service', panelService);
    fs.writeFileSync('/etc/systemd/system/orbiton-daemon.service', daemonService);
    execSync('systemctl daemon-reload', { stdio: 'ignore' });
    console.log(`${colors.green}✔ Systemd service configs written successfully.${colors.reset}`);
  } catch (err) {
    console.log(`${colors.red}⚠ Failed to write systemd services: ${err.message}${colors.reset}`);
  }
}

function installCLI() {
  if (process.platform !== 'win32') {
    console.log(`${colors.yellow}Registering 'orbiton' & 'orbiton-node' global CLI commands...${colors.reset}`);
    const cliSource = path.join(__dirname, 'orbiton-cli.js');
    try {
      if (fs.existsSync(cliSource)) {
        fs.chmodSync(cliSource, '755');
        fs.copyFileSync(cliSource, '/usr/local/bin/orbiton');
        fs.chmodSync('/usr/local/bin/orbiton', '755');
        fs.copyFileSync(cliSource, '/usr/local/bin/orbiton-node');
        fs.chmodSync('/usr/local/bin/orbiton-node', '755');

        fs.mkdirSync('/opt/orbiton-installer', { recursive: true });
        fs.copyFileSync(path.join(__dirname, 'setup.js'), '/opt/orbiton-installer/setup.js');
        fs.copyFileSync(cliSource, '/opt/orbiton-installer/orbiton-cli.js');

        console.log(`${colors.green}✔ Registered global CLI commands! Try running: 'sudo orbiton help' or 'sudo orbiton status'${colors.reset}`);
      }
    } catch (err) {
      console.log(`${colors.yellow}⚠ Skipped CLI registration: ${err.message}${colors.reset}`);
    }
  }
}

async function installPanel(allInOneSecret = null, defaultDaemonPort = 9900) {
  console.log(`\n${colors.cyan}🛠️  Installing Dependencies for Orbiton Panel...${colors.reset}`);
  runCmd('npm install --omit=dev', path.join(__dirname, 'panel'));

  console.log(`\n${colors.yellow}* Configure Panel Network Port:${colors.reset}`);
  console.log('  [1] Run directly on HTTP Port 80');
  console.log('  [2] Run on custom port (Default: 3000)');
  const portChoice = await askQuestion('  Select option [1-2, Default: 2]: ');
  
  let port = 3000;
  if (portChoice.trim() === '1') {
    port = 80;
  } else {
    const customPort = await askQuestion('  Enter custom port [Default: 3000]: ');
    if (customPort.trim()) {
      port = parseInt(customPort.trim(), 10) || 3000;
    }
  }

  const jwtSecret = crypto.randomBytes(32).toString('hex');
  const daemonToken = allInOneSecret || `orbiton_daemon_secret_${crypto.randomBytes(16).toString('hex')}`;

  let daemonUrl = `http://localhost:${defaultDaemonPort}`;
  if (!allInOneSecret) {
    const dUrlInput = await askQuestion(`\n* Enter Daemon URL (where Wings agent runs) [Default: http://localhost:9900]: `);
    if (dUrlInput.trim()) {
      daemonUrl = dUrlInput.trim();
      if (!daemonUrl.startsWith('http://') && !daemonUrl.startsWith('https://')) {
        daemonUrl = `http://${daemonUrl}`;
      }
    }
  }

  const envContent = `PORT=${port}
SSL_PORT=3443
JWT_SECRET=${jwtSecret}
NODE_ENV=production
DISABLE_SSL=true
DAEMON_URL=${daemonUrl}
DAEMON_TOKEN=${daemonToken}
`;

  fs.writeFileSync(path.join(__dirname, 'panel', '.env'), envContent);
  console.log(`${colors.green}✔ Panel .env configuration file written successfully.${colors.reset}`);

  // Configure Initial Admin Account Interactively
  console.log(`\n${colors.yellow}* Configure Initial Administrator Account:${colors.reset}`);
  const adminUsername = await askQuestion('  Enter Admin Username [Default: admin]: ');
  const finalUsername = adminUsername.trim() || 'admin';
  const adminPassword = await askQuestion('  Enter Admin Password [Default: admin123456]: ');
  const finalPassword = adminPassword.trim() || 'admin123456';

  try {
    const bcrypt = require('./panel/node_modules/bcryptjs');
    const Database = require('./panel/node_modules/better-sqlite3');
    const dataDir = process.env.DATA_DIR || (process.platform === 'win32' ? path.join(process.env.APPDATA || require('os').homedir(), 'orbiton-data') : '/opt/orbiton-data');
    fs.mkdirSync(dataDir, { recursive: true });
    const dbPath = path.join(dataDir, 'orbiton.db');
    const db = new Database(dbPath);
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'user',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);
    const hash = bcrypt.hashSync(finalPassword, 12);
    db.prepare("INSERT OR REPLACE INTO users (id, username, password, role) VALUES (1, ?, ?, 'admin')").run(finalUsername, hash);
    console.log(`${colors.green}✔ Admin account configured! Username: ${finalUsername} | Password: ${finalPassword}${colors.reset}`);
  } catch (err) {
    console.log(`${colors.yellow}⚠️ Initial admin setup notice: ${err.message}${colors.reset}`);
  }

  // Configure Fail2ban automatically
  configureFail2ban();

  return { port, daemonToken };
}

async function installDaemon(allInOneSecret = null, daemonPort = 9900) {
  console.log(`\n${colors.cyan}🛠️  Installing Dependencies for Orbiton Daemon (Wings Agent)...${colors.reset}`);
  const daemonCwd = path.join(__dirname, 'daemon');
  runCmd('npm install --omit=dev', daemonCwd);
  // Optional native pty build
  console.log(`${colors.yellow}Compiling native process terminals (node-pty)...${colors.reset}`);
  runCmd('npm install node-pty --build-from-source', daemonCwd);

  let daemonToken = allInOneSecret;
  if (!daemonToken) {
    daemonToken = await askQuestion(`\n* Enter Daemon Security Token (leave blank to auto-generate): `);
    if (!daemonToken.trim()) {
      daemonToken = `orbiton_daemon_secret_${crypto.randomBytes(16).toString('hex')}`;
    }
  }

  const defaultDataDir = process.platform === 'win32'
    ? path.join(process.env.APPDATA || require('os').homedir(), 'orbiton-data')
    : '/opt/orbiton-data';

  const envContent = `PORT=${daemonPort}
DAEMON_TOKEN=${daemonToken}
DATA_DIR=${defaultDataDir.replace(/\\/g, '/')}
`;

  fs.writeFileSync(path.join(__dirname, 'daemon', '.env'), envContent);
  console.log(`${colors.green}✔ Daemon .env configuration file written successfully.${colors.reset}`);
}

async function letsencryptSSL() {
  console.log(`\n${colors.cyan}🔒 Let's Encrypt SSL Certificate Setup${colors.reset}`);
  const cfChoice = await askQuestion('* Do you use Cloudflare SSL/TLS Proxy (Flexible/Full) for this domain? (y/N): ');
  
  const panelEnvPath = path.join(__dirname, 'panel', '.env');
  
  if (cfChoice.trim().toLowerCase() === 'y') {
    console.log(`${colors.green}✔ Configuring for Cloudflare Proxy. Panel runs on HTTP behind Cloudflare HTTPS.${colors.reset}`);
    if (fs.existsSync(panelEnvPath)) {
      let content = fs.readFileSync(panelEnvPath, 'utf8');
      content = content.replace(/DISABLE_SSL=false/g, 'DISABLE_SSL=true');
      fs.writeFileSync(panelEnvPath, content);
    }
    const certsDir = path.join(__dirname, 'panel', 'certs');
    if (fs.existsSync(certsDir)) fs.rmSync(certsDir, { recursive: true, force: true });
    runCmd('systemctl restart orbiton-panel || true');
    return;
  }

  const domain = await askQuestion('  Enter Domain (e.g. panel.example.com): ');
  const email = await askQuestion('  Enter Email: ');

  if (!domain.trim() || !email.trim()) {
    console.log(`${colors.red}Domain and email are required for SSL setup.${colors.reset}`);
    return;
  }

  console.log(`${colors.yellow}Requesting Let's Encrypt SSL certificate for ${domain}...${colors.reset}`);
  const certSuccess = runCmd(`certbot certonly --standalone -d "${domain}" --email "${email}" --agree-tos --non-interactive`);

  const liveCertDir = `/etc/letsencrypt/live/${domain}`;
  if (certSuccess && fs.existsSync(liveCertDir)) {
    const certsDir = path.join(__dirname, 'panel', 'certs');
    if (!fs.existsSync(certsDir)) fs.mkdirSync(certsDir, { recursive: true });
    
    try {
      fs.symlinkSync(path.join(liveCertDir, 'fullchain.pem'), path.join(certsDir, 'fullchain.pem'));
      fs.symlinkSync(path.join(liveCertDir, 'privkey.pem'), path.join(certsDir, 'privkey.pem'));
    } catch (_) {}

    if (fs.existsSync(panelEnvPath)) {
      let content = fs.readFileSync(panelEnvPath, 'utf8');
      content = content.replace(/DISABLE_SSL=true/g, 'DISABLE_SSL=false');
      fs.writeFileSync(panelEnvPath, content);
    }

    runCmd('systemctl restart orbiton-panel || true');
    console.log(`${colors.green}✔ Let's Encrypt certificate configured and SSL enabled for ${domain}!${colors.reset}`);
  } else {
    console.log(`${colors.red}❌ Let's Encrypt certificate generation failed.${colors.reset}`);
  }
}

async function uninstallOrbiton() {
  console.log(`\n${colors.red}${colors.bright}🛑 Uninstalling Orbiton Panel and Daemon...${colors.reset}`);
  runCmd('systemctl stop orbiton-panel --quiet || true');
  runCmd('systemctl disable orbiton-panel --quiet || true');
  runCmd('systemctl stop orbiton-daemon --quiet || true');
  runCmd('systemctl disable orbiton-daemon --quiet || true');

  try {
    if (fs.existsSync('/etc/systemd/system/orbiton-panel.service')) fs.unlinkSync('/etc/systemd/system/orbiton-panel.service');
    if (fs.existsSync('/etc/systemd/system/orbiton-daemon.service')) fs.unlinkSync('/etc/systemd/system/orbiton-daemon.service');
    runCmd('systemctl daemon-reload || true');
  } catch (_) {}

  const panelDir = path.join(__dirname, 'panel');
  const daemonDir = path.join(__dirname, 'daemon');
  
  if (fs.existsSync('/opt/orbiton-panel')) fs.rmSync('/opt/orbiton-panel', { recursive: true, force: true });
  if (fs.existsSync('/opt/orbiton-daemon')) fs.rmSync('/opt/orbiton-daemon', { recursive: true, force: true });

  const purgeChoice = await askQuestion('* Do you want to delete application data database/files at /opt/orbiton-data? (y/N): ');
  if (purgeChoice.trim().toLowerCase() === 'y') {
    if (fs.existsSync('/opt/orbiton-data')) fs.rmSync('/opt/orbiton-data', { recursive: true, force: true });
    console.log(`${colors.green}✔ Application data removed.${colors.reset}`);
  }
  console.log(`${colors.green}✔ Orbiton uninstalled successfully.${colors.reset}`);
}

async function updateOrbiton() {
  console.log(`\n${colors.yellow}🔄 Updating Orbiton Panel & Daemon to the latest version...${colors.reset}`);
  runCmd('git config --global --add safe.directory "' + __dirname + '" || true');
  runCmd('git stash || true');
  const pullSuccess = runCmd('git pull');
  if (!pullSuccess) {
    runCmd('git fetch --all && git reset --hard origin/main');
  }

  const panelCwd = path.join(__dirname, 'panel');
  const daemonCwd = path.join(__dirname, 'daemon');

  if (fs.existsSync(panelCwd)) {
    console.log(`${colors.yellow}Updating Panel package files...${colors.reset}`);
    runCmd('npm install --omit=dev', panelCwd);
    runCmd('systemctl restart orbiton-panel || true');
  }

  if (fs.existsSync(daemonCwd)) {
    console.log(`${colors.yellow}Updating Daemon package files...${colors.reset}`);
    runCmd('npm install --omit=dev', daemonCwd);
    runCmd('systemctl restart orbiton-daemon || true');
  }

  console.log(`${colors.green}${colors.bright}🪐 Orbiton Update Completed Successfully!${colors.reset}\n`);
}

async function main() {
  await welcome();

  console.log('Select setup option:');
  console.log(`  [${colors.green}0${colors.reset}] Install both Panel and Daemon (All-in-One on the same machine)`);
  console.log(`  [${colors.green}1${colors.reset}] Install Panel only (Central UI & User Database)`);
  console.log(`  [${colors.green}2${colors.reset}] Install Daemon only (Wings Agent on Node VPS)`);
  console.log(`  [${colors.green}3${colors.reset}] Configure Let's Encrypt SSL certificate`);
  console.log(`  [${colors.green}4${colors.reset}] Configure Fail2ban automatic DDoS/brute-force IP ban shield`);
  console.log(`  [${colors.green}5${colors.reset}] Uninstall Panel & Daemon`);
  console.log(`  [${colors.green}6${colors.reset}] Update Orbiton to the Latest Version & Restart Services`);
  console.log(`  [${colors.green}7${colors.reset}] Cancel / Exit`);
  
  const choice = await askQuestion('\nEnter option [0-7, Default: 0]: ');
  const selection = choice.trim() ? parseInt(choice.trim(), 10) : 0;

  if (selection === 7) {
    console.log('\nSetup cancelled.');
    rl.close();
    return;
  }

  if (selection === 3) {
    await letsencryptSSL();
    rl.close();
    return;
  }

  if (selection === 4) {
    configureFail2ban();
    rl.close();
    return;
  }

  if (selection === 5) {
    await uninstallOrbiton();
    rl.close();
    return;
  }

  if (selection === 6) {
    await updateOrbiton();
    rl.close();
    return;
  }

  const allInOneSecret = (selection === 0) ? `orbiton_daemon_secret_${crypto.randomBytes(16).toString('hex')}` : null;
  let panelPort = 3000;
  let daemonPort = 9900;

  if (selection === 0 || selection === 2) {
    console.log(`\n${colors.yellow}* Configure Daemon Network Port:${colors.reset}`);
    const dPortInput = await askQuestion('  Enter Daemon Port [Default: 9900]: ');
    if (dPortInput.trim()) {
      daemonPort = parseInt(dPortInput.trim(), 10) || 9900;
    }
  }

  if (selection === 0) {
    const panelConfig = await installPanel(allInOneSecret, daemonPort);
    panelPort = panelConfig.port;
    await installDaemon(allInOneSecret, daemonPort);
    writeSystemdServices(panelPort);
    installCLI();
  } else if (selection === 1) {
    const panelConfig = await installPanel();
    panelPort = panelConfig.port;
    writeSystemdServices(panelPort);
    installCLI();
  } else if (selection === 2) {
    await installDaemon(null, daemonPort);
    writeSystemdServices(panelPort);
    installCLI();
  } else {
    console.log(`${colors.red}Invalid selection. Exiting.${colors.reset}`);
    rl.close();
    return;
  }

  console.log(`\n${colors.green}${colors.bright}================================================${colors.reset}`);
  console.log(`${colors.green}${colors.bright}🪐 Orbiton Node.js Setup Completed Successfully! ${colors.reset}`);
  console.log(`${colors.green}${colors.bright}================================================${colors.reset}`);
  
  if (selection === 0 || selection === 1) {
    console.log(`\nTo run the Panel in development mode:\n  ${colors.cyan}cd panel && node server.js${colors.reset}`);
    console.log(`  Web access: ${colors.bright}http://localhost:${panelPort}${colors.reset}`);
  }
  if (selection === 0 || selection === 2) {
    console.log(`\nTo run the Daemon in development mode:\n  ${colors.cyan}cd daemon && node server.js${colors.reset}`);
  }

  console.log(`\nFor production Linux hostings, services can be managed via:\n  ${colors.cyan}systemctl start orbiton-panel\n  systemctl start orbiton-daemon${colors.reset}`);
  console.log(`\n${colors.yellow}Thank you for choosing Orbiton!${colors.reset}\n`);

  const startChoice = await askQuestion('* Would you like to start the installed Orbiton services now in development mode? (y/N): ');
  rl.close();

  if (startChoice.trim().toLowerCase() === 'y' || startChoice.trim().toLowerCase() === 'yes') {
    console.log(`\n${colors.yellow}Stopping background systemd services (if any) to prevent port conflicts...${colors.reset}`);
    runCmd('systemctl stop orbiton-panel orbiton-daemon || true');

    console.log(`\n${colors.green}Starting Orbiton services in development mode... (Press Ctrl+C to stop)${colors.reset}\n`);
    const { spawn } = require('child_process');
    const processes = [];

    if (selection === 0 || selection === 1) {
      console.log(`${colors.cyan}[System] Spawning Panel process on port ${panelPort}...${colors.reset}`);
      const panelProc = spawn('node', ['server.js'], { cwd: path.join(__dirname, 'panel') });
      panelProc.stdout.on('data', (data) => {
        process.stdout.write(`${colors.blue}[Panel]${colors.reset} ${data.toString()}`);
      });
      panelProc.stderr.on('data', (data) => {
        process.stderr.write(`${colors.red}[Panel-Err]${colors.reset} ${data.toString()}`);
      });
      processes.push(panelProc);
    }

    if (selection === 0 || selection === 2) {
      console.log(`${colors.cyan}[System] Spawning Daemon process on port ${daemonPort}...${colors.reset}`);
      const daemonProc = spawn('node', ['server.js'], { cwd: path.join(__dirname, 'daemon') });
      daemonProc.stdout.on('data', (data) => {
        process.stdout.write(`${colors.yellow}[Daemon]${colors.reset} ${data.toString()}`);
      });
      daemonProc.stderr.on('data', (data) => {
        process.stderr.write(`${colors.red}[Daemon-Err]${colors.reset} ${data.toString()}`);
      });
      processes.push(daemonProc);
    }

    // Handle graceful exit
    process.on('SIGINT', () => {
      console.log(`\n${colors.yellow}Shutting down processes...${colors.reset}`);
      processes.forEach(p => p.kill());
      process.exit(0);
    });

    // Keep script alive
    await new Promise(() => {});
  }
}

main().catch(err => {
  console.error('Setup encountered an error:', err);
  rl.close();
});
