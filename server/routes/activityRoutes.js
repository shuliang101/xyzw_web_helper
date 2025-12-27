import { Router } from 'express'
import { authenticate } from '../middleware/auth.js'
import { listUserActivities } from '../controllers/activityController.js'

const router = Router()

router.get('/', authenticate, listUserActivities)

export default router
