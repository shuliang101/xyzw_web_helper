import { Router } from 'express'
import { authenticate } from '../middleware/auth.js'
import {
  listTasksHandler,
  createTaskHandler,
  updateTaskHandler,
  deleteTaskHandler,
  toggleTaskHandler,
  getTaskLogsHandler,
  runTaskNowHandler,
} from '../controllers/scheduledTaskController.js'

const router = Router()

router.use(authenticate)

router.get('/', listTasksHandler)
router.post('/', createTaskHandler)
router.put('/:id', updateTaskHandler)
router.delete('/:id', deleteTaskHandler)
router.patch('/:id/toggle', toggleTaskHandler)
router.get('/:id/logs', getTaskLogsHandler)
router.post('/:id/run', runTaskNowHandler)

export default router
