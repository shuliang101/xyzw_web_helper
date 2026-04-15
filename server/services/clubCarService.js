import fs from 'fs'
import path from 'path'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import db from '../utils/db.js'
import { config } from '../config/index.js'
import { ensureDir, removeFileIfExists } from '../utils/fileSystem.js'
import { GameWebSocketClient, buildGameWsUrl, transformBinToToken } from '../utils/gameWebSocket.js'

const FOUR_HOURS_MS = 4 * 60 * 60 * 1000
const CLUB_MEMBER_TOKEN_SCOPE = 'club_car_member_bind'
const CLUB_MEMBER_TOKEN_EXPIRES_IN = '2h'
const CLUB_MASTER_BIN_DIR = config.clubCarMasterBinDir
const CLUB_MEMBER_BIN_DIR = config.clubCarMemberBinDir
const SEND_MODE_VALUES = new Set(['red', 'gold', 'no_refresh'])
const SEND_WINDOW_START_MINUTES = 6 * 60
const SEND_WINDOW_END_MINUTES = 20 * 60
const CAR_RESEARCH_PART_COSTS = [
  20, 21, 22, 23, 24, 26, 28, 30, 32, 34, 36, 38, 40, 42, 44, 47, 50, 53, 56,
  59, 62, 65, 68, 71, 74, 78, 82, 86, 90, 94, 99, 104, 109, 114, 119, 126, 133,
  140, 147, 154, 163, 172, 181, 190, 199, 210, 221, 232, 243, 369, 393, 422,
  457, 498, 548, 607, 678, 763, 865, 1011,
]

ensureDir(config.clubCarDataDir)
ensureDir(CLUB_MASTER_BIN_DIR)
ensureDir(CLUB_MEMBER_BIN_DIR)

const INVALID_FILENAME_CHARS = /[<>:"/\\|?*\x00-\x1F]/g
const CJK_REGEX = /[\u4e00-\u9fff]/

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))

const decodeFilename = (name = '') => {
  const raw = String(name || '')
  if (!raw) return ''
  if (CJK_REGEX.test(raw)) return raw
  try {
    const decoded = Buffer.from(raw, 'latin1').toString('utf8')
    if (CJK_REGEX.test(decoded)) return decoded
  } catch {
    // ignore
  }
  return raw
}

const sanitizeFilename = (name = '') => {
  const safeName = path.basename(decodeFilename(name || '')).trim() || 'role.bin'
  return safeName.replace(INVALID_FILENAME_CHARS, '_')
}

