// ============================================================
// Orbiton CLI - List Hosted Applications
// Run: node list-apps.js
// ============================================================
const { db } = require('../db/database');

try {
  const apps = db.prepare(`
    SELECT a.id, a.name, a.runtime, a.status, u.username as owner, a.created_at 
    FROM apps a
    JOIN users u ON a.owner_id = u.id
  `).all();

  if (apps.length === 0) {
    console.log('\x1b[33m🪐 No applications configured on this Orbiton master node yet.\x1b[0m');
    process.exit(0);
  }

  console.log('\n\x1b[34m\x1b[1m🪐 ORBITON APP REGISTRY\x1b[0m');
  console.log('─'.repeat(80));
  // Print Header
  console.log(
    `\x1b[1m%-12s %-22s %-15s %-12s %-12s\x1b[0m`,
    'APP ID', 'NAME', 'RUNTIME', 'STATUS', 'OWNER'
  );
  console.log('─'.repeat(80));

  for (let app of apps) {
    let statusColor = '\x1b[31m'; // Default red for stopped
    if (app.status === 'running') statusColor = '\x1b[32m'; // Green
    if (app.status === 'starting' || app.status === 'stopping') statusColor = '\x1b[33m'; // Yellow

    const fmtId = app.id.substring(0, 8) + '...';
    console.log(
      `%-12s %-22s %-15s ${statusColor}%-12s\x1b[0m %-12s`,
      fmtId,
      app.name.substring(0, 20),
      app.runtime,
      app.status.toUpperCase(),
      app.owner
    );
  }
  console.log('─'.repeat(80));
  console.log(`Total active applications: \x1b[36m${apps.length}\x1b[0m\n`);
} catch (err) {
  console.error('\x1b[31m❌ Failed to list applications:\x1b[0m', err.message);
  process.exit(1);
}
