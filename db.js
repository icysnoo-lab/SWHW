const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

// Enable foreign keys
db.run('PRAGMA foreign_keys = ON;');

// Helper functions to wrap sqlite3 in Promises
function dbRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this); // 'this' contains lastID and changes for INSERT/UPDATE
    });
  });
}

function dbGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function dbAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

// Initialize tables
async function initDb() {
  // users table
  await dbRun(`
    CREATE TABLE IF NOT EXISTS users (
      hash_id TEXT PRIMARY KEY,
      password_hash TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      recovery_hash TEXT NOT NULL,
      recovery_salt TEXT NOT NULL,
      nickname TEXT,
      profile_pic TEXT,
      theme_bg_color TEXT DEFAULT '#001d13',
      theme_banner_color TEXT DEFAULT '#757575',
      theme_banner_image TEXT,
      theme_banner_position TEXT DEFAULT '50% 50%',
      theme_post_bg_color TEXT DEFAULT '#4B3E3E',
      theme_text_color TEXT DEFAULT '#FFFFFF'
    )
  `);

  // posts table
  await dbRun(`
    CREATE TABLE IF NOT EXISTS posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      parent_id INTEGER,
      user_hash_id TEXT NOT NULL,
      content TEXT,
      created_at INTEGER NOT NULL,
      is_deleted INTEGER DEFAULT 0,
      FOREIGN KEY (parent_id) REFERENCES posts(id) ON DELETE SET NULL,
      FOREIGN KEY (user_hash_id) REFERENCES users(hash_id) ON DELETE CASCADE
    )
  `);

  // attachments table
  await dbRun(`
    CREATE TABLE IF NOT EXISTS attachments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id INTEGER NOT NULL,
      file_name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      file_type TEXT NOT NULL,
      FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
    )
  `);

  // embeds table
  await dbRun(`
    CREATE TABLE IF NOT EXISTS embeds (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id INTEGER NOT NULL,
      url TEXT NOT NULL,
      title TEXT,
      description TEXT,
      image_url TEXT,
      FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
    )
  `);

  // sessions table
  await dbRun(`
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_hash_id TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (user_hash_id) REFERENCES users(hash_id) ON DELETE CASCADE
    )
  `);
}

module.exports = {
  db,
  dbRun,
  dbGet,
  dbAll,
  initDb
};
