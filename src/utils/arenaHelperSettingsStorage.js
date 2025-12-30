import api from '@/api'
import { buildDailySettingsKeySets } from '@/utils/dailySettingsStorage'

const STORAGE_PREFIX = 'arena-helper-settings'
const LOCAL_STORAGE_PREFIX = `${STORAGE_PREFIX}:local`

const buildRemoteKey = (key) => `${STORAGE_PREFIX}:${key}`
const buildLocalKey = (key) => `${LOCAL_STORAGE_PREFIX}:${key}`
const unique = (list = []) => [...new Set(list.filter(Boolean))]

export const createDefaultArenaHelperSettings = () => ({
  strategy: 'first', // first = 原逻辑
  powerMin: null, // 单位：亿
  powerMax: null,
  scoreMin: null,
  scoreMax: null
})

export const buildArenaHelperSettingsKeySets = (payload = {}) => buildDailySettingsKeySets(payload)

const loadFromLocal = (keys = []) => {
  for (const key of keys) {
    try {
      const raw = localStorage.getItem(buildLocalKey(key))
      if (raw) {
        return { data: JSON.parse(raw), key, source: 'local' }
      }
    } catch (error) {
      console.error('[arena-settings] Failed to parse local record:', error)
    }
  }
  return null
}

const loadFromRemote = async (keys = [], hasAuth = false) => {
  if (!hasAuth) return null
  for (const key of keys) {
    try {
      const result = await api.storage.get(buildRemoteKey(key))
      if (result?.record) {
        return { data: result.record.value, key, source: 'remote' }
      }
    } catch (error) {
      if (error?.status !== 404) {
        console.error('[arena-settings] Failed to load remote record:', error)
      }
    }
  }
  return null
}

export const loadArenaHelperSettings = async ({ keySets, hasAuth = false } = {}) => {
  const { primaryKeys = [], legacyKeys = [] } = keySets || {}
  const searchKeys = unique([...primaryKeys, ...legacyKeys])
  if (!searchKeys.length) {
    return { data: createDefaultArenaHelperSettings(), source: 'default' }
  }

  const remoteRecord = await loadFromRemote(searchKeys, hasAuth)
  if (remoteRecord?.data) {
    return remoteRecord
  }

  const localRecord = loadFromLocal(searchKeys)
  if (localRecord?.data) {
    return localRecord
  }

  return { data: createDefaultArenaHelperSettings(), source: 'default' }
}

export const saveArenaHelperSettings = async ({
  keySets,
  data,
  hasAuth = false,
  remote = true,
  local = true
} = {}) => {
  const payload = data ?? createDefaultArenaHelperSettings()
  const { primaryKeys = [], legacyKeys = [] } = keySets || {}
  let remoteSaved = false

  if (remote && hasAuth && primaryKeys.length) {
    for (const key of primaryKeys) {
      await api.storage.set(buildRemoteKey(key), payload)
      remoteSaved = true
    }
  }

  if (local) {
    const localKeys = unique([...primaryKeys, ...legacyKeys])
    for (const key of localKeys) {
      try {
        localStorage.setItem(buildLocalKey(key), JSON.stringify(payload))
      } catch (error) {
        console.error('[arena-settings] Failed to store record locally:', error)
      }
    }
  }

  return { remoteSaved }
}

