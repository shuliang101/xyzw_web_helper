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

db.prepare(`
  CREATE TABLE IF NOT EXISTS scheduled_tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    run_type TEXT NOT NULL,
    run_time TEXT,
    cron_expression TEXT,
    token_ids TEXT NOT NULL,
    selected_tasks TEXT NOT NULL,
    task_settings TEXT,
    enabled INTEGER DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    last_run_at TEXT,
    next_run_at TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )
`).run()

db.prepare(`
  CREATE TABLE IF NOT EXISTS task_run_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    token_id TEXT NOT NULL,
    status TEXT NOT NULL,
    logs TEXT,
    started_at TEXT NOT NULL,
    finished_at TEXT,
    FOREIGN KEY (task_id) REFERENCES scheduled_tasks(id) ON DELETE CASCADE
  )
`).run()

db.prepare(`
  CREATE TABLE IF NOT EXISTS club_car_config (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    master_bin_path TEXT,
    master_bin_name TEXT,
    send_cron TEXT NOT NULL DEFAULT '0 12 * * *',
    claim_cron TEXT NOT NULL DEFAULT '0 16 * * *',
    enabled INTEGER NOT NULL DEFAULT 0,
    min_color INTEGER NOT NULL DEFAULT 4,
    max_refresh_times INTEGER NOT NULL DEFAULT 20,
    updated_at TEXT NOT NULL
  )
`).run()

db.prepare(`
  INSERT OR IGNORE INTO club_car_config (
    id, send_cron, claim_cron, enabled, min_color, max_refresh_times, updated_at
  )
  VALUES (1, '0 12 * * *', '0 16 * * *', 0, 4, 20, ?)
`).run(new Date().toISOString())

db.prepare(`
  CREATE TABLE IF NOT EXISTS club_car_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    role_id TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    avatar TEXT,
    power INTEGER NOT NULL DEFAULT 0,
    position INTEGER NOT NULL DEFAULT 0,
    password_hash TEXT,
    target_role_id TEXT,
    send_time TEXT NOT NULL DEFAULT '12:00',
    claim_time TEXT NOT NULL DEFAULT '16:00',
    claim_enabled INTEGER NOT NULL DEFAULT 0,
    last_send_at TEXT,
    last_help_at TEXT,
    last_claim_at TEXT,
    bound_bin_path TEXT,
    bound_bin_name TEXT,
    bound_at TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )
`).run()

db.prepare(`
  CREATE TABLE IF NOT EXISTS club_car_club_info (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    club_id TEXT,
    club_name TEXT,
    club_avatar TEXT,
    leader_role_id TEXT,
    leader_name TEXT,
    raw_snapshot TEXT,
    updated_at TEXT NOT NULL
  )
`).run()

db.prepare(`
  INSERT OR IGNORE INTO club_car_club_info (
    id, updated_at
  )
  VALUES (1, ?)
`).run(new Date().toISOString())

db.prepare(`
  CREATE TABLE IF NOT EXISTS club_car_run_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_type TEXT NOT NULL,
    status TEXT NOT NULL,
    message TEXT NOT NULL,
    detail TEXT,
    created_at TEXT NOT NULL
  )
`).run()

db.prepare(`
  CREATE TABLE IF NOT EXISTS club_car_send_plans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    weekday INTEGER NOT NULL,
    target_role_id TEXT NOT NULL,
    sender_role_id TEXT NOT NULL,
    send_mode TEXT NOT NULL DEFAULT 'red',
    use_coupon INTEGER NOT NULL DEFAULT 0,
    send_time TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    last_run_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(weekday, sender_role_id, send_time)
  )
`).run()

const clubConfigColumns = db.prepare("PRAGMA table_info('club_car_config')").all()
const hasMinColor = clubConfigColumns.some(column => column.name === 'min_color')
if (!hasMinColor) {
  db.prepare('ALTER TABLE club_car_config ADD COLUMN min_color INTEGER NOT NULL DEFAULT 4').run()
}
const hasMaxRefreshTimes = clubConfigColumns.some(column => column.name === 'max_refresh_times')
if (!hasMaxRefreshTimes) {
  db.prepare('ALTER TABLE club_car_config ADD COLUMN max_refresh_times INTEGER NOT NULL DEFAULT 20').run()
}

const clubMemberColumns = db.prepare("PRAGMA table_info('club_car_members')").all()
const hasMemberActive = clubMemberColumns.some(column => column.name === 'is_active')
if (!hasMemberActive) {
  db.prepare('ALTER TABLE club_car_members ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1').run()
  db.prepare('UPDATE club_car_members SET is_active = 1 WHERE is_active IS NULL').run()
}
const hasAvatar = clubMemberColumns.some(column => column.name === 'avatar')
if (!hasAvatar) {
  db.prepare('ALTER TABLE club_car_members ADD COLUMN avatar TEXT').run()
}
const hasSendTime = clubMemberColumns.some(column => column.name === 'send_time')
if (!hasSendTime) {
  db.prepare("ALTER TABLE club_car_members ADD COLUMN send_time TEXT NOT NULL DEFAULT '12:00'").run()
}
const hasClaimTime = clubMemberColumns.some(column => column.name === 'claim_time')
if (!hasClaimTime) {
  db.prepare("ALTER TABLE club_car_members ADD COLUMN claim_time TEXT NOT NULL DEFAULT '16:00'").run()
}
const hasClaimEnabled = clubMemberColumns.some(column => column.name === 'claim_enabled')
if (!hasClaimEnabled) {
  db.prepare('ALTER TABLE club_car_members ADD COLUMN claim_enabled INTEGER NOT NULL DEFAULT 0').run()
}
db.prepare('UPDATE club_car_members SET claim_enabled = 0 WHERE claim_enabled IS NULL').run()
const hasLastSendAt = clubMemberColumns.some(column => column.name === 'last_send_at')
if (!hasLastSendAt) {
  db.prepare('ALTER TABLE club_car_members ADD COLUMN last_send_at TEXT').run()
}
const hasLastHelpAt = clubMemberColumns.some(column => column.name === 'last_help_at')
if (!hasLastHelpAt) {
  db.prepare('ALTER TABLE club_car_members ADD COLUMN last_help_at TEXT').run()
}
const hasLastClaimAt = clubMemberColumns.some(column => column.name === 'last_claim_at')
if (!hasLastClaimAt) {
  db.prepare('ALTER TABLE club_car_members ADD COLUMN last_claim_at TEXT').run()
}

const clubPlanColumns = db.prepare("PRAGMA table_info('club_car_send_plans')").all()
const hasPlanIsActive = clubPlanColumns.some(column => column.name === 'is_active')
if (!hasPlanIsActive) {
  db.prepare('ALTER TABLE club_car_send_plans ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1').run()
}
const hasPlanLastRunAt = clubPlanColumns.some(column => column.name === 'last_run_at')
if (!hasPlanLastRunAt) {
  db.prepare('ALTER TABLE club_car_send_plans ADD COLUMN last_run_at TEXT').run()
}

export default db
