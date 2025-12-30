import { Router } from 'express'
import authRoutes from './authRoutes.js'
import binRoutes from './binRoutes.js'
import storageRoutes from './storageRoutes.js'
import adminRoutes from './adminRoutes.js'
import activityRoutes from './activityRoutes.js'

const router = Router()

router.use('/auth', authRoutes)
router.use('/bins', binRoutes)
router.use('/storage', storageRoutes)
router.use('/admin', adminRoutes)
router.use('/activity', activityRoutes)

export default router
