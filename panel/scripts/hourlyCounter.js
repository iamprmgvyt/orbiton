// ============================================================
// Orbiton Panel - Independent Hourly Counter Script
// Usage (via cron): 0 * * * * node /opt/orbiton-panel/scripts/hourlyCounter.js
// ============================================================
const fs = require('fs');
const path = require('path');

const counterFile = path.join(__dirname, '..', 'counter.json');
let hourlyCounter = 1;

if (fs.existsSync(counterFile)) {
  try {
    hourlyCounter = JSON.parse(fs.readFileSync(counterFile, 'utf8')).counter || 1;
  } catch (_) {}
}

// Increment and wrap around at 24
hourlyCounter = hourlyCounter + 1;
if (hourlyCounter > 24) {
  hourlyCounter = 1;
}

try {
  fs.writeFileSync(counterFile, JSON.stringify({ counter: hourlyCounter }), 'utf8');
  console.log(`⏱ [Cron job] Hourly Counter successfully incremented to: ${hourlyCounter}`);
} catch (err) {
  console.error('❌ [Cron job] Failed to save hourly counter:', err.message);
  process.exit(1);
}

process.exit(0);
