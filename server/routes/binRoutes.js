import { Router } from 'express'
import multer from 'multer'
import { config } from '../config/index.js'
import { ensureDir } from '../utils/fileSystem.js'
import { authenticate } from '../middleware/auth.js'
import { uploadBin, getBins, removeBin, downloadBin } from '../controllers/binController.js'

ensureDir(config.uploadDir)

const upload = multer({ dest: config.uploadDir, limits: { fileSize: 50 * 1024 * 1024 } })

const router = Router()

router.get('/', authenticate, getBins)
router.post('/', authenticate, upload.single('bin'), uploadBin)
router.get('/:id/download', authenticate, downloadBin)
router.delete('/:id', authenticate, removeBin)

export default router
