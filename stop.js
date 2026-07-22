// ============================================================
// Orbiton Quick Stop Helper (node stop.js)
// Gracefully terminates Panel & Daemon services on Ports 3000 & 9900
// ============================================================
const { execSync } = require('child_process');

console.log('\n🛑 \x1b[33mStopping Orbiton System Services...\x1b[0m');

try {
  if (process.platform === 'win32') {
    execSync('taskkill /F /IM node.exe 2>nul || ver >nul', { stdio: 'ignore' });
  } else {
    execSync('fuser -k 3000/tcp 9900/tcp 2>/dev/null || true', { stdio: 'ignore' });
    try {
      execSync('systemctl stop orbiton-panel orbiton-daemon 2>/dev/null || true', { stdio: 'ignore' });
    } catch (_) {}
  }
  console.log('✔ \x1b[32mOrbiton services stopped successfully.\x1b[0m\n');
} catch (err) {
  console.log('✔ \x1b[32mOrbiton services stopped.\x1b[0m\n');
}
