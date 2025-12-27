import db from '../utils/db.js'

const mapStorage = row => {
  if (!row) return null
  return {
    id: row.id,
    key: row.storage_key,
    value: JSON.parse(row.storage_value),
    updatedAt: row.updated_at
  }
}

export const upsertStorage = (userId, key, value) => {
  const now = new Date().toISOString()
  const serialized = JSON.stringify(value ?? null)
  const stmt = db.prepare(`
    INSERT INTO user_storage (user_id, storage_key, storage_value, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(user_id, storage_key)
    DO UPDATE SET storage_value = excluded.storage_value, updated_at = excluded.updated_at
  `)
  stmt.run(userId, key, serialized, now)
  const row = db.prepare('SELECT * FROM user_storage WHERE user_id = ? AND storage_key = ?').get(userId, key)
  return mapStorage(row)
}

export const getStorage = (userId, key) => {
  const row = db.prepare('SELECT * FROM user_storage WHERE user_id = ? AND storage_key = ?').get(userId, key)
  return mapStorage(row)
}

export const listStorage = (userId) => {
  const rows = db.prepare('SELECT * FROM user_storage WHERE user_id = ? ORDER BY updated_at DESC').all(userId)
  return rows.map(mapStorage)
}

export const removeStorage = (userId, key) => {
  db.prepare('DELETE FROM user_storage WHERE user_id = ? AND storage_key = ?').run(userId, key)
}
