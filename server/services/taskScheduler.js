/**
 * 定时任务调度器
 * 使用 node-cron 管理定时任务
 */
import cron from 'node-cron'
import { getAllEnabledTasks, updateLastRun, createRunLog, updateRunLog } from './scheduledTaskService.js'
import { GameWebSocketClient, buildGameWsUrl, transformBinToToken } from '../utils/gameWebSocket.js'
import { ServerDailyTaskRunner } from './taskExecutorService.js'
import { getBinById } from './binService.js'

const allowedTaskNames = new Set(['startBatch', 'climbTower'])

class TaskScheduler {
  constructor() {
    this.jobs = new Map() // taskId -> cron.ScheduledTask
    this.runningTasks = new Set() // 正在执行的 taskId
  }

  start() {
    console.log('[Scheduler] 启动定时任务调度器...')
    this._loadAndRegister()
  }

  reload() {
    console.log('[Scheduler] 重新加载定时任务...')
    for (const [, job] of this.jobs) {
      job.stop()
    }
    this.jobs.clear()
    this._loadAndRegister()
  }

  stop() {
    for (const [, job] of this.jobs) {
      job.stop()
    }
    this.jobs.clear()
    console.log('[Scheduler] 调度器已停止')
  }

  _loadAndRegister() {
    try {
      const tasks = getAllEnabledTasks()
      console.log(`[Scheduler] 加载了 ${tasks.length} 个定时任务`)
      for (const task of tasks) {
        this._registerTask(task)
      }
    } catch (err) {
      console.error('[Scheduler] 加载任务失败:', err)
    }
  }

  _buildCronExpression(task) {
    if (task.runType === 'cron' && task.cronExpression) {
      return task.cronExpression
    }
    if (task.runType === 'daily' && task.runTime) {
      const [hour, minute] = task.runTime.split(':')
      return `${minute} ${hour} * * *`
    }
    return null
  }

  _registerTask(task) {
    const cronExpr = this._buildCronExpression(task)
    if (!cronExpr) {
      console.warn(`[Scheduler] 任务 ${task.id} (${task.name}) 没有有效的调度表达式，跳过`)
      return
    }

    if (!cron.validate(cronExpr)) {
      console.warn(`[Scheduler] 任务 ${task.id} (${task.name}) cron 表达式无效: ${cronExpr}，跳过`)
      return
    }

    const job = cron.schedule(cronExpr, () => {
      this._executeTask(task.id, task.name)
    }, { timezone: 'Asia/Shanghai' })

    this.jobs.set(task.id, job)
    console.log(`[Scheduler] 注册任务: ${task.name} (${cronExpr})`)
  }

  async _executeTask(taskId, taskName) {
    if (this.runningTasks.has(taskId)) {
      console.log(`[Scheduler] 任务 ${taskName} 正在执行中，跳过本次触发`)
      return
    }

    this.runningTasks.add(taskId)
    console.log(`[Scheduler] 开始执行任务: ${taskName}`)

    try {
      const tasks = getAllEnabledTasks()
      const task = tasks.find(t => t.id === taskId)
      if (!task || !task.enabled) {
        console.log(`[Scheduler] 任务 ${taskName} 已禁用，跳过`)
        return
      }

      await this.runTask(task)
      updateLastRun(taskId)
    } catch (err) {
      console.error(`[Scheduler] 任务 ${taskName} 执行失败:`, err)
    } finally {
      this.runningTasks.delete(taskId)
    }
  }

  async runTask(task) {
    // binIds: 存储的是 bin 文件 ID 数组
    const { binIds, taskSettings, userId, selectedTasks } = task
    if (!binIds || binIds.length === 0) {
      console.log(`[Scheduler] 任务 ${task.name} 没有配置角色，跳过`)
      return
    }

    const tasksToRun = (selectedTasks && selectedTasks.length > 0 ? selectedTasks : ['startBatch'])
      .filter((taskName) => allowedTaskNames.has(taskName))

    if (tasksToRun.length === 0) {
      console.log(`[Scheduler] 任务 ${task.name} 未包含可执行项，按默认日常任务执行`)
      tasksToRun.push('startBatch')
    }

    for (const binId of binIds) {
      const bin = getBinById(userId, binId)
      if (!bin) {
        console.warn(`[Scheduler] bin ${binId} 不存在或无权限，跳过`)
        continue
      }

      const logId = createRunLog(task.id, userId, String(binId))
      const logs = []

      let wsClient = null
      try {
        console.log(`[Scheduler] 登录角色: ${bin.originalName} (bin ${binId})`)
        const tokenStr = await transformBinToToken(bin.filePath)
        const wsUrl = buildGameWsUrl(tokenStr)
        wsClient = new GameWebSocketClient(wsUrl, { autoReconnect: false })
        await wsClient.connect()

        const runner = new ServerDailyTaskRunner(wsClient, taskSettings || {})
        const callbacks = {
          onLog: (entry) => {
            logs.push(entry)
            console.log(`[${task.name}][${bin.originalName}] ${entry.message}`)
          },
          onProgress: () => {},
        }

        for (const taskName of tasksToRun) {
          await runner.runByName(taskName, callbacks)
        }

        updateRunLog(logId, 'success', logs)
        console.log(`[Scheduler] ${bin.originalName} 执行完成`)
      } catch (err) {
        logs.push({ time: new Date().toLocaleTimeString(), message: `执行失败: ${err.message}`, type: 'error' })
        updateRunLog(logId, 'failed', logs)
        console.error(`[Scheduler] ${bin.originalName} 执行失败:`, err.message)
      } finally {
        wsClient?.disconnect()
      }

      await new Promise(resolve => setTimeout(resolve, 2000))
    }
  }
}

export const scheduler = new TaskScheduler()
