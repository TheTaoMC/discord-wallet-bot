const Database = require('better-sqlite3');
const db = new Database('wallets.db');

// สร้าง table ถ้ายังไม่มี
db.prepare(`
  CREATE TABLE IF NOT EXISTS wallets (
    user_id TEXT PRIMARY KEY,
    balance INTEGER DEFAULT 0,
    karma INTEGER DEFAULT 50
  )
`).run();

// ตรวจสอบว่ามีคอลัมน์ karma หรือยัง (กรณีใช้ DB เดิม)
try {
  db.prepare('SELECT karma FROM wallets LIMIT 1').get();
} catch (e) {
  db.prepare('ALTER TABLE wallets ADD COLUMN karma INTEGER DEFAULT 50').run();
}

module.exports = db;
