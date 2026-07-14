// ============================================================
// Orbiton CLI - System Diagnostics & Statistics
// Run: node sysinfo.js
// ============================================================
const os = require('os');

function formatUptime(uptime) {
  const d = Math.floor(uptime / (3600 * 24));
  const h = Math.floor((uptime % (3600 * 24)) / 3600);
  const m = Math.floor((uptime % 3600) / 60);
  return `${d}d ${h}h ${m}m`;
}

function formatBytes(bytes) {
  const g = bytes / (1024 * 1024 * 1024);
  return g.toFixed(2) + ' GB';
}

try {
  const hostname = os.hostname();
  const platform = os.platform() + ' ' + os.release();
  const cpuModel = os.cpus()[0].model;
  const cpuCores = os.cpus().length;
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  const ramUsagePct = ((usedMem / totalMem) * 100).toFixed(1);
  const uptime = os.uptime();

  console.log('\n\x1b[35m\x1b[1m⚡ ORBITON SYSTEM DIAGNOSTICS\x1b[0m');
  console.log('═'.repeat(60));
  console.log(` 🪐 \x1b[1mHostname:\x1b[0m      ${hostname}`);
  console.log(` 💻 \x1b[1mOS Platform:\x1b[0m   ${platform}`);
  console.log(` ⏱  \x1b[1mUptime:\x1b[0m        ${formatUptime(uptime)}`);
  console.log(` ⚙  \x1b[1mProcessor:\x1b[0m     ${cpuModel} (${cpuCores} Cores)`);
  
  // Progress bar RAM
  const barLength = 20;
  const filledLength = Math.round((usedMem / totalMem) * barLength);
  const bar = '█'.repeat(filledLength) + '░'.repeat(barLength - filledLength);
  
  let memColor = '\x1b[32m'; // Green
  if (ramUsagePct > 70) memColor = '\x1b[33m'; // Yellow
  if (ramUsagePct > 90) memColor = '\x1b[31m'; // Red

  console.log(` 📊 \x1b[1mMemory Usage:\x1b[0m  ${formatBytes(usedMem)} / ${formatBytes(totalMem)} (${memColor}${ramUsagePct}%\x1b[0m)`);
  console.log(`    \x1b[36m[${bar}]\x1b[0m`);
  console.log('═'.repeat(60));
  console.log('System telemetry compiled successfully.\n');
} catch (err) {
  console.error('\x1b[31m❌ Failed to compile system telemetry:\x1b[0m', err.message);
  process.exit(1);
}
