import db from '../utils/db.js'

const parseMetadata = (value) => {
  if (!value) return null
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

const mapActivity = (row) => ({
  id: row.id,
  userId: row.user_id,
  type: row.type,
  message: row.description,
  metadata: parseMetadata(row.metadata),
  createdAt: row.created_at
})

export const logActivity = (userId, type, description, metadata = null) => {
  if (!userId || !type || !description) {
    return
  }
  try {
    const metaString = metadata ? JSON.stringify(metadata) : null
    db.prepare(`
      INSERT INTO user_activity (user_id, type, description, metadata, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(String(userId), type, description, metaString, new Date().toISOString())
  } catch (error) {
    console.error('记录用户动态失败', error)
  }
}

export const getRecentActivities = (userId, limit = 10) => {
  if (!userId) return []
  const safeLimit = Math.max(1, Math.min(Number(limit) || 10, 50))
  const rows = db.prepare(`
    SELECT id, user_id, type, description, metadata, created_at
    FROM user_activity
    WHERE user_id = ?
    ORDER BY datetime(created_at) DESC
    LIMIT ?
  `).all(String(userId), safeLimit)
  return rows.map(mapActivity)
}