const normalizeTimeHHmm = (value, fallback = '12:00') => {
  const text = String(value || '').trim()
  const match = text.match(/^(\d{1,2}):(\d{1,2})$/)
  if (!match) return fallback
  const hour = Number(match[1])
  const minute = Number(match[2])
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return fallback
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

const toMinutesOfDay = (hhmm) => {
  const [hourText = '0', minuteText = '0'] = String(hhmm || '00:00').split(':')
  const hour = Number(hourText)
  const minute = Number(minuteText)
  return (hour * 60) + minute
}

const getForwardGapMinutes = (startHHmm, endHHmm) => {
  const start = toMinutesOfDay(startHHmm)
  const end = toMinutesOfDay(endHHmm)
  return (end - start + 24 * 60) % (24 * 60)
}

const ensureSendClaimGap = (sendHHmm, claimHHmm) => {
  const gap = getForwardGapMinutes(sendHHmm, claimHHmm)
  if (gap < 240) {
    const err = new Error('claim time must be at least 4 hours after send time')
    err.status = 400
    throw err
  }
}

const formatHHmm = (date = new Date()) =>
  `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`

const parseDateSafe = (value) => {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date
}

const isSameLocalDate = (dateA, dateB) => (
  dateA.getFullYear() === dateB.getFullYear()
  && dateA.getMonth() === dateB.getMonth()
  && dateA.getDate() === dateB.getDate()
)

const isSameDayByIso = (isoText, now = new Date()) => {
  const date = parseDateSafe(isoText)
  if (!date) return false
  return isSameLocalDate(date, now)
}

const hasPlanSucceededToday = (planRow, now = new Date()) => {
  const lastRunAt = parseDateSafe(planRow?.last_run_at)
  if (!lastRunAt) return false
  return isSameLocalDate(lastRunAt, now)
}

const isMondayToWednesdayWindow = (now = new Date()) => {
  const weekday = now.getDay() // 0..6, Monday=1
  const minutes = (now.getHours() * 60) + now.getMinutes()
  return weekday >= 1 && weekday <= 3
    && minutes >= SEND_WINDOW_START_MINUTES
    && minutes <= SEND_WINDOW_END_MINUTES
}

const mapConfig = (row) => {
  if (!row) return null
  return {
    masterBinPath: row.master_bin_path || '',
    masterBinName: decodeFilename(row.master_bin_name || ''),
    sendCron: row.send_cron || '0 12 * * *',
    claimCron: row.claim_cron || '0 16 * * *',
    enabled: row.enabled === 1,
    minColor: Number(row.min_color ?? 4),
    maxRefreshTimes: Number(row.max_refresh_times ?? 20),
    updatedAt: row.updated_at,
  }
}

const mapMember = (row) => {
  if (!row) return null
  return {
    id: row.id,
    roleId: String(row.role_id),
    name: row.name,
    avatar: row.avatar || '',
    power: Number(row.power || 0),
    position: Number(row.position || 0),
    targetRoleId: row.target_role_id ? String(row.target_role_id) : '',
    sendTime: normalizeTimeHHmm(row.send_time, '12:00'),
    claimTime: normalizeTimeHHmm(row.claim_time, '16:00'),
    claimEnabled: row.claim_enabled === 1,
    lastSendAt: row.last_send_at || '',
    lastHelpAt: row.last_help_at || '',
    lastClaimAt: row.last_claim_at || '',
    boundBinName: decodeFilename(row.bound_bin_name || ''),
    boundAt: row.bound_at || '',
    isActive: row.is_active === 1,
    hasPassword: !!row.password_hash,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

const mapClubInfo = (row) => {
  if (!row) return null
  return {
    clubId: row.club_id || '',
    clubName: row.club_name || '',
    clubAvatar: row.club_avatar || '',
    leaderRoleId: row.leader_role_id || '',
    leaderName: row.leader_name || '',
    updatedAt: row.updated_at || '',
  }
}

const mapRunLog = (row) => {
  if (!row) return null
  return {
    id: row.id,
    runType: row.run_type,
    status: row.status,
    message: row.message,
    detail: row.detail ? JSON.parse(row.detail) : null,
    createdAt: row.created_at,
  }
}

const mapPlan = (row) => {
  if (!row) return null
  const sender = getMemberRowByRoleId(row.sender_role_id)
  const target = getMemberRowByRoleId(row.target_role_id)
  return {
    id: row.id,
    weekday: Number(row.weekday || 1),
    targetRoleId: String(row.target_role_id),
    senderRoleId: String(row.sender_role_id),
    sendMode: row.send_mode || 'red',
    sendTime: normalizeTimeHHmm(row.send_time, '06:00'),
    isActive: row.is_active === 1,
    lastRunAt: row.last_run_at || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    sender: sender ? mapMember(sender) : null,
    target: target ? mapMember(target) : null,
  }
}

const getConfigRow = () => db.prepare('SELECT * FROM club_car_config WHERE id = 1').get()
const getClubInfoRow = () => db.prepare('SELECT * FROM club_car_club_info WHERE id = 1').get()
const getMemberRowById = (id) => db.prepare('SELECT * FROM club_car_members WHERE id = ?').get(id)
const getMemberRowByRoleId = (roleId) => db.prepare('SELECT * FROM club_car_members WHERE role_id = ?').get(String(roleId))
const getPlanRowById = (id) => db.prepare('SELECT * FROM club_car_send_plans WHERE id = ?').get(id)
const getPlanRowsBySenderRoleId = (roleId) => db.prepare(`
  SELECT * FROM club_car_send_plans
  WHERE sender_role_id = ? AND is_active = 1
  ORDER BY weekday ASC, send_time ASC, id ASC
`).all(String(roleId))

const parseJsonSafe = (value, fallback = null) => {
  try {
    return value ? JSON.parse(value) : fallback
  } catch {
    return fallback
  }
}

const pickFirst = (...values) => {
  for (const value of values) {
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      return String(value)
    }
  }
  return ''
}

const normalizeWeekday = (value, fallback = 1) => {
  const weekday = Number(value)
  if (!Number.isInteger(weekday) || weekday < 1 || weekday > 3) return fallback
  return weekday
}

const normalizeSendMode = (value, fallback = 'red') => {
  const mode = String(value || '').trim().toLowerCase()
  return SEND_MODE_VALUES.has(mode) ? mode : fallback
}

const normalizeSendTime = (value, fallback = '06:00') => {
  const time = normalizeTimeHHmm(value, fallback)
  const minutes = toMinutesOfDay(time)
  if (minutes < SEND_WINDOW_START_MINUTES || minutes > SEND_WINDOW_END_MINUTES) {
    const err = new Error('send time must be between 06:00 and 20:00')
    err.status = 400
    throw err
  }
  return time
}

const getLocalWeekday = (date = new Date()) => {
  const weekday = date.getDay()
  return weekday >= 1 && weekday <= 3 ? weekday : 0
}

const normalizeMemberSnapshot = (member, index) => ({
  roleId: String(member?.roleId || member?.role_id || member?.id || ''),
  name: String(member?.name || member?.nickname || member?.roleName || `member_${index + 1}`),
  avatar: pickFirst(
    member?.avatar,
    member?.headImg,
    member?.head,
    member?.icon,
    member?.photo,
    member?.pic,
  ),
  power: Number(member?.power || member?.fightValue || 0),
  position: Number(member?.position || member?.duty || 0),
})

const buildSnapshotFromLegionResp = (legionResp) => {
  const info = legionResp?.body?.info || legionResp?.info || {}
  const membersMap = info?.members || {}
  const members = Object.values(membersMap || {})
    .map((member, index) => normalizeMemberSnapshot(member, index))
    .filter(member => member.roleId)

  const leaderRoleId = pickFirst(
    info?.leaderRoleId,
    info?.ownerRoleId,
    info?.leaderId,
    info?.ownerId,
  )
  const leaderMember = members.find(item => item.roleId === leaderRoleId) || null

  return {
    clubId: pickFirst(info?.id, info?.legionId, info?.clubId),
    clubName: pickFirst(info?.name, info?.legionName, info?.clubName),
    clubAvatar: pickFirst(info?.logo, info?.avatar, info?.head, info?.icon, info?.badge),
    leaderRoleId,
    leaderName: leaderMember?.name || pickFirst(info?.leaderName, info?.ownerName),
    members,
    raw: info || {},
  }
}

const backfillClubSnapshotAssetsIfNeeded = () => {
  const clubRow = getClubInfoRow()
  if (!clubRow?.raw_snapshot) return

  const raw = parseJsonSafe(clubRow.raw_snapshot, {})
  const rawMembers = raw?.members && typeof raw.members === 'object'
    ? Object.values(raw.members)
    : []

  if (!rawMembers.length) return

  const now = new Date().toISOString()
  const updateMemberAvatar = db.prepare(`
    UPDATE club_car_members
    SET avatar = ?, updated_at = ?
    WHERE role_id = ?
      AND is_active = 1
      AND (avatar IS NULL OR avatar = '')
  `)

  const tx = db.transaction(() => {
    for (const member of rawMembers) {
      const roleId = String(member?.roleId || member?.role_id || member?.id || '')
      const avatar = pickFirst(
        member?.avatar,
        member?.headImg,
        member?.head,
        member?.icon,
        member?.photo,
        member?.pic,
      )
      if (!roleId || !avatar) continue
      updateMemberAvatar.run(avatar, now, roleId)
    }

    const clubAvatar = pickFirst(raw?.logo, raw?.avatar, raw?.head, raw?.icon, raw?.badge)
    if (clubAvatar && (!clubRow.club_avatar || String(clubRow.club_avatar).trim() === '')) {
      db.prepare(`
        UPDATE club_car_club_info
        SET club_avatar = ?, updated_at = ?
        WHERE id = 1
      `).run(clubAvatar, now)
    }
  })

  tx()
}

const persistClubSnapshot = (snapshot) => {
  const now = new Date().toISOString()
  const tx = db.transaction((payload) => {
    db.prepare(`
      UPDATE club_car_club_info
      SET club_id = ?, club_name = ?, club_avatar = ?, leader_role_id = ?, leader_name = ?, raw_snapshot = ?, updated_at = ?
      WHERE id = 1
    `).run(
      payload.clubId || '',
      payload.clubName || '',
      payload.clubAvatar || '',
      payload.leaderRoleId || '',
      payload.leaderName || '',
      JSON.stringify(payload.raw || {}),
      now,
    )

    db.prepare('UPDATE club_car_members SET is_active = 0, updated_at = ?').run(now)

    const upsert = db.prepare(`
      INSERT INTO club_car_members (
        role_id, name, avatar, power, position, is_active, send_time, claim_time, claim_enabled, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, 1, '12:00', '16:00', 0, ?, ?)
      ON CONFLICT(role_id) DO UPDATE SET
        name = excluded.name,
        avatar = excluded.avatar,
        power = excluded.power,
        position = excluded.position,
        is_active = 1,
        updated_at = excluded.updated_at
    `)

    for (const member of payload.members || []) {
      upsert.run(
        member.roleId,
        member.name,
        member.avatar || '',
        member.power,
        member.position,
        now,
        now,
      )
    }
  })
  tx(snapshot)
  return now
}

const refreshClubSnapshotFromBin = async (masterBinPath) => {
  const snapshot = await withWsClientFromBin(masterBinPath, async (client) => {
    const legionResp = await client.sendWithPromise('legion_getinfo', {}, 10000)
    return buildSnapshotFromLegionResp(legionResp)
  })
  persistClubSnapshot(snapshot)
  return snapshot
}

const createRunLog = (runType, status, message, detail = null) => {
  db.prepare(`
    INSERT INTO club_car_run_logs (run_type, status, message, detail, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    runType,
    status,
    message,
    detail ? JSON.stringify(detail) : null,
    new Date().toISOString(),
  )
}

const normalizeCars = (raw) => {
  const payload = raw || {}
  const body = payload.body || payload
  const roleCar = body.roleCar || body.rolecar || {}
  const carMap = roleCar.carDataMap || roleCar.cardatamap

  if (carMap && typeof carMap === 'object') {
    return Object.entries(carMap).map(([id, info], index) => ({
      key: index,
      id: String(id),
      ...(info || {}),
    }))
  }

  let list = body.cars || body.list || body.data || body.carList || body.vehicles || []
  if (!Array.isArray(list) && list && typeof list === 'object') {
    list = Object.values(list)
  }
  if (Array.isArray(body) && list.length === 0) {
    list = body
  }

  return (Array.isArray(list) ? list : []).map((item, index) => ({
    key: index,
    id: String(item?.id ?? index),
    ...(item || {}),
  }))
}

const BIG_PRIZE_RULES = [
  { type: 2, itemId: 0, minValue: 2000 },
  { type: 3, itemId: 1001, minValue: 10 },
  { type: 3, itemId: 1022, minValue: 2000 },
  { type: 3, itemId: 1023, minValue: 5 },
  { type: 3, itemId: 3201, minValue: 10 },
]

const GOLD_MODE_BIG_PRIZE_RULES = [
  { type: 2, itemId: 0, minValue: 2000 },
  { type: 3, itemId: 1022, minValue: 2000 },
  { type: 3, itemId: 1023, minValue: 5 },
]

const normalizeRewardValue = (reward) =>
  Number(reward?.value || reward?.num || reward?.quantity || reward?.count || 0)

const getRewardKey = (reward) => `${Number(reward?.type || 0)}:${Number(reward?.itemId || 0)}`

const CLUB_CAR_ITEM_NAME_MAP = {
  1001: '招募令',
  1022: '白玉',
  1023: '彩玉',
  3201: '红色万能碎片',
  35002: '刷新券',
}

const rewardMatchesRule = (reward, rule) =>
  getRewardKey(reward) === `${rule.type}:${rule.itemId}`
  && normalizeRewardValue(reward) >= rule.minValue

const isHighValueReward = (reward) => BIG_PRIZE_RULES.some(rule => rewardMatchesRule(reward, rule))

const formatRewardLabel = (reward) => {
  const type = Number(reward?.type || 0)
  const itemId = Number(reward?.itemId || 0)
  const value = normalizeRewardValue(reward)

  if (type === 2) return `金砖 ${value}`
  if (type === 3) return `${CLUB_CAR_ITEM_NAME_MAP[itemId] || `物品${itemId}`} ${value}`
  if (type === 1) return `金币 ${value}`
  return `类型${type} 物品${itemId} ${value}`
}

const findMatchedRewards = (rewards, rules) => {
  if (!Array.isArray(rewards)) return []
  return rewards
    .filter(reward => rules.some(rule => rewardMatchesRule(reward, rule)))
    .map(formatRewardLabel)
}

const hasGoldModeBigReward = (rewards) => {
  if (!Array.isArray(rewards)) return false
  return rewards.some(reward => GOLD_MODE_BIG_PRIZE_RULES.some(rule => rewardMatchesRule(reward, rule)))
}

const isBigPrize = (rewards) => {
  if (!Array.isArray(rewards)) return false
  return rewards.some(reward => isHighValueReward(reward))
}

const countRacingRefreshTickets = (rewards) => {
  if (!Array.isArray(rewards)) return 0
  return rewards.reduce((acc, reward) => {
    if (Number(reward?.type || 0) === 3 && Number(reward?.itemId || 0) === 35002) {
      return acc + Number(reward?.value || 0)
    }
    return acc
  }, 0)
}

// Match frontend smart-send quality logic.
const shouldSendCarByQuality = (car, tickets, minColor = 4) => {
  const color = Number(car?.color || 0)
  const rewards = Array.isArray(car?.rewards) ? car.rewards : []
  const racingTickets = countRacingRefreshTickets(rewards)

  if (tickets >= 6) {
    return color >= minColor && (color >= 5 || racingTickets >= 4 || isBigPrize(rewards))
  }
  return color >= minColor || racingTickets >= 2 || isBigPrize(rewards)
}

const canClaimCar = (car) => {
  const sendAt = Number(car?.sendAt || 0)
  if (!sendAt) return false
  const sendAtMs = sendAt < 1e12 ? sendAt * 1000 : sendAt
  return Date.now() - sendAtMs >= FOUR_HOURS_MS
}

const readRefreshTicketCount = (roleInfoResp) =>
  Number(roleInfoResp?.role?.items?.[35002]?.quantity || 0)

const readCarPartCount = (roleInfoResp) =>
  Number(roleInfoResp?.role?.items?.[35009]?.quantity || 0)

const readCarResearchLevel = (carResp) =>
  Number(carResp?.body?.roleCar?.research?.[1] || carResp?.roleCar?.research?.[1] || 0)

const tryUpgradeCarResearch = async (client, memberEntry, initialLevel = 0) => {
  let level = Number(initialLevel || 0)
  let upgraded = 0

  while (level < CAR_RESEARCH_PART_COSTS.length) {
    let roleInfoResp
    try {
      roleInfoResp = await client.sendWithPromise('role_getroleinfo', {}, 5000)
    } catch (error) {
      memberEntry.errors.push(`read research parts failed: ${error?.message || error}`)
      break
    }

    const parts = readCarPartCount(roleInfoResp)
    const required = CAR_RESEARCH_PART_COSTS[level]
    if (parts < required) break

    try {
      await client.sendWithPromise('car_research', { researchId: 1 }, 5000)
      upgraded += 1
      level += 1
      await sleep(300)
    } catch (error) {
      memberEntry.errors.push(`car research failed at level ${level + 1}: ${error?.message || error}`)
      break
    }
  }

  return { upgraded, level }
}

const tryClaimCarResearchReward = async (client, memberEntry) => {
  try {
    const rewardResp = await client.sendWithPromise('car_claimpartconsumereward', {}, 5000)
    return !!rewardResp?.reward
  } catch {
    return false
  }
}

const withWsClientFromBin = async (binPath, fn) => {
  const tokenStr = await transformBinToToken(binPath)
  const wsUrl = buildGameWsUrl(tokenStr)
  const wsClient = new GameWebSocketClient(wsUrl, { autoReconnect: false })
  await wsClient.connect()
  try {
    return await fn(wsClient)
  } finally {
    wsClient.disconnect()
  }
}

const checkSendPermission = (memberRow, now = new Date()) => {
  if (!isMondayToWednesdayWindow(now)) {
    return { ok: false, reason: 'send time window is Monday-Wednesday 06:00-20:00' }
  }
  return { ok: true }
}

const updateMemberSendAt = (roleId, isoText) => {
  db.prepare('UPDATE club_car_members SET last_send_at = ?, updated_at = ? WHERE role_id = ?')
    .run(isoText, isoText, String(roleId))
}

const updateMemberHelpAt = (roleId, isoText) => {
  db.prepare('UPDATE club_car_members SET last_help_at = ?, updated_at = ? WHERE role_id = ?')
    .run(isoText, isoText, String(roleId))
}

const updateMemberClaimAt = (roleId, isoText) => {
  db.prepare('UPDATE club_car_members SET last_claim_at = ?, updated_at = ? WHERE role_id = ?')
    .run(isoText, isoText, String(roleId))
}

const updateCarFromResponse = (car, responseData) => {
  if (!responseData || typeof responseData !== 'object') return car
  if (responseData.color !== undefined) car.color = Number(responseData.color)
  if (responseData.refreshCount !== undefined) car.refreshCount = Number(responseData.refreshCount)
  if (responseData.rewards !== undefined) car.rewards = responseData.rewards
  return car
}

const getActiveBoundMemberRows = (roleIds = null) => {
  const rows = db.prepare(`
    SELECT * FROM club_car_members
    WHERE is_active = 1
      AND bound_bin_path IS NOT NULL
      AND bound_bin_path != ''
    ORDER BY power DESC, id ASC
  `).all()
  if (!Array.isArray(roleIds) || roleIds.length === 0) return rows
  const set = new Set(roleIds.map(item => String(item)))
  return rows.filter(row => set.has(String(row.role_id)))
}

const assertPlanConflict = ({ weekday, senderRoleId, sendTime, excludeId = null }) => {
  const row = excludeId
    ? db.prepare(`
      SELECT id FROM club_car_send_plans
      WHERE is_active = 1
        AND weekday = ?
        AND sender_role_id = ?
        AND send_time = ?
        AND id != ?
    `).get(weekday, String(senderRoleId), sendTime, excludeId)
    : db.prepare(`
      SELECT id FROM club_car_send_plans
      WHERE is_active = 1
        AND weekday = ?
        AND sender_role_id = ?
        AND send_time = ?
    `).get(weekday, String(senderRoleId), sendTime)

  if (row) {
    const err = new Error('the sender already has a rule at the same weekday and time slot')
    err.status = 400
    throw err
  }
}

const assertPlanGapConflict = ({
  weekday,
  senderRoleId,
  targetRoleId,
  sendTime,
  excludeId = null,
}) => {
  const rows = db.prepare(`
    SELECT id, sender_role_id, target_role_id, send_time
    FROM club_car_send_plans
    WHERE is_active = 1
      AND weekday = ?
    ORDER BY send_time ASC, id ASC
  `).all(weekday)

  const currentMinutes = toMinutesOfDay(sendTime)

  for (const row of rows) {
    if (excludeId && Number(row.id) === Number(excludeId)) continue
    const existingMinutes = toMinutesOfDay(normalizeTimeHHmm(row.send_time, '06:00'))
    const gap = Math.abs(existingMinutes - currentMinutes)
    if (gap >= 240) continue

    if (String(row.target_role_id) === String(targetRoleId)) {
      const err = new Error('the same target member must be spaced at least 4 hours apart on the same weekday')
      err.status = 400
      throw err
    }

    if (String(row.sender_role_id) === String(senderRoleId)) {
      const err = new Error('the same sender must be spaced at least 4 hours apart on the same weekday')
      err.status = 400
      throw err
    }
  }
}

const ensurePlanClaimGapForSender = (senderRoleId, claimTime, excludePlanId = null) => {
  const plans = getPlanRowsBySenderRoleId(senderRoleId)
  for (const plan of plans) {
    if (excludePlanId && Number(plan.id) === Number(excludePlanId)) continue
    ensureSendClaimGap(normalizeTimeHHmm(plan.send_time, '06:00'), claimTime)
  }
}

const normalizePlanPayload = (data = {}, currentRow = null) => {
  const weekday = normalizeWeekday(data.weekday, currentRow ? Number(currentRow.weekday || 1) : 1)
  const senderRoleId = String(data.senderRoleId || currentRow?.sender_role_id || '').trim()
  const targetRoleId = String(data.targetRoleId || currentRow?.target_role_id || '').trim()
  const sendMode = normalizeSendMode(data.sendMode, currentRow?.send_mode || 'red')
  const sendTime = normalizeSendTime(data.sendTime, currentRow?.send_time || '06:00')
  if (!senderRoleId || !targetRoleId) {
    const err = new Error('senderRoleId and targetRoleId are required')
    err.status = 400
    throw err
  }
  if (senderRoleId === targetRoleId) {
    const err = new Error('target role cannot be the same as sender')
    err.status = 400
    throw err
  }

  const sender = getMemberRowByRoleId(senderRoleId)
  if (!sender || sender.is_active !== 1) {
    const err = new Error('sender member not found')
    err.status = 404
    throw err
  }
  const target = getMemberRowByRoleId(targetRoleId)
  if (!target || target.is_active !== 1) {
    const err = new Error('target member not found')
    err.status = 404
    throw err
  }

  if (sender.claim_enabled === 1) {
    ensureSendClaimGap(sendTime, normalizeTimeHHmm(sender.claim_time, '16:00'))
  }

  assertPlanConflict({
    weekday,
    senderRoleId,
    sendTime,
    excludeId: currentRow?.id || null,
  })

  assertPlanGapConflict({
    weekday,
    senderRoleId,
    targetRoleId,
    sendTime,
    excludeId: currentRow?.id || null,
  })

  return {
    weekday,
    senderRoleId,
    targetRoleId,
    sendMode,
    sendTime,
  }
}

export const getDueSendPlansByTime = (now = new Date()) => {
  const weekday = getLocalWeekday(now)
  if (!weekday) return []
  const currentMinutes = (now.getHours() * 60) + now.getMinutes()
  const rows = db.prepare(`
    SELECT * FROM club_car_send_plans
    WHERE is_active = 1
      AND weekday = ?
    ORDER BY id ASC
  `).all(weekday)

  return rows
    .map(row => ({
      row,
      sender: getMemberRowByRoleId(row.sender_role_id),
      target: getMemberRowByRoleId(row.target_role_id),
    }))
    .filter(item => {
      const sendMinutes = toMinutesOfDay(normalizeTimeHHmm(item.row.send_time, '06:00'))
      if (currentMinutes < sendMinutes) return false
      return (currentMinutes - sendMinutes) <= 30
    })
    .filter(item => item.sender && item.sender.is_active === 1)
    .filter(item => item.target && item.target.is_active === 1)
    .filter(item => item.sender.bound_bin_path)
    .filter(item => !hasPlanSucceededToday(item.row, now))
    .filter(item => checkSendPermission(item.sender, now).ok)
    .map(item => mapPlan(item.row))
}

export const getDueMembersByTime = (type, now = new Date()) => {
  const currentHHmm = formatHHmm(now)
  if (type === 'claim') {
    const rows = getActiveBoundMemberRows()
    return rows
      .filter(row => row.claim_enabled === 1)
      .filter(row => normalizeTimeHHmm(row.claim_time, '16:00') === currentHHmm)
      .filter(row => !isSameDayByIso(row.last_claim_at, now))
      .map(mapMember)
  }
  return []
}

export const getClubCarConfig = () => mapConfig(getConfigRow())
export const getClubCarClubInfo = () => {
  backfillClubSnapshotAssetsIfNeeded()
  return mapClubInfo(getClubInfoRow())
}

export const getClubCarSendPlans = () => {
  const rows = db.prepare(`
    SELECT * FROM club_car_send_plans
    WHERE is_active = 1
    ORDER BY weekday ASC, send_time ASC, id ASC
  `).all()
  return rows.map(mapPlan)
}

export const createClubCarSendPlan = (data = {}) => {
  const payload = normalizePlanPayload(data)
  const now = new Date().toISOString()
  const result = db.prepare(`
    INSERT INTO club_car_send_plans (
      weekday, target_role_id, sender_role_id, send_mode, use_coupon, send_time, is_active, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, 0, ?, 1, ?, ?)
  `).run(
    payload.weekday,
    payload.targetRoleId,
    payload.senderRoleId,
    payload.sendMode,
    payload.sendTime,
    now,
    now,
  )
  return mapPlan(getPlanRowById(result.lastInsertRowid))
}

export const updateClubCarSendPlan = (planId, data = {}) => {
  const currentRow = getPlanRowById(planId)
  if (!currentRow || currentRow.is_active !== 1) {
    const err = new Error('send plan not found')
    err.status = 404
    throw err
  }

  const payload = normalizePlanPayload(data, currentRow)
  const now = new Date().toISOString()
  db.prepare(`
    UPDATE club_car_send_plans
    SET weekday = ?, target_role_id = ?, sender_role_id = ?, send_mode = ?, use_coupon = 0, send_time = ?, updated_at = ?
    WHERE id = ?
  `).run(
    payload.weekday,
    payload.targetRoleId,
    payload.senderRoleId,
    payload.sendMode,
    payload.sendTime,
    now,
    planId,
  )

  return mapPlan(getPlanRowById(planId))
}

export const deleteClubCarSendPlan = (planId) => {
  const currentRow = getPlanRowById(planId)
  if (!currentRow) {
    const err = new Error('send plan not found')
    err.status = 404
    throw err
  }
  db.prepare('DELETE FROM club_car_send_plans WHERE id = ?').run(planId)
  return mapPlan(currentRow)
}

export const updateClubCarConfig = (data = {}) => {
  const now = new Date().toISOString()
  const current = getClubCarConfig()
  const payload = {
    enabled: data.enabled === undefined ? current.enabled : !!data.enabled,
    minColor: Number.isFinite(Number(data.minColor)) ? Number(data.minColor) : current.minColor,
    maxRefreshTimes: Number.isFinite(Number(data.maxRefreshTimes)) ? Number(data.maxRefreshTimes) : current.maxRefreshTimes,
    sendCron: typeof data.sendCron === 'string' && data.sendCron.trim() ? data.sendCron.trim() : current.sendCron,
    claimCron: typeof data.claimCron === 'string' && data.claimCron.trim() ? data.claimCron.trim() : current.claimCron,
  }

  db.prepare(`
    UPDATE club_car_config
    SET enabled = ?, min_color = ?, max_refresh_times = ?, send_cron = ?, claim_cron = ?, updated_at = ?
    WHERE id = 1
  `).run(
    payload.enabled ? 1 : 0,
    Math.max(1, Math.min(6, payload.minColor)),
    Math.max(1, Math.min(100, payload.maxRefreshTimes)),
    payload.sendCron,
    payload.claimCron,
    now,
  )

  return getClubCarConfig()
}

export const saveMasterBin = async (file) => {
  if (!file) {
    const err = new Error('master bin file is required')
    err.status = 400
    throw err
  }

  const now = new Date().toISOString()
  const current = getClubCarConfig()
  const originalName = sanitizeFilename(file.originalname)
  const storedName = `master_${Date.now()}_${originalName}`
  const destination = path.join(CLUB_MASTER_BIN_DIR, storedName)

  fs.renameSync(file.path, destination)

  if (current?.masterBinPath && current.masterBinPath !== destination) {
    removeFileIfExists(current.masterBinPath)
  }

  db.prepare(`
    UPDATE club_car_config
    SET master_bin_path = ?, master_bin_name = ?, updated_at = ?
    WHERE id = 1
  `).run(destination, originalName, now)

  const snapshot = await refreshClubSnapshotFromBin(destination)
  createRunLog('snapshot', 'success', `snapshot saved: ${snapshot.members.length} members`, {
    clubId: snapshot.clubId,
    clubName: snapshot.clubName,
    roleIds: snapshot.members.map(item => item.roleId),
  })

  return {
    config: getClubCarConfig(),
    clubInfo: getClubCarClubInfo(),
    memberTotal: snapshot.members.length,
  }
}

export const getClubCarMembers = ({ activeOnly = false } = {}) => {
  backfillClubSnapshotAssetsIfNeeded()
  const rows = activeOnly
    ? db.prepare('SELECT * FROM club_car_members WHERE is_active = 1 ORDER BY power DESC, id ASC').all()
    : db.prepare('SELECT * FROM club_car_members ORDER BY is_active DESC, power DESC, id ASC').all()
  return rows.map(mapMember)
}

export const syncClubMembersFromMaster = async () => {
  const cfg = getClubCarConfig()
  if (!cfg?.masterBinPath || !fs.existsSync(cfg.masterBinPath)) {
    const err = new Error('master bin is not configured')
    err.status = 400
    throw err
  }
  const clubInfo = getClubCarClubInfo()
  if (!clubInfo?.clubId && !clubInfo?.clubName) {
    const err = new Error('club snapshot not found, please re-import master bin')
    err.status = 400
    throw err
  }

  const members = getClubCarMembers()
  createRunLog('sync', 'success', `loaded ${members.length} members from saved snapshot`, {
    clubId: clubInfo.clubId,
    clubName: clubInfo.clubName,
    roleIds: members.map(item => item.roleId),
  })

  return {
    total: members.length,
    clubInfo,
    members,
  }
}

export const updateClubMemberPassword = async (memberId, plainPassword) => {
  const member = getMemberRowById(memberId)
  if (!member) {
    const err = new Error('member not found')
    err.status = 404
    throw err
  }
  const password = String(plainPassword || '').trim()
  if (password.length < 6) {
    const err = new Error('password length must be at least 6')
    err.status = 400
    throw err
  }
  const hash = await bcrypt.hash(password, 10)
  db.prepare('UPDATE club_car_members SET password_hash = ?, updated_at = ? WHERE id = ?')
    .run(hash, new Date().toISOString(), memberId)
  return mapMember(getMemberRowById(memberId))
}

export const setClubMemberPasswordByRole = async (roleId, plainPassword) => {
  const row = getMemberRowByRoleId(roleId)
  if (!row || row.is_active !== 1) {
    const err = new Error('member not found')
    err.status = 404
    throw err
  }
  if (row.password_hash) {
    const err = new Error('password already set, please login to change it')
    err.status = 400
    throw err
  }
  return updateClubMemberPassword(row.id, plainPassword)
}

export const updateClubMemberPasswordByRole = async (roleId, currentPassword, newPassword) => {
  const row = getMemberRowByRoleId(roleId)
  if (!row || row.is_active !== 1 || !row.password_hash) {
    const err = new Error('member password is not initialized')
    err.status = 400
    throw err
  }
  const ok = await bcrypt.compare(String(currentPassword || ''), row.password_hash)
  if (!ok) {
    const err = new Error('current password is incorrect')
    err.status = 401
    throw err
  }
  return updateClubMemberPassword(row.id, newPassword)
}

export const updateClubMemberSchedule = (memberId, data = {}) => {
  const row = getMemberRowById(memberId)
  if (!row) {
    const err = new Error('member not found')
    err.status = 404
    throw err
  }

  const sendTime = normalizeTimeHHmm(data.sendTime, normalizeTimeHHmm(row.send_time, '12:00'))
  const claimTime = normalizeTimeHHmm(row.claim_time, '16:00')
  const claimEnabled = row.claim_enabled === 1
  if (claimEnabled) {
    ensureSendClaimGap(sendTime, claimTime)
  }

  const now = new Date().toISOString()
  db.prepare(`
    UPDATE club_car_members
    SET send_time = ?, updated_at = ?
    WHERE id = ?
  `).run(sendTime, now, memberId)

  return mapMember(getMemberRowById(memberId))
}

export const updateClubMemberScheduleByRole = (roleId, data = {}) => {
  const row = getMemberRowByRoleId(roleId)
  if (!row || row.is_active !== 1) {
    const err = new Error('member not found')
    err.status = 404
    throw err
  }

  const claimEnabled = data.claimEnabled === undefined
    ? row.claim_enabled === 1
    : !!data.claimEnabled
  const claimTime = normalizeTimeHHmm(data.claimTime, normalizeTimeHHmm(row.claim_time, '16:00'))

  if (claimEnabled) {
    ensurePlanClaimGapForSender(roleId, claimTime)
  }

  const now = new Date().toISOString()
  db.prepare(`
    UPDATE club_car_members
    SET claim_enabled = ?, claim_time = ?, updated_at = ?
    WHERE id = ?
  `).run(claimEnabled ? 1 : 0, claimTime, now, row.id)

  return mapMember(getMemberRowById(row.id))
}

export const batchUpdateClubMemberClaimSchedule = ({ roleIds = [], claimEnabled = false, claimTime = '16:00' } = {}) => {
  const normalizedRoleIds = [...new Set((Array.isArray(roleIds) ? roleIds : [])
    .map(item => String(item || '').trim())
    .filter(Boolean))]

  const normalizedClaimEnabled = !!claimEnabled
  const normalizedClaimTime = normalizeTimeHHmm(claimTime, '16:00')
  const now = new Date().toISOString()

  const activeBoundMembers = getActiveBoundMemberRows()
  const boundRoleIdSet = new Set(activeBoundMembers.map(member => String(member.role_id)))

  const tx = db.transaction(() => {
    for (const member of activeBoundMembers) {
      const roleId = String(member.role_id)
      const enabled = normalizedRoleIds.includes(roleId)
      if (enabled) {
        ensurePlanClaimGapForSender(roleId, normalizedClaimTime)
      }
      db.prepare(`
        UPDATE club_car_members
        SET claim_enabled = ?, claim_time = ?, updated_at = ?
        WHERE role_id = ?
      `).run(enabled ? 1 : 0, normalizedClaimTime, now, roleId)
    }
  })

  for (const roleId of normalizedRoleIds) {
    if (!boundRoleIdSet.has(roleId)) {
      const err = new Error(`member ${roleId} is not bound`)
      err.status = 400
      throw err
    }
  }

  tx()

  return getClubCarMembers({ activeOnly: true })
}

export const updateClubMemberTarget = (memberId, targetRoleId) => {
  const member = getMemberRowById(memberId)
  if (!member) {
    const err = new Error('member not found')
    err.status = 404
    throw err
  }
  let normalizedTarget = String(targetRoleId || '').trim()
  if (normalizedTarget && normalizedTarget === String(member.role_id)) {
    const err = new Error('target role cannot be self')
    err.status = 400
    throw err
  }
  if (normalizedTarget) {
    const target = getMemberRowByRoleId(normalizedTarget)
    if (!target) {
      const err = new Error('target member not found')
      err.status = 404
      throw err
    }
  } else {
    normalizedTarget = null
  }

  db.prepare('UPDATE club_car_members SET target_role_id = ?, updated_at = ? WHERE id = ?')
    .run(normalizedTarget, new Date().toISOString(), memberId)

  return mapMember(getMemberRowById(memberId))
}

export const clearClubMemberBindingById = (memberId) => {
  const row = getMemberRowById(memberId)
  if (!row) {
    const err = new Error('member not found')
    err.status = 404
    throw err
  }
  if (row.bound_bin_path) {
    removeFileIfExists(row.bound_bin_path)
  }
  db.prepare(`
    UPDATE club_car_members
    SET bound_bin_path = NULL, bound_bin_name = NULL, bound_at = NULL, updated_at = ?
    WHERE id = ?
  `).run(new Date().toISOString(), memberId)
  return mapMember(getMemberRowById(memberId))
}

export const bindClubMemberBinByRoleId = (roleId, file) => {
  const row = getMemberRowByRoleId(roleId)
  if (!row) {
    const err = new Error('member not found')
    err.status = 404
    throw err
  }
  if (!file) {
    const err = new Error('bin file is required')
    err.status = 400
    throw err
  }
  const now = new Date().toISOString()
  const safeName = sanitizeFilename(file.originalname)
  const storedName = `member_${roleId}_${Date.now()}_${safeName}`
  const destination = path.join(CLUB_MEMBER_BIN_DIR, storedName)
  fs.renameSync(file.path, destination)

  if (row.bound_bin_path && row.bound_bin_path !== destination) {
    removeFileIfExists(row.bound_bin_path)
  }

  db.prepare(`
    UPDATE club_car_members
    SET bound_bin_path = ?, bound_bin_name = ?, bound_at = ?, updated_at = ?
    WHERE role_id = ?
  `).run(destination, safeName, now, now, String(roleId))

  return mapMember(getMemberRowByRoleId(roleId))
}

export const authenticateClubMember = async ({ roleId, password }) => {
  const normalizedRoleId = String(roleId || '').trim()
  const plainPassword = String(password || '')
  if (!normalizedRoleId || !plainPassword) {
    const err = new Error('roleId and password are required')
    err.status = 400
    throw err
  }
  const row = db.prepare(`
    SELECT * FROM club_car_members
    WHERE role_id = ? AND is_active = 1
  `).get(normalizedRoleId)
  if (!row || !row.password_hash) {
    const err = new Error('member password is not initialized or invalid')
    err.status = 401
    throw err
  }
  const ok = await bcrypt.compare(plainPassword, row.password_hash)
  if (!ok) {
    const err = new Error('invalid roleId or password')
    err.status = 401
    throw err
  }
  const token = jwt.sign(
    { scope: CLUB_MEMBER_TOKEN_SCOPE, roleId: String(row.role_id), memberId: row.id },
    config.jwtSecret,
    { expiresIn: CLUB_MEMBER_TOKEN_EXPIRES_IN },
  )
  return {
    token,
    member: mapMember(row),
  }
}

export const verifyClubMemberToken = (authHeader) => {
  const bearer = String(authHeader || '').trim()
  const token = bearer.startsWith('Bearer ') ? bearer.slice(7) : bearer
  if (!token) {
    const err = new Error('member token is required')
    err.status = 401
    throw err
  }
  let payload
  try {
    payload = jwt.verify(token, config.jwtSecret)
  } catch {
    const err = new Error('invalid member token')
    err.status = 401
    throw err
  }
  if (!payload || payload.scope !== CLUB_MEMBER_TOKEN_SCOPE || !payload.roleId) {
    const err = new Error('invalid member token scope')
    err.status = 401
    throw err
  }
  const member = getMemberRowByRoleId(payload.roleId)
  if (!member || member.is_active !== 1) {
    const err = new Error('member not found or inactive')
    err.status = 401
    throw err
  }
  return mapMember(member)
}

export const getClubCarRunLogs = (limit = 50) => {
  const safeLimit = Math.max(1, Math.min(200, Number(limit) || 50))
  const rows = db.prepare('SELECT * FROM club_car_run_logs ORDER BY id DESC LIMIT ?').all(safeLimit)
  return rows.map(mapRunLog)
}

const sortCarsForSend = (cars = []) => [...cars]
  .filter(car => Number(car?.sendAt || 0) === 0)
  .sort((left, right) => {
    const colorDiff = Number(right?.color || 0) - Number(left?.color || 0)
    if (colorDiff !== 0) return colorDiff
    return Number(left?.slot || 0) - Number(right?.slot || 0)
  })

const meetsPlanSendMode = (car, sendMode) => {
  if (sendMode === 'no_refresh') return true
  const color = Number(car?.color || 0)
  if (sendMode === 'gold') {
    if (color >= 6) return true
    return color >= 5 && hasGoldModeBigReward(car?.rewards)
  }
  return color >= 5
}

const updatePlanLastRunAt = (planId, isoText) => {
  db.prepare('UPDATE club_car_send_plans SET last_run_at = ?, updated_at = ? WHERE id = ?')
    .run(isoText, isoText, planId)
}

const prepareCarForPlan = async ({ client, car, tickets, sendMode, maxRefreshTimes }) => {
  const candidate = { ...(car || {}) }
  let attempts = 0
  let currentTickets = tickets

  if (sendMode === 'no_refresh') {
    return {
      car: candidate,
      tickets: currentTickets,
      refreshAttempts: attempts,
      reason: '',
      stopReason: '不刷新，直接发车',
      matchedRewards: [],
    }
  }

  while (!meetsPlanSendMode(candidate, sendMode) && attempts < maxRefreshTimes) {
    const refreshResp = await client.sendWithPromise('car_refresh', { carId: String(candidate.id) }, 10000)
    const refreshData = refreshResp?.car || refreshResp?.body?.car || refreshResp
    updateCarFromResponse(candidate, refreshData)
    attempts += 1
    await sleep(300)

    try {
      const roleInfoResp = await client.sendWithPromise('role_getroleinfo', {}, 8000)
      currentTickets = readRefreshTicketCount(roleInfoResp)
    } catch {
      // keep previous ticket count
    }
  }

  if (!meetsPlanSendMode(candidate, sendMode)) {
    return {
      car: null,
      tickets: currentTickets,
      refreshAttempts: attempts,
      reason: 'target quality not reached',
      stopReason: '',
      matchedRewards: [],
    }
  }

  const color = Number(candidate?.color || 0)
  const matchedRewards = sendMode === 'gold'
    ? findMatchedRewards(candidate?.rewards, GOLD_MODE_BIG_PRIZE_RULES)
    : []

  let stopReason = ''
  if (sendMode === 'gold') {
    if (color >= 6) {
      stopReason = '刷到金车'
    } else if (color >= 5 && matchedRewards.length) {
      stopReason = `红车命中大奖: ${matchedRewards.join('，')}`
    }
  } else if (sendMode === 'red' && color >= 5) {
    stopReason = '刷到红车'
  }

  return {
    car: candidate,
    tickets: currentTickets,
    refreshAttempts: attempts,
    reason: '',
    stopReason,
    matchedRewards,
  }
}

export const runClubCarSend = async (options = {}) => {
  const now = options.now instanceof Date ? options.now : new Date()
  const nowIso = now.toISOString()
  const runType = options.runType || 'send'
  const cfg = getClubCarConfig()
  const plans = Array.isArray(options.planIds) && options.planIds.length > 0
    ? options.planIds
      .map(planId => getPlanRowById(planId))
      .filter(row => row && row.is_active === 1)
      .map(mapPlan)
    : getDueSendPlansByTime(now)

  if (!plans.length) {
    const summary = { totalPlans: 0, sentCars: 0, message: 'no due send plans' }
    createRunLog(runType, 'success', summary.message, summary)
    return summary
  }

  const detail = []
  let sentCars = 0

  for (const plan of plans) {
    const senderRow = getMemberRowByRoleId(plan.senderRoleId)
    const targetRow = getMemberRowByRoleId(plan.targetRoleId)
    const planEntry = {
      planId: plan.id,
      senderRoleId: plan.senderRoleId,
      senderName: plan.sender?.name || senderRow?.name || plan.senderRoleId,
      targetRoleId: plan.targetRoleId,
      targetName: plan.target?.name || targetRow?.name || plan.targetRoleId,
      sendMode: plan.sendMode,
      sendTime: plan.sendTime,
      sent: 0,
      totalIdleCars: 0,
      completed: false,
      skippedReason: '',
      refreshAttempts: 0,
      sentCarsDetail: [],
      errors: [],
    }

    if (!senderRow || senderRow.is_active !== 1) {
      planEntry.skippedReason = 'sender is inactive'
      detail.push(planEntry)
      continue
    }

    if (!senderRow.bound_bin_path) {
      planEntry.skippedReason = 'sender bin is not bound'
      detail.push(planEntry)
      continue
    }

    if (!targetRow || targetRow.is_active !== 1) {
      planEntry.skippedReason = 'target is inactive'
      detail.push(planEntry)
      continue
    }

    const permission = checkSendPermission(senderRow, now)
    if (!permission.ok) {
      planEntry.skippedReason = permission.reason
      detail.push(planEntry)
      continue
    }

    try {
      await withWsClientFromBin(senderRow.bound_bin_path, async (client) => {
        let roleInfoResp = null
        let tickets = 0
        try {
          roleInfoResp = await client.sendWithPromise('role_getroleinfo', {}, 10000)
          tickets = readRefreshTicketCount(roleInfoResp)
        } catch {
          tickets = 0
        }

        const carResp = await client.sendWithPromise('car_getrolecar', {}, 10000)
        const cars = normalizeCars(carResp?.body ?? carResp)
        const idleCars = sortCarsForSend(cars)
        planEntry.totalIdleCars = idleCars.length

        if (!idleCars.length) {
          planEntry.skippedReason = 'no idle cars'
          planEntry.completed = true
          updatePlanLastRunAt(plan.id, nowIso)
          return
        }

        let currentTickets = tickets
        let targetQualityReached = false

        for (const idleCar of idleCars) {
          const prepared = await prepareCarForPlan({
            client,
            car: idleCar,
            tickets: currentTickets,
            sendMode: plan.sendMode,
            maxRefreshTimes: cfg.maxRefreshTimes,
          })
          currentTickets = prepared.tickets
          planEntry.refreshAttempts += prepared.refreshAttempts

          if (!prepared.car) {
            if (!targetQualityReached && prepared.reason) {
              planEntry.skippedReason = prepared.reason
            }
            continue
          }

          targetQualityReached = true

          try {
            await client.sendWithPromise(
              'car_send',
              {
                carId: String(prepared.car.id),
                helperId: String(plan.targetRoleId),
                text: '',
                isUpgrade: false,
              },
              10000,
            )
            planEntry.sent += 1
            sentCars += 1
            planEntry.sentCarsDetail.push({
              carId: String(prepared.car.id),
              color: Number(prepared.car?.color || 0),
              stopReason: prepared.stopReason || '',
              matchedRewards: prepared.matchedRewards || [],
            })
            await sleep(300)
          } catch (error) {
            planEntry.errors.push(`car ${prepared.car.id}: ${error?.message || error}`)
          }
        }

        if (planEntry.sent > 0) {
          updateMemberHelpAt(plan.targetRoleId, nowIso)
          updateMemberSendAt(plan.senderRoleId, nowIso)
        }

        if (planEntry.sent === planEntry.totalIdleCars) {
          planEntry.completed = true
          updatePlanLastRunAt(plan.id, nowIso)
        } else if (planEntry.sent > 0) {
          planEntry.skippedReason = `partial sent ${planEntry.sent}/${planEntry.totalIdleCars}`
        } else if (!planEntry.skippedReason) {
          planEntry.skippedReason = 'no suitable car found'
        }
      })
    } catch (error) {
      planEntry.errors.push(String(error?.message || error))
    }

    detail.push(planEntry)
    await sleep(800)
  }

  const failedPlans = detail.filter(item => item.errors.length > 0).length
  const summary = {
    totalPlans: plans.length,
    failedPlans,
    sentCars,
    detail,
  }
  createRunLog(
    runType,
    failedPlans > 0 ? 'partial' : 'success',
    `send run finished: ${sentCars} cars sent, ${failedPlans} plan(s) failed`,
    summary,
  )
  return summary
}

export const runClubCarClaim = async (options = {}) => {
  const now = options.now instanceof Date ? options.now : new Date()
  const runType = options.runType || 'claim'
  const memberRows = getActiveBoundMemberRows(options.memberRoleIds)
  const members = memberRows.map(mapMember)
  if (!members.length) {
    const summary = { totalMembers: 0, claimedCars: 0, message: 'no active bound members' }
    createRunLog(runType, 'success', summary.message, summary)
    return summary
  }

  const detail = []
  let claimedCars = 0

  for (const member of members) {
    const rawMember = getMemberRowByRoleId(member.roleId)
    const memberEntry = {
      roleId: member.roleId,
      name: member.name,
      claimed: 0,
      researchLevel: 0,
      researchUpgraded: 0,
      researchRewardClaimed: false,
      skippedReason: '',
      errors: [],
    }

    if (rawMember.claim_enabled !== 1) {
      memberEntry.skippedReason = 'claim is disabled'
      detail.push(memberEntry)
      continue
    }

    if (isSameDayByIso(rawMember.last_claim_at, now) && options.memberRoleIds) {
      memberEntry.skippedReason = 'already claimed today'
      detail.push(memberEntry)
      continue
    }

    try {
      await withWsClientFromBin(rawMember.bound_bin_path, async (client) => {
        const carResp = await client.sendWithPromise('car_getrolecar', {}, 10000)
        memberEntry.researchLevel = readCarResearchLevel(carResp)
        const cars = normalizeCars(carResp?.body ?? carResp)
        for (const car of cars) {
          if (!canClaimCar(car)) continue
          try {
            await client.sendWithPromise('car_claim', { carId: String(car.id) }, 10000)
            memberEntry.claimed += 1
            claimedCars += 1
          } catch (error) {
            memberEntry.errors.push(`car ${car.id}: ${error?.message || error}`)
          }
          await sleep(300)
        }

        const researchResult = await tryUpgradeCarResearch(client, memberEntry, memberEntry.researchLevel)
        memberEntry.researchUpgraded = researchResult.upgraded
        memberEntry.researchLevel = researchResult.level
        if (memberEntry.researchUpgraded > 0) {
          memberEntry.researchRewardClaimed = await tryClaimCarResearchReward(client, memberEntry)
        }
      })

      updateMemberClaimAt(member.roleId, now.toISOString())
    } catch (error) {
      memberEntry.errors.push(String(error?.message || error))
    }

    detail.push(memberEntry)
    await sleep(800)
  }

  const failedMembers = detail.filter(item => item.errors.length > 0).length
  const summary = {
    totalMembers: members.length,
    failedMembers,
    claimedCars,
    detail,
  }
  createRunLog(
    runType,
    failedMembers > 0 ? 'partial' : 'success',
    `claim run finished: ${claimedCars} cars claimed, ${failedMembers} member(s) failed`,
    summary,
  )
  return summary
}
