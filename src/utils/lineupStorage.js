import api from "@/api";

const STORAGE_PREFIX = "saved-lineups";
const LOCAL_STORAGE_PREFIX = `${STORAGE_PREFIX}:local`;
const LEGACY_LOCAL_STORAGE_PREFIX = "saved_lineups";

const unique = (list = []) => [...new Set(list.filter(Boolean))];
const buildRemoteKey = (key) => `${STORAGE_PREFIX}:${key}`;
const buildLocalKey = (key) => `${LOCAL_STORAGE_PREFIX}:${key}`;
const buildLegacyLocalKey = (tokenId) =>
  tokenId ? `${LEGACY_LOCAL_STORAGE_PREFIX}_${tokenId}` : null;

export const buildLineupStorageKeySets = ({ authUser, token, role } = {}) => {
  const primaryKeys = [];
  const legacyKeys = [];
  const userKey =
    authUser?.username || authUser?.id || authUser?.userId || "anonymous";
  const roleId = role?.roleId || role?.id;
  const roleName = role?.roleName || role?.name;

  if (roleId) {
    primaryKeys.push(`user:${userKey}|role:${roleId}`);
    legacyKeys.push(`role:${roleId}`);
  }

  if (roleName) {
    legacyKeys.push(`role-name:${roleName}`);
  }

  if (token?.id) {
    legacyKeys.push(`token:${token.id}`);
  }

  if (token?.name) {
    legacyKeys.push(`token-name:${token.name}`);
    legacyKeys.push(`user:${userKey}|bin:${token.name}`);
  }

  if (token?.sourceUrl) {
    legacyKeys.push(`user:${userKey}|url:${token.sourceUrl}`);
  }

  return {
    primaryKeys: unique(primaryKeys),
    legacyKeys: unique(legacyKeys),
    legacyLocalKey: buildLegacyLocalKey(token?.id),
    userScopedPrefix: `${STORAGE_PREFIX}:user:${userKey}|`,
  };
};

const normalizeLineups = (data) => (Array.isArray(data) ? data : []);

const loadFromLocal = ({ primaryKeys = [], legacyKeys = [], legacyLocalKey } = {}) => {
  const searchKeys = unique([...primaryKeys, ...legacyKeys]);

  for (const key of searchKeys) {
    try {
      const raw = localStorage.getItem(buildLocalKey(key));
      if (raw) {
        return { data: normalizeLineups(JSON.parse(raw)), source: "local", key };
      }
    } catch (error) {
      console.error("[lineup-storage] Failed to parse local record:", error);
    }
  }

  if (legacyLocalKey) {
    try {
      const raw = localStorage.getItem(legacyLocalKey);
      if (raw) {
        return {
          data: normalizeLineups(JSON.parse(raw)),
          source: "local-legacy",
          key: legacyLocalKey,
        };
      }
    } catch (error) {
      console.error("[lineup-storage] Failed to parse legacy local record:", error);
    }
  }

  return null;
};

const loadFromRemoteList = async ({ searchKeys = [], userScopedPrefix = "" } = {}) => {
  try {
    const result = await api.storage.list();
    const records = Array.isArray(result?.records) ? result.records : [];
    if (!records.length) return null;

    const expectedKeys = new Set(searchKeys.map((key) => buildRemoteKey(key)));
    const exactMatch = records.find((record) => expectedKeys.has(record.key));
    if (exactMatch) {
      return {
        data: normalizeLineups(exactMatch.value),
        source: "remote:list",
        key: exactMatch.key,
      };
    }

    const scopedRecords = userScopedPrefix
      ? records.filter((record) => String(record.key || "").startsWith(userScopedPrefix))
      : [];
    if (scopedRecords.length > 0) {
      scopedRecords.sort((a, b) => {
        const aTime = new Date(a?.updatedAt || a?.updated_at || 0).getTime();
        const bTime = new Date(b?.updatedAt || b?.updated_at || 0).getTime();
        return bTime - aTime;
      });
      return {
        data: normalizeLineups(scopedRecords[0].value),
        source: "remote:list:fallback",
        key: scopedRecords[0].key,
      };
    }
  } catch (error) {
    console.error("[lineup-storage] Failed to list remote records:", error);
  }

  return null;
};

const loadFromRemote = async (
  { primaryKeys = [], legacyKeys = [], userScopedPrefix = "" } = {},
  hasAuth = false,
) => {
  if (!hasAuth) return null;

  const searchKeys = unique([...primaryKeys, ...legacyKeys]);
  for (const key of searchKeys) {
    try {
      const result = await api.storage.get(buildRemoteKey(key));
      if (result?.record) {
        return {
          data: normalizeLineups(result.record.value),
          source: "remote",
          key,
        };
      }
    } catch (error) {
      if (error?.status !== 404) {
        console.error("[lineup-storage] Failed to load remote record:", error);
      }
    }
  }

  return loadFromRemoteList({ searchKeys, userScopedPrefix });
};

const saveToLocal = (keySets = {}, payload = []) => {
  const { primaryKeys = [] } = keySets;
  const keys = unique([...primaryKeys]);
  let saved = false;

  for (const key of keys) {
    try {
      localStorage.setItem(buildLocalKey(key), JSON.stringify(payload));
      saved = true;
    } catch (error) {
      console.error("[lineup-storage] Failed to store local record:", error);
    }
  }

  return saved;
};

export const loadLineupSettings = async ({ keySets, hasAuth = false } = {}) => {
  const localRecord = loadFromLocal(keySets);
  if (localRecord) {
    return localRecord;
  }

  const remoteRecord = await loadFromRemote(keySets, hasAuth);
  if (remoteRecord) {
    saveToLocal(keySets, remoteRecord.data);
    return remoteRecord;
  }

  return { data: [], source: "default" };
};

export const saveLineupSettings = async ({
  keySets,
  data,
  hasAuth = false,
  remote = true,
  local = true,
} = {}) => {
  const payload = normalizeLineups(data);
  const { primaryKeys = [] } = keySets || {};
  let remoteSaved = false;
  let remoteError = null;

  if (remote && hasAuth && primaryKeys.length) {
    for (const key of primaryKeys) {
      try {
        await api.storage.set(buildRemoteKey(key), payload);
        remoteSaved = true;
      } catch (error) {
        remoteError = error;
        console.error("[lineup-storage] Failed to save remote record:", error);
      }
    }
  }

  const localSaved = local ? saveToLocal(keySets, payload) : false;

  return {
    remoteSaved,
    localSaved,
    remoteError,
  };
};
