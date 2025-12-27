import { upsertStorage, getStorage, listStorage, removeStorage } from '../services/storageService.js'

export const setStorage = (req, res, next) => {
  try {
    const { key, value } = req.body
    if (!key) {
      return res.status(400).json({ message: '缺少 key' })
    }
    const record = upsertStorage(req.user.id, key, value)
    res.json({ record })
  } catch (error) {
    next(error)
  }
}

export const getStorageByKey = (req, res, next) => {
  try {
    const record = getStorage(req.user.id, req.params.key)
    if (!record) {
      return res.status(404).json({ message: '记录不存在' })
    }
    res.json({ record })
  } catch (error) {
    next(error)
  }
}

export const listAllStorage = (req, res, next) => {
  try {
    const records = listStorage(req.user.id)
    res.json({ records })
  } catch (error) {
    next(error)
  }
}

export const deleteStorage = (req, res, next) => {
  try {
    removeStorage(req.user.id, req.params.key)
    res.status(204).end()
  } catch (error) {
    next(error)
  }
}
