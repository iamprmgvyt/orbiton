// ============================================================
// Orbiton CLI - Create Admin User Script
// Run: node create-admin.js <username> <password>
// ============================================================
const { db } = require('../db/database');
const bcrypt = require('bcryptjs');

const args = process.argv.slice(2);
if (args.length < 2) {
  console.log('\x1b[31m❌ Usage: node create-admin.js <username> <password>\x1b[0m');
  process.exit(1);
}

const username = args[0].trim();
const password = args[1].trim();

try {
  // Check if user exists
  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) {
    console.log(`\x1b[31m❌ User "${username}" already exists.\x1b[0m`);
    process.exit(1);
  }

  const salt = bcrypt.genSaltSync(10);
  const hashedPassword = bcrypt.hashSync(password, salt);

  const result = db.prepare(`
    INSERT INTO users (username, password, role)
    VALUES (?, ?, 'admin')
  `).run(username, hashedPassword);

  console.log(`\x1b[32m✔ Admin user "${username}" successfully created (ID: ${result.lastInsertRowid})!\x1b[0m`);
} catch (err) {
  console.error('\x1b[31m❌ Failed to create admin user:\x1b[0m', err.message);
  process.exit(1);
}
