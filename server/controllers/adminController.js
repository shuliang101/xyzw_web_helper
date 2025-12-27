import db from '../utils/db.js'
import bcrypt from 'bcryptjs'
import fs from 'fs'
import { listBins as listUserBinsService, deleteBin as deleteUserBinService, getBinById } from '../services/binService.js'
import { decryptWithPrivateKey, getPublicKeyPem } from '../utils/crypto.js'
import { logActivity } from '../services/activityService.js'

const sanitizeUser = (row) => ({
  id: row.id,
  username: row.username,
  nickname: row.nickname || row.username,
  createdAt: row.created_at,
  role: 'user'
})

export const listUsers = (req, res, next) => {
  try {
    const rows = db.prepare('SELECT id, username, nickname, created_at FROM users ORDER BY created_at DESC').all()
    res.json({ users: rows.map(sanitizeUser) })
  } catch (error) {
    next(error)
  }
}

export const getUserDetail = (req, res, next) => {
  try {
    const row = db.prepare('SELECT id, username, nickname, created_at FROM users WHERE id = ?').get(req.params.id)
    if (!row) {
      return res.status(404).json({ message: '用户不存在' })
    }
    res.json({ user: sanitizeUser(row) })
  } catch (error) {
    next(error)
  }
}

export const removeUser = (req, res, next) => {
  try {
    const existing = db.prepare('SELECT id FROM users WHERE id = ?').get(req.params.id)
    if (!existing) {
      return res.status(404).json({ message: '用户不存在' })
    }
    db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id)
    res.json({ success: true })
  } catch (error) {
    next(error)
  }
}

export const listUserBins = (req, res, next) => {
  try {
    const bins = listUserBinsService(req.params.id)
    res.json({ bins })
  } catch (error) {
    next(error)
  }
}

export const removeUserBin = (req, res, next) => {
  try {
    const { id: userId, binId } = req.params
    const bin = deleteUserBinService(userId, binId)
    logActivity(userId, 'bin_removed_by_admin', `管理员 ${req.user.username} 删除 BIN：${bin?.originalName || bin?.storedName || binId}`, {
      binId,
      admin: req.user.username
    })
    res.json({ bin })
  } catch (error) {
    next(error)
  }
}

export const downloadUserBin = (req, res, next) => {
  try {
    const { id: userId, binId } = req.params
    const bin = getBinById(userId, binId)
    if (!bin) {
      return res.status(404).json({ message: '文件不存在' })
    }
    res.setHeader('Content-Type', 'application/octet-stream')
    const filename = encodeURIComponent(bin.originalName || 'bin.bin')
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${filename}`)
    const stream = fs.createReadStream(bin.filePath)
    stream.on('error', (err) => next(err))
    stream.pipe(res)
  } catch (error) {
    next(error)
  }
}

export const updateUserPassword = async (req, res, next) => {
  try {
    const { password } = req.body
    if (!password) {
      return res.status(400).json({ message: '请输入新密码' })
    }
    let decryptedPassword
    try {
      decryptedPassword = decryptWithPrivateKey(password)
    } catch (error) {
      return res.status(400).json({ message: '密码解密失败' })
    }
    if (!decryptedPassword) {
      return res.status(400).json({ message: '密码不能为空' })
    }
    const user = db.prepare('SELECT id FROM users WHERE id = ?').get(req.params.id)
    if (!user) {
      return res.status(404).json({ message: '用户不存在' })
    }
    const hashedPassword = await bcrypt.hash(decryptedPassword, 10)
    db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashedPassword, req.params.id)
    res.json({ success: true })
  } catch (error) {
    next(error)
  }
}

export const getAdminPublicKey = (req, res) => {
  res.json({ publicKey: getPublicKeyPem() })
}
