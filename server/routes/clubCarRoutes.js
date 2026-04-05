import { Router } from 'express'
import multer from 'multer'
import { ensureDir } from '../utils/fileSystem.js'
import { config } from '../config/index.js'
import { authenticate, requireAdmin } from '../middleware/auth.js'
import {
  getClubCarConfigHandler,
  getClubCarClubInfoHandler,
  updateClubCarConfigHandler,
  uploadClubCarMasterBinHandler,
  syncClubCarMembersHandler,
  listClubCarMembersHandler,
  listClubCarSendPlansHandler,
  createClubCarSendPlanHandler,
  updateClubCarSendPlanHandler,
  deleteClubCarSendPlanHandler,
  updateClubCarMemberScheduleHandler,
  updateClubCarMemberTargetHandler,
  unbindClubCarMemberBinHandler,
  runClubCarSendNowHandler,
  runClubCarClaimNowHandler,
  listClubCarRunLogsHandler,
  memberClubCarLoginHandler,
  memberClubCarSetPasswordHandler,
  memberClubCarChangePasswordHandler,
  getClubCarMemberProfileHandler,
  bindClubCarMemberBinHandler,
  updateClubCarMemberScheduleByRoleHandler,
} from '../controllers/clubCarController.js'

ensureDir(config.clubCarDataDir)
ensureDir(config.clubCarUploadDir)
ensureDir(config.clubCarMasterBinDir)
ensureDir(config.clubCarMemberBinDir)

const upload = multer({ dest: config.clubCarUploadDir, limits: { fileSize: 50 * 1024 * 1024 } })

const router = Router()

router.post('/member/login', memberClubCarLoginHandler)
router.post('/member/set-password', memberClubCarSetPasswordHandler)
router.put('/member/password', memberClubCarChangePasswordHandler)
router.get('/member/profile', getClubCarMemberProfileHandler)
router.post('/member/bind-bin', upload.single('bin'), bindClubCarMemberBinHandler)
router.put('/member/schedule', updateClubCarMemberScheduleByRoleHandler)

router.use(authenticate, requireAdmin)

router.get('/config', getClubCarConfigHandler)
router.get('/club-info', getClubCarClubInfoHandler)
router.put('/config', updateClubCarConfigHandler)
router.post('/master-bin', upload.single('bin'), uploadClubCarMasterBinHandler)
router.post('/sync-members', syncClubCarMembersHandler)
router.get('/members', listClubCarMembersHandler)
router.get('/send-plans', listClubCarSendPlansHandler)
router.post('/send-plans', createClubCarSendPlanHandler)
router.put('/send-plans/:id', updateClubCarSendPlanHandler)
router.delete('/send-plans/:id', deleteClubCarSendPlanHandler)
router.put('/members/:id/schedule', updateClubCarMemberScheduleHandler)
router.put('/members/:id/target', updateClubCarMemberTargetHandler)
router.delete('/members/:id/bound-bin', unbindClubCarMemberBinHandler)
router.post('/run/send', runClubCarSendNowHandler)
router.post('/run/claim', runClubCarClaimNowHandler)
router.get('/logs', listClubCarRunLogsHandler)

export default router
