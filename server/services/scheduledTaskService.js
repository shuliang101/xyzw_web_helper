/**
 * 定时任务 CRUD 服务
 */
import db from '../utils/db.js'

const mapTask = (row) => {
  if (!row) return null
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    runType: row.run_type,
    runTime: row.run_time,
    cronExpression: row.cron_expression,
    binIds: JSON.parse(row.token_ids || '[]'),   // 存储 bin 文件 ID 数组
    selectedTasks: JSON.parse(row.selected_tasks || '[]'),
    taskSettings: row.task_settings ? JSON.parse(row.task_settings) : {},
    enabled: row.enabled === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastRunAt: row.last_run_at,
    nextRunAt: row.next_run_at,
  }
}

const mapLog = (row) => {
  if (!row) return null
  return {
    id: row.id,
    taskId: row.task_id,
    userId: row.user_id,
    tokenId: row.token_id,
    status: row.status,
    logs: row.logs ? JSON.parse(row.logs) : [],
    startedAt: row.started_at,
    finishedAt: row.finished_at,
  }
}

export const listTasks = (userId) => {
  const rows = db.prepare('SELECT * FROM scheduled_tasks WHERE user_id = ? ORDER BY created_at DESC').all(userId)
  return rows.map(mapTask)
}

export const getTask = (userId, taskId) => {
  const row = db.prepare('SELECT * FROM scheduled_tasks WHERE id = ? AND user_id = ?').get(taskId, userId)
  return mapTask(row)
}

export const getAllEnabledTasks = () => {
  const rows = db.prepare('SELECT * FROM scheduled_tasks WHERE enabled = 1').all()
  return rows.map(mapTask)
}

export const createTask = (userId, data) => {
  const now = new Date().toISOString()
  const stmt = db.prepare(`
    INSERT INTO scheduled_tasks (user_id, name, run_type, run_time, cron_expression, token_ids, selected_tasks, task_settings, enabled, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  const result = stmt.run(
    userId,
    data.name,
    data.runType,
    data.runTime || null,
    data.cronExpression || null,
    JSON.stringify(data.binIds || []),
    JSON.stringify(data.selectedTasks || []),
    data.taskSettings ? JSON.stringify(data.taskSettings) : null,
    data.enabled !== false ? 1 : 0,
    now,
    now,
  )
  return getTask(userId, result.lastInsertRowid)
}

export const updateTask = (userId, taskId, data) => {
  const existing = getTask(userId, taskId)
  if (!existing) return null
  const now = new Date().toISOString()
  const fields = []
  const values = []

  if (data.name !== undefined) { fields.push('name = ?'); values.push(data.name) }
  if (data.runType !== undefined) { fields.push('run_type = ?'); values.push(data.runType) }
  if (data.runTime !== undefined) { fields.push('run_time = ?'); values.push(data.runTime) }
  if (data.cronExpression !== undefined) { fields.push('cron_expression = ?'); values.push(data.cronExpression) }
  if (data.binIds !== undefined) { fields.push('token_ids = ?'); values.push(JSON.stringify(data.binIds)) }
  if (data.selectedTasks !== undefined) { fields.push('selected_tasks = ?'); values.push(JSON.stringify(data.selectedTasks)) }
  if (data.taskSettings !== undefined) { fields.push('task_settings = ?'); values.push(JSON.stringify(data.taskSettings)) }
  if (data.enabled !== undefined) { fields.push('enabled = ?'); values.push(data.enabled ? 1 : 0) }

  fields.push('updated_at = ?'); values.push(now)
  values.push(taskId, userId)

  db.prepare(`UPDATE scheduled_tasks SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`).run(...values)
  return getTask(userId, taskId)
}

export const deleteTask = (userId, taskId) => {
  const existing = getTask(userId, taskId)
  if (!existing) return false
  db.prepare('DELETE FROM scheduled_tasks WHERE id = ? AND user_id = ?').run(taskId, userId)
  return true
}

export const toggleTask = (userId, taskId) => {
  const existing = getTask(userId, taskId)
  if (!existing) return null
  return updateTask(userId, taskId, { enabled: !existing.enabled })
}

export const updateLastRun = (taskId, nextRunAt = null) => {
  db.prepare('UPDATE scheduled_tasks SET last_run_at = ?, next_run_at = ? WHERE id = ?')
    .run(new Date().toISOString(), nextRunAt, taskId)
}

const normalizeBinId = (value) => String(value)

export const removeBinReferences = (userId, binId) => {
  const targetId = normalizeBinId(binId)
  const now = new Date().toISOString()
  const rows = db.prepare('SELECT id, token_ids FROM scheduled_tasks WHERE user_id = ?').all(userId)

  let affectedTasks = 0
  let deletedTasks = 0
  for (const row of rows) {
    const currentIds = JSON.parse(row.token_ids || '[]')
    const nextIds = currentIds.filter(id => normalizeBinId(id) !== targetId)
    if (nextIds.length === currentIds.length) continue

    if (nextIds.length === 0) {
      db.prepare('DELETE FROM scheduled_tasks WHERE id = ? AND user_id = ?')
        .run(row.id, userId)
      deletedTasks += 1
    } else {
      db.prepare('UPDATE scheduled_tasks SET token_ids = ?, updated_at = ? WHERE id = ? AND user_id = ?')
        .run(JSON.stringify(nextIds), now, row.id, userId)
    }
    affectedTasks += 1
  }

  return {
    affectedTasks,
    deletedTasks,
  }
}

export const replaceBinReferences = (userId, oldBinId, newBinId) => {
  const oldId = normalizeBinId(oldBinId)
  const replacementId = newBinId
  const now = new Date().toISOString()
  const rows = db.prepare('SELECT id, token_ids FROM scheduled_tasks WHERE user_id = ?').all(userId)

  let affectedTasks = 0
  for (const row of rows) {
    const currentIds = JSON.parse(row.token_ids || '[]')
    let changed = false
    const seen = new Set()
    const nextIds = []

    for (const id of currentIds) {
      const mapped = normalizeBinId(id) === oldId ? replacementId : id
      if (normalizeBinId(id) === oldId) {
        changed = true
      }
      const dedupeKey = normalizeBinId(mapped)
      if (seen.has(dedupeKey)) continue
      seen.add(dedupeKey)
      nextIds.push(mapped)
    }

    if (!changed) continue

    db.prepare('UPDATE scheduled_tasks SET token_ids = ?, updated_at = ? WHERE id = ? AND user_id = ?')
      .run(JSON.stringify(nextIds), now, row.id, userId)
    affectedTasks += 1
  }

  return affectedTasks
}

// 执行日志
export const createRunLog = (taskId, userId, tokenId) => {
  const stmt = db.prepare(`
    INSERT INTO task_run_logs (task_id, user_id, token_id, status, logs, started_at)
    VALUES (?, ?, ?, 'running', '[]', ?)
  `)
  const result = stmt.run(taskId, userId, tokenId, new Date().toISOString())
  return result.lastInsertRowid
}

export const updateRunLog = (logId, status, logs) => {
  db.prepare('UPDATE task_run_logs SET status = ?, logs = ?, finished_at = ? WHERE id = ?')
    .run(status, JSON.stringify(logs), new Date().toISOString(), logId)
}

export const getTaskLogs = (taskId, limit = 50) => {
  const rows = db.prepare('SELECT * FROM task_run_logs WHERE task_id = ? ORDER BY started_at DESC LIMIT ?').all(taskId, limit)
  return rows.map(mapLog)
}
