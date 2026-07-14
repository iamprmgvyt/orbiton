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
      install_cmd   TEXT    DEFAULT '',
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

  // Nodes table
  db.exec(`
    CREATE TABLE IF NOT EXISTS nodes (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT    NOT NULL,
      ip          TEXT    NOT NULL,
      port        INTEGER NOT NULL DEFAULT 9900,
      token       TEXT    NOT NULL,
      created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Permissions (sub-user scopes per application)
  db.exec(`
    CREATE TABLE IF NOT EXISTS permissions (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     INTEGER NOT NULL,
      app_id      TEXT    NOT NULL,
      can_power   INTEGER NOT NULL DEFAULT 0,
      can_files   INTEGER NOT NULL DEFAULT 0,
      can_console INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (app_id) REFERENCES apps(id) ON DELETE CASCADE,
      UNIQUE(user_id, app_id)
    );
  `);

  // Backups
  db.exec(`
    CREATE TABLE IF NOT EXISTS backups (
      id          TEXT    PRIMARY KEY,
      app_id      TEXT    NOT NULL,
      name        TEXT    NOT NULL,
      filepath    TEXT    NOT NULL,
      size        INTEGER NOT NULL,
      created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (app_id) REFERENCES apps(id) ON DELETE CASCADE
    );
  `);

  // Domains Mapping & SSL proxy configuration
  db.exec(`
    CREATE TABLE IF NOT EXISTS domains (
      id          TEXT    PRIMARY KEY,
      app_id      TEXT    NOT NULL,
      domain      TEXT    UNIQUE NOT NULL,
      ssl_enabled INTEGER NOT NULL DEFAULT 0,
      created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (app_id) REFERENCES apps(id) ON DELETE CASCADE
    );
  `);

  // Cron Job Scheduler Tasks
  db.exec(`
    CREATE TABLE IF NOT EXISTS cron_jobs (
      id          TEXT    PRIMARY KEY,
      app_id      TEXT    NOT NULL,
      name        TEXT    NOT NULL,
      expression  TEXT    NOT NULL,
      command     TEXT    NOT NULL,
      status      TEXT    NOT NULL DEFAULT 'idle',
      created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
      last_run    TEXT    DEFAULT NULL,
      FOREIGN KEY (app_id) REFERENCES apps(id) ON DELETE CASCADE
    );
  `);

  // Auto-sync or insert default Local Node (id = 1) based on current environment variables
  try {
    const daemonUrl = process.env.DAEMON_URL || 'http://localhost:9900';
    let ip = '127.0.0.1';
    let port = 9900;
    try {
      const u = new URL(daemonUrl);
      ip = u.hostname;
      port = parseInt(u.port) || 9900;
    } catch (_) {}
    const token = process.env.DAEMON_TOKEN || 'orbiton_daemon_secret_token_123';

    const node1 = db.prepare('SELECT * FROM nodes WHERE id = 1').get();
    if (node1) {
      db.prepare('UPDATE nodes SET ip = ?, port = ?, token = ? WHERE id = 1').run(ip, port, token);
      console.log(`[Database Sync] Synced Local Node (id=1) settings to: http://${ip}:${port}`);
    } else {
      db.prepare(`
        INSERT INTO nodes (id, name, ip, port, token)
        VALUES (1, ?, ?, ?, ?)
      `).run('Local Node', ip, port, token);
    }
  } catch (err) {
    console.error(`[Database Sync Error]`, err.message);
  }

  // Migration: install_cmd
  try {
    db.exec("ALTER TABLE apps ADD COLUMN install_cmd TEXT DEFAULT '';");
  } catch (_) {}

  // Migration: node_id
  try {
    db.exec("ALTER TABLE apps ADD COLUMN node_id INTEGER DEFAULT 1;");
  } catch (_) {}

  console.log(`✅ Database: ${DB_PATH}`);
}

module.exports = { db, initDatabase, DATA_DIR };
