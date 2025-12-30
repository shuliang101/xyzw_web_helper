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

const insertActivityStmt = db.prepare(`
  INSERT INTO user_activity (user_id, type, description, metadata, created_at)
  VALUES (?, ?, ?, ?, ?)
`)

const isBusyError = (error) => error?.code === 'SQLITE_BUSY' || error?.message?.includes('database is locked')
const queue = []
let isFlushing = false
let flushTimer = null
const MAX_QUEUE_ATTEMPTS = 10
const BASE_BACKOFF_MS = 100

const scheduleFlush = (delay = 0, force = false) => {
  if (flushTimer && !force) {
    return
  }
  if (flushTimer) {
    clearTimeout(flushTimer)
  }
  flushTimer = setTimeout(() => {
    flushTimer = null
    flushQueue()
  }, Math.max(0, delay))
}

const flushQueue = () => {
  if (isFlushing || queue.length === 0) {
    return
  }
  isFlushing = true

  while (queue.length > 0) {
    const entry = queue[0]
    try {
      insertActivityStmt.run(entry.userId, entry.type, entry.description, entry.metaString, entry.createdAt)
      queue.shift()
    } catch (error) {
      if (isBusyError(error)) {
        entry.attempts += 1
        if (entry.attempts > MAX_QUEUE_ATTEMPTS) {
          console.warn('记录用户动态失败，超过重试次数：', error)
          queue.shift()
          continue
        }
        isFlushing = false
        scheduleFlush(Math.min(entry.attempts * BASE_BACKOFF_MS, 1000), true)
        return
      }
      console.error('记录用户动态失败：', error)
      queue.shift()
    }
  }

  isFlushing = false

  if (queue.length > 0) {
    scheduleFlush()
  }
}

export const logActivity = (userId, type, description, metadata = null) => {
  if (!userId || !type || !description) {
    return
  }
  queue.push({
    userId: String(userId),
    type,
    description,
    metaString: metadata ? JSON.stringify(metadata) : null,
    createdAt: new Date().toISOString(),
    attempts: 0
  })
  scheduleFlush()
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
