// ============================================================
// Orbiton - Database Setup (SQLite, cross-platform)
// ============================================================
const Database = require('better-sqlite3');
const bcrypt   = require('bcryptjs');
const path     = require('path');
const fs       = require('fs');
const os       = require('os');

// ─── Data Directory (cross-platform) ─────────────────────────
function getDataDir() {
  if (process.env.DATA_DIR) return process.env.DATA_DIR;
  if (process.platform === 'win32') {
    return path.join(process.env.APPDATA || os.homedir(), 'orbiton-data');
  }
  // Linux / macOS: prefer /opt, fallback to ~/orbiton-data
  const systemDir = '/opt/orbiton-data';
  try {
    fs.mkdirSync(systemDir, { recursive: true });
    fs.accessSync(systemDir, fs.constants.W_OK);
    return systemDir;
  } catch {
    return path.join(os.homedir(), 'orbiton-data');
  }
}

const DATA_DIR = getDataDir();
const DB_PATH  = path.join(DATA_DIR, 'orbiton.db');

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(path.join(DATA_DIR, 'apps'), { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function initDatabase() {
  // Users
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      username   TEXT    UNIQUE NOT NULL,
      password   TEXT    NOT NULL,
      role       TEXT    NOT NULL DEFAULT 'user',
      created_at TEXT    NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Applications (formerly "bots")
  db.exec(`
    CREATE TABLE IF NOT EXISTS apps (
      id            TEXT    PRIMARY KEY,
      name          TEXT    NOT NULL,
      description   TEXT    DEFAULT '',
      runtime       TEXT    NOT NULL DEFAULT 'custom',
      start_cmd     TEXT    NOT NULL,
      work_dir      TEXT    NOT NULL,
      status        TEXT    NOT NULL DEFAULT 'stopped',
      owner_id      INTEGER NOT NULL,
      env_vars      TEXT    DEFAULT '{}',
      max_ram       INTEGER DEFAULT 512,
      auto_restart  INTEGER DEFAULT 0,
      import_source TEXT    DEFAULT NULL,
      created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // App logs
  db.exec(`
    CREATE TABLE IF NOT EXISTS app_logs (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      app_id    TEXT    NOT NULL,
      line      TEXT    NOT NULL,
      timestamp TEXT    NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (app_id) REFERENCES apps(id) ON DELETE CASCADE
    );
  `);

  // Audit log
  db.exec(`
    CREATE TABLE IF NOT EXISTS audit_log (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id   INTEGER,
      action    TEXT    NOT NULL,
      target    TEXT,
      ip        TEXT,
      timestamp TEXT    NOT NULL DEFAULT (datetime('now'))
    );
  `);

  console.log(`✅ Database: ${DB_PATH}`);
}

module.exports = { db, initDatabase, DATA_DIR };
