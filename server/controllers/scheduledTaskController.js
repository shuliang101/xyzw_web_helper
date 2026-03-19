import {
  listTasks,
  getTask,
  createTask,
  updateTask,
  deleteTask,
  toggleTask,
  getTaskLogs,
} from '../services/scheduledTaskService.js'
import { scheduler } from '../services/taskScheduler.js'

const allowedSelectedTasks = new Set(['startBatch', 'climbTower'])
const sanitizeSelectedTasks = (selectedTasks) => (Array.isArray(selectedTasks) ? selectedTasks.filter(task => allowedSelectedTasks.has(task)) : [])

export const listTasksHandler = (req, res) => {
  const tasks = listTasks(req.user.id).map(task => ({
    ...task,
    selectedTasks: sanitizeSelectedTasks(task.selectedTasks),
  }))
  res.json({ success: true, data: tasks })
}

export const createTaskHandler = (req, res) => {
  const { name, runType, runTime, cronExpression, binIds, selectedTasks, taskSettings, enabled } = req.body
  if (!name || !runType || !binIds?.length) {
    return res.status(400).json({ success: false, message: '缺少必要参数: name, runType, binIds' })
  }
  if (runType === 'daily' && !runTime) {
    return res.status(400).json({ success: false, message: 'daily 类型需要提供 runTime (HH:mm)' })
  }
  if (runType === 'cron' && !cronExpression) {
    return res.status(400).json({ success: false, message: 'cron 类型需要提供 cronExpression' })
  }

  const task = createTask(req.user.id, {
    name,
    runType,
    runTime,
    cronExpression,
    binIds,
    selectedTasks: sanitizeSelectedTasks(selectedTasks),
    taskSettings,
    enabled,
  })
  scheduler.reload()
  res.status(201).json({ success: true, data: task })
}

export const updateTaskHandler = (req, res) => {
  const payload = {
    ...req.body,
    ...(req.body.selectedTasks !== undefined ? { selectedTasks: sanitizeSelectedTasks(req.body.selectedTasks) } : {}),
  }
  const task = updateTask(req.user.id, req.params.id, payload)
  if (!task) return res.status(404).json({ success: false, message: '任务不存在' })
  scheduler.reload()
  res.json({ success: true, data: task })
}

export const deleteTaskHandler = (req, res) => {
  const ok = deleteTask(req.user.id, req.params.id)
  if (!ok) return res.status(404).json({ success: false, message: '任务不存在' })
  scheduler.reload()
  res.json({ success: true })
}

export const toggleTaskHandler = (req, res) => {
  const task = toggleTask(req.user.id, req.params.id)
  if (!task) return res.status(404).json({ success: false, message: '任务不存在' })
  scheduler.reload()
  res.json({ success: true, data: task })
}

export const getTaskLogsHandler = (req, res) => {
  const task = getTask(req.user.id, req.params.id)
  if (!task) return res.status(404).json({ success: false, message: '任务不存在' })
  const limit = parseInt(req.query.limit) || 50
  const logs = getTaskLogs(req.params.id, limit)
  res.json({ success: true, data: logs })
}

export const runTaskNowHandler = async (req, res) => {
  const task = getTask(req.user.id, req.params.id)
  if (!task) return res.status(404).json({ success: false, message: '任务不存在' })

  // 异步执行，立即返回
  res.json({ success: true, message: '任务已触发，正在后台执行' })

  try {
    await scheduler.runTask(task)
  } catch (err) {
    console.error(`[RunNow] 任务 ${task.name} 执行失败:`, err)
  }
}
