// ============================================================
// Orbiton CLI - Reset User Password Script
// Run: node reset-password.js <username> <new_password>
// ============================================================
const { db } = require('../db/database');
const bcrypt = require('bcryptjs');

const args = process.argv.slice(2);
if (args.length < 2) {
  console.log('\x1b[31m❌ Usage: node reset-password.js <username> <new_password>\x1b[0m');
  process.exit(1);
}

const username = args[0].trim();
const newPassword = args[1].trim();

try {
  const user = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (!user) {
    console.log(`\x1b[31m❌ User "${username}" not found.\x1b[0m`);
    process.exit(1);
  }

  const salt = bcrypt.genSaltSync(10);
  const hashedPassword = bcrypt.hashSync(newPassword, salt);

  db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashedPassword, user.id);
  console.log(`\x1b[32m✔ Password for user "${username}" has been successfully updated!\x1b[0m`);
} catch (err) {
  console.error('\x1b[31m❌ Failed to reset password:\x1b[0m', err.message);
  process.exit(1);
}
