import { authenticateUser, registerUser } from '../services/authService.js'
import { logActivity } from '../services/activityService.js'

export const register = async (req, res, next) => {
  try {
    const { username, password, nickname } = req.body
    if (!username || !password || !nickname) {
      return res.status(400).json({ message: '请输入用户名、昵称和密码' })
    }
    const user = await registerUser(username.trim(), password, nickname.trim())
    logActivity(user.id, 'account_register', `完成注册：${user.nickname || user.username}`, {
      username: user.username,
      nickname: user.nickname
    })
    res.status(201).json({ user })
  } catch (error) {
    next(error)
  }
}

export const login = async (req, res, next) => {
  try {
    const { username, password } = req.body
    if (!username || !password) {
      return res.status(400).json({ message: '请输入用户名和密码' })
    }
    const result = await authenticateUser(username, password)
    if (result.user?.role === 'user') {
      logActivity(result.user.id, 'auth_login', `登录成功：${result.user.nickname || result.user.username}`, {
        username: result.user.username
      })
    }
    res.json(result)
  } catch (error) {
    next(error)
  }
}

export const profile = (req, res) => {
  res.json({ user: req.user })
}
