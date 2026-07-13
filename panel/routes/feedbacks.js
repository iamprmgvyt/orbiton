// ============================================================
// Orbiton Panel - Feedbacks & Reviews Router (Supabase Postgres)
// Fallback to local SQLite if Supabase goes offline.
// ============================================================
const express = require('express');
const { Pool } = require('pg');
const { db } = require('../db/database');
const crypto = require('crypto');

const router = express.Router();

// Initialize Postgres connection pool to Supabase
const PG_CONNECTION_STRING = 'postgresql://postgres:RYVvgvtrgYH9zuN5@db.ylrvrgblyakssqfjkchg.supabase.co:5432/postgres';
const pool = new Pool({
  connectionString: PG_CONNECTION_STRING,
  ssl: { rejectUnauthorized: false } // Necessary for Supabase SSL connections
});

// Auto-create database table feedbacks on Supabase database if not exists
async function initSupabaseTable() {
  try {
    const client = await pool.connect();
    await client.query(`
      CREATE TABLE IF NOT EXISTS feedbacks (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255),
        rating INTEGER NOT NULL,
        message TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
      );
    `);
    client.release();
    console.log('✅ Supabase PostgreSQL: feedbacks table verified/created.');
  } catch (err) {
    console.warn('⚠ Could not initialize feedbacks table on Supabase (using SQLite fallback):', err.message);
  }
}
initSupabaseTable();

// GET /api/feedbacks - Public route to fetch community reviews
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM feedbacks ORDER BY created_at DESC LIMIT 50');
    return res.json(rows);
  } catch (err) {
    console.warn('⚠ Supabase fetch reviews error, fallback to SQLite:', err.message);
    try {
      const rows = db.prepare('SELECT id, name, email, rating, message, created_at FROM feedbacks ORDER BY datetime(created_at) DESC LIMIT 50').all();
      return res.json(rows);
    } catch (sqliteErr) {
      return res.status(500).json({ error: sqliteErr.message });
    }
  }
});

// POST /api/feedbacks - Public route to submit feedback
router.post('/', async (req, res) => {
  const { name, email, rating, message } = req.body;
  if (!name || !message) {
    return res.status(400).json({ error: 'Name and message review content are required.' });
  }

  try {
    await pool.query(
      'INSERT INTO feedbacks (name, email, rating, message) VALUES ($1, $2, $3, $4)',
      [name, email, parseInt(rating) || 5, message]
    );
    return res.json({ success: true, source: 'supabase' });
  } catch (err) {
    console.warn('⚠ Supabase insert feedback error, fallback to SQLite:', err.message);
    try {
      const id = crypto.randomUUID();
      const dateStr = new Date().toISOString();
      db.prepare(`
        INSERT INTO feedbacks (id, name, email, rating, message, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(id, name, email || '', parseInt(rating) || 5, message, dateStr);
      return res.json({ success: true, source: 'sqlite' });
    } catch (sqliteErr) {
      return res.status(500).json({ error: sqliteErr.message });
    }
  }
});

module.exports = router;
