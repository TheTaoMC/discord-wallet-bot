const Database = require('better-sqlite3');
const db = new Database('wallets.db');

// สร้างตาราง wallets ถ้ายังไม่มี
db.prepare(`
  CREATE TABLE IF NOT EXISTS wallets (
    user_id TEXT PRIMARY KEY,
    balance INTEGER DEFAULT 0,
    karma INTEGER DEFAULT 50
  )
`).run();

// สร้างตาราง settings สำหรับเก็บค่า allowedChannelId
db.prepare(`
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  )
`).run();

// ฟังก์ชันดึงค่า setting
function getSetting(key) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : null;
}

// ฟังก์ชันตั้งค่า setting
function setSetting(key, value) {
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value);
}

module.exports = db;
module.exports.getSetting = getSetting;
module.exports.setSetting = setSetting;
