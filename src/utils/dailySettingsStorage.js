import api from '@/api'

export const STORAGE_PREFIX = 'daily-settings'
const LOCAL_STORAGE_PREFIX = `${STORAGE_PREFIX}:local`
const REMOTE_STORAGE_CACHE_TTL = 5000

let remoteStorageCache = null
let remoteStorageCacheFetchedAt = 0

const unique = (list = []) => [...new Set(list.filter(Boolean))]
const buildRemoteKey = (key) => `${STORAGE_PREFIX}:${key}`
const buildLocalKey = (key) => `${LOCAL_STORAGE_PREFIX}:${key}`

export const createDefaultDailySettings = () => ({
  arenaFormation: 1,
  bossFormation: 1,
  bossTimes: 2,
  claimBottle: true,
  payRecruit: true,
  openBox: true,
  arenaEnable: true,
  claimHangUp: true,
  claimEmail: true,
  blackMarketPurchase: true
})

export const resetDailySettingsCache = () => {
  remoteStorageCache = null
  remoteStorageCacheFetchedAt = 0
}

export const buildDailySettingsKeySets = ({ authUser, token, role } = {}) => {
  const primaryKeys = []
  const legacyKeys = []
  const userKey = authUser?.username || authUser?.id || authUser?.userId || 'anonymous'
  const binName = token?.name || token?.sourceUrl || role?.name
  const stableRoleId = role?.roleId || role?.id || token?.id

  if (binName) {
    primaryKeys.push(`user:${userKey}|bin:${binName}`)
  }
  primaryKeys.push(`user:${userKey}`)

  if (stableRoleId) legacyKeys.push(String(stableRoleId))
  if (token?.name) legacyKeys.push(`token-name:${token.name}`)
  if (token?.id) legacyKeys.push(`token:${token.id}`)

  return {
    primaryKeys: unique(primaryKeys),
    legacyKeys: unique(legacyKeys)
  }
}

const fetchRemoteStorageRecords = async (force = false) => {
  const now = Date.now()
  if (!force && remoteStorageCache && now - remoteStorageCacheFetchedAt < REMOTE_STORAGE_CACHE_TTL) {
    return remoteStorageCache
  }
  try {
    const result = await api.storage.list()
    remoteStorageCache = result?.records || []
    remoteStorageCacheFetchedAt = now
    return remoteStorageCache
  } catch (error) {
    console.error('Failed to list storage records:', error)
    return []
  }
}

const findRemoteRecordFromList = async (searchKeys = [], primaryKeys = []) => {
  if (!searchKeys.length) return null
  const records = await fetchRemoteStorageRecords()
  if (!records.length) return null
  const keyMap = new Map(searchKeys.map(key => [buildRemoteKey(key), key]))
  const match = records.find(record => keyMap.has(record.key))
  if (!match) return null
  const baseKey = keyMap.get(match.key) || match.key.replace(`${STORAGE_PREFIX}:`, '')
  return {
    data: match.value,
    key: baseKey,
    source: 'remote:list',
    isLegacy: !primaryKeys.includes(baseKey)
  }
}

const fetchRemoteRecordByKey = async (key, primaryKeys = []) => {
  try {
    const result = await api.storage.get(buildRemoteKey(key))
    if (result?.record) {
      return {
        data: result.record.value,
        key,
        source: 'remote',
        isLegacy: !primaryKeys.includes(key)
      }
    }
  } catch (error) {
    if (error?.status !== 404) {
      console.error('Failed to load settings from server:', error)
    }
  }
  return null
}

const loadLocalRecord = (searchKeys = [], primaryKeys = []) => {
  for (const key of searchKeys) {
    try {
      const raw = localStorage.getItem(buildLocalKey(key))
      if (raw) {
        return {
          data: JSON.parse(raw),
          key,
          source: 'local',
          isLegacy: !primaryKeys.includes(key)
        }
      }
    } catch (error) {
      console.error('Failed to load settings locally:', error)
    }
  }
  return null
}

export const loadDailySettings = async ({ keySets, hasAuth = false } = {}) => {
  const { primaryKeys = [], legacyKeys = [] } = keySets || {}
  const searchKeys = [...primaryKeys, ...legacyKeys]
  if (!searchKeys.length) return null

  if (hasAuth) {
    for (const key of searchKeys) {
      const remoteResult = await fetchRemoteRecordByKey(key, primaryKeys)
      if (remoteResult) {
        return remoteResult
      }
    }
    const fallbackResult = await findRemoteRecordFromList(searchKeys, primaryKeys)
    if (fallbackResult) {
      return fallbackResult
    }
  }

  return loadLocalRecord(searchKeys, primaryKeys)
}

export const saveDailySettings = async ({
  keySets,
  data,
  hasAuth = false,
  remote = true,
  local = true,
  throwOnRemoteError = false
} = {}) => {
  const { primaryKeys = [], legacyKeys = [] } = keySets || {}
  const payload = data ?? null
  let remoteSaved = false
  let localSaved = false
  let remoteError = null

  if (remote && hasAuth && primaryKeys.length) {
    for (const key of primaryKeys) {
      try {
        await api.storage.set(buildRemoteKey(key), payload)
        remoteSaved = true
      } catch (error) {
        remoteError = error
        console.error('Failed to save settings to server:', error)
        if (throwOnRemoteError) {
          break
        }
      }
    }
  }

  if (local) {
    const allLocalKeys = unique([...primaryKeys, ...legacyKeys])
    for (const key of allLocalKeys) {
      try {
        localStorage.setItem(buildLocalKey(key), JSON.stringify(payload))
        localSaved = true
      } catch (error) {
        console.error('Failed to save settings locally:', error)
      }
    }
  }

  if (remoteError && throwOnRemoteError) {
    throw remoteError
  }

  if (remoteSaved) {
    resetDailySettingsCache()
  }

  return { remoteSaved, localSaved }
}
