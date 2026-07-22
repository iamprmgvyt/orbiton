// ============================================================
// Orbiton Quick Start Helper (node start.js)
// Auto-configures JWT, opens Codespace ports to Public, & starts Panel
// ============================================================
const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

console.log('\n🪐 \x1b[36m\x1b[1mStarting Orbiton System Services...\x1b[0m');

// 1. Auto-configure JWT_SECRET in environment if missing
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex');
}

// 2. Auto-forward & make ports PUBLIC in GitHub Codespaces
if (process.env.CODESPACES === 'true' || process.env.CODESPACE_NAME) {
  try {
    console.log('🌐 \x1b[33mGitHub Codespaces detected: Auto-setting ports 3000 & 9900 to PUBLIC...\x1b[0m');
    execSync('gh codespace ports visibility 3000:public 9900:public', { stdio: 'ignore' });
    console.log('✔ \x1b[32mCodespaces ports 3000 & 9900 are now PUBLIC!\x1b[0m');
  } catch (_) {}
}

// 3. Ensure no old process is locking port 3000
try {
  if (process.platform !== 'win32') {
    execSync('fuser -k 3000/tcp 9900/tcp 2>/dev/null || true', { stdio: 'ignore' });
  }
} catch (_) {}

// 4. Spawn Panel Server Process
const serverPath = path.join(__dirname, 'panel', 'server.js');
console.log('🚀 \x1b[32mLaunching Orbiton Panel on Port 3000...\x1b[0m\n');

const child = spawn(process.execPath, [serverPath], {
  cwd: __dirname,
  env: { ...process.env },
  stdio: 'inherit'
});

child.on('exit', (code) => {
  if (code !== 0 && code !== null) {
    console.log(`\n❌ Panel exited with code ${code}`);
  }
});
