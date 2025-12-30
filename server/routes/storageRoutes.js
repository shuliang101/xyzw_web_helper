import { Router } from 'express'
import { authenticate } from '../middleware/auth.js'
import { setStorage, getStorageByKey, listAllStorage, deleteStorage } from '../controllers/storageController.js'

const router = Router()

router.get('/', authenticate, listAllStorage)
router.get('/:key', authenticate, getStorageByKey)
router.post('/', authenticate, setStorage)
router.delete('/:key', authenticate, deleteStorage)

export default router
