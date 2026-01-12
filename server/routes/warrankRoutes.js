import { Router } from 'express'
import { authenticate } from '../middleware/auth.js'
import { exportMatchDetails } from '../controllers/warrankController.js'

const router = Router()

router.post('/export', authenticate, exportMatchDetails)

export default router
