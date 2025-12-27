import { Router } from 'express'
import { authenticate, requireAdmin } from '../middleware/auth.js'
import {
  listUsers,
  getUserDetail,
  removeUser,
  listUserBins,
  removeUserBin,
  downloadUserBin,
  updateUserPassword,
  getAdminPublicKey
} from '../controllers/adminController.js'

const router = Router()

router.use(authenticate, requireAdmin)
router.get('/users', listUsers)
router.get('/users/:id', getUserDetail)
router.delete('/users/:id', removeUser)
router.get('/users/:id/bins', listUserBins)
router.delete('/users/:id/bins/:binId', removeUserBin)
router.get('/users/:id/bins/:binId/download', downloadUserBin)
router.put('/users/:id/password', updateUserPassword)
router.get('/public-key', getAdminPublicKey)

export default router
