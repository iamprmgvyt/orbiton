const fs = require('fs');
const path = require('path');

// Dynamically determine the data directory
function getDataDir() {
  if (process.env.DATA_DIR) return process.env.DATA_DIR;
  if (process.platform === 'win32') {
    return path.join(process.env.APPDATA || require('os').homedir(), 'orbiton-data');
  }
  return '/opt/orbiton-data';
}

const DATA_DIR = getDataDir();

function logSecurityEvent(type, details) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const logFile = path.join(DATA_DIR, 'security.log');
    const timestamp = new Date().toISOString();
    const logLine = `[${timestamp}] [Orbiton-Security] [${type}] ${details}\n`;
    fs.appendFileSync(logFile, logLine);
    
    // Also print to stdout/stderr for systemd journal / PM2
    console.warn(`[Orbiton-Security] [${type}] ${details}`);
  } catch (err) {
    console.error('Failed to write to security log:', err.message);
  }
}

module.exports = { logSecurityEvent };
