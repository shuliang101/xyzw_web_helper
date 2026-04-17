import {
  getClubCarConfig,
  getClubCarClubInfo,
  updateClubCarConfig,
  saveMasterBin,
  getClubCarMembers,
  getClubCarSendPlans,
  syncClubMembersFromMaster,
  createClubCarSendPlan,
  updateClubCarSendPlan,
  deleteClubCarSendPlan,
  setClubMemberPasswordByRole,
  updateClubMemberPasswordByRole,
  updateClubMemberSchedule,
  updateClubMemberScheduleByRole,
  batchUpdateClubMemberClaimSchedule,
  updateClubMemberTarget,
  clearClubMemberBindingById,
  authenticateClubMember,
  verifyClubMemberToken,
  bindClubMemberBinByRoleId,
  getClubCarRunLogs,
  getClubCarRunLogsByRoleId,
  getClubCarSendPlansByRoleId,
} from '../services/clubCarService.js'
import { clubCarScheduler } from '../services/clubCarScheduler.js'

export const getClubCarConfigHandler = (req, res) => {
  res.json({ success: true, data: getClubCarConfig() })
}

export const getClubCarClubInfoHandler = (req, res) => {
  res.json({ success: true, data: getClubCarClubInfo() })
}

export const updateClubCarConfigHandler = (req, res) => {
  const data = updateClubCarConfig(req.body || {})
  clubCarScheduler.reload()
  res.json({ success: true, data })
}

export const uploadClubCarMasterBinHandler = async (req, res, next) => {
  try {
    const data = await saveMasterBin(req.file)
    clubCarScheduler.reload()
    res.json({ success: true, data })
  } catch (error) {
    next(error)
  }
}

export const syncClubCarMembersHandler = async (req, res, next) => {
  try {
    const data = await syncClubMembersFromMaster()
    res.json({ success: true, data })
  } catch (error) {
    next(error)
  }
}

export const listClubCarMembersHandler = (req, res) => {
  const activeOnly = String(req.query.activeOnly || '').toLowerCase() === 'true'
  const members = getClubCarMembers({ activeOnly })
  res.json({ success: true, data: members })
}

export const listClubCarSendPlansHandler = (req, res) => {
  const roleId = String(req.query.roleId || '').trim()
  if (req.user?.role === 'admin') {
    res.json({ success: true, data: getClubCarSendPlans() })
    return
  }
  res.json({ success: true, data: getClubCarSendPlansByRoleId(roleId) })
}

export const createClubCarSendPlanHandler = (req, res, next) => {
  try {
    const data = createClubCarSendPlan(req.body || {})
    res.json({ success: true, data })
  } catch (error) {
    next(error)
  }
}

export const updateClubCarSendPlanHandler = (req, res, next) => {
  try {
    const data = updateClubCarSendPlan(req.params.id, req.body || {})
    res.json({ success: true, data })
  } catch (error) {
    next(error)
  }
}

export const deleteClubCarSendPlanHandler = (req, res, next) => {
  try {
    const data = deleteClubCarSendPlan(req.params.id)
    res.json({ success: true, data })
  } catch (error) {
    next(error)
  }
}

export const updateClubCarMemberScheduleHandler = (req, res, next) => {
  try {
    const memberId = req.params.id
    const member = updateClubMemberSchedule(memberId, {
      sendTime: req.body?.sendTime,
    })
    res.json({ success: true, data: member })
  } catch (error) {
    next(error)
  }
}

export const batchUpdateClubCarMemberClaimScheduleHandler = (req, res, next) => {
  try {
    const members = batchUpdateClubMemberClaimSchedule({
      roleIds: req.body?.roleIds,
      claimEnabled: req.body?.claimEnabled,
      claimTime: req.body?.claimTime,
    })
    res.json({ success: true, data: members })
  } catch (error) {
    next(error)
  }
}

export const updateClubCarMemberTargetHandler = (req, res, next) => {
  try {
    const memberId = req.params.id
    const targetRoleId = req.body?.targetRoleId
    const member = updateClubMemberTarget(memberId, targetRoleId)
    res.json({ success: true, data: member })
  } catch (error) {
    next(error)
  }
}

export const unbindClubCarMemberBinHandler = (req, res, next) => {
  try {
    const memberId = req.params.id
    const member = clearClubMemberBindingById(memberId)
    res.json({ success: true, data: member })
  } catch (error) {
    next(error)
  }
}

export const bindClubCarMemberBinByAdminHandler = (req, res, next) => {
  try {
    const roleId = req.body?.roleId || req.params.roleId
    const member = bindClubMemberBinByRoleId(roleId, req.file)
    res.json({ success: true, data: member })
  } catch (error) {
    next(error)
  }
}

export const runClubCarSendNowHandler = async (req, res, next) => {
  try {
    const data = await clubCarScheduler.runSendNow()
    res.json({ success: true, data })
  } catch (error) {
    next(error)
  }
}

export const runClubCarClaimNowHandler = async (req, res, next) => {
  try {
    const data = await clubCarScheduler.runClaimNow()
    res.json({ success: true, data })
  } catch (error) {
    next(error)
  }
}

export const listClubCarRunLogsHandler = (req, res) => {
  const limit = Number(req.query.limit || 50)
  const roleId = String(req.query.roleId || '').trim()
  const logs = req.user?.role === 'admin'
    ? getClubCarRunLogs(limit)
    : getClubCarRunLogsByRoleId(roleId, limit)
  res.json({ success: true, data: logs })
}

export const memberClubCarLoginHandler = async (req, res, next) => {
  try {
    const payload = await authenticateClubMember({
      roleId: req.body?.roleId,
      password: req.body?.password,
    })
    res.json({ success: true, data: payload })
  } catch (error) {
    next(error)
  }
}

export const memberClubCarSetPasswordHandler = async (req, res, next) => {
  try {
    const member = await setClubMemberPasswordByRole(req.body?.roleId, req.body?.password)
    const payload = await authenticateClubMember({
      roleId: member.roleId,
      password: req.body?.password,
    })
    res.json({ success: true, data: payload })
  } catch (error) {
    next(error)
  }
}

export const memberClubCarChangePasswordHandler = async (req, res, next) => {
  try {
    const member = verifyClubMemberToken(req.headers.authorization)
    const updated = await updateClubMemberPasswordByRole(
      member.roleId,
      req.body?.currentPassword,
      req.body?.newPassword,
    )
    res.json({ success: true, data: updated })
  } catch (error) {
    next(error)
  }
}

export const getClubCarMemberProfileHandler = (req, res, next) => {
  try {
    const member = verifyClubMemberToken(req.headers.authorization)
    res.json({ success: true, data: member })
  } catch (error) {
    next(error)
  }
}

export const bindClubCarMemberBinHandler = (req, res, next) => {
  try {
    const member = verifyClubMemberToken(req.headers.authorization)
    const updated = bindClubMemberBinByRoleId(member.roleId, req.file)
    res.json({ success: true, data: updated })
  } catch (error) {
    next(error)
  }
}

export const updateClubCarMemberScheduleByRoleHandler = (req, res, next) => {
  try {
    const member = verifyClubMemberToken(req.headers.authorization)
    const updated = updateClubMemberScheduleByRole(member.roleId, {
      claimTime: req.body?.claimTime,
      claimEnabled: req.body?.claimEnabled,
    })
    res.json({ success: true, data: updated })
  } catch (error) {
    next(error)
  }
}
