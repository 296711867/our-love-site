const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, 'site.db'));
db.pragma('journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT
);
CREATE TABLE IF NOT EXISTS photos (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  filename   TEXT NOT NULL,
  thumb      TEXT NOT NULL,
  caption    TEXT NOT NULL DEFAULT '',
  taken_at   TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS messages (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  author      TEXT NOT NULL,
  content     TEXT NOT NULL,
  image       TEXT,
  image_thumb TEXT,
  created_at  TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS anniversaries (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT NOT NULL,
  date          TEXT NOT NULL,
  repeat_yearly INTEGER NOT NULL DEFAULT 1,
  icon          TEXT NOT NULL DEFAULT '💖'
);
`);

const getStmt = db.prepare('SELECT value FROM settings WHERE key = ?');
const setStmt = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');

function getSetting(key) {
  const row = getStmt.get(key);
  return row ? row.value : undefined;
}

function getSettings() {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const s = {};
  for (const r of rows) s[r.key] = r.value;
  return s;
}

function setSetting(key, value) {
  setStmt.run(key, String(value));
}

// 首次启动：写入默认设置 + 随机初始密码
function seed() {
  const defaults = {
    site_name: '我们的小站',
    slogan: '喜欢花 喜欢浪漫 喜欢你~',
    name_a: 'Pan',
    name_b: 'Amy',
    since_date: new Date().toISOString().slice(0, 10),
    since_time: '20:00',
    theme_color: '#ff6b95',
    hero_image: '',
    avatar_a: '',
    avatar_b: '',
    photo_lock: '0',
    message_lock: '0',
    fx_fall: 'petals',
    fx_sparkle: '1',
    fx_trail: '1',
  };
  for (const [k, v] of Object.entries(defaults)) {
    if (getSetting(k) === undefined) setSetting(k, v);
  }

  if (!getSetting('admin_pass') || !getSetting('photo_lock_pass')) {
    const adminPw = genPass();
    const lockPw = genPass();
    if (!getSetting('admin_pass')) setSetting('admin_pass', bcrypt.hashSync(adminPw, 10));
    if (!getSetting('photo_lock_pass')) setSetting('photo_lock_pass', bcrypt.hashSync(lockPw, 10));
    const file = path.join(DATA_DIR, '初始密码.txt');
    if (!fs.existsSync(file)) {
      fs.writeFileSync(file, `管理后台密码：${adminPw}\n相册锁密码：${lockPw}\n\n请登录后台后在「设置」中尽快修改这两个密码。\n`);
    }
  }
}

function genPass() {
  return 'LOVE-' + crypto.randomBytes(3).toString('hex').toUpperCase();
}

module.exports = { db, getSetting, getSettings, setSetting, seed, DATA_DIR };
