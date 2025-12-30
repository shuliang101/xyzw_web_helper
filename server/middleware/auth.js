import jwt from 'jsonwebtoken'
import { config } from '../config/index.js'
import { getUserById, getAdminProfile, ADMIN_ID } from '../services/authService.js'

export const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization
  if (!authHeader) {
    return res.status(401).json({ message: '未提供凭证' })
  }

  const token = authHeader.split(' ')[1]
  if (!token) {
    return res.status(401).json({ message: '凭证无效' })
  }

  try {
    const decoded = jwt.verify(token, config.jwtSecret)
    if (decoded.role === 'admin' && decoded.id === ADMIN_ID) {
      req.user = getAdminProfile()
      return next()
    }

    const user = getUserById(decoded.id)
    if (!user) {
      return res.status(401).json({ message: '用户不存在' })
    }
    req.user = user
    next()
  } catch (error) {
    return res.status(401).json({ message: '凭证验证失败' })
  }
}

export const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ message: '需要管理员权限' })
  }
  next()
}
