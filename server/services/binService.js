import path from 'path'
import { config } from '../config/index.js'
import db from '../utils/db.js'
import { ensureDir, removeFileIfExists } from '../utils/fileSystem.js'
import fs from 'fs'
import { removeBinReferences, replaceBinReferences } from './scheduledTaskService.js'
import { scheduler } from './taskScheduler.js'
import {
  bindClubMemberBinReferenceByRoleId,
  clearClubMemberBinReferenceByRoleId,
} from './clubCarService.js'

ensureDir(config.uploadDir)

const INVALID_FILENAME_CHARS = /[<>:"/\\|?*\x00-\x1F]/g

const decodeFilename = (name = '') => {
  try {
    return Buffer.from(name, 'latin1').toString('utf8')
  } catch {
    return name
  }
}

const sanitizeFilename = (name = '') => {
  const decoded = decodeFilename(path.basename(name)) || 'bin.bin'
  return decoded.replace(INVALID_FILENAME_CHARS, '_')
}

const extractRoleIdFromBinName = (name = '') => {
  const normalized = sanitizeFilename(name)
  const match = normalized.match(/^bin-[^-]+-\d+-(\d+)-.+\.bin$/i)
  return match?.[1] ? String(match[1]) : ''
}

const resolveBinPath = (row) => {
  if (!row) return ''

  const savedPath = typeof row.file_path === 'string' ? row.file_path.trim() : ''
  if (savedPath && fs.existsSync(savedPath)) {
    return savedPath
  }

  const storedName = typeof row.stored_name === 'string' ? row.stored_name.trim() : ''
  if (!storedName) {
    return savedPath
  }

  const fallbackPath = path.join(config.uploadDir, storedName)
  if (!fs.existsSync(fallbackPath)) {
    return savedPath || fallbackPath
  }

  // Migrate stale absolute paths (e.g. moved deployment directory).
  if (savedPath !== fallbackPath && row.id !== undefined) {
    db.prepare('UPDATE bins SET file_path = ? WHERE id = ?').run(fallbackPath, row.id)
    row.file_path = fallbackPath
  }

  return fallbackPath
}

const mapBin = (row) => {
  if (!row) return null
  const filePath = resolveBinPath(row)
  return {
    id: row.id,
    userId: row.user_id,
    originalName: row.original_name,
    storedName: row.stored_name,
    filePath,
    size: row.size,
    createdAt: row.created_at
  }
}

export const saveBinRecord = (userId, file, options = {}) => {
  const originalName = sanitizeFilename(file.originalname)
  const storedName = `${Date.now()}_${originalName}`
  const destination = path.join(config.uploadDir, storedName)
  fs.renameSync(file.path, destination)
  const newRoleId = extractRoleIdFromBinName(originalName)

  const createdAt = new Date().toISOString()
  const transaction = db.transaction(() => {
    const stmt = db.prepare(`
      INSERT INTO bins (user_id, original_name, stored_name, file_path, size, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `)
    const result = stmt.run(userId, originalName, storedName, destination, file.size, createdAt)
    const createdBin = mapBin({
      id: result.lastInsertRowid,
      user_id: userId,
      original_name: originalName,
      stored_name: storedName,
      file_path: destination,
      size: file.size,
      created_at: createdAt
    })

    const replaceBinId = options?.replaceBinId
    let replacedTaskCount = 0
    let removedBin = null
    let removedBinRoleId = ''
    if (replaceBinId !== undefined && replaceBinId !== null && String(replaceBinId).trim()) {
      const oldRow = db.prepare('SELECT * FROM bins WHERE id = ? AND user_id = ?').get(replaceBinId, userId)
      if (oldRow) {
        replacedTaskCount = replaceBinReferences(userId, oldRow.id, createdBin.id)
        db.prepare('DELETE FROM bins WHERE id = ?').run(oldRow.id)
        removedBin = mapBin(oldRow)
        removedBinRoleId = extractRoleIdFromBinName(oldRow.original_name || oldRow.stored_name || '')
      }
    }

    return {
      bin: createdBin,
      replacedTaskCount,
      removedBin,
      newRoleId,
      removedBinRoleId,
    }
  })

  try {
    const result = transaction()

    if (result.removedBin && result.removedBinRoleId && result.removedBinRoleId !== result.newRoleId) {
      clearClubMemberBinReferenceByRoleId(result.removedBinRoleId, {
        expectedPath: result.removedBin.filePath,
      })
    }

    if (result.newRoleId) {
      bindClubMemberBinReferenceByRoleId(
        result.newRoleId,
        result.bin.filePath,
        result.bin.originalName,
      )
    }

    if (result.replacedTaskCount > 0) {
      scheduler.reload()
    }

    return result
  } catch (error) {
    removeFileIfExists(destination)
    throw error
  }
}

export const listBins = (userId) => {
  const rows = db.prepare('SELECT * FROM bins WHERE user_id = ? ORDER BY created_at DESC').all(userId)
  return rows.map(mapBin)
}

export const getBinById = (userId, binId) => {
  const row = db.prepare('SELECT * FROM bins WHERE id = ? AND user_id = ?').get(binId, userId)
  return mapBin(row)
}

export const deleteBin = (userId, binId) => {
  const row = db.prepare('SELECT * FROM bins WHERE id = ? AND user_id = ?').get(binId, userId)
  if (!row) {
    const error = new Error('文件不存在或无权限')
    error.status = 404
    throw error
  }

  const removedTaskRefs = db.transaction(() => {
    const affectedTasks = removeBinReferences(userId, row.id)
    db.prepare('DELETE FROM bins WHERE id = ?').run(binId)
    return affectedTasks
  })()
  const removedBin = mapBin(row)
  const roleId = extractRoleIdFromBinName(row.original_name || row.stored_name || '')
  if (roleId) {
    clearClubMemberBinReferenceByRoleId(roleId, {
      expectedPath: removedBin.filePath,
    })
  }
  if ((removedTaskRefs?.affectedTasks || 0) > 0 || (removedTaskRefs?.deletedTasks || 0) > 0) {
    scheduler.reload()
  }
  removeFileIfExists(removedBin.filePath)
  return {
    ...removedBin,
    removedTaskRefs,
  }
}
