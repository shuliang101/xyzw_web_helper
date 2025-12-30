import Database from 'better-sqlite3'
import { config } from '../config/index.js'
import { ensureDir } from './fileSystem.js'
import path from 'path'

ensureDir(path.dirname(config.databaseFile))

const db = new Database(config.databaseFile)

// Allow concurrent read/write access more gracefully
db.pragma('journal_mode = WAL')
db.pragma('busy_timeout = 5000')

db.prepare(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    nickname TEXT,
    created_at TEXT NOT NULL
  )
`).run()

const userColumns = db.prepare("PRAGMA table_info('users')").all()
const hasNickname = userColumns.some(column => column.name === 'nickname')
if (!hasNickname) {
  db.prepare('ALTER TABLE users ADD COLUMN nickname TEXT').run()
  db.prepare("UPDATE users SET nickname = username WHERE nickname IS NULL OR nickname = ''").run()
}

db.prepare(`
  CREATE TABLE IF NOT EXISTS bins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    original_name TEXT NOT NULL,
    stored_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    size INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )
`).run()

db.prepare(`
  CREATE TABLE IF NOT EXISTS user_storage (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    storage_key TEXT NOT NULL,
    storage_value TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(user_id, storage_key),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )
`).run()

db.prepare(`
  CREATE TABLE IF NOT EXISTS user_activity (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    type TEXT NOT NULL,
    description TEXT NOT NULL,
    metadata TEXT,
    created_at TEXT NOT NULL
  )
`).run()

export default db
