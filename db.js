const Database = require('better-sqlite3');
const db = new Database('wallets.db');

// สร้าง table ถ้ายังไม่มี
db.prepare(`
  CREATE TABLE IF NOT EXISTS wallets (
    user_id TEXT PRIMARY KEY,
    balance INTEGER DEFAULT 0
  )
`).run();

module.exports = db;
