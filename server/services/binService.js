import path from 'path'
import { config } from '../config/index.js'
import db from '../utils/db.js'
import { ensureDir, removeFileIfExists } from '../utils/fileSystem.js'
import fs from 'fs'

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

const mapBin = (row) => {
  if (!row) return null
  return {
    id: row.id,
    userId: row.user_id,
    originalName: row.original_name,
    storedName: row.stored_name,
    filePath: row.file_path,
    size: row.size,
    createdAt: row.created_at
  }
}

export const saveBinRecord = (userId, file) => {
  const originalName = sanitizeFilename(file.originalname)
  const storedName = `${Date.now()}_${originalName}`
  const destination = path.join(config.uploadDir, storedName)
  fs.renameSync(file.path, destination)

  const createdAt = new Date().toISOString()
  const stmt = db.prepare(`
    INSERT INTO bins (user_id, original_name, stored_name, file_path, size, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `)
  const result = stmt.run(userId, originalName, storedName, destination, file.size, createdAt)
  return mapBin({
    id: result.lastInsertRowid,
    user_id: userId,
    original_name: originalName,
    stored_name: storedName,
    file_path: destination,
    size: file.size,
    created_at: createdAt
  })
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

  removeFileIfExists(row.file_path)
  db.prepare('DELETE FROM bins WHERE id = ?').run(binId)
  return mapBin(row)
}
