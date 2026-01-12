import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import db from '../utils/db.js'
import { config } from '../config/index.js'

export const ADMIN_ID = 'admin'
const ADMIN_CREATED_AT = new Date(0).toISOString()
const userFields = ['id', 'username', 'nickname', 'created_at']

const buildAdminUser = () => ({
  id: ADMIN_ID,
  username: config.admin.username,
  nickname: '管理员',
  created_at: ADMIN_CREATED_AT,
  role: 'admin'
})

const mapUser = (row) => {
  if (!row) return null
  return {
    id: row.id,
    username: row.username,
    nickname: row.nickname || row.username,
    createdAt: row.created_at,
    role: row.role || (row.id === ADMIN_ID ? 'admin' : 'user')
  }
}

export const getAdminProfile = () => mapUser(buildAdminUser())

export const registerUser = async (username, password, nickname) => {
  if (username === config.admin.username) {
    const error = new Error('用户名已存在')
    error.status = 409
    throw error
  }

  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username)
  if (existing) {
    const error = new Error('用户名已存在')
    error.status = 409
    throw error
  }

  const hashedPassword = await bcrypt.hash(password, 10)
  const createdAt = new Date().toISOString()
  const safeNickname = nickname?.trim() || username
  const stmt = db.prepare('INSERT INTO users (username, password, nickname, created_at) VALUES (?, ?, ?, ?)')
  const result = stmt.run(username, hashedPassword, safeNickname, createdAt)
  return mapUser({ id: result.lastInsertRowid, username, nickname: safeNickname, created_at: createdAt, role: 'user' })
}

const signAuthToken = (payload) => {
  if (config.tokenExpiresIn) {
    return jwt.sign(payload, config.jwtSecret, { expiresIn: config.tokenExpiresIn })
  }
  return jwt.sign(payload, config.jwtSecret)
}

export const authenticateUser = async (username, password) => {
  if (username === config.admin.username) {
    if (password !== config.admin.password) {
      const error = new Error('密码错误')
      error.status = 401
      throw error
    }
    const adminUser = buildAdminUser()
    const payload = { id: adminUser.id, username: adminUser.username, nickname: adminUser.nickname, role: adminUser.role }
    const token = signAuthToken(payload)
    return {
      token,
      user: mapUser(adminUser)
    }
  }

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username)
  if (!user) {
    const error = new Error('账号不存在')
    error.status = 404
    throw error
  }

  const match = await bcrypt.compare(password, user.password)
  if (!match) {
    const error = new Error('密码错误')
    error.status = 401
    throw error
  }

  const payload = { id: user.id, username: user.username, nickname: user.nickname, role: 'user' }
  const token = signAuthToken(payload)
  return {
    token,
    user: mapUser({ ...user, role: 'user' })
  }
}

export const getUserById = (id) => {
  if (String(id) === ADMIN_ID) {
    return mapUser(buildAdminUser())
  }
  const row = db.prepare(`SELECT ${userFields.join(', ')} FROM users WHERE id = ?`).get(id)
  return mapUser(row)
}
