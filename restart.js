// ============================================================
// Orbiton Quick Restart Helper (node restart.js)
// Stops existing services, clears ports, and launches fresh Orbiton Panel
// ============================================================
const { execSync } = require('child_process');
const path = require('path');

console.log('\n🔄 \x1b[36m\x1b[1mRestarting Orbiton System Services...\x1b[0m');

// 1. Stop current running services
try {
  require('./stop.js');
} catch (_) {}

// 2. Wait 1 second for sockets to release
setTimeout(() => {
  // 3. Start fresh services
  require('./start.js');
}, 1000);
